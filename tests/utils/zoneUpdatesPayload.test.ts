import { describe, it, expect } from 'vitest'
import { resolveZoneUpdatesPayload } from '~/utils/zoneUpdatesPayload'

describe('resolveZoneUpdatesPayload', () => {
  it('forma 1: (prop, value) → { prop: value }', () => {
    expect(resolveZoneUpdatesPayload('columns', 4)).toEqual({ columns: 4 })
    expect(resolveZoneUpdatesPayload('cardColor', '#fff')).toEqual({ cardColor: '#fff' })
  })

  it('forma 2: payload com prop/value wrapper', () => {
    expect(resolveZoneUpdatesPayload({ prop: 'columns', value: 4 }, undefined))
      .toEqual({ columns: 4 })
  })

  it('forma 3: multiplas props em payload', () => {
    expect(resolveZoneUpdatesPayload({ columns: 4, rows: 3, gap: 10 }, undefined))
      .toEqual({ columns: 4, rows: 3, gap: 10 })
  })

  it('clona o payload (nao retorna referencia direta)', () => {
    const input = { a: 1, b: 2 }
    const result = resolveZoneUpdatesPayload(input, undefined)
    expect(result).not.toBe(input)
    expect(result).toEqual(input)
  })

  it('prop string vazia/whitespace: trata como invalido (cai em forma 3)', () => {
    expect(resolveZoneUpdatesPayload('', 99)).toEqual({})
    expect(resolveZoneUpdatesPayload('   ', 99)).toEqual({})
  })

  it('payload com prop vazio: cai em forma 3 (clone)', () => {
    expect(resolveZoneUpdatesPayload({ prop: '', value: 1, other: 2 }, undefined))
      .toEqual({ prop: '', value: 1, other: 2 })
  })

  it('null/undefined: {}', () => {
    expect(resolveZoneUpdatesPayload(null, null)).toEqual({})
    expect(resolveZoneUpdatesPayload(undefined, undefined)).toEqual({})
  })

  it('numeros/booleanos como propOrPayload: {}', () => {
    expect(resolveZoneUpdatesPayload(42, 'x')).toEqual({})
    expect(resolveZoneUpdatesPayload(true, 'x')).toEqual({})
  })

  it('arrays nao sao tratados como objeto: {}', () => {
    expect(resolveZoneUpdatesPayload([1, 2, 3], undefined)).toEqual({})
  })

  it('forma 2 prefere prop/value mesmo com outras props no payload', () => {
    // payload tem prop/value validos → usa apenas ele
    expect(resolveZoneUpdatesPayload({ prop: 'a', value: 1, other: 2 }, undefined))
      .toEqual({ a: 1 })
  })

  it('value undefined em forma 1 → { prop: undefined }', () => {
    expect(resolveZoneUpdatesPayload('foo', undefined)).toEqual({ foo: undefined })
  })
})
