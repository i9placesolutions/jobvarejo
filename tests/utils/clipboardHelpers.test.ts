import { describe, it, expect } from 'vitest'
import {
  normalizeClipboardPoint,
  CLIPBOARD_CLONE_PROPS,
  CLIPBOARD_SERIALIZE_PROPS,
  CROSS_TAB_CLIPBOARD_STORAGE_KEY,
  CROSS_TAB_CLIPBOARD_MAX_AGE_MS,
  CROSS_TAB_CLIPBOARD_MAX_BYTES,
  serializeRuntimeClipboardForCrossTab,
  parseCrossTabClipboardPayload
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

describe('serializeRuntimeClipboardForCrossTab', () => {
  const props = ['_customId']

  it('null/invalid kind: null', () => {
    expect(serializeRuntimeClipboardForCrossTab(null, props)).toBe(null)
    expect(serializeRuntimeClipboardForCrossTab({}, props)).toBe(null)
    expect(serializeRuntimeClipboardForCrossTab({ kind: 'wrong' }, props)).toBe(null)
  })

  it('items array vazio: null', () => {
    expect(serializeRuntimeClipboardForCrossTab({ kind: 'fabric-items-v2', items: [] }, props)).toBe(null)
  })

  it('items sem toObject: null (skipped)', () => {
    expect(serializeRuntimeClipboardForCrossTab({
      kind: 'fabric-items-v2',
      items: [{ name: 'no-toObject' }]
    }, props)).toBe(null)
  })

  it('items validos: retorna JSON com payload completo', () => {
    const item1 = { toObject: () => ({ type: 'rect', _customId: 'a' }) }
    const result = serializeRuntimeClipboardForCrossTab({
      kind: 'fabric-items-v2',
      items: [item1],
      copiedAt: 1000,
      sourcePageId: 'page-1',
      selectionCenter: { x: 10, y: 20 }
    }, props)
    expect(result).toBeTruthy()
    const parsed = JSON.parse(result!)
    expect(parsed.format).toBe('jobvarejo-fabric-items-v2')
    expect(parsed.itemsJson.length).toBe(1)
    expect(parsed.copiedAt).toBe(1000)
    expect(parsed.sourcePageId).toBe('page-1')
    expect(parsed.selectionCenter).toEqual({ x: 10, y: 20 })
  })

  it('toObject lanca erro: pula item, segue com outros', () => {
    const bad = { toObject: () => { throw new Error('boom') } }
    const good = { toObject: () => ({ type: 'rect' }) }
    const result = serializeRuntimeClipboardForCrossTab({
      kind: 'fabric-items-v2',
      items: [bad, good]
    }, props)
    expect(result).toBeTruthy()
    const parsed = JSON.parse(result!)
    expect(parsed.itemsJson.length).toBe(1)
  })

  it('payload excede MAX_BYTES: null', () => {
    const huge = 'x'.repeat(CROSS_TAB_CLIPBOARD_MAX_BYTES + 100)
    const item = { toObject: () => ({ type: 'rect', text: huge }) }
    expect(serializeRuntimeClipboardForCrossTab({
      kind: 'fabric-items-v2',
      items: [item]
    }, props)).toBe(null)
  })
})

describe('parseCrossTabClipboardPayload', () => {
  it('null/empty: null', () => {
    expect(parseCrossTabClipboardPayload(null)).toBe(null)
    expect(parseCrossTabClipboardPayload(undefined)).toBe(null)
    expect(parseCrossTabClipboardPayload('')).toBe(null)
  })

  it('JSON invalido: null', () => {
    expect(parseCrossTabClipboardPayload('not-json')).toBe(null)
  })

  it('format errado: null', () => {
    const raw = JSON.stringify({ format: 'wrong', itemsJson: [{ type: 'rect' }] })
    expect(parseCrossTabClipboardPayload(raw)).toBe(null)
  })

  it('itemsJson nao array: null', () => {
    const raw = JSON.stringify({ format: 'jobvarejo-fabric-items-v2', itemsJson: 'invalid' })
    expect(parseCrossTabClipboardPayload(raw)).toBe(null)
  })

  it('itemsJson vazio: null', () => {
    const raw = JSON.stringify({
      format: 'jobvarejo-fabric-items-v2',
      itemsJson: [],
      copiedAt: Date.now()
    })
    expect(parseCrossTabClipboardPayload(raw)).toBe(null)
  })

  it('copiedAt invalido: null', () => {
    const raw = JSON.stringify({
      format: 'jobvarejo-fabric-items-v2',
      itemsJson: [{ type: 'rect' }],
      copiedAt: -1
    })
    expect(parseCrossTabClipboardPayload(raw)).toBe(null)
  })

  it('payload expirado: null', () => {
    const raw = JSON.stringify({
      format: 'jobvarejo-fabric-items-v2',
      itemsJson: [{ type: 'rect' }],
      copiedAt: Date.now() - CROSS_TAB_CLIPBOARD_MAX_AGE_MS - 1000
    })
    expect(parseCrossTabClipboardPayload(raw)).toBe(null)
  })

  it('payload valido recente: retorna parsed', () => {
    const raw = JSON.stringify({
      format: 'jobvarejo-fabric-items-v2',
      itemsJson: [{ type: 'rect' }],
      copiedAt: Date.now()
    })
    const result = parseCrossTabClipboardPayload(raw)
    expect(result).toBeTruthy()
    expect(result.itemsJson.length).toBe(1)
  })
})
