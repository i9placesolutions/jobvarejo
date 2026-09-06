export type ProductImageCompositionLayout = 'horizontal' | 'vertical' | 'grid'
export type ProductImageDuplicateLayout = 'horizontal' | 'vertical'

export const PRODUCT_IMAGE_COMPOSITION_VERSION = 1

export type ProductImageCompositionItem = {
  width?: number
  height?: number
  scaleX?: number
  scaleY?: number
  left?: number
  top?: number
  src?: string
  __originalSrc?: string
  name?: string
  type?: string
  data?: Record<string, any>
  getSrc?: () => string
}

export type ProductImageCompositionPlanItem = {
  left: number
  top: number
  scaleX: number
  scaleY: number
}

export type ProductImageDuplicatePlacement = {
  left: number
  top: number
  originX: string
  originY: string
  angle: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  flipX: boolean
  flipY: boolean
  opacity: number
}

export type ProductImageDuplicatePlacementOptions = {
  offsetX?: number
  offsetY?: number
}

const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Captura o transform visual da imagem para uma duplicação literal.
 * A cópia mantém escala, rotação e demais propriedades da origem. Quando
 * solicitado, um pequeno deslocamento torna a nova cópia visível ao usuário
 * sem transformar a ação em uma redistribuição/composição automática.
 */
export const getProductImageDuplicatePlacement = (
  image: ProductImageCompositionItem | null | undefined,
  options: ProductImageDuplicatePlacementOptions = {}
): ProductImageDuplicatePlacement => {
  const finiteOr = (value: unknown, fallback: number): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const offsetX = finiteOr(options.offsetX, 0)
  const offsetY = finiteOr(options.offsetY, 0)

  return {
    left: finiteOr(image?.left, 0) + offsetX,
    top: finiteOr(image?.top, 0) + offsetY,
    originX: String((image as any)?.originX || 'center'),
    originY: String((image as any)?.originY || 'center'),
    angle: finiteOr((image as any)?.angle, 0),
    // Preserve zero/negative scales too: they encode the exact visual
    // transform (collapsed or flipped) of the source image.
    scaleX: finiteOr(image?.scaleX, 1),
    scaleY: finiteOr(image?.scaleY, 1),
    skewX: finiteOr((image as any)?.skewX, 0),
    skewY: finiteOr((image as any)?.skewY, 0),
    flipX: !!(image as any)?.flipX,
    flipY: !!(image as any)?.flipY,
    opacity: finiteOr((image as any)?.opacity, 1)
  }
}

const isExcludedCardImageName = (name: string): boolean =>
  name === 'label_bg_image' || name === 'price_bg_image' || name === 'splash_image'

export const isNamedProductCardImage = (obj: any): boolean => {
  if (!obj || String(obj.type || '').toLowerCase() !== 'image') return false
  const name = String(obj.name || '').trim().toLowerCase()
  if (isExcludedCardImageName(name)) return false
  const smartType = String(obj?.data?.smartType || '').trim().toLowerCase()
  return smartType === 'product-image'
    || name === 'smart_image'
    || name === 'product_image'
    || name === 'productimage'
    || name.startsWith('extra_image_')
}

export const getProductImageObjectSource = (obj: ProductImageCompositionItem | null | undefined): string => {
  if (!obj) return ''
  const direct = String(obj.__originalSrc || obj.src || '').trim()
  if (direct) return direct
  if (typeof obj.getSrc === 'function') {
    try {
      return String(obj.getSrc() || '').trim()
    } catch {
      return ''
    }
  }
  return ''
}

const normalizeComparableSource = (value: string): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const keyMatch = raw.match(/[?&]key=([^&]+)/i)
  if (keyMatch?.[1]) {
    try {
      return `key:${decodeURIComponent(keyMatch[1])}`
    } catch {
      return `key:${keyMatch[1]}`
    }
  }
  return raw.replace(/^https?:\/\/[^/]+/i, '').replace(/[?&]v=\d+/i, '')
}

export const collectDirectProductCardImages = (card: any): any[] => {
  if (!card || typeof card.getObjects !== 'function') return []
  const directImages = (card.getObjects() || []).filter((obj: any) => {
    if (!obj || String(obj.type || '').toLowerCase() !== 'image') return false
    return !isExcludedCardImageName(String(obj.name || '').trim().toLowerCase())
  })
  if (directImages.length <= 1) return directImages

  const named = directImages.filter(isNamedProductCardImage)
  if (!named.length) return directImages

  const namedSources = new Set(
    named
      .map((obj: any) => normalizeComparableSource(getProductImageObjectSource(obj)))
      .filter(Boolean)
  )
  const selected = directImages.filter((obj: any) => {
    if (isNamedProductCardImage(obj)) return true
    const source = normalizeComparableSource(getProductImageObjectSource(obj))
    return !!source && namedSources.has(source)
  })

  return selected.sort((a: any, b: any) => {
    const rank = (obj: any) => String(obj?.name || '').trim().toLowerCase() === 'smart_image' ? 0 : 1
    return rank(a) - rank(b)
  })
}

/** Substitui a textura das cópias sem recriar objetos ou redistribuir o card. */
export const replaceProductImageCopies = (card: any, target: any, replacement: any, source: string): any[] => {
  const originalSource = normalizeComparableSource(getProductImageObjectSource(target))
  const images = collectDirectProductCardImages(card).filter(image =>
    image === target || (!!originalSource && normalizeComparableSource(getProductImageObjectSource(image)) === originalSource)
  )
  if (!images.includes(target) || !replacement?.getElement?.()) return []
  const width = Math.max(1, Number(replacement.width) || 1)
  const height = Math.max(1, Number(replacement.height) || 1)
  for (const image of images) {
    const cardWidth = Math.max(1, Number(card._cardWidth || card.width))
    const cardHeight = Math.max(1, Number(card._cardHeight || card.height))
    const oldWidth = Math.abs(Number(image.width) * Number(image.scaleX ?? 1))
    const oldHeight = Math.abs(Number(image.height) * Number(image.scaleY ?? 1))
    const oversized = oldWidth > cardWidth || oldHeight > cardHeight
    const fit = Math.min(cardWidth * 0.86 / width, cardHeight * 0.64 / height)
    const scaleX = oversized ? fit : oldWidth / width
    const scaleY = oversized ? fit : oldHeight / height
    const halfW = width * scaleX / 2
    const halfH = height * scaleY / 2
    const left = oversized ? 0 : Math.max(-cardWidth / 2 + halfW, Math.min(cardWidth / 2 - halfW, Number(image.left || 0)))
    const top = oversized ? 0 : Math.max(-cardHeight / 2 + halfH, Math.min(cardHeight / 2 - halfH, Number(image.top || 0)))
    image.setElement(replacement.getElement())
    image.set({ width, height, scaleX, scaleY, left, top,
      cropX: Number(replacement.cropX || 0), cropY: Number(replacement.cropY || 0),
      src: source, __originalSrc: source, dirty: true,
      __manualTransform: true,
      __manualTransformCardW: Number(card._cardWidth || card.width),
      __manualTransformCardH: Number(card._cardHeight || card.height)
    })
    image.setCoords?.()
  }
  card.dirty = true
  return images
}

export const resolveProductImageCompositionLayout = (
  imageCount: number,
  requested: ProductImageCompositionLayout | 'auto' | null | undefined = 'auto'
): ProductImageCompositionLayout => {
  if (requested === 'horizontal' || requested === 'vertical' || requested === 'grid') return requested
  return Math.max(0, Math.floor(imageCount)) <= 3 ? 'horizontal' : 'grid'
}

/**
 * Escolhe o eixo mais legivel para a segunda imagem de um card.
 *
 * A receita explicita do card/zona vence. Sem receita, cards estreitos usam
 * empilhamento; cards largos usam lado a lado. Para cards intermediarios, a
 * decisao compara quanto a imagem precisaria ser reduzida em cada eixo e usa
 * a direcao da zona como desempate.
 */
export const resolveProductImageDuplicateLayout = (opts: {
  cardWidth: number
  cardHeight: number
  images?: ProductImageCompositionItem[]
  availableWidth?: number
  availableHeight?: number
  slotCount?: number
  requestedLayout?: ProductImageCompositionLayout | 'auto' | null
  zoneLayoutDirection?: 'horizontal' | 'vertical' | null
}): ProductImageDuplicateLayout => {
  const cardWidth = Math.max(40, Math.abs(finite(opts?.cardWidth, 40)))
  const cardHeight = Math.max(40, Math.abs(finite(opts?.cardHeight, 40)))
  const availableWidth = Math.max(40, Math.abs(finite(opts?.availableWidth, cardWidth)))
  const availableHeight = Math.max(40, Math.abs(finite(opts?.availableHeight, cardHeight)))
  const slotCount = Math.max(2, Math.floor(finite(opts?.slotCount, (opts?.images?.length || 1) + 1)))
  const requested = opts?.requestedLayout

  if (requested === 'vertical') return 'vertical'
  if (requested === 'horizontal' || requested === 'grid') return 'horizontal'

  const cardAspect = availableWidth / availableHeight
  if (cardAspect <= 0.82) return 'vertical'
  if (cardAspect >= 1.2) return 'horizontal'
  if (opts?.zoneLayoutDirection === 'vertical' && cardAspect <= 1.05) return 'vertical'

  const source = Array.isArray(opts?.images) ? opts.images.find(Boolean) : null
  const sourceWidth = source
    ? Math.max(1, Math.abs(finite(source.width, 0)) * Math.max(0.01, Math.abs(finite(source.scaleX, 1))))
    : 0
  const sourceHeight = source
    ? Math.max(1, Math.abs(finite(source.height, 0)) * Math.max(0.01, Math.abs(finite(source.scaleY, 1))))
    : 0

  if (sourceWidth > 0 && sourceHeight > 0) {
    const horizontalSlotWidth = (availableWidth * 0.94) / Math.max(1, slotCount - (0.06 * (slotCount - 1)))
    const horizontalSlotHeight = availableHeight * 0.56
    const verticalAvailableHeight = Math.min(availableHeight * 0.62, Math.max(availableHeight * 0.48, availableHeight * 0.5))
    const verticalSlotWidth = availableWidth * 0.82
    const verticalSlotHeight = verticalAvailableHeight / Math.max(1, slotCount - (0.08 * (slotCount - 1)))
    const horizontalScale = Math.min(horizontalSlotWidth / sourceWidth, horizontalSlotHeight / sourceHeight)
    const verticalScale = Math.min(verticalSlotWidth / sourceWidth, verticalSlotHeight / sourceHeight)

    if (Math.abs(horizontalScale - verticalScale) > 0.04) {
      return horizontalScale > verticalScale ? 'horizontal' : 'vertical'
    }
  }

  return opts?.zoneLayoutDirection === 'vertical' ? 'vertical' : 'horizontal'
}

const resolveBandHeight = (
  images: ProductImageCompositionItem[],
  cardHeight: number,
  layout: ProductImageCompositionLayout
): number => {
  const displayedHeights = images
    .map((image) => Math.abs(finite(image.height)) * Math.abs(finite(image.scaleY, 1)))
    .filter((height) => height > 1)
  const currentMax = displayedHeights.length ? Math.max(...displayedHeights) : 0
  const preferred = currentMax > 0 ? currentMax : cardHeight * 0.44
  const maxShare = layout === 'grid' ? 0.58 : 0.56
  return clamp(preferred, cardHeight * 0.3, cardHeight * maxShare)
}

const fitScale = (image: ProductImageCompositionItem, slotWidth: number, slotHeight: number): number => {
  const width = Math.max(1, Math.abs(finite(image.width, 1)))
  const height = Math.max(1, Math.abs(finite(image.height, 1)))
  const target = Math.max(0.01, Math.min(slotWidth / width, slotHeight / height))
  const current = Math.max(Math.abs(finite(image.scaleX)), Math.abs(finite(image.scaleY)))
  if (current <= 0) return target
  return Math.max(0.01, Math.min(target, current * 1.25))
}

export const buildProductImageCompositionPlan = (opts: {
  images: ProductImageCompositionItem[]
  cardWidth: number
  cardHeight: number
  layout?: ProductImageCompositionLayout | 'auto' | null
  preferredCenterY?: number | null
}): ProductImageCompositionPlanItem[] => {
  const images = Array.isArray(opts.images) ? opts.images.filter(Boolean) : []
  if (!images.length) return []

  const cardWidth = Math.max(40, Math.abs(finite(opts.cardWidth, 40)))
  const cardHeight = Math.max(40, Math.abs(finite(opts.cardHeight, 40)))
  const layout = resolveProductImageCompositionLayout(images.length, opts.layout)
  const bandHeight = resolveBandHeight(images, cardHeight, layout)
  const fallbackCenterY = images.reduce((sum, image) => sum + finite(image.top), 0) / images.length
  const requestedCenterY = Number.isFinite(Number(opts.preferredCenterY))
    ? Number(opts.preferredCenterY)
    : fallbackCenterY
  const centerY = clamp(requestedCenterY, (-cardHeight / 2) + (bandHeight / 2), (cardHeight / 2) - (bandHeight / 2))

  if (images.length === 1) {
    const image = images[0]!
    return [{
      left: finite(image.left),
      top: centerY,
      scaleX: Math.abs(finite(image.scaleX, 1)) || 1,
      scaleY: Math.abs(finite(image.scaleY, 1)) || 1
    }]
  }

  if (layout === 'horizontal') {
    const count = images.length
    const availableWidth = cardWidth * 0.94
    const overlap = count === 2 ? 0.06 : 0.12
    const slotWidth = availableWidth / Math.max(1, count - (overlap * (count - 1)))
    const step = slotWidth * (1 - overlap)
    const totalSpan = slotWidth + (step * (count - 1))
    const firstCenter = (-totalSpan / 2) + (slotWidth / 2)

    return images.map((image, index) => {
      const scale = fitScale(image, slotWidth, bandHeight)
      return {
        left: firstCenter + (index * step),
        top: centerY,
        scaleX: scale,
        scaleY: scale
      }
    })
  }

  if (layout === 'vertical') {
    const count = images.length
    const availableHeight = Math.min(cardHeight * 0.62, Math.max(bandHeight, cardHeight * 0.48))
    const overlap = count === 2 ? 0.08 : 0.12
    const slotHeight = availableHeight / Math.max(1, count - (overlap * (count - 1)))
    const step = slotHeight * (1 - overlap)
    const totalSpan = slotHeight + (step * (count - 1))
    const firstCenter = centerY - (totalSpan / 2) + (slotHeight / 2)

    return images.map((image, index) => {
      const scale = fitScale(image, cardWidth * 0.82, slotHeight)
      return {
        left: 0,
        top: firstCenter + (index * step),
        scaleX: scale,
        scaleY: scale
      }
    })
  }

  const columns = images.length <= 4 ? 2 : Math.ceil(Math.sqrt(images.length))
  const rows = Math.ceil(images.length / columns)
  const availableWidth = cardWidth * 0.94
  const availableHeight = Math.min(cardHeight * 0.6, Math.max(bandHeight, cardHeight * 0.5))
  const gapX = cardWidth * 0.018
  const gapY = cardHeight * 0.014
  const slotWidth = (availableWidth - (gapX * (columns - 1))) / columns
  const slotHeight = (availableHeight - (gapY * (rows - 1))) / rows
  const startX = (-availableWidth / 2) + (slotWidth / 2)
  const startY = centerY - (availableHeight / 2) + (slotHeight / 2)

  return images.map((image, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const itemsInRow = Math.min(columns, images.length - (row * columns))
    const rowWidth = (itemsInRow * slotWidth) + ((itemsInRow - 1) * gapX)
    const rowStartX = -rowWidth / 2 + slotWidth / 2
    const scale = fitScale(image, slotWidth, slotHeight)
    return {
      left: itemsInRow === columns ? startX + (col * (slotWidth + gapX)) : rowStartX + (col * (slotWidth + gapX)),
      top: startY + (row * (slotHeight + gapY)),
      scaleX: scale,
      scaleY: scale
    }
  })
}

export const isStackedDuplicateImageComposition = (opts: {
  images: ProductImageCompositionItem[]
  cardWidth: number
  cardHeight: number
  requireSameSource?: boolean
}): boolean => {
  const images = Array.isArray(opts.images) ? opts.images.filter(Boolean) : []
  if (images.length < 2) return false

  if (opts.requireSameSource !== false) {
    const sources = images
      .map((image) => normalizeComparableSource(getProductImageObjectSource(image)))
      .filter(Boolean)
    if (sources.length !== images.length || new Set(sources).size !== 1) return false
  }

  const xs = images.map((image) => finite(image.left))
  const ys = images.map((image) => finite(image.top))
  const horizontalSpread = Math.max(...xs) - Math.min(...xs)
  const verticalSpread = Math.max(...ys) - Math.min(...ys)
  const cardWidth = Math.max(40, Math.abs(finite(opts.cardWidth, 40)))
  const cardHeight = Math.max(40, Math.abs(finite(opts.cardHeight, 40)))
  const narrowHorizontalSpread = horizontalSpread <= Math.max(8, cardWidth * 0.22)
  const nearlyCoincident = horizontalSpread <= Math.max(3, cardWidth * 0.045)
    && verticalSpread <= Math.max(3, cardHeight * 0.045)
  const verticalOrDiagonalStack = verticalSpread >= Math.max(4, horizontalSpread * 0.65)

  return narrowHorizontalSpread && (nearlyCoincident || verticalOrDiagonalStack)
}

export const getProductImageCompositionSummary = (card: any) => {
  const images = collectDirectProductCardImages(card)
  const rawLayout = String(card?._productImageLayout || '').trim().toLowerCase()
  const layout = rawLayout === 'horizontal' || rawLayout === 'vertical' || rawLayout === 'grid'
    ? rawLayout as ProductImageCompositionLayout
    : null
  const cardWidth = Math.max(40, Math.abs(finite(card?._cardWidth ?? card?.width, 40)))
  const cardHeight = Math.max(40, Math.abs(finite(card?._cardHeight ?? card?.height, 40)))
  return {
    count: images.length,
    layout,
    stackedRisk: layout !== 'vertical' && isStackedDuplicateImageComposition({
      images,
      cardWidth,
      cardHeight,
      requireSameSource: true
    })
  }
}
