import { getAvailablePrices } from './productPriceHelpers'
import { formatPriceValue } from './priceTagText'
import { isAtacarejoTemplateGroupJson } from './canvasJsonClassifiers'

export const productNeedsMultiPriceLabel = (product: any): boolean => {
  const available = getAvailablePrices(product)
  if (product?.offerFormat === 'wholesale-pack-v1') return true
  const hasMain = available.prices.some(price => price.type === 'main' || price.type === 'pack')
  return (available.hasSpecial && hasMain) || !!available.condition || !!formatPriceValue(product?.priceWholesale)
}

/** Não oferecer uma etiqueta que descarte o preço da embalagem ou o unitário. */
export const isProductLabelTemplateCompatible = (product: any, template: any): boolean => {
  if (!template?.group) return false
  const multi = isAtacarejoTemplateGroupJson(template.group) || (product?.offerFormat !== 'wholesale-pack-v1' && /atacarejo|atacado|varejo|fardo|multi.?pre[cç]o/i.test(`${template.id || ''} ${template.name || ''}`))
  if (multi !== productNeedsMultiPriceLabel(product)) return false
  if (!multi || product?.offerFormat !== 'wholesale-pack-v1') return true
  const names = new Set<string>()
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (node.name) names.add(node.name)
    for (const child of node.objects || []) visit(child)
  }
  visit(template.group)
  const hasPair = (unit: any, pack: any) => {
    const u = formatPriceValue(unit)
    const p = formatPriceValue(pack)
    return !!u && !!p && u !== p
  }
  const hasPackaging = !!product?.packageLabel || Number(product?.packQuantity) > 1
  if (hasPackaging) {
    const retail = formatPriceValue(product?.pricePack) || formatPriceValue(product?.priceUnit) || formatPriceValue(product?.price)
    const special = formatPriceValue(product?.priceSpecial) || formatPriceValue(product?.priceSpecialUnit) || formatPriceValue(product?.priceWholesale)
    if (retail && !names.has('retail_pack_line_text')) return false
    if (special && !names.has('wholesale_pack_line_text')) return false
  }
  if (hasPair(product?.priceUnit, product?.pricePack) && !names.has('retail_pack_line_text')) return false
  if (hasPair(product?.priceSpecialUnit, product?.priceSpecial) && !names.has('wholesale_pack_line_text')) return false
  return true
}
