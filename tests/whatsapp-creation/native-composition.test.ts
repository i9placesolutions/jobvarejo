import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
import { repairDynamicTextLayoutBounds } from '../../utils/dynamicTextLayoutBounds'
import { layoutManualFlyerComposition } from '../../workers/whatsapp-creation/native-composition'

type FixturePage = {
  id: string
  format: string
  width: number
  height: number
  footer: string[]
  validity: string[]
  objects: any[]
}

// Sanitized subset of current real catalog models: geometry and layout flags
// are retained; business values, asset data, and account identifiers are not.
const fixturePages = JSON.parse(readFileSync(
  new URL('../fixtures/whatsapp-creation/manual-composition-matrix.json', import.meta.url),
  'utf8'
)) as FixturePage[]

const attachGeometry = (object: any): any => {
  object.set = (patch: Record<string, any> | string, value?: any) => {
    if (typeof patch === 'string') object[patch] = value
    else Object.assign(object, patch)
    return object
  }
  object.setCoords = () => undefined
  object.getBoundingRect = () => ({
    left: Number(object.left || 0) - (object.originX === 'center' ? Number(object.width || 0) / 2 : object.originX === 'right' ? Number(object.width || 0) : 0),
    top: Number(object.top || 0) - (object.originY === 'center' ? Number(object.height || 0) / 2 : object.originY === 'bottom' ? Number(object.height || 0) : 0),
    width: Number(object.width || 0) * Math.abs(Number(object.scaleX || 1)),
    height: Number(object.height || 0) * Math.abs(Number(object.scaleY || 1))
  })
  object.initDimensions = () => undefined
  object.calcTextWidth = () => String(object.text || '').length * Number(object.fontSize || 20) * .58
  object.getLineWidth = () => object.calcTextWidth()
  object.calcTextHeight = () => Number(object.height || object.fontSize || 20)
  return object
}

const materialize = (page: FixturePage): any[] =>
  JSON.parse(JSON.stringify(page.objects)).map(attachGeometry)

const createBackdrop = (objects: any[]) => (props: Record<string, any>, index: number) => {
  const band = attachGeometry({ type: 'rect', ...props, _customId: 'fixture-validity-backdrop' })
  objects.splice(index, 0, band)
  return band
}

const manualSequence = (objects: any[]) => {
  let changed = compactBusinessFooter(objects)
  const repair = repairDynamicTextLayoutBounds(objects, createBackdrop(objects))
  changed = compactBusinessFooter(objects) || changed
  return { changed: changed || repair.changed, unresolved: repair.unresolved }
}

const snapshot = (objects: any[]) => JSON.parse(JSON.stringify(objects))

describe('composição manual compartilhada do worker WhatsApp', () => {
  it('corresponde diretamente aos helpers manuais nas 18 combinações reais de família, formato e dimensão', () => {
    expect(fixturePages).toHaveLength(18)
    expect(new Set(fixturePages.map(page => `${page.footer.join('+')}|${page.validity.join('+')}`)).size).toBe(6)

    for (const page of fixturePages) {
      const facadeObjects = materialize(page)
      const directObjects = materialize(page)
      const facadeResult = layoutManualFlyerComposition(facadeObjects, createBackdrop(facadeObjects))
      const directResult = manualSequence(directObjects)

      expect({ result: facadeResult, objects: snapshot(facadeObjects) }, page.id).toEqual({
        result: directResult,
        objects: snapshot(directObjects)
      })
      expect(page.width).toBeGreaterThan(0)
      expect(page.height).toBeGreaterThan(0)
    }
  })

  it('mantém transformação manual e campos vazios ocultos com textos de perfil longos', () => {
    const page = fixturePages.find(item => item.footer.includes('reference-contacts') && item.validity.includes('inline-footer'))!
    const objects = materialize(page)
    const address = objects.find(object => object.businessProfileField === 'address')
    const whatsapp = objects.find(object => object.businessProfileField === 'whatsapp')
    const instagram = objects.find(object => object.businessProfileField === 'instagram')
    expect(address && whatsapp && instagram).toBeTruthy()

    address.__manualTransform = true
    const manualGeometry = ['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'originX', 'originY']
      .map(key => address[key])
    expect(layoutManualFlyerComposition(objects, createBackdrop(objects)).unresolved).toEqual([])
    expect(manualGeometry).toEqual(['left', 'top', 'width', 'height', 'scaleX', 'scaleY', 'angle', 'originX', 'originY']
      .map(key => address[key]))
    for (const field of [whatsapp, instagram]) {
      const bounds = field.getBoundingRect()
      expect(bounds.left).toBeGreaterThanOrEqual(-.5)
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(page.width + .5)
      expect(bounds.top).toBeGreaterThanOrEqual(-.5)
      expect(bounds.top + bounds.height).toBeLessThanOrEqual(page.height + .5)
    }

    for (const field of [address, whatsapp, instagram]) {
      field.text = ''
      field.visible = false
    }
    expect(layoutManualFlyerComposition(objects, createBackdrop(objects)).unresolved).toEqual([])
    expect([address, whatsapp, instagram].every(field => field.visible === false)).toBe(true)
  })

  it('devolve o contrato do editor sem alterar uma página vazia', () => {
    const objects: any[] = []
    expect(layoutManualFlyerComposition(objects, () => undefined)).toEqual({ changed: false, unresolved: [] })
    expect(objects).toEqual([])
  })
})
