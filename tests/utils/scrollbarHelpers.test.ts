import { describe, it, expect } from 'vitest'
import {
  SCROLLBAR_IGNORED_IDS,
  SCROLLBAR_PADDING,
  SCROLLBAR_SANITIZE_INTERVAL_MS,
  isScrollbarRelevantObject,
  getScrollbarSanitizeIntervalMs
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
