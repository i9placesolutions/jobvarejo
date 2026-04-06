<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  text: string
  tag?: string
  minFontPx?: number
  maxFontPx?: number
  maxLines?: number
  lineHeight?: number
}>(), {
  tag: 'div',
  minFontPx: 11,
  maxFontPx: 48,
  maxLines: 3,
  lineHeight: 1.08,
})

const attrs = useAttrs()
const elementRef = ref<HTMLElement | null>(null)
const fontSizePx = ref(props.maxFontPx)
let fitFrame: number | null = null
let resizeObserver: ResizeObserver | null = null

const measureLineCount = (element: HTMLElement, fontPx: number) => {
  element.style.fontSize = `${fontPx}px`
  element.style.lineHeight = String(props.lineHeight)
  const lineBox = fontPx * props.lineHeight
  if (lineBox <= 0) return 1
  return Math.max(1, Math.round(element.scrollHeight / lineBox))
}

const fitsWithinBounds = (
  element: HTMLElement,
  fontPx: number,
  availableWidth: number,
  availableHeight: number,
) => {
  const lines = measureLineCount(element, fontPx)
  const widthOk = element.scrollWidth <= availableWidth + 1
  const heightOk = availableHeight <= 0 || element.scrollHeight <= availableHeight + 1
  const linesOk = props.maxLines <= 0 || lines <= props.maxLines
  return widthOk && heightOk && linesOk
}

const fitText = () => {
  const element = elementRef.value
  if (!element) return

  const parent = element.parentElement
  const availableWidth = parent?.clientWidth || element.clientWidth || 0
  const availableHeight = parent?.clientHeight || 0

  if (availableWidth <= 0 || !props.text?.trim()) {
    fontSizePx.value = props.minFontPx
    return
  }

  let low = props.minFontPx
  let high = props.maxFontPx
  let best = props.minFontPx

  while (high - low > 0.5) {
    const mid = (low + high) / 2

    if (fitsWithinBounds(element, mid, availableWidth, availableHeight)) {
      best = mid
      low = mid
    } else {
      high = mid
    }
  }

  fontSizePx.value = Math.max(props.minFontPx, Math.round(best * 10) / 10)
}

const scheduleFit = () => {
  if (fitFrame != null) cancelAnimationFrame(fitFrame)
  fitFrame = requestAnimationFrame(() => {
    fitFrame = null
    fitText()
  })
}

watch(
  () => [props.text, props.minFontPx, props.maxFontPx, props.maxLines, props.lineHeight],
  async () => {
    await nextTick()
    scheduleFit()
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  const target = elementRef.value?.parentElement || elementRef.value
  if (target) {
    resizeObserver = new ResizeObserver(() => scheduleFit())
    resizeObserver.observe(target)
  }
  scheduleFit()
})

onBeforeUnmount(() => {
  if (fitFrame != null) cancelAnimationFrame(fitFrame)
  resizeObserver?.disconnect()
})
</script>

<template>
  <component
    :is="tag"
    ref="elementRef"
    v-bind="attrs"
    :style="[
      attrs.style,
      {
        width: '100%',
        fontSize: `${fontSizePx}px`,
        lineHeight: String(lineHeight),
        whiteSpace: 'normal',
        overflowWrap: 'break-word',
        wordBreak: 'normal',
        hyphens: 'auto',
        overflow: 'hidden',
        textWrap: 'balance',
      },
    ]"
  >
    {{ text }}
  </component>
</template>
