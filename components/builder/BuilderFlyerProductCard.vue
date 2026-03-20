<script setup lang="ts">
import type { BuilderFlyerProduct, BuilderBadgeStyle, BuilderPriceTagStyle } from '~/types/builder'

const props = defineProps<{
  product: BuilderFlyerProduct
  isHighlight: boolean
}>()

const { flyer, theme } = useBuilderFlyer()

// TODO: resolve badge and price tag styles from IDs when catalog is loaded
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

const priceTagStyle = computed<BuilderPriceTagStyle | null>(() => null)

// Font size based on text_size_mode
const nameFontSize = computed(() => {
  const mode = flyer.value?.text_size_mode ?? 'MEDIUM'
  switch (mode) {
    case 'MAXIMUM': return '1em'
    case 'MINIMUM': return '0.65em'
    default: return '0.8em'
  }
})

const borderRadius = computed(() => theme.value?.css_config?.borderRadius ?? '8px')

const cardStyle = computed(() => ({
  backgroundColor: '#ffffff',
  borderRadius: borderRadius.value,
  color: 'var(--builder-text, #000)',
  opacity: props.product.bg_opacity ?? 1,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}))

// Proxy URL for product images stored in Wasabi
const imageUrl = computed(() => {
  const img = props.product.custom_image
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.startsWith('products/') || img.startsWith('imagens/')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
})
</script>

<template>
  <div
    class="relative flex flex-col overflow-hidden border min-h-0"
    :class="isHighlight ? 'ring-2 ring-offset-1' : ''"
    :style="{
      ...cardStyle,
      borderColor: isHighlight ? 'var(--builder-accent, var(--builder-primary, #10b981))' : 'rgba(0,0,0,0.12)',
      fontSize: isHighlight ? '16px' : '12px',
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

    <!-- Product image -->
    <div class="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="product.custom_name || 'Produto'"
        class="max-w-full max-h-full object-contain"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center opacity-20"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    </div>

    <!-- Info -->
    <div class="px-2 pb-1.5 text-center shrink-0 overflow-hidden">
      <!-- Product name -->
      <p
        v-if="product.custom_name"
        class="font-semibold leading-tight mb-1 line-clamp-2"
        :style="{ fontSize: nameFontSize }"
      >
        {{ product.custom_name }}
      </p>

      <!-- Observation -->
      <p
        v-if="product.observation"
        class="text-[0.55em] opacity-50 leading-tight line-clamp-1 mb-1"
      >
        {{ product.observation }}
      </p>

      <!-- Price Tag (9 modes) -->
      <BuilderFlyerPriceTag
        :product="product"
        :tag-style="priceTagStyle"
        :is-highlight="isHighlight"
      />

      <!-- Purchase limit -->
      <p
        v-if="product.purchase_limit"
        class="text-[0.45em] mt-1 opacity-40 leading-tight"
      >
        Limite: {{ product.purchase_limit }} por cliente
      </p>
    </div>
  </div>
</template>
