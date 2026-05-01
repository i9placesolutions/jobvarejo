import { describe, it, expect } from 'vitest'
import { normalizeClipboardPoint } from '~/utils/clipboardHelpers'

describe('normalizeClipboardPoint', () => {
  it('numeros validos passam', () => {
    expect(normalizeClipboardPoint({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 })
  })

  it('strings parseaveis sao convertidas', () => {
    expect(normalizeClipboardPoint({ x: '50', y: '75' })).toEqual({ x: 50, y: 75 })
  })

  it('NaN/Infinity viram 0', () => {
    expect(normalizeClipboardPoint({ x: NaN, y: 100 })).toEqual({ x: 0, y: 100 })
    expect(normalizeClipboardPoint({ x: Infinity, y: -Infinity })).toEqual({ x: 0, y: 0 })
  })

  it('null/undefined/missing viram 0', () => {
    expect(normalizeClipboardPoint(null)).toEqual({ x: 0, y: 0 })
    expect(normalizeClipboardPoint(undefined)).toEqual({ x: 0, y: 0 })
    expect(normalizeClipboardPoint({})).toEqual({ x: 0, y: 0 })
    expect(normalizeClipboardPoint({ x: 100 })).toEqual({ x: 100, y: 0 })
  })

  it('valores negativos sao preservados', () => {
    expect(normalizeClipboardPoint({ x: -50, y: -100 })).toEqual({ x: -50, y: -100 })
  })

  it('zero e' + ' valor valido', () => {
    expect(normalizeClipboardPoint({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})
