<script setup lang="ts">
const props = withDefaults(defineProps<{
  maxScale?: number
  minScale?: number
}>(), {
  maxScale: 1,
  minScale: 0.34,
})

const outerRef = ref<HTMLElement | null>(null)
const innerRef = ref<HTMLElement | null>(null)
const scale = ref(props.maxScale)

let measureFrame: number | null = null
let outerObserver: ResizeObserver | null = null
let innerObserver: ResizeObserver | null = null

const measure = () => {
  const outer = outerRef.value
  const inner = innerRef.value
  if (!outer || !inner) return

  const outerWidth = outer.clientWidth
  const outerHeight = outer.clientHeight
  const naturalWidth = inner.scrollWidth || inner.offsetWidth
  const naturalHeight = inner.scrollHeight || inner.offsetHeight

  if (!naturalWidth || !naturalHeight) {
    scale.value = props.minScale
    return
  }

  const widthScale = outerWidth > 0 ? outerWidth / naturalWidth : props.maxScale
  const heightScale = outerHeight > 0 ? outerHeight / naturalHeight : props.maxScale
  const nextScale = Math.min(props.maxScale, widthScale, heightScale)

  scale.value = Math.max(
    props.minScale,
    Math.min(props.maxScale, Number.isFinite(nextScale) ? nextScale : props.minScale),
  )
}

const scheduleMeasure = () => {
  if (measureFrame != null) cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(() => {
    measureFrame = null
    measure()
  })
}

watch(() => [props.maxScale, props.minScale], () => {
  scheduleMeasure()
})

onMounted(async () => {
  await nextTick()
  if (typeof ResizeObserver !== 'undefined') {
    outerObserver = new ResizeObserver(() => scheduleMeasure())
    innerObserver = new ResizeObserver(() => scheduleMeasure())
    if (outerRef.value) outerObserver.observe(outerRef.value)
    if (innerRef.value) innerObserver.observe(innerRef.value)
  }
  scheduleMeasure()
})

onBeforeUnmount(() => {
  if (measureFrame != null) cancelAnimationFrame(measureFrame)
  outerObserver?.disconnect()
  innerObserver?.disconnect()
})
</script>

<template>
  <div
    ref="outerRef"
    style="position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden;"
  >
    <div
      ref="innerRef"
      style="position: absolute; left: 50%; top: 50%; width: max-content; max-width: none; min-width: 0; min-height: 0; transform-origin: center center;"
      :style="{ transform: `translate(-50%, -50%) scale(${scale})` }"
    >
      <slot />
    </div>
  </div>
</template>
