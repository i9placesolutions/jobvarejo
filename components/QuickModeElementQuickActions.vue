<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { Palette, Type } from 'lucide-vue-next'
import { getQuickElementToolbarPlacement } from '~/utils/quickElementToolbarPlacement'

const props = withDefaults(defineProps<{
  anchor: { top: number; left: number; width: number; height: number; visible: boolean }
  textSelected?: boolean
  expanded?: boolean
  busy?: boolean
}>(), {
  textSelected: false,
  expanded: false,
  busy: false
})

const emit = defineEmits<{
  (event: 'edit-style'): void
}>()

const root = ref<HTMLElement | null>(null)
const viewport = ref({ width: 1, height: 1 })
let resizeObserver: ResizeObserver | null = null

const measure = () => {
  const element = root.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  viewport.value = {
    width: Math.max(1, Number(element.clientWidth || rect.width || 1)),
    height: Math.max(1, Number(element.clientHeight || rect.height || 1))
  }
}

const toolbarStyle = computed(() => {
  const placement = getQuickElementToolbarPlacement({
    targetLeft: props.anchor.left,
    targetTop: props.anchor.top,
    targetWidth: props.anchor.width,
    targetHeight: props.anchor.height,
    viewportWidth: viewport.value.width,
    viewportHeight: viewport.value.height,
    toolbarWidth: 32,
    toolbarHeight: 30
  })
  return { top: `${Math.round(placement.top)}px`, left: `${Math.round(placement.left)}px` }
})

const label = computed(() => props.textSelected ? 'Personalizar texto' : 'Cor do elemento')
const stopCanvasEvent = (event: Event) => event.stopPropagation()

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(root.value)
  }
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})

watch(() => props.anchor.visible, async visible => {
  if (!visible) return
  await nextTick()
  measure()
})
</script>

<template>
  <div
    v-if="anchor.visible"
    ref="root"
    class="pointer-events-none absolute inset-0 z-[117]"
    :aria-busy="busy"
    @pointerdown="stopCanvasEvent"
    @mousedown="stopCanvasEvent"
    @click="stopCanvasEvent"
    @keydown="stopCanvasEvent"
  >
    <div
      class="pointer-events-auto absolute inline-flex h-[30px] w-8 items-center justify-center rounded-lg border border-white/15 bg-[#18181b]/95 p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-md"
      role="toolbar"
      :aria-label="label"
      :style="toolbarStyle"
    >
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-violet-500/25 hover:text-white active:bg-violet-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
        :title="label"
        :aria-label="label"
        :aria-expanded="expanded"
        :disabled="busy"
        @click="emit('edit-style')"
      >
        <Type v-if="textSelected" class="h-3 w-3" aria-hidden="true" />
        <Palette v-else class="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
