import { describe, expect, it } from 'vitest'
import { parseProductsAuto, parseProductsFromFreeText, parseProductsFromTable } from '../../server/utils/product-text-parser'

describe('peso decimal não vira preço', () => {
  it.each(['1,01KG', '1,01 KG', '1.01kg', '1,50L', '0,75 LT', '250,00G'])('mantém %s na descrição e somente o preço informado', weight => {
    const name = `TEMPERO COMPLETO ZAELI SABORES ${weight}`
    const [product] = parseProductsFromFreeText(`${name}\t\t\t11,99`)
    expect(product).toMatchObject({ name, price: '11,99', priceSpecial: null, priceSpecialUnit: null })
  })
  it('reproduz a entrada enviada pelo usuário no parser automático', () => {
    const [product] = parseProductsAuto('TEMPERO COMPLETO ZAELI SABORES 1,01KG\t\t\t11,99')
    expect(product).toMatchObject({ name: 'TEMPERO COMPLETO ZAELI SABORES 1,01KG', price: '11,99', priceSpecial: null })
  })
  it.each(['R$ 11,99 KG', '11,99/KG'])('preserva preço por peso explícito: %s', price => {
    expect(parseProductsFromFreeText(`CARNE ${price}`)[0]).toMatchObject({ name: 'CARNE', price: '11,99' })
  })
  it('não inventa preço quando a linha contém somente descrição e peso', () => {
    expect(parseProductsFromFreeText('TEMPERO ZAELI 1,01KG')).toEqual([])
  })
  it('não usa a coluna PESO como preço quando o preço está vazio', () => {
    const [product] = parseProductsFromTable('PRODUTO;PESO;PREÇO\nTEMPERO ZAELI;1,01KG;')
    expect(product).toMatchObject({ weight: '1,01KG', price: null, priceUnit: null })
  })
})
