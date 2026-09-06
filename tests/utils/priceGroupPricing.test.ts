import { describe, expect, it } from 'vitest'
import { createPriceGroupPricing } from '~/utils/priceGroupPricing'
import { getAvailablePrices, getSpecialConditionFromProduct } from '~/utils/productPriceHelpers'
import {
  computePackLine,
  formatCentsToPrice,
  formatPriceValue,
  inferUnitLabelFromProduct,
  parsePriceToCents,
  splitPriceParts
} from '~/utils/priceTagText'

const makeObject = (name: string, text = '') => ({
  name,
  text,
  visible: true,
  set(key: string | Record<string, any>, value?: any) {
    if (typeof key === 'string') (this as any)[key] = value
    else Object.assign(this, key)
  },
  initDimensions() {},
  setCoords() {}
})

const makeGroup = () => {
  const objects = [
    makeObject('atac_retail_bg'),
    makeObject('atac_banner_bg'),
    makeObject('atac_wholesale_bg'),
    makeObject('retail_currency_text', 'R$'),
    makeObject('retail_integer_text', '0'),
    makeObject('retail_decimal_text', ',00'),
    makeObject('retail_unit_text', 'UN'),
    makeObject('retail_pack_line_text'),
    makeObject('wholesale_banner_text', 'ATACADO'),
    makeObject('wholesale_currency_text', 'R$'),
    makeObject('wholesale_integer_text', '0'),
    makeObject('wholesale_decimal_text', ',00'),
    makeObject('wholesale_unit_text', 'UN'),
    makeObject('wholesale_pack_line_text')
  ]
  return {
    objects,
    group: {
      getObjects: () => objects,
      setCoords() {},
      set() {},
      dirty: false
    }
  }
}

const createDeps = () => createPriceGroupPricing({
  applyFardoSpecialPricingToPriceGroup: () => {},
  migratePriceGroupToRichText: () => {},
  applyRichPriceTextValue: (object, rawPrice) => {
    object.text = String(rawPrice ?? '')
    return object.text
  },
  collectObjectsDeep: (group) => group.getObjects(),
  repairAtacarejoTextNames: () => {},
  findByName: (objects, name) => objects.find((object) => object?.name === name),
  setVisible: (object, visible) => {
    if (object) object.visible = visible
  },
  getAvailablePrices,
  formatPriceValue,
  getSpecialConditionFromProduct,
  splitPriceParts,
  setText: (object, text) => {
    if (object) object.text = text
  },
  inferUnitLabelFromProduct,
  parsePriceToCents,
  formatCentsToPrice,
  computePackLine,
  shouldPreserveManualTemplateVisual: () => false,
  fitManualAtacarejoValuesIntoTemplate: () => {},
  safeAddWithUpdate: () => {}
})

describe('createPriceGroupPricing', () => {
  it('mantem os quatro precos explicitos nas duas faixas do atacarejo', () => {
    const { group, objects } = makeGroup()
    const applyPricing = createDeps().applyAtacarejoPricingToPriceGroup

    applyPricing(group, {
      priceUnit: '6,25',
      pricePack: '40,00',
      priceSpecialUnit: '5,83',
      priceSpecial: '35,00',
      packQuantity: 6,
      packUnit: 'UN',
      packageLabel: 'FARDO',
      unit: 'UN',
      specialCondition: 'ACIMA DE 4 FD'
    })

    const byName = (name: string) => objects.find((object) => object.name === name)!
    expect(byName('retail_integer_text').text).toBe('6')
    expect(byName('retail_decimal_text').text).toBe(',25')
    expect(byName('retail_pack_line_text').text).toBe('FARDO C/6UN: R$ 40,00')
    expect(byName('wholesale_integer_text').text).toBe('5')
    expect(byName('wholesale_decimal_text').text).toBe(',83')
    expect(byName('wholesale_pack_line_text').text).toBe('FARDO C/6UN: R$ 35,00')
    expect(byName('retail_pack_line_text').visible).toBe(true)
    expect(byName('wholesale_pack_line_text').visible).toBe(true)
  })

  it('calcula a linha somente quando nao existe preco explicito de embalagem', () => {
    const { group, objects } = makeGroup()
    const applyPricing = createDeps().applyAtacarejoPricingToPriceGroup

    applyPricing(group, {
      priceUnit: '6,25',
      priceSpecialUnit: '5,83',
      packQuantity: 6,
      packUnit: 'UN',
      packageLabel: 'FARDO',
      unit: 'UN'
    })

    const byName = (name: string) => objects.find((object) => object.name === name)!
    expect(byName('retail_pack_line_text').text).toBe('FARDO C/6UN: R$ 37,50')
    expect(byName('wholesale_pack_line_text').text).toBe('FARDO C/6UN: R$ 34,98')
  })
})
