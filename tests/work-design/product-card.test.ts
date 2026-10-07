import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric/node'
import { createCanvas } from 'canvas'
import { createWorkProductCard } from '../../workers/work-design/product-card'
import { productDesignSchema } from '../../shared/work-design'
import { applyRichPriceTextValue } from '../../utils/priceRichText'

const photo = createCanvas(120, 80), context = photo.getContext('2d')
context.fillStyle = '#883322'; context.fillRect(0, 0, 120, 80)
const product = { id: crypto.randomUUID(), name: 'Produto confirmado', price: '48,99', unit: 'kg', imageDataUrl: photo.toDataURL() }
const design = () => productDesignSchema.parse({ image: { x: 30, y: 10, width: 240, height: 150 },
  name: { box: { x: 20, y: 175, width: 260, height: 40 }, style: { fontSize: 20, color: '#FFFFFF', fontFamily: 'Barlow', align: 'center' } },
  price: { box: { x: 35, y: 235, width: 230, height: 95 }, style: { fontSize: 70, color: '#FFFFFF', fontFamily: 'Oswald', align: 'right' } },
  decorations: [{ kind: 'polygon', color: '#223366', box: { x: 0, y: 220, width: 300, height: 120 },
    points: [{ x: 0, y: .1 }, { x: 1, y: 0 }, { x: .95, y: 1 }, { x: .05, y: 1 }] }] })
const descendants = (object: any): any[] => [object, ...(object.getObjects?.() || []).flatMap(descendants)]
describe('composição própria de produto Work', () => {
  it('preserva foto, valores, unidade e geometria escolhida, sem forçar fundo de card', async () => {
    const card = await createWorkProductCard(fabric, product, { left: 10, top: 20, width: 300, height: 350 }, design(), {}, 'zone')
    const objects = descendants(card)
    expect(objects.find(o => o.name === 'card_bg').fill).toBe('transparent')
    expect(objects.some(o => o.type.toLowerCase() === 'polygon')).toBe(true)
    expect(objects.find(o => o.name === 'smart_image').scaleX).toBe(objects.find(o => o.name === 'smart_image').scaleY)
    expect(objects.find(o => o.name === 'smart_title').text).toBe(product.name)
    expect(objects.find(o => o.name === 'price_value_text').text).toBe(product.price)
    expect(objects.find(o => o.name === 'price_unit_text').text).toBe('kg')
    const price = objects.find(o => o.name === 'priceGroup')
    expect(price.width).toBeCloseTo(230, 0); expect(price.height).toBeCloseTo(95, 0)
    expect(card.width).toBeCloseTo(300, 0); expect(card.height).toBeCloseTo(350, 0)
  })
  it('mantém preços editáveis e recupera os objetos depois de serializar', async () => {
    const card = await createWorkProductCard(fabric, product, { left: 0, top: 0, width: 300, height: 350 }, design(), {}, 'zone')
    const keys = ['name', 'isProductCard', '_productData', '__preserveManualLayout', '__manualTransform', '__manualTypography',
      '__priceRichText', '__priceRichIntegerStyle', '__priceRichDecimalStyle']
    const [restored] = await fabric.util.enlivenObjects([card.toObject(keys)])
    const value = descendants(restored).find(o => o.name === 'price_value_text')
    expect(value.__priceRichText).toBe(true); expect(value.__manualTypography).toBe(true)
    applyRichPriceTextValue(value, '9,90'); expect(value.text).toBe('9,90')
    expect(descendants(restored).find(o => o.name === 'smart_title').type.toLowerCase()).toBe('textbox')
  })
})
