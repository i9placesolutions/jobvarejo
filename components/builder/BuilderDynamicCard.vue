<script setup lang="ts">
/**
 * BuilderDynamicCard v2 — renderiza card de produto usando flexbox adaptativo.
 * O template define a direcao (column/row), proporcao da imagem, e estilo visual.
 * O layout se adapta a qualquer tamanho de box no grid automaticamente.
 */
import type { BuilderFlyerProduct, BuilderCardTemplate, BuilderBadgeStyle, CardTemplateElement, BuilderPriceTagStyle } from '~/types/builder'
import { getBuilderCardAdaptiveBudget, getBuilderCardBaseFont } from '~/utils/builder-card-responsive'

const props = defineProps<{
  product: BuilderFlyerProduct
  template: BuilderCardTemplate
  isHighlight?: boolean
  columns?: number
  pageProductCount?: number
}>()

const { flyer, priceTagStyles } = useBuilderFlyer()
const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const cardBg = computed(() => fc.value.card_bg_color || '#ffffff')
const cardText = computed(() => fc.value.card_text_color || '#000000')
const imageScale = computed(() => {
  const raw = Number(fc.value.image_scale || 1)
  return Math.min(Math.max(raw, 0.5), 2.2)
})
const priceTagStyle = computed<BuilderPriceTagStyle | null>(() => {
  const styleId = props.product.price_tag_style_id || flyer.value?.price_tag_style_id
  if (!styleId) return null
  return priceTagStyles.value.find(s => s.id === styleId) || null
})

// ── Config do template ──
const style = computed(() => props.template.card_style || {})
const direction = computed(() => {
    const d = style.value.direction
    if (d) return d
    const layout = style.value.layout
    if (layout === 'horizontal') return 'row'
    if (layout === 'vertical') return 'column'
    return 'column'
  })
const imagePosition = computed(() => {
    if (style.value.imagePosition) return style.value.imagePosition
    const imgEl = props.template.elements?.find(e => e.type === 'image')
    if (imgEl?.slot) {
      if (imgEl.slot === 'left') return 'left'
      if (imgEl.slot === 'right') return 'right'
      if (imgEl.slot === 'background') return 'top'
    }
    return 'top'
  })
const imageSize = computed(() => {
    if (style.value.imageSize) return style.value.imageSize
    const imgEl = props.template.elements?.find(e => e.type === 'image')
    if (imgEl) {
      if (isHorizontal.value) {
        const w = (imgEl as any).width || imgEl.w
        if (w && w !== 'auto' && w !== '100%') return w
      }
      const h = (imgEl as any).height || imgEl.h
      if (h && h !== 'auto' && h !== '100%') return h
    }
    return '55%'
  })
const rawImageSize = computed(() => {
  const parsed = Number.parseInt(String(imageSize.value || '55%'), 10)
  return Number.isFinite(parsed) ? parsed : 55
})
const pricePosition = computed(() => style.value.pricePosition || 'below')
const nameScale = computed(() => {
  const raw = Number(style.value.nameScale || 1)
  return Math.min(Math.max(raw, 0.5), 2)
})
const priceScale = computed(() => {
  const raw = Number(style.value.priceScale || 1)
  return Math.min(Math.max(raw, 0.3), 5)
})
const isHorizontal = computed(() => direction.value === 'row' || imagePosition.value === 'left' || imagePosition.value === 'right')
const imageSectionPercent = computed(() => {
  if (isHorizontal.value) return Math.max(18, Math.min(80, rawImageSize.value))
  return Math.max(20, Math.min(100, rawImageSize.value))
})
const templateImageScaleBoost = computed(() => {
  const baseline = isHorizontal.value ? 40 : 55
  const extra = Math.max(0, imageSectionPercent.value - baseline)
  return Math.min(1.45, 1 + extra / 120)
})
const effectiveImageScale = computed(() =>
  Math.min(2.2, imageScale.value * templateImageScaleBoost.value),
)

// ── URLs da imagem ──
const resolveImgUrl = (img: string | null | undefined) => {
  if (!img) return null
  if (img.startsWith('/api/')) return img
  if (img.startsWith('http://') || img.startsWith('https://')) return img
  const wasabiMatch = img.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+?)(\?.*)?$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1]!)}`
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

const imageUrl = computed(() => resolveImgUrl(props.product.custom_image))
const imageLoadFailed = ref(false)
const onImageError = () => { imageLoadFailed.value = true }
watch(() => props.product.custom_image, () => { imageLoadFailed.value = false })
const extraImageUrls = computed(() => {
  const extras = props.product.extra_images || []
  return extras.map((img: string) => resolveImgUrl(img)).filter(Boolean) as string[]
})
const hasMultipleImages = computed(() => !!imageUrl.value && extraImageUrls.value.length > 0)
const duplicateImageUrls = computed(() => imageUrl.value ? [imageUrl.value, ...extraImageUrls.value] : [])
const totalImages = computed(() => duplicateImageUrls.value.length || 1)
const mainImageAspectRatio = ref(1)
const onProductImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement | null
  if (!img?.naturalWidth || !img.naturalHeight) return
  mainImageAspectRatio.value = img.naturalWidth / img.naturalHeight
}
const resolvedExtraImagesLayout = computed<'horizontal' | 'vertical' | 'grid'>(() => {
  const layout = props.product.extra_images_layout || 'auto'
  if (layout === 'vertical' || layout === 'horizontal') return layout
  if (totalImages.value >= 6 && mainImageAspectRatio.value >= 0.95 && mainImageAspectRatio.value <= 1.9) return 'grid'
  if (totalImages.value >= 5 && mainImageAspectRatio.value > 1.35) return 'vertical'
  return 'horizontal'
})
const badgeStyle = computed<BuilderBadgeStyle | null>(() => {
  const text = props.product.badge_style_id?.trim()
  if (!text) return null
  const upper = text.toUpperCase()
  const colors = upper.includes('NOVIDADE')
    ? { bgColor: '#1565C0', textColor: '#ffffff' }
    : upper.includes('VENDIDO')
      ? { bgColor: '#E65100', textColor: '#ffffff' }
      : upper.includes('IMPERDIVEL') || upper.includes('IMPERDÍVEL')
        ? { bgColor: '#6A1B9A', textColor: '#ffffff' }
        : upper.includes('PROMO')
          ? { bgColor: '#F9A825', textColor: '#1a1a1a' }
          : { bgColor: '#D32F2F', textColor: '#ffffff' }

  return {
    id: text,
    name: text,
    thumbnail: null,
    type: 'OFFER',
    css_config: {
      ...colors,
      text,
      position: 'top-right',
    },
    is_global: true,
    is_active: true,
    sort_order: 0,
  }
})
const pageProductCount = computed(() => Math.max(1, props.pageProductCount || props.columns || 1))
const rootRef = ref<HTMLElement | null>(null)
const cardWidth = ref(0)
const cardHeight = ref(0)
let cardResizeObserver: ResizeObserver | null = null

const updateCardSize = () => {
  cardWidth.value = rootRef.value?.clientWidth || 0
  cardHeight.value = rootRef.value?.clientHeight || 0
}

onMounted(async () => {
  await nextTick()
  updateCardSize()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    cardResizeObserver = new ResizeObserver(() => updateCardSize())
    cardResizeObserver.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  cardResizeObserver?.disconnect()
})

// ── Font sizing baseado em colunas ──
const baseFontSize = computed(() => {
  return getBuilderCardBaseFont(
    props.columns || 3,
    pageProductCount.value,
    props.isHighlight ? 6 : 0,
  )
})
const cardBudget = computed(() => getBuilderCardAdaptiveBudget({
  width: cardWidth.value,
  height: cardHeight.value,
  productCount: pageProductCount.value,
  hasObservation: !!props.product.observation,
  layout: isHorizontal.value ? 'horizontal' : 'vertical',
}))
const isTallVerticalCard = computed(() =>
  !isHorizontal.value && cardBudget.value.aspectRatio < 0.82,
)
const isVeryTallVerticalCard = computed(() =>
  !isHorizontal.value && cardBudget.value.aspectRatio < 0.62,
)
const nameLineHeight = computed(() => pageProductCount.value <= 2 ? 1.02 : 1.08)
const configuredNameMaxLines = computed(() => {
  const configured = Number(style.value.nameMaxLines || 0)
  if (configured > 0) return configured
  return cardBudget.value.nameMaxLines
})
const adaptiveNameMaxFont = computed(() =>
  Math.max(
    9,
    Math.round(baseFontSize.value * cardBudget.value.nameMaxFontMultiplier * (isTallVerticalCard.value ? 0.94 : 0.91) * nameScale.value),
  ),
)
const adaptiveNameMinFont = computed(() => adaptiveNameMaxFont.value)
const adaptiveNameMaxLines = computed(() => configuredNameMaxLines.value)
// Fator progressivo: quanto maior o imageSize, mais compacto fica nome/preco
// De 55% a 100%, o fator vai de 1.0 a 0.7 linearmente
const imageSizeCompactFactor = computed(() => {
  const pct = imageSectionPercent.value
  if (pct <= 55) return 1
  return Math.max(0.7, 1 - ((pct - 55) / 45) * 0.3)
})
const nameSlotHeight = computed(() => {
  if (isHorizontal.value) return 0
  const fallback = Math.round(baseFontSize.value * 3.1)
  const rawHeight = Math.round((cardHeight.value || fallback * 4) * cardBudget.value.nameShare)
  const targetLines = Math.max(1, Math.min(5, adaptiveNameMaxLines.value))
  const contentHeight = Math.round(adaptiveNameMaxFont.value * targetLines * nameLineHeight.value)
  const observationHeight = props.product.observation ? Math.round(adaptiveNameMaxFont.value * 0.5) : 0
  const base = Math.max(28, rawHeight, contentHeight + observationHeight + 10)
  return Math.round(base * imageSizeCompactFactor.value)
})
const priceSlotHeight = computed(() => {
  const fallback = Math.round(baseFontSize.value * 3.8)
  const share = isHorizontal.value ? cardBudget.value.priceShare : cardBudget.value.priceShare
  const rawHeight = Math.round((cardHeight.value || fallback * 4) * Math.max(share, 0.3))
  const boost = isVeryTallVerticalCard.value ? 1.18 : isTallVerticalCard.value ? 1.12 : 1.04
  const base = Math.max(104, Math.round(rawHeight * boost))
  // Escalar a altura da etiqueta proporcionalmente ao priceScale
  const scaleBoost = Math.max(1, priceScale.value)
  return Math.round(base * imageSizeCompactFactor.value * scaleBoost)
})
const shouldOverlayPrice = computed(() =>
  !isHorizontal.value
  && pricePosition.value.startsWith('overlay')
  && flowElements.value.some(e => e.type === 'price')
  && props.product.price_mode !== 'none',
)
const overlayPriceStyle = computed(() => {
  const positionStyle = pricePosition.value === 'overlay-top'
    ? {
        top: '10px',
        transform: 'translateX(-50%)',
      }
    : pricePosition.value === 'overlay-center'
      ? {
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }
      : {
          bottom: '10px',
          transform: 'translateX(-50%)',
        }

  return {
    position: 'absolute' as const,
    left: '50%',
    width: isTallVerticalCard.value ? '92%' : '88%',
    maxWidth: isTallVerticalCard.value ? '380px' : '360px',
    height: `${Math.max(108, Math.round(priceSlotHeight.value * 1.14))}px`,
    zIndex: 14,
    pointerEvents: 'none' as const,
    ...positionStyle,
  }
})
const imageStagePadding = computed(() => {
  if (!shouldOverlayPrice.value) return '0'
  const side = isTallVerticalCard.value ? '1.5%' : '2.5%'
  const inset = Math.max(12, Math.round(priceSlotHeight.value * (isTallVerticalCard.value ? 0.13 : 0.16)))
  if (pricePosition.value === 'overlay-top') return `${inset}px ${side} 0`
  if (pricePosition.value === 'overlay-center') return `${Math.round(inset * 0.85)}px ${side} ${Math.round(inset * 0.85)}px`
  return `0 ${side} ${inset}px`
})

// ── Elementos do template por tipo (para acesso rapido) ──
const getEl = (type: string) =>
  props.template.elements?.find(e => e.type === type)
  || flowElements.value.find(e => e.type === type)

// ── Verificar se um elemento existe e deve ser mostrado ──
const hasEl = (type: string): boolean => {
  const el = getEl(type)
  if (!el) return false
  if (el.showIf === 'has_value') {
    if (type === 'observation') return !!props.product.observation
    if (type === 'unit') return !!props.product.unit && props.product.unit !== 'UN'
    if (type === 'badge') return !!props.product.badge_style_id
  }
  if (el.showIf === 'is_highlight') return !!props.isHighlight
  return true
}

// ── Contraste adaptativo (WCAG) ──
const getContrastColor = (bgHex: string): string => {
  const hex = (bgHex || '#ffffff').replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1f3a' : '#ffffff'
}
const resolvedCardBg = computed(() => style.value.bg || cardBg.value || '#ffffff')
const adaptiveTextColor = computed(() => getContrastColor(resolvedCardBg.value))

// ── Estilos ──
const containerStyle = computed(() => {
  const bg = resolvedCardBg.value
  const base = {
    display: 'flex',
    width: '100%',
    height: '100%',
    minHeight: 0,
    alignSelf: 'stretch',
    fontSize: `${baseFontSize.value}px`,
    background: bg,
    border: props.isHighlight ? '3px solid var(--builder-accent, #10b981)' : (style.value.border || 'none'),
    borderRadius: style.value.borderRadius || fc.value.card_border_radius || '8px',
    boxShadow: style.value.boxShadow || '0 2px 8px rgba(0,0,0,0.15)',
    overflow: 'hidden' as const,
    color: adaptiveTextColor.value,
    position: 'relative' as const,
  }
  if (!isHorizontal.value) {
    return { ...base, flexDirection: 'column' as const, gap: '0' }
  }
  return { ...base, flexDirection: 'row' as const, gap: style.value.gap || '0' }
})

const imageSectionStyle = computed(() => {
  if (isHorizontal.value) {
    return {
      width: `${imageSectionPercent.value}%`,
      height: '100%',
      flexShrink: 0, flexGrow: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden' as const,
      position: 'relative' as const, zIndex: 1,
    }
  }
  return {
    width: '100%',
    flex: '1 1 0%',
    minHeight: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden' as const,
    padding: shouldOverlayPrice.value ? imageStagePadding.value : '2% 8%',
    position: 'relative' as const, zIndex: 1,
  }
})

const getInfoSectionStyle = (isAfter: boolean) => {
  if (isHorizontal.value) {
    return { flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'stretch', overflow: 'hidden' as const, minWidth: 0, padding: style.value.padding || '2% 3%', gap: style.value.gap || '0', position: 'relative' as const, zIndex: 5 }
  }
  if (isAfter) {
    return {
      position: 'absolute' as const,
      bottom: '2%',
      left: '5%',
      right: '5%',
      width: 'auto',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      overflow: 'visible' as const,
      background: 'transparent',
    }
  }
  return {
    width: '100%',
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    overflow: 'visible' as const,
    position: 'relative' as const,
    zIndex: 3,
  }
}
const infoSectionStyle = computed(() => getInfoSectionStyle(false))
const infoSectionAfterStyle = computed(() => getInfoSectionStyle(true))

// ── Estilos dos elementos individuais ──
const nameEl = computed(() => getEl('text'))
const priceEl = computed(() => getEl('price'))
const obsEl = computed(() => getEl('observation'))
const unitEl = computed(() => getEl('unit'))
const badgeEl = computed(() => getEl('badge'))
const imgEl = computed(() => getEl('image'))
const imageStyle = computed(() => ({
  width: '100%',
  height: '100%',
  maxWidth: '100%',
  maxHeight: '100%',
  display: 'block',
  objectFit: (style.value.imageObjectFit || imgEl.value?.objectFit || 'contain') as any,
  objectPosition: 'center center',
  borderRadius: imgEl.value?.borderRadius || '0',
  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
}))
const duplicateImageSharedStyle = computed(() => ({
  objectFit: (imgEl.value?.objectFit || 'contain') as const,
  objectPosition: 'center top',
  borderRadius: imageStyle.value.borderRadius,
  transform: `scale(${effectiveImageScale.value})`,
  transformOrigin: 'center top',
}))
const duplicateStageStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  overflow: 'visible' as const,
  pointerEvents: 'none' as const,
}))
// Valores configuráveis pelo admin via card_style (com fallbacks)
const cfgDupHStep = computed(() => style.value.dupHorizontalStep || 0)
const cfgDupHLift = computed(() => style.value.dupHorizontalLift || 0)
const cfgDupVStep = computed(() => style.value.dupVerticalStep || 0)
const cfgDupVLift = computed(() => style.value.dupVerticalLift || 0)
const cfgDupWidth = computed(() => style.value.dupImageWidth || 0)

const horizontalDuplicateMetrics = computed(() => {
  const total = Math.max(2, totalImages.value)
  const defaults = total <= 2
    ? { width: 78, step: 18, sidePadding: 3, lift: 4 }
    : total === 3 ? { width: 62, step: 16, sidePadding: 3, lift: 3 }
    : total === 4 ? { width: 52, step: 12, sidePadding: 3, lift: 2.4 }
    : total === 5 ? { width: 44, step: 9, sidePadding: 3, lift: 1.8 }
    : { width: Math.max(34, 44 - ((total - 5) * 1.1)), step: Math.max(5.5, 9 - ((total - 5) * 0.35)), sidePadding: 3, lift: 1.4 }
  return {
    width: cfgDupWidth.value || defaults.width,
    step: cfgDupHStep.value || defaults.step,
    sidePadding: defaults.sidePadding,
    lift: cfgDupHLift.value || defaults.lift,
  }
})
const verticalDuplicateMetrics = computed(() => {
  const total = Math.max(2, totalImages.value)
  const defaults = total <= 2
    ? { width: 94, stepX: 0.5, stepY: 50 }
    : total === 3 ? { width: 92, stepX: 0.4, stepY: 35 }
    : total === 4 ? { width: 90, stepX: 0.35, stepY: 26 }
    : total === 5 ? { width: 88, stepX: 0.3, stepY: 20 }
    : { width: Math.max(78, 88 - ((total - 5) * 1)), stepX: Math.max(0.2, 0.3 - ((total - 5) * 0.02)), stepY: Math.max(12, 20 - ((total - 5) * 1)) }
  return {
    width: cfgDupWidth.value || defaults.width,
    stepX: defaults.stepX,
    stepY: cfgDupVStep.value || defaults.stepY,
  }
})
const gridDuplicateMetrics = computed(() => {
  const total = Math.max(4, totalImages.value)
  const columns = 2
  const rows = Math.ceil(total / columns)
  const gapX = 3.5
  const gapY = 2.5
  const width = 46.5
  const height = (100 - ((rows - 1) * gapY)) / rows
  const startLeft = (100 - ((columns * width) + ((columns - 1) * gapX))) / 2
  return { columns, rows, gapX, gapY, width, height, startLeft }
})
const getHorizontalDuplicateStyle = (index: number) => {
  const total = duplicateImageUrls.value.length
  const { width, step, sidePadding, lift } = horizontalDuplicateMetrics.value
  if (total === 2) {
    // 2 imagens lado a lado — grandes, da parte superior ate a etiqueta de preco
    const lefts = [0, 26]
    const tops = [0, 3]
    const widths = [68, 74]
    const z = [1, 2]
    return {
      ...duplicateImageSharedStyle.value,
      position: 'absolute' as const,
      left: `${lefts[index] ?? lefts[lefts.length - 1]}%`,
      top: `${tops[index] ?? 0}%`,
      width: `${widths[index] ?? widths[widths.length - 1]}%`,
      height: `${100 - (tops[index] ?? 0)}%`,
      zIndex: z[index] ?? index + 1,
      filter: index === 0
        ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
        : 'drop-shadow(4px 5px 10px rgba(0,0,0,0.25))',
    }
  }
  if (total === 3) {
    // 3 imagens lado a lado — grandes, da parte superior ate a etiqueta de preco
    const lefts = [0, 18, 40]
    const tops = [2, 0, 3]
    const widths = [56, 62, 56]
    const z = [1, 3, 2]
    return {
      ...duplicateImageSharedStyle.value,
      position: 'absolute' as const,
      left: `${lefts[index] ?? lefts[lefts.length - 1]}%`,
      top: `${tops[index] ?? 0}%`,
      width: `${widths[index] ?? widths[widths.length - 1]}%`,
      height: `${100 - (tops[index] ?? 0)}%`,
      zIndex: z[index] ?? index + 1,
      filter: index === 1
        ? 'drop-shadow(4px 6px 12px rgba(0,0,0,0.28))'
        : 'drop-shadow(2px 3px 8px rgba(0,0,0,0.18))',
    }
  }
  const availableWidth = 100 - (sidePadding * 2)
  const totalSpan = width + ((total - 1) * step)
  const start = totalSpan <= availableWidth
    ? sidePadding + ((availableWidth - totalSpan) / 2)
    : (100 - totalSpan) / 2
  const topOffset = Math.max(0, index * lift)
  return {
    ...duplicateImageSharedStyle.value,
    position: 'absolute' as const,
    top: `${topOffset}%`,
    left: `${start + (index * step)}%`,
    width: `${width}%`,
    height: `${100 - topOffset}%`,
    zIndex: index + 1,
    filter: index === 0
      ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
      : 'drop-shadow(4px 4px 8px rgba(0,0,0,0.25))',
  }
}
const getVerticalDuplicateStyle = (index: number) => {
  const total = duplicateImageUrls.value.length
  const { width, stepX, stepY } = verticalDuplicateMetrics.value
  const totalSpan = width + ((total - 1) * stepX)
  const baseLeft = (100 - totalSpan) / 2
  // Lift configuravel pelo admin ou fallback automatico
  const lift = cfgDupVLift.value || Math.min(35, Math.max(15, Math.round((imageSectionPercent.value - 20) / 2)))
  const topPos = index * stepY
  return {
    ...duplicateImageSharedStyle.value,
    position: 'absolute' as const,
    top: `${topPos}%`,
    left: `${baseLeft + (index * stepX)}%`,
    width: `${width}%`,
    height: '100%',
    transform: `translateY(-${lift}%) ${duplicateImageSharedStyle.value.transform}`,
    zIndex: index + 1,
    filter: index === 0
      ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
      : 'drop-shadow(4px 6px 12px rgba(0,0,0,0.3))',
  }
}
const getGridDuplicateStyle = (index: number) => {
  const { columns, gapX, gapY, width, height, startLeft } = gridDuplicateMetrics.value
  const row = Math.floor(index / columns)
  const col = index % columns
  return {
    ...duplicateImageSharedStyle.value,
    position: 'absolute' as const,
    top: `${row * (height + gapY)}%`,
    left: `${startLeft + (col * (width + gapX))}%`,
    width: `${width}%`,
    height: `${height}%`,
    zIndex: index + 1,
    filter: 'drop-shadow(3px 4px 10px rgba(0,0,0,0.22))',
  }
}

const nameStyle = computed(() => {
  const el = nameEl.value
  const nameColor = style.value.nameColor || ((el?.color && el.color !== 'inherit') ? el.color : adaptiveTextColor.value)
  return {
    fontWeight: style.value.nameFontWeight || el?.fontWeight || 900,
    fontFamily: style.value.nameFontFamily || el?.fontFamily || fc.value.name_font_family || "'Montserrat', 'Anton', sans-serif",
    textAlign: (style.value.nameTextAlign || el?.textAlign || 'center') as any,
    textTransform: (style.value.nameTextTransform || el?.textTransform || fc.value.name_text_transform || 'uppercase') as any,
    color: nameColor,
    background: 'transparent',
    lineHeight: '1.05',
    padding: el?.padding || style.value.namePadding || '3% 5% 1%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    justifyContent: 'center',
    flexShrink: 0,
    flexGrow: 0,
  }
})
const nameTextStyle = computed(() => ({
  width: '100%',
  fontWeight: nameStyle.value.fontWeight,
  fontFamily: nameStyle.value.fontFamily,
  textAlign: nameStyle.value.textAlign,
  textTransform: nameStyle.value.textTransform,
  color: nameStyle.value.color,
  lineHeight: '1.05',
  wordBreak: 'break-word' as const,
  letterSpacing: '-0.02em',
}))

const priceStyle = computed(() => {
  // Container de dimensoes para o BuilderAutoScaleBox — SEM background proprio
  const w = cardWidth.value || 300
  const tagWidth = Math.max(240, Math.round(w * 0.90))
  const tagHeight = Math.max(100, Math.round(tagWidth * 0.35))
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${tagWidth}px`,
    height: `${tagHeight}px`,
    background: 'transparent',
    fontSize: priceScale.value !== 1 ? `${priceScale.value}em` : undefined,
  }
})

const obsStyle = computed(() => {
  const el = obsEl.value
  return {
    fontSize: el?.fontSize && el.fontSize !== 'auto'
      ? el.fontSize
      : `${Math.max(9, Math.round(baseFontSize.value * 0.45))}px`,
    color: el?.color || 'rgba(0,0,0,0.5)',
    textAlign: (el?.textAlign || 'center') as any,
    padding: el?.padding || '0 3%',
    lineHeight: '1.2',
    overflow: el?.overflow || 'hidden',
    flexShrink: 0,
  }
})

const unitStyle = computed(() => {
  const el = unitEl.value
  return {
    fontSize: el?.fontSize && el.fontSize !== 'auto'
      ? el.fontSize
      : `${Math.max(9, baseFontSize.value * 0.45)}px`,
    color: el?.color || 'rgba(0,0,0,0.45)',
    textAlign: (el?.textAlign || 'right') as any,
    padding: el?.padding || '0 3% 1%',
    flexShrink: 0,
  }
})
const priceTagWrapperStyle = computed(() => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}))

// ── Determinar ordem visual real do template ──
const makeFallbackElement = (
  type: CardTemplateElement['type'],
  order: number,
  slot = '',
): CardTemplateElement => ({
  id: `fallback-${type}-${order}`,
  type,
  slot,
  x: '0%',
  y: '0%',
  w: '100%',
  h: 'auto',
  order,
})

const flowElements = computed<CardTemplateElement[]>(() => {
  const configured = (props.template.elements || [])
    .filter(e => e.type !== 'shape' && e.type !== 'separator' && e.type !== 'badge')
    .map(e => (e.type as string) === 'name' ? { ...e, type: 'text' as const } : e)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (configured.length) return configured

  if (isHorizontal.value) {
    return imagePosition.value === 'right'
      ? [
          makeFallbackElement('text', 0, 'product_name'),
          makeFallbackElement('price', 1, 'offer_price'),
          { ...makeFallbackElement('observation', 2, 'observation'), showIf: 'has_value' },
          { ...makeFallbackElement('unit', 3, 'unit'), showIf: 'has_value' },
          { ...makeFallbackElement('image', 4, 'product_image'), objectFit: 'contain' },
        ]
      : [
          { ...makeFallbackElement('image', 0, 'product_image'), objectFit: 'contain' },
          makeFallbackElement('text', 1, 'product_name'),
          makeFallbackElement('price', 2, 'offer_price'),
          { ...makeFallbackElement('observation', 3, 'observation'), showIf: 'has_value' },
          { ...makeFallbackElement('unit', 4, 'unit'), showIf: 'has_value' },
        ]
  }

  return imagePosition.value === 'bottom'
    ? [
        makeFallbackElement('text', 0, 'product_name'),
        makeFallbackElement('price', 1, 'offer_price'),
        { ...makeFallbackElement('observation', 2, 'observation'), showIf: 'has_value' },
        { ...makeFallbackElement('unit', 3, 'unit'), showIf: 'has_value' },
        { ...makeFallbackElement('image', 4, 'product_image'), objectFit: 'contain' },
      ]
    : [
        makeFallbackElement('text', 0, 'product_name'),
        { ...makeFallbackElement('image', 1, 'product_image'), objectFit: 'contain' },
        makeFallbackElement('price', 2, 'offer_price'),
        { ...makeFallbackElement('observation', 3, 'observation'), showIf: 'has_value' },
        { ...makeFallbackElement('unit', 4, 'unit'), showIf: 'has_value' },
      ]
})

const imageFlowIndex = computed(() =>
  flowElements.value.findIndex(e => e.type === 'image'),
)
const nameFlowIndex = computed(() =>
  flowElements.value.findIndex(e => e.type === 'text'),
)
const isNameBeforeImage = computed(() =>
  nameFlowIndex.value >= 0
  && imageFlowIndex.value >= 0
  && nameFlowIndex.value < imageFlowIndex.value,
)

const infoTypesBeforeImage = computed(() => {
  if (imageFlowIndex.value < 0) return flowElements.value.map(e => e.type).filter(type => type !== 'image')
  return flowElements.value
    .slice(0, imageFlowIndex.value)
    .map(e => e.type)
    .filter(type => type !== 'image')
})

const infoTypesAfterImage = computed(() => {
  if (imageFlowIndex.value < 0) return []
  return flowElements.value
    .slice(imageFlowIndex.value + 1)
    .map(e => e.type)
    .filter(type => type !== 'image')
})
</script>

<template>
  <div ref="rootRef" :style="containerStyle">

    <!-- Marca dagua sutil repetida no fundo -->
    <div
      v-if="!isHorizontal"
      :style="{
        position: 'absolute', inset: '0', zIndex: 0, overflow: 'hidden',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
        gap: '8px', padding: '10px', pointerEvents: 'none', opacity: 0.035,
      }"
    >
      <span
        v-for="i in 30" :key="`wm-${i}`"
        :style="{ fontSize: '14px', fontWeight: 900, color: adaptiveTextColor, whiteSpace: 'nowrap', letterSpacing: '0.1em' }"
      >OFERTAS</span>
    </div>

    <!-- Badge (sempre absoluto no canto) -->
    <div
      v-if="hasEl('badge') && product.badge_style_id"
      :style="{
        position: 'absolute',
        top: badgeEl?.y || '0',
        left: badgeEl?.x || '0',
        zIndex: 10,
        maxWidth: '40%',
      }"
    >
      <BuilderFlyerBadge v-if="badgeStyle" :badge="badgeStyle" />
    </div>

    <!-- +18 indicator -->
    <div
      v-if="product.is_adult"
      :style="{
        position: 'absolute', right: '4%', top: '4%', zIndex: 20,
        background: '#dc2626', color: '#fff', borderRadius: '50%',
        width: '20px', height: '20px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '8px', fontWeight: 900,
      }"
    >+18</div>

    <!-- BLOCO DE INFORMACOES ANTES DA IMAGEM -->
    <div v-if="infoTypesBeforeImage.length" :style="infoSectionStyle">
      <template v-for="elType in infoTypesBeforeImage" :key="`before-${elType}`">
        <div v-if="elType === 'text' && product.custom_name" :style="nameStyle">
          <BuilderAdaptiveText
            tag="div"
            :text="product.custom_name"
            :min-font-px="adaptiveNameMinFont"
            :max-font-px="adaptiveNameMaxFont"
            :max-lines="adaptiveNameMaxLines"
            :line-height="nameLineHeight"
            :style="nameTextStyle"
          />
        </div>

        <div v-else-if="elType === 'price' && (!product.price_mode || product.price_mode !== 'none') && !shouldOverlayPrice" :style="priceStyle">
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
            :style="priceTagWrapperStyle"
          />
        </div>

        <div v-else-if="elType === 'observation' && hasEl('observation')" :style="obsStyle">
          {{ product.observation }}
        </div>

        <div v-else-if="elType === 'unit' && hasEl('unit')" :style="unitStyle">
          {{ product.unit }}
        </div>
      </template>
    </div>

    <!-- IMAGEM -->
    <div v-if="imageUrl" :style="imageSectionStyle">
      <template v-if="hasMultipleImages">
        <div v-if="resolvedExtraImagesLayout === 'horizontal'" :style="duplicateStageStyle">
          <img
            v-for="(dupUrl, dupIdx) in duplicateImageUrls"
            :key="`${dupIdx}-${dupUrl}`"
            :src="dupUrl"
            @load="onProductImageLoad"
            alt=""
            :style="getHorizontalDuplicateStyle(dupIdx)"
          />
        </div>
        <div v-else-if="resolvedExtraImagesLayout === 'vertical'" :style="duplicateStageStyle">
          <img
            v-for="(dupUrl, dupIdx) in duplicateImageUrls"
            :key="`${dupIdx}-${dupUrl}`"
            :src="dupUrl"
            @load="onProductImageLoad"
            alt=""
            :style="getVerticalDuplicateStyle(dupIdx)"
          />
        </div>
        <div v-else :style="duplicateStageStyle">
          <img
            v-for="(dupUrl, dupIdx) in duplicateImageUrls"
            :key="`${dupIdx}-${dupUrl}`"
            :src="dupUrl"
            @load="onProductImageLoad"
            alt=""
            :style="getGridDuplicateStyle(dupIdx)"
          />
        </div>
      </template>
      <img
        v-else-if="!imageLoadFailed"
        :src="imageUrl"
        @load="onProductImageLoad"
        @error="onImageError"
        alt=""
        :style="imageStyle"
      />
      <span v-else :style="{ fontSize: '10px', color: '#ccc', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }">Erro img</span>
      <div v-if="shouldOverlayPrice" :style="overlayPriceStyle">
        <BuilderFlyerPriceTag
          :product="product"
          :tag-style="priceTagStyle"
          :is-highlight="isHighlight"
          :style="priceTagWrapperStyle"
        />
      </div>
    </div>

    <!-- Imagem placeholder quando nao tem -->
    <div v-else :style="{ ...imageSectionStyle, background: 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }">
      <span :style="{ fontSize: '11px', color: '#aaa', fontWeight: 500, opacity: 0.6 }">Sem imagem</span>
      <div v-if="shouldOverlayPrice" :style="overlayPriceStyle">
        <BuilderFlyerPriceTag
          :product="product"
          :tag-style="priceTagStyle"
          :is-highlight="isHighlight"
          :style="priceTagWrapperStyle"
        />
      </div>
    </div>

    <!-- BLOCO DE INFORMACOES DEPOIS DA IMAGEM (etiqueta absolute no rodape) -->
    <div v-if="infoTypesAfterImage.length" :style="infoSectionAfterStyle">
      <template v-for="elType in infoTypesAfterImage" :key="`after-${elType}`">
        <div v-if="elType === 'text' && product.custom_name" :style="nameStyle">
          <BuilderAdaptiveText
            tag="div"
            :text="product.custom_name"
            :min-font-px="adaptiveNameMinFont"
            :max-font-px="adaptiveNameMaxFont"
            :max-lines="adaptiveNameMaxLines"
            :line-height="nameLineHeight"
            :style="nameTextStyle"
          />
        </div>

        <div v-else-if="elType === 'price' && (!product.price_mode || product.price_mode !== 'none') && !shouldOverlayPrice" :style="priceStyle">
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
            :style="priceTagWrapperStyle"
          />
        </div>

        <div v-else-if="elType === 'observation' && hasEl('observation')" :style="obsStyle">
          {{ product.observation }}
        </div>

        <div v-else-if="elType === 'unit' && hasEl('unit')" :style="unitStyle">
          {{ product.unit }}
        </div>
      </template>
    </div>

    <!-- Shapes decorativos (posicao absoluta — esses sim ficam com absolute) -->
    <template v-for="el in (template.elements || []).filter(e => e.type === 'shape' || e.type === 'separator')" :key="el.id">
      <div :style="{
        position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
        background: el.bg, borderRadius: el.borderRadius, opacity: el.opacity,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        zIndex: el.zIndex || 1, pointerEvents: 'none',
      }" />
    </template>
  </div>
</template>
