import { describe, expect, it } from 'vitest'
import { repairFlyerHeaderGeometry as repairFlyerHeaderGeometryImpl } from '../../scripts/lib/repair-flyer-header-geometry.mjs'

type HeaderCanvas = { version: string; background: string; objects: Array<Record<string, any>> }
const repairFlyerHeaderGeometry = (source: HeaderCanvas, options?: any): {
  canvas: HeaderCanvas; changes: any[]; warnings: string[]
} => repairFlyerHeaderGeometryImpl(source, options)

const makeCanvas = (): HeaderCanvas => ({
  version: '7.1.0', background: '#fff',
  objects: [
    { type: 'Rect', name: 'frame', _customId: 'frame', isFrame: true, originX: 'left', originY: 'top', left: 0, top: 0, width: 1080, height: 1920, scaleX: 1, scaleY: 1 },
    { type: 'Image', name: 'quickCampaignSeal', _customId: 'seal', originX: 'left', originY: 'top', left: -20, top: -15, width: 280, height: 160, scaleX: 1, scaleY: 1, src: 'seal.png' },
    { type: 'Image', name: 'header-logo-slot', _customId: 'logo', originX: 'left', originY: 'top', left: 625, top: 12, width: 398, height: 213, scaleX: .2, scaleY: .2, quickLogoSlot: true, businessProfileField: 'logo', quickLogoMaxWidth: 79.6, quickLogoMaxHeight: 42.6, quickLogoCenterX: 665, quickLogoCenterY: 33 },
    { type: 'Rect', name: 'header-instagram-panel', _customId: 'ig-panel', originX: 'left', originY: 'top', left: 620, top: 300, width: 400, height: 110, scaleX: 1, scaleY: 1 },
    { type: 'Rect', name: 'header-instagram-background', _customId: 'ig-band', originX: 'left', originY: 'top', left: 650, top: 340, width: 300, height: 60, scaleX: 1, scaleY: 1 },
    { type: 'Textbox', name: 'header-instagram-title', _customId: 'ig-title', originX: 'left', originY: 'top', left: 650, top: 308, width: 340, height: 25, scaleX: 1, scaleY: 1, text: 'SIGA NOSSO INSTAGRAM' },
    { type: 'Textbox', name: 'header-instagram', _customId: 'ig-text', originX: 'left', originY: 'top', left: 680, top: 370, width: 120, height: 18, scaleX: 1, scaleY: 1, businessProfileField: 'instagram', text: '@mercado' },
    { type: 'Rect', name: 'standard-validity-background', _customId: 'validity-bg', originX: 'left', originY: 'top', left: 20, top: 500, width: 1040, height: 60, scaleX: 1, scaleY: 1 },
    { type: 'Rect', name: 'products', _customId: 'products', originX: 'left', originY: 'top', left: 80, top: 600, width: 920, height: 1200, scaleX: 1, scaleY: 1, isProductZone: true, products: [{ id: 'p1' }] },
    { type: 'Textbox', name: 'footer', _customId: 'footer', left: 0, top: 1840, width: 1080, height: 80, text: 'Rodapé intacto' }
  ]
})

describe('repairFlyerHeaderGeometry', () => {
  it('corrige selo, logo e guia Instagram e preserva zonas e demais objetos', () => {
    const source = makeCanvas()
    const productsBefore = structuredClone(source.objects.find(o => o.name === 'products'))
    const footerBefore = structuredClone(source.objects.find(o => o.name === 'footer'))
    const result = repairFlyerHeaderGeometry(source)
    const objects = result.canvas.objects
    const seal = objects.find(o => o.name === 'quickCampaignSeal')!
    const logo = objects.find(o => o.name === 'header-logo-slot')!
    const panel = objects.find(o => o.name === 'header-instagram-panel')!
    const guide = objects.find(o => o.name === 'header-instagram-background')!
    const title = objects.find(o => o.name === 'header-instagram-title')!
    const instagram = objects.find(o => o.name === 'header-instagram')!

    expect(result.changes.length).toBeGreaterThan(0)
    expect(seal.originX).toBe('left')
    expect(seal.left).toBeGreaterThanOrEqual(8)
    expect(seal.top).toBeGreaterThanOrEqual(8)
    expect(seal.left + seal.width * seal.scaleX).toBeLessThanOrEqual(logo.left - 12 + 0.01)
    expect(logo.quickLogoCenterX).toBeCloseTo(panel.left + panel.width / 2)
    expect(logo.quickLogoMaxWidth).toBeCloseTo(panel.width)
    expect(logo.quickLogoCenterY).toBeCloseTo(logo.top + logo.height * logo.scaleY / 2)
    expect(guide.top + guide.height).toBeCloseTo(panel.top + panel.height)
    expect(guide.height).toBeLessThanOrEqual(52)
    expect(guide.headerInstagramMaxWidth).toBeCloseTo(panel.width)
    expect(guide.headerInstagramCenterX).toBeCloseTo(panel.left + panel.width / 2)
    expect(title.text).toBe('SIGA NOSSO INSTAGRAM')
    expect(instagram.top).toBe(370)
    expect(instagram.width).toBe(120)
    expect(objects.find(o => o.name === 'products')).toEqual(productsBefore)
    expect(objects.find(o => o.name === 'footer')).toEqual(footerBefore)
  })

  it('é idempotente depois do primeiro ajuste', () => {
    const once = repairFlyerHeaderGeometry(makeCanvas())
    const twice = repairFlyerHeaderGeometry(once.canvas)
    expect(twice.canvas).toEqual(once.canvas)
    expect(twice.changes).toEqual([])
  })

  it('não altera múltiplos selos e avisa sobre ambiguidade e painel ausente', () => {
    const source = makeCanvas()
    source.objects.splice(2, 0, { ...structuredClone(source.objects[1]), _customId: 'seal-2', name: 'Selo alternativo' })
    source.objects = source.objects.filter(o => o.name !== 'header-instagram-panel' && o.name !== 'header-instagram-background' && o.name !== 'header-instagram-title' && o.name !== 'header-instagram')
    const sealsBefore = source.objects.filter(o => /seal/i.test(o.name || '')).map(o => ({ left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY }))
    const result = repairFlyerHeaderGeometry(source)
    expect(result.warnings.some(w => /Mais de um selo/.test(w))).toBe(true)
    expect(result.warnings.some(w => /Painel Instagram nativo ausente/.test(w))).toBe(true)
    expect(result.canvas.objects.filter(o => /seal/i.test(o.name || '')).map(o => ({ left: o.left, top: o.top, scaleX: o.scaleX, scaleY: o.scaleY }))).toEqual(sealsBefore)
  })

  it('usa limites alpha normalizados ao encaixar uma imagem de selo', () => {
    const source = makeCanvas()
    const result = repairFlyerHeaderGeometry(source, { alphaAssets: { seal: { x: .1, y: .1, width: .8, height: .8 } } })
    const seal = result.canvas.objects.find(o => o.name === 'quickCampaignSeal')!
    expect(seal.left + seal.width * seal.scaleX * .1).toBeGreaterThanOrEqual(8 - .01)
    expect(seal.top + seal.height * seal.scaleY * .1).toBeGreaterThanOrEqual(8 - .01)
  })

  it('encaixa selo e logo na coluna esquerda do formato TV sem tocar na zona', () => {
    const source: HeaderCanvas = { version: '7.1.0', background: '#fff', objects: [
      { type: 'Rect', name: 'frame', _customId: 'tv-frame', isFrame: true, originX: 'center', originY: 'center', left: 960, top: 540, width: 1920, height: 1080, scaleX: 1, scaleY: 1 },
      { type: 'Image', name: 'Selo promocional', _customId: 'tv-seal', originX: 'left', originY: 'top', left: -400, top: -200, width: 600, height: 420, scaleX: 1, scaleY: 1 },
      { type: 'Image', name: 'header-logo-slot', _customId: 'tv-logo', originX: 'left', originY: 'top', left: -250, top: 20, width: 500, height: 260, scaleX: 1, scaleY: 1, quickLogoSlot: true, businessProfileField: 'logo' },
      { type: 'Rect', name: 'retail-validity-visual-band', _customId: 'tv-validity', originX: 'left', originY: 'top', left: 0, top: 1000, width: 1920, height: 60, scaleX: 1, scaleY: 1 },
      { type: 'Rect', name: 'tv-zone', _customId: 'tv-zone', originX: 'left', originY: 'top', left: 1240, top: 80, width: 620, height: 840, scaleX: 1, scaleY: 1, isProductZone: true }
    ] }
    const zoneBefore = structuredClone(source.objects[4])
    const result = repairFlyerHeaderGeometry(source)
    const seal = result.canvas.objects[1]
    const logo = result.canvas.objects[2]
    if (!seal || !logo) throw new Error('Selo e logo devem ser preservados no canvas TV.')
    const unit = 1920 / 1080
    const validityTop = 1000
    const sealBottom = seal.top + seal.height * seal.scaleY
    expect(seal.left).toBeGreaterThanOrEqual(8 * unit - .01)
    expect(seal.left + seal.width * seal.scaleX).toBeLessThanOrEqual(1240 - 12 * unit + .01)
    expect(seal.top).toBeGreaterThanOrEqual(8 * unit - .01)
    expect(sealBottom).toBeLessThanOrEqual(1080 * .48 + .01)
    expect(logo.top).toBeGreaterThanOrEqual(Math.max(1080 * .52, sealBottom + 12 * unit) - .01)
    expect(logo.top + logo.height * logo.scaleY).toBeLessThanOrEqual(validityTop - 12 * unit + .01)
    expect(result.canvas.objects[4]).toEqual(zoneBefore)
  })
})
