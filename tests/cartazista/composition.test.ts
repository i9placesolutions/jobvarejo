import { describe, expect, it } from 'vitest'
import { CARTAZISTA_FORMATS } from '~/types/cartazista'
import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'
import {
  applyCartazistaProduct,
  createCartazistaDocument,
  parseCartazistaProductList
} from '~/utils/cartazista/composition'

describe('cartazista composition', () => {
  it('mantém o catálogo funcional com os quatorze modelos do fluxo de cartazes', () => {
    expect(CARTAZISTA_STARTER_MODELS).toHaveLength(14)
    expect(CARTAZISTA_STARTER_MODELS.map((model) => model.id)).toContain('wholesale-retail')
    expect(CARTAZISTA_STARTER_MODELS.map((model) => model.id)).toContain('leve-3-2')
  })

  it('interpreta uma lista de produtos com preço brasileiro e preço anterior', () => {
    const products = parseCartazistaProductList([
      'ARROZ CAMIL 5KG 29,99',
      'FEIJÃO KICALDO 1KG R$ 12,99 por R$ 9,99',
      'BANANA PRATA KG 5.99'
    ].join('\n'))

    expect(products).toHaveLength(3)
    expect(products[0]).toMatchObject({ name: 'ARROZ CAMIL 5KG', price: 29.99 })
    expect(products[1]).toMatchObject({ name: 'FEIJÃO KICALDO 1KG', oldPrice: 12.99, price: 9.99 })
    expect(products[2]).toMatchObject({ name: 'BANANA PRATA KG', price: 5.99 })
  })

  it('gera formatos A1-A7 e atualiza o preço sem perder as camadas editáveis', () => {
    const document = createCartazistaDocument({ modelId: 'de-por-discount', formatId: 'a3' })
    const updated = applyCartazistaProduct(
      document.composition,
      document.modelId,
      { ...document.products[0]!, name: 'CAFÉ ESPECIAL', price: 8.99, oldPrice: 12.99 },
      document.settings,
      document.themeId
    )

    expect(CARTAZISTA_FORMATS.map((format) => format.id)).toEqual(['a1', 'a2', 'a3', 'a5', 'a6', 'a7'])
    expect(updated.layers.find((layer) => layer.id === 'cartaz-product-name')?.text).toBe('CAFÉ ESPECIAL')
    expect(updated.layers.find((layer) => layer.id === 'cartaz-price')?.text).toContain('8,99')
    expect(updated.layers.find((layer) => layer.id === 'cartaz-old-price')?.visible).toBe(true)
    expect(updated.layers.some((layer) => layer.id === 'cartaz-logo')).toBe(true)
  })
})
