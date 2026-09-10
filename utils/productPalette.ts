import type { GlobalStyles, ProductPalette } from '~/types/product-zone'

export const PRODUCT_PALETTE_KEYS = ['cardColor', 'highlightCardColor', 'prodNameColor', 'highlightProdNameColor'] as const
export const normalizeProductPalette = (value: unknown): Partial<ProductPalette> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result: Partial<ProductPalette> = {}
  for (const key of PRODUCT_PALETTE_KEYS) {
    const color = (value as Record<string, unknown>)[key]
    if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) result[key] = color.toLowerCase()
  }
  return result
}
export const getProductPalette = (styles: Partial<GlobalStyles> = {}): Partial<ProductPalette> => ({
  ...normalizeProductPalette(styles.templateProductPalette),
  ...normalizeProductPalette(styles.productPalette)
})
