<script setup lang="ts">
import type { BuilderFlyerProduct, BuilderBadgeStyle, BuilderPriceTagStyle } from '~/types/builder'
import { getLayoutForBox, parseXSplit, parseYSplit, parseInvasion, parseOrdem, type ProductBoxLayoutConfig } from '~/composables/useProductBoxLayout'

const props = defineProps<{
  product: BuilderFlyerProduct
  isHighlight: boolean
  columns?: number
  boxIndex?: number
}>()

const { flyer, theme, priceTagStyles } = useBuilderFlyer()

const badgeStyle = computed<BuilderBadgeStyle | null>(() => {
  if (!props.product.badge_style_id) return null
  return {
    id: props.product.badge_style_id,
    name: 'OFERTA',
    thumbnail: null,
    type: 'OFFER',
    css_config: {
      bgColor: 'var(--builder-accent, #ef4444)',
      textColor: '#ffffff',
      text: 'OFERTA',
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

// ── Is this a columnar layout (image left, info right)? ────────────────────
const isColumnar = computed(() =>
  contentMode.value === 'CONTENT_COL_ETIQUETA_TITULO'
  || contentMode.value === 'CONTENT_ROW_ETIQUETA_IMAGEM'
  || contentMode.value === 'CONTENT_ROW_BOTTOM',
)

// ── Font size ───────────────────────────────────────────────────────────────
const nameFontSize = computed(() => {
  const mode = flyer.value?.text_size_mode ?? 'MEDIUM'
  if (props.isHighlight) {
    switch (mode) {
      case 'MAXIMUM': return '1.5em'
      case 'MINIMUM': return '1em'
      default: return '1.25em'
    }
  }
  switch (mode) {
    case 'MAXIMUM': return '1.2em'
    case 'MINIMUM': return '0.75em'
    default: return '1em'
  }
})

const borderRadius = computed(() => theme.value?.css_config?.borderRadius ?? '8px')

// Dynamic base font size based on grid columns
const baseFontSize = computed(() => {
  const cols = props.columns ?? 3
  const highlight = props.isHighlight ? 4 : 0
  const sizeMap: Record<number, number> = { 1: 36, 2: 28, 3: 20, 4: 17, 5: 15, 6: 13 }
  return (sizeMap[cols] ?? Math.max(12, 38 - cols * 5)) + highlight
})

const cardBg = computed(() => (flyer.value as any)?.card_bg_color || '#ffffff')
const cardText = computed(() => (flyer.value as any)?.card_text_color || '#000000')

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

// Image crop style
const imageZoom = computed(() => props.product.image_zoom ?? 100)
const imageX = computed(() => props.product.image_x ?? 0)
const imageY = computed(() => props.product.image_y ?? 0)

const imgItemStyle = computed(() => {
  if (!imageUrl.value) return {}
  const inv = invasion.value
  const baseSize = 100 + inv
  const zoomSize = (imageZoom.value / 100) * baseSize
  const offset = inv > 0 ? -(inv / 2) : 0
  return {
    backgroundImage: `url('${imageUrl.value}')`,
    width: `${zoomSize}%`,
    height: `${zoomSize}%`,
    left: `${(imageX.value || 0) + (offset * 0.5)}px`,
    top: `${(imageY.value || 0) + offset}px`,
    backgroundSize: 'contain',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    position: 'absolute' as const,
  }
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
  } else {
    // Vertical: Y_ controls height split — image gets topPercent
    style.flex = `${ySplit.value.topPercent}`
    style.minHeight = '0'
  }
  // Allow invasion overflow
  if (invasion.value > 0) {
    style.overflow = 'visible'
    style.zIndex = '10'
  }
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
    class="relative overflow-hidden border min-h-0"
    :class="[
      // CONTENT_LINE and CONTENT_ROW_ETIQUETA_TITULO: vertical stack
      // CONTENT_COL_ETIQUETA_TITULO / ROW_BOTTOM / ROW_ETIQUETA_IMAGEM: varies
      contentMode === 'CONTENT_COL_ETIQUETA_TITULO' ? 'flex flex-row' : 'flex flex-col',
      isHighlight ? 'ring-2 ring-offset-1' : '',
    ]"
    :style="{
      ...cardStyle,
      borderColor: isHighlight ? 'var(--builder-accent, var(--builder-primary, #10b981))' : 'rgba(0,0,0,0.12)',
      fontSize: `${baseFontSize}px`,
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

    <!-- ═══ CONTENT_LINE: Vertical stack (TITULO → IMAGEM → ETIQUETA) ═══ -->
    <template v-if="contentMode === 'CONTENT_LINE'">
      <template v-for="part in renderOrder" :key="part">
        <!-- TITULO -->
        <div v-if="part === 'TITULO'" class="shrink-0 px-2 pt-1">
          <p
            v-if="product.custom_name"
            class="font-extrabold leading-tight line-clamp-2 text-center"
            :style="{ fontSize: nameFontSize }"
          >
            {{ product.custom_name }}
          </p>
          <p
            v-if="product.observation"
            class="text-[0.55em] opacity-50 leading-tight line-clamp-1 text-center"
          >
            {{ product.observation }}
          </p>
        </div>

        <!-- IMAGEM -->
        <div
          v-if="part === 'IMAGEM'"
          class="min-h-0 relative"
          :style="imageWrapperStyle"
        >
          <template v-if="imageUrl">
            <div class="w-full h-full relative flex items-center justify-center">
              <div :style="imgItemStyle" />
            </div>
          </template>
          <div v-else class="w-full h-full flex items-center justify-center opacity-20">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <!-- ETIQUETA -->
        <div
          v-if="part === 'ETIQUETA'"
          class="shrink-0 overflow-hidden px-2 pb-1.5 text-center"
          :style="infoWrapperStyle"
        >
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
          />
          <p
            v-if="product.purchase_limit"
            class="text-[0.45em] mt-0.5 opacity-40 leading-tight"
          >
            Limite: {{ product.purchase_limit }} por cliente
          </p>
        </div>
      </template>
    </template>

    <!-- ═══ CONTENT_COL_ETIQUETA_TITULO: Image left, name+price right ═══ -->
    <template v-else-if="contentMode === 'CONTENT_COL_ETIQUETA_TITULO'">
      <!-- Image column (left) -->
      <div
        class="min-h-0 relative shrink-0"
        :style="imageWrapperStyle"
      >
        <template v-if="imageUrl">
          <div class="w-full h-full relative flex items-center justify-center">
            <div :style="imgItemStyle" />
          </div>
        </template>
        <div v-else class="w-full h-full flex items-center justify-center opacity-20">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <!-- Info column (right): name + price -->
      <div
        class="flex flex-col items-center justify-center px-2 py-1 overflow-hidden"
        :style="infoWrapperStyle"
      >
        <p
          v-if="product.custom_name"
          class="font-extrabold leading-tight mb-1 line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize }"
        >
          {{ product.custom_name }}
        </p>
        <p
          v-if="product.observation"
          class="text-[0.55em] opacity-50 leading-tight line-clamp-1 mb-1"
        >
          {{ product.observation }}
        </p>
        <BuilderFlyerPriceTag
          :product="product"
          :tag-style="priceTagStyle"
          :is-highlight="isHighlight"
        />
        <p
          v-if="product.purchase_limit"
          class="text-[0.45em] mt-0.5 opacity-40 leading-tight"
        >
          Limite: {{ product.purchase_limit }} por cliente
        </p>
      </div>
    </template>

    <!-- ═══ CONTENT_ROW_ETIQUETA_TITULO: Image big top, price+name row bottom ═══ -->
    <template v-else-if="contentMode === 'CONTENT_ROW_ETIQUETA_TITULO'">
      <!-- Image (top, large with invasion) -->
      <div
        class="min-h-0 relative"
        :style="imageWrapperStyle"
      >
        <template v-if="imageUrl">
          <div class="w-full h-full relative flex items-center justify-center">
            <div :style="imgItemStyle" />
          </div>
        </template>
        <div v-else class="w-full h-full flex items-center justify-center opacity-20">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      <!-- Bottom row: price + name side by side -->
      <div class="shrink-0 flex flex-row items-center overflow-hidden" :style="infoWrapperStyle">
        <div class="flex-1 px-1 text-center">
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
          />
        </div>
        <div class="flex-1 px-1">
          <p
            v-if="product.custom_name"
            class="font-extrabold leading-tight line-clamp-2 text-center"
            :style="{ fontSize: nameFontSize }"
          >
            {{ product.custom_name }}
          </p>
        </div>
      </div>
    </template>

    <!-- ═══ CONTENT_ROW_BOTTOM: Title top, then image+price row below ═══ -->
    <template v-else-if="contentMode === 'CONTENT_ROW_BOTTOM'">
      <!-- Title top -->
      <div class="shrink-0 px-2 pt-1" :style="titleWrapperStyle">
        <p
          v-if="product.custom_name"
          class="font-extrabold leading-tight line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize }"
        >
          {{ product.custom_name }}
        </p>
        <p
          v-if="product.observation"
          class="text-[0.55em] opacity-50 leading-tight line-clamp-1 text-center"
        >
          {{ product.observation }}
        </p>
      </div>

      <!-- Bottom row: image + price side by side -->
      <div class="min-h-0 flex flex-row" :style="bottomRowStyle">
        <div
          class="relative min-h-0"
          :style="{ width: `${xSplit.imagePercent}%`, height: '100%' }"
        >
          <template v-if="imageUrl">
            <div class="w-full h-full relative flex items-center justify-center">
              <div :style="imgItemStyle" />
            </div>
          </template>
          <div v-else class="w-full h-full flex items-center justify-center opacity-20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center px-1 overflow-hidden"
          :style="{ width: `${xSplit.infoPercent}%` }"
        >
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
          />
          <p
            v-if="product.purchase_limit"
            class="text-[0.45em] mt-0.5 opacity-40 leading-tight"
          >
            Limite: {{ product.purchase_limit }} por cliente
          </p>
        </div>
      </div>
    </template>

    <!-- ═══ CONTENT_ROW_ETIQUETA_IMAGEM: Title top, then etiqueta beside image ═══ -->
    <template v-else-if="contentMode === 'CONTENT_ROW_ETIQUETA_IMAGEM'">
      <!-- Title top -->
      <div class="shrink-0 px-2 pt-1" :style="titleWrapperStyle">
        <p
          v-if="product.custom_name"
          class="font-extrabold leading-tight line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize }"
        >
          {{ product.custom_name }}
        </p>
      </div>

      <!-- Bottom row: image + etiqueta -->
      <div class="min-h-0 flex flex-row" :style="bottomRowStyle">
        <div
          class="relative min-h-0"
          :style="{ width: `${xSplit.imagePercent}%`, height: '100%' }"
        >
          <template v-if="imageUrl">
            <div class="w-full h-full relative flex items-center justify-center">
              <div :style="imgItemStyle" />
            </div>
          </template>
          <div v-else class="w-full h-full flex items-center justify-center opacity-20">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center px-1 overflow-hidden"
          :style="{ width: `${xSplit.infoPercent}%` }"
        >
          <BuilderFlyerPriceTag
            :product="product"
            :tag-style="priceTagStyle"
            :is-highlight="isHighlight"
          />
        </div>
      </div>
    </template>
  </div>
</template>
