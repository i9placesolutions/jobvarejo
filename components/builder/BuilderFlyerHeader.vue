<script setup lang="ts">
const { flyer, theme } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const headerHeight = computed(() => {
  const h = theme.value?.header_config?.height
  return h ? `${h}px` : 'auto'
})

const headerBg = computed(() => theme.value?.css_config?.headerBg || '#ffffff')

const showLogo = computed(() => theme.value?.header_config?.showLogo ?? true)
const showTitle = computed(() => theme.value?.header_config?.showTitle ?? true)
const showDates = computed(() => flyer.value?.show_dates ?? false)
const showPromoPhrase = computed(() => flyer.value?.show_promo_phrase ?? false)

const backgroundImage = computed(() => {
  const img = theme.value?.header_config?.backgroundImage
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
})

const logoUrl = computed(() => {
  const logo = tenant.value?.logo
  if (!logo) return null
  if (logo.startsWith('/api/') || logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (logo.startsWith('builder/') || logo.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(logo)}`
  }
  return logo
})

const dateRange = computed(() => {
  if (!flyer.value?.start_date || !flyer.value?.end_date) return ''
  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch { return d }
  }
  return `${fmt(flyer.value.start_date)} a ${fmt(flyer.value.end_date)}`
})

// Title font size scales with header height
const titleFontSize = computed(() => {
  const h = theme.value?.header_config?.height || 120
  return `${Math.max(16, Math.round(h * 0.22))}px`
})
</script>

<template>
  <header
    class="shrink-0 relative flex flex-col items-center justify-center overflow-hidden"
    :style="{
      backgroundColor: headerBg,
      minHeight: headerHeight,
      color: 'var(--builder-text, #000)',
    }"
  >
    <!-- Background image from theme -->
    <img
      v-if="backgroundImage"
      :src="backgroundImage"
      alt=""
      class="absolute inset-0 w-full h-full object-cover pointer-events-none"
      style="z-index: 0"
    />

    <!-- Content overlay -->
    <div class="relative z-[1] flex flex-col items-center justify-center w-full px-6 py-4 text-center">
      <!-- Logo -->
      <img
        v-if="showLogo && logoUrl"
        :src="logoUrl"
        alt="Logo"
        class="max-h-[60px] mb-2 object-contain"
      />

      <!-- Company Name -->
      <p
        v-if="flyer?.show_company_name && tenant?.name"
        class="text-sm font-bold uppercase tracking-wide opacity-80"
      >
        {{ tenant.name }}
      </p>

      <!-- Slogan -->
      <p
        v-if="flyer?.show_slogan && tenant?.slogan"
        class="text-xs opacity-60 mt-0.5"
      >
        {{ tenant.slogan }}
      </p>

      <!-- Title -->
      <h1
        v-if="showTitle && flyer?.title"
        class="font-extrabold mt-2 leading-tight"
        :style="{
          color: 'var(--builder-primary, #000)',
          fontSize: titleFontSize,
        }"
      >
        {{ flyer.title }}
      </h1>

      <!-- Custom Message -->
      <p
        v-if="flyer?.custom_message"
        class="text-xs mt-1 opacity-70 font-medium"
      >
        {{ flyer.custom_message }}
      </p>

      <!-- Date range -->
      <p
        v-if="showDates && dateRange"
        class="text-xs mt-1 opacity-70 font-medium"
      >
        Valido de {{ dateRange }}
      </p>

      <!-- Promo phrase -->
      <p
        v-if="showPromoPhrase && flyer?.promo_phrase"
        class="text-sm mt-2 font-semibold"
        :style="{ color: 'var(--builder-accent, var(--builder-primary, #000))' }"
      >
        {{ flyer.promo_phrase }}
      </p>
    </div>
  </header>
</template>
