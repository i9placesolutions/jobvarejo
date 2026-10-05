import { collectObjectsDeep } from './fabricObjectClassifiers'

/**
 * Reapplies the editor's canonical price names to older saved labels whose
 * Fabric children were serialized without custom names. It only renames an
 * unambiguous currency/value tuple; it never changes the authored text.
 */
export const restoreLegacyManualPriceNames = (
  priceGroup: any,
  isTextLikeObject: (object: any) => boolean
): boolean => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
  const all = collectObjectsDeep(priceGroup)
  const hasNamedPriceValue = all.some((object: any) =>
    ['price_value_text', 'smart_price', 'price_integer_text', 'priceInteger', 'price_integer', 'price_decimal_text', 'priceDecimal', 'price_decimal']
      .includes(String(object?.name || ''))
  )
  if (hasNamedPriceValue) return false

  const unnamedTexts = all.filter((object: any) =>
    object !== priceGroup && isTextLikeObject(object) && !String(object?.name || '').trim()
  )
  const currency = unnamedTexts.find((object: any) => /^R\s*\$/i.test(String(object?.text || '').trim()))
  const numeric = unnamedTexts.filter((object: any) => /^\d+(?:[,\.]\d{0,2})?$|^[,\.]\d{1,2}$/.test(String(object?.text || '').trim()))
  if (!numeric.length || numeric.length > 2) return false

  if (numeric.length === 1) {
    const value = numeric[0]
    value.set?.('name', 'price_value_text')
    if (typeof value.set !== 'function') value.name = 'price_value_text'
    if (currency) {
      currency.set?.('name', 'price_currency_text')
      if (typeof currency.set !== 'function') currency.name = 'price_currency_text'
    }
    return true
  }

  const [first, second] = numeric
  const firstText = String(first.text || '').trim()
  const secondText = String(second.text || '').trim()
  const firstLooksInteger = /[,\.]$/.test(firstText)
  const secondLooksInteger = /[,\.]$/.test(secondText)
  const secondLooksDecimal = /^[,\.]/.test(secondText)
  let integer: any
  let decimal: any
  if (firstLooksInteger && !secondLooksDecimal) {
    integer = first; decimal = second
  } else if (secondLooksInteger && !/^[,\.]/.test(firstText)) {
    integer = second; decimal = first
  } else if (secondLooksDecimal && !/^[,\.]/.test(firstText)) {
    integer = first; decimal = second
  } else if (/^[,\.]/.test(firstText) && !secondLooksDecimal) {
    integer = second; decimal = first
  } else {
    const firstSize = Number(first.fontSize || first.getScaledWidth?.() || 0)
    const secondSize = Number(second.fontSize || second.getScaledWidth?.() || 0)
    if (firstSize === secondSize) return false
    integer = firstSize > secondSize ? first : second
    decimal = integer === first ? second : first
  }
  const setName = (object: any, name: string) => {
    object.set?.('name', name)
    if (typeof object.set !== 'function') object.name = name
  }
  setName(integer, 'price_integer_text')
  setName(decimal, 'price_decimal_text')
  if (currency) setName(currency, 'price_currency_text')
  return true
}
