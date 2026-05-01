import { describe, it, expect } from 'vitest'
import {
  reviveRedBurstJsonNode,
  sanitizeRedBurstTemplateGroupJson
} from '~/utils/redBurstTemplateRevive'

describe('reviveRedBurstJsonNode', () => {
  it('null/non-object: false (no-op)', () => {
    expect(reviveRedBurstJsonNode(null)).toBe(false)
    expect(reviveRedBurstJsonNode(undefined)).toBe(false)
    expect(reviveRedBurstJsonNode('not-an-obj')).toBe(false)
  })

  it('node sem mudancas: false', () => {
    const node = {
      type: 'rect',
      visible: true,
      opacity: 1,
      scaleX: 1,
      scaleY: 1
    }
    expect(reviveRedBurstJsonNode(node)).toBe(false)
  })

  it('forceVisible+visible=false: corrige', () => {
    const node: any = { type: 'rect', visible: false, opacity: 1, scaleX: 1, scaleY: 1 }
    expect(reviveRedBurstJsonNode(node)).toBe(true)
    expect(node.visible).toBe(true)
  })

  it('forceVisible=false: nao toca em visible', () => {
    const node: any = { type: 'rect', visible: false, opacity: 1, scaleX: 1, scaleY: 1 }
    reviveRedBurstJsonNode(node, { forceVisible: false })
    expect(node.visible).toBe(false)
  })

  it('opacity 0/invalida: vira 1', () => {
    const node: any = { type: 'rect', opacity: 0, scaleX: 1, scaleY: 1 }
    expect(reviveRedBurstJsonNode(node)).toBe(true)
    expect(node.opacity).toBe(1)
  })

  it('scaleX/scaleY proximos de zero: usa visibleScaleX/Y como reset', () => {
    const node: any = {
      type: 'rect',
      opacity: 1,
      scaleX: 0,
      scaleY: 0.00005,
      __visibleScaleX: 1.5,
      __visibleScaleY: 2
    }
    expect(reviveRedBurstJsonNode(node)).toBe(true)
    // normalizeVisibleScale aplica clamp/normalizacao; resultado nao zerado
    expect(Math.abs(node.scaleX)).toBeGreaterThan(0.0001)
    expect(Math.abs(node.scaleY)).toBeGreaterThan(0.0001)
  })

  it('text node sem fontSize: usa fallbackFontSize', () => {
    const node: any = { type: 'text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: 'oi', fill: '#ffffff' }
    expect(reviveRedBurstJsonNode(node, { fallbackFontSize: 32 })).toBe(true)
    expect(node.fontSize).toBe(32)
  })

  it('text node sem fontSize nem fallback: usa 18 default', () => {
    const node: any = { type: 'text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: NaN, text: 'oi', fill: '#ffffff' }
    expect(reviveRedBurstJsonNode(node)).toBe(true)
    expect(node.fontSize).toBe(18)
  })

  it('text node sem text: usa fallbackText', () => {
    const node: any = { type: 'text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 24, text: '', fill: '#ffffff' }
    expect(reviveRedBurstJsonNode(node, { fallbackText: 'OFERTA' })).toBe(true)
    expect(node.text).toBe('OFERTA')
  })

  it('text node com fill rgba(0,0,0,0): usa fallbackFill', () => {
    // isTransparentLikeTemplateColor exige parse com alpha <= 0.12.
    const node: any = { type: 'text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 24, text: 'oi', fill: 'rgba(0,0,0,0)' }
    expect(reviveRedBurstJsonNode(node, { fallbackFill: '#ff0000' })).toBe(true)
    expect(node.fill).toBe('#ff0000')
  })

  it('text node fill solido: nao toca', () => {
    const node: any = { type: 'text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 24, text: 'oi', fill: '#abcdef' }
    expect(reviveRedBurstJsonNode(node, { fallbackFill: '#ff0000' })).toBe(false)
    expect(node.fill).toBe('#abcdef')
  })

  it('non-text type: ignora fallbackText/fontSize/fill', () => {
    const node: any = { type: 'rect', opacity: 1, scaleX: 1, scaleY: 1 }
    expect(reviveRedBurstJsonNode(node, { fallbackText: 'X', fallbackFill: '#000', fallbackFontSize: 99 })).toBe(false)
    expect(node.text).toBeUndefined()
    expect(node.fontSize).toBeUndefined()
  })

  it('aceita itext/i-text/textbox como text node', () => {
    for (const type of ['text', 'i-text', 'itext', 'textbox']) {
      const node: any = { type, opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: '', fill: 'rgba(0,0,0,0)' }
      reviveRedBurstJsonNode(node, { fallbackFontSize: 24, fallbackText: 'OK', fallbackFill: '#fff' })
      expect(node.fontSize).toBe(24)
      expect(node.text).toBe('OK')
      expect(node.fill).toBe('#fff')
    }
  })
})

describe('sanitizeRedBurstTemplateGroupJson', () => {
  it('null/non-object: retorna input (no-op)', () => {
    expect(sanitizeRedBurstTemplateGroupJson(null)).toBe(null)
    expect(sanitizeRedBurstTemplateGroupJson('str')).toBe('str')
  })

  it('group sem nodes Red Burst: retorna input sem modificar', () => {
    const grp = { type: 'group', objects: [{ type: 'rect', name: 'foo' }] }
    const result = sanitizeRedBurstTemplateGroupJson(grp)
    expect(result).toBe(grp)
  })

  it('group com nodes Red Burst: aplica revive em cada um', () => {
    const grp: any = {
      type: 'group',
      objects: [
        { type: 'rect', name: 'price_bg', visible: false, opacity: 0, scaleX: 1, scaleY: 1 },
        { type: 'rect', name: 'price_header_bg', visible: false, opacity: 0, scaleX: 1, scaleY: 1 },
        { type: 'text', name: 'price_header_text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: '', fill: 'rgba(0,0,0,0)' },
        { type: 'rect', name: 'price_burst_line_a', opacity: 1, scaleX: 1, scaleY: 1 },
        { type: 'text', name: 'price_currency_text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: '', fill: 'rgba(0,0,0,0)' },
        { type: 'text', name: 'price_integer_text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: '', fill: 'rgba(0,0,0,0)' },
        { type: 'text', name: 'price_decimal_text', opacity: 1, scaleX: 1, scaleY: 1, fontSize: 0, text: '', fill: 'rgba(0,0,0,0)' }
      ]
    }
    sanitizeRedBurstTemplateGroupJson(grp)
    const byName = (n: string) => grp.objects.find((o: any) => o.name === n)
    expect(byName('price_bg').visible).toBe(true)
    expect(byName('price_bg').opacity).toBe(1)
    expect(byName('price_header_text').text).toBe('OFERTA')
    expect(byName('price_header_text').fontSize).toBe(28)
    expect(byName('price_currency_text').text).toBe('R$')
    expect(byName('price_currency_text').fontSize).toBe(30)
    expect(byName('price_integer_text').text).toBe('0')
    expect(byName('price_integer_text').fontSize).toBe(92)
    expect(byName('price_decimal_text').text).toBe(',00')
    expect(byName('price_decimal_text').fontSize).toBe(44)
  })

  it('group sem TODOS os nodes obrigatorios: nao aplica revive', () => {
    const grp: any = {
      type: 'group',
      objects: [
        { type: 'rect', name: 'price_bg', visible: false, opacity: 1, scaleX: 1, scaleY: 1 }
        // faltam outros nodes Red Burst
      ]
    }
    const result = sanitizeRedBurstTemplateGroupJson(grp)
    // visible nao foi tocado pq sanitize fez early return
    expect(grp.objects[0].visible).toBe(false)
    expect(result).toBe(grp)
  })
})
