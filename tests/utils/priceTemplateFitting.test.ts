import { describe, expect, it } from 'vitest'
import { createPriceTemplateFitting } from '~/utils/priceTemplateFitting'

const makeObject = (props: Record<string, any>) => ({
  visible: true,
  scaleX: 1,
  scaleY: 1,
  originX: 'left',
  originY: 'top',
  width: 0,
  height: 0,
  set(values: Record<string, any>) { Object.assign(this, values) },
  initDimensions() {},
  setCoords() {},
  ...props
})

const makeFitting = (objects: any[], anchors: any = { intY: 0, decY: 0, padLeft: 4, padRight: 4 }) => {
  const findByName = (all: any[], name: string) => all.find((object) => object?.name === name)
  const getHorizontalBounds = (object: any) => {
    if (!object || object.visible === false) return null
    const width = Number(object.width || 0) * Math.abs(Number(object.scaleX ?? 1) || 1)
    const left = Number(object.left || 0)
    if (!Number.isFinite(width) || width <= 0) return null
    if (object.originX === 'center') return { left: left - (width / 2), right: left + (width / 2) }
    if (object.originX === 'right') return { left: left - width, right: left }
    return { left, right: left + width }
  }
  const getVerticalBounds = (object: any) => {
    if (!object || object.visible === false) return null
    const height = Number(object.height || 0) * Math.abs(Number(object.scaleY ?? 1) || 1)
    const top = Number(object.top || 0)
    if (!Number.isFinite(height) || height <= 0) return null
    if (object.originY === 'center') return { top: top - (height / 2), bottom: top + (height / 2) }
    if (object.originY === 'bottom') return { top: top - height, bottom: top }
    return { top, bottom: top + height }
  }
  const measureHorizontalBounds = (items: any[]) => {
    const bounds = items.map(getHorizontalBounds).filter(Boolean) as Array<{ left: number; right: number }>
    if (!bounds.length) return null
    const left = Math.min(...bounds.map((bound) => bound.left))
    const right = Math.max(...bounds.map((bound) => bound.right))
    return { left, right, width: right - left }
  }

  return createPriceTemplateFitting({
    shouldPreserveManualTemplateVisual: () => true,
    collectObjectsDeep: () => objects,
    findByName,
    getSinglePriceBackgroundCandidate: (all) => findByName(all, 'price_bg'),
    getSinglePriceCurrencyTextCandidate: () => null,
    ensureSinglePriceCurrencyCircleAnchor: () => null,
    readSingleManualPriceAnchors: () => anchors,
    isObjectShownForBounds: (object) => !!object && object.visible !== false && object.scaleX !== 0 && object.scaleY !== 0,
    getObjectHorizontalBoundsLocal: getHorizontalBounds,
    getObjectVerticalBoundsLocal: getVerticalBounds,
    measureHorizontalBoundsLocal: measureHorizontalBounds,
    layoutPrice: () => {},
    isRichPriceTextObject: () => true,
    positionRichPriceUnit: () => true,
    constrainSinglePriceTextInsideBackground: () => {},
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    priceIntegerDecimalGapPx: 4
  })
}

describe('createPriceTemplateFitting', () => {
  it('recupera o texto rich quando a posição persistida ficou fora da etiqueta', () => {
    const background: any = makeObject({ name: 'price_bg', width: 470, height: 180, originY: 'top' })
    const richPrice: any = makeObject({
      name: 'price_value_text',
      width: 115,
      height: 40,
      originY: 'center',
      top: -1857,
      left: 0,
      text: '29,99'
    })
    const unit: any = makeObject({ name: 'price_unit_text', width: 24, height: 18, top: 18, text: 'UN' })
    const group = { getObjects: () => [background, richPrice, unit], dirty: false, set() {}, setCoords() {} }
    const fitting = makeFitting([background, richPrice, unit])

    fitting.fitManualSinglePriceValuesIntoTemplate(group)

    expect(richPrice.top).toBe(0)
    expect(richPrice.top).not.toBe(-1857)
  })

  it('preserva um deslocamento vertical manual que ainda está dentro do fundo', () => {
    const background: any = makeObject({ name: 'price_bg', width: 470, height: 180 })
    const richPrice: any = makeObject({
      name: 'price_value_text',
      width: 115,
      height: 40,
      originY: 'center',
      top: 28,
      text: '29,99'
    })
    const group = { getObjects: () => [background, richPrice], dirty: false, set() {}, setCoords() {} }
    const fitting = makeFitting([background, richPrice])

    fitting.fitManualSinglePriceValuesIntoTemplate(group)

    expect(richPrice.top).toBe(28)
  })

  it('preserva a escala autorada do texto rich durante a reorganizacao da etiqueta', () => {
    const background: any = makeObject({ name: 'price_bg', width: 823, height: 333 })
    const richPrice: any = makeObject({
      name: 'price_value_text',
      width: 198.14,
      height: 113,
      originY: 'center',
      top: 16,
      left: -148,
      scaleX: 2.612,
      scaleY: 2.612,
      __originalScaleX: 1,
      __originalScaleY: 1,
      text: '49,99'
    })
    const group: any = {
      __preserveManualLayout: true,
      getObjects: () => [background, richPrice],
      dirty: false,
      set() {},
      setCoords() {}
    }
    const fitting = makeFitting([background, richPrice])

    fitting.fitManualSinglePriceValuesIntoTemplate(group)

    expect(richPrice.scaleX).toBeCloseTo(2.612, 6)
    expect(richPrice.scaleY).toBeCloseTo(2.612, 6)
  })
})
