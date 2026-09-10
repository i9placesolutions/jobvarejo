import { getProductPalette } from './productPalette'
import type { GlobalStyles } from '~/types/product-zone'

/** Explicit individual choices always win, including white and transparency. */
export const resolveProductCardColor = (styles: Partial<GlobalStyles>, highlighted: boolean, overrides: Record<string, any> = {}): string => {
  if (overrides.isProdBgTransparent === true) return 'transparent'
  if (typeof overrides.cardColor === 'string') return overrides.cardColor
  if (styles.isProdBgTransparent) return 'transparent'
  const palette = getProductPalette(styles)
  const color = highlighted ? palette.highlightCardColor : palette.cardColor
  if (styles.cardColorMode !== 'manual' && color) return color
  if (styles.cardColorMode === 'auto') return highlighted ? (styles.highlightCardColor || '#ffffff') : '#ffffff'
  return styles.cardColor || '#ffffff'
}

/** Ignore neutral paints, product photos and price labels when finding the flyer accent. */
export const findFlyerAccent = (roots: any[]): string | null => {
  const scores = new Map<string, number>()
  const add = (r: number, g: number, b: number, weight: number) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max < 80 || max - min < 55) return
    const hex = '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
    scores.set(hex, (scores.get(hex) || 0) + weight)
  }
  const walk = (node: any) => {
    if (!node || node.isProductZone || node.parentZoneId || node._productData || node.name === 'offerBackground') return
    const area = Math.max(1, Math.abs((node.width || 1) * (node.scaleX || 1) * (node.height || 1) * (node.scaleY || 1)))
    if (typeof node.fill === 'string' && /^#[\da-f]{6}$/i.test(node.fill)) {
      add(parseInt(node.fill.slice(1, 3), 16), parseInt(node.fill.slice(3, 5), 16), parseInt(node.fill.slice(5, 7), 16), area)
    }
    if (typeof document !== 'undefined' && node.getElement) {
      try {
        const sample = document.createElement('canvas'); sample.width = sample.height = 24
        const ctx = sample.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(node.getElement(), 0, 0, 24, 24)
        const pixels = ctx.getImageData(0, 0, 24, 24).data
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3]! < 200) continue
          // Small histogram bins keep gradients from splitting a dominant color.
          add(...[pixels[i]!, pixels[i + 1]!, pixels[i + 2]!].map(v => Math.min(255, Math.round(v / 24) * 24)) as [number, number, number], area / 576)
        }
      } catch { /* An inaccessible image must not block editing. */ }
    }
    ;(node.getObjects?.() || node.objects || []).forEach(walk)
  }
  roots.forEach(walk)
  return [...scores].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

export const flattenCardColorObjects = (roots: any[]): any[] => roots.flatMap(node => [node, ...flattenCardColorObjects(node.getObjects?.() || node.objects || [])])
