<script setup lang="ts">
const { flyer, theme, updateFlyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const headerHeight = computed(() => {
  const h = theme.value?.header_config?.height
  return h ? `${h}px` : 'auto'
})

const headerBg = computed(() => theme.value?.css_config?.headerBg || '#ffffff')
const showLogo = computed(() => (flyer.value as any)?.show_logo ?? (theme.value?.header_config?.showLogo ?? true))

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
  const flyerLogo = (flyer.value as any)?.custom_logo
  const logo = flyerLogo || tenant.value?.logo
  if (!logo) return null
  if (logo.startsWith('/api/')) return logo
  const wasabiMatch = logo.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+)$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1])}`
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (logo.startsWith('builder/') || logo.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(logo)}`
  }
  return logo
})

// Logo position & size
const logoSize = computed(() => (flyer.value as any)?.logo_size || 80)
const logoX = computed(() => (flyer.value as any)?.logo_x ?? 50)
const logoY = computed(() => (flyer.value as any)?.logo_y ?? 50)

const logoStyle = computed(() => ({
  width: `${logoSize.value}px`,
  height: 'auto',
  maxWidth: 'none',
  position: 'absolute' as const,
  left: `${logoX.value}%`,
  top: `${logoY.value}%`,
  transform: 'translate(-50%, -50%)',
  zIndex: 5,
  cursor: 'grab',
  userSelect: 'none' as const,
}))

// Drag logic
const isDragging = ref(false)
const headerRef = ref<HTMLElement | null>(null)

const onDragStart = (e: MouseEvent) => {
  e.preventDefault()
  isDragging.value = true
  const onMove = (ev: MouseEvent) => {
    if (!headerRef.value) return
    const rect = headerRef.value.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100))
    updateFlyer({ logo_x: Math.round(x * 10) / 10, logo_y: Math.round(y * 10) / 10 } as any)
  }
  const onUp = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<template>
  <header
    ref="headerRef"
    class="shrink-0 relative overflow-hidden"
    :style="{
      backgroundColor: headerBg,
      minHeight: headerHeight,
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

    <!-- Logo — absolute positioned, draggable -->
    <img
      v-if="showLogo && logoUrl"
      :src="logoUrl"
      alt="Logo"
      class="object-contain"
      :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
      :style="logoStyle"
      @mousedown="onDragStart"
      draggable="false"
    />
  </header>
</template>
