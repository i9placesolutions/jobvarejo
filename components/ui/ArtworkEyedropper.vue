<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { sampleCanvasColor } from '~/utils/canvasColorSampler'

const emit = defineEmits<{
  (event: 'pick', color: string): void
  (event: 'active-change', active: boolean): void
}>()
const canvasActive = ref(false)
const nativeActive = ref(false)
watch([canvasActive, nativeActive], () => emit('active-change', canvasActive.value || nativeActive.value), { flush: 'sync' })
let nativeAbort: AbortController | null = null
let session = 0
const eyedropperHint = ref('Clique na cor desejada dentro da arte. Esc para cancelar.')
const loupeCanvas = ref<HTMLCanvasElement | null>(null)
const loupeColor = ref<string | null>(null)
const loupePosition = ref({ left: 0, top: 0 })
let loupeFrame = 0
let loupePoint = { x: 0, y: 0 }
const canvasAtPoint = (x: number, y: number) => {
  const hit = document.elementsFromPoint(x, y)
    .find(element => element instanceof HTMLCanvasElement && !element.closest('.eyedropper-loupe'))
  return hit?.closest('.canvas-container')?.querySelector<HTMLCanvasElement>('canvas.lower-canvas')
    ?? (hit instanceof HTMLCanvasElement ? hit : null)
}
const refreshLoupe = () => {
  loupeFrame = 0
  if (!canvasActive.value) return
  const { x, y } = loupePoint
  loupePosition.value = {
    left: Math.max(8, Math.min(x + 24, window.innerWidth - 168)),
    top: Math.max(8, Math.min(y + 24, window.innerHeight - 180))
  }
  const context = loupeCanvas.value?.getContext('2d')
  context?.clearRect(0, 0, 110, 110)
  loupeColor.value = null
  try {
    const canvas = canvasAtPoint(x, y)
    if (!canvas) return
    loupeColor.value = sampleCanvasColor(canvas, x, y)
    if (!loupeColor.value || !context) return
    const rect = canvas.getBoundingClientRect()
    const pixelX = Math.floor((x - rect.left) * canvas.width / rect.width)
    const pixelY = Math.floor((y - rect.top) * canvas.height / rect.height)
    context.imageSmoothingEnabled = false
    context.drawImage(canvas, pixelX - 5, pixelY - 5, 11, 11, 0, 0, 110, 110)
  } catch {
    // Canvas protegido: não mostrar uma amostra anterior como se fosse a cor atual.
    loupeColor.value = null
  }
}
const moveLoupe = (event: MouseEvent) => {
  if (!canvasActive.value) return
  loupePoint = { x: event.clientX, y: event.clientY }
  if (!loupeFrame) loupeFrame = requestAnimationFrame(refreshLoupe)
}

const cancel = () => {
  session++
  nativeAbort?.abort()
  nativeAbort = null
  nativeActive.value = false
  canvasActive.value = false
  if (loupeFrame) cancelAnimationFrame(loupeFrame)
  loupeFrame = 0
  loupeColor.value = null
}
const finish = (hex: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return
  cancel()
  emit('pick', hex)
}
const handleKey = (event: KeyboardEvent) => {
  if (!canvasActive.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (event.key === 'Escape') cancel()
}
onMounted(() => window.addEventListener('keydown', handleKey, true))
onUnmounted(() => {
  cancel()
  window.removeEventListener('keydown', handleKey, true)
})
const pickCanvasColor = (event: MouseEvent) => {
  try {
    const canvas = canvasAtPoint(event.clientX, event.clientY)
    const hex = canvas ? sampleCanvasColor(canvas, event.clientX, event.clientY) : null
    if (!hex) {
      eyedropperHint.value = 'Clique em uma área com cor dentro da arte. Esc para cancelar.'
      return
    }
    finish(hex)
  } catch {
    eyedropperHint.value = 'Não foi possível ler esta arte. Uma imagem pode estar bloqueando a captura. Esc para cancelar.'
  }
}
const start = (event: MouseEvent) => {
  if (canvasActive.value || nativeActive.value) return
  const EyeDropper = (window as any).EyeDropper
  if (typeof EyeDropper !== 'function') {
    eyedropperHint.value = 'Clique na cor desejada dentro da arte. Esc para cancelar.'
    canvasActive.value = true
    loupePoint = { x: event.clientX, y: event.clientY }
    nextTick(refreshLoupe)
    return
  }
  nativeActive.value = true
  const currentSession = ++session
  nativeAbort = new AbortController()
  try {
    new EyeDropper().open({ signal: nativeAbort.signal })
      .then((result: { sRGBHex?: string }) => {
        if (currentSession !== session) return
        if (result?.sRGBHex && /^#[0-9a-f]{6}$/i.test(result.sRGBHex)) finish(result.sRGBHex)
        else cancel()
      })
      .catch(() => { if (currentSession === session) cancel() })
  } catch {
    cancel()
  }
}
defineExpose({ start, cancel })
</script>

<template>
  <Teleport to="body">
    <div v-if="canvasActive" class="artwork-eyedropper" @pointermove="moveLoupe"
      @pointerdown.prevent.stop @pointerup.prevent.stop @mousedown.prevent.stop @mouseup.prevent.stop
      @click.prevent.stop="pickCanvasColor">
        <div
          v-if="canvasActive"
          class="eyedropper-loupe"
          :style="{ left: `${loupePosition.left}px`, top: `${loupePosition.top}px` }"
          aria-hidden="true"
        >
          <div class="eyedropper-loupe-image">
            <canvas ref="loupeCanvas" width="110" height="110" />
            <div class="eyedropper-loupe-grid" />
            <div class="eyedropper-loupe-target" />
          </div>
          <div class="eyedropper-loupe-value">
            <span :style="{ backgroundColor: loupeColor || 'transparent' }" />
            {{ loupeColor?.toUpperCase() || 'Aponte para a arte' }}
          </div>
        </div>
        <div v-if="canvasActive" class="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl" @click.stop>
          <span role="status" class="pointer-events-none">{{ eyedropperHint }}</span>
          <button type="button" class="underline cursor-pointer" @click="cancel">Cancelar</button>
        </div>
    </div>
  </Teleport>
</template>

<style scoped>
.artwork-eyedropper { position: fixed; inset: 0; z-index: 10110; cursor: crosshair; touch-action: none; }
.eyedropper-loupe {
  position: fixed;
  z-index: 10103;
  pointer-events: none;
  width: 154px;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #71717a;
  border-radius: 14px;
  background: #18181b;
  color: white;
  box-shadow: 0 8px 30px #0008;
}
.eyedropper-loupe-image {
  position: relative;
  width: 110px;
  height: 110px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 7px;
  background: #3f3f46;
}
.eyedropper-loupe-image canvas { display: block; width: 110px; height: 110px; }
.eyedropper-loupe-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to right, #0002 1px, transparent 1px), linear-gradient(to bottom, #0002 1px, transparent 1px);
  background-size: 10px 10px;
}
.eyedropper-loupe-target {
  position: absolute;
  left: 50px;
  top: 50px;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border: 1px solid white;
  box-shadow: 0 0 0 1px black;
}
.eyedropper-loupe-value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 9px;
  font: 11px/16px monospace;
  white-space: nowrap;
}
.eyedropper-loupe-value span { width: 12px; height: 12px; border: 1px solid #a1a1aa; border-radius: 3px; flex-shrink: 0; }

</style>
