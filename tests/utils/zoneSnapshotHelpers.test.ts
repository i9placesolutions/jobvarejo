import { describe, it, expect } from 'vitest'
import {
  clonePlainForZoneSnapshot,
  finiteZoneSnapshotNumber,
  firstDefinedZoneSnapshotValue
} from '~/utils/zoneSnapshotHelpers'

describe('clonePlainForZoneSnapshot', () => {
  it('null/undefined retorna como esta', () => {
    expect(clonePlainForZoneSnapshot(null)).toBeNull()
    expect(clonePlainForZoneSnapshot(undefined)).toBeUndefined()
  })

  it('primitivos retornam como sao', () => {
    expect(clonePlainForZoneSnapshot(42)).toBe(42)
    expect(clonePlainForZoneSnapshot('hello')).toBe('hello')
    expect(clonePlainForZoneSnapshot(true)).toBe(true)
  })

  it('objeto plain: clona profundo', () => {
    const original = { a: 1, b: { c: 2 }, arr: [1, 2, 3] }
    const cloned = clonePlainForZoneSnapshot(original)
    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    expect(cloned.b).not.toBe(original.b)
    expect(cloned.arr).not.toBe(original.arr)
  })

  it('array de primitivos: clonado', () => {
    const arr = [1, 2, 3, 'foo']
    const cloned = clonePlainForZoneSnapshot(arr)
    expect(cloned).toEqual(arr)
    expect(cloned).not.toBe(arr)
  })

  it('JSON round-trip remove funcoes naturalmente', () => {
    const obj = {
      name: 'foo',
      method: () => 'bar',
      data: { x: 1 }
    }
    const cloned = clonePlainForZoneSnapshot(obj)
    expect(cloned.name).toBe('foo')
    expect(cloned.method).toBeUndefined()
    expect(cloned.data).toEqual({ x: 1 })
  })

  // Documentado: fallback recursivo NAO trata circular refs — usar
  // apenas em estruturas que JSON.stringify ja consegue, ou em
  // estruturas com BigInt/Symbol (caso raro do fallback).

  it('strings com escapes preservadas', () => {
    expect(clonePlainForZoneSnapshot('foo\nbar')).toBe('foo\nbar')
  })

  it('Date object: serializa para string ISO via JSON', () => {
    const d = new Date('2025-01-01T00:00:00Z')
    const cloned = clonePlainForZoneSnapshot(d)
    expect(cloned).toBe('2025-01-01T00:00:00.000Z')
  })
})

describe('finiteZoneSnapshotNumber', () => {
  it('numeros finitos: passam', () => {
    expect(finiteZoneSnapshotNumber(0)).toBe(0)
    expect(finiteZoneSnapshotNumber(42)).toBe(42)
    expect(finiteZoneSnapshotNumber(-3.14)).toBe(-3.14)
  })

  it('strings parseaveis: viram numero', () => {
    expect(finiteZoneSnapshotNumber('42')).toBe(42)
  })

  it('NaN/Infinity → fallback (default 0)', () => {
    expect(finiteZoneSnapshotNumber(NaN)).toBe(0)
    expect(finiteZoneSnapshotNumber(Infinity)).toBe(0)
    expect(finiteZoneSnapshotNumber('abc')).toBe(0)
  })

  it('fallback customizado', () => {
    expect(finiteZoneSnapshotNumber(NaN, 99)).toBe(99)
    expect(finiteZoneSnapshotNumber(undefined, -1)).toBe(-1)
  })

  it('null cai em 0 finito (Number(null)=0)', () => {
    expect(finiteZoneSnapshotNumber(null)).toBe(0)
  })

  it('undefined cai em fallback (Number(undefined)=NaN)', () => {
    expect(finiteZoneSnapshotNumber(undefined, 7)).toBe(7)
  })
})

describe('firstDefinedZoneSnapshotValue', () => {
  it('retorna o primeiro valor definido', () => {
    expect(firstDefinedZoneSnapshotValue(undefined, null, '', 'foo')).toBe('foo')
    expect(firstDefinedZoneSnapshotValue(null, 0, 'bar')).toBe(0)
  })

  it('null/undefined/string vazia ignorados', () => {
    expect(firstDefinedZoneSnapshotValue(null, undefined, '')).toBeNull()
  })

  it('zero/false/numeros validos sao definidos', () => {
    expect(firstDefinedZoneSnapshotValue(undefined, 0)).toBe(0)
    expect(firstDefinedZoneSnapshotValue(undefined, false)).toBe(false)
  })

  it('arrays/objetos sao definidos', () => {
    const obj = { x: 1 }
    expect(firstDefinedZoneSnapshotValue(null, obj)).toBe(obj)
    expect(firstDefinedZoneSnapshotValue(undefined, [])).toEqual([])
  })

  it('sem args: null', () => {
    expect(firstDefinedZoneSnapshotValue()).toBeNull()
  })

  it('todos undefined/null/empty: null', () => {
    expect(firstDefinedZoneSnapshotValue(null, undefined, '', null)).toBeNull()
  })
})
