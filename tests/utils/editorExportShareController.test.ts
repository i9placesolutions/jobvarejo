import { describe, expect, it, vi } from 'vitest'
import { prepareCanvasTypographyForOutput, withProductZonesHiddenForOutput } from '~/utils/editorExportShareController'
import { cache as fabricCache } from 'fabric'

const fabricObject = (overrides: Record<string, any> = {}) => {
  const object: any = {
    visible: true,
    excludeFromExport: false,
    set(key: string, value: any) {
      object[key] = value
    },
    setCoords: vi.fn(),
    ...overrides
  }
  return object
}

describe('withProductZonesHiddenForOutput', () => {
  it('oculta a reserva da logo apenas durante a saída e restaura o canvas', async () => {
    const logoSlot = fabricObject({
      type: 'rect',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })
    const canvas = { getObjects: () => [logoSlot] }
    const safeRequestRenderAll = vi.fn()
    const context: any = {
      canvas: { value: canvas },
      isLikelyProductZone: () => false,
      safeRequestRenderAll
    }

    await withProductZonesHiddenForOutput(context, () => {
      expect(logoSlot.visible).toBe(false)
      expect(logoSlot.excludeFromExport).toBe(true)
    })

    expect(logoSlot.visible).toBe(true)
    expect(logoSlot.excludeFromExport).toBe(false)
    expect(safeRequestRenderAll).toHaveBeenCalledTimes(2)
  })

  it('mantem a imagem dinamica da logo visivel na saída', async () => {
    const logoImage = fabricObject({
      type: 'image',
      businessProfileField: 'logo',
      quickLogoSlot: true
    })
    const context: any = {
      canvas: { value: { getObjects: () => [logoImage] } },
      isLikelyProductZone: () => false,
      safeRequestRenderAll: vi.fn()
    }

    await withProductZonesHiddenForOutput(context, () => {
      expect(logoImage.visible).toBe(true)
      expect(logoImage.excludeFromExport).toBe(false)
    })
  })
})

describe('prepareCanvasTypographyForOutput', () => {
  it('aguarda a prontidão das fontes antes de recalcular a validade inline', async () => {
    let resolveFonts!: () => void
    let fontsReady = false
    const ready = new Promise<void>(resolve => { resolveFonts = () => { fontsReady = true; resolve() } })
    vi.stubGlobal('document', { fonts: { ready } })
    const remeasurements: string[] = []
    vi.spyOn(fabricCache, 'clearFontCache').mockImplementation(() => { remeasurements.push('clear') })
    const date = fabricObject({
      type: 'textbox', fontFamily: 'Arial', quickValidityLayout: 'inline-footer', parentFrameId: 'frame',
      width: 100, height: 20, fontSize: 26, text: 'VALIDADE', textLines: [],
      initDimensions() {
        expect(fontsReady).toBe(true)
        remeasurements.push('validity')
        this.textLines = ['VALIDADE']
        this.height = 26
      },
      calcTextWidth: () => 90,
      getLineWidth: () => 90,
      getBoundingRect() { return { left: this.left, top: this.top, width: this.width, height: this.height } }
    })
    const bodyText = fabricObject({
      type: 'text', fontFamily: 'Arial', text: 'TEXTO',
      initDimensions() { remeasurements.push('body') }
    })
    const band = fabricObject({
      name: 'standard-validity-background', parentFrameId: 'frame',
      left: 0, top: 100, width: 1920, height: 72,
      getBoundingRect() { return { left: this.left, top: this.top, width: this.width, height: this.height } }
    })
    const pending = prepareCanvasTypographyForOutput({ getObjects: () => [date, bodyText, band] })
    await Promise.resolve()
    expect(date.textLines).toEqual([])
    resolveFonts()
    await pending
    expect(date.textLines).toEqual(['VALIDADE'])
    expect(remeasurements[0]).toBe('clear')
    expect(remeasurements).toContain('body')
    expect(remeasurements).toContain('validity')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
