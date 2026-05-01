import { describe, it, expect } from 'vitest'
import {
  DEBOUNCED_GLOBAL_STYLE_PROPS,
  isDebouncedGlobalStyleProp,
  LIGHTWEIGHT_GLOBAL_STYLE_PROPS,
  isLightweightGlobalStyleProp,
  ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS,
  allowsUndefinedGlobalStyleProp
} from '~/utils/globalStylePropClassifiers'

describe('DEBOUNCED_GLOBAL_STYLE_PROPS', () => {
  it('contem props de slider/range esperadas', () => {
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('cardBorderRadius')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('cardBorderWidth')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('splashScale')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('splashTextScale')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('splashRoundness')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('splashOffsetY')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('prodNameScale')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('prodNameLineHeight')).toBe(true)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('prodNameOffsetY')).toBe(true)
  })

  it('NAO contem props de toggle/cor (sao salvas imediatamente)', () => {
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('cardColor')).toBe(false)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('prodNameFont')).toBe(false)
    expect(DEBOUNCED_GLOBAL_STYLE_PROPS.has('isProdBgTransparent')).toBe(false)
  })
})

describe('isDebouncedGlobalStyleProp', () => {
  it('detecta props debounced', () => {
    expect(isDebouncedGlobalStyleProp('cardBorderRadius')).toBe(true)
    expect(isDebouncedGlobalStyleProp('splashScale')).toBe(true)
  })

  it('rejeita props nao-debounced', () => {
    expect(isDebouncedGlobalStyleProp('cardColor')).toBe(false)
    expect(isDebouncedGlobalStyleProp('unknown-prop')).toBe(false)
  })

  it('null/undefined/empty → false', () => {
    expect(isDebouncedGlobalStyleProp(null)).toBe(false)
    expect(isDebouncedGlobalStyleProp(undefined)).toBe(false)
    expect(isDebouncedGlobalStyleProp('')).toBe(false)
  })

  it('case-sensitive (cardborderradius nao bate)', () => {
    expect(isDebouncedGlobalStyleProp('cardborderradius')).toBe(false)
    expect(isDebouncedGlobalStyleProp('CARDBORDERRADIUS')).toBe(false)
  })
})

describe('LIGHTWEIGHT_GLOBAL_STYLE_PROPS', () => {
  it('contem props leves esperadas (cores, fonts, escalas)', () => {
    const samples = [
      'cardColor', 'cardBorderColor', 'cardBorderWidth', 'cardBorderRadius',
      'prodNameFont', 'prodNameColor', 'prodNameWeight', 'prodNameAlign',
      'splashColor', 'accentColor', 'priceTextColor',
      'priceFont', 'priceFontWeight', 'priceFontStyle',
      'currencySymbol', 'priceFontSize', 'splashStrokeWidth'
    ]
    samples.forEach(prop => {
      expect(LIGHTWEIGHT_GLOBAL_STYLE_PROPS.has(prop)).toBe(true)
    })
  })

  it('contem isProdBgTransparent (toggle leve)', () => {
    expect(LIGHTWEIGHT_GLOBAL_STYLE_PROPS.has('isProdBgTransparent')).toBe(true)
  })

  it('NAO contem props de structural (forcam reflow)', () => {
    expect(LIGHTWEIGHT_GLOBAL_STYLE_PROPS.has('layoutMode')).toBe(false)
    expect(LIGHTWEIGHT_GLOBAL_STYLE_PROPS.has('templateId')).toBe(false)
  })
})

describe('isLightweightGlobalStyleProp', () => {
  it('detecta props leves', () => {
    expect(isLightweightGlobalStyleProp('cardColor')).toBe(true)
    expect(isLightweightGlobalStyleProp('prodNameFont')).toBe(true)
  })

  it('rejeita props nao-leves', () => {
    expect(isLightweightGlobalStyleProp('layoutMode')).toBe(false)
    expect(isLightweightGlobalStyleProp('unknown')).toBe(false)
  })

  it('trim aplicado no input', () => {
    expect(isLightweightGlobalStyleProp('  cardColor  ')).toBe(true)
    expect(isLightweightGlobalStyleProp('\tprodNameFont\n')).toBe(true)
  })

  it('null/undefined/empty → false', () => {
    expect(isLightweightGlobalStyleProp(null)).toBe(false)
    expect(isLightweightGlobalStyleProp(undefined)).toBe(false)
    expect(isLightweightGlobalStyleProp('')).toBe(false)
    expect(isLightweightGlobalStyleProp('   ')).toBe(false)
  })
})

describe('ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS', () => {
  it('contem props que aceitam undefined', () => {
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('splashTemplateId')).toBe(true)
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('priceTextColor')).toBe(true)
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('priceCurrencyColor')).toBe(true)
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('priceFontWeight')).toBe(true)
  })

  it('NAO contem props que requerem valor concreto', () => {
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('cardColor')).toBe(false)
    expect(ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has('cardBorderRadius')).toBe(false)
  })
})

describe('allowsUndefinedGlobalStyleProp', () => {
  it('detecta props que aceitam undefined', () => {
    expect(allowsUndefinedGlobalStyleProp('splashTemplateId')).toBe(true)
    expect(allowsUndefinedGlobalStyleProp('priceTextColor')).toBe(true)
  })

  it('rejeita props que requerem valor', () => {
    expect(allowsUndefinedGlobalStyleProp('cardColor')).toBe(false)
    expect(allowsUndefinedGlobalStyleProp('unknown')).toBe(false)
  })

  it('null/undefined/empty → false', () => {
    expect(allowsUndefinedGlobalStyleProp(null)).toBe(false)
    expect(allowsUndefinedGlobalStyleProp(undefined)).toBe(false)
    expect(allowsUndefinedGlobalStyleProp('')).toBe(false)
  })

  it('trim aplicado', () => {
    expect(allowsUndefinedGlobalStyleProp('  splashTemplateId  ')).toBe(true)
  })
})
