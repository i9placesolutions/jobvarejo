import { formatPriceValue, parsePriceToCents } from './priceTagText'
import type { FardoSpecialPriceState, FardoSpecialPriceTier } from './fardoSpecialPriceHelpers'

/** Formato da planilha atacadista: independente dos formatos anteriores. */
export const resolveWholesalePackPriceState = (product: any): FardoSpecialPriceState => {
  const aliases: Record<string, string> = { CX: 'CAIXA', FD: 'FARDO', PCT: 'PACOTE', UN: 'UNIDADE', UND: 'UNIDADE' }
  const rawLabel = String(product?.packageLabel || '').trim().toUpperCase()
  const label = aliases[rawLabel] || rawLabel
  const quantity = Number(product?.packQuantity)
  const packaging = label && Number.isInteger(quantity) && quantity > 1 ? `${label} C/ ${quantity} UNIDADES` : label
  const tier = (pack: unknown, unit: unknown, fallback?: unknown): FardoSpecialPriceTier => {
    const monetaryValue = (value: unknown) => {
      const cents = parsePriceToCents(value)
      return cents !== null && cents > 0 ? formatPriceValue(value) : ''
    }
    const packPrice = monetaryValue(pack)
    const unitPrice = monetaryValue(unit)
    const price = packPrice || unitPrice || monetaryValue(fallback) || null
    const secondary = packPrice && unitPrice && packPrice !== unitPrice ? `UNID R$ ${unitPrice}` : ''
    return {
      price,
      unitText: '',
      packLine: price ? [packaging, secondary].filter(Boolean).join(' · ') || null : null,
      hasValue: !!price
    }
  }
  const retail = tier(product?.pricePack, product?.priceUnit, product?.price)
  const special = tier(product?.priceSpecial, product?.priceSpecialUnit, product?.priceWholesale)
  const conditionText = String(product?.specialCondition || '').trim() || null
  return { retail, special, conditionText, showRetail: retail.hasValue, showSpecial: special.hasValue,
    showBanner: !!conditionText, autoCollapseMissingPrices: true }
}
