import { describe, it, expect } from 'vitest'
import {
  CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS,
  getCanvasObjectsRefreshIntervalMs
} from '~/utils/refreshThrottle'

describe('CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS', () => {
  it('e 42ms (~24 FPS)', () => {
    expect(CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS).toBe(42)
  })
})

describe('getCanvasObjectsRefreshIntervalMs', () => {
  it('< 180 objetos → MIN (42)', () => {
    expect(getCanvasObjectsRefreshIntervalMs(0)).toBe(42)
    expect(getCanvasObjectsRefreshIntervalMs(50)).toBe(42)
    expect(getCanvasObjectsRefreshIntervalMs(180)).toBe(42)
  })

  it('181..320 → 64ms', () => {
    expect(getCanvasObjectsRefreshIntervalMs(181)).toBe(64)
    expect(getCanvasObjectsRefreshIntervalMs(250)).toBe(64)
    expect(getCanvasObjectsRefreshIntervalMs(320)).toBe(64)
  })

  it('321..650 → 96ms', () => {
    expect(getCanvasObjectsRefreshIntervalMs(321)).toBe(96)
    expect(getCanvasObjectsRefreshIntervalMs(500)).toBe(96)
    expect(getCanvasObjectsRefreshIntervalMs(650)).toBe(96)
  })

  it('651..1000 → 160ms', () => {
    expect(getCanvasObjectsRefreshIntervalMs(651)).toBe(160)
    expect(getCanvasObjectsRefreshIntervalMs(800)).toBe(160)
    expect(getCanvasObjectsRefreshIntervalMs(1000)).toBe(160)
  })

  it('> 1000 → 220ms', () => {
    expect(getCanvasObjectsRefreshIntervalMs(1001)).toBe(220)
    expect(getCanvasObjectsRefreshIntervalMs(5000)).toBe(220)
  })

  it('NaN/null/undefined → 42 (MIN)', () => {
    expect(getCanvasObjectsRefreshIntervalMs(NaN)).toBe(42)
    expect(getCanvasObjectsRefreshIntervalMs(null as any)).toBe(42)
    expect(getCanvasObjectsRefreshIntervalMs(undefined as any)).toBe(42)
  })

  it('valores negativos sao tratados como 0 → MIN', () => {
    expect(getCanvasObjectsRefreshIntervalMs(-100)).toBe(42)
  })

  it('escala monotonica crescente', () => {
    expect(getCanvasObjectsRefreshIntervalMs(180))
      .toBeLessThanOrEqual(getCanvasObjectsRefreshIntervalMs(200))
    expect(getCanvasObjectsRefreshIntervalMs(320))
      .toBeLessThanOrEqual(getCanvasObjectsRefreshIntervalMs(500))
    expect(getCanvasObjectsRefreshIntervalMs(650))
      .toBeLessThanOrEqual(getCanvasObjectsRefreshIntervalMs(700))
    expect(getCanvasObjectsRefreshIntervalMs(1000))
      .toBeLessThanOrEqual(getCanvasObjectsRefreshIntervalMs(1100))
  })
})
