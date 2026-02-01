<script setup lang="ts">
import type { LabelTemplate } from '~/types/label-template'
import ColorPicker from './ui/ColorPicker.vue'
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog'

const props = defineProps<{
  template: LabelTemplate | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', templateId: string, updates: { group: any; previewDataUrl?: string; name?: string }): void
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const viewportEl = ref<HTMLDivElement | null>(null)
const imageInputEl = ref<HTMLInputElement | null>(null)
const replaceImageInputEl = ref<HTMLInputElement | null>(null)
let fabric: any = null
let canvas: any = null
let group: any = null

const selectedObj = shallowRef<any>(null)

const editorName = ref('')
const isReady = ref(false)
const zoomPct = ref(100)
const saveError = ref<string | null>(null)
const isSaving = ref(false)

const showFillColorPicker = ref(false)
const showFillColorPicker2 = ref(false)
const showStrokeColorPicker = ref(false)
const showTextStrokeColorPicker = ref(false)

const TEMPLATE_EXTRA_PROPS = ['name', '__fontScale', '__yOffsetRatio']
const FONT_DATALIST_ID = 'label-template-fonts'

const FONT_WEIGHT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Thin (100)', value: 100 },
  { label: 'Extra Light (200)', value: 200 },
  { label: 'Light (300)', value: 300 },
  { label: 'Regular (400)', value: 400 },
  { label: 'Medium (500)', value: 500 },
  { label: 'Semi Bold (600)', value: 600 },
  { label: 'Bold (700)', value: 700 },
  { label: 'Extra Bold (800)', value: 800 },
  { label: 'Black (900)', value: 900 }
]

const loadFabric = async () => {
  if (fabric) return
  const m: any = await import('fabric')
  fabric = m
}

const safeAddWithUpdate = (g: any, obj?: any) => {
  if (!g) return
  if (typeof g.addWithUpdate === 'function') {
    if (obj) g.addWithUpdate(obj)
    else g.addWithUpdate()
    return
  }
  if (obj && typeof g.add === 'function') g.add(obj)
  if (typeof g.triggerLayout === 'function') g.triggerLayout()
  else {
    if (typeof g._calcBounds === 'function') g._calcBounds()
    if (typeof g._updateObjectsCoords === 'function') g._updateObjectsCoords()
  }
  if (typeof g.setCoords === 'function') g.setCoords()
  g.dirty = true
}

const enlivenObjectsAsync = (objectsJson: any[]) => {
  if (!fabric?.util?.enlivenObjects) return Promise.resolve([])
  const fn = fabric.util.enlivenObjects
  try {
    const maybe = fn(objectsJson)
    if (maybe && typeof maybe.then === 'function') return maybe
  } catch (_) {}
  return new Promise<any[]>((resolve, reject) => {
    try {
      fn(objectsJson, (enlivened: any[]) => resolve(enlivened))
    } catch (err) {
      reject(err)
    }
  })
}

const instantiateGroupFromTemplate = async (tpl: LabelTemplate) => {
  const groupJson: any = tpl.group
  const objectsJson = Array.isArray(groupJson?.objects) ? groupJson.objects : []
  const opts = { ...(groupJson || {}) }
  delete (opts as any).objects
  // Avoid restoring Fabric's internal layout manager from plain JSON.
  // When persisted, it becomes a POJO and crashes group init in Fabric v7.
  delete (opts as any).layoutManager
  delete (opts as any).layout
  const enlivened = await enlivenObjectsAsync(objectsJson)
  const g = new fabric.Group(enlivened, opts)
  g.set({ name: 'priceGroup', originX: 'center', originY: 'center' })
  // Allow selecting inner parts
  g.set({ subTargetCheck: true, interactive: true })
  if (typeof g.getObjects === 'function') {
    g.getObjects().forEach((c: any) => c.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }))
  }
  return g
}

const serializeGroupForTemplate = (g: any) => {
  if (!g) return null
  const prev = {
    left: g.left,
    top: g.top,
    scaleX: g.scaleX,
    scaleY: g.scaleY,
    angle: g.angle,
    originX: g.originX,
    originY: g.originY
  }

  // Normalize so templates don't "jump" when applied elsewhere.
  g.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0, originX: 'center', originY: 'center' })
  safeAddWithUpdate(g)
  const json: any = g.toObject(TEMPLATE_EXTRA_PROPS)
  g.set(prev)
  safeAddWithUpdate(g)

  delete json.layoutManager
  delete json.layout
  return json
}

const resizeCanvasToViewport = () => {
  if (!canvas || !viewportEl.value) return
  const r = viewportEl.value.getBoundingClientRect()
  const w = Math.max(240, Math.floor(r.width - 16))
  const h = Math.max(180, Math.floor(r.height - 16))
  if (typeof canvas.setDimensions === 'function') canvas.setDimensions({ width: w, height: h })
  else {
    if (typeof canvas.setWidth === 'function') canvas.setWidth(w)
    if (typeof canvas.setHeight === 'function') canvas.setHeight(h)
  }
  canvas.calcOffset?.()
}

const normalizeAndLayoutForEditor = (g: any) => {
  if (!g || typeof g.getObjects !== 'function') return

  // Normalize group transform so it doesn't open off-screen.
  g.set({ originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0 })

  const all: any[] = g.getObjects()
  const priceBg = all.find(o => o?.name === 'price_bg')
  const img = all.find(o => o?.name === 'price_bg_image' || o?.name === 'splash_image')
  const currencyCircle = all.find(o => o?.name === 'price_currency_bg' || o?.name === 'priceSymbolBg')
  const currencyText = all.find(o => o?.name === 'price_currency_text' || o?.name === 'priceSymbol' || o?.name === 'price_currency')
  const priceText = all.find(o => o?.name === 'smart_price' || o?.name === 'price_value_text')
  const priceInteger = all.find(o => o?.name === 'price_integer_text' || o?.name === 'priceInteger')
  const priceDecimal = all.find(o => o?.name === 'price_decimal_text' || o?.name === 'priceDecimal')
  const priceUnit = all.find(o => o?.name === 'price_unit_text' || o?.name === 'priceUnit')

  // Drop legacy duplicates that usually cause huge bounds (and make the editor open "far away").
  const recognized = new Set([priceBg, img, currencyCircle, currencyText, priceText, priceInteger, priceDecimal, priceUnit].filter(Boolean))
  const cleanupNames = new Set([
    'priceSymbol',
    'price_currency',
    'price_currency_text',
    'priceInteger',
    'priceDecimal',
    'priceUnit',
    'smart_price',
    'price_value_text'
  ])
  all.forEach((o) => {
    if (!o || recognized.has(o)) return
    if (!cleanupNames.has(String(o.name || ''))) return
    g.remove(o)
  })

  // Keep core elements centered so the template looks right in the editor even without a card context.
  if (priceBg) priceBg.set({ originX: 'center', originY: 'center', left: 0, top: 0 })
  if (currencyCircle) currencyCircle.set({ originX: 'center', originY: 'center' })
  if (currencyText) currencyText.set({ originX: 'center', originY: 'center' })
  if (priceText) priceText.set({ originX: 'center', originY: 'center' })
  if (priceInteger) priceInteger.set({ originX: 'left', originY: 'center' })
  if (priceDecimal) priceDecimal.set({ originX: 'left', originY: 'center' })
  if (priceUnit) priceUnit.set({ originX: 'left', originY: 'center' })

  // If there's a splash image, crop it so its *real bounds* are the pill size.
  if (img && priceBg && img.type === 'image' && priceBg.type === 'rect') {
    const pillW = priceBg.width || 1
    const pillH = priceBg.height || 1
    img.set({ originX: 'center', originY: 'center', left: 0, top: 0 })

    const el: any = img._originalElement || img._element
    const iw = el?.naturalWidth || el?.width || img.width || 0
    const ih = el?.naturalHeight || el?.height || img.height || 0

    if (iw > 0 && ih > 0) {
      img.set({ cropX: 0, cropY: 0, width: iw, height: ih })
      let scale = Math.max(pillW / iw, pillH / ih)
      if (!Number.isFinite(scale) || scale <= 0) scale = 1
      scale = Math.min(scale, 20)
      const cropW = Math.min(iw, pillW / scale)
      const cropH = Math.min(ih, pillH / scale)
      const cropX = Math.max(0, (iw - cropW) / 2)
      const cropY = Math.max(0, (ih - cropH) / 2)
      img.set({ cropX, cropY, width: cropW, height: cropH, scaleX: scale, scaleY: scale })
    } else {
      img.set({ cropX: 0, cropY: 0, width: pillW, height: pillH, scaleX: 1, scaleY: 1 })
    }

    if (fabric?.Rect) {
      const clip = new fabric.Rect({
        width: pillW,
        height: pillH,
        rx: (priceBg.rx ?? pillH / 2),
        ry: (priceBg.ry ?? pillH / 2),
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
      })
      img.set({ clipPath: clip })
    }
    if (typeof priceBg.fill === 'string' && priceBg.fill !== 'transparent') priceBg.set('fill', 'transparent')
  }

  safeAddWithUpdate(g)
}

const fitToViewport = () => {
  if (!canvas || !group) return
  group.set({ scaleX: 1, scaleY: 1 })
  group.setCoords()
  const bw = group.getScaledWidth?.() ?? group.width ?? 1
  const bh = group.getScaledHeight?.() ?? group.height ?? 1
  const cw = canvas.getWidth?.() ?? 1
  const ch = canvas.getHeight?.() ?? 1
  const scale = Math.min((cw * 0.9) / bw, (ch * 0.85) / bh, 2)
  group.set({
    left: cw / 2,
    top: ch / 2,
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale
  })
  group.setCoords()
  canvas.requestRenderAll()
}

const loadTemplate = async () => {
  if (!canvas || !props.template) return
  editorName.value = props.template.name || ''
  selectedObj.value = null

  canvas.clear()
  group = await instantiateGroupFromTemplate(props.template)
  normalizeAndLayoutForEditor(group)
  canvas.add(group)
  canvas.setActiveObject(group)
  resizeCanvasToViewport()
  fitToViewport()
  canvas.requestRenderAll()
}

const setSelected = () => {
  if (!canvas) return
  const active = canvas.getActiveObject?.()
  selectedObj.value = active || null
}

const patch = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) return
  obj.set(prop, value)
  if (obj.type === 'textbox' && typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.type?.includes('text') && typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  if (typeof obj.setCoords === 'function') obj.setCoords()
  canvas.requestRenderAll()
}

const patchCustom = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) return
  obj[prop] = value
  if (obj.type?.includes('text') && typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  if (typeof obj.setCoords === 'function') obj.setCoords()
  canvas.requestRenderAll()
}

const current = (prop: string, fallback: any = '') => {
  const obj = selectedObj.value
  return obj ? (obj[prop] ?? fallback) : fallback
}

const currentNumber = (prop: string, fallback = 0) => {
  const v = current(prop, fallback)
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const setTextCase = (mode: 'none' | 'upper' | 'lower') => {
  const obj = selectedObj.value
  if (!obj || !canvas) return
  if (!String(obj?.type || '').includes('text')) return
  const rawKey = '__rawText'
  if (typeof obj[rawKey] !== 'string') obj[rawKey] = String(obj.text ?? '')
  const base = String(obj[rawKey] ?? obj.text ?? '')
  const next = mode === 'upper' ? base.toUpperCase() : mode === 'lower' ? base.toLowerCase() : base
  obj.set('text', next)
  obj.__textCase = mode
  if (typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  obj.setCoords?.()
  canvas.requestRenderAll()
}

const isText = computed(() => {
  const t = selectedObj.value?.type
  return t === 'text' || t === 'i-text' || t === 'textbox'
})

const selectedName = computed(() => String(selectedObj.value?.name || ''))
const isDecimalText = computed(() => selectedName.value === 'price_decimal_text')
const isUnitText = computed(() => selectedName.value === 'price_unit_text')
const isRect = computed(() => selectedObj.value?.type === 'rect')
const isCircle = computed(() => selectedObj.value?.type === 'circle')
const isImage = computed(() => selectedObj.value?.type === 'image')

const currentFontWeight = computed(() => {
  const raw = current('fontWeight', 400)
  const n = Number(raw)
  if (Number.isFinite(n)) return n
  const s = String(raw ?? '').toLowerCase().trim()
  if (!s) return 400
  if (s === 'normal') return 400
  if (s === 'bold') return 700
  return 400
})

const currentTextCase = computed(() => {
  const v = String((selectedObj.value as any)?.__textCase || 'none') as any
  return (v === 'upper' || v === 'lower' || v === 'none') ? v : 'none'
})

const addText = () => {
  if (!fabric || !canvas || !group) return
  const txt = new fabric.IText('Texto', {
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    fontSize: 28,
    fontFamily: 'Inter',
    fontWeight: '700',
    fill: '#ffffff',
    name: `custom_text_${Math.random().toString(36).slice(2, 7)}`
  })
  safeAddWithUpdate(group, txt)
  canvas.setActiveObject(txt)
  setSelected()
  canvas.requestRenderAll()
}

const addRect = () => {
  if (!fabric || !canvas || !group) return
  const rect = new fabric.Rect({
    width: 160,
    height: 60,
    rx: 12,
    ry: 12,
    fill: '#000000',
    stroke: '#ffffff',
    strokeWidth: 2,
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    name: `custom_rect_${Math.random().toString(36).slice(2, 7)}`
  })
  safeAddWithUpdate(group, rect)
  canvas.setActiveObject(rect)
  setSelected()
  canvas.requestRenderAll()
}

const addCircle = () => {
  if (!fabric || !canvas || !group) return
  const c = new fabric.Circle({
    radius: 28,
    fill: '#ffff00',
    stroke: '#000000',
    strokeWidth: 2,
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    name: `custom_circle_${Math.random().toString(36).slice(2, 7)}`
  })
  safeAddWithUpdate(group, c)
  canvas.setActiveObject(c)
  setSelected()
  canvas.requestRenderAll()
}

const openAddImage = () => imageInputEl.value?.click()
const openReplaceImage = () => replaceImageInputEl.value?.click()

const onAddImage = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !fabric || !canvas || !group) return
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(file)
  })

  await new Promise<void>((resolve) => {
    fabric.Image.fromURL(
      dataUrl,
      (img: any) => {
        img.set({
          left: 0,
          top: 0,
          originX: 'center',
          originY: 'center',
          name: `custom_image_${Math.random().toString(36).slice(2, 7)}`
        })
        const iw = img.width || 1
        const ih = img.height || 1
        const targetW = 180
        const s = targetW / iw
        img.set({ scaleX: s, scaleY: s })
        if (ih > iw) img.set({ scaleX: (targetW * 0.7) / iw, scaleY: (targetW * 0.7) / iw })
        safeAddWithUpdate(group, img)
        canvas.setActiveObject(img)
        setSelected()
        canvas.requestRenderAll()
        resolve()
      },
      { crossOrigin: 'anonymous' }
    )
  })

  if (input) input.value = ''
}

const replaceSelectedImage = async (e: Event) => {
  const obj = selectedObj.value
  if (!obj || !fabric || !canvas || !group) return
  if (obj.type !== 'image') return

  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(file)
  })

  await new Promise<void>((resolve) => {
    fabric.Image.fromURL(
      dataUrl,
      (img: any) => {
        const prev = obj
        const keep: any = {
          left: prev.left,
          top: prev.top,
          originX: prev.originX,
          originY: prev.originY,
          angle: prev.angle,
          scaleX: prev.scaleX,
          scaleY: prev.scaleY,
          flipX: prev.flipX,
          flipY: prev.flipY,
          opacity: prev.opacity,
          name: prev.name
        }

        img.set(keep)
        // preserve crop + clipPath if present (common in splash images)
        if (typeof prev.cropX === 'number') img.set('cropX', prev.cropX)
        if (typeof prev.cropY === 'number') img.set('cropY', prev.cropY)
        if (typeof prev.width === 'number') img.set('width', prev.width)
        if (typeof prev.height === 'number') img.set('height', prev.height)
        if (prev.clipPath) img.set('clipPath', prev.clipPath)

        group.remove(prev)
        safeAddWithUpdate(group, img)
        safeAddWithUpdate(group)
        canvas.setActiveObject(img)
        setSelected()
        canvas.requestRenderAll()
        resolve()
      },
      { crossOrigin: 'anonymous' }
    )
  })

  if (input) input.value = ''
}

const deleteSelected = () => {
  if (!canvas || !group) return
  const obj = selectedObj.value
  if (!obj || obj === group) return
  if (typeof group.remove === 'function') group.remove(obj)
  safeAddWithUpdate(group)
  canvas.discardActiveObject?.()
  selectedObj.value = null
  canvas.requestRenderAll()
}

const moveLayer = (dir: -1 | 1) => {
  if (!group || !selectedObj.value || selectedObj.value === group) return
  const obj = selectedObj.value
  const list: any[] = (group._objects || group.getObjects?.() || []).slice()
  const idx = list.indexOf(obj)
  if (idx < 0) return
  const next = idx + dir
  if (next < 0 || next >= list.length) return
  const swapped = list.slice()
  ;[swapped[idx], swapped[next]] = [swapped[next], swapped[idx]]
  // Rebuild group order
  if (typeof group.remove === 'function') list.forEach(o => group.remove(o))
  swapped.forEach(o => safeAddWithUpdate(group, o))
  safeAddWithUpdate(group)
  canvas?.setActiveObject?.(obj)
  canvas?.requestRenderAll?.()
}

const setZoom = (pct: number) => {
  if (!canvas) return
  zoomPct.value = Math.max(25, Math.min(300, pct))
  canvas.setZoom?.(zoomPct.value / 100)
  canvas.requestRenderAll()
}

const save = async () => {
  if (!props.template || !group) return
  if (isSaving.value) return
  isSaving.value = true
  saveError.value = null
  // Persist the editor name onto the template too.
  const name = editorName.value.trim() || props.template.name

  try {
    const groupJson = serializeGroupForTemplate(group)

    // Preview = current editor canvas. This can fail if the canvas is tainted
    // (e.g. external image without CORS). In that case, still save the template.
    let previewDataUrl: string | undefined = undefined
    try {
      previewDataUrl = canvas?.toDataURL?.({ format: 'png', multiplier: 1 })
    } catch (e: any) {
      console.warn('[LabelTemplateMiniEditor] preview toDataURL failed (tainted canvas?)', e)
      previewDataUrl = undefined
    }

    emit('save', props.template.id, { group: groupJson, previewDataUrl, name })
  } catch (e: any) {
    console.error('[LabelTemplateMiniEditor] save failed', e)
    saveError.value = e?.message || 'Falha ao salvar'
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await loadFabric()
  if (!canvasEl.value) return

  canvas = new fabric.Canvas(canvasEl.value, {
    width: 520,
    height: 220,
    backgroundColor: 'transparent',
    preserveObjectStacking: true,
    selection: true
  })

  canvas.on('selection:created', setSelected)
  canvas.on('selection:updated', setSelected)
  canvas.on('selection:cleared', () => (selectedObj.value = null))

  isReady.value = true
  setZoom(100)
  await loadTemplate()

  // Keep the Fabric canvas strictly inside the preview viewport.
  if (viewportEl.value && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      resizeCanvasToViewport()
      fitToViewport()
    })
    ro.observe(viewportEl.value)
  }
})

watch(
  () => props.template?.id,
  async () => {
    if (!isReady.value) return
    await loadTemplate()
  }
)
</script>

<template>
  <div class="space-y-3">
    <input ref="imageInputEl" type="file" class="hidden" accept="image/*" @change="onAddImage" />
    <input ref="replaceImageInputEl" type="file" class="hidden" accept="image/*" @change="replaceSelectedImage" />

    <div class="flex items-center justify-between">
      <div class="text-xs font-bold uppercase tracking-widest text-zinc-500">Mini Editor</div>
      <button class="text-xs text-zinc-300 hover:text-white" @click="emit('close')">Fechar Editor</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="space-y-2 min-w-0">
        <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nome do Modelo</label>
        <input
          v-model="editorName"
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
        />

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="addText">Adicionar Texto</button>
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="addRect">Retangulo</button>
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="addCircle">Circulo</button>
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="openAddImage">Imagem</button>
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" :disabled="!selectedObj || selectedObj === group" @click="moveLayer(-1)">Para Tras</button>
            <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" :disabled="!selectedObj || selectedObj === group" @click="moveLayer(1)">Para Frente</button>
          </div>
          <button
            class="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] text-red-300"
            :disabled="!selectedObj || selectedObj === group"
            @click="deleteSelected"
          >
            Excluir
          </button>
        </div>

        <div ref="viewportEl" class="mini-editor-viewport relative rounded-xl border border-white/10 bg-black/20 p-2 overflow-hidden h-[240px]">
          <canvas ref="canvasEl" class="w-full h-full block rounded-lg" />
        </div>

        <div class="flex items-center gap-2">
          <button class="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200" @click="fitToViewport()">
            Centralizar
          </button>
          <div class="flex items-center gap-2 ml-auto">
            <label class="text-[10px] text-zinc-500">Zoom</label>
            <input type="range" min="50" max="200" :value="zoomPct" class="w-28" @input="setZoom(Number(($event.target as HTMLInputElement).value))" />
          </div>
          <button
            class="px-3 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-xs text-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSaving"
            @click="save"
          >
            {{ isSaving ? 'Salvando...' : 'Salvar Alteracoes' }}
          </button>
        </div>
        <div v-if="saveError" class="text-[10px] text-red-400">{{ saveError }}</div>
      </div>

      <div class="space-y-2 min-w-0">
        <div class="p-3 rounded-xl border border-white/10 bg-zinc-900/30">
          <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Selecionado</div>
          <div v-if="!selectedObj" class="text-xs text-zinc-500">Clique em um elemento dentro da etiqueta (texto, circulo, pill...).</div>
          <div v-else class="space-y-2">
            <div class="text-xs text-white font-semibold truncate">
              {{ selectedObj.name || selectedObj.type }}
              <span class="text-[10px] text-zinc-500 ml-2">({{ selectedObj.type }})</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="col-span-2">
                <label class="text-[10px] text-zinc-500">Nome (id)</label>
                <input class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="current('name', '')" @input="patch('name', ($event.target as HTMLInputElement).value)" />
                <div class="text-[10px] text-zinc-500 mt-1">
                  Use nomes especiais: `price_decimal_text`, `price_unit_text`, `price_integer_text` para layout automatico.
                </div>
              </div>
              <div>
                <label class="text-[10px] text-zinc-500">X</label>
                <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('left', 0))" @input="patch('left', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div>
                <label class="text-[10px] text-zinc-500">Y</label>
                <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('top', 0))" @input="patch('top', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div>
                <label class="text-[10px] text-zinc-500">Scale X</label>
                <input type="number" step="0.01" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('scaleX', 1)).toFixed(2)" @input="patch('scaleX', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div>
                <label class="text-[10px] text-zinc-500">Scale Y</label>
                <input type="number" step="0.01" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('scaleY', 1)).toFixed(2)" @input="patch('scaleY', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="col-span-2">
                <label class="text-[10px] text-zinc-500">Rotacao</label>
                <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('angle', 0))" @input="patch('angle', Number(($event.target as HTMLInputElement).value))" />
              </div>
              <div class="col-span-2">
                <label class="text-[10px] text-zinc-500">Opacity</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                  :value="Number(current('opacity', 1)).toFixed(2)"
                  @input="patch('opacity', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div class="col-span-2 flex items-center justify-between gap-2">
                <label class="text-[10px] text-zinc-500">Visivel</label>
                <input type="checkbox" class="h-4 w-4" :checked="!!current('visible', true)" @change="patch('visible', ($event.target as HTMLInputElement).checked)" />
              </div>
            </div>

            <div v-if="isText" class="pt-2 border-t border-white/10 space-y-2">
              <div>
                <label class="text-[10px] text-zinc-500">Texto</label>
                <input class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="current('text', '')" @input="patch('text', ($event.target as HTMLInputElement).value)" />
              </div>
              <div v-if="isUnitText" class="text-[10px] text-zinc-500">
                Dica: use este texto para gramatura/unidade (ex: 1KG, 900ML, UN).
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] text-zinc-500">Fonte</label>
                  <select
                    class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                    :value="current('fontFamily', '')"
                    @change="patch('fontFamily', ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">(selecionar)</option>
                    <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">
                      {{ font }}
                    </option>
                  </select>
                  <input
                    class="w-full mt-1 bg-zinc-900/60 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200"
                    :list="FONT_DATALIST_ID"
                    :value="current('fontFamily', '')"
                    placeholder="ou digite uma fonte…"
                    @input="patch('fontFamily', ($event.target as HTMLInputElement).value)"
                  />
                  <datalist :id="FONT_DATALIST_ID">
                    <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font" />
                  </datalist>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Tamanho</label>
                  <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('fontSize', 20))" @input="patch('fontSize', Number(($event.target as HTMLInputElement).value))" />
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Peso</label>
                  <select
                    class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                    :value="String(currentFontWeight)"
                    @change="patch('fontWeight', Number(($event.target as HTMLSelectElement).value))"
                  >
                    <option v-for="opt in FONT_WEIGHT_OPTIONS" :key="opt.value" :value="String(opt.value)">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Cor</label>
                  <div class="relative w-full">
                    <div
                      class="w-full h-8 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                      :style="{ backgroundColor: current('fill', '#ffffff') }"
                      @click="showFillColorPicker = true"
                    ></div>
                    <ColorPicker
                      :show="showFillColorPicker"
                      :model-value="current('fill', '#ffffff')"
                      @update:show="showFillColorPicker = $event"
                      @update:model-value="(val: string) => patch('fill', val)"
                    />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] text-zinc-500">Alinhamento</label>
                  <select class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="current('textAlign', 'left')" @change="patch('textAlign', ($event.target as HTMLSelectElement).value)">
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                    <option value="justify">Justificado</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Estilo</label>
                  <select class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="current('fontStyle', 'normal')" @change="patch('fontStyle', ($event.target as HTMLSelectElement).value)">
                    <option value="normal">Normal</option>
                    <option value="italic">Itálico</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Line Height</label>
                  <input type="number" step="0.05" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('lineHeight', 1)).toFixed(2)" @input="patch('lineHeight', Number(($event.target as HTMLInputElement).value))" />
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Letter Spacing</label>
                  <input type="number" step="10" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(currentNumber('charSpacing', 0))" @input="patch('charSpacing', Number(($event.target as HTMLInputElement).value))" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="col-span-2 flex items-center justify-between gap-2">
                  <label class="text-[10px] text-zinc-500">Caixa</label>
                  <select class="w-44 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="currentTextCase" @change="setTextCase(($event.target as HTMLSelectElement).value as any)">
                    <option value="none">Normal</option>
                    <option value="upper">MAIÚSCULO</option>
                    <option value="lower">minúsculo</option>
                  </select>
                </div>
                <div class="col-span-2 flex items-center gap-3">
                  <label class="text-[10px] text-zinc-500">Decoração</label>
                  <label class="flex items-center gap-2 text-[10px] text-zinc-300">
                    <input type="checkbox" class="h-4 w-4" :checked="!!current('underline', false)" @change="patch('underline', ($event.target as HTMLInputElement).checked)" />
                    Underline
                  </label>
                  <label class="flex items-center gap-2 text-[10px] text-zinc-300">
                    <input type="checkbox" class="h-4 w-4" :checked="!!current('linethrough', false)" @change="patch('linethrough', ($event.target as HTMLInputElement).checked)" />
                    Strike
                  </label>
                </div>
              </div>

              <div class="pt-2 border-t border-white/10 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Stroke do Texto</div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-zinc-500">Cor</label>
                    <div class="relative w-full">
                      <div
                        class="w-full h-8 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                        :style="{ backgroundColor: current('stroke', '#000000') }"
                        @click="showTextStrokeColorPicker = true"
                      ></div>
                      <ColorPicker
                        :show="showTextStrokeColorPicker"
                        :model-value="current('stroke', '#000000')"
                        @update:show="showTextStrokeColorPicker = $event"
                        @update:model-value="(val: string) => patch('stroke', val)"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500">Stroke W</label>
                    <input type="number" step="0.1" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('strokeWidth', 0)).toFixed(1)" @input="patch('strokeWidth', Number(($event.target as HTMLInputElement).value))" />
                  </div>
                </div>
              </div>

              <div v-if="isDecimalText" class="pt-2 border-t border-white/10 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Centavos</div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-zinc-500">Escala (auto)</label>
                    <input
                      type="number"
                      step="0.01"
                      class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                      :value="Number(current('__fontScale', 0.42)).toFixed(2)"
                      @input="patchCustom('__fontScale', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500">Altura (auto)</label>
                    <input
                      type="number"
                      step="0.01"
                      class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
                      :value="Number(current('__yOffsetRatio', -0.18)).toFixed(2)"
                      @input="patchCustom('__yOffsetRatio', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                </div>
                <div class="text-[10px] text-zinc-500">
                  Esses campos controlam o tamanho/altura automaticamente quando a etiqueta adapta ao card.
                </div>
              </div>
            </div>

            <div v-else class="pt-2 border-t border-white/10 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] text-zinc-500">Fill</label>
                  <div class="relative w-full">
                    <div
                      class="w-full h-8 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                      :style="{ backgroundColor: current('fill', '#ffffff') }"
                      @click="showFillColorPicker2 = true"
                    ></div>
                    <ColorPicker
                      :show="showFillColorPicker2"
                      :model-value="current('fill', '#ffffff')"
                      @update:show="showFillColorPicker2 = $event"
                      @update:model-value="(val: string) => patch('fill', val)"
                    />
                  </div>
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Stroke</label>
                  <div class="relative w-full">
                    <div
                      class="w-full h-8 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                      :style="{ backgroundColor: current('stroke', '#000000') }"
                      @click="showStrokeColorPicker = true"
                    ></div>
                    <ColorPicker
                      :show="showStrokeColorPicker"
                      :model-value="current('stroke', '#000000')"
                      @update:show="showStrokeColorPicker = $event"
                      @update:model-value="(val: string) => patch('stroke', val)"
                    />
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] text-zinc-500">Stroke W</label>
                  <input type="number" step="0.1" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('strokeWidth', 0)).toFixed(1)" @input="patch('strokeWidth', Number(($event.target as HTMLInputElement).value))" />
                </div>
                <div>
                  <label class="text-[10px] text-zinc-500">Opacity</label>
                  <input type="number" step="0.05" min="0" max="1" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Number(current('opacity', 1)).toFixed(2)" @input="patch('opacity', Number(($event.target as HTMLInputElement).value))" />
                </div>
              </div>

              <div v-if="isRect" class="pt-2 border-t border-white/10 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Retangulo</div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-zinc-500">W</label>
                    <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('width', 0))" @input="patch('width', Number(($event.target as HTMLInputElement).value))" />
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500">H</label>
                    <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('height', 0))" @input="patch('height', Number(($event.target as HTMLInputElement).value))" />
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500">RX</label>
                    <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('rx', 0))" @input="patch('rx', Number(($event.target as HTMLInputElement).value))" />
                  </div>
                  <div>
                    <label class="text-[10px] text-zinc-500">RY</label>
                    <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('ry', 0))" @input="patch('ry', Number(($event.target as HTMLInputElement).value))" />
                  </div>
                </div>
              </div>

              <div v-if="isCircle" class="pt-2 border-t border-white/10 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Circulo</div>
                <div>
                  <label class="text-[10px] text-zinc-500">Raio</label>
                  <input type="number" class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs" :value="Math.round(current('radius', 0))" @input="patch('radius', Number(($event.target as HTMLInputElement).value))" />
                </div>
              </div>

              <div v-if="isImage" class="pt-2 border-t border-white/10 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Imagem</div>
                <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="openReplaceImage">
                  Trocar imagem
                </button>
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex items-center justify-between gap-2">
                    <label class="text-[10px] text-zinc-500">Flip X</label>
                    <input type="checkbox" class="h-4 w-4" :checked="!!current('flipX', false)" @change="patch('flipX', ($event.target as HTMLInputElement).checked)" />
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <label class="text-[10px] text-zinc-500">Flip Y</label>
                    <input type="checkbox" class="h-4 w-4" :checked="!!current('flipY', false)" @change="patch('flipY', ($event.target as HTMLInputElement).checked)" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-zinc-500">
          Dica: selecione o grupo inteiro (priceGroup) para mover/escala geral; selecione textos para alterar fonte/tamanho.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-editor-viewport :deep(.canvas-container) {
  width: 100% !important;
  height: 100% !important;
}
.mini-editor-viewport :deep(canvas) {
  max-width: 100%;
  max-height: 100%;
}
</style>
