import { describe, it, expect } from 'vitest'
import {
  parsePrice,
  formatPriceBR,
  splitPrice,
  getPackPrice,
  getPromoPrice,
  getProductImportIdentityKey,
  isDefaultProductZoneName,
  BASE_PRODUCT_ZONE_NAME,
  getNextProductZoneIndexName,
  ensureZoneNamesDistinct,
  buildProductSlicesForZones
} from '~/utils/product-zone-helpers'

describe('buildProductSlicesForZones', () => {
  const constCount = (n: number) => () => n

  it('zonas vazias: arrays vazios', () => {
    expect(buildProductSlicesForZones([], [], 'append', constCount(0))).toEqual([])
  })

  it('produtos vazios: arrays vazios mas com tamanho de zonas', () => {
    expect(buildProductSlicesForZones([], [{}, {}], 'append', constCount(0))).toEqual([[], []])
  })

  it('1 zona: todos os produtos vao na zona', () => {
    const products = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(buildProductSlicesForZones(products, [{}], 'append', constCount(0))).toEqual([products])
  })

  it('append distribui igual com remainder nas primeiras', () => {
    const products = [1, 2, 3, 4, 5]
    const result = buildProductSlicesForZones(products as any[], [{}, {}], 'append', constCount(0))
    expect(result[0]?.length).toBe(3) // base 2 + 1 remainder
    expect(result[1]?.length).toBe(2)
  })

  it('replace + zonas com counts existentes: respeita allocacoes', () => {
    const products = [1, 2, 3, 4, 5, 6]
    const counts = [2, 4]
    const getCount = (zone: any) => {
      const idx = zone.idx
      return counts[idx]!
    }
    const result = buildProductSlicesForZones(
      products as any[],
      [{ idx: 0 }, { idx: 1 }],
      'replace',
      getCount
    )
    expect(result[0]?.length).toBe(2)
    expect(result[1]?.length).toBe(4)
  })

  it('replace + total existing > products: encolhe das ultimas zonas', () => {
    const products = [1, 2, 3]
    const counts = [3, 3]
    const getCount = (zone: any) => counts[zone.idx]!
    const result = buildProductSlicesForZones(
      products as any[],
      [{ idx: 0 }, { idx: 1 }],
      'replace',
      getCount
    )
    expect(result[0]?.length! + result[1]?.length!).toBe(3)
  })

  it('replace + total existing < products: cresce em round-robin', () => {
    const products = [1, 2, 3, 4, 5, 6]
    const counts = [1, 1]
    const getCount = (zone: any) => counts[zone.idx]!
    const result = buildProductSlicesForZones(
      products as any[],
      [{ idx: 0 }, { idx: 1 }],
      'replace',
      getCount
    )
    expect(result[0]?.length! + result[1]?.length!).toBe(6)
  })

  it('replace + totalExisting=0: cai para distribuicao igual', () => {
    const products = [1, 2, 3, 4]
    const result = buildProductSlicesForZones(
      products as any[],
      [{}, {}],
      'replace',
      constCount(0)
    )
    expect(result[0]?.length).toBe(2)
    expect(result[1]?.length).toBe(2)
  })

  it('getZoneChildCount com erro: trata como 0', () => {
    const products = [1, 2, 3]
    const getCount = (_zone: any): number => { throw new Error('boom') }
    const result = buildProductSlicesForZones(
      products as any[],
      [{}, {}],
      'append',
      getCount
    )
    // append com zonas sem children: distribuicao igual
    expect(result[0]?.length! + result[1]?.length!).toBe(3)
  })
})

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

describe('BASE_PRODUCT_ZONE_NAME', () => {
  it('e a constante "Zona de Produtos"', () => {
    expect(BASE_PRODUCT_ZONE_NAME).toBe('Zona de Produtos')
  })
})

describe('getNextProductZoneIndexName', () => {
  it('lista vazia → "Zona de Produtos 1"', () => {
    expect(getNextProductZoneIndexName([])).toBe('Zona de Produtos 1')
  })

  it('"Zona de Produtos" sozinha (sem N) → trata como N=1, proximo e 2', () => {
    expect(getNextProductZoneIndexName(['Zona de Produtos'])).toBe('Zona de Produtos 2')
  })

  it('"Zona de Produtos 1" presente → proximo e 2', () => {
    expect(getNextProductZoneIndexName(['Zona de Produtos 1'])).toBe('Zona de Produtos 2')
  })

  it('preenche o primeiro gap', () => {
    expect(getNextProductZoneIndexName([
      'Zona de Produtos 1', 'Zona de Produtos 3'
    ])).toBe('Zona de Produtos 2')
  })

  it('com nomes nao-default: ignora-os', () => {
    expect(getNextProductZoneIndexName([
      'Minha Zona Especial', 'Outra Coisa'
    ])).toBe('Zona de Produtos 1')
  })

  it('case-insensitive na deteccao de nome base', () => {
    expect(getNextProductZoneIndexName(['ZONA DE PRODUTOS'])).toBe('Zona de Produtos 2')
    expect(getNextProductZoneIndexName(['zona de produtos 5'])).toBe('Zona de Produtos 1')
  })

  it('strings vazias/whitespace ignoradas', () => {
    expect(getNextProductZoneIndexName(['', '   ', 'Zona de Produtos 1']))
      .toBe('Zona de Produtos 2')
  })

  it('numero invalido (0/negativo): nao adiciona ao set', () => {
    expect(getNextProductZoneIndexName([
      'Zona de Produtos 0', 'Zona de Produtos -1', 'Zona de Produtos 2'
    ])).toBe('Zona de Produtos 1')
  })

  it('lista com gap depois de muitos: pula corretamente', () => {
    expect(getNextProductZoneIndexName([
      'Zona de Produtos 1', 'Zona de Produtos 2', 'Zona de Produtos 4'
    ])).toBe('Zona de Produtos 3')
  })

  it('lista contigua: continua na sequencia', () => {
    expect(getNextProductZoneIndexName([
      'Zona de Produtos 1', 'Zona de Produtos 2', 'Zona de Produtos 3'
    ])).toBe('Zona de Produtos 4')
  })
})

describe('ensureZoneNamesDistinct', () => {
  it('lista vazia/null: no-op', () => {
    expect(() => ensureZoneNamesDistinct([])).not.toThrow()
    expect(() => ensureZoneNamesDistinct(null as any)).not.toThrow()
  })

  it('zonas sem zoneName: atribui defaults sequenciais', () => {
    const z1: any = {}
    const z2: any = {}
    const z3: any = {}
    ensureZoneNamesDistinct([z1, z2, z3])
    expect(z1.zoneName).toBe('Zona de Produtos 1')
    expect(z2.zoneName).toBe('Zona de Produtos 2')
    expect(z3.zoneName).toBe('Zona de Produtos 3')
  })

  it('preserva nomes customizados existentes', () => {
    const z1: any = { zoneName: 'Minha Zona' }
    const z2: any = {}
    ensureZoneNamesDistinct([z1, z2])
    expect(z1.zoneName).toBe('Minha Zona')
    expect(z2.zoneName).toBe('Zona de Produtos 1')
  })

  it('renomeia duplicatas customizadas (mantem primeira)', () => {
    const z1: any = { zoneName: 'Minha Zona' }
    const z2: any = { zoneName: 'Minha Zona' }
    ensureZoneNamesDistinct([z1, z2])
    expect(z1.zoneName).toBe('Minha Zona')
    expect(z2.zoneName).toBe('Zona de Produtos 1')
  })

  it('default names tratados como "trocaveis": atribuidos sequencialmente na ordem', () => {
    // Pass 1 IGNORA defaults (nao reserva). Pass 2 atribui novos defaults
    // partindo de N=1 — entao z1 vira "1", z2 vira "2", etc.
    const z1: any = { zoneName: 'Zona de Produtos 1' }
    const z2: any = {}
    const z3: any = {}
    ensureZoneNamesDistinct([z1, z2, z3])
    expect(z1.zoneName).toBe('Zona de Produtos 1')
    expect(z2.zoneName).toBe('Zona de Produtos 2')
    expect(z3.zoneName).toBe('Zona de Produtos 3')
  })

  it('case-insensitive na deteccao de duplicatas', () => {
    const z1: any = { zoneName: 'minha zona' }
    const z2: any = { zoneName: 'MINHA ZONA' }
    ensureZoneNamesDistinct([z1, z2])
    expect(z1.zoneName).toBe('minha zona')
    expect(z2.zoneName).toBe('Zona de Produtos 1')
  })

  it('whitespace-only e tratado como vazio', () => {
    const z1: any = { zoneName: '   ' }
    ensureZoneNamesDistinct([z1])
    expect(z1.zoneName).toBe('Zona de Produtos 1')
  })

  it('ordem de iteracao do array determina prioridade', () => {
    const z1: any = { zoneName: 'A' }
    const z2: any = { zoneName: 'A' }
    ensureZoneNamesDistinct([z2, z1])
    expect(z2.zoneName).toBe('A')        // primeira na lista mantem
    expect(z1.zoneName).toBe('Zona de Produtos 1')
  })
})
