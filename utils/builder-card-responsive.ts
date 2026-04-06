export function getBuilderCardDensityScale(productCount: number): number {
  if (productCount <= 1) return 1.45
  if (productCount === 2) return 1.25
  if (productCount === 3) return 1.12
  if (productCount <= 4) return 1.04
  if (productCount <= 6) return 0.96
  if (productCount <= 8) return 0.9
  if (productCount <= 12) return 0.82
  if (productCount <= 16) return 0.76
  return 0.7
}

export function getBuilderCardBaseFont(
  columns: number,
  productCount: number,
  highlightBoost = 0,
): number {
  const sizeMap: Record<number, number> = {
    1: 48,
    2: 36,
    3: 26,
    4: 22,
    5: 18,
    6: 15,
  }

  const base = sizeMap[columns] || Math.max(13, 44 - columns * 6)
  return Math.round((base + highlightBoost) * getBuilderCardDensityScale(productCount))
}

export function getBuilderCardNameFont(
  baseFont: number,
  nameLength: number,
  productCount: number,
  multiplier = 1,
): number {
  let compression = 1
  if (nameLength > 70) compression = 0.66
  else if (nameLength > 55) compression = 0.74
  else if (nameLength > 40) compression = 0.82
  else if (nameLength > 28) compression = 0.9
  else if (nameLength > 18) compression = 0.96

  let minFont = 11
  if (productCount <= 1) minFont = 18
  else if (productCount <= 2) minFont = 15
  else if (productCount <= 4) minFont = 13
  else if (productCount <= 8) minFont = 12

  return Math.max(minFont, Math.round(baseFont * compression * multiplier))
}

export interface BuilderCardAdaptiveBudgetInput {
  width?: number
  height?: number
  productCount: number
  hasObservation?: boolean
  layout?: 'vertical' | 'horizontal'
}

export interface BuilderCardAdaptiveBudget {
  aspectRatio: number
  nameShare: number
  priceShare: number
  imageShare: number
  nameMaxLines: number
  nameMinFontPx: number
  nameMaxFontMultiplier: number
  compactPrice: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function getBuilderCardAdaptiveBudget(input: BuilderCardAdaptiveBudgetInput): BuilderCardAdaptiveBudget {
  const layout = input.layout || 'vertical'
  const width = Math.max(0, input.width || 0)
  const height = Math.max(0, input.height || 0)
  const aspectRatio = width > 0 && height > 0
    ? width / height
    : layout === 'horizontal' ? 1.35 : 0.8

  if (layout === 'horizontal') {
    const isVeryNarrow = aspectRatio < 1.1
    return {
      aspectRatio,
      nameShare: isVeryNarrow ? 0.42 : 0.36,
      priceShare: isVeryNarrow ? 0.4 : 0.44,
      imageShare: isVeryNarrow ? 0.18 : 0.2,
      nameMaxLines: isVeryNarrow ? 4 : 3,
      nameMinFontPx: isVeryNarrow ? 10 : 11,
      nameMaxFontMultiplier: isVeryNarrow ? 0.82 : 0.88,
      compactPrice: isVeryNarrow,
    }
  }

  const narrowTall = aspectRatio < 0.68
  const tall = aspectRatio < 0.92
  const wide = aspectRatio > 1.15

  let nameShare = 0.14
  let priceShare = 0.26
  let nameMaxLines = 3
  let nameMinFontPx = 11
  let nameMaxFontMultiplier = 0.86

  if (narrowTall) {
    nameShare = 0.18
    priceShare = 0.3
    nameMaxLines = 4
    nameMinFontPx = 9
    nameMaxFontMultiplier = 0.76
  } else if (tall) {
    nameShare = 0.16
    priceShare = 0.28
    nameMaxLines = 4
    nameMinFontPx = 10
    nameMaxFontMultiplier = 0.8
  } else if (wide) {
    nameShare = 0.11
    priceShare = 0.24
    nameMaxLines = 2
    nameMinFontPx = 11
    nameMaxFontMultiplier = 0.84
  }

  if ((input.productCount || 0) <= 2 && !wide) {
    nameShare -= 0.015
    priceShare += 0.02
  }

  if (input.hasObservation) {
    nameShare += 0.02
    nameMaxLines += 1
  }

  nameShare = clamp(nameShare, 0.1, 0.24)
  priceShare = clamp(priceShare, 0.2, 0.34)
  const imageShare = clamp(1 - nameShare - priceShare, 0.36, 0.68)

  return {
    aspectRatio,
    nameShare,
    priceShare,
    imageShare,
    nameMaxLines,
    nameMinFontPx,
    nameMaxFontMultiplier,
    compactPrice: narrowTall || tall,
  }
}
