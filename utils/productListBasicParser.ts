import { makeId } from './makeId'

export function parseProductList(text: string) {
  const lines = text.split('\n').filter(line => line.trim().length > 0)

  return lines.map(line => {
    const priceMatch = line.match(/(?:R\$)?\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/)

    let price = '0,00'
    let name = line
    let unit = 'UN'

    if (priceMatch) {
      const matchedPrice = priceMatch[1]
      if (matchedPrice) {
        price = matchedPrice.replace('.', ',')
      }
      name = line.replace(priceMatch[0], '').trim()
    }

    const unitMatch = name.match(/\b(\d+(?:kg|g|l|ml|m)|kg|un|cx|pc|pct)\b/i)
    if (unitMatch) {
      unit = unitMatch[0].toUpperCase()
    }

    name = name.replace(/[-–]/g, '').trim()

    return {
      id: makeId(),
      name,
      price,
      image: '',
      unit,
      color: '#ffffff'
    }
  })
}
