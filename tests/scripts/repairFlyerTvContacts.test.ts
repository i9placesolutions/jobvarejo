import { describe, expect, it } from 'vitest'
import { repairFlyerTvContacts } from '../../scripts/lib/repair-flyer-tv-contacts.mjs'

const tvFixture = (): any => ({
  objects: [
    { type: 'Rect', name: 'template-frame-sample-tv', isFrame: true, left: 0, top: 0, width: 1920, height: 1080, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', visible: true },
    { type: 'Image', name: 'brand-logo', businessProfileField: 'logo', quickLogoSlot: true, left: 35, top: 38, width: 220, height: 95, scaleX: 1, scaleY: 1, visible: true, opacity: 1 },
    { type: 'Rect', name: 'retail-validity-visual-band', left: 0, top: 990, width: 1920, height: 40, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', visible: true, opacity: 1 },
    { type: 'Rect', name: 'standard-validity-background', left: 0, top: 994, width: 1920, height: 35, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', visible: true, opacity: 1 },
    { type: 'Textbox', name: 'header-validity', quickDataField: 'validity', quickValidityLayout: 'inline-footer', dynamicFieldHeight: 36, left: 720, top: 998, width: 440, height: 26, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', visible: true, opacity: 1, text: 'Válido até 10/10/2026' },
    { type: 'Rect', name: 'header-instagram-background', left: 1590, top: 910, width: 270, height: 45, visible: true, opacity: 1 },
    { type: 'Group', name: 'header-icon-instagram', quickDynamicIconFor: 'instagram', left: 1600, top: 920, width: 24, height: 24, visible: true, opacity: 1 },
    { type: 'Textbox', name: 'header-instagram', businessProfileField: 'instagram', quickFieldEnabled: true, left: 1630, top: 920, width: 200, height: 24, visible: true, opacity: 1, text: '@mercado' },
    { type: 'Group', name: 'footer-dynamic-footerPaymentImages', businessProfileField: 'footerPaymentImages', quickFieldEnabled: true, left: 400, top: 1020, width: 300, height: 40, visible: true, opacity: 1, objects: [{ type: 'Image', name: 'card-visa', width: 40, height: 24 }] },
    { type: 'Group', name: 'icon-whatsapp', quickDynamicIconFor: 'whatsapp', left: 20, top: 1030, width: 22, height: 22, visible: true, opacity: 1 },
    { type: 'Textbox', name: 'footer-dynamic-whatsapp', businessProfileField: 'whatsapp', quickFieldEnabled: true, left: 60, top: 1030, width: 250, height: 26, visible: true, opacity: 1, text: '(64) 99999-9999' },
    { type: 'Textbox', name: 'footer-dynamic-address', quickDataField: 'address', quickFieldEnabled: true, left: 800, top: 1030, width: 600, height: 26, visible: true, opacity: 1, text: 'Rua das Ofertas' },
    { type: 'Textbox', name: 'footer-reference-address-label', left: 800, top: 1010, width: 500, height: 16, visible: true, opacity: 1, text: 'ENDEREÇO' },
    { type: 'Rect', name: 'footer-column-divider-1', left: 750, top: 1010, width: 2, height: 50, visible: true, opacity: 1 },
    { type: 'Path', name: 'footer-premium-background', footerLayout: 'reference-contacts', left: 0, top: 1020, width: 1920, height: 60, visible: true, opacity: 1 },
    { type: 'Path', name: 'reference-footer-inner-highlight', left: 15, top: 1022, width: 1890, height: 16, visible: true, opacity: 1 },
    { type: 'Image', name: 'Reference background footer', left: 0, top: 930, width: 1920, height: 150, visible: true, opacity: 1 },
    { type: 'Group', name: 'gridZone', isProductZone: true, left: 0, top: 260, width: 1920, height: 680, scaleX: 1, scaleY: 1, visible: true, objects: [{ type: 'Rect', name: 'product-card-1', text: 'Produto', left: 0, top: 0, width: 250, height: 300 }] }
  ]
})

const named = (canvas: any, name: string): any => canvas.objects.find((object: any) => object.name === name)
const box = (object: any) => ({ top: object.top, bottom: object.top + object.height * (object.scaleY || 1), height: object.height * (object.scaleY || 1) })

describe('repairFlyerTvContacts', () => {
  it('hides contact fields and footer art, removes dynamic bindings, and extends only the lower validity band', () => {
    const source = tvFixture()
    const original = structuredClone(source)
    const result = repairFlyerTvContacts(source)

    expect(result.skipReason).toBeUndefined()
    expect(result.warnings).toEqual([])
    for (const name of ['header-instagram', 'header-icon-instagram', 'footer-dynamic-footerPaymentImages', 'icon-whatsapp', 'footer-dynamic-whatsapp', 'footer-dynamic-address', 'footer-reference-address-label', 'footer-column-divider-1']) {
      expect(named(result.canvas, name)).toMatchObject({ visible: false, opacity: 0, quickFieldEnabled: false })
    }
    for (const name of ['footer-premium-background', 'reference-footer-inner-highlight', 'Reference background footer', 'header-instagram-background']) {
      expect(named(result.canvas, name)).toMatchObject({ visible: false, opacity: 0 })
    }
    expect(named(result.canvas, 'header-instagram')).not.toHaveProperty('businessProfileField')
    expect(named(result.canvas, 'header-icon-instagram')).not.toHaveProperty('quickDynamicIconFor')
    expect(named(result.canvas, 'footer-dynamic-address')).not.toHaveProperty('quickDataField')

    expect(box(named(result.canvas, 'retail-validity-visual-band'))).toEqual({ top: 990, bottom: 1072, height: 82 })
    expect(box(named(result.canvas, 'standard-validity-background'))).toEqual({ top: 994, bottom: 1072, height: 78 })
    expect(named(result.canvas, 'header-validity')).toMatchObject({ quickDataField: 'validity', quickValidityLayout: 'inline-footer', dynamicFieldHeight: 82 })
    expect(named(result.canvas, 'header-validity').top).toBe(original.objects[4].top)
    expect(named(result.canvas, 'brand-logo')).toEqual(named(source, 'brand-logo'))
    expect(named(result.canvas, 'gridZone')).toEqual(named(source, 'gridZone'))
    expect(source).toEqual(original)
  })

  it('is idempotent and leaves no dynamic contact binding that can revive the fields', () => {
    const first = repairFlyerTvContacts(tvFixture())
    const second = repairFlyerTvContacts(first.canvas)

    expect(second.changes).toEqual([])
    expect(named(second.canvas, 'footer-dynamic-whatsapp')).toMatchObject({ visible: false, opacity: 0, quickFieldEnabled: false })
    expect(named(second.canvas, 'footer-dynamic-whatsapp')).not.toHaveProperty('businessProfileField')
    expect(named(second.canvas, 'footer-dynamic-whatsapp').text).toBe('(64) 99999-9999')
  })

  it('does not alter portrait/square formats', () => {
    const source = tvFixture()
    named(source, 'template-frame-sample-tv').width = 1080
    named(source, 'template-frame-sample-tv').height = 1080
    const before = structuredClone(source)
    const result = repairFlyerTvContacts(source)

    expect(result.skipReason).toMatch(/formato TV/)
    expect(result.changes).toEqual([])
    expect(result.canvas).toEqual(before)
  })

  it('does not resize a validity band in the middle and reports the reason', () => {
    const source = tvFixture()
    const band = named(source, 'retail-validity-visual-band')
    band.top = 500
    named(source, 'standard-validity-background').top = 504
    const before = structuredClone(source)
    const result = repairFlyerTvContacts(source)

    expect(result.warnings).toContain('Faixa de validade retail-validity-visual-band não está na região inferior; geometria preservada.')
    expect(named(result.canvas, 'retail-validity-visual-band')).toEqual(named(before, 'retail-validity-visual-band'))
    expect(named(result.canvas, 'standard-validity-background')).toEqual(named(before, 'standard-validity-background'))
  })

  it('preserves the footer surface when that layout also carries a native logo', () => {
    const source = tvFixture()
    named(source, 'footer-premium-background').footerLayout = 'logo-contacts-address'
    source.objects.push({ type: 'Rect', name: 'footer-logo-slot', businessProfileField: 'logo', quickLogoSlot: true, left: 20, top: 1020, width: 120, height: 48, visible: true, opacity: 1 })
    const result = repairFlyerTvContacts(source)

    expect(named(result.canvas, 'footer-premium-background')).toMatchObject({ visible: true, opacity: 1 })
    expect(named(result.canvas, 'footer-logo-slot')).toEqual(named(source, 'footer-logo-slot'))
  })

  it('extends Path validity art by scaleY while preserving its intrinsic path dimensions', () => {
    const source = tvFixture()
    const band = named(source, 'retail-validity-visual-band')
    band.type = 'Path'
    band.height = 40
    const result = repairFlyerTvContacts(source)
    const repairedBand = named(result.canvas, 'retail-validity-visual-band')

    expect(repairedBand.height).toBe(40)
    expect(repairedBand.scaleY).toBeCloseTo(2.05)
    expect(repairedBand.top).toBe(990)
    expect(box(repairedBand).bottom).toBeCloseTo(1072)
  })
})
