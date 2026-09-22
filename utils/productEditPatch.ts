const pricingFields = new Set(['pricePack', 'priceUnit', 'priceSpecial', 'priceSpecialUnit', 'packageLabel', 'packQuantity', 'specialCondition', 'priceCount', 'showCensored'])
export const hasProductPricingChanges = (fields: Iterable<string>) => [...fields].some(field => pricingFields.has(field))

/** Alterações de limite/selo não normalizam nem migram o modelo de preço. */
export const preserveUneditedProductData = (current: Record<string, any>, proposed: Record<string, any>, fields: Set<string>) => {
  if (hasProductPricingChanges(fields)) return proposed
  return {
    ...current,
    ...(fields.has('limit') ? { limit: proposed.limit, limitText: proposed.limitText } : {}),
    ...(fields.has('alcoholBadgeEnabled') ? { alcoholBadgeEnabled: proposed.alcoholBadgeEnabled } : {})
  }
}
