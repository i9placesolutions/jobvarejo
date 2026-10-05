import { restoreLegacyManualPriceNames } from '../../utils/legacyManualPriceNames'
import { describe, expect, it } from 'vitest'
import * as fabric from 'fabric/node'
import { createManualProductCard } from '../../workers/whatsapp-creation/native-card'
import { isRedBurstPriceGroup } from '../../utils/redBurstTemplateRevive'
import legacyZonePriceGroup23 from '../fixtures/whatsapp-creation/legacy-zone-price-group-23.json'

const namedGroupJson = (children: Array<{ object: any; name: string }>) => {
  const group = new fabric.Group(children.map(item => item.object), { left: 0, top: 0, originX: 'center', originY: 'center' })
  const json = group.toObject() as any
  json.name = 'priceGroup'
  json.__preserveManualLayout = true
  json.__isCustomTemplate = true
  json.objects.forEach((node: any, index: number) => { node.name = children[index]?.name || '' })
  return json
}

const allObjects = (object: any): any[] => [object, ...(object.getObjects?.() || []).flatMap(allObjects)]

describe('cartão nativo do editor para render WhatsApp', () => {
  it('preserva a geometria authored de Red Burst e atualiza o preço pelo mesmo tuning compartilhado', async () => {
    const saved = namedGroupJson([
      { name: 'price_bg', object: new fabric.Rect({ width: 260, height: 110, fill: '#e11d48', left: 0, top: 25, originX: 'center', originY: 'center' }) },
      { name: 'price_header_bg', object: new fabric.Rect({ width: 220, height: 42, fill: '#111827', left: 0, top: -35, originX: 'center', originY: 'center' }) },
      { name: 'price_burst_line_a', object: new fabric.Rect({ width: 230, height: 5, fill: '#fff', left: 0, top: 0 }) },
      { name: 'price_header_text', object: new fabric.Text('OFERTA', { width: 140, fontSize: 26, fill: '#ffd94c', left: 12, top: -34, originX: 'center', originY: 'center' }) },
      { name: 'price_currency_text', object: new fabric.Text('R$', { fontSize: 24, fill: '#fff', left: -82, top: 30, originX: 'center', originY: 'center' }) },
      { name: 'price_integer_text', object: new fabric.IText('1', { fontSize: 68, fill: '#fff', left: -36, top: 24, originX: 'left', originY: 'center' }) },
      { name: 'price_decimal_text', object: new fabric.IText(',00', { fontSize: 34, fill: '#fff', left: 14, top: 10, originX: 'left', originY: 'center' }) }
    ])
    const originalHeaderLeft = saved.objects.find((node: any) => node.name === 'price_header_text').left
    const card = await createManualProductCard(fabric, { name: 'Arroz 5 kg', price: '19,90' }, 200, 200, 180, 260, 'grid', { id: 'red-burst', group: saved })
    const objects = allObjects(card)
    const priceGroup = objects.find(object => object.name === 'priceGroup')
    const header = allObjects(priceGroup).find(object => object.name === 'price_header_text')
    const value = allObjects(priceGroup).find(object => object.name === 'price_value_text')
    expect(allObjects(priceGroup).some(object => object.name === 'price_burst_line_a')).toBe(true)
    expect(isRedBurstPriceGroup(priceGroup)).toBe(true)
    expect(header.left).toBe(originalHeaderLeft)
    expect(value).toBeTruthy()
    expect(value.text).toContain('19')
    expect(value.text).toContain('90')
  }, 15000)

  it('substitui o preço de amostra no modelo 3D salvo com moeda de nome customizado', async () => {
    const saved = namedGroupJson([
      { name: 'splash_image', object: new fabric.Rect({ width: 182, height: 90, fill: '#111', left: 0, top: 0, originX: 'center', originY: 'center' }) },
      { name: 'price_integer_text', object: new fabric.IText('22', { fontSize: 42, fill: '#fff', left: -31, top: 4, originX: 'left', originY: 'center' }) },
      { name: 'price_decimal_text', object: new fabric.IText(',99', { fontSize: 24, fill: '#fff', left: 11, top: -2, originX: 'left', originY: 'center' }) },
      { name: 'custom_text_xhgf8', object: new fabric.IText('R$', { fontSize: 42, fill: '#fff', left: -40, top: 3, originX: 'left', originY: 'center' }) }
    ])
    const card = await createManualProductCard(fabric, { name: 'Mamão formosa', price: '4,99' }, 200, 200, 180, 260, 'grid', { id: 'legacy-3d', group: saved })
    const priceGroup = allObjects(card).find(object => object.name === 'priceGroup')
    const children = allObjects(priceGroup)
    const value = children.find(object => object.name === 'price_value_text')
    expect(value?.text).toBe('4,99')
    expect(children.some(object => String(object.text || '').includes('22,99'))).toBe(false)
  })

  it('aplica preço do produto no snapshot real sem nomes do primeiro slot da matriz 23', async () => {
    // Replica a seleção feita pelo worker: zonas por top/left, template pelo
    // splashTemplateId e snapshot da própria zona quando o ID não está no catálogo.
    const zones = [{
      top: 876,
      left: 748.0076,
      _zoneGlobalStyles: { splashTemplateId: 'sabado-vinho-normal-v1' },
      _zoneTemplateSnapshotId: 'sabado-vinho-normal-v1',
      _zoneTemplateSnapshot: legacyZonePriceGroup23
    }]
    zones.sort((a, b) => a.top - b.top || a.left - b.left)
    const templates: any[] = []
    const zone = zones[0]!
    const selectedTemplateId = zone._zoneGlobalStyles.splashTemplateId || zone._zoneTemplateSnapshotId
    const savedLabel = templates.find(template => template.id === selectedTemplateId)?.group || zone._zoneTemplateSnapshot
    const card = await createManualProductCard(fabric, { name: 'Mamão formosa', price: '4,99' }, 200, 200, 180, 260, 'grid', { id: selectedTemplateId, group: savedLabel })
    const priceGroup = allObjects(card).find(object => object.name === 'priceGroup')
    const children = allObjects(priceGroup)
    const value = children.find(object => object.name === 'price_value_text')
    expect(value?.text).toBe('4,99')
    expect(children.find(object => object.name === 'price_currency_text')?.text).toBe('R$')
    expect(children.some(object => String(object.text || '').includes('22,99'))).toBe(false)
  })

  it('preenche varejo, atacado e condição nos tiers do template sem descartar os campos comerciais', async () => {
    const saved = namedGroupJson([
      { name: 'atac_retail_bg', object: new fabric.Rect({ width: 120, height: 76, fill: '#fff', left: -65, top: 0, originX: 'center', originY: 'center' }) },
      { name: 'atac_banner_bg', object: new fabric.Rect({ width: 260, height: 26, fill: '#111', left: 0, top: -55, originX: 'center', originY: 'center' }) },
      { name: 'atac_wholesale_bg', object: new fabric.Rect({ width: 120, height: 76, fill: '#fde047', left: 65, top: 0, originX: 'center', originY: 'center' }) },
      { name: 'retail_currency_text', object: new fabric.Text('R$', { fontSize: 12, text: 'R$', left: -90, top: 0 }) },
      { name: 'retail_integer_text', object: new fabric.IText('0', { fontSize: 28, text: '0', left: -70, top: 0 }) },
      { name: 'retail_decimal_text', object: new fabric.IText(',00', { fontSize: 16, text: ',00', left: -52, top: 0 }) },
      { name: 'retail_unit_text', object: new fabric.Text('UN', { fontSize: 10, text: 'UN', left: -45, top: 30 }) },
      { name: 'wholesale_banner_text', object: new fabric.Text('ATACADO', { fontSize: 12, text: 'ATACADO', left: -45, top: -55 }) },
      { name: 'wholesale_currency_text', object: new fabric.Text('R$', { fontSize: 12, text: 'R$', left: 30, top: 0 }) },
      { name: 'wholesale_integer_text', object: new fabric.IText('0', { fontSize: 28, text: '0', left: 48, top: 0 }) },
      { name: 'wholesale_decimal_text', object: new fabric.IText(',00', { fontSize: 16, text: ',00', left: 66, top: 0 }) },
      { name: 'wholesale_unit_text', object: new fabric.Text('UN', { fontSize: 10, text: 'UN', left: 70, top: 30 }) }
    ])
    const product = { name: 'Leite integral 1 L', price: '6,49', priceUnit: '6,49', priceSpecialUnit: '5,99', priceWholesale: '5,99', specialCondition: 'ACIMA DE 3 UNIDADES' }
    const card = await createManualProductCard(fabric, product, 200, 200, 180, 260, 'grid', { id: 'two-prices', group: saved })
    const objects = allObjects(card)
    const priceGroup = objects.find(object => object.name === 'priceGroup')
    const prices = allObjects(priceGroup)
    expect(prices.find(object => object.name === 'retail_price_text')?.text).toContain('6')
    expect(prices.find(object => object.name === 'wholesale_price_text')?.text).toContain('5')
    expect(prices.find(object => object.name === 'wholesale_banner_text')?.text).toContain('ACIMA 3 UN')
    expect(card.priceUnit).toBe('6,49')
    expect(card.priceSpecialUnit).toBe('5,99')
    expect(card.specialCondition).toBe('ACIMA DE 3 UNIDADES')
  })

  it('mantém pack, unitário, especial e atacado no modelo de atacarejo por fardo', async () => {
    const saved = namedGroupJson([
      { name: 'atac_retail_bg', object: new fabric.Rect({ width: 120, height: 76, fill: '#fff', left: -65, top: 0, originX: 'center', originY: 'center' }) },
      { name: 'atac_banner_bg', object: new fabric.Rect({ width: 260, height: 26, fill: '#111', left: 0, top: -55, originX: 'center', originY: 'center' }) },
      { name: 'atac_wholesale_bg', object: new fabric.Rect({ width: 120, height: 76, fill: '#fde047', left: 65, top: 0, originX: 'center', originY: 'center' }) },
      { name: 'retail_currency_text', object: new fabric.Text('R$', { fontSize: 12, left: -90, top: 0 }) },
      { name: 'retail_integer_text', object: new fabric.IText('0', { fontSize: 28, left: -70, top: 0 }) },
      { name: 'retail_decimal_text', object: new fabric.IText(',00', { fontSize: 16, left: -52, top: 0 }) },
      { name: 'retail_unit_text', object: new fabric.Text('UN', { fontSize: 10, left: -45, top: 30 }) },
      { name: 'retail_pack_line_text', object: new fabric.Text('', { fontSize: 8, left: -80, top: 38 }) },
      { name: 'wholesale_banner_text', object: new fabric.Text('ATACADO', { fontSize: 12, left: -45, top: -55 }) },
      { name: 'wholesale_currency_text', object: new fabric.Text('R$', { fontSize: 12, left: 30, top: 0 }) },
      { name: 'wholesale_integer_text', object: new fabric.IText('0', { fontSize: 28, left: 48, top: 0 }) },
      { name: 'wholesale_decimal_text', object: new fabric.IText(',00', { fontSize: 16, left: 66, top: 0 }) },
      { name: 'wholesale_unit_text', object: new fabric.Text('UN', { fontSize: 10, left: 70, top: 30 }) },
      { name: 'wholesale_pack_line_text', object: new fabric.Text('', { fontSize: 8, left: 30, top: 38 }) }
    ])
    saved.__atacarejoLabelVariant = 'fardo-special-v1'
    const product = {
      name: 'Leite integral', offerFormat: 'wholesale-pack-v1', packageLabel: 'CX', packQuantity: 12, packUnit: 'UN',
      pricePack: '61,80', priceUnit: '5,15', priceSpecial: '59,88', priceSpecialUnit: '4,99', specialCondition: 'ACIMA DE 2 CAIXAS'
    }
    const card = await createManualProductCard(fabric, product, 200, 200, 180, 260, 'grid', { id: 'fardo-real', group: saved })
    const priceGroup = allObjects(card).find(object => object.name === 'priceGroup')
    const prices = allObjects(priceGroup)
    expect(prices.find(object => object.name === 'retail_pack_line_text')?.text).toContain('5,15')
    expect(prices.find(object => object.name === 'wholesale_pack_line_text')?.text).toContain('4,99')
    expect(prices.find(object => object.name === 'wholesale_banner_text')?.text).toContain('ACIMA DE 2 CAIXAS')
    expect(card.pricePack).toBe('61,80')
    expect(card.priceUnit).toBe('5,15')
    expect(card.priceSpecial).toBe('59,88')
    expect(card.priceSpecialUnit).toBe('4,99')
  })

  it('usa o builder atacarejo real do Quick Editor quando não há etiqueta escolhida', async () => {
    const card = await createManualProductCard(fabric, {
      name: 'Café 500 g', priceUnit: '18,90', priceSpecialUnit: '17,90', specialCondition: 'ACIMA DE 2 UNIDADES'
    }, 200, 200, 180, 260, 'grid')
    const prices = allObjects(card).find(object => object.name === 'priceGroup')
    const tierTexts = allObjects(prices)
    expect(tierTexts.find(object => object.name === 'retail_price_text')?.text).toContain('18')
    expect(tierTexts.find(object => object.name === 'wholesale_price_text')?.text).toContain('17')
    expect(tierTexts.find(object => object.name === 'wholesale_banner_text')?.text).toContain('ACIMA 2 UN')
  })
})

it('identifica os centavos legados pelo separador, inclusive em ordem invertida', () => {
  for (const texts of [['4', ',99'], [',99', '4'], ['99', '4,']]) {
    const objects = texts.map(text => ({text, type: 'text', fontSize: 30, set(key: string, value: string) { (this as any)[key] = value } }))
    expect(restoreLegacyManualPriceNames({getObjects: () => objects}, (o: any) => o.type === 'text')).toBe(true)
    expect(objects.find((o: any) => o.name === 'price_integer_text')?.text).toMatch(/^4/)
    expect(objects.find((o: any) => o.name === 'price_decimal_text')?.text).toMatch(/99$/)
  }
})
