<script setup lang="ts">
import type { BuilderFlyerProduct, BuilderBadgeStyle, BuilderPriceTagStyle } from '~/types/builder'
import { getLayoutForBox, parseXSplit, parseYSplit, parseInvasion, parseOrdem, type ProductBoxLayoutConfig } from '~/composables/useProductBoxLayout'
import { getBuilderCardAdaptiveBudget, getBuilderCardBaseFont, getBuilderCardNameFont } from '~/utils/builder-card-responsive'

const props = defineProps<{
  product: BuilderFlyerProduct
  isHighlight: boolean
  columns?: number
  boxIndex?: number
  pageProductCount?: number
}>()

const { flyer, theme, priceTagStyles, cardTemplates } = useBuilderFlyer()

// Ler configuracoes do card template ativo (se houver)
// Se o flyer tem card_template_id usa esse, senao usa o primeiro template ativo como padrao
const activeCardTemplate = computed(() => {
  const tplId = (flyer.value as any)?.card_template_id
  if (tplId) return cardTemplates.value.find((t: any) => t.id === tplId) || null
  // Fallback: usa primeiro template ativo como padrao de configuracao
  if (cardTemplates.value.length > 0) return cardTemplates.value[0] || null
  return null
})
const tplStyle = computed(() => {
  const tpl = activeCardTemplate.value
  const s = tpl?.card_style || {}
  console.log('[Card] activeCardTemplate:', tpl?.name || 'NENHUM', '| cardTemplates.length:', cardTemplates.value.length, '| tplStyle:', JSON.stringify(s))
  return s
})

// Badge text: usa badge_style_id como texto do badge
const badgeText = computed(() => props.product.badge_style_id || '')

// Badge colors baseado no texto
const badgeColors = computed(() => {
  const text = badgeText.value.toUpperCase()
  if (text.includes('NOVIDADE')) return { bg: '#1565C0', color: '#fff' }
  if (text.includes('VENDIDO')) return { bg: '#E65100', color: '#fff' }
  if (text.includes('IMPERDIVEL') || text.includes('IMPERDÍVEL')) return { bg: '#6A1B9A', color: '#fff' }
  if (text.includes('PROMO')) return { bg: '#F9A825', color: '#1a1a1a' }
  return { bg: '#D32F2F', color: '#fff' } // OFERTA e outros: vermelho
})

// Manter compatibilidade com BadgeStyle (para outros content modes que usam)
const badgeStyle = computed<BuilderBadgeStyle | null>(() => {
  if (!badgeText.value) return null
  return {
    id: badgeText.value,
    name: badgeText.value,
    thumbnail: null,
    type: 'OFFER',
    css_config: {
      bgColor: badgeColors.value.bg,
      textColor: badgeColors.value.color,
      text: badgeText.value,
      position: 'top-right',
    },
    is_global: true,
    is_active: true,
    sort_order: 0,
  }
})

const priceTagStyle = computed<BuilderPriceTagStyle | null>(() => {
  const styleId = props.product.price_tag_style_id || flyer.value?.price_tag_style_id
  if (!styleId) return null
  return priceTagStyles.value.find(s => s.id === styleId) || null
})

// ── Box layout config (16 variations) ──────────────────────────────────────
const boxMode = computed(() => flyer.value?.product_box_style ?? 'smart')

const layoutConfig = computed<ProductBoxLayoutConfig>(() => {
  return getLayoutForBox(props.boxIndex ?? 0, props.isHighlight, boxMode.value)
})

// Parsed layout values
const renderOrder = computed(() => parseOrdem(layoutConfig.value.ordem))
const xSplit = computed(() => parseXSplit(layoutConfig.value.x))
const ySplit = computed(() => parseYSplit(layoutConfig.value.y))
const invasion = computed(() => parseInvasion(layoutConfig.value.invadir))
const contentMode = computed(() => layoutConfig.value.content)
const etiquetaMode = computed(() => layoutConfig.value.etiqueta)
const pageProductCount = computed(() => Math.max(1, props.pageProductCount ?? props.columns ?? 1))
const productNameLength = computed(() => props.product.custom_name?.trim().length || 0)
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

// ── Is this a columnar layout (image left, info right)? ────────────────────
const isColumnar = computed(() =>
  contentMode.value === 'CONTENT_COL_ETIQUETA_TITULO'
  || contentMode.value === 'CONTENT_ROW_ETIQUETA_IMAGEM'
  || contentMode.value === 'CONTENT_ROW_BOTTOM',
)

// ── Font size ───────────────────────────────────────────────────────────────
const borderRadius = computed(() => fontConfig.value.card_border_radius || theme.value?.css_config?.borderRadius || '8px')

// ── Font config do flyer (fonte e text-transform dos nomes) ────────────────
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const nameFontFamily = computed(() => fontConfig.value.name_font_family || 'inherit')
const nameTextTransform = computed(() => fontConfig.value.name_text_transform || 'uppercase')

// Layout do card: classico (1), lateral (2), premium (3)
const cardLayout = computed(() => fontConfig.value.card_layout || 'classico')
const isHorizontalCardLayout = computed(() =>
  cardLayout.value === 'lateral'
  || cardLayout.value === 'mini'
  || cardLayout.value === 'etiqueta',
)

// Dynamic base font size based on grid columns
const baseFontSize = computed(() => {
  return getBuilderCardBaseFont(
    props.columns ?? 3,
    pageProductCount.value,
    props.isHighlight ? 4 : 0,
  )
})
const nameFontPx = computed(() =>
  getBuilderCardNameFont(
    baseFontSize.value,
    productNameLength.value,
    pageProductCount.value,
  ),
)
const cardBudget = computed(() => getBuilderCardAdaptiveBudget({
  width: cardWidth.value,
  height: cardHeight.value,
  productCount: pageProductCount.value,
  hasObservation: !!props.product.observation,
  layout: isHorizontalCardLayout.value ? 'horizontal' : 'vertical',
}))
const isTallVerticalCard = computed(() =>
  !isHorizontalCardLayout.value && cardBudget.value.aspectRatio < 0.82,
)
const isVeryTallVerticalCard = computed(() =>
  !isHorizontalCardLayout.value && cardBudget.value.aspectRatio < 0.62,
)
const estimatedNameCharsPerLine = computed(() => {
  if (cardWidth.value > 0 && cardWidth.value < 210) return 12
  if (cardWidth.value > 0 && cardWidth.value < 260) return 15
  if (cardWidth.value > 0 && cardWidth.value < 340) return 18
  return 21
})
const estimatedNameLines = computed(() =>
  Math.max(1, Math.min(4, Math.ceil(productNameLength.value / estimatedNameCharsPerLine.value))),
)
const adaptiveNameMinFont = computed(() =>
  Math.min(
    Math.max(9, nameFontPx.value - 1),
    Math.max(9, cardBudget.value.nameMinFontPx),
  ),
)
const getAdaptiveNameMaxFont = (multiplier = 1) =>
  Math.max(9, Math.round(nameFontPx.value * cardBudget.value.nameMaxFontMultiplier * multiplier * 0.91))
const classicoNameMaxFont = computed(() => {
  const base = getAdaptiveNameMaxFont(isTallVerticalCard.value ? 1.04 : 0.98)
  return Math.round(base * (tplStyle.value.nameScale || 1))
})
const getAdaptiveNameMaxLines = (extraLines = 0) =>
  Math.max(2, cardBudget.value.nameMaxLines + extraLines)
const classicoNameMaxLines = computed(() => {
  if (tplStyle.value.nameMaxLines) return tplStyle.value.nameMaxLines
  return Math.max(getAdaptiveNameMaxLines(1), estimatedNameLines.value)
})
const observationFontSize = computed(() => `${Math.max(8, Math.round(nameFontPx.value * 0.42))}px`)
const verticalNameSlotHeight = computed(() => {
  const fallbackHeight = Math.round(baseFontSize.value * 10)
  const rawHeight = Math.round((cardHeight.value || fallbackHeight) * cardBudget.value.nameShare)
  const compression = estimatedNameLines.value >= 4
    ? 1
    : estimatedNameLines.value === 3
      ? (isVeryTallVerticalCard.value ? 0.92 : isTallVerticalCard.value ? 0.96 : 1)
      : estimatedNameLines.value === 2
        ? (isVeryTallVerticalCard.value ? 0.74 : isTallVerticalCard.value ? 0.82 : 0.9)
        : (isVeryTallVerticalCard.value ? 0.58 : isTallVerticalCard.value ? 0.68 : 0.82)
  const contentHeight = Math.round(classicoNameMaxFont.value * estimatedNameLines.value * (pageProductCount.value <= 2 ? 1.08 : 1.14))
  const observationHeight = props.product.observation ? Math.round(classicoNameMaxFont.value * 0.5) : 0
  return Math.max(28, Math.round(rawHeight * compression), contentHeight + observationHeight + 10)
})
const verticalPriceSlotHeight = computed(() => {
  const fallbackHeight = Math.round(baseFontSize.value * 10)
  const rawHeight = Math.round((cardHeight.value || fallbackHeight) * Math.max(cardBudget.value.priceShare, 0.3))
  const boost = isVeryTallVerticalCard.value ? 1.18 : isTallVerticalCard.value ? 1.12 : 1.04
  const scale = tplStyle.value.priceScale || 1
  return Math.max(104, Math.round(rawHeight * boost * scale))
})
const verticalNameAreaStyle = computed(() => ({
  width: '100%',
  minWidth: '0',
  minHeight: `${verticalNameSlotHeight.value}px`,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
}))
const verticalPriceAreaStyle = computed(() => ({
  width: '100%',
  minWidth: '0',
  minHeight: `${verticalPriceSlotHeight.value}px`,
  height: `${verticalPriceSlotHeight.value}px`,
}))
const classicoPriceOverlayStyle = computed(() => ({
  position: 'absolute' as const,
  left: '50%',
  bottom: '10px',
  transform: 'translateX(-50%)',
  width: isTallVerticalCard.value ? '92%' : '88%',
  maxWidth: isTallVerticalCard.value ? '380px' : '360px',
  height: `${Math.max(108, Math.round(verticalPriceSlotHeight.value * 1.14))}px`,
  zIndex: 16,
  pointerEvents: 'none' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'flex-end',
}))
const classicoImageAreaStyle = computed(() => ({
  overflow: 'hidden',
  width: '100%',
  position: 'relative' as const,
  zIndex: 1,
  padding: `0 ${isTallVerticalCard.value ? '1.5%' : '2.5%'} ${Math.max(12, Math.round(verticalPriceSlotHeight.value * (isTallVerticalCard.value ? 0.13 : 0.16)))}px`,
  alignItems: 'flex-start',
  justifyContent: 'center',
}))
const classicoImageStageStyle = computed(() => ({
  width: isVeryTallVerticalCard.value ? '120%' : isTallVerticalCard.value ? '114%' : '108%',
  height: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  position: 'relative' as const,
  margin: '0 auto',
}))
const classicoSingleImageStyle = computed(() => ({
  width: '100%',
  height: '100%',
  maxWidth: isVeryTallVerticalCard.value ? '118%' : isTallVerticalCard.value ? '114%' : '108%',
  maxHeight: isVeryTallVerticalCard.value ? '132%' : isTallVerticalCard.value ? '126%' : '120%',
  objectFit: 'contain' as const,
  display: 'block',
}))

const cardBg = computed(() => fontConfig.value.card_bg_color || (flyer.value as any)?.card_bg_color || '#ffffff')
const cardText = computed(() => fontConfig.value.card_text_color || (flyer.value as any)?.card_text_color || '#000000')

const cardStyle = computed(() => ({
  backgroundColor: cardBg.value,
  borderRadius: borderRadius.value,
  color: cardText.value,
  opacity: props.product.bg_opacity ?? 1,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}))

// Proxy URL for product images stored in Wasabi
const imageUrl = computed(() => {
  const img = props.product.custom_image
  if (!img) return null
  if (img.startsWith('/api/')) return img
  const wasabiMatch = img.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+?)(\?.*)?$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1]!)}`
  if (img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.startsWith('products/') || img.startsWith('imagens/') || img.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
})

// Extra images (multiple images per product)
const resolveImgUrl = (img: string | null) => {
  if (!img) return null
  if (img.startsWith('/api/')) return img
  const wasabiMatch = img.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+?)(\?.*)?$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1]!)}`
  if (img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.startsWith('products/') || img.startsWith('imagens/') || img.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
}

const extraImageUrls = computed(() => {
  const extras = props.product.extra_images || []
  return extras.map((img: string) => resolveImgUrl(img)).filter(Boolean) as string[]
})

const hasMultipleImages = computed(() => extraImageUrls.value.length > 0 && imageUrl.value)
const totalImages = computed(() => hasMultipleImages.value ? 1 + extraImageUrls.value.length : 1)
const duplicateImageUrls = computed(() => imageUrl.value ? [imageUrl.value, ...extraImageUrls.value] : [])

// Layout das imagens extras: 'auto' detecta, 'horizontal' lado a lado, 'vertical' empilhado
const extraImagesLayout = computed(() => {
  const layout = props.product.extra_images_layout || 'auto'
  if (layout !== 'auto') return layout
  return 'horizontal'
})

const horizontalDuplicateMetrics = computed(() => {
  const total = Math.max(2, totalImages.value)
  if (total <= 2) return { width: 82, step: 22, sidePadding: 1, lift: 2.5 }
  if (total === 3) return { width: 68, step: 18, sidePadding: 1, lift: 2 }
  if (total === 4) return { width: 58, step: 14, sidePadding: 1, lift: 1.5 }
  if (total === 5) return { width: 52, step: 11, sidePadding: 1, lift: 1.2 }
  return {
    width: Math.max(44, 52 - ((total - 5) * 2.2)),
    step: Math.max(7.5, 11 - ((total - 5) * 0.7)),
    sidePadding: 1,
    lift: 1,
  }
})

const verticalDuplicateMetrics = computed(() => {
  const total = Math.max(2, totalImages.value)
  if (total <= 2) return { width: 130, stepX: 8, stepY: 12 }
  if (total === 3) return { width: 126, stepX: 6, stepY: 9 }
  if (total === 4) return { width: 122, stepX: 5, stepY: 7 }
  if (total === 5) return { width: 118, stepX: 4, stepY: 5.5 }
  return {
    width: Math.max(108, 118 - ((total - 5) * 1.8)),
    stepX: Math.max(2.5, 4 - ((total - 5) * 0.3)),
    stepY: Math.max(3.5, 5.5 - ((total - 5) * 0.35)),
  }
})

const getHorizontalDuplicateStyle = (index: number) => {
  const total = duplicateImageUrls.value.length
  const { width, step, sidePadding, lift } = horizontalDuplicateMetrics.value
  const availableWidth = 100 - (sidePadding * 2)
  const totalSpan = width + ((total - 1) * step)
  const start = totalSpan <= availableWidth
    ? sidePadding + ((availableWidth - totalSpan) / 2)
    : (100 - totalSpan) / 2
  const topOffset = Math.max(0, (total - index - 1) * lift)
  return {
    position: 'absolute' as const,
    top: `${topOffset}%`,
    left: `${start + (index * step)}%`,
    width: `${width}%`,
    height: `${100 - topOffset}%`,
    objectFit: 'contain' as const,
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
  return {
    position: 'absolute' as const,
    top: `${index * stepY}%`,
    left: `${baseLeft + (index * stepX)}%`,
    width: `${width}%`,
    height: `${Math.max(80, 100 - (index * stepY * 0.5))}%`,
    objectFit: 'contain' as const,
    zIndex: index + 1,
    filter: index === 0
      ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
      : 'drop-shadow(4px 6px 12px rgba(0,0,0,0.3))',
  }
}

// Aspect ratio da imagem principal (detectado via onload)
const imgAspectRatio = ref(1) // >1 = paisagem (caixa), <1 = retrato (garrafa)
const onMainImgLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) {
    imgAspectRatio.value = img.naturalWidth / img.naturalHeight
  }
}

// Offset vertical inteligente baseado no aspect ratio
// Imagem larga (caixa, ratio > 1.2): offset pequeno (8%)
// Imagem quadrada (ratio ~1): offset medio (12%)
// Imagem alta (garrafa, ratio < 0.8): offset grande (18%)
const verticalOffset = computed(() => {
  const r = imgAspectRatio.value
  if (r > 1.3) return 3
  if (r > 1) return 5
  if (r > 0.7) return 8
  return 10
})

// Image crop style
const imageZoom = computed(() => props.product.image_zoom ?? 100)
const imageX = computed(() => props.product.image_x ?? 0)
const imageY = computed(() => props.product.image_y ?? 0)

const imgItemStyle = computed(() => {
  if (!imageUrl.value) return {}
  return {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain' as const,
  }
})

const buildNameBaseStyle = (
  extra: Record<string, string | number> = {},
) => ({
  fontFamily: nameFontFamily.value,
  textTransform: nameTextTransform.value,
  lineHeight: pageProductCount.value <= 2 ? '1.02' : '1.08',
  whiteSpace: 'normal' as const,
  overflowWrap: 'break-word' as const,
  wordBreak: 'normal' as const,
  hyphens: 'auto' as const,
  ...extra,
})

const buildNameStyle = (
  multiplier = 1,
  extra: Record<string, string | number> = {},
) => ({
  fontSize: `${getBuilderCardNameFont(
    baseFontSize.value,
    productNameLength.value,
    pageProductCount.value,
    multiplier,
  )}px`,
  ...buildNameBaseStyle(extra),
})

// ── Container styles based on layout config ─────────────────────────────────

// Root container class
const rootClass = computed(() => {
  if (isColumnar.value) return 'flex flex-row'
  return 'flex flex-col'
})

// Image wrapper style
const imageWrapperStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isColumnar.value) {
    // Columnar: X_ controls width split
    style.width = `${xSplit.value.imagePercent}%`
    style.height = '100%'
    style.flexShrink = '0'
  } else if (contentMode.value === 'CONTENT_LINE') {
    // CONTENT_LINE: imagem pega todo espaço restante (título e etiqueta são shrink-0)
    style.flex = '1'
    style.minHeight = '0'
  } else {
    // Outros modos verticais: usa split proporcional
    style.flex = `${ySplit.value.topPercent}`
    style.minHeight = '0'
  }
  // Sempre overflow hidden — imagem nunca pode sair do card
  style.overflow = 'hidden'
  return style
})

// Info wrapper style (name + price tag area)
const infoWrapperStyle = computed(() => {
  const style: Record<string, string> = {}
  if (isColumnar.value) {
    style.width = `${xSplit.value.infoPercent}%`
    style.height = '100%'
  } else {
    style.flex = `${ySplit.value.bottomPercent}`
  }
  return style
})

// For CONTENT_ROW_BOTTOM / CONTENT_ROW_ETIQUETA_IMAGEM:
// title gets Y top, then image+etiqueta share the bottom in a row
const titleWrapperStyle = computed(() => {
  if (contentMode.value === 'CONTENT_ROW_BOTTOM' || contentMode.value === 'CONTENT_ROW_ETIQUETA_IMAGEM') {
    return { flex: `${ySplit.value.topPercent}`, minHeight: '0' }
  }
  return {}
})

const bottomRowStyle = computed(() => {
  if (contentMode.value === 'CONTENT_ROW_BOTTOM' || contentMode.value === 'CONTENT_ROW_ETIQUETA_IMAGEM') {
    return { flex: `${ySplit.value.bottomPercent}`, display: 'flex', flexDirection: 'row' as const, minHeight: '0' }
  }
  return {}
})
</script>

<template>
  <div
    ref="rootRef"
    class="relative overflow-hidden min-h-0"
    :class="[
      cardLayout === 'lateral' || cardLayout === 'mini' || cardLayout === 'etiqueta' ? 'flex flex-row' : 'flex flex-col',
    ]"
    :style="{
      ...cardStyle,
      border: isHighlight ? '3px solid var(--builder-accent, var(--builder-primary, #10b981))'
        : cardLayout === 'tabloide' ? '3px solid #D32F2F'
        : cardLayout === 'elegante' ? '1px solid #D4AF37'
        : cardLayout === 'glassmorphism' ? '1px solid rgba(255,255,255,0.3)'
        : cardLayout === 'minimalista' ? 'none'
        : '1px solid rgba(0,0,0,0.12)',
      fontSize: `${baseFontSize}px`,
      background: cardLayout === 'dark' ? '#1a1a2e'
        : cardLayout === 'splash' ? 'var(--builder-primary, #E53935)'
        : cardLayout === 'glassmorphism' ? 'rgba(255,255,255,0.65)'
        : cardLayout === 'tabloide' ? '#FFFDE7'
        : cardLayout === 'elegante' ? '#FFFEF5'
        : isHighlight ? `linear-gradient(135deg, ${cardBg}, ${cardBg}ee)` : cardBg,
      boxShadow: cardLayout === 'minimalista' ? '0 2px 12px rgba(0,0,0,0.08)'
        : cardLayout === 'card3d' ? '0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)'
        : cardStyle.boxShadow,
      borderRadius: cardLayout === 'card3d' ? '16px'
        : cardLayout === 'minimalista' ? '12px'
        : borderRadius,
      backdropFilter: cardLayout === 'glassmorphism' ? 'blur(12px)' : undefined,
    }"
  >
    <!-- Badge -->
    <BuilderFlyerBadge
      v-if="badgeStyle"
      :badge="badgeStyle"
    />

    <!-- 18+ indicator -->
    <div
      v-if="product.is_adult"
      class="absolute top-1 left-1 z-20 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center"
    >
      <span class="text-[7px] font-bold text-white leading-none">18+</span>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT CLASSICO: Nome topo, Imagem centro, Preco embaixo          -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-if="cardLayout === 'classico'">
      <!-- 1. NOME (topo) -->
      <div class="shrink-0" :style="{ ...verticalNameAreaStyle, padding: '4px 6px 2px', margin: 0 }">
        <BuilderAdaptiveText
          v-if="product.custom_name"
          tag="p"
          class="font-extrabold text-center"
          :text="product.custom_name"
          :min-font-px="adaptiveNameMinFont"
          :max-font-px="classicoNameMaxFont"
          :max-lines="classicoNameMaxLines"
          :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
          :style="buildNameBaseStyle({ fontWeight: tplStyle.nameFontWeight || 900, textAlign: 'center', maxWidth: '95%', margin: '0 auto' })"
        />
        <p v-if="product.observation" class="opacity-50 leading-tight text-center" :style="{ fontSize: observationFontSize }">{{ product.observation }}</p>
      </div>

      <!-- PRECO ABAIXO DO NOME (quando pricePosition = 'below') -->
      <div v-if="tplStyle.pricePosition === 'below'" class="shrink-0 text-center" :style="{ padding: tplStyle.pricePadding || '4px 6px 6px', fontSize: `${baseFontSize * (tplStyle.priceScale || 1) * 1.8}px` }">
        <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" />
      </div>

      <!-- IMAGEM (topo = antes do preco overlay / base = depois do preco) -->
      <div class="flex-1 min-h-0 flex" :style="classicoImageAreaStyle">
        <template v-if="hasMultipleImages">
          <div v-if="extraImagesLayout !== 'vertical'" :style="classicoImageStageStyle">
            <img v-for="(dupUrl, dupIdx) in duplicateImageUrls" :key="`${dupIdx}-${dupUrl}`" :src="dupUrl" @load="onMainImgLoad" :style="getHorizontalDuplicateStyle(dupIdx)" alt="" draggable="false" />
          </div>
          <div v-else style="width: 94%; height: 100%; position: relative; margin: 0 auto">
            <img v-for="(dupUrl, dupIdx) in duplicateImageUrls" :key="`${dupIdx}-${dupUrl}`" :src="dupUrl" @load="onMainImgLoad" :style="getVerticalDuplicateStyle(dupIdx)" alt="" draggable="false" />
          </div>
        </template>
        <div v-else-if="imageUrl" :style="classicoImageStageStyle">
          <img :src="imageUrl" @load="onMainImgLoad" :style="classicoSingleImageStyle" alt="" draggable="false" />
        </div>
        <div v-else class="opacity-20"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
      </div>

      <!-- PRECO OVERLAY (padrao quando nao e 'below') -->
      <div v-if="tplStyle.pricePosition !== 'below'" :style="{ ...classicoPriceOverlayStyle, fontSize: `${baseFontSize * (tplStyle.priceScale || 1)}px` }">
        <div style="width: 100%; height: 100%; min-height: 0">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" style="width: 100%; height: 100%" />
        </div>
        <p v-if="product.purchase_limit" class="text-[0.45em] mt-0.5 opacity-50 leading-tight" style="background: rgba(255,255,255,0.82); padding: 2px 6px; border-radius: 999px">Limite: {{ product.purchase_limit }} por cliente</p>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT LATERAL: [IMAGEM esquerda] | [NOME + ETIQUETA direita]     -->
    <!-- Flexbox row, imagem 45%, info 55% centralizada verticalmente      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-else-if="cardLayout === 'lateral'">
      <!-- Lado esquerdo: imagem 43% -->
      <div style="width: 43%; flex-shrink: 0; padding: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; height: 100%">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
        <div v-else class="opacity-20">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <!-- Lado direito: nome + etiqueta GRANDE, centralizados verticalmente -->
      <div style="width: 57%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 16px; gap: 6px">
        <BuilderAdaptiveText
          v-if="product.custom_name"
          tag="p"
          class="font-extrabold text-center"
          :text="product.custom_name"
          :min-font-px="adaptiveNameMinFont"
          :max-font-px="getAdaptiveNameMaxFont(1.02)"
          :max-lines="getAdaptiveNameMaxLines()"
          :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
          :style="buildNameBaseStyle({ fontWeight: 800, textAlign: 'center' })"
        />
        <p
          v-if="product.observation"
          class="opacity-50 leading-tight text-center"
          :style="{ fontSize: observationFontSize }"
        >
          {{ product.observation }}
        </p>
        <div :style="{ width: '100%', height: `${Math.max(56, Math.round(verticalPriceSlotHeight * 0.9))}px` }">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" style="width: 100%; height: 100%" />
        </div>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT PREMIUM: Imagem GRANDE em cima, [Nome | Preco] embaixo     -->
    <!-- Estilo encarte supermercado — imagem domina, info na barra inferior -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-else-if="cardLayout === 'premium'">
      <!-- IMAGEM ENORME: 65-70% do card -->
      <div style="flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; padding: 12px 12px 4px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 90%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
        <div v-else class="opacity-20">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <!-- BARRA INFERIOR: Nome esquerda + Etiqueta direita, mesma linha -->
      <div style="flex-shrink: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 12px; gap: 12px">
        <BuilderAdaptiveText
          v-if="product.custom_name"
          tag="div"
          :text="product.custom_name"
          :min-font-px="adaptiveNameMinFont"
          :max-font-px="getAdaptiveNameMaxFont(1.02)"
          :max-lines="getAdaptiveNameMaxLines()"
          :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
          :style="buildNameBaseStyle({ flex: '1 1 0%', minWidth: '0', fontWeight: 900, textAlign: 'left' })"
        />
        <div :style="{ flexShrink: 0, width: '42%', maxWidth: '180px', height: `${Math.max(48, Math.round(verticalPriceSlotHeight * 0.8))}px` }">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" style="width: 100%; height: 100%" />
        </div>
      </div>
    </template>

    <!-- ═══ COMPACTO: card pequeno eficiente ═══ -->
    <template v-else-if="cardLayout === 'compacto'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 4px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 2px 8px 6px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.82, { fontWeight: 700, textAlign: 'center' })">{{ product.custom_name }}</p>
        <p v-if="product.offer_price != null" class="font-extrabold" :style="{ fontSize: '1.1em', color: 'var(--builder-primary, #D32F2F)' }">R$ {{ Number(product.offer_price).toFixed(2).replace('.', ',') }}</p>
      </div>
    </template>

    <!-- ═══ MINI: ultra compacto estilo lista ═══ -->
    <template v-else-if="cardLayout === 'mini'">
      <div style="display: flex; flex-direction: row; align-items: center; height: 100%; padding: 4px 10px; gap: 8px; overflow: hidden">
        <img v-if="imageUrl" :src="imageUrl" style="width: 2.5em; height: 2.5em; object-fit: contain; flex-shrink: 0" alt="" draggable="false" />
        <BuilderAdaptiveText
          v-if="product.custom_name"
          tag="p"
          class="font-bold"
          :text="product.custom_name"
          :min-font-px="Math.max(9, adaptiveNameMinFont - 1)"
          :max-font-px="getAdaptiveNameMaxFont(0.78)"
          :max-lines="getAdaptiveNameMaxLines()"
          :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
          :style="buildNameBaseStyle({ flex: '1 1 0%', minWidth: '0', fontWeight: 700, textAlign: 'left' })"
        />
        <p v-if="product.offer_price != null" class="font-extrabold shrink-0" :style="{ fontSize: '1.1em', color: 'var(--builder-primary, #D32F2F)' }">R$ {{ Number(product.offer_price).toFixed(2).replace('.', ',') }}</p>
      </div>
    </template>

    <!-- ═══ GRADE: so imagem + preco sobreposto, sem nome ═══ -->
    <template v-else-if="cardLayout === 'grade'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 6px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div style="position: absolute; bottom: 6px; right: 6px; z-index: 20; font-size: 1.1em">
        <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" />
      </div>
    </template>

    <!-- ═══ VITRINE: imagem grande + barra gradiente inferior ═══ -->
    <template v-else-if="cardLayout === 'vitrine'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 8px 8px 0">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 8px 14px; background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4)); color: #fff; gap: 4px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.95, { width: '100%', fontWeight: 700, textAlign: 'center', color: '#fff' })">{{ product.custom_name }}</p>
        <div style="font-size: 1.15em">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" />
        </div>
      </div>
    </template>

    <!-- ═══ SPLASH: fundo vibrante, sombra forte, estilo promo agressiva ═══ -->
    <template v-else-if="cardLayout === 'splash'">
      <div class="shrink-0 text-center" style="padding: 8px 12px 0">
        <p v-if="product.custom_name" class="font-black" :style="buildNameStyle(1.02, { fontWeight: 900, textAlign: 'center', color: '#fff', textShadow: '1px 2px 4px rgba(0,0,0,0.4)' })">{{ product.custom_name }}</p>
      </div>
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 4px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 90%; max-height: 90%; object-fit: contain; filter: drop-shadow(4px 6px 8px rgba(0,0,0,0.5))" alt="" draggable="false" />
      </div>
      <div class="shrink-0 flex items-center justify-center" style="padding: 4px 12px 10px">
        <div style="transform: rotate(-2deg); font-size: 1.3em">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" />
        </div>
      </div>
    </template>

    <!-- ═══ MINIMALISTA: clean, sombra suave, muito respiro ═══ -->
    <template v-else-if="cardLayout === 'minimalista'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 16px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 0 16px 12px">
        <p v-if="product.custom_name" :style="buildNameStyle(0.86, { fontWeight: 300, textAlign: 'center', letterSpacing: '0.5px' })">{{ product.custom_name }}</p>
        <p v-if="product.offer_price != null" class="font-bold" style="margin-top: 6px" :style="{ fontSize: '1.4em', color: 'var(--builder-primary, #1a1a1a)' }">R$ {{ Number(product.offer_price).toFixed(2).replace('.', ',') }}</p>
      </div>
    </template>

    <!-- ═══ FLAT: fundo colorido solido, badge circular ═══ -->
    <template v-else-if="cardLayout === 'flat'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 10px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 4px 12px 10px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.92, { fontWeight: 700, textAlign: 'center' })">{{ product.custom_name }}</p>
        <div v-if="product.offer_price != null" style="display: inline-flex; align-items: center; justify-content: center; margin-top: 4px; padding: 4px 14px; border-radius: 999px; font-weight: 800; color: #fff; background: var(--builder-primary, #E53935)" :style="{ fontSize: '1.05em' }">
          R$ {{ Number(product.offer_price).toFixed(2).replace('.', ',') }}
        </div>
      </div>
    </template>

    <!-- ═══ CARD3D: sombra profunda, borda arredondada ═══ -->
    <template v-else-if="cardLayout === 'card3d'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 12px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 4px 14px 10px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.92, { fontWeight: 700, textAlign: 'center' })">{{ product.custom_name }}</p>
        <div style="margin-top: 6px; display: inline-block; font-size: 1.1em; box-shadow: 0 3px 8px rgba(0,0,0,0.25); border-radius: 8px">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" />
        </div>
      </div>
    </template>

    <!-- ═══ GLASSMORPHISM: vidro semi-transparente ═══ -->
    <template v-else-if="cardLayout === 'glassmorphism'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 10px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 6px 14px 10px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.92, { fontWeight: 700, textAlign: 'center' })">{{ product.custom_name }}</p>
        <div style="margin-top: 4px; font-size: 1.05em">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" />
        </div>
      </div>
    </template>

    <!-- ═══ TABLOIDE: estilo encarte jornal tradicional ═══ -->
    <template v-else-if="cardLayout === 'tabloide'">
      <div class="shrink-0 text-center" style="padding: 6px 10px 2px">
        <p v-if="product.custom_name" class="font-black" :style="buildNameStyle(0.96, { fontWeight: 900, textAlign: 'center', color: '#000' })">{{ product.custom_name }}</p>
      </div>
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 4px 8px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 4px 10px 8px">
        <p v-if="product.offer_price != null" class="font-black" style="color: #D32F2F; line-height: 1">
          <span style="font-size: 0.5em; vertical-align: top">R$</span>
          <span :style="{ fontSize: '1.8em' }">{{ String(Math.floor(Number(product.offer_price))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') }}</span>
          <span style="font-size: 0.7em; vertical-align: top">,{{ (Number(product.offer_price).toFixed(2)).split('.')[1] }}</span>
        </p>
      </div>
    </template>

    <!-- ═══ ETIQUETA: estilo gondola/prateleira, horizontal ═══ -->
    <template v-else-if="cardLayout === 'etiqueta'">
      <div style="display: flex; flex-direction: row; align-items: center; height: 100%; padding: 6px 12px; gap: 8px; overflow: hidden">
        <img v-if="imageUrl" :src="imageUrl" style="width: 3em; height: 3em; object-fit: contain; flex-shrink: 0" alt="" draggable="false" />
        <div style="flex: 1; min-width: 0; overflow: hidden">
          <BuilderAdaptiveText
            v-if="product.custom_name"
            tag="p"
            class="font-semibold"
            :text="product.custom_name"
            :min-font-px="Math.max(9, adaptiveNameMinFont - 1)"
            :max-font-px="getAdaptiveNameMaxFont(0.8)"
            :max-lines="getAdaptiveNameMaxLines()"
            :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
            :style="buildNameBaseStyle({ fontWeight: 600, textAlign: 'left' })"
          />
          <p v-if="product.observation" class="opacity-50" :style="{ fontSize: observationFontSize }">{{ product.observation }}</p>
        </div>
        <div style="flex-shrink: 0; text-align: right">
          <p v-if="product.offer_price != null" class="font-black" style="color: #D32F2F; line-height: 1; white-space: nowrap">
            <span style="font-size: 0.6em">R$</span><span :style="{ fontSize: '1.6em' }">{{ String(Math.floor(Number(product.offer_price))) }}</span><span style="font-size: 0.7em">,{{ (Number(product.offer_price).toFixed(2)).split('.')[1] }}</span>
          </p>
        </div>
      </div>
    </template>

    <!-- ═══ ELEGANTE: gourmet, borda dourada, serifado ═══ -->
    <template v-else-if="cardLayout === 'elegante'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 16px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 0 14px 12px">
        <p v-if="product.custom_name" :style="buildNameStyle(0.82, { fontWeight: 600, textAlign: 'center', fontFamily: 'Georgia, serif', textTransform: 'uppercase', letterSpacing: '2px' })">{{ product.custom_name }}</p>
        <hr style="border: none; border-top: 1px solid #D4AF37; margin: 6px auto; width: 60%" />
        <p v-if="product.offer_price != null" style="line-height: 1; color: #333; margin-top: 4px">
          <span style="font-size: 0.6em; font-weight: 400">R$</span>
          <span class="font-light" :style="{ fontSize: '1.6em' }">{{ Number(product.offer_price).toFixed(2).replace('.', ',') }}</span>
        </p>
      </div>
    </template>

    <!-- ═══ DARK: fundo escuro, preco neon ═══ -->
    <template v-else-if="cardLayout === 'dark'">
      <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding: 10px">
        <img v-if="imageUrl" :src="imageUrl" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 0 8px rgba(0,180,255,0.3))" alt="" draggable="false" />
      </div>
      <div class="shrink-0 text-center" style="padding: 4px 12px 10px">
        <p v-if="product.custom_name" class="font-bold" :style="buildNameStyle(0.94, { fontWeight: 700, textAlign: 'center', color: '#e0e0e0' })">{{ product.custom_name }}</p>
        <p v-if="product.offer_price != null" class="font-black" style="margin-top: 4px; line-height: 1; color: #00d4ff; text-shadow: 0 0 10px rgba(0,212,255,0.5)">
          <span style="font-size: 0.5em">R$</span>
          <span :style="{ fontSize: '1.5em' }">{{ Number(product.offer_price).toFixed(2).replace('.', ',') }}</span>
        </p>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- FALLBACK: Usa layout classico para content modes antigos           -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-else>
      <div class="shrink-0 px-2 pt-1 relative z-10">
        <BuilderAdaptiveText
          v-if="product.custom_name"
          tag="p"
          class="font-extrabold"
          :text="product.custom_name"
          :min-font-px="adaptiveNameMinFont"
          :max-font-px="getAdaptiveNameMaxFont(1)"
          :max-lines="getAdaptiveNameMaxLines()"
          :line-height="pageProductCount <= 2 ? 1.02 : 1.08"
          :style="buildNameBaseStyle({ fontWeight: 800, textAlign: 'center' })"
        />
      </div>
      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="w-full h-full flex items-center justify-center" style="padding: 0.5em 0.3em 0 0.3em">
          <img v-if="imageUrl" :src="imageUrl" :style="imgItemStyle" alt="" draggable="false" />
        </div>
      </div>
      <div class="shrink-0 px-2 py-1.5 text-center relative z-20 flex flex-col items-center justify-center" :style="{ ...verticalPriceAreaStyle }">
        <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" style="width: 100%; height: 100%" />
      </div>
    </template>
  </div>
</template>
