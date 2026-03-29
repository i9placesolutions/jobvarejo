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

const borderRadius = computed(() => fontConfig.value.card_border_radius || theme.value?.css_config?.borderRadius || '8px')

// ── Font config do flyer (fonte e text-transform dos nomes) ────────────────
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const nameFontFamily = computed(() => fontConfig.value.name_font_family || 'inherit')
const nameTextTransform = computed(() => fontConfig.value.name_text_transform || 'uppercase')

// Layout do card: classico (1), lateral (2), premium (3)
const cardLayout = computed(() => fontConfig.value.card_layout || 'classico')

// Dynamic base font size based on grid columns
const baseFontSize = computed(() => {
  const cols = props.columns ?? 3
  const highlight = props.isHighlight ? 4 : 0
  const sizeMap: Record<number, number> = { 1: 36, 2: 28, 3: 20, 4: 17, 5: 15, 6: 13 }
  return (sizeMap[cols] ?? Math.max(12, 38 - cols * 5)) + highlight
})

const cardBg = computed(() => fontConfig.value.card_bg_color || (flyer.value as any)?.card_bg_color || '#ffffff')
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

// Estilo para cada imagem quando tem multiplas
const imgMultiStyle = computed(() => {
  if (!imageUrl.value) return {}
  const imageScale = Math.min(fontConfig.value.image_scale ?? 1, 1)
  const pct = Math.round(imageScale * 100)
  return {
    maxHeight: `${pct}%`,
    maxWidth: `${pct}%`,
    objectFit: 'contain' as const,
    flexShrink: '1',
    minWidth: '0',
  }
})

// Image crop style
const imageZoom = computed(() => props.product.image_zoom ?? 100)
const imageX = computed(() => props.product.image_x ?? 0)
const imageY = computed(() => props.product.image_y ?? 0)

const imgItemStyle = computed(() => {
  if (!imageUrl.value) return {}
  // imageScale só reduz (< 1). Acima de 1 não tem efeito pois max já é 100%.
  const imageScale = Math.min(fontConfig.value.image_scale ?? 1, 1)
  const pct = Math.round(imageScale * 100)

  return {
    maxWidth: `${pct}%`,
    maxHeight: `${pct}%`,
    objectFit: 'contain' as const,
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
    class="relative overflow-hidden min-h-0"
    :class="[
      cardLayout === 'lateral' ? 'flex flex-row' : 'flex flex-col',
    ]"
    :style="{
      ...cardStyle,
      border: isHighlight ? '3px solid var(--builder-accent, var(--builder-primary, #10b981))' : '1px solid rgba(0,0,0,0.12)',
      fontSize: `${baseFontSize}px`,
      background: isHighlight ? `linear-gradient(135deg, ${cardBg}, ${cardBg}ee)` : cardBg,
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
      <!-- TITULO -->
      <div class="shrink-0 relative z-10" style="padding: 6px 12px 0">
        <p v-if="product.custom_name" class="font-extrabold leading-tight line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize, fontFamily: nameFontFamily, textTransform: nameTextTransform }">
          {{ product.custom_name }}
        </p>
        <p v-if="product.observation" class="text-[0.55em] opacity-50 leading-tight line-clamp-1 text-center">
          {{ product.observation }}
        </p>
      </div>

      <!-- IMAGEM -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="w-full h-full flex items-center justify-center" style="padding: 6px 10px 0">
          <template v-if="hasMultipleImages">
            <img :src="imageUrl" :style="{ ...imgMultiStyle, marginRight: '-1%' }" alt="" draggable="false" />
            <img v-for="(exUrl, exIdx) in extraImageUrls" :key="exIdx" :src="exUrl" :style="{ ...imgMultiStyle, marginLeft: '-1%' }" alt="" draggable="false" />
          </template>
          <img v-else-if="imageUrl" :src="imageUrl" :style="imgItemStyle" alt="" draggable="false" />
          <div v-else class="opacity-20">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- ETIQUETA -->
      <div class="shrink-0 text-center relative z-20 flex flex-col items-center justify-center" style="padding: 6px 12px 8px">
        <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" />
        <p v-if="product.purchase_limit" class="text-[0.45em] mt-0.5 opacity-40 leading-tight">
          Limite: {{ product.purchase_limit }} por cliente
        </p>
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
      <div style="width: 57%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 16px; overflow: hidden; gap: 6px">
        <p v-if="product.custom_name" class="font-extrabold leading-tight line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize, fontFamily: nameFontFamily, textTransform: nameTextTransform }">
          {{ product.custom_name }}
        </p>
        <p v-if="product.observation" class="text-[0.55em] opacity-50 leading-tight line-clamp-1 text-center">
          {{ product.observation }}
        </p>
        <div style="font-size: 1.35em">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" />
        </div>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT PREMIUM: Imagem GRANDE em cima, [Nome | Preco] embaixo     -->
    <!-- Estilo encarte supermercado — imagem domina, info na barra inferior -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-else-if="cardLayout === 'premium'">
      <!-- IMAGEM: ocupa ~65% do card, grande e centralizada -->
      <div style="flex: 7; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0.3em 0.3em 0.1em">
        <img v-if="imageUrl" :src="imageUrl" style="width: 100%; height: 100%; object-fit: contain" alt="" draggable="false" />
        <div v-else class="opacity-20">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <!-- BARRA INFERIOR: ~35% do card, Nome esquerda + Preco direita -->
      <div style="flex: 3; flex-shrink: 0; min-height: 0; display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 16px; gap: 10px; overflow: hidden">
        <!-- Nome a esquerda -->
        <div style="flex: 1; min-width: 0; overflow: hidden; margin-left: 2px">
          <p v-if="product.custom_name" class="font-extrabold leading-tight line-clamp-2"
            :style="{ fontSize: nameFontSize, fontFamily: nameFontFamily, textTransform: nameTextTransform }">
            {{ product.custom_name }}
          </p>
          <p v-if="product.observation" class="text-[0.45em] opacity-50 leading-tight line-clamp-1">
            {{ product.observation }}
          </p>
        </div>
        <!-- Preco a direita, grande -->
        <div style="flex-shrink: 0; font-size: 1.2em; margin-right: 2px">
          <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="true" />
        </div>
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- FALLBACK: Usa layout classico para content modes antigos           -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <template v-else>
      <div class="shrink-0 px-2 pt-1 relative z-10">
        <p v-if="product.custom_name" class="font-extrabold leading-tight line-clamp-2 text-center"
          :style="{ fontSize: nameFontSize, fontFamily: nameFontFamily, textTransform: nameTextTransform }">
          {{ product.custom_name }}
        </p>
      </div>
      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="w-full h-full flex items-center justify-center" style="padding: 0.5em 0.3em 0 0.3em">
          <img v-if="imageUrl" :src="imageUrl" :style="imgItemStyle" alt="" draggable="false" />
        </div>
      </div>
      <div class="shrink-0 px-2 py-1.5 text-center relative z-20 flex flex-col items-center justify-center">
        <BuilderFlyerPriceTag :product="product" :tag-style="priceTagStyle" :is-highlight="isHighlight" />
      </div>
    </template>
  </div>
</template>
