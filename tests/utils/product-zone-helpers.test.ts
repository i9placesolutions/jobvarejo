import { describe, it, expect } from 'vitest'
import {
  parsePrice,
  formatPriceBR,
  splitPrice,
  getPackPrice,
  getPromoPrice,
  getProductImportIdentityKey,
  isDefaultProductZoneName
} from '~/utils/product-zone-helpers'

describe('parsePrice — entrada heterogenea de fontes diversas', () => {
  it('retorna 0 para null/undefined/string vazia', () => {
    expect(parsePrice(null)).toBe(0)
    expect(parsePrice(undefined)).toBe(0)
    expect(parsePrice('')).toBe(0)
    expect(parsePrice('   ')).toBe(0)
  })

  it('aceita number direto e preserva (com guarda contra NaN/Infinity)', () => {
    expect(parsePrice(1.99)).toBe(1.99)
    expect(parsePrice(0)).toBe(0)
    expect(parsePrice(NaN)).toBe(0)
    expect(parsePrice(Infinity)).toBe(0)
  })

  it('parse formato BR padrao (virgula como decimal)', () => {
    expect(parsePrice('1,99')).toBe(1.99)
    expect(parsePrice('47,99')).toBe(47.99)
    expect(parsePrice('129,99')).toBe(129.99)
  })

  it('parse com separador de milhar BR (ponto) e decimal (virgula)', () => {
    expect(parsePrice('1.299,99')).toBe(1299.99)
    expect(parsePrice('12.345,67')).toBe(12345.67)
    expect(parsePrice('1.234.567,89')).toBe(1234567.89)
  })

  it('parse formato US (ponto decimal)', () => {
    expect(parsePrice('1.99')).toBe(1.99)
    expect(parsePrice('1234.56')).toBe(1234.56)
  })

  it('parse com prefixo R$', () => {
    expect(parsePrice('R$ 47,99')).toBe(47.99)
    expect(parsePrice('R$1.299,99')).toBe(1299.99)
    expect(parsePrice('r$ 12,99')).toBe(12.99)
  })

  it('valor inteiro sem decimal (integer-only)', () => {
    expect(parsePrice('100')).toBe(100)
    expect(parsePrice('1.000')).toBe(1000) // ponto = milhar
    expect(parsePrice('1,000')).toBe(1000) // virgula = milhar (3 digitos)
  })

  it('formato US com milhar e decimal', () => {
    expect(parsePrice('1,234.56')).toBe(1234.56)
  })

  it('descarta caracteres invalidos', () => {
    expect(parsePrice('R$ 1,99 KG')).toBe(1.99)
    expect(parsePrice('PROMO 47,99!!!')).toBe(47.99)
  })
})

describe('formatPriceBR — saida BR padrao', () => {
  it('formata sem simbolo por default', () => {
    expect(formatPriceBR(1.99)).toBe('1,99')
    expect(formatPriceBR(47.99)).toBe('47,99')
    expect(formatPriceBR(0)).toBe('0,00')
  })

  it('formata com simbolo R$', () => {
    expect(formatPriceBR(1.99, true)).toBe('R$ 1,99')
    expect(formatPriceBR(1299.99, true)).toBe('R$ 1299,99')
  })

  it('aceita string e normaliza', () => {
    expect(formatPriceBR('R$ 47,99')).toBe('47,99')
    expect(formatPriceBR('1.299,99')).toBe('1299,99')
  })
})

describe('splitPrice — separa em currency/integer/decimal', () => {
  it('valores tipicos do app', () => {
    expect(splitPrice(1.99)).toEqual({ currency: 'R$', integer: '1', decimal: '99' })
    expect(splitPrice(47.99)).toEqual({ currency: 'R$', integer: '47', decimal: '99' })
    expect(splitPrice(129.99)).toEqual({ currency: 'R$', integer: '129', decimal: '99' })
    expect(splitPrice(1299.99)).toEqual({ currency: 'R$', integer: '1299', decimal: '99' })
  })

  it('decimal padded com 2 casas', () => {
    expect(splitPrice(5)).toEqual({ currency: 'R$', integer: '5', decimal: '00' })
    expect(splitPrice(5.1)).toEqual({ currency: 'R$', integer: '5', decimal: '10' })
  })

  it('aceita string', () => {
    expect(splitPrice('R$ 47,99')).toEqual({ currency: 'R$', integer: '47', decimal: '99' })
    expect(splitPrice('1.299,99')).toEqual({ currency: 'R$', integer: '1299', decimal: '99' })
  })

  it('zero é tratado consistentemente', () => {
    expect(splitPrice(0)).toEqual({ currency: 'R$', integer: '0', decimal: '00' })
  })
})

describe('getPackPrice / getPromoPrice — calculos auxiliares', () => {
  it('preco de pacote multiplica corretamente', () => {
    expect(getPackPrice(1.99, 12)).toBeCloseTo(23.88, 2)
    expect(getPackPrice(0.5, 100)).toBe(50)
  })

  it('preco promocional aplica desconto percentual', () => {
    expect(getPromoPrice(100, 10)).toBe(90)
    expect(getPromoPrice(47.99, 50)).toBeCloseTo(23.995, 3)
    expect(getPromoPrice(100, 0)).toBe(100)
  })
})

describe('getProductImportIdentityKey', () => {
  it('prefere productInstanceId', () => {
    expect(getProductImportIdentityKey({
      productInstanceId: 'inst-1',
      id: 'prod-1'
    }, 0)).toBe('inst-1')
  })

  it('cai para id quando nao ha productInstanceId', () => {
    expect(getProductImportIdentityKey({ id: 'prod-1' }, 5)).toBe('prod-1')
  })

  it('fallback indexado quando nao ha nenhum identificador', () => {
    expect(getProductImportIdentityKey({}, 0)).toBe('tmp-product-1')
    expect(getProductImportIdentityKey({}, 4)).toBe('tmp-product-5')
    expect(getProductImportIdentityKey(null, 0)).toBe('tmp-product-1')
  })

  it('trim em strings', () => {
    expect(getProductImportIdentityKey({ id: '  prod-1  ' }, 0)).toBe('prod-1')
  })
})

describe('isDefaultProductZoneName', () => {
  it('vazio/null/whitespace e default', () => {
    expect(isDefaultProductZoneName('')).toBe(true)
    expect(isDefaultProductZoneName(null)).toBe(true)
    expect(isDefaultProductZoneName(undefined)).toBe(true)
    expect(isDefaultProductZoneName('   ')).toBe(true)
  })

  it('formato base "Zona de Produtos" e default', () => {
    expect(isDefaultProductZoneName('Zona de Produtos')).toBe(true)
    expect(isDefaultProductZoneName('zona de produtos')).toBe(true)
  })

  it('formato indexado "Zona de Produtos N" e default', () => {
    expect(isDefaultProductZoneName('Zona de Produtos 1')).toBe(true)
    expect(isDefaultProductZoneName('Zona de Produtos 99')).toBe(true)
  })

  it('nome customizado nao e default', () => {
    expect(isDefaultProductZoneName('Minha Zona')).toBe(false)
    expect(isDefaultProductZoneName('Atacado')).toBe(false)
    expect(isDefaultProductZoneName('Zona de Produtos especial')).toBe(false)
  })
})
