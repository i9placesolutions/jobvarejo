import { describe, it, expect } from 'vitest'
import {
  normalizeClipboardPoint,
  CLIPBOARD_CLONE_PROPS,
  CLIPBOARD_SERIALIZE_PROPS,
  CROSS_TAB_CLIPBOARD_STORAGE_KEY,
  CROSS_TAB_CLIPBOARD_MAX_AGE_MS,
  CROSS_TAB_CLIPBOARD_MAX_BYTES
} from '~/utils/clipboardHelpers'
import { CANVAS_CUSTOM_PROPS } from '~/utils/canvasCustomProps'

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

describe('CROSS_TAB_CLIPBOARD_STORAGE_KEY', () => {
  it('e chave estavel com versao v2', () => {
    expect(CROSS_TAB_CLIPBOARD_STORAGE_KEY).toBe('jobvarejo:editor:fabric-clipboard:v2')
  })
})

describe('CROSS_TAB_CLIPBOARD_MAX_AGE_MS', () => {
  it('e 24h em ms', () => {
    expect(CROSS_TAB_CLIPBOARD_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000)
  })
})

describe('CROSS_TAB_CLIPBOARD_MAX_BYTES', () => {
  it('e 2MB', () => {
    expect(CROSS_TAB_CLIPBOARD_MAX_BYTES).toBe(2_000_000)
  })
})

describe('CLIPBOARD_CLONE_PROPS', () => {
  it('inclui todas as CANVAS_CUSTOM_PROPS', () => {
    for (const prop of CANVAS_CUSTOM_PROPS) {
      expect(CLIPBOARD_CLONE_PROPS).toContain(prop)
    }
  })

  it('inclui transforms basicos', () => {
    expect(CLIPBOARD_CLONE_PROPS).toContain('opacity')
    expect(CLIPBOARD_CLONE_PROPS).toContain('flipX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('flipY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('clipPath')
    expect(CLIPBOARD_CLONE_PROPS).toContain('filters')
    expect(CLIPBOARD_CLONE_PROPS).toContain('originX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('originY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('angle')
    expect(CLIPBOARD_CLONE_PROPS).toContain('scaleX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('scaleY')
    expect(CLIPBOARD_CLONE_PROPS).toContain('skewX')
    expect(CLIPBOARD_CLONE_PROPS).toContain('skewY')
  })

  it('todos unicos', () => {
    expect(new Set(CLIPBOARD_CLONE_PROPS).size).toBe(CLIPBOARD_CLONE_PROPS.length)
  })
})

describe('CLIPBOARD_SERIALIZE_PROPS', () => {
  it('inclui todas as CLIPBOARD_CLONE_PROPS', () => {
    for (const prop of CLIPBOARD_CLONE_PROPS) {
      expect(CLIPBOARD_SERIALIZE_PROPS).toContain(prop)
    }
  })

  it('inclui metadata de origem do clipboard', () => {
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_clipboardCenterX')
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_clipboardCenterY')
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_clipboardSourceCustomId')
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_sourceGroupId')
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_sourceLeft')
    expect(CLIPBOARD_SERIALIZE_PROPS).toContain('_sourceTop')
  })

  it('todos unicos', () => {
    expect(new Set(CLIPBOARD_SERIALIZE_PROPS).size).toBe(CLIPBOARD_SERIALIZE_PROPS.length)
  })

  it('e maior que CLIPBOARD_CLONE_PROPS (tem props extras)', () => {
    expect(CLIPBOARD_SERIALIZE_PROPS.length).toBeGreaterThanOrEqual(CLIPBOARD_CLONE_PROPS.length)
  })
})
