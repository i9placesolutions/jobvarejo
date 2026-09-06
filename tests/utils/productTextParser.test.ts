import { describe, expect, it } from 'vitest'
import {
  parseProductsAuto,
  parseProductsFromFreeText,
  parseProductsFromTable
} from '~/server/utils/product-text-parser'

describe('product-text-parser', () => {
  it('mapeia quatro precos em texto livre sem perder a semantica', () => {
    const [product] = parseProductsFromFreeText('ARROZ TIPO 1 1KG 37,50 6,25 34,98 5,83')

    expect(product).toMatchObject({
      name: 'ARROZ TIPO 1 1KG',
      pricePack: '37,50',
      priceUnit: '6,25',
      priceSpecial: '34,98',
      priceSpecialUnit: '5,83',
      price: '6,25'
    })
  })

  it('mapeia as quatro colunas explicitas de uma tabela', () => {
    const [product] = parseProductsFromTable([
      'PRODUTO;EMBALAGEM;QUANT. EMBA;PREÇO CX;PREÇO UND;PREÇO CX ESPECIAL;PREÇO UND ESPECIAL;OBS',
      'ARROZ TIPO 1;FD;6;37,50;6,25;34,98;5,83;ACIMA DE 4 FD'
    ].join('\n'))

    expect(product).toMatchObject({
      name: 'ARROZ TIPO 1',
      packageLabel: 'FD',
      packQuantity: 6,
      pricePack: '37,50',
      priceUnit: '6,25',
      priceSpecial: '34,98',
      priceSpecialUnit: '5,83',
      specialCondition: 'ACIMA DE 4 FD'
    })
  })

  it('mantem os quatro precos no dispatcher automatico', () => {
    const [product] = parseProductsAuto([
      'PRODUTO;EMBALAGEM;QUANT. EMBA;PREÇO CX;PREÇO UND;PREÇO CX ESPECIAL;PREÇO UND ESPECIAL',
      'ARROZ TIPO 1;FD;6;37,50;6,25;34,98;5,83'
    ].join('\n'))

    expect(product).toMatchObject({
      pricePack: '37,50',
      priceUnit: '6,25',
      priceSpecial: '34,98',
      priceSpecialUnit: '5,83'
    })
  })

  it('remove o hifen que separa o nome do preco em texto livre', () => {
    const products = parseProductsFromFreeText([
      'BATATA – 4.99',
      'MAÇA NACIONAL — 8,99',
      'COCA-COLA 6,99'
    ].join('\n'))

    expect(products.map(product => product.name)).toEqual([
      'BATATA',
      'MAÇA NACIONAL',
      'COCA-COLA'
    ])
  })

  it('remove o hifen residual de nomes vindos de tabela', () => {
    const [product] = parseProductsFromTable([
      'PRODUTO;PREÇO',
      'BATATA –;4,99'
    ].join('\n'))

    expect(product?.name).toBe('BATATA')
  })
})
