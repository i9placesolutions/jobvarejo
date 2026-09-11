import { describe, expect, it } from 'vitest'
import { extractPurchaseLimit } from '../../utils/productPurchaseLimit'
import { extractLimitFromName } from '../../utils/productTextNormalize'
import { parseProductsFromFreeText, parseProductsFromTable } from '../../server/utils/product-text-parser'

describe('limite dentro da descrição', () => {
  it.each([
    ['(03 POR CLIENTE)', 'LIMITE 3 UN POR CLIENTE'],
    ['LIMITADO 5UN POR CLIENTE', 'LIMITE 5 UN POR CLIENTE'],
    ['LIMTE 04KG POR CPF', 'LIMITE 4 KG POR CPF'],
    ['(LIMITE 4 KG POR CPF)', 'LIMITE 4 KG POR CPF'],
    ['LIMITADO A 2 UNIDADES POR PESSOA', 'LIMITE 2 UN POR PESSOA'],
    ['ATÉ 2 KG POR CPF', 'LIMITE 2 KG POR CPF'],
  ])('separa %s do produto sem alterar peso ou preço', (input, limit) => {
    const name = `ARROZ CRISTAL 5KG ${input}`
    expect(extractPurchaseLimit(name)).toEqual({ rest: 'ARROZ CRISTAL 5KG', limit })
    expect(extractLimitFromName(name)).toEqual({ cleanedName: 'ARROZ CRISTAL 5KG', extractedLimit: limit })
    expect(parseProductsFromFreeText(`${name} 19,99`)[0]).toMatchObject({ name: 'ARROZ CRISTAL 5KG', limit, price: '19,99' })
    expect(parseProductsFromTable(`PRODUTO;PREÇO\n${name};19,99`)[0]).toMatchObject({ name: 'ARROZ CRISTAL 5KG', limit })
  })

  it.each(['ARROZ 5KG', 'REFRIGERANTE C/ 6 UNIDADES', 'ACIMA DE 3 CAIXAS', 'EDIÇÃO LIMITADA 500G'])('preserva descrição sem limite: %s', name => {
    expect(extractPurchaseLimit(name)).toEqual({ rest: name, limit: null })
  })

  it('associa a segunda linha da descrição somente ao produto anterior', () => {
    const products = parseProductsFromFreeText('ARROZ CRISTAL 5KG 19,99\n(03 POR CLIENTE)\nFEIJÃO 1KG 5,99')
    expect(products).toHaveLength(2)
    expect(products[0]).toMatchObject({ name: 'ARROZ CRISTAL 5KG', limit: 'LIMITE 3 UN POR CLIENTE', price: '19,99' })
    expect(products[1]).toMatchObject({ name: 'FEIJÃO 1KG', limit: null, price: '5,99' })
  })
})
