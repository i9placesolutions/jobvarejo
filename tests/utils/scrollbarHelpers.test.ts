import { describe, it, expect } from 'vitest'
import {
  SCROLLBAR_IGNORED_IDS,
  SCROLLBAR_PADDING,
  isScrollbarRelevantObject
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
