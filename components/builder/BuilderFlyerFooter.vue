<script setup lang="ts">
import {
  Phone,
  MessageCircle,
  MapPin,
  Instagram,
  Facebook,
  Globe,
} from 'lucide-vue-next'

const { flyer, theme } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const footerHeight = computed(() => {
  const h = theme.value?.footer_config?.height
  return h ? `${h}px` : 'auto'
})

const footerBg = computed(() => theme.value?.css_config?.footerBg || '#222222')
const footerStyle = computed(() => theme.value?.footer_config?.style || 'rounded-large')
const showWatermark = computed(() => theme.value?.footer_config?.showWatermark ?? true)
const accentColor = computed(() => theme.value?.css_config?.accentColor || '#10b981')

const showIllustrativeNote = computed(() => flyer.value?.show_illustrative_note ?? false)
const showStockWarning = computed(() => flyer.value?.show_stock_warning ?? false)
const showMedicineWarning = computed(() => flyer.value?.show_medicine_warning ?? false)

const contactItems = computed(() => {
  const items: Array<{ icon: any; label: string; prefix?: string }> = []
  if (flyer.value?.show_phone && tenant.value?.phone) {
    const prefix = flyer.value?.show_phone_label ? 'Tel: ' : ''
    items.push({ icon: Phone, label: `${prefix}${tenant.value.phone}` })
  }
  if (flyer.value?.show_whatsapp && tenant.value?.whatsapp) {
    const prefix = flyer.value?.show_phone_label ? 'WhatsApp: ' : ''
    items.push({ icon: MessageCircle, label: `${prefix}${tenant.value.whatsapp}` })
  }
  if (flyer.value?.show_address && tenant.value?.address) {
    items.push({ icon: MapPin, label: tenant.value.address })
  }
  if (flyer.value?.show_instagram && tenant.value?.instagram) {
    items.push({ icon: Instagram, label: `@${tenant.value.instagram.replace(/^@/, '')}` })
  }
  if (flyer.value?.show_facebook && tenant.value?.facebook) {
    items.push({ icon: Facebook, label: tenant.value.facebook })
  }
  if (flyer.value?.show_website && tenant.value?.website) {
    items.push({ icon: Globe, label: tenant.value.website })
  }
  return items
})

const warnings = computed(() => {
  const w: string[] = []
  if (showIllustrativeNote.value) w.push('*Imagens meramente ilustrativas.')
  if (showStockWarning.value) w.push('Ofertas validas enquanto durarem os estoques.')
  if (showMedicineWarning.value) w.push('MEDICAMENTOS PODEM CAUSAR EFEITOS INDESEJADOS. EVITE A AUTOMEDICACAO: INFORME-SE COM O FARMACEUTICO.')
  return w
})

const dateRange = computed(() => {
  if (!flyer.value?.show_dates || !flyer.value?.start_date || !flyer.value?.end_date) return ''
  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch { return d }
  }
  return `Valido de ${fmt(flyer.value.start_date)} a ${fmt(flyer.value.end_date)}`
})

// Footer shape classes
const footerShapeClass = computed(() => {
  switch (footerStyle.value) {
    case 'rounded-large': return 'rounded-t-3xl'
    case 'square-large': return 'rounded-none'
    case 'square-compact': return 'rounded-none'
    default: return 'rounded-t-xl'
  }
})

const isCompact = computed(() => footerStyle.value === 'square-compact')
</script>

<template>
  <footer
    class="shrink-0 overflow-hidden"
    :class="footerShapeClass"
    :style="{
      backgroundColor: footerBg,
      minHeight: footerHeight,
      color: '#ffffff',
    }"
  >
    <div :class="isCompact ? 'px-3 py-2' : 'px-4 py-3'" class="space-y-1.5">
      <!-- Company name in footer -->
      <p
        v-if="flyer?.show_company_name && tenant?.name"
        class="text-center font-bold uppercase tracking-wider"
        :class="isCompact ? 'text-[10px]' : 'text-xs'"
      >
        {{ tenant.name }}
      </p>

      <!-- Slogan in footer -->
      <p
        v-if="flyer?.show_slogan && tenant?.slogan"
        class="text-center opacity-70"
        :class="isCompact ? 'text-[8px]' : 'text-[10px]'"
      >
        {{ tenant.slogan }}
      </p>

      <!-- Contact info -->
      <div
        v-if="contactItems.length"
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        <span
          v-for="(item, idx) in contactItems"
          :key="idx"
          class="flex items-center gap-1 opacity-80"
          :class="isCompact ? 'text-[8px]' : 'text-[10px]'"
        >
          <component :is="item.icon" class="w-3 h-3 shrink-0" />
          <span>{{ item.label }}</span>
        </span>
      </div>

      <!-- Payment methods -->
      <p
        v-if="flyer?.show_payment_methods || flyer?.show_payment_notes"
        class="text-center opacity-60"
        :class="isCompact ? 'text-[7px]' : 'text-[9px]'"
      >
        <template v-if="flyer?.show_payment_notes && tenant?.payment_notes">
          {{ tenant.payment_notes }}
        </template>
      </p>

      <!-- Date range in footer -->
      <p
        v-if="dateRange"
        class="text-center font-medium"
        :class="isCompact ? 'text-[8px]' : 'text-[9px]'"
        :style="{ color: accentColor }"
      >
        {{ dateRange }}
      </p>

      <!-- Warnings -->
      <div v-if="warnings.length" class="space-y-0.5">
        <p
          v-for="(w, idx) in warnings"
          :key="idx"
          class="text-center opacity-40 leading-tight"
          :class="isCompact ? 'text-[6px]' : 'text-[8px]'"
        >
          {{ w }}
        </p>
      </div>

      <!-- Watermark -->
      <p
        v-if="showWatermark"
        class="text-center opacity-25 text-[6px] mt-1"
      >
        Feito com JobVarejo
      </p>
    </div>
  </footer>
</template>
