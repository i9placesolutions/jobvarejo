<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  canvasData: any | null
  width?: number
  height?: number
}>(), {
  width: 1080,
  height: 1350
})

const canvasEl = ref<HTMLCanvasElement | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)

let canvasInstance: any = null
let activeLoadToken = 0

const getFabricNamespace = async (): Promise<any> => {
  const mod: any = await import('fabric')
  return mod?.fabric || mod
}

const disableObjectInteractions = (obj: any) => {
  if (!obj) return
  try {
    obj.set({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true
    })
  } catch {
    // no-op
  }
  if (typeof obj.getObjects === 'function') {
    const children = obj.getObjects() || []
    children.forEach((child: any) => disableObjectInteractions(child))
  }
}

const loadJsonIntoCanvas = async () => {
  if (!canvasInstance) return
  const token = ++activeLoadToken
  isLoading.value = true
  loadError.value = null
  try {
    const json = props.canvasData && typeof props.canvasData === 'object'
      ? JSON.parse(JSON.stringify(props.canvasData))
      : { version: '5.3.0', objects: [] }

    await new Promise<void>((resolve, reject) => {
      const done = () => resolve()
      try {
        const maybePromise = canvasInstance.loadFromJSON(json, done)
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(done).catch(reject)
        }
      } catch (error) {
        reject(error)
      }
    })

    if (token !== activeLoadToken) return
    const objects = typeof canvasInstance.getObjects === 'function'
      ? canvasInstance.getObjects()
      : []
    objects.forEach((obj: any) => disableObjectInteractions(obj))
    canvasInstance.selection = false
    canvasInstance.renderOnAddRemove = true
    canvasInstance.requestRenderAll?.()
  } catch (error: any) {
    if (token !== activeLoadToken) return
    loadError.value = String(error?.message || 'Falha ao renderizar preview')
  } finally {
    if (token === activeLoadToken) {
      isLoading.value = false
    }
  }
}

onMounted(async () => {
  if (!canvasEl.value) return
  const fabricNs = await getFabricNamespace()
  const StaticCanvasCtor = fabricNs?.StaticCanvas || fabricNs?.Canvas
  if (!StaticCanvasCtor) {
    loadError.value = 'Fabric.js indisponível'
    return
  }
  canvasInstance = new StaticCanvasCtor(canvasEl.value, {
    width: props.width,
    height: props.height,
    selection: false,
    interactive: false
  })
  await loadJsonIntoCanvas()
})

watch(() => props.canvasData, () => {
  void loadJsonIntoCanvas()
}, { deep: true })

watch(() => [props.width, props.height], ([width, height]) => {
  if (!canvasInstance) return
  canvasInstance.setWidth(Number(width || 1080))
  canvasInstance.setHeight(Number(height || 1350))
  void loadJsonIntoCanvas()
})

onUnmounted(() => {
  activeLoadToken += 1
  try {
    canvasInstance?.dispose?.()
  } catch {
    // no-op
  }
  canvasInstance = null
})
</script>

<template>
  <div class="relative w-full h-full bg-[#0f1115] rounded-xl overflow-hidden border border-white/10">
    <canvas
      ref="canvasEl"
      class="w-full h-full block"
      :width="width"
      :height="height"
    />

    <div
      v-if="isLoading"
      class="absolute inset-0 bg-black/45 flex items-center justify-center"
    >
      <p class="text-xs text-zinc-200">Atualizando preview...</p>
    </div>

    <div
      v-if="loadError"
      class="absolute inset-0 bg-black/70 flex items-center justify-center px-4"
    >
      <p class="text-xs text-red-200 text-center">{{ loadError }}</p>
    </div>
  </div>
</template>
