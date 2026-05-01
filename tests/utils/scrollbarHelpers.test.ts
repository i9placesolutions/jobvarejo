import { describe, it, expect } from 'vitest'
import {
  SCROLLBAR_IGNORED_IDS,
  SCROLLBAR_PADDING,
  SCROLLBAR_SANITIZE_INTERVAL_MS,
  isScrollbarRelevantObject,
  getScrollbarSanitizeIntervalMs,
  computeAggregatedRelevantBounds
} from '~/utils/scrollbarHelpers'

const fabricObj = (overrides: any = {}) => ({
  type: 'rect',
  render: () => {},
  setCoords: () => {},
  set: () => {},
  toObject: () => ({}),
  ...overrides
})

describe('SCROLLBAR_IGNORED_IDS', () => {
  it('contem 3 IDs ignorados', () => {
    expect(SCROLLBAR_IGNORED_IDS.size).toBe(3)
    expect(SCROLLBAR_IGNORED_IDS.has('artboard-bg')).toBe(true)
    expect(SCROLLBAR_IGNORED_IDS.has('guide-vertical')).toBe(true)
    expect(SCROLLBAR_IGNORED_IDS.has('guide-horizontal')).toBe(true)
  })
})

describe('SCROLLBAR_PADDING', () => {
  it('e 100', () => {
    expect(SCROLLBAR_PADDING).toBe(100)
  })
})

describe('isScrollbarRelevantObject', () => {
  it('aceita objeto Fabric valido sem excludeFromExport', () => {
    expect(isScrollbarRelevantObject(fabricObj())).toBe(true)
  })

  it('rejeita objeto invalido (sem render)', () => {
    expect(isScrollbarRelevantObject({ type: 'rect' })).toBe(false)
    expect(isScrollbarRelevantObject(null)).toBe(false)
  })

  it('rejeita excludeFromExport=true', () => {
    expect(isScrollbarRelevantObject(fabricObj({ excludeFromExport: true }))).toBe(false)
  })

  it('rejeita IDs ignorados', () => {
    expect(isScrollbarRelevantObject(fabricObj({ id: 'artboard-bg' }))).toBe(false)
    expect(isScrollbarRelevantObject(fabricObj({ id: 'guide-vertical' }))).toBe(false)
    expect(isScrollbarRelevantObject(fabricObj({ id: 'guide-horizontal' }))).toBe(false)
  })

  it('aceita objeto com id customizado nao ignorado', () => {
    expect(isScrollbarRelevantObject(fabricObj({ id: 'rect-1' }))).toBe(true)
    expect(isScrollbarRelevantObject(fabricObj({ id: 'guide-user-1' }))).toBe(true)
  })
})

describe('SCROLLBAR_SANITIZE_INTERVAL_MS', () => {
  it('e 1200ms', () => {
    expect(SCROLLBAR_SANITIZE_INTERVAL_MS).toBe(1200)
  })
})

describe('getScrollbarSanitizeIntervalMs', () => {
  it('<= 250 objetos: SCROLLBAR_SANITIZE_INTERVAL_MS', () => {
    expect(getScrollbarSanitizeIntervalMs(0)).toBe(1200)
    expect(getScrollbarSanitizeIntervalMs(100)).toBe(1200)
    expect(getScrollbarSanitizeIntervalMs(250)).toBe(1200)
  })

  it('251..600: 2500ms', () => {
    expect(getScrollbarSanitizeIntervalMs(251)).toBe(2500)
    expect(getScrollbarSanitizeIntervalMs(400)).toBe(2500)
    expect(getScrollbarSanitizeIntervalMs(600)).toBe(2500)
  })

  it('> 600: 5000ms', () => {
    expect(getScrollbarSanitizeIntervalMs(601)).toBe(5000)
    expect(getScrollbarSanitizeIntervalMs(1000)).toBe(5000)
    expect(getScrollbarSanitizeIntervalMs(5000)).toBe(5000)
  })

  it('NaN/null/negativo: 1200 (MIN)', () => {
    expect(getScrollbarSanitizeIntervalMs(NaN)).toBe(1200)
    expect(getScrollbarSanitizeIntervalMs(null as any)).toBe(1200)
    expect(getScrollbarSanitizeIntervalMs(-100)).toBe(1200)
  })

  it('escala monotonica crescente', () => {
    expect(getScrollbarSanitizeIntervalMs(250))
      .toBeLessThanOrEqual(getScrollbarSanitizeIntervalMs(300))
    expect(getScrollbarSanitizeIntervalMs(600))
      .toBeLessThanOrEqual(getScrollbarSanitizeIntervalMs(700))
  })
})

describe('computeAggregatedRelevantBounds', () => {
  const isRelevant = (obj: any) => !!obj?.relevant

  const makeObj = (left: number, top: number, width: number, height: number, overrides: any = {}) => ({
    relevant: true,
    getBoundingRect: () => ({ left, top, width, height }),
    ...overrides
  })

  it('lista vazia: hasAny=false, valores em Infinity', () => {
    const r = computeAggregatedRelevantBounds([], isRelevant)
    expect(r.hasAny).toBe(false)
    expect(r.minX).toBe(Infinity)
    expect(r.minY).toBe(Infinity)
    expect(r.maxX).toBe(-Infinity)
    expect(r.maxY).toBe(-Infinity)
  })

  it('null/undefined input: hasAny=false', () => {
    expect(computeAggregatedRelevantBounds(null as any, isRelevant).hasAny).toBe(false)
    expect(computeAggregatedRelevantBounds(undefined as any, isRelevant).hasAny).toBe(false)
  })

  it('objetos nao-relevant ignorados', () => {
    const r = computeAggregatedRelevantBounds(
      [{ relevant: false, getBoundingRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }],
      isRelevant
    )
    expect(r.hasAny).toBe(false)
  })

  it('objeto sem getBoundingRect ignorado', () => {
    const r = computeAggregatedRelevantBounds(
      [{ relevant: true }],
      isRelevant
    )
    expect(r.hasAny).toBe(false)
  })

  it('1 objeto: bounds = bounds do objeto', () => {
    const r = computeAggregatedRelevantBounds([makeObj(10, 20, 100, 50)], isRelevant)
    expect(r.hasAny).toBe(true)
    expect(r.minX).toBe(10)
    expect(r.minY).toBe(20)
    expect(r.maxX).toBe(110)
    expect(r.maxY).toBe(70)
  })

  it('multiplos objetos: union dos bbox', () => {
    const r = computeAggregatedRelevantBounds([
      makeObj(0, 0, 100, 100),
      makeObj(200, 50, 50, 150)
    ], isRelevant)
    expect(r.minX).toBe(0)
    expect(r.minY).toBe(0)
    expect(r.maxX).toBe(250)
    expect(r.maxY).toBe(200)
  })

  it('bounds com NaN/Infinity ignorados (mas hasAny continua false se foram os unicos)', () => {
    const obj = {
      relevant: true,
      getBoundingRect: () => ({ left: NaN, top: 0, width: 100, height: 100 })
    }
    const r = computeAggregatedRelevantBounds([obj], isRelevant)
    expect(r.hasAny).toBe(false)
  })

  it('mistura validos + invalidos: valores invalidos pulados', () => {
    const r = computeAggregatedRelevantBounds([
      makeObj(0, 0, 100, 100),
      { relevant: true, getBoundingRect: () => ({ left: NaN, top: 0, width: 999, height: 999 }) },
      makeObj(200, 0, 50, 50)
    ], isRelevant)
    expect(r.hasAny).toBe(true)
    expect(r.maxX).toBe(250)  // 999 nao foi considerado
  })

  it('bounds sem getBoundingRect retornando null e ignorado', () => {
    const obj = {
      relevant: true,
      getBoundingRect: () => null
    }
    const r = computeAggregatedRelevantBounds([obj], isRelevant)
    expect(r.hasAny).toBe(false)
  })
})
