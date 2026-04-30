import { describe, it, expect } from 'vitest'
import {
  parsePriceBR,
  normalizeUnitForLabel,
  PRICE_INTEGER_DECIMAL_GAP_PX
} from '~/utils/priceTagText'

describe('parsePriceBR — split inteiro/centavos para etiqueta', () => {
  it('valor vazio/null/undefined retorna 0/00', () => {
    expect(parsePriceBR('')).toEqual({ inteiro: '0', centavos: '00' })
    expect(parsePriceBR(null as any)).toEqual({ inteiro: '0', centavos: '00' })
    expect(parsePriceBR(undefined as any)).toEqual({ inteiro: '0', centavos: '00' })
  })

  it('valores tipicos do app', () => {
    expect(parsePriceBR('1,99')).toEqual({ inteiro: '1', centavos: '99' })
    expect(parsePriceBR('12,99')).toEqual({ inteiro: '12', centavos: '99' })
    expect(parsePriceBR('47,99')).toEqual({ inteiro: '47', centavos: '99' })
    expect(parsePriceBR('129,99')).toEqual({ inteiro: '129', centavos: '99' })
  })

  it('valor com milhar BR', () => {
    expect(parsePriceBR('1.299,99')).toEqual({ inteiro: '1299', centavos: '99' })
    expect(parsePriceBR('12.345,67')).toEqual({ inteiro: '12345', centavos: '67' })
  })

  it('valor com prefixo R$', () => {
    expect(parsePriceBR('R$ 47,99')).toEqual({ inteiro: '47', centavos: '99' })
    expect(parsePriceBR('R$1.299,99')).toEqual({ inteiro: '1299', centavos: '99' })
  })

  it('integer-only — centavos vira "00"', () => {
    expect(parsePriceBR('100')).toEqual({ inteiro: '100', centavos: '00' })
    expect(parsePriceBR('5')).toEqual({ inteiro: '5', centavos: '00' })
  })

  it('decimal com 1 casa pad com zero a direita', () => {
    expect(parsePriceBR('5,1')).toEqual({ inteiro: '5', centavos: '10' })
  })

  it('decimal com 3+ casas trunca para 2', () => {
    expect(parsePriceBR('5,999')).toEqual({ inteiro: '5', centavos: '99' })
  })

  it('descarta caracteres invalidos', () => {
    expect(parsePriceBR('PROMO R$ 47,99 KG')).toEqual({ inteiro: '47', centavos: '99' })
  })
})

describe('normalizeUnitForLabel — chip da etiqueta (KG/UN/vazio)', () => {
  it('vazio/null retorna ""', () => {
    expect(normalizeUnitForLabel('')).toBe('')
    expect(normalizeUnitForLabel(null)).toBe('')
    expect(normalizeUnitForLabel(undefined)).toBe('')
    expect(normalizeUnitForLabel('   ')).toBe('')
  })

  it('variantes de KG mapeiam para KG', () => {
    expect(normalizeUnitForLabel('KG')).toBe('KG')
    expect(normalizeUnitForLabel('kg')).toBe('KG')
    expect(normalizeUnitForLabel('K')).toBe('KG')
    expect(normalizeUnitForLabel('Kilo')).toBe('KG')
    expect(normalizeUnitForLabel('KILOS')).toBe('KG')
    expect(normalizeUnitForLabel('1KG')).toBe('KG')
    expect(normalizeUnitForLabel('2,5KG')).toBe('KG')
    expect(normalizeUnitForLabel('0.5 kg')).toBe('KG')
  })

  it('variantes de UN mapeiam para UN', () => {
    expect(normalizeUnitForLabel('UN')).toBe('UN')
    expect(normalizeUnitForLabel('un')).toBe('UN')
    expect(normalizeUnitForLabel('UND')).toBe('UN')
    expect(normalizeUnitForLabel('UNID')).toBe('UN')
    expect(normalizeUnitForLabel('UNIDADE')).toBe('UN')
  })

  it('REGRESSAO: gramaturas (ML/L/G) NAO viram UN — retornam string vazia', () => {
    // Bug historico: tudo nao-KG virava UN automaticamente, gerando "UN
    // fantasma" em produtos com gramatura tipo 500ML, 1L, 2L.
    expect(normalizeUnitForLabel('ML')).toBe('')
    expect(normalizeUnitForLabel('500ML')).toBe('')
    expect(normalizeUnitForLabel('1L')).toBe('')
    expect(normalizeUnitForLabel('2L')).toBe('')
    expect(normalizeUnitForLabel('300G')).toBe('')
    expect(normalizeUnitForLabel('LITRO')).toBe('')
  })
})

describe('constantes', () => {
  it('PRICE_INTEGER_DECIMAL_GAP_PX é 1px', () => {
    expect(PRICE_INTEGER_DECIMAL_GAP_PX).toBe(1)
  })
})
