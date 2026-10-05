import { describe, expect, it } from 'vitest'
import { fillFlyerProductArea as fillFlyerProductAreaImpl } from '../../scripts/lib/fill-flyer-product-area.mjs'

type FillFlyerProductAreaResult = { canvas: any; changes: any[]; skipReason?: string }

const fillFlyerProductArea = (source: any): FillFlyerProductAreaResult =>
  fillFlyerProductAreaImpl(source) as FillFlyerProductAreaResult

function fixture({ zoneOriginX = 'center', zoneOriginY = 'center', scaleX = 1, scaleY = 1, withSnapshot = true }: any = {}): any {
  const width = 900 / scaleX
  const height = 500 / scaleY
  const left = zoneOriginX === 'center' ? 540 : 90
  const top = zoneOriginY === 'center' ? 850 : 600
  return {
    version: '7.1.0',
    objects: [
      { type: 'Rect', name: 'template-frame', isFrame: true, left: 0, top: 0, width: 1080, height: 1920, scaleX: 1, scaleY: 1, angle: 0, originX: 'left', originY: 'top', visible: true },
      { type: 'Path', name: 'retail-validity-visual-band', left: 0, top: 483, width: 1080, height: 50, scaleX: 1, scaleY: 1, angle: 0, originX: 'left', originY: 'top', visible: true },
      { type: 'Rect', name: 'product-area-background', left: 70, top: 590, width: 940, height: 530, scaleX: 1, scaleY: 1, angle: 0, originX: 'left', originY: 'top', visible: true, rx: 14 },
      {
        type: 'Group', name: 'gridZone', isProductZone: true, _customId: 'zone-1',
        left, top, width, height, scaleX, scaleY, angle: 0,
        originX: zoneOriginX, originY: zoneOriginY, visible: true,
        _zoneWidth: 900, _zoneHeight: 500,
        objects: [{ type: 'Rect', left: 0, top: 0, width, height, scaleX: 1, scaleY: 1, angle: 0, originX: 'center', originY: 'center' }],
        ...(withSnapshot ? { _zoneStateSnapshot: { zone: { geometry: { x: left, y: top, width: 900, height: 500, scaleX, scaleY, angle: 0 }, layout: { columns: 3 } }, cards: [] } } : {})
      },
      { type: 'Textbox', name: 'header-title', left: 80, top: 40, width: 600, height: 80, scaleX: 1, scaleY: 1, angle: 0, originX: 'left', originY: 'top', visible: true, text: 'Ofertas' },
      { type: 'Rect', name: 'footer-background', left: 0, top: 1790, width: 1080, height: 130, scaleX: 1, scaleY: 1, angle: 0, originX: 'left', originY: 'top', visible: true }
    ]
  }
}

const zone = (canvas: any): any => canvas.objects.find((object: any) => object.isProductZone)
const panel = (canvas: any): any => canvas.objects.find((object: any) => object.name === 'product-area-background')
const renderedTop = (object: any): number => object.top - (object.originY === 'center' ? object.height * object.scaleY / 2 : object.originY === 'bottom' ? object.height * object.scaleY : 0)
const renderedBottom = (object: any): number => renderedTop(object) + object.height * object.scaleY

describe('fillFlyerProductArea', () => {
  it.each([
    ['left/top', 'left', 'top'],
    ['center/center', 'center', 'center']
  ])('moves the empty zone up for %s origins and preserves its bottom', (_label, originX, originY) => {
    const source = fixture({ zoneOriginX: originX, zoneOriginY: originY })
    const before = structuredClone(source)
    const result = fillFlyerProductArea(source)
    const updatedZone = zone(result.canvas)
    const updatedPanel = panel(result.canvas)

    expect(result.skipReason).toBeUndefined()
    expect(result.changes).toHaveLength(2)
    expect(renderedTop(updatedZone)).toBe(541)
    expect(renderedBottom(updatedZone)).toBe(1100)
    expect(renderedTop(updatedPanel)).toBe(531)
    expect(renderedBottom(updatedPanel)).toBe(1120)
    expect(source).toEqual(before)
    expect(result.canvas.objects[4]).toEqual(before.objects[4])
    expect(result.canvas.objects[5]).toEqual(before.objects[5])
  })

  it('preserves positive zone scales and synchronizes the snapshot in rendered geometry', () => {
    const result = fillFlyerProductArea(fixture({ scaleX: 1.25, scaleY: 1.5 }))
    const updatedZone = zone(result.canvas)
    const rect = updatedZone.objects[0]
    const snapshot = updatedZone._zoneStateSnapshot.zone.geometry

    expect(updatedZone.scaleX).toBe(1.25)
    expect(updatedZone.scaleY).toBe(1.5)
    expect(updatedZone._zoneWidth).toBe(900)
    expect(updatedZone._zoneHeight).toBe(559)
    expect(rect).toMatchObject({ left: 0, top: 0, originX: 'center', originY: 'center', width: 720, height: 372.6666666666667, scaleX: 1, scaleY: 1 })
    expect(snapshot).toEqual({ x: 540, y: 820.5, left: 540, top: 820.5, width: 720, height: 372.6666666666667, scaleX: 1.25, scaleY: 1.5, angle: 0 })
    expect(updatedZone._zoneStateSnapshot.zone.layout).toEqual({ columns: 3 })
  })

  it('is idempotent once the target gap is reached', () => {
    const first = fillFlyerProductArea(fixture())
    const second = fillFlyerProductArea(first.canvas)
    expect(second.skipReason).toMatch(/limite/)
    expect(second.changes).toEqual([])
    expect(second.canvas).toEqual(first.canvas)
  })

  it('extends a Polygon panel with scaleY, preserves intrinsic dimensions, and is idempotent', () => {
    const source = fixture()
    const polygonPanel = panel(source)
    polygonPanel.type = 'Polygon'
    polygonPanel.points = [{ x: 0, y: 0 }, { x: 940, y: 0 }, { x: 940, y: 530 }, { x: 0, y: 530 }]
    const originalHeight = polygonPanel.height
    const first = fillFlyerProductArea(source)
    const updated = panel(first.canvas)

    expect(first.skipReason).toBeUndefined()
    expect(updated.height).toBe(originalHeight)
    expect(updated.scaleY).toBeCloseTo(589 / originalHeight)
    expect(renderedTop(updated)).toBe(531)
    expect(renderedBottom(updated)).toBe(1120)

    const second = fillFlyerProductArea(first.canvas)
    expect(second.changes).toEqual([])
    expect(second.canvas).toEqual(first.canvas)
  })

  it('blocks seals and any other visible foreground that intersects the new corridor', () => {
    for (const foreground of [
      { type: 'Image', name: 'promo-seal', left: 200, top: 530, width: 80, height: 30, scaleX: 1, scaleY: 1, angle: 0, visible: true, originX: 'left', originY: 'top' },
      { type: 'Textbox', name: 'other-foreground', left: 300, top: 540, width: 100, height: 30, scaleX: 1, scaleY: 1, angle: 0, visible: true, originX: 'left', originY: 'top' }
    ]) {
      const source = fixture()
      source.objects.splice(4, 0, foreground)
      const result = fillFlyerProductArea(source)
      expect(result.skipReason).toContain(foreground.name)
      expect(result.changes).toEqual([])
      expect(result.canvas).toEqual(source)
    }
  })

  it('ignores a decorative section surface while checking the corridor', () => {
    const source = fixture()
    source.objects.splice(4, 0, { type: 'Rect', name: 'product-section-surface', left: 70, top: 210, width: 940, height: 460, scaleX: 1, scaleY: 1, angle: 0, visible: true, originX: 'left', originY: 'top' })
    const result = fillFlyerProductArea(source)
    expect(result.skipReason).toBeUndefined()
    expect(result.changes).toHaveLength(2)
  })

  it('skips horizontal models explicitly', () => {
    const source = fixture()
    source.objects[0].width = 1920
    source.objects[0].height = 1080
    const result = fillFlyerProductArea(source)
    expect(result.skipReason).toMatch(/horizontais/)
    expect(result.changes).toEqual([])
  })

  it('uses standard validity elements as a fallback and works without a panel', () => {
    const source = fixture()
    source.objects.splice(1, 1,
      { type: 'Rect', name: 'standard-validity-background', left: 20, top: 560, width: 1040, height: 48, scaleX: 1, scaleY: 1, angle: 0, visible: true, originX: 'left', originY: 'top' },
      { type: 'Textbox', name: 'stock-validity', left: 40, top: 610, width: 800, height: 6, scaleX: 1, scaleY: 1, angle: 0, visible: true, originX: 'left', originY: 'top' }
    )
    const originalZone = zone(source)
    originalZone.top = 883
    source.objects.splice(source.objects.findIndex((object: any) => object.name === 'product-area-background'), 1)
    const result = fillFlyerProductArea(source)

    expect(result.skipReason).toBeUndefined()
    expect(result.changes).toHaveLength(1)
    expect(renderedTop(zone(result.canvas))).toBe(624)
    expect(renderedBottom(zone(result.canvas))).toBe(1133)
    expect(result.canvas.objects.find((object: any) => object.name === 'stock-validity')).toEqual(source.objects.find((object: any) => object.name === 'stock-validity'))
  })

  it('skips multiple zones, populated zones, and filled snapshot cards', () => {
    const multiple = fixture()
    multiple.objects.push({ ...zone(multiple), _customId: 'zone-2' })
    expect(fillFlyerProductArea(multiple).skipReason).toMatch(/exatamente uma zona/)

    const populated = fixture()
    populated.objects.push({ type: 'Group', name: 'product-card-1', isProductCard: true, parentZoneId: 'zone-1', left: 100, top: 700, width: 100, height: 100, scaleX: 1, scaleY: 1, visible: true })
    expect(fillFlyerProductArea(populated).skipReason).toMatch(/produtos/)

    const snapshotPopulated = fixture()
    zone(snapshotPopulated)._zoneStateSnapshot.cards.push({ id: 'card-1' })
    expect(fillFlyerProductArea(snapshotPopulated).skipReason).toMatch(/produtos/)
  })
})
