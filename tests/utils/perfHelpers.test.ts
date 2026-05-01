import { describe, it, expect } from 'vitest'
import {
  getEditorPerfNow,
  roundEditorPerf,
  parseEditorPerfPreference,
  serializeEditorPerfPreference,
  EDITOR_PERF_STORAGE_KEY,
  EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS
} from '~/utils/perfHelpers'

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

describe('parseEditorPerfPreference', () => {
  it('null/undefined: default true (enabled)', () => {
    expect(parseEditorPerfPreference(null)).toBe(true)
    expect(parseEditorPerfPreference(undefined)).toBe(true)
  })

  it('"0": false (disabled)', () => {
    expect(parseEditorPerfPreference('0')).toBe(false)
  })

  it('"1": true', () => {
    expect(parseEditorPerfPreference('1')).toBe(true)
  })

  it('qualquer outro string: true (default permissivo)', () => {
    expect(parseEditorPerfPreference('foo')).toBe(true)
    expect(parseEditorPerfPreference('')).toBe(true)
    expect(parseEditorPerfPreference('true')).toBe(true)
    expect(parseEditorPerfPreference('false')).toBe(true) // !== '0'
  })
})

describe('serializeEditorPerfPreference', () => {
  it('true → "1"', () => {
    expect(serializeEditorPerfPreference(true)).toBe('1')
  })

  it('false → "0"', () => {
    expect(serializeEditorPerfPreference(false)).toBe('0')
  })

  it('roundtrip parse(serialize(x)) === x', () => {
    expect(parseEditorPerfPreference(serializeEditorPerfPreference(true))).toBe(true)
    expect(parseEditorPerfPreference(serializeEditorPerfPreference(false))).toBe(false)
  })
})

describe('EDITOR_PERF_STORAGE_KEY', () => {
  it('contem prefixo "editor:" e versionado', () => {
    expect(EDITOR_PERF_STORAGE_KEY).toBe('editor:perf-metrics:v1')
    expect(EDITOR_PERF_STORAGE_KEY).toMatch(/^editor:/)
    expect(EDITOR_PERF_STORAGE_KEY).toMatch(/:v\d+$/)
  })
})

describe('EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS', () => {
  it('e numero positivo (intervalo de throttle)', () => {
    expect(typeof EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS).toBe('number')
    expect(EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS).toBeGreaterThan(0)
    expect(EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS).toBe(120)
  })
})
