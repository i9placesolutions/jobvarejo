<script setup lang="ts">
/**
 * BuilderDynamicCard v3 — Arquitetura QROfertas
 * CSS Grid com areas nomeadas (TITULO / IMAGE / ETIQUETA)
 * Dimensoes de imagem calculadas em pixels via JS (contain manual)
 * Sistema INVADIR para sobreposicao da etiqueta sobre a imagem
 */
import type { BuilderFlyerProduct, BuilderCardTemplate, BuilderBadgeStyle, CardTemplateElement, BuilderPriceTagStyle } from '~/types/builder'
import { getBuilderCardAdaptiveBudget, getBuilderCardBaseFont } from '~/utils/builder-card-responsive'
import { GRID_LAYOUTS, resolveContentType } from '~/utils/grid-layouts'

const props = defineProps<{
  product: BuilderFlyerProduct
  template: BuilderCardTemplate
  isHighlight?: boolean
  columns?: number
  pageProductCount?: number
}>()

defineEmits<{
  (e: 'open-price-options'): void
  (e: 'open-price-tag'): void
  (e: 'open-bubble'): void
}>()

const { flyer, priceTagStyles } = useBuilderFlyer()
const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const cardBg = computed(() => fc.value.card_bg_color || '#ffffff')
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
const nameScale = computed(() => {
  const raw = Number(style.value.nameScale || 1)
  return Math.min(Math.max(raw, 0.5), 2)
})
const priceScale = computed(() => {
  const raw = Number(style.value.priceScale || 1)
  return Math.min(Math.max(raw, 0.3), 5)
})

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
    id: text, name: text, thumbnail: null, type: 'OFFER',
    css_config: { ...colors, text, position: 'top-right' },
    is_global: true, is_active: true, sort_order: 0,
  }
})

// ── Layer decoration (cor de fundo por produto) ──
const { updateProduct } = useBuilderFlyer()
const productIndex = computed(() => {
  const { products: prods } = useBuilderFlyer()
  return (prods.value || []).findIndex((p: any) => p.id === props.product.id)
})
const layerBg = computed(() => (props.product as any).layer_bg || '')
const layerTextColor = computed(() => (props.product as any).layer_text_color || '')
const layerOpacity = computed(() => (props.product as any).layer_opacity ?? 1)
const showColorModal = ref(false)

const onSelectColor = (color: { bg: string; textColor: string; opacity: number }) => {
  const idx = productIndex.value
  if (idx >= 0) {
    updateProduct(idx, {
      layer_bg: color.bg,
      layer_text_color: color.textColor,
      layer_opacity: color.opacity,
    } as any)
  }
}

// ── Medicao do card e da area de imagem via ResizeObserver ──
const pageProductCount = computed(() => Math.max(1, props.pageProductCount || props.columns || 1))
const rootRef = ref<HTMLElement | null>(null)
const imageSectionRef = ref<HTMLElement | null>(null)
const cardWidth = ref(0)
const cardHeight = ref(0)
const imgSectionWidth = ref(0)
const imgSectionHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

const updateSizes = () => {
  cardWidth.value = rootRef.value?.clientWidth || 0
  cardHeight.value = rootRef.value?.clientHeight || 0
  imgSectionWidth.value = imageSectionRef.value?.clientWidth || 0
  imgSectionHeight.value = imageSectionRef.value?.clientHeight || 0
}

onMounted(async () => {
  await nextTick()
  updateSizes()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => updateSizes())
    if (rootRef.value) resizeObserver.observe(rootRef.value)
    if (imageSectionRef.value) resizeObserver.observe(imageSectionRef.value)
  }
})
onBeforeUnmount(() => { resizeObserver?.disconnect() })

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
  layout: 'vertical',
}))
const isTallVerticalCard = computed(() => cardBudget.value.aspectRatio < 0.82)
const nameLineHeight = computed(() => pageProductCount.value <= 2 ? 1.02 : 1.08)
const configuredNameMaxLines = computed(() => {
  const configured = Number(style.value.nameMaxLines || 0)
  if (configured > 0) return configured
  return cardBudget.value.nameMaxLines
})
const adaptiveNameMaxFont = computed(() =>
  Math.max(9, Math.round(baseFontSize.value * cardBudget.value.nameMaxFontMultiplier * (isTallVerticalCard.value ? 0.94 : 0.91) * nameScale.value)),
)
const adaptiveNameMinFont = computed(() => adaptiveNameMaxFont.value)
const adaptiveNameMaxLines = computed(() => configuredNameMaxLines.value)

// ── Elementos do template por tipo ──
const getEl = (type: string) =>
  props.template.elements?.find(e => e.type === type || ((e.type as string) === 'name' && type === 'text'))
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
const nameEl = computed(() => getEl('text'))
const imgEl = computed(() => getEl('image'))
const badgeEl = computed(() => getEl('badge'))

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

// ══════════════════════════════════════════════════════════════════
// SISTEMA QROFERTAS: CSS Grid + Variaveis CSS + INVADIR
// ══════════════════════════════════════════════════════════════════

// Config QROfertas: template > font_config do flyer > fallback
const contentType = computed(() => fc.value.card_content_type || style.value.contentType || 'CONTENT_LINE')
const ordem = computed(() => style.value.ordem || fc.value.card_ordem || 'TITULO-IMAGEM-ETIQUETA')
const xWeight = computed(() => style.value.xWeight || fc.value.card_x_weight || 'X_60-40')
const yWeight = computed(() => style.value.yWeight || fc.value.card_y_weight || 'Y_50-50')
const invadirLevel = computed(() => style.value.invadir || fc.value.card_invadir || 'NAO_INVADIR')
const etiquetaOrientacao = computed(() => (style.value as any).etiquetaOrientacao || fc.value.card_etiqueta_orientacao || 'HORIZONTAL')

// Parsear pesos X_ para CSS vars (valores exatos da spec QROfertas secao 4)
// peso1 = IMAGE, peso2 = ETIQUETA, peso3 = TITULO (em CONTENT_LINE)
// primary/sec = colunas em CONTENT_ROW_BOTTOM
const xWeightVars = computed(() => {
  const map: Record<string, { primary: string; sec: string; peso1: string; peso2: string; peso3: string }> = {
    'X_50-50': { primary: '50%', sec: '50%', peso1: '33.3%', peso2: '33.3%', peso3: '33.3%' },
    'X_60-40': { primary: '60%', sec: '40%', peso1: '60%', peso2: '20%', peso3: '20%' },
    'X_40-60': { primary: '40%', sec: '60%', peso1: '40%', peso2: '30%', peso3: '30%' },
    'X_70-30': { primary: '30%', sec: '70%', peso1: '70%', peso2: '15%', peso3: '15%' },
    'X_80-20': { primary: '80%', sec: '20%', peso1: '80%', peso2: '10%', peso3: '10%' },
  }
  return map[xWeight.value] || map['X_50-50']!
})

// Parsear pesos Y_
const yWeightVars = computed(() => {
  const map: Record<string, { primary: string; sec: string }> = {
    'Y_50-50': { primary: '50%', sec: '50%' },
    'Y_60-40': { primary: '60%', sec: '40%' },
    'Y_80-20': { primary: '70%', sec: '30%' },
    'Y_20-80': { primary: '30%', sec: '70%' },
  }
  return map[yWeight.value] || map['Y_50-50']!
})

// Valor de invasao
const invadirValue = computed(() => {
  const map: Record<string, string> = {
    'NAO_INVADIR': '0%', 'INVADIR_20': '20%', 'INVADIR_40': '40%',
    'INVADIR_50': '50%', 'INVADIR_60': '60%', 'INVADIR_80': '80%',
    'INVADIR_100': '100%', 'INVADIR_200': '200%',
  }
  return map[invadirLevel.value] || '0%'
})

  // -- CONTAINER STYLE (CSS Grid QROfertas) -- Suporta todos os 36 layouts
  const containerStyle = computed(() => {
    const bg = resolvedCardBg.value
    const base: Record<string, any> = {
      width: '100%',
      height: '100%',
      minHeight: 0,
      minWidth: 0,
      fontSize: `${baseFontSize.value}px`,
      background: bg,
      border: props.isHighlight ? '3px solid var(--builder-accent, #10b981)' : 'none',
      borderRadius: style.value.borderRadius || fc.value.card_border_radius || '8px',
      boxShadow: style.value.boxShadow || '0 1px 4px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      color: adaptiveTextColor.value,
      position: 'relative',
      // Container query context — habilita cqw/cqh/cqmin nos filhos
      containerType: 'inline-size',
      containerName: 'builder-product-card',
      // Dimensoes reais da celula como CSS vars (fallback para clamp com px)
      '--cell-w': `${cardWidth.value || 0}px`,
      '--cell-h': `${cardHeight.value || 0}px`,
      '--cell-min': `${Math.min(cardWidth.value || 0, cardHeight.value || 0)}px`,
      // CSS Variables QROfertas
      '--peso-1': xWeightVars.value.peso1,
      '--peso-2': xWeightVars.value.peso2,
      '--peso-3': xWeightVars.value.peso3,
      '--peso-x-primary': xWeightVars.value.primary,
      '--peso-x-sec': xWeightVars.value.sec,
      '--peso-y-primary': yWeightVars.value.primary,
      '--peso-y-sec': yWeightVars.value.sec,
      '--etiqueta-invadir': invadirValue.value,
    }

    // Resolve o contentType (suporta aliases antigos como CONTENT_LINE, CONTENT_ROW_BOTTOM, etc)
    const resolvedType = resolveContentType(contentType.value)
    const layout = GRID_LAYOUTS[resolvedType]

    if (layout) {
      return {
        ...base,
        display: 'grid',
        gridTemplateAreas: layout.areas,
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
      }
    }

    // Fallback: layout vertical padrao (CONTENT_LINE)
    const fallback = GRID_LAYOUTS['V3_TIE']!
    return {
      ...base,
      display: 'grid',
      gridTemplateAreas: fallback.areas,
      gridTemplateColumns: fallback.columns,
      gridTemplateRows: fallback.rows,
    }
  })

// ── AREA TITULO ──
const nameStyle = computed(() => {
  const el = nameEl.value
  const nameColor = style.value.nameColor || ((el?.color && el.color !== 'inherit') ? el.color : adaptiveTextColor.value)
  return {
    gridArea: 'TITULO',
    zIndex: 3,
    fontWeight: style.value.nameFontWeight || el?.fontWeight || 700,
    fontFamily: style.value.nameFontFamily || el?.fontFamily || fc.value.name_font_family || "'Montserrat', 'Anton', sans-serif",
    textAlign: (style.value.nameTextAlign || el?.textAlign || 'center') as any,
    textTransform: (style.value.nameTextTransform || el?.textTransform || fc.value.name_text_transform || 'uppercase') as any,
    color: nameColor,
    background: style.value.nameBg || 'transparent',
    lineHeight: '1.08',
    padding: el?.padding || style.value.namePadding || '3% 5%',
    margin: 0,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden' as const,
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

// ── AREA IMAGE (abordagem QROfertas) ──
// Container: position relative, flex center
// overflow: hidden por padrao para conter imagem na area; visible se INVADIR ativo
const imageSectionStyle = computed(() => ({
  gridArea: 'IMAGE',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative' as const,
  overflow: 'hidden' as const,
  zIndex: 1,
  minHeight: 0,
  minWidth: 0,
}))

// Calculo de dimensoes em pixels (contain manual via JS)
const imageContainerSize = computed(() => {
  const cw = imgSectionWidth.value || Math.round((cardWidth.value || 300) * 0.90)
  const ch = imgSectionHeight.value || Math.round((cardHeight.value || 400) * 0.65)
  return { w: cw, h: ch }
})

const calcImagePixelSize = computed(() => {
  const natRatio = mainImageAspectRatio.value
  const { w: cW, h: cH } = imageContainerSize.value
  if (!cW || !cH) return { width: cW || 300, height: cH || 400 }
  const containerRatio = cW / cH

  let w: number
  let h: number
  if (natRatio > containerRatio) {
    // Imagem mais larga que o container → fit width
    w = cW
    h = Math.round(cW / natRatio)
  } else {
    // Imagem mais alta que o container → fit height
    h = cH
    w = Math.round(cH * natRatio)
  }

  // Aplicar escala do usuario (imageScale da font_config)
  const scale = imageScale.value
  if (scale !== 1) {
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  return { width: w, height: h }
})

// Estilo da imagem: contain dentro da area, sem transbordar
const imageStyle = computed(() => {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    borderRadius: imgEl.value?.borderRadius || '0',
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
  }
})

// Imagens duplicadas
const duplicateImageSharedStyle = computed(() => ({
  objectFit: 'contain' as const,
  maxWidth: '100%',
  maxHeight: '100%',
  borderRadius: imageStyle.value.borderRadius,
  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
}))
const duplicateStageStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  overflow: 'visible' as const,
  pointerEvents: 'none' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}))

const getHorizontalDuplicateStyle = (index: number) => {
  const total = duplicateImageUrls.value.length
  const { width: imgW, height: imgH } = calcImagePixelSize.value
  if (total === 2) {
    const offsets = [-12, 12]
    const z = [1, 2]
    return {
      ...duplicateImageSharedStyle.value,
      width: `${imgW}px`, height: `${imgH}px`,
      transform: `translateX(${offsets[index]}%)`,
      zIndex: z[index] ?? index + 1,
      filter: index === 0
        ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
        : 'drop-shadow(4px 5px 10px rgba(0,0,0,0.25))',
    }
  }
  if (total === 3) {
    const offsets = [-20, 0, 20]
    const z = [1, 3, 2]
    return {
      ...duplicateImageSharedStyle.value,
      width: `${imgW}px`, height: `${imgH}px`,
      transform: `translateX(${offsets[index]}%)`,
      zIndex: z[index] ?? index + 1,
      filter: index === 1
        ? 'drop-shadow(4px 6px 12px rgba(0,0,0,0.28))'
        : 'drop-shadow(2px 3px 8px rgba(0,0,0,0.18))',
    }
  }
  // 4+ imagens: distribuicao progressiva
  const step = Math.max(5, Math.round(80 / total))
  const totalSpan = (total - 1) * step
  const startOffset = -totalSpan / 2
  return {
    ...duplicateImageSharedStyle.value,
    width: `${imgW}px`, height: `${imgH}px`,
    transform: `translateX(${startOffset + (index * step)}%)`,
    zIndex: index + 1,
    filter: 'drop-shadow(3px 4px 8px rgba(0,0,0,0.2))',
  }
}

const getVerticalDuplicateStyle = (index: number) => {
  const total = duplicateImageUrls.value.length
  const stepY = total <= 2 ? 50 : total === 3 ? 35 : Math.max(12, Math.round(80 / total))
  const width = total <= 2 ? 94 : total <= 4 ? 90 : 85
  const totalSpan = width + ((total - 1) * 0.5)
  const baseLeft = (100 - totalSpan) / 2
  const topPos = index * stepY
  return {
    ...duplicateImageSharedStyle.value,
    position: 'absolute' as const,
    top: `${topPos}%`, left: `${baseLeft + (index * 0.5)}%`,
    width: `${width}%`, height: '100%',
    transform: `translateY(-${Math.min(35, Math.round(stepY / 2))}%)`,
    zIndex: index + 1,
    filter: index === 0
      ? 'drop-shadow(2px 2px 6px rgba(0,0,0,0.12))'
      : 'drop-shadow(4px 6px 12px rgba(0,0,0,0.3))',
  }
}

const getGridDuplicateStyle = (index: number) => {
  const total = Math.max(4, totalImages.value)
  const columns = 2
  const gapX = 3.5
  const gapY = 2.5
  const width = 46.5
  const rows = Math.ceil(total / columns)
  const height = (100 - ((rows - 1) * gapY)) / rows
  const startLeft = (100 - ((columns * width) + ((columns - 1) * gapX))) / 2
  const row = Math.floor(index / columns)
  const col = index % columns
  return {
    ...duplicateImageSharedStyle.value,
    position: 'absolute' as const,
    top: `${row * (height + gapY)}%`,
    left: `${startLeft + (col * (width + gapX))}%`,
    width: `${width}%`, height: `${height}%`,
    zIndex: index + 1,
    filter: 'drop-shadow(3px 4px 10px rgba(0,0,0,0.22))',
  }
}

// ── AREA ETIQUETA (com sistema INVADIR) ──
const priceAreaStyle = computed(() => ({
  gridArea: 'ETIQUETA',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative' as const,
  zIndex: 10,
  overflow: 'visible' as const,
  minHeight: 0,
  // Sistema INVADIR: margem negativa faz etiqueta subir sobre a imagem
  marginTop: invadirValue.value !== '0%' ? `calc(-1 * var(--etiqueta-invadir))` : '0',
}))

const isVerticalEtiqueta = computed(() => etiquetaOrientacao.value === 'VERTICAL')

const priceStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  background: 'transparent',
  fontSize: priceScale.value !== 1 ? `${priceScale.value}em` : undefined,
  // Orientacao da etiqueta (HORIZONTAL = padrao, VERTICAL = rotacionada 90deg)
  ...(isVerticalEtiqueta.value ? {
    transform: 'rotate(-90deg)',
    transformOrigin: 'center center',
  } : {}),
}))

const priceTagWrapperStyle = computed(() => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}))
</script>

<template>
  <div
    ref="rootRef"
    :style="containerStyle"
    :class="[
      'builder-product-card',
      'produto-layout-v3',
      contentType,
      `PRECO-OP-${product.price_mode === 'simple' ? 'PRECO_SIMPLES' : product.price_mode === 'from_to' ? 'PRECO_DE_POR' : product.price_mode === 'none' ? 'SEM_ETIQUETA' : 'PRECO_SIMPLES'}`,
      isHighlight ? 'IS_DESTAQUE' : 'NOT_IS_DESTAQUE',
      xWeight,
      yWeight,
      `INVADIR-INVADIR-${invadirLevel}`,
      `ETIQUETA_ORIENTACAO_${etiquetaOrientacao}`,
    ]"
  >

    <!-- Layer decoration (cor de fundo por produto) -->
    <div
      v-if="layerBg"
      :style="{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundColor: layerBg,
        opacity: layerOpacity,
        borderRadius: 'inherit',
      }"
    />

    <!-- Barra de personalizacao flutuante (aparece no hover) -->
    <BuilderProductPersonalizationBar
      @open-color="showColorModal = true"
      @open-price-options="$emit('open-price-options')"
      @open-price-tag="$emit('open-price-tag')"
      @open-bubble="$emit('open-bubble')"
    />

    <!-- Modal cor de fundo -->
    <BuilderBackgroundColorModal
      v-model="showColorModal"
      :current-bg="layerBg"
      :current-opacity="Math.round(layerOpacity * 100)"
      @select="onSelectColor"
    />

    <!-- Badge (absoluto no canto) -->
    <div
      v-if="hasEl('badge') && product.badge_style_id"
      :style="{
        position: 'absolute',
        top: badgeEl?.y || '0',
        left: badgeEl?.x || '0',
        zIndex: 15,
        maxWidth: '40%',
      }"
    >
      <BuilderFlyerBadge v-if="badgeStyle" :badge="badgeStyle" />
    </div>

    <!-- +18 -->
    <div
      v-if="product.is_adult"
      :style="{
        position: 'absolute', right: '4%', top: '4%', zIndex: 20,
        background: '#dc2626', color: '#fff', borderRadius: '50%',
        width: '20px', height: '20px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '8px', fontWeight: 700,
      }"
    >+18</div>

    <!-- ═══ AREA TITULO (grid-area: TITULO) ═══ -->
    <div v-if="product.custom_name" :style="nameStyle" class="v3-titulo">
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

    <!-- ═══ AREA IMAGE (grid-area: IMAGE) ═══ -->
    <div ref="imageSectionRef" :style="imageSectionStyle" class="v3-image">
      <template v-if="imageUrl">
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
        <span v-else :style="{ fontSize: '10px', color: '#ccc' }">Erro img</span>
      </template>
      <span v-else :style="{ fontSize: '11px', color: '#aaa', fontWeight: 500, opacity: 0.6 }">Sem imagem</span>
    </div>

    <!-- ═══ AREA ETIQUETA (grid-area: ETIQUETA) ═══ -->
    <div v-if="!product.price_mode || product.price_mode !== 'none'" :style="priceAreaStyle" class="v3-etiqueta">
      <div :style="priceStyle">
        <BuilderFlyerPriceTag
          :product="product"
          :tag-style="priceTagStyle"
          :is-highlight="isHighlight"
          :style="priceTagWrapperStyle"
        />
      </div>
    </div>

    <!-- Shapes decorativos (position absolute) -->
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

<style scoped>
.builder-product-card:hover :deep(.personalizar-bar) {
  opacity: 1 !important;
}
</style>
