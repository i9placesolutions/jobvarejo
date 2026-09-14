import { expect, it } from 'vitest'
import { syncProductPriceFromText } from '../../utils/productPriceTextSync'
it.each([
  ['retail_price_text', '28,92', 'pricePack', '28,92'],
  ['retail_price_text', '1.234', 'pricePack', '1234,00'],
  ['wholesale_price_text', '27,96', 'priceSpecial', '27,96'],
  ['retail_pack_line_text', 'UNID R$ 2,41', 'priceUnit', '2,41'],
  ['wholesale_pack_line_text', 'UNID R$ 2,33', 'priceSpecialUnit', '2,33']
])('persiste edição inline de %s no produto serializado', (name,text,field,value) => {
  const card:any = { isProductCard: true, _productData: { pricePack:'10,00', showCensored:true, packageLabel:'FARDO' } }
  expect(syncProductPriceFromText({name,text,group:{group:card}})).toBe(true)
  const restored=JSON.parse(JSON.stringify(card))
  expect(restored._productData[field]).toBe(value)
  expect(restored._productData.showCensored).toBe(true)
  expect(restored._productData.packageLabel).toBe('FARDO')
})
it('não sobrescreve dados com digitação incompleta nem texto sem vínculo', () => {
  const card:any={isProductCard:true,_productData:{pricePack:'28,92'}}
  expect(syncProductPriceFromText({name:'retail_price_text',text:'28,',group:card})).toBe(false)
  expect(card._productData.pricePack).toBe('28,92')
  expect(syncProductPriceFromText({name:'retail_price_text',text:'29,99'})).toBe(false)
})
