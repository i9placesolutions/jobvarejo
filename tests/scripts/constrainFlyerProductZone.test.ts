import { describe, expect, it } from 'vitest'
import { constrainFlyerProductZone as constrainFlyerProductZoneImpl } from '../../scripts/lib/constrain-flyer-product-zone.mjs'

type Canvas = { version: string; objects: Array<Record<string, any>> }
const constrainFlyerProductZone = (source: Canvas, zoneId: string, safeBounds: any): {
  canvas: Canvas; changes: any[]; skipped: boolean; idempotent: boolean; skipReason?: string
} => constrainFlyerProductZoneImpl(source, zoneId, safeBounds)

const makeCanvas = (originX: string, originY: string, scaleX = 1, scaleY = 1): Canvas => {
  const zoneWidth = 600
  const zoneHeight = 935.56
  const zoneLeft = originX === 'center' ? 540 : 240
  const zoneTop = originY === 'center' ? 822.2 + zoneHeight / 2 : 822.2
  return {
    version: '7.1.0',
    objects: [
      {
        type: 'group', name: 'productZone', _customId: 'zone-1', isProductZone: true,
        originX, originY, left: zoneLeft, top: zoneTop,
        width: zoneWidth, height: zoneHeight, scaleX, scaleY,
        _zoneWidth: zoneWidth * scaleX, _zoneHeight: zoneHeight * scaleY,
        _zoneGlobalStyles: { prodNameFont: 'Barlow', priceColor: '#ffe000' },
        _zoneStateSnapshot: {
          zone: { id: 'zone-1', geometry: { x: zoneLeft, y: zoneTop, left: zoneLeft, top: zoneTop,
            width: zoneWidth * scaleX, height: zoneHeight * scaleY, scaleX, scaleY, angle: 0 }, layout: { columns: 2 },
            appearance: { stroke: '#c00' } },
          cards: [], globalStyles: { priceColor: '#ffe000' }
        },
        objects: [
          { type: 'rect', name: 'zoneRect', originX: 'center', originY: 'center', left: 0, top: 0,
            width: zoneWidth, height: zoneHeight, scaleX: 1, scaleY: 1, fill: '#fff', stroke: '#c00',
            strokeWidth: 3, strokeDashArray: [8, 4], rx: 14, ry: 14 },
          { type: 'textbox', name: 'zone title', originX: 'center', originY: 'center', left: 0, top: -20,
            width: 220, height: 32, scaleX: 1, scaleY: 1, fill: '#333', text: 'Ofertas' }
        ]
      },
      { type: 'image', name: 'reference artwork', _customId: 'art', left: 0, top: 0, width: 1080, height: 1920,
        scaleX: 1, scaleY: 1, src: 'data:image/mock', opacity: 1 },
      { type: 'rect', name: 'footer', left: 0, top: 1709.856, width: 1080, height: 210, fill: '#111' }
    ]
  }
}

const safeBounds = { left: 0, top: 0, width: 1080, height: 1709.856 }

describe('constrainFlyerProductZone', () => {
  it('contrai somente o excesso inferior de uma zona vazia e sincroniza retângulo e snapshot', () => {
    const source = makeCanvas('left', 'top')
    const artBefore = structuredClone(source.objects[1])
    const footerBefore = structuredClone(source.objects[2])
    const zoneBefore = structuredClone(source.objects[0]!)
    const result = constrainFlyerProductZone(source, 'zone-1', safeBounds)
    const zone = result.canvas.objects[0]!
    const oldBottom = zoneBefore.top + zoneBefore.height * zoneBefore.scaleY
    const expectedHeight = safeBounds.height - zoneBefore.top

    expect(result.skipped).toBe(false)
    expect(result.idempotent).toBe(false)
    expect(result.changes).toHaveLength(1)
    expect(zone.top).toBe(zoneBefore.top)
    expect(zone.left).toBe(zoneBefore.left)
    expect(zone.scaleX).toBe(zoneBefore.scaleX)
    expect(zone.scaleY).toBe(zoneBefore.scaleY)
    expect(zone._zoneHeight).toBeCloseTo(expectedHeight)
    expect(zone._zoneWidth).toBeCloseTo(zoneBefore.width * zoneBefore.scaleX)
    expect(zone.top + zone.height * zone.scaleY).toBeCloseTo(safeBounds.height)
    expect(oldBottom).toBeGreaterThan(safeBounds.height)
    expect(zone.objects[0].height).toBeCloseTo(zone.height)
    expect(zone.objects[0].width).toBeCloseTo(zone.width)
    expect(zone.objects[0].fill).toBe(zoneBefore.objects[0].fill)
    expect(zone.objects[0].stroke).toBe(zoneBefore.objects[0].stroke)
    expect(zone.objects[0].strokeDashArray).toEqual(zoneBefore.objects[0].strokeDashArray)
    expect(zone.objects[1]).toEqual(zoneBefore.objects[1])
    expect(zone._zoneGlobalStyles).toEqual(zoneBefore._zoneGlobalStyles)
    expect(zone._zoneStateSnapshot.zone.layout).toEqual(zoneBefore._zoneStateSnapshot.zone.layout)
    expect(zone._zoneStateSnapshot.zone.appearance).toEqual(zoneBefore._zoneStateSnapshot.zone.appearance)
    expect(zone._zoneStateSnapshot.zone.geometry).toMatchObject({
      x: zone.left, y: zone.top, left: zone.left, top: zone.top,
      width: zone.width, height: zone.height,
      scaleX: zone.scaleX, scaleY: zone.scaleY
    })
    expect(result.canvas.objects[1]).toEqual(artBefore)
    expect(result.canvas.objects[2]).toEqual(footerBefore)
    expect(source.objects[0]).toEqual(zoneBefore)
  })

  it('preserva os limites superiores com origem center ao contrair somente a parte inferior', () => {
    const source = makeCanvas('center', 'center')
    const before = source.objects[0]!
    const oldTop = before.top - before.height / 2
    const result = constrainFlyerProductZone(source, 'zone-1', safeBounds)
    const zone = result.canvas.objects[0]!

    expect(result.skipped).toBe(false)
    expect(zone.top - zone.height / 2).toBeCloseTo(oldTop)
    expect(zone.top + zone.height / 2).toBeCloseTo(safeBounds.height)
    expect(zone.originX).toBe('center')
    expect(zone.originY).toBe('center')
    expect(zone.scaleX).toBe(before.scaleX)
    expect(zone.scaleY).toBe(before.scaleY)
  })

  it('sincroniza bbox do retângulo interno escalado e mantém dimensões locais no snapshot', () => {
    const source = makeCanvas('center', 'center', 1.25, 1.5)
    const innerRect = source.objects[0]!.objects[0]
    innerRect.scaleX = 0.8
    innerRect.scaleY = 0.5
    const result = constrainFlyerProductZone(source, 'zone-1', safeBounds)
    const zone = result.canvas.objects[0]!
    const rect = zone.objects[0]

    expect(result.skipped).toBe(false)
    expect(rect.width * rect.scaleX).toBeCloseTo(zone.width)
    expect(rect.height * rect.scaleY).toBeCloseTo(zone.height)
    expect(rect.left - rect.width * rect.scaleX / 2).toBeCloseTo(-zone.width / 2)
    expect(rect.top - rect.height * rect.scaleY / 2).toBeCloseTo(-zone.height / 2)
    expect(zone._zoneStateSnapshot.zone.geometry).toMatchObject({
      width: zone.width,
      height: zone.height,
      scaleX: zone.scaleX,
      scaleY: zone.scaleY
    })
    expect(zone._zoneWidth).toBeCloseTo(zone.width * zone.scaleX)
    expect(zone._zoneHeight).toBeCloseTo(zone.height * zone.scaleY)
  })

  it('recusa zona com cartões vinculados sem modificar o canvas', () => {
    const source = makeCanvas('left', 'top')
    source.objects.push({ type: 'group', name: 'product card', isProductCard: true, parentZoneId: 'zone-1' })
    const before = structuredClone(source)
    const result = constrainFlyerProductZone(source, 'zone-1', safeBounds)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toMatch(/cartões ou produtos vinculados/)
    expect(result.changes).toEqual([])
    expect(result.canvas).toEqual(before)
    expect(source).toEqual(before)
  })

  it('recusa zona cujo status persistido indica conteúdo mesmo com lista de cards vazia', () => {
    const source = makeCanvas('left', 'top')
    source.objects[0]!._zoneStateSnapshot.zone.contentStatus = 'filled'
    const result = constrainFlyerProductZone(source, 'zone-1', safeBounds)

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toMatch(/marcada como preenchida/)
    expect(result.changes).toEqual([])
  })

  it('retorna idempotência na segunda aplicação', () => {
    const once = constrainFlyerProductZone(makeCanvas('left', 'top'), 'zone-1', safeBounds)
    const twice = constrainFlyerProductZone(once.canvas, 'zone-1', safeBounds)

    expect(twice.canvas).toEqual(once.canvas)
    expect(twice.changes).toEqual([])
    expect(twice.skipped).toBe(false)
    expect(twice.idempotent).toBe(true)
  })

  it('recusa rotação e geometria interna ambígua', () => {
    const rotated = makeCanvas('left', 'top')
    rotated.objects[0]!.angle = 5
    expect(constrainFlyerProductZone(rotated, 'zone-1', safeBounds).skipped).toBe(true)

    const ambiguous = makeCanvas('left', 'top')
    ambiguous.objects[0]!.objects.push({ type: 'rect', name: 'another rect', width: 100, height: 100 })
    const result = constrainFlyerProductZone(ambiguous, 'zone-1', safeBounds)
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toMatch(/Retângulo interno ausente, ambíguo/)
  })

  it('recusa limites explícitos ausentes em vez de interpretá-los como zero', () => {
    const result = constrainFlyerProductZone(makeCanvas('left', 'top'), 'zone-1', {
      left: null, top: 0, width: 1080, height: 1709.856
    })
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toMatch(/Limites seguros inválidos/)
  })
})
