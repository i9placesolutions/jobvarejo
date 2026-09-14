/** A edição inline precisa atualizar a mesma fonte usada pelo modal e pelo reload. */
export const syncProductPriceFromText = (target: any): boolean => {
  const fields: Record<string, string> = {
    retail_price_text: 'pricePack',
    wholesale_price_text: 'priceSpecial',
    retail_pack_line_text: 'priceUnit',
    wholesale_pack_line_text: 'priceSpecialUnit'
  }
  const field = fields[target?.name]
  if (!field) return false
  const raw = String(target.text ?? '').trim().replace(/^UNID\s*/i, '').replace(/^R\$\s*/, '').trim()
  // Não persistir entradas parciais como "28," durante a digitação.
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw) && !/^\d+\.\d{1,2}$/.test(raw)) return false
  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)
  const value = Number(raw.includes(',') || grouped ? raw.replace(/\./g, '').replace(',', '.') : raw)
  if (!Number.isFinite(value) || value < 0) return false
  let card = target.group
  const visited = new Set()
  while (card && !visited.has(card)) {
    visited.add(card)
    if (card._productData && (card.isProductCard || card.isSmartObject)) break
    card = card.group
  }
  if (!card?._productData) return false
  const formatted = value.toFixed(2).replace('.', ',')
  if (card._productData[field] === formatted) return false
  card._productData = { ...card._productData, [field]: formatted }
  // Campos legados diretos não podem vencer o valor recém-editado.
  if (field in card) card[field] = formatted
  card.dirty = true
  return true
}
