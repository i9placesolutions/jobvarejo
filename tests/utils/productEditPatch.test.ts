import { expect, it } from 'vitest'
import { hasProductPricingChanges, preserveUneditedProductData } from '../../utils/productEditPatch'
it('alterar somente limite mantém preço simples e todos os dados de imagem', () => {
  const current = { price: '5,49', priceUnit: '5,49', imageUrl: 'leite.png', autoFillImages: true, imageFillCount: 2 }
  const fields = new Set(['limit'])
  const result = preserveUneditedProductData(current, { priceCount: 4, pricePack: '5,49', priceWholesale: null, limit: 'LIMITE 12 UN POR CLIENTE', limitText: 'LIMITE 12 UN POR CLIENTE', alcoholBadgeEnabled: false }, fields)
  expect(hasProductPricingChanges(fields)).toBe(false)
  expect(result).toEqual({ ...current, limit: 'LIMITE 12 UN POR CLIENTE', limitText: 'LIMITE 12 UN POR CLIENTE' })
})
it('alterar somente selo preserva limite e não migra preços', () => {
  expect(preserveUneditedProductData({ price: '5,49', limit: 'LIMITE 12 UN' }, { priceCount: 4, alcoholBadgeEnabled: true }, new Set(['alcoholBadgeEnabled'])))
    .toEqual({ price: '5,49', limit: 'LIMITE 12 UN', alcoholBadgeEnabled: true })
})
it('mudança explícita de preço permite atualizar a etiqueta', () => {
  expect(hasProductPricingChanges(new Set(['pricePack']))).toBe(true)
  expect(hasProductPricingChanges(new Set(['priceCount']))).toBe(true)
})
