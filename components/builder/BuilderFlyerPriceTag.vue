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

const shapeClass = computed(() => {
  switch (shape.value) {
    case 'pill': return 'rounded-full'
    case 'square': return 'rounded-none'
    case 'circle': return 'rounded-full aspect-square'
    default: return 'rounded-lg'
  }
})

// ── Scale factor for highlight ──────────────────────────────────────────────
const s = computed(() => props.isHighlight ? 1.15 : 1)

// ── Price formatting ────────────────────────────────────────────────────────
function splitPrice(val: number | null | undefined): { integer: string; decimal: string } | null {
  if (val == null) return null
  const fixed = val.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const integer = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return { integer, decimal: decPart ?? '00' }
}

function formatFull(val: number | null | undefined): string {
  if (val == null) return ''
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const priceParts = computed(() => splitPrice(props.product.offer_price))
const originalParts = computed(() => splitPrice(props.product.original_price))
const installmentParts = computed(() => splitPrice(props.product.installment_price))

// Unit abbreviation
const unitAbbr = computed(() => {
  const u = props.product.unit
  if (!u || u === 'UN') return ''
  const map: Record<string, string> = {
    KG: 'kg', G: 'g', L: 'L', ML: 'ml',
    PCT: 'pct', CX: 'cx', DZ: 'dz', BD: 'bd', FD: 'fd', SC: 'sc',
  }
  return map[u] || u.toLowerCase()
})

// Discount percentage
const discountPercent = computed(() => {
  const orig = props.product.original_price
  const offer = props.product.offer_price
  if (!orig || !offer || orig <= 0) return null
  return Math.round(((orig - offer) / orig) * 100)
})

// Symbolic price: which denomination to show
const symbolicDenom = computed(() => {
  const price = props.product.offer_price
  if (price == null) return null
  if (price < 1) return { label: `${Math.round(price * 100)}¢`, type: 'coin', count: 1 }
  if (price < 2) return { label: 'R$1', type: 'coin', count: 1 }
  if (price < 5) return { label: 'R$1', type: 'coin', count: Math.min(Math.round(price), 4) }
  if (price < 10) return { label: 'R$5', type: 'note', count: 1 }
  if (price < 20) return { label: 'R$10', type: 'note', count: 1 }
  return { label: 'R$20', type: 'note', count: 1 }
})

const mode = computed(() => props.product.price_mode || 'simple')
</script>

<template>
  <!-- none: no price tag -->
  <div v-if="mode === 'none'" />

  <!-- anticipation: custom text -->
  <div v-else-if="mode === 'anticipation'" class="flex flex-col items-center w-full">
    <p
      v-if="product.anticipation_text"
      class="font-semibold opacity-70 leading-none mb-0.5"
      :style="{ fontSize: `${0.5 * s}em` }"
    >
      {{ product.anticipation_text.split(' ')[0] || '' }}
    </p>
    <div
      class="inline-flex items-center justify-center px-3 py-1.5 w-full"
      :class="shapeClass"
      :style="{ backgroundColor: bgColor, color: textColor }"
    >
      <span
        class="font-bold text-center leading-tight"
        :style="{ fontSize: `${1.1 * s}em` }"
      >
        {{ product.anticipation_text ? product.anticipation_text.split(' ').slice(1).join(' ') || product.anticipation_text : 'Confira' }}
      </span>
    </div>
  </div>

  <!-- symbolic: coins/notes -->
  <div v-else-if="mode === 'symbolic'" class="flex flex-col items-center w-full">
    <div v-if="symbolicDenom" class="flex items-center justify-center gap-1 py-1">
      <template v-for="n in symbolicDenom.count" :key="n">
        <div
          v-if="symbolicDenom.type === 'coin'"
          class="flex items-center justify-center rounded-full border-2 border-yellow-600"
          :style="{
            width: `${2.2 * s}em`,
            height: `${2.2 * s}em`,
            backgroundColor: '#f6e05e',
            color: '#744210',
          }"
        >
          <span class="font-extrabold" :style="{ fontSize: `${0.55 * s}em` }">{{ symbolicDenom.label }}</span>
        </div>
        <div
          v-else
          class="flex items-center justify-center rounded-md border"
          :style="{
            width: `${3.8 * s}em`,
            height: `${1.8 * s}em`,
            backgroundColor: symbolicDenom.label === 'R$5' ? '#276749' : symbolicDenom.label === 'R$10' ? '#c53030' : '#d69e2e',
            color: '#ffffff',
            borderColor: 'rgba(255,255,255,0.3)',
          }"
        >
          <span class="font-extrabold" :style="{ fontSize: `${0.6 * s}em` }">{{ symbolicDenom.label }}</span>
        </div>
      </template>
    </div>
  </div>

  <!-- All other modes with selo -->
  <div v-else class="flex flex-col items-center w-full">

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

    <!-- ── Main price selo ── -->
    <div
      v-if="mode === 'installment' ? installmentParts : priceParts"
      class="inline-flex items-baseline justify-center gap-0.5 px-2 py-1"
      :class="shapeClass"
      :style="{
        backgroundColor: bgColor,
        color: textColor,
      }"
    >
      <span
        class="font-bold leading-none self-start"
        :style="{ fontSize: `${0.45 * s}em`, marginTop: `${0.12 * s}em` }"
      >R$</span>
      <span
        class="font-extrabold leading-none"
        :style="{ fontSize: `${1.2 * s}em` }"
      >{{ mode === 'installment' ? installmentParts?.integer : priceParts?.integer }}</span>
      <div class="flex flex-col items-start">
        <span
          class="font-bold leading-none"
          :style="{ fontSize: `${0.55 * s}em` }"
        >,{{ mode === 'installment' ? installmentParts?.decimal : priceParts?.decimal }}</span>
        <span
          v-if="unitAbbr && mode !== 'installment'"
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
  </div>
</template>
