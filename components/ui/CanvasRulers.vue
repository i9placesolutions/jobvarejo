<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type GuideAxis = 'x' | 'y'

const props = defineProps<{
  visible: boolean
  canvas: any
  wrapperEl: HTMLElement | null
  guides: Array<{ id: string; axis: GuideAxis; pos: number }>
}>()

const emit = defineEmits<{
  (e: 'create-guide', payload: { axis: GuideAxis; pos: number }): void
  (e: 'update-guide', payload: { id: string; pos: number }): void
  (e: 'delete-guide', payload: { id: string }): void
}>()

const RULER_SIZE = 24
const MARKER_HIT = 7

const topCanvas = ref<HTMLCanvasElement | null>(null)
const leftCanvas = ref<HTMLCanvasElement | null>(null)

const isDragging = ref(false)
const dragMode = ref<'create' | 'move' | null>(null)
const dragAxis = ref<GuideAxis>('x')
const dragGuideId = ref<string | null>(null)
const dragStart = ref<{ x: number; y: number } | null>(null)
const dragScenePos = ref<number>(0)
const previewScreenPos = ref<number | null>(null)

const wrapperRect = () => props.wrapperEl?.getBoundingClientRect?.() ?? null

const vpt = computed(() => {
  const c = props.canvas
  const m = c?.viewportTransform
  return Array.isArray(m) && m.length === 6 ? m : [1, 0, 0, 1, 0, 0]
})
const zoom = computed(() => Number(vpt.value[0] || 1) || 1)

const sceneFromClient = (clientX: number, clientY: number) => {
  const rect = wrapperRect()
  if (!rect) return { x: 0, y: 0 }
  const x = (clientX - rect.left - vpt.value[4]) / zoom.value
  const y = (clientY - rect.top - vpt.value[5]) / zoom.value
  return { x, y }
}

const screenFromScene = (sceneX: number, sceneY: number) => {
  const x = (sceneX * zoom.value) + vpt.value[4]
  const y = (sceneY * zoom.value) + vpt.value[5]
  return { x, y }
}

const visibleSceneBounds = () => {
  const rect = wrapperRect()
  if (!rect) return { left: 0, top: 0, right: 0, bottom: 0 }
  const left = (-vpt.value[4]) / zoom.value
  const top = (-vpt.value[5]) / zoom.value
  const right = (rect.width - vpt.value[4]) / zoom.value
  const bottom = (rect.height - vpt.value[5]) / zoom.value
  return { left, top, right, bottom }
}

const niceStep = (raw: number) => {
  const v = Math.max(1e-6, Math.abs(raw))
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return m * pow
}

let raf = 0
const scheduleDraw = () => {
  if (typeof window === 'undefined') return
  if (!props.visible) return
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}

const draw = () => {
  if (typeof window === 'undefined') return
  const rect = wrapperRect()
  if (!rect) return
  const tc = topCanvas.value
  const lc = leftCanvas.value
  if (!tc || !lc) return

  // Canvas backing store
  const dpr = Math.max(1, (window.devicePixelRatio || 1))
  const topW = Math.floor(rect.width)
  const leftH = Math.floor(rect.height)

  if (tc.width !== Math.floor(topW * dpr) || tc.height !== Math.floor(RULER_SIZE * dpr)) {
    tc.width = Math.floor(topW * dpr)
    tc.height = Math.floor(RULER_SIZE * dpr)
    tc.style.width = `${topW}px`
    tc.style.height = `${RULER_SIZE}px`
  }
  if (lc.width !== Math.floor(RULER_SIZE * dpr) || lc.height !== Math.floor(leftH * dpr)) {
    lc.width = Math.floor(RULER_SIZE * dpr)
    lc.height = Math.floor(leftH * dpr)
    lc.style.width = `${RULER_SIZE}px`
    lc.style.height = `${leftH}px`
  }

  const tctx = tc.getContext('2d')
  const lctx = lc.getContext('2d')
  if (!tctx || !lctx) return
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Background
  tctx.clearRect(0, 0, topW, RULER_SIZE)
  lctx.clearRect(0, 0, RULER_SIZE, leftH)
  tctx.fillStyle = 'rgba(20,20,20,0.92)'
  lctx.fillStyle = 'rgba(20,20,20,0.92)'
  tctx.fillRect(0, 0, topW, RULER_SIZE)
  lctx.fillRect(0, 0, RULER_SIZE, leftH)

  const bounds = visibleSceneBounds()
  const major = niceStep(50 / zoom.value)
  const minor = major / 5

  const tickColor = 'rgba(255,255,255,0.25)'
  const labelColor = 'rgba(255,255,255,0.55)'
  const guideMarker = 'rgba(56,189,248,0.95)'

  // Top ruler (X)
  const startX = Math.floor(bounds.left / minor) * minor
  const endX = bounds.right + minor
  tctx.strokeStyle = tickColor
  tctx.fillStyle = labelColor
  tctx.font = '10px ui-sans-serif, system-ui, -apple-system'
  tctx.textBaseline = 'middle'
  tctx.textAlign = 'left'

  for (let x = startX; x <= endX; x += minor) {
    const sx = screenFromScene(x, 0).x
    if (sx < -20 || sx > (topW + 20)) continue
    const isMajor = Math.abs((x / major) - Math.round(x / major)) < 1e-6
    const len = isMajor ? 10 : 6
    tctx.beginPath()
    tctx.moveTo(sx + 0.5, RULER_SIZE)
    tctx.lineTo(sx + 0.5, RULER_SIZE - len)
    tctx.stroke()
    if (isMajor) {
      tctx.fillText(String(Math.round(x)), sx + 2, RULER_SIZE - 14)
    }
  }

  // Left ruler (Y)
  const startY = Math.floor(bounds.top / minor) * minor
  const endY = bounds.bottom + minor
  lctx.strokeStyle = tickColor
  lctx.fillStyle = labelColor
  lctx.font = '10px ui-sans-serif, system-ui, -apple-system'
  lctx.textBaseline = 'middle'
  lctx.textAlign = 'left'

  for (let y = startY; y <= endY; y += minor) {
    const sy = screenFromScene(0, y).y
    if (sy < -20 || sy > (leftH + 20)) continue
    const isMajor = Math.abs((y / major) - Math.round(y / major)) < 1e-6
    const len = isMajor ? 10 : 6
    lctx.beginPath()
    lctx.moveTo(RULER_SIZE, sy + 0.5)
    lctx.lineTo(RULER_SIZE - len, sy + 0.5)
    lctx.stroke()
    if (isMajor) {
      // rotate label for readability in tiny ruler (keep short)
      lctx.save()
      lctx.translate(2, sy)
      lctx.fillText(String(Math.round(y)), 0, 0)
      lctx.restore()
    }
  }

  // Guide markers (triangles)
  tctx.fillStyle = guideMarker
  lctx.fillStyle = guideMarker
  for (const g of props.guides || []) {
    if (!g) continue
    if (g.axis === 'x') {
      const sx = screenFromScene(Number(g.pos) || 0, 0).x
      if (sx < -20 || sx > (topW + 20)) continue
      tctx.beginPath()
      tctx.moveTo(sx, RULER_SIZE - 1)
      tctx.lineTo(sx - 5, RULER_SIZE - 9)
      tctx.lineTo(sx + 5, RULER_SIZE - 9)
      tctx.closePath()
      tctx.fill()
    } else {
      const sy = screenFromScene(0, Number(g.pos) || 0).y
      if (sy < -20 || sy > (leftH + 20)) continue
      lctx.beginPath()
      lctx.moveTo(RULER_SIZE - 1, sy)
      lctx.lineTo(RULER_SIZE - 9, sy - 5)
      lctx.lineTo(RULER_SIZE - 9, sy + 5)
      lctx.closePath()
      lctx.fill()
    }
  }
}

const findMarkerHit = (axis: GuideAxis, clientX: number, clientY: number) => {
  const rect = wrapperRect()
  if (!rect) return null
  const x = clientX - rect.left
  const y = clientY - rect.top

  let best: { id: string; d: number } | null = null
  for (const g of props.guides || []) {
    if (!g || g.axis !== axis) continue
    if (axis === 'x') {
      const sx = screenFromScene(Number(g.pos) || 0, 0).x
      const d = Math.abs(sx - x)
      if (d <= MARKER_HIT && (!best || d < best.d)) best = { id: g.id, d }
    } else {
      const sy = screenFromScene(0, Number(g.pos) || 0).y
      const d = Math.abs(sy - y)
      if (d <= MARKER_HIT && (!best || d < best.d)) best = { id: g.id, d }
    }
  }
  return best?.id ?? null
}

const beginDrag = (mode: 'create' | 'move', axis: GuideAxis, clientX: number, clientY: number, id?: string | null) => {
  isDragging.value = true
  dragMode.value = mode
  dragAxis.value = axis
  dragGuideId.value = id || null
  dragStart.value = { x: clientX, y: clientY }
  const scene = sceneFromClient(clientX, clientY)
  dragScenePos.value = axis === 'x' ? scene.x : scene.y
  previewScreenPos.value = axis === 'x'
    ? (clientX - (wrapperRect()?.left || 0))
    : (clientY - (wrapperRect()?.top || 0))
}

const endDrag = (clientX: number, clientY: number) => {
  const rect = wrapperRect()
  const start = dragStart.value
  const mode = dragMode.value
  const axis = dragAxis.value
  const id = dragGuideId.value

  isDragging.value = false
  dragMode.value = null
  dragGuideId.value = null
  dragStart.value = null
  previewScreenPos.value = null

  if (!rect || !start || !mode) return
  const moved = Math.hypot(clientX - start.x, clientY - start.y)
  const localX = clientX - rect.left
  const localY = clientY - rect.top

  const inTopRuler = localY >= 0 && localY <= RULER_SIZE
  const inLeftRuler = localX >= 0 && localX <= RULER_SIZE

  // "Drop back into ruler band" means cancel create or delete moved guide.
  if (mode === 'create') {
    const droppedInRuler = axis === 'x' ? inTopRuler : inLeftRuler
    const droppedInCanvas = axis === 'x' ? (localY > RULER_SIZE) : (localX > RULER_SIZE)
    if (moved <= 3) return
    if (droppedInCanvas && !droppedInRuler) emit('create-guide', { axis, pos: dragScenePos.value })
    return
  }

  if (mode === 'move' && id) {
    const droppedInRuler = axis === 'x' ? inTopRuler : inLeftRuler
    if (droppedInRuler) {
      emit('delete-guide', { id })
      return
    }
    emit('update-guide', { id, pos: dragScenePos.value, commit: true } as any)
  }
}

const onPointerMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  const rect = wrapperRect()
  if (!rect) return
  const scene = sceneFromClient(e.clientX, e.clientY)
  dragScenePos.value = dragAxis.value === 'x' ? scene.x : scene.y
  previewScreenPos.value = dragAxis.value === 'x' ? (e.clientX - rect.left) : (e.clientY - rect.top)
  if (dragMode.value === 'move' && dragGuideId.value) {
    emit('update-guide', { id: dragGuideId.value, pos: dragScenePos.value, commit: false } as any)
  }
  e.preventDefault()
}

const onPointerUp = (e: MouseEvent) => {
  if (!isDragging.value) return
  endDrag(e.clientX, e.clientY)
  unbindGlobalDrag()
  e.preventDefault()
}

const bindGlobalDrag = () => {
  window.addEventListener('mousemove', onPointerMove, { passive: false })
  window.addEventListener('mouseup', onPointerUp, { passive: false })
}
const unbindGlobalDrag = () => {
  window.removeEventListener('mousemove', onPointerMove as any)
  window.removeEventListener('mouseup', onPointerUp as any)
}

const onTopMouseDown = (e: MouseEvent) => {
  if (!props.visible) return
  const hit = findMarkerHit('x', e.clientX, e.clientY)
  if (hit) beginDrag('move', 'x', e.clientX, e.clientY, hit)
  else beginDrag('create', 'x', e.clientX, e.clientY, null)
  bindGlobalDrag()
  e.preventDefault()
  e.stopPropagation()
}

const onLeftMouseDown = (e: MouseEvent) => {
  if (!props.visible) return
  const hit = findMarkerHit('y', e.clientX, e.clientY)
  if (hit) beginDrag('move', 'y', e.clientX, e.clientY, hit)
  else beginDrag('create', 'y', e.clientX, e.clientY, null)
  bindGlobalDrag()
  e.preventDefault()
  e.stopPropagation()
}

onMounted(() => {
  scheduleDraw()
})

onUnmounted(() => {
  const c = props.canvas
  if (c && typeof c.off === 'function') c.off('after:render', scheduleDraw)
  if (raf) cancelAnimationFrame(raf)
  unbindGlobalDrag()
})

watch(() => props.visible, () => scheduleDraw(), { immediate: true })
watch(() => props.guides, () => scheduleDraw(), { deep: true })
watch(vpt, () => scheduleDraw(), { deep: true })

watch(
  () => props.canvas,
  (next, prev) => {
    try {
      if (prev && typeof prev.off === 'function') prev.off('after:render', scheduleDraw)
      if (next && typeof next.on === 'function') next.on('after:render', scheduleDraw)
    } catch {
      // ignore
    }
    scheduleDraw()
  },
  { immediate: true }
)
</script>

<template>
  <div v-show="visible" class="absolute inset-0 pointer-events-none" style="z-index: 80;">
    <!-- Preview guide line -->
    <div v-if="isDragging && previewScreenPos != null" class="absolute inset-0 pointer-events-none">
      <div
        v-if="dragAxis === 'x'"
        class="absolute top-0 bottom-0 w-px bg-sky-400/80"
        :style="{ left: previewScreenPos + 'px' }"
      ></div>
      <div
        v-else
        class="absolute left-0 right-0 h-px bg-sky-400/80"
        :style="{ top: previewScreenPos + 'px' }"
      ></div>
    </div>

    <!-- Rulers -->
    <div class="absolute top-0 left-0 right-0 h-[24px] pointer-events-auto" style="background: rgba(20,20,20,0.92);" @mousedown="onTopMouseDown">
      <canvas ref="topCanvas" class="block"></canvas>
    </div>
    <div class="absolute top-0 left-0 bottom-0 w-[24px] pointer-events-auto" style="background: rgba(20,20,20,0.92);" @mousedown="onLeftMouseDown">
      <canvas ref="leftCanvas" class="block"></canvas>
    </div>
    <div class="absolute top-0 left-0 w-[24px] h-[24px] border-r border-b border-white/10" style="background: rgba(20,20,20,0.98);"></div>
  </div>
</template>
