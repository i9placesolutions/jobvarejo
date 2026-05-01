import { describe, it, expect } from 'vitest'
import { getEditorPerfNow, roundEditorPerf } from '~/utils/perfHelpers'

describe('getEditorPerfNow', () => {
  it('retorna numero finito', () => {
    const now = getEditorPerfNow()
    expect(typeof now).toBe('number')
    expect(Number.isFinite(now)).toBe(true)
  })

  it('crescente: 2a chamada >= 1a', () => {
    const a = getEditorPerfNow()
    const b = getEditorPerfNow()
    expect(b).toBeGreaterThanOrEqual(a)
  })

  it('valor positivo', () => {
    expect(getEditorPerfNow()).toBeGreaterThan(0)
  })
})

describe('roundEditorPerf', () => {
  it('arredonda para 2 casas', () => {
    expect(roundEditorPerf(1.234567)).toBe(1.23)
    expect(roundEditorPerf(1.235)).toBeCloseTo(1.24, 2)
    expect(roundEditorPerf(0.001)).toBe(0)
    expect(roundEditorPerf(99.999)).toBe(100)
  })

  it('numeros inteiros: preservados', () => {
    expect(roundEditorPerf(0)).toBe(0)
    expect(roundEditorPerf(100)).toBe(100)
    expect(roundEditorPerf(-5)).toBe(-5)
  })

  it('NaN/Infinity/null retornam 0', () => {
    expect(roundEditorPerf(NaN)).toBe(0)
    expect(roundEditorPerf(Infinity)).toBe(0)
    expect(roundEditorPerf(-Infinity)).toBe(0)
    expect(roundEditorPerf(null as any)).toBe(0)
    expect(roundEditorPerf(undefined as any)).toBe(0)
  })

  it('retorna number (nao string)', () => {
    expect(typeof roundEditorPerf(1.5)).toBe('number')
  })

  it('valores negativos arredondados corretamente', () => {
    expect(roundEditorPerf(-1.234)).toBe(-1.23)
    expect(roundEditorPerf(-99.99)).toBe(-99.99)
  })
})
