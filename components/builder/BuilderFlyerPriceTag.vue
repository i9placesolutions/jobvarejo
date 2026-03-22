<script setup lang="ts">
import type { BuilderFlyerProduct, BuilderPriceTagStyle } from '~/types/builder'

const props = defineProps<{
  product: BuilderFlyerProduct
  tagStyle?: BuilderPriceTagStyle | null
  isHighlight?: boolean
}>()

const { theme } = useBuilderFlyer()

// ── Colors & shape ──────────────────────────────────────────────────────────
const bgColor = computed(() =>
  props.tagStyle?.css_config?.bgColor || 'var(--builder-primary, #e53e3e)'
)
const textColor = computed(() =>
  props.tagStyle?.css_config?.textColor || '#ffffff'
)
const shape = computed(() =>
  props.tagStyle?.css_config?.shape || 'rounded'
)
const fontFamily = computed(() =>
  props.tagStyle?.css_config?.fontFamily || 'inherit'
)
const decimalStyle = computed(() =>
  props.tagStyle?.css_config?.decimalStyle || 'small'
)

// ── Border ──────────────────────────────────────────────────────────────────
const borderWidth = computed(() => props.tagStyle?.css_config?.borderWidth ?? 0)
const borderColor = computed(() => props.tagStyle?.css_config?.borderColor || '#000000')
const borderStyle = computed(() => props.tagStyle?.css_config?.borderStyle || 'none')
const hasCustomRadius = computed(() => {
  const c = props.tagStyle?.css_config
  return c?.borderRadiusTL != null || c?.borderRadiusTR != null || c?.borderRadiusBL != null || c?.borderRadiusBR != null
})
const customBorderRadius = computed(() => {
  if (!hasCustomRadius.value) return null
  const c = props.tagStyle?.css_config
  return `${c?.borderRadiusTL ?? 8}px ${c?.borderRadiusTR ?? 8}px ${c?.borderRadiusBR ?? 8}px ${c?.borderRadiusBL ?? 8}px`
})

// ── Shadow ──────────────────────────────────────────────────────────────────
const shadowStyle = computed(() => {
  const sh = props.tagStyle?.css_config?.shadow || 'none'
  const map: Record<string, string> = {
    none: 'none',
    sm: '0 1px 3px rgba(0,0,0,0.25)',
    md: '0 4px 8px rgba(0,0,0,0.35)',
    lg: '0 8px 20px rgba(0,0,0,0.45)',
    glow: `0 0 12px ${bgColor.value}80, 0 0 24px ${bgColor.value}40`,
  }
  return map[sh] || 'none'
})

// ── Gradient ────────────────────────────────────────────────────────────────
const bgGradient = computed(() => props.tagStyle?.css_config?.bgGradient || false)
const bgGradientColor = computed(() => props.tagStyle?.css_config?.bgGradientColor || '#000000')
const bgGradientDirection = computed(() => props.tagStyle?.css_config?.bgGradientDirection || 'to-right')

const backgroundStyle = computed(() => {
  if (!bgGradient.value) return bgColor.value
  const dir = bgGradientDirection.value
  if (dir === 'radial') return `radial-gradient(circle, ${bgColor.value}, ${bgGradientColor.value})`
  const cssDir = dir.replace('to-', 'to ').replace('br', 'bottom right').replace('bl', 'bottom left')
  return `linear-gradient(${cssDir}, ${bgColor.value}, ${bgGradientColor.value})`
})

// ── Padding ─────────────────────────────────────────────────────────────────
const paddingStyle = computed(() => {
  const p = props.tagStyle?.css_config?.padding || 'normal'
  const map: Record<string, string> = {
    compact: '0.15em 0.4em',
    normal: '0.25em 0.5em',
    spacious: '0.4em 0.8em',
  }
  return map[p] || map.normal
})

// ── Price scale ─────────────────────────────────────────────────────────────
const priceScale = computed(() => props.tagStyle?.css_config?.priceScale ?? 1)

// ── Opacity ─────────────────────────────────────────────────────────────────
const bgOpacity = computed(() => props.tagStyle?.css_config?.bgOpacity ?? 1)

const shapeClass = computed(() => {
  if (hasCustomRadius.value) return ''
  switch (shape.value) {
    case 'pill': return 'rounded-full'
    case 'square': return 'rounded-none'
    case 'circle': return 'rounded-full aspect-square'
    default: return 'rounded-lg'
  }
})

// ── Background image ────────────────────────────────────────────────────────
const bgImage = computed(() => props.tagStyle?.css_config?.bgImage || '')
const bgImageSize = computed(() => props.tagStyle?.css_config?.bgImageSize || 'cover')
const bgImageOpacity = computed(() => props.tagStyle?.css_config?.bgImageOpacity ?? 1)

// ── Display mode ────────────────────────────────────────────────────────────
const displayMode = computed(() => props.tagStyle?.css_config?.displayMode || 'filled')

// ── Text shadow ─────────────────────────────────────────────────────────────
const textShadowStyle = computed(() => {
  const ts = props.tagStyle?.css_config?.textShadow || 'none'
  const map: Record<string, string> = {
    none: 'none',
    sm: '1px 1px 2px rgba(0,0,0,0.5)',
    md: '2px 2px 4px rgba(0,0,0,0.6)',
    lg: '3px 3px 6px rgba(0,0,0,0.7)',
    hard: `2px 2px 0 ${bgColor.value}, -1px -1px 0 ${bgColor.value}, 1px -1px 0 ${bgColor.value}, -1px 1px 0 ${bgColor.value}`,
  }
  return map[ts] || 'none'
})

// ── Currency symbol size ────────────────────────────────────────────────────
const currencyScale = computed(() => {
  const cs = props.tagStyle?.css_config?.currencySize || 'small'
  const map: Record<string, number> = { small: 0.45, medium: 0.7, large: 1.0 }
  return map[cs] || 0.45
})

// ── Rotation ────────────────────────────────────────────────────────────────
const rotation = computed(() => props.tagStyle?.css_config?.rotation ?? 0)

// ── Gondola features ────────────────────────────────────────────────────────
const showCutLine = computed(() => props.tagStyle?.css_config?.showCutLine ?? false)
const showBarcode = computed(() => props.tagStyle?.css_config?.showBarcode ?? false)
const showValidity = computed(() => props.tagStyle?.css_config?.showValidity ?? false)

// ── Combined seal style ─────────────────────────────────────────────────────
const sealStyle = computed(() => {
  const dm = displayMode.value
  const style: Record<string, string> = {
    color: textColor.value,
    padding: paddingStyle.value,
    position: 'relative',
    overflow: 'hidden',
  }

  if (dm === 'filled' || dm === 'splash') {
    style.background = backgroundStyle.value
    style.opacity = String(bgOpacity.value)
  } else if (dm === 'outline') {
    style.background = 'transparent'
    style.border = `${Math.max(borderWidth.value, 2)}px solid ${bgColor.value}`
    style.color = bgColor.value
  } else if (dm === 'underline') {
    style.background = 'transparent'
    style.color = bgColor.value
    style.borderBottom = `3px solid ${bgColor.value}`
    style.borderRadius = '0'
    style.padding = '0.1em 0.2em'
  } else if (dm === 'naked') {
    style.background = 'transparent'
    style.color = bgColor.value
    style.padding = '0'
  }

  if (customBorderRadius.value && dm !== 'underline') {
    style.borderRadius = customBorderRadius.value
  }
  if (dm === 'filled' || dm === 'splash') {
    if (borderStyle.value !== 'none' && borderWidth.value > 0) {
      style.border = `${borderWidth.value}px ${borderStyle.value} ${borderColor.value}`
    }
  }
  if (shadowStyle.value !== 'none') {
    style.boxShadow = shadowStyle.value
  }
  if (textShadowStyle.value !== 'none') {
    style.textShadow = textShadowStyle.value
  }
  if (rotation.value !== 0) {
    style.transform = `rotate(${rotation.value}deg)`
  }
  return style
})

const bgImageStyle = computed(() => {
  if (!bgImage.value) return null
  return {
    position: 'absolute' as const,
    inset: '0',
    backgroundImage: `url(${bgImage.value})`,
    backgroundSize: bgImageSize.value === 'stretch' ? '100% 100%' : bgImageSize.value,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity: bgImageOpacity.value,
    zIndex: '0',
    pointerEvents: 'none' as const,
  }
})

// ── Scale factor for highlight ──────────────────────────────────────────────
const s = computed(() => (props.isHighlight ? 1.15 : 1) * priceScale.value)

// ── Decimal size multiplier based on style ──────────────────────────────────
const decimalSize = computed(() => {
  switch (decimalStyle.value) {
    case 'large': return 1.0
    case 'superscript': return 0.45
    default: return 0.55 // small (default)
  }
})

// ── Price formatting ────────────────────────────────────────────────────────
function splitPrice(val: number | string | null | undefined): { integer: string; decimal: string } | null {
  if (val == null) return null
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return null
  const fixed = num.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const integer = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return { integer, decimal: decPart ?? '00' }
}

function formatFull(val: number | string | null | undefined): string {
  if (val == null) return ''
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const priceParts = computed(() => splitPrice(props.product.offer_price))
const originalParts = computed(() => splitPrice(props.product.original_price))
const installmentParts = computed(() => splitPrice(props.product.installment_price))

// Unit abbreviation
const unitAbbr = computed(() => {
  const u = props.product.unit
  if (!u || u === 'UN') return ''
  const map: Record<string, string> = {
    KG: 'kg', G: 'g', '100G': '100g', '500G': '500g',
    L: 'L', ML: 'ml',
    PCT: 'pct', CX: 'cx', DZ: 'dz', BD: 'bd', FD: 'fd', SC: 'sc',
  }
  return map[u] || u.toLowerCase()
})

// Price label (APENAS, OFERTA, etc.)
const priceLabel = computed(() => props.product.price_label || null)

// Discount percentage
const discountPercent = computed(() => {
  const orig = props.product.original_price
  const offer = props.product.offer_price
  if (!orig || !offer || orig <= 0) return null
  return Math.round(((orig - offer) / orig) * 100)
})

// ── Symbolic price: realistic Brazilian coins & notes ───────────────────────
const symbolicItems = computed(() => {
  const price = props.product.offer_price
  if (price == null || price <= 0) return null

  const items: { type: 'coin' | 'note'; image?: string; label: string; bgColor: string; textColor: string; borderColor: string }[] = []

  // Coins use real images: 25¢, 50¢, R$1
  // Notes use styled divs: R$2, R$5, R$10, R$20, R$50, R$100
  if (price < 0.50) {
    const count = Math.max(1, Math.round(price / 0.25))
    for (let i = 0; i < Math.min(count, 4); i++) {
      items.push({ type: 'coin', image: '/coins/25centavos.svg', label: '25¢', bgColor: '', textColor: '', borderColor: '' })
    }
  } else if (price < 1) {
    const count = Math.round(price / 0.50)
    for (let i = 0; i < Math.min(count, 2); i++) {
      items.push({ type: 'coin', image: '/coins/50centavos.svg', label: '50¢', bgColor: '', textColor: '', borderColor: '' })
    }
  } else if (price < 2) {
    items.push({ type: 'coin', image: '/coins/1real.svg', label: 'R$1', bgColor: '', textColor: '', borderColor: '' })
  } else if (price < 3) {
    // R$1 + coins for remainder
    items.push({ type: 'coin', image: '/coins/1real.svg', label: 'R$1', bgColor: '', textColor: '', borderColor: '' })
    if (price >= 2.25 && price < 2.50) {
      items.push({ type: 'coin', image: '/coins/25centavos.svg', label: '25¢', bgColor: '', textColor: '', borderColor: '' })
    } else if (price >= 2.50) {
      items.push({ type: 'coin', image: '/coins/50centavos.svg', label: '50¢', bgColor: '', textColor: '', borderColor: '' })
    }
    items.push({ type: 'coin', image: '/coins/1real.svg', label: 'R$1', bgColor: '', textColor: '', borderColor: '' })
  } else if (price < 5) {
    const count = Math.min(Math.round(price), 4)
    for (let i = 0; i < count; i++) {
      items.push({ type: 'coin', image: '/coins/1real.svg', label: 'R$1', bgColor: '', textColor: '', borderColor: '' })
    }
  } else if (price < 10) {
    items.push({ type: 'note', label: 'R$5', bgColor: '#6b46c1', textColor: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' })
  } else if (price < 20) {
    items.push({ type: 'note', label: 'R$10', bgColor: '#c53030', textColor: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' })
  } else if (price < 50) {
    items.push({ type: 'note', label: 'R$20', bgColor: '#d69e2e', textColor: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' })
  } else if (price < 100) {
    items.push({ type: 'note', label: 'R$50', bgColor: '#c05621', textColor: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' })
  } else {
    items.push({ type: 'note', label: 'R$100', bgColor: '#2b6cb0', textColor: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' })
  }

  return items
})

const mode = computed(() => props.product.price_mode || 'simple')
</script>

<template>
  <!-- none: no price tag -->
  <div v-if="mode === 'none'" />

  <!-- anticipation: custom text -->
  <div v-else-if="mode === 'anticipation'" class="flex flex-col items-center w-full" :style="{ fontFamily }">
    <p
      v-if="product.anticipation_text"
      class="font-semibold opacity-70 leading-none mb-0.5"
      :style="{ fontSize: `${0.5 * s}em` }"
    >
      {{ product.anticipation_text.split(' ')[0] || '' }}
    </p>
    <div
      class="inline-flex items-center justify-center w-full"
      :class="shapeClass"
      :style="sealStyle"
    >
      <div v-if="bgImageStyle" :style="bgImageStyle" />
      <span
        class="font-bold text-center leading-tight relative z-1"
        :style="{ fontSize: `${1.1 * s}em` }"
      >
        {{ product.anticipation_text ? product.anticipation_text.split(' ').slice(1).join(' ') || product.anticipation_text : 'Confira' }}
      </span>
    </div>
  </div>

  <!-- symbolic: coins/notes -->
  <div v-else-if="mode === 'symbolic'" class="flex flex-col items-center w-full" :style="{ fontFamily }">
    <div v-if="symbolicItems && symbolicItems.length" class="flex items-center justify-center py-1 flex-wrap" :style="{ marginLeft: symbolicItems.length > 1 ? `${0.6 * s}em` : '0' }">
      <template v-for="(item, idx) in symbolicItems" :key="idx">
        <!-- Coin with real image -->
        <img
          v-if="item.type === 'coin' && item.image"
          :src="item.image"
          :alt="item.label"
          class="rounded-full shadow-lg object-contain"
          :style="{
            width: `${2.8 * s}em`,
            height: `${2.8 * s}em`,
            marginLeft: idx > 0 ? `${-0.6 * s}em` : '0',
            position: 'relative',
            zIndex: symbolicItems.length - idx,
          }"
        />
        <!-- Note (CSS styled) -->
        <div
          v-else-if="item.type === 'note'"
          class="flex items-center justify-center rounded-md border shadow-lg relative overflow-hidden"
          :style="{
            width: `${3.8 * s}em`,
            height: `${1.8 * s}em`,
            backgroundColor: item.bgColor,
            color: item.textColor,
            borderColor: item.borderColor,
          }"
        >
          <div class="absolute inset-0 opacity-10" style="background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px);" />
          <span class="font-extrabold relative z-10" :style="{ fontSize: `${0.6 * s}em` }">{{ item.label }}</span>
        </div>
      </template>
    </div>
    <!-- Show actual price below coins/notes -->
    <p
      v-if="priceParts"
      class="font-bold opacity-60 leading-none mt-0.5"
      :style="{ fontSize: `${0.4 * s}em` }"
    >
      R${{ priceParts.integer }},{{ priceParts.decimal }}
    </p>
  </div>

  <!-- All other modes with selo -->
  <div v-else class="flex flex-col items-center w-full" :style="{ fontFamily }">

    <!-- ── Top label ── -->

    <!-- from_to: "De R$XX,XX" riscado + "Por" -->
    <template v-if="mode === 'from_to' && originalParts">
      <div class="flex items-center gap-1.5 mb-0.5">
        <!-- Left: De price -->
        <div class="flex flex-col items-center">
          <span class="font-medium opacity-60 leading-none" :style="{ fontSize: `${0.4 * s}em` }">DE</span>
          <span
            class="line-through opacity-50 leading-none px-1 py-0.5 rounded"
            :style="{
              fontSize: `${0.55 * s}em`,
              backgroundColor: 'rgba(0,0,0,0.06)',
            }"
          >
            R${{ originalParts.integer }},{{ originalParts.decimal }}
          </span>
        </div>

        <!-- Label "Por" -->
        <span class="font-semibold opacity-70 leading-none" :style="{ fontSize: `${0.45 * s}em` }">Por</span>
      </div>
    </template>

    <!-- x_per_y: "3 Kilos Por" -->
    <template v-if="mode === 'x_per_y'">
      <div class="flex items-center gap-1.5 mb-0.5">
        <div v-if="product.original_price" class="flex flex-col items-center">
          <span class="font-medium opacity-60 leading-none" :style="{ fontSize: `${0.4 * s}em` }">PREÇO</span>
          <span
            class="opacity-60 leading-none px-1 py-0.5 rounded"
            :style="{
              fontSize: `${0.5 * s}em`,
              backgroundColor: 'rgba(0,0,0,0.06)',
            }"
          >
            {{ formatFull(product.original_price) }}
          </span>
        </div>
        <p
          class="font-bold leading-none"
          :style="{ fontSize: `${0.5 * s}em`, color: bgColor }"
        >
          {{ product.take_quantity || '' }} {{ product.quantity_unit || 'Un' }} Por
        </p>
      </div>
    </template>

    <!-- take_pay: "Leve X Pague Y" -->
    <template v-if="mode === 'take_pay'">
      <div class="flex items-center gap-1.5 mb-0.5">
        <div v-if="product.original_price" class="flex flex-col items-center">
          <span class="font-medium opacity-60 leading-none" :style="{ fontSize: `${0.4 * s}em` }">{{ unitAbbr ? unitAbbr.toUpperCase() : 'UN' }}</span>
          <span
            class="opacity-60 leading-none px-1 py-0.5 rounded"
            :style="{
              fontSize: `${0.5 * s}em`,
              backgroundColor: 'rgba(0,0,0,0.06)',
            }"
          >
            {{ formatFull(product.original_price) }}
          </span>
        </div>
        <p
          class="font-bold leading-none px-2 py-0.5 rounded"
          :style="{ fontSize: `${0.5 * s}em`, backgroundColor: bgColor, color: textColor }"
        >
          Leve {{ product.take_quantity }} Pague {{ product.pay_quantity }}
        </p>
      </div>
    </template>

    <!-- installment: "Apenas Xx de" -->
    <template v-if="mode === 'installment'">
      <div class="flex items-center gap-1.5 mb-0.5">
        <div v-if="product.offer_price" class="flex flex-col items-center">
          <span class="font-medium opacity-60 leading-none" :style="{ fontSize: `${0.4 * s}em` }">À VISTA</span>
          <span
            class="opacity-60 leading-none px-1 py-0.5 rounded"
            :style="{
              fontSize: `${0.5 * s}em`,
              backgroundColor: 'rgba(0,0,0,0.06)',
            }"
          >
            {{ formatFull(product.offer_price) }}
          </span>
        </div>
        <p
          class="font-bold leading-none"
          :style="{ fontSize: `${0.5 * s}em`, color: bgColor }"
        >
          Apenas {{ product.installment_count || 1 }}X de
        </p>
      </div>
    </template>

    <!-- club_price: "Preço Clube" / custom name -->
    <template v-if="mode === 'club_price'">
      <div class="flex items-center gap-1.5 mb-0.5">
        <div v-if="product.original_price" class="flex flex-col items-center">
          <span class="font-medium opacity-60 leading-none" :style="{ fontSize: `${0.4 * s}em` }">PREÇO</span>
          <span
            class="line-through opacity-50 leading-none px-1 py-0.5 rounded"
            :style="{
              fontSize: `${0.5 * s}em`,
              backgroundColor: 'rgba(0,0,0,0.06)',
            }"
          >
            {{ formatFull(product.original_price) }}
          </span>
        </div>
        <p
          class="font-bold leading-none"
          :style="{ fontSize: `${0.5 * s}em`, color: bgColor }"
        >
          {{ product.club_name || 'Preço Clube' }}
        </p>
      </div>
    </template>

    <!-- Price label (APENAS, OFERTA, etc.) -->
    <p
      v-if="priceLabel && mode !== 'from_to' && mode !== 'x_per_y' && mode !== 'take_pay' && mode !== 'installment' && mode !== 'club_price'"
      class="font-bold leading-none mb-0.5"
      :style="{ fontSize: `${0.5 * s}em`, color: bgColor }"
    >
      {{ priceLabel }}
    </p>

    <!-- ── Gondola: cut line (top) ── -->
    <div
      v-if="showCutLine"
      class="w-full border-t-2 border-dashed opacity-30 mb-1"
      :style="{ borderColor: bgColor }"
    />

    <!-- ── Main price selo ── -->
    <div
      v-if="mode === 'installment' ? installmentParts : priceParts"
      class="inline-flex items-baseline justify-center gap-0.5"
      :class="[shapeClass, { 'splash-shape': displayMode === 'splash' }]"
      :style="sealStyle"
    >
      <!-- Splash SVG background -->
      <svg
        v-if="displayMode === 'splash'"
        class="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style="z-index: 0;"
      >
        <polygon
          :fill="bgColor"
          points="50,0 61,12 78,5 73,22 95,25 82,38 100,50 82,62 95,75 73,78 78,95 61,88 50,100 39,88 22,95 27,78 5,75 18,62 0,50 18,38 5,25 27,22 22,5 39,12"
        />
      </svg>
      <div v-if="bgImageStyle" :style="bgImageStyle" />
      <span
        class="font-bold leading-none self-start relative z-1"
        :style="{ fontSize: `${currencyScale * s}em`, marginTop: currencyScale < 0.6 ? `${0.12 * s}em` : '0' }"
      >R$</span>
      <span
        class="font-extrabold leading-none relative z-1"
        :style="{ fontSize: `${1.2 * s}em` }"
      >{{ mode === 'installment' ? installmentParts?.integer : priceParts?.integer }}</span>
      <div class="flex flex-col items-start relative z-1" :class="{ 'relative': decimalStyle === 'superscript' }">
        <span
          class="font-bold leading-none"
          :class="{ '-mt-1': decimalStyle === 'superscript' }"
          :style="{ fontSize: `${decimalSize * s}em` }"
        >,{{ mode === 'installment' ? installmentParts?.decimal : priceParts?.decimal }}</span>
        <span
          v-if="unitAbbr && mode !== 'installment' && !tagStyle?.css_config?.hideUnit"
          class="font-medium leading-none opacity-80"
          :style="{ fontSize: `${0.35 * s}em` }"
        >/{{ unitAbbr }}</span>
      </div>
    </div>

    <!-- ── Bottom labels ── -->

    <!-- installment: "Sem Juros" -->
    <p
      v-if="mode === 'installment' && product.no_interest"
      class="font-bold opacity-70 leading-none mt-0.5"
      :style="{ fontSize: `${0.45 * s}em`, color: bgColor }"
    >
      Sem Juros
    </p>

    <!-- from_to / club_price: discount % -->
    <p
      v-if="(mode === 'from_to' || mode === 'club_price') && product.show_discount && discountPercent"
      class="font-bold leading-none mt-0.5 px-1.5 py-0.5 rounded-full"
      :style="{
        fontSize: `${0.4 * s}em`,
        backgroundColor: bgColor,
        color: textColor,
      }"
    >
      -{{ discountPercent }}%
    </p>

    <!-- ── Gondola: barcode ── -->
    <div
      v-if="showBarcode && product.barcode"
      class="mt-1 flex flex-col items-center"
    >
      <div class="flex items-end gap-px" :style="{ height: `${0.6 * s}em` }">
        <div v-for="i in 20" :key="i" class="bg-current" :style="{ width: i % 3 === 0 ? '2px' : '1px', height: `${40 + (i * 7) % 30}%`, opacity: 0.7 }" />
      </div>
      <span class="font-mono opacity-50 leading-none mt-0.5" :style="{ fontSize: `${0.25 * s}em` }">{{ product.barcode }}</span>
    </div>

    <!-- ── Gondola: validity ── -->
    <p
      v-if="showValidity"
      class="opacity-50 leading-none mt-0.5 font-medium"
      :style="{ fontSize: `${0.28 * s}em` }"
    >
      Valido ate __/__/____
    </p>

    <!-- ── Gondola: cut line (bottom) ── -->
    <div
      v-if="showCutLine"
      class="w-full border-t-2 border-dashed opacity-30 mt-1"
      :style="{ borderColor: bgColor }"
    />
  </div>
</template>

<style scoped>
.splash-shape {
  background: transparent !important;
  padding: 0.6em 0.8em;
}
</style>
