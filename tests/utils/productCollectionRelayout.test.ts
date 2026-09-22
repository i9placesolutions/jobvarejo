import { describe, it, expect } from 'vitest'
import { prepareProductCollectionRelayout } from '../../utils/productCollectionRelayout'

describe('recomposição após alteração da lista', () => {
  it('reaplica layout sem alterar preço, imagem ou arte interna da etiqueta', () => {
    const value = { name: 'price_value_text', __manualTransform: true, text: '19,99' }
    const price = { name: 'priceGroup', __manualPricePosition: true, getObjects: () => [value] }
    const title = { name: 'smart_title', __manualTransform: true }
    const data = { name: 'LEITE', price: '19,99', imageUrl: 'produto.png', titleTextWidth: 50 }
    const card = { _zoneOrder: 9, _productData: data, getObjects: () => [title, price] }
    prepareProductCollectionRelayout([card])
    expect(title.__manualTransform).toBeUndefined()
    expect(price.__manualPricePosition).toBeUndefined()
    expect(value.__manualTransform).toBe(true)
    expect(card._productData).toMatchObject({ name: 'LEITE', price: '19,99', imageUrl: 'produto.png' })
    expect(card._productData.titleTextWidth).toBeUndefined()
    expect(card._zoneOrder).toBe(0)
  })
  it('descarta quantidade antiga e recalcula como uma inserção nova', () => {
    const create = () => ({ _productData: { name: 'ARROZ' }, getObjects: () => [
      { type: 'image', name: 'smart_image', __manualTransform: true },
      { type: 'image', name: 'extra_image_1', __manualTransform: true }
    ] })
    const a = create(), b = create()
    prepareProductCollectionRelayout([a, b])
    prepareProductCollectionRelayout([b])
    const fresh = create()
    prepareProductCollectionRelayout([fresh])
    expect(b._productData).toEqual(fresh._productData)
    expect(b._productData).toMatchObject({ autoFillImages: true })
    expect((b._productData as any).imageFillCount).toBeUndefined()
  })
})

 it('remove cópias com dimensões divergentes e libera o plano automático', () => {
   const images: any[] = [{ type: 'image', name: 'smart_image', width: 100 }, { type: 'image', name: 'extra_image_1', width: 300 }]
   const card: any = { _productData: { autoFillImages: true, imageFillCount: 2, imageFillDirection: 'vertical' }, getObjects: () => images, remove: (image: any) => images.splice(images.indexOf(image), 1) }
   prepareProductCollectionRelayout([card])
   expect(images).toHaveLength(1)
   expect(images[0].width).toBe(100)
   expect(card._productData.imageFillCount).toBeUndefined()
   expect(card._productData.imageFillDirection).toBeUndefined()
 })
