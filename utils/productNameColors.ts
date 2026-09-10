import type { GlobalStyles } from '~/types/product-zone'
import { getProductPalette } from './productPalette'
import { isProductNameText } from './productNameTypographyScope'

/** Saturated/dark cards use white; light cards use black. */
export const automaticProductNameColor = (background: unknown): string => {
  const paint = String(background || '').trim()
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(paint)?.[1]
  const rgb = hex
    ? (hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex).match(/../g)!.map(c => parseInt(c, 16))
    : /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(paint)?.slice(1, 4).map(Number)
  if (!rgb) return '#000000'
  const linear = rgb.map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722 < 0.36 ? '#ffffff' : '#000000'
}

export const resolveProductNameColor = (background: unknown, overrides: Record<string, any> = {}, styles: Partial<GlobalStyles> = {}, highlighted = false): string => {
  if (typeof overrides.prodNameColor === 'string' && overrides.prodNameColor) return overrides.prodNameColor
  const key = highlighted ? 'highlightProdNameColor' : 'prodNameColor'
  // A user-selected name color wins; a template name color applies only while its background is in use.
  const userColor = styles.productPalette?.[key]
  if (userColor) return userColor
  const palette = getProductPalette(styles)
  const paletteBackground = highlighted ? styles.templateProductPalette?.highlightCardColor : styles.templateProductPalette?.cardColor
  if (!overrides.cardColor && !overrides.isProdBgTransparent && styles.cardColorMode !== 'manual'
      && String(background).toLowerCase() === paletteBackground?.toLowerCase() && palette[key]) return palette[key]!
  return automaticProductNameColor(background)
}

/** Works on live Fabric objects and serialized pages. No geometry is changed. */
export const syncProductNameColor = (card: any, styles: Partial<GlobalStyles> = {}): void => {
  const children = card?.getObjects?.() || card?.objects || []
  const background = children.find((object: any) => object.name === 'offerBackground')
  if (!background) return
  const color = resolveProductNameColor(background.fill, card._cardStyleOverrides, styles, card._cardHighlighted === true)
  for (const name of children.filter(isProductNameText)) {
    if (name.styles) for (const line of Object.values(name.styles) as any[]) {
      for (const style of Object.values(line) as any[]) delete style.fill
    }
    if (name.set) name.set('fill', color); else name.fill = color
    name.dirty = true
  }
  card.dirty = true
}
