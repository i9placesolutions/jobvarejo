import { describe, it, expect } from 'vitest'
import {
  GUIDE_COLOR,
  GUIDE_STROKE_WIDTH,
  SNAP_RANGE_PX,
  SNAP_HYSTERESIS_HOLD_FACTOR,
  SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE,
  SNAP_MOVE_EPSILON_PX,
  SNAP_MOVE_EPSILON_PX_RECT_IMAGE,
  SNAP_RANGE_FACTOR_RECT_IMAGE,
  SNAP_FAST_MOVE_SUPPRESSION_PX,
  SNAP_FAST_MOVE_SUPPRESSION_PX_RECT_IMAGE,
  USER_GUIDE_COLOR,
  USER_GUIDE_EXTENT
} from '~/utils/snapConstants'

describe('snap constants', () => {
  it('GUIDE_COLOR e magenta brilhante', () => {
    expect(GUIDE_COLOR).toBe('#ff2fb3')
  })

  it('GUIDE_STROKE_WIDTH e 2', () => {
    expect(GUIDE_STROKE_WIDTH).toBe(2)
  })

  it('SNAP_RANGE_PX e 12', () => {
    expect(SNAP_RANGE_PX).toBe(12)
  })

  it('SNAP_HYSTERESIS_HOLD_FACTOR e 1.6 (default mais "fixo")', () => {
    expect(SNAP_HYSTERESIS_HOLD_FACTOR).toBe(1.6)
  })

  it('SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE e 1.08 (mais "macio")', () => {
    expect(SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE).toBe(1.08)
  })

  it('rect/image hysteresis < default (mais facil de soltar)', () => {
    expect(SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE)
      .toBeLessThan(SNAP_HYSTERESIS_HOLD_FACTOR)
  })

  it('SNAP_MOVE_EPSILON_PX = 1.8 vs RECT_IMAGE = 9 (rect mais "macio")', () => {
    expect(SNAP_MOVE_EPSILON_PX).toBe(1.8)
    expect(SNAP_MOVE_EPSILON_PX_RECT_IMAGE).toBe(9)
    expect(SNAP_MOVE_EPSILON_PX_RECT_IMAGE).toBeGreaterThan(SNAP_MOVE_EPSILON_PX)
  })

  it('SNAP_RANGE_FACTOR_RECT_IMAGE e 0.28 (~1/3.5 do range default)', () => {
    expect(SNAP_RANGE_FACTOR_RECT_IMAGE).toBe(0.28)
    expect(SNAP_RANGE_PX * SNAP_RANGE_FACTOR_RECT_IMAGE).toBeCloseTo(3.36, 2)
  })

  it('SNAP_FAST_MOVE_SUPPRESSION_PX = 7 vs RECT_IMAGE = 9', () => {
    expect(SNAP_FAST_MOVE_SUPPRESSION_PX).toBe(7)
    expect(SNAP_FAST_MOVE_SUPPRESSION_PX_RECT_IMAGE).toBe(9)
  })

  it('todos os valores numericos sao positivos', () => {
    expect(GUIDE_STROKE_WIDTH).toBeGreaterThan(0)
    expect(SNAP_RANGE_PX).toBeGreaterThan(0)
    expect(SNAP_HYSTERESIS_HOLD_FACTOR).toBeGreaterThan(0)
    expect(SNAP_MOVE_EPSILON_PX).toBeGreaterThan(0)
    expect(SNAP_RANGE_FACTOR_RECT_IMAGE).toBeGreaterThan(0)
    expect(SNAP_FAST_MOVE_SUPPRESSION_PX).toBeGreaterThan(0)
  })
})

describe('USER_GUIDE_COLOR', () => {
  it('e azul claro distinta do magenta dos smart guides', () => {
    expect(USER_GUIDE_COLOR).toBe('#38bdf8')
    expect(USER_GUIDE_COLOR).not.toBe(GUIDE_COLOR)
  })

  it('formato hex valido', () => {
    expect(USER_GUIDE_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('USER_GUIDE_EXTENT', () => {
  it('e numero finito grande (suficiente para canvases enormes)', () => {
    expect(USER_GUIDE_EXTENT).toBe(100_000)
    expect(Number.isFinite(USER_GUIDE_EXTENT)).toBe(true)
    expect(USER_GUIDE_EXTENT).toBeGreaterThan(10_000)
  })

  it('NAO e Infinity (evita stress numerico)', () => {
    expect(USER_GUIDE_EXTENT).not.toBe(Infinity)
  })
})
