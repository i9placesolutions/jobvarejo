import { describe, it, expect } from 'vitest'
import {
  CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS,
  getCanvasObjectsRefreshIntervalMs,
  getFrameLabelUpdateIntervalMs
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

describe('getFrameLabelUpdateIntervalMs', () => {
  it('<= 60 → 80ms', () => {
    expect(getFrameLabelUpdateIntervalMs(0)).toBe(80)
    expect(getFrameLabelUpdateIntervalMs(50)).toBe(80)
    expect(getFrameLabelUpdateIntervalMs(60)).toBe(80)
  })

  it('61..120 → 120ms', () => {
    expect(getFrameLabelUpdateIntervalMs(61)).toBe(120)
    expect(getFrameLabelUpdateIntervalMs(120)).toBe(120)
  })

  it('121..240 → 180ms', () => {
    expect(getFrameLabelUpdateIntervalMs(121)).toBe(180)
    expect(getFrameLabelUpdateIntervalMs(240)).toBe(180)
  })

  it('241..320 → 280ms', () => {
    expect(getFrameLabelUpdateIntervalMs(241)).toBe(280)
    expect(getFrameLabelUpdateIntervalMs(320)).toBe(280)
  })

  it('321..520 → 320ms', () => {
    expect(getFrameLabelUpdateIntervalMs(321)).toBe(320)
    expect(getFrameLabelUpdateIntervalMs(520)).toBe(320)
  })

  it('> 520 → 420ms', () => {
    expect(getFrameLabelUpdateIntervalMs(521)).toBe(420)
    expect(getFrameLabelUpdateIntervalMs(2000)).toBe(420)
  })

  it('NaN/null → 80 (MIN)', () => {
    expect(getFrameLabelUpdateIntervalMs(NaN)).toBe(80)
    expect(getFrameLabelUpdateIntervalMs(null as any)).toBe(80)
    expect(getFrameLabelUpdateIntervalMs(undefined as any)).toBe(80)
  })

  it('escala monotonica crescente', () => {
    const samples = [0, 60, 120, 240, 320, 520, 1000]
    for (let i = 1; i < samples.length; i++) {
      expect(getFrameLabelUpdateIntervalMs(samples[i]!))
        .toBeGreaterThanOrEqual(getFrameLabelUpdateIntervalMs(samples[i - 1]!))
    }
  })
})
