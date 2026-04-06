<script setup lang="ts">
const {
  model,
  zoom,
  cssVariables,
  theme,
  flyer,
  headerTemplates,
  footerTemplates,
} = useBuilderFlyer()

// Templates dinamicos ativos
const activeHeaderTemplate = computed(() => {
  const id = (flyer.value as any)?.header_template_id
  if (!id) return null
  return headerTemplates.value.find((t: any) => t.id === id) || null
})
const activeFooterTemplate = computed(() => {
  const id = (flyer.value as any)?.footer_template_id
  if (!id) return null
  return footerTemplates.value.find((t: any) => t.id === id) || null
})

const canvasRef = ref<HTMLElement | null>(null)

const canvasStyle = computed(() => {
  const w = model.value?.width ?? 1080
  const h = model.value?.height ?? 1080
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `scale(${zoom.value})`,
    transformOrigin: 'top left',
    ...cssVariables.value,
  }
})

const wrapperStyle = computed(() => {
  const w = model.value?.width ?? 1080
  const h = model.value?.height ?? 1080
  const z = zoom.value
  return {
    width: `${w * z}px`,
    height: `${h * z}px`,
  }
})

const backgroundImage = computed(() => {
  const img = theme.value?.background_image
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
})

const bgColor = computed(() => theme.value?.css_config?.bgColor || '#ffffff')

// Ink economy affects background opacity
const inkEconomyOpacity = computed(() => {
  const eco = flyer.value?.ink_economy ?? 0
  return 1 - (eco / 100)
})

// Overlay images (imagens decorativas)
type OverlayImage = { id: string; url: string; x: number; y: number; width: number; opacity: number; zFront: boolean }
const overlayImages = computed<OverlayImage[]>(() => {
  const fc = flyer.value?.font_config as any
  return fc?.overlay_images || []
})

const resolveOverlayUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('/api/') || url.startsWith('http')) return url
  return `/api/storage/p?key=${encodeURIComponent(url)}`
}

// QR Code toggle
const showQrCode = computed(() => {
  const fc = flyer.value?.font_config as any
  return fc?.show_qr_code ?? false
})

defineExpose({ canvasRef })
</script>

<template>
  <div class="shrink-0 m-auto" :style="wrapperStyle">
    <div
      ref="canvasRef"
      class="relative overflow-hidden"
      :style="{
        ...canvasStyle,
        backgroundColor: bgColor,
      }"
    >
      <!-- Background image -->
      <img
        v-if="backgroundImage"
        :src="backgroundImage"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none"
        :style="{ opacity: inkEconomyOpacity }"
        alt=""
      />

      <!-- Overlay images (atras do conteudo) -->
      <img
        v-for="ov in overlayImages.filter(o => !o.zFront)"
        :key="ov.id"
        :src="resolveOverlayUrl(ov.url)"
        class="absolute pointer-events-none"
        :style="{
          left: `${ov.x}%`,
          top: `${ov.y}%`,
          width: `${ov.width}%`,
          opacity: ov.opacity ?? 1,
          zIndex: 5,
        }"
        alt=""
      />

      <!-- Content layers -->
      <div class="relative z-10 flex flex-col h-full">
        <!-- Header: template dinamico ou legado -->
        <BuilderDynamicSection v-if="activeHeaderTemplate" :template="activeHeaderTemplate" section="header" />
        <BuilderFlyerHeader v-else />

        <BuilderFlyerProductGrid class="flex-1 min-h-0" />

        <!-- Footer: template dinamico ou legado -->
        <BuilderDynamicSection v-if="activeFooterTemplate" :template="activeFooterTemplate" section="footer" />
        <BuilderFlyerFooter v-else />
      </div>

      <!-- Overlay images (na frente do conteudo) -->
      <img
        v-for="ov in overlayImages.filter(o => o.zFront)"
        :key="ov.id"
        :src="resolveOverlayUrl(ov.url)"
        class="absolute pointer-events-none"
        :style="{
          left: `${ov.x}%`,
          top: `${ov.y}%`,
          width: `${ov.width}%`,
          opacity: ov.opacity ?? 1,
          zIndex: 20,
        }"
        alt=""
      />
      <!-- QR Code no canto inferior direito -->
      <div v-if="showQrCode" class="absolute z-30 pointer-events-none" style="bottom: 8px; right: 8px">
        <BuilderFlyerQRCode />
      </div>
    </div>
  </div>
</template>
