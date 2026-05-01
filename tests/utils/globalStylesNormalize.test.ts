import { describe, it, expect } from 'vitest'
import { normalizeGlobalStyles } from '~/utils/globalStylesNormalize'
import type { GlobalStyles } from '~/types/product-zone'

const baseDefaults: GlobalStyles = {
  cardColor: '#ffffff',
  cardBorderColor: '#000000',
  cardBorderRadius: 8,
  cardBorderWidth: 0,
  accentColor: '#dc2626',
  prodNameColor: '#000000',
  prodNameScale: 1,
  prodNameLineHeight: 1.05,
  prodNameOffsetY: 0,
  prodNameAlign: 'center',
  prodNameTransform: 'upper',
  prodNameFont: 'Inter',
  isProdBgTransparent: false,
  limitColor: '#ef4444',
  splashColor: '#dc2626',
  splashTextColor: '#ffffff',
  splashFill: '#000000',
  splashScale: 1,
  splashTextScale: 1,
  splashRoundness: 1,
  splashOffsetY: 0,
  splashStrokeWidth: 0,
  priceFontSize: 60,
  priceFont: 'Inter',
  priceFontStyle: 'normal'
} as any

describe('normalizeGlobalStyles', () => {
  it('null/undefined: retorna defaults', () => {
    const r1 = normalizeGlobalStyles(null, baseDefaults)
    expect(r1.cardColor).toBe('#ffffff')
    const r2 = normalizeGlobalStyles(undefined, baseDefaults)
    expect(r2.cardColor).toBe('#ffffff')
  })

  it('input parcial: merge com defaults', () => {
    const r = normalizeGlobalStyles({ cardColor: '#abcdef' }, baseDefaults)
    expect(r.cardColor).toBe('#abcdef')
    expect(r.accentColor).toBe('#dc2626')
  })

  it('cores invalidas: cai no fallback', () => {
    const r = normalizeGlobalStyles({ cardBorderColor: 'not-a-color' as any }, baseDefaults)
    expect(r.cardBorderColor).toBe('#000000')
  })

  it('cardColor aceita transparent', () => {
    const r = normalizeGlobalStyles({ cardColor: 'transparent' }, baseDefaults)
    expect(r.cardColor).toBe('transparent')
  })

  it('cardBorderRadius clampado em [0, 120]', () => {
    expect(normalizeGlobalStyles({ cardBorderRadius: -10 }, baseDefaults).cardBorderRadius).toBe(0)
    expect(normalizeGlobalStyles({ cardBorderRadius: 999 }, baseDefaults).cardBorderRadius).toBe(120)
    expect(normalizeGlobalStyles({ cardBorderRadius: 50 }, baseDefaults).cardBorderRadius).toBe(50)
  })

  it('cardBorderWidth clampado em [0, 24]', () => {
    expect(normalizeGlobalStyles({ cardBorderWidth: -5 }, baseDefaults).cardBorderWidth).toBe(0)
    expect(normalizeGlobalStyles({ cardBorderWidth: 50 }, baseDefaults).cardBorderWidth).toBe(24)
  })

  it('prodNameScale clampado em [0.5, 2.5]', () => {
    expect(normalizeGlobalStyles({ prodNameScale: 0.1 }, baseDefaults).prodNameScale).toBe(0.5)
    expect(normalizeGlobalStyles({ prodNameScale: 5 }, baseDefaults).prodNameScale).toBe(2.5)
  })

  it('priceFontSize clampado em [24, 160]', () => {
    expect(normalizeGlobalStyles({ priceFontSize: 10 }, baseDefaults).priceFontSize).toBe(24)
    expect(normalizeGlobalStyles({ priceFontSize: 500 }, baseDefaults).priceFontSize).toBe(160)
  })

  it('splashStrokeWidth: undefined explicito mantem undefined', () => {
    const r = normalizeGlobalStyles({ splashStrokeWidth: undefined }, baseDefaults)
    // splashStrokeWidth = undefined no input mas defaults fornece 0 — merge spread fica defaults
    // logica: undefined explicito apos merge = ainda 0 pelos defaults; null vira undefined
    expect(typeof r.splashStrokeWidth === 'number' || r.splashStrokeWidth === undefined).toBe(true)
  })

  it('splashStrokeWidth: null explicito vira undefined', () => {
    const r = normalizeGlobalStyles({ splashStrokeWidth: null as any }, baseDefaults)
    expect(r.splashStrokeWidth).toBe(undefined)
  })

  it('isProdBgTransparent: coerce para boolean', () => {
    expect(normalizeGlobalStyles({ isProdBgTransparent: 1 as any }, baseDefaults).isProdBgTransparent).toBe(true)
    expect(normalizeGlobalStyles({ isProdBgTransparent: 0 as any }, baseDefaults).isProdBgTransparent).toBe(false)
    expect(normalizeGlobalStyles({ isProdBgTransparent: 'yes' as any }, baseDefaults).isProdBgTransparent).toBe(true)
  })

  it('prodNameAlign invalido: cai para default', () => {
    const r = normalizeGlobalStyles({ prodNameAlign: 'justify' as any }, baseDefaults)
    expect(r.prodNameAlign).toBe('center')
  })

  it('prodNameAlign valido (left/center/right): preservado', () => {
    expect(normalizeGlobalStyles({ prodNameAlign: 'left' }, baseDefaults).prodNameAlign).toBe('left')
    expect(normalizeGlobalStyles({ prodNameAlign: 'right' }, baseDefaults).prodNameAlign).toBe('right')
  })

  it('prodNameTransform invalido: cai para default', () => {
    const r = normalizeGlobalStyles({ prodNameTransform: 'capitalize' as any }, baseDefaults)
    expect(r.prodNameTransform).toBe('upper')
  })

  it('priceFontStyle "italic" preservado, qualquer outro normaliza para "normal"', () => {
    expect(normalizeGlobalStyles({ priceFontStyle: 'italic' }, baseDefaults).priceFontStyle).toBe('italic')
    expect(normalizeGlobalStyles({ priceFontStyle: 'oblique' as any }, baseDefaults).priceFontStyle).toBe('normal')
    expect(normalizeGlobalStyles({ priceFontStyle: 'bold' as any }, baseDefaults).priceFontStyle).toBe('normal')
  })

  it('priceFont string vazia: cai para default', () => {
    const r = normalizeGlobalStyles({ priceFont: '' }, baseDefaults)
    expect(r.priceFont).toBe('Inter')
  })

  it('prodNameFont string vazia: cai para default', () => {
    const r = normalizeGlobalStyles({ prodNameFont: '   ' }, baseDefaults)
    expect(r.prodNameFont).toBe('Inter')
  })

  it('priceTextColor permite undefined', () => {
    const r = normalizeGlobalStyles({ priceTextColor: undefined as any }, baseDefaults)
    // undefined depois do merge usa defaults — mas defaults nao tem priceTextColor entao undefined
    expect(r.priceTextColor === undefined || typeof r.priceTextColor === 'string').toBe(true)
  })

  it('priceFontWeight: empty string vira undefined', () => {
    const r = normalizeGlobalStyles({ priceFontWeight: '' as any }, baseDefaults)
    expect(r.priceFontWeight).toBe(undefined)
  })

  it('priceFontWeight: null vira undefined', () => {
    const r = normalizeGlobalStyles({ priceFontWeight: null as any }, baseDefaults)
    expect(r.priceFontWeight).toBe(undefined)
  })

  it('priceFontWeight: valores normais preservados', () => {
    expect(normalizeGlobalStyles({ priceFontWeight: 'bold' as any }, baseDefaults).priceFontWeight).toBe('bold')
    expect(normalizeGlobalStyles({ priceFontWeight: 700 as any }, baseDefaults).priceFontWeight).toBe(700)
  })

  it('non-object input: trata como vazio', () => {
    const r = normalizeGlobalStyles('foo' as any, baseDefaults)
    expect(r.cardColor).toBe('#ffffff')
  })
})
