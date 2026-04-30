import { describe, it, expect } from 'vitest'
import {
  parsePriceBR,
  normalizeUnitForLabel,
  parsePriceToCents,
  formatCentsToPrice,
  splitPriceParts,
  resolveAtacVariantKeyFromPrice,
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

describe('parsePriceToCents — preco em centavos como inteiro', () => {
  it('null/undefined/vazio retornam null', () => {
    expect(parsePriceToCents(null)).toBeNull()
    expect(parsePriceToCents(undefined)).toBeNull()
    expect(parsePriceToCents('')).toBeNull()
    expect(parsePriceToCents('   ')).toBeNull()
    expect(parsePriceToCents('R$')).toBeNull() // sem digitos
  })

  it('valores BR (virgula = decimal)', () => {
    expect(parsePriceToCents('1,99')).toBe(199)
    expect(parsePriceToCents('47,99')).toBe(4799)
    expect(parsePriceToCents('129,99')).toBe(12999)
  })

  it('valores BR com milhar (ponto = milhar)', () => {
    expect(parsePriceToCents('1.299,99')).toBe(129999)
    expect(parsePriceToCents('12.345,67')).toBe(1234567)
  })

  it('valores US (ponto decimal)', () => {
    expect(parsePriceToCents('1.99')).toBe(199)
    expect(parsePriceToCents('1234.56')).toBe(123456)
  })

  it('formato BR-first: quando ha ambos , e . trata virgula como decimal', () => {
    // Documenta comportamento atual (BR-only): '1,234.56' nao e' tratado como
    // numero US com milhar — vira 1.23456 cents → 123. Funcao opera em formato
    // brasileiro; entradas US com milhar precisam ser pre-normalizadas pelo caller.
    expect(parsePriceToCents('1,234.56')).toBe(123)
  })

  it('integer-only', () => {
    expect(parsePriceToCents('100')).toBe(10000)
  })

  it('aceita number', () => {
    expect(parsePriceToCents(47.99)).toBe(4799)
    expect(parsePriceToCents(0)).toBe(0)
  })

  it('descarta caracteres invalidos', () => {
    expect(parsePriceToCents('R$ 47,99 KG')).toBe(4799)
  })

  it('NaN nao parseavel retorna null', () => {
    expect(parsePriceToCents('abc')).toBeNull()
    expect(parsePriceToCents('---')).toBeNull()
  })
})

describe('formatCentsToPrice — inverso de parsePriceToCents', () => {
  it('null/Infinity/NaN retornam null', () => {
    expect(formatCentsToPrice(null)).toBeNull()
    expect(formatCentsToPrice(undefined as any)).toBeNull()
    expect(formatCentsToPrice(Infinity)).toBeNull()
    expect(formatCentsToPrice(NaN)).toBeNull()
  })

  it('valores positivos', () => {
    expect(formatCentsToPrice(199)).toBe('1,99')
    expect(formatCentsToPrice(4799)).toBe('47,99')
    expect(formatCentsToPrice(100)).toBe('1,00')
    expect(formatCentsToPrice(0)).toBe('0,00')
  })

  it('valores grandes', () => {
    expect(formatCentsToPrice(129999)).toBe('1299,99')
    expect(formatCentsToPrice(1000000)).toBe('10000,00')
  })

  it('valores negativos preservam sinal', () => {
    expect(formatCentsToPrice(-50)).toBe('-0,50')
    expect(formatCentsToPrice(-4799)).toBe('-47,99')
  })

  it('arredonda decimais (round-half-up)', () => {
    expect(formatCentsToPrice(199.5)).toBe('2,00')
    expect(formatCentsToPrice(199.4)).toBe('1,99')
  })

  it('roundtrip: parse -> format devolve a string original', () => {
    const samples = ['1,99', '47,99', '129,99', '1299,99']
    for (const s of samples) {
      const cents = parsePriceToCents(s)!
      expect(formatCentsToPrice(cents)).toBe(s)
    }
  })
})

describe('splitPriceParts — wrapper resiliente sobre parsePriceBR', () => {
  it('integer/dec sempre tem fallback seguro', () => {
    expect(splitPriceParts('1,99')).toEqual({ integer: '1', dec: '99' })
    expect(splitPriceParts('')).toEqual({ integer: '0', dec: '00' })
    expect(splitPriceParts(null)).toEqual({ integer: '0', dec: '00' })
    expect(splitPriceParts(0)).toEqual({ integer: '0', dec: '00' })
  })

  it('valores tipicos do app', () => {
    expect(splitPriceParts('47,99')).toEqual({ integer: '47', dec: '99' })
    expect(splitPriceParts('129,99')).toEqual({ integer: '129', dec: '99' })
    expect(splitPriceParts('R$ 1.299,99')).toEqual({ integer: '1299', dec: '99' })
  })

  it('REGRESSAO: preco "0" nao retorna "0,undefined"', () => {
    // Bug previo: parsed.centavos vazio gerava "0,undefined" na renderizacao.
    const r = splitPriceParts('0')
    expect(r.dec).toBe('00')
    expect(r.integer).toBe('0')
  })
})

describe('resolveAtacVariantKeyFromPrice — chave de variante por digitos', () => {
  it('1 digito → tiny', () => {
    expect(resolveAtacVariantKeyFromPrice('1,99')).toBe('tiny')
    expect(resolveAtacVariantKeyFromPrice('5,00')).toBe('tiny')
    expect(resolveAtacVariantKeyFromPrice('0,33')).toBe('tiny')
  })

  it('2 digitos → normal', () => {
    expect(resolveAtacVariantKeyFromPrice('12,99')).toBe('normal')
    expect(resolveAtacVariantKeyFromPrice('47,99')).toBe('normal')
    expect(resolveAtacVariantKeyFromPrice('99,99')).toBe('normal')
  })

  it('3+ digitos → large', () => {
    expect(resolveAtacVariantKeyFromPrice('100,00')).toBe('large')
    expect(resolveAtacVariantKeyFromPrice('129,99')).toBe('large')
    expect(resolveAtacVariantKeyFromPrice('1.299,99')).toBe('large')
    expect(resolveAtacVariantKeyFromPrice('12.345,67')).toBe('large')
  })

  it('valores invalidos caem em tiny (1 digito de fallback "0")', () => {
    expect(resolveAtacVariantKeyFromPrice('')).toBe('tiny')
    expect(resolveAtacVariantKeyFromPrice(null)).toBe('tiny')
    expect(resolveAtacVariantKeyFromPrice('abc')).toBe('tiny')
  })

  it('zeros a esquerda sao ignorados na contagem', () => {
    // "047,99" tem 3 digitos brutos mas 2 digitos significativos → normal
    expect(resolveAtacVariantKeyFromPrice('047,99')).toBe('normal')
    expect(resolveAtacVariantKeyFromPrice('001,99')).toBe('tiny')
  })
})
