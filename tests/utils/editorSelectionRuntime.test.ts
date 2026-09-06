import { describe, expect, it } from 'vitest'
import { applyViewportTransformToRect, getSelectedObjectFloatingPos } from '~/utils/editorSelectionRuntime'

describe('applyViewportTransformToRect', () => {
  it('nao altera o retangulo com vpt identidade', () => {
    expect(applyViewportTransformToRect(
      { left: 40, top: 80, width: 200, height: 100 },
      [1, 0, 0, 1, 0, 0]
    )).toEqual({ left: 40, top: 80, width: 200, height: 100 })
  })

  it('aplica zoom e pan do viewport', () => {
    const rect = applyViewportTransformToRect(
      { left: 100, top: 200, width: 400, height: 200 },
      [0.5, 0, 0, 0.5, 220, 40]
    )
    expect(rect.left).toBe(270)
    expect(rect.top).toBe(140)
    expect(rect.width).toBe(200)
    expect(rect.height).toBe(100)
  })
})

describe('getSelectedObjectFloatingPos', () => {
  it('projeta a zona com o viewport do canvas', () => {
    const zone = {
      getBoundingRect: () => ({ left: 80, top: 400, width: 920, height: 700 }),
      canvas: { viewportTransform: [0.6, 0, 0, 0.6, 180, 30] }
    }
    const pos = getSelectedObjectFloatingPos(zone, () => true)
    expect(pos.visible).toBe(true)
    expect(pos.left).toBeCloseTo(228)
    expect(pos.top).toBeCloseTo(270)
    expect(pos.width).toBeCloseTo(552)
    expect(pos.height).toBeCloseTo(420)
  })

  it('esconde quando o alvo nao e zona', () => {
    expect(getSelectedObjectFloatingPos({ getBoundingRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) }, () => false).visible).toBe(false)
  })
})
