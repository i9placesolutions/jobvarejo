import { describe, it, expect } from 'vitest'
import {
  getCardBackgroundRect,
  getCardTitleText,
  getCardLimitText
} from '~/utils/productCardLookup'

const card = (children: any[]) => ({
  type: 'group',
  getObjects: () => children
})

describe('getCardBackgroundRect', () => {
  it('null/sem getObjects → null', () => {
    expect(getCardBackgroundRect(null)).toBeNull()
    expect(getCardBackgroundRect({})).toBeNull()
  })

  it('encontra por name=offerBackground (canonico)', () => {
    const bg = { type: 'rect', name: 'offerBackground' }
    expect(getCardBackgroundRect(card([bg, { type: 'text' }]))).toBe(bg)
  })

  it('rejeita name=offerBackground se type !== rect', () => {
    const bg = { type: 'image', name: 'offerBackground' }
    const realRect = { type: 'rect', width: 100, height: 100 }
    expect(getCardBackgroundRect(card([bg, realRect]))).toBe(realRect)
  })

  it('fallback: name pattern /background|bg/i', () => {
    const bg = { type: 'rect', name: 'productBg' }
    expect(getCardBackgroundRect(card([{ type: 'text' }, bg]))).toBe(bg)
  })

  it('fallback: maior rect por area (sem name match)', () => {
    const small = { type: 'rect', width: 10, height: 10, scaleX: 1, scaleY: 1 }
    const big = { type: 'rect', width: 100, height: 100, scaleX: 1, scaleY: 1 }
    expect(getCardBackgroundRect(card([small, big]))).toBe(big)
  })

  it('considera escalas no calculo de area', () => {
    const a = { type: 'rect', width: 50, height: 50, scaleX: 1, scaleY: 1 } // 2500
    const b = { type: 'rect', width: 30, height: 30, scaleX: 2, scaleY: 2 } // 3600
    expect(getCardBackgroundRect(card([a, b]))).toBe(b)
  })

  it('sem rects: null', () => {
    expect(getCardBackgroundRect(card([{ type: 'text' }, { type: 'image' }]))).toBeNull()
  })
})

describe('getCardTitleText', () => {
  it('null/sem getObjects → null', () => {
    expect(getCardTitleText(null)).toBeNull()
    expect(getCardTitleText({})).toBeNull()
  })

  it('encontra por name=smart_title (canonico)', () => {
    const title = { type: 'text', name: 'smart_title', text: 'Banana' }
    expect(getCardTitleText(card([title]))).toBe(title)
  })

  it('fallback: text mais alto (menor top)', () => {
    const a = { type: 'text', top: 100 }
    const b = { type: 'text', top: 20 }
    expect(getCardTitleText(card([a, b]))).toBe(b)
  })

  it('aceita text/i-text/textbox no fallback', () => {
    expect(getCardTitleText(card([{ type: 'i-text', top: 5 }]))?.type).toBe('i-text')
    expect(getCardTitleText(card([{ type: 'textbox', top: 5 }]))?.type).toBe('textbox')
  })

  it('top NaN → tratado como Infinity (nao escolhido se ha outro com top valido)', () => {
    const valid = { type: 'text', top: 50 }
    const invalid = { type: 'text', top: NaN }
    expect(getCardTitleText(card([invalid, valid]))).toBe(valid)
  })

  it('apenas non-text children: null', () => {
    expect(getCardTitleText(card([{ type: 'rect' }, { type: 'image' }]))).toBeNull()
  })

  it('smart_title vence sobre fallback de top', () => {
    const fallback = { type: 'text', top: 0 }
    const title = { type: 'text', name: 'smart_title', top: 999 }
    expect(getCardTitleText(card([fallback, title]))).toBe(title)
  })
})

describe('getCardLimitText', () => {
  it('null/sem getObjects → null', () => {
    expect(getCardLimitText(null)).toBeNull()
    expect(getCardLimitText({})).toBeNull()
  })

  it('encontra por name=smart_limit (canonico)', () => {
    const limit = { type: 'text', name: 'smart_limit', text: 'LIMITE 3UN' }
    expect(getCardLimitText(card([limit]))).toBe(limit)
  })

  it('encontra por name=limitText (legacy)', () => {
    const limit = { type: 'text', name: 'limitText' }
    expect(getCardLimitText(card([limit]))).toBe(limit)
  })

  it('encontra por name=product_limit', () => {
    const limit = { type: 'text', name: 'product_limit' }
    expect(getCardLimitText(card([limit]))).toBe(limit)
  })

  it('encontra por data.smartType=product-limit', () => {
    const limit = { type: 'text', data: { smartType: 'product-limit' } }
    expect(getCardLimitText(card([limit]))).toBe(limit)
  })

  it('sem limit canonico nem fallback: null', () => {
    expect(getCardLimitText(card([{ type: 'text', name: 'random' }]))).toBeNull()
    expect(getCardLimitText(card([]))).toBeNull()
  })

  it('precedencia primeira-match (smart_limit aparece antes)', () => {
    const a = { type: 'text', name: 'smart_limit' }
    const b = { type: 'text', name: 'limitText' }
    expect(getCardLimitText(card([a, b]))).toBe(a)
  })
})
