import { describe, expect, it, vi } from 'vitest'
import { resolveQuickLogoSlotCenter } from '../../utils/quickLogoSlotGeometry'

describe('resolveQuickLogoSlotCenter', () => {
  const fallback = [321, 654] as const

  it.each([
    ['center', 'center', 100, 200],
    ['left', 'top', 110, 210],
    ['right', 'bottom', 90, 190]
  ])('uses Fabric getCenterPoint for origin %s/%s', (originX, originY, centerX, centerY) => {
    const getCenterPoint = vi.fn(() => ({ x: centerX, y: centerY }))
    const center = resolveQuickLogoSlotCenter(
      { type: 'IMAGE', originX, originY, left: 10, top: 20, getCenterPoint },
      1,
      2,
      ...fallback
    )

    expect(center).toEqual({ centerX, centerY })
    expect(getCenterPoint).toHaveBeenCalledOnce()
  })

  it('uses Fabric transformed center when rotated', () => {
    const center = resolveQuickLogoSlotCenter(
      { type: 'image', angle: 90, getCenterPoint: () => ({ x: 44.5, y: 88.25 }) },
      null,
      null,
      ...fallback
    )

    expect(center).toEqual({ centerX: 44.5, centerY: 88.25 })
  })

  it.each([
    ['center', 'center', 100, 200],
    ['left', 'top', 120, 240],
    ['right', 'bottom', 80, 160]
  ])('reconstructs JSON center from %s/%s origins and rendered dimensions', (originX, originY, centerX, centerY) => {
    const center = resolveQuickLogoSlotCenter(
      {
        type: 'ImAgE',
        originX,
        originY,
        left: 100,
        top: 200,
        width: 40,
        height: 80,
        scaleX: 1,
        scaleY: 1
      },
      1,
      2,
      ...fallback
    )

    expect(center).toEqual({ centerX, centerY })
  })

  it('applies scale and rotation to the serialized origin offset', () => {
    const center = resolveQuickLogoSlotCenter(
      {
        type: 'image',
        originX: 'left',
        originY: 'top',
        left: 100,
        top: 200,
        width: 40,
        height: 80,
        scaleX: 2,
        scaleY: 0.5,
        angle: 90
      },
      null,
      null,
      ...fallback
    )

    expect(center.centerX).toBeCloseTo(80)
    expect(center.centerY).toBeCloseTo(240)
  })

  it('preserves metadata for placeholders and missing image geometry, then layout defaults', () => {
    expect(resolveQuickLogoSlotCenter({ type: 'rect' }, 111, 222, ...fallback))
      .toEqual({ centerX: 111, centerY: 222 })
    expect(resolveQuickLogoSlotCenter(null, null, 222, ...fallback))
      .toEqual({ centerX: fallback[0], centerY: 222 })
    expect(resolveQuickLogoSlotCenter({ type: 'image', left: 1, top: 2 }, 111, 222, ...fallback))
      .toEqual({ centerX: 111, centerY: 222 })
    expect(resolveQuickLogoSlotCenter({ type: 'image', left: 1, top: 2 }, null, null, ...fallback))
      .toEqual({ centerX: fallback[0], centerY: fallback[1] })
  })

  it('falls back when Fabric center is invalid or throws', () => {
    expect(resolveQuickLogoSlotCenter(
      { type: 'image', originX: 'left', originY: 'top', left: 10, top: 20, width: 20, height: 40, getCenterPoint: () => ({ x: NaN, y: 2 }) },
      null,
      null,
      ...fallback
    )).toEqual({ centerX: 20, centerY: 40 })
    expect(resolveQuickLogoSlotCenter(
      { type: 'image', originX: 'left', originY: 'top', left: 10, top: 20, width: 20, height: 40, getCenterPoint: () => { throw new Error('unavailable') } },
      null,
      null,
      ...fallback
    )).toEqual({ centerX: 20, centerY: 40 })
  })
})
