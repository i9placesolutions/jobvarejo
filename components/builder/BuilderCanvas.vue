<script setup lang="ts">
const {
  model,
  zoom,
  cssVariables,
  theme,
  flyer,
} = useBuilderFlyer()

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

      <!-- Content layers -->
      <div class="relative z-10 flex flex-col h-full">
        <BuilderFlyerHeader />
        <BuilderFlyerProductGrid class="flex-1 min-h-0" />
        <BuilderFlyerFooter />
      </div>
    </div>
  </div>
</template>
