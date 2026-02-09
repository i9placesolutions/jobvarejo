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

const findObjectByNameDeep = (root: any, wantedName: string): any | null => {
  if (!root || !wantedName) return null
  try {
    if (String(root?.name || '') === wantedName) return root
    const children: any[] = Array.isArray(root?._objects) ? root._objects : (typeof root?.getObjects === 'function' ? root.getObjects() : [])
    for (const c of children || []) {
      const hit = findObjectByNameDeep(c, wantedName)
      if (hit) return hit
    }
  } catch (e) {
    console.warn('[findObjectByNameDeep] error:', e)
  }
  return null
}

// Debug helper to list all objects in a group
const listAllObjects = (root: any, prefix = '') => {
  if (!root) return
  const name = root?.name || root?.type || 'unknown'
  console.log(`[listObjects] ${prefix}${name} (${root?.type})`)
  const children: any[] = Array.isArray(root?._objects) ? root._objects : (typeof root?.getObjects === 'function' ? root.getObjects() : [])
  for (const c of children || []) {
    listAllObjects(c, prefix + '  ')
  }
}

const selectedObj = shallowRef<any>(null)
const updateKey = ref(0) // Force reactivity on property changes

const editorName = ref('')
const isReady = ref(false)
const zoomPct = ref(100)
const saveError = ref<string | null>(null)
const isSaving = ref(false)

const showFillColorPicker = ref(false)
const showFillColorPicker2 = ref(false)
const showStrokeColorPicker = ref(false)
const showTextStrokeColorPicker = ref(false)

// Trigger elements for color pickers positioning
const fillColorTrigger = ref<HTMLElement | null>(null)
const fillColorTrigger2 = ref<HTMLElement | null>(null)
const strokeColorTrigger = ref<HTMLElement | null>(null)
const textStrokeColorTrigger = ref<HTMLElement | null>(null)

// Collapsible sections state (Figma-inspired accordion)
const collapsedSections = ref<Set<string>>(new Set())

const toggleSection = (sectionId: string) => {
  const newSet = new Set(collapsedSections.value)
  if (newSet.has(sectionId)) {
    newSet.delete(sectionId)
  } else {
    newSet.add(sectionId)
  }
  collapsedSections.value = newSet
}

const isSectionCollapsed = (sectionId: string) => collapsedSections.value.has(sectionId)

// Preset color palette (Figma-inspired)
const PRESET_COLORS = [
  // Primary brand colors
  '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
  // Greens and teals
  '#10b981', '#22c55e', '#84cc16', '#eab308',
  // Oranges and reds
  '#f59e0b', '#f97316', '#ef4444', '#dc2626', '#b91c1c',
  // Pinks and purples
  '#ec4899', '#d946ef', '#a855f7', '#7c3aed',
  // Neutrals
  '#ffffff', '#f4f4f5', '#d4d4d8', '#a1a1aa', '#71717a',
  '#3f3f46', '#27272a', '#18181b', '#000000'
]

// Quick preset colors for price labels
const PRICE_LABEL_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#000000', // Black
  '#ffffff', // White
]

const applyPresetColor = (color: string, property: 'fill' | 'stroke') => {
  patch(property, color)
}

// Keep parity with EditorCanvas label template serialization so templates behave the same
// when applied to product cards (proportional scaling, stroke/roundness, etc).
const TEMPLATE_EXTRA_PROPS = [
  'name',
  'fontFamily',
  '__preserveManualLayout',
  '__fontScale',
  '__yOffsetRatio',
  '__strokeWidth',
  '__roundness',
  '__originalWidth',
  '__originalHeight',
  '__originalFontSize',
  '__originalLeft',
  '__originalTop',
  '__originalOriginX',
  '__originalOriginY',
  '__originalScaleX',
  '__originalScaleY',
  '__originalRadius',
  '__originalRx',
  '__originalRy',
  '__originalStrokeWidth',
  '__shadowBlur'
]

const FONT_WEIGHT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Thin', value: 100 },
  { label: 'Extra Light', value: 200 },
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semi Bold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Extra Bold', value: 800 },
  { label: 'Black', value: 900 }
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
  // Fabric objects have fixed class-based type; restoring it from JSON causes warnings.
  delete (opts as any).type
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

const normalizeEditorGroupTransform = (g: any) => {
  if (!g) return
  g.set({
    name: 'priceGroup',
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    subTargetCheck: true,
    interactive: true
  })
  if (typeof g.getObjects === 'function') {
    g.getObjects().forEach((c: any) => {
      c.set?.({ selectable: true, evented: true, hasControls: true, hasBorders: true })
      c.setCoords?.()
    })
  }
  safeAddWithUpdate(g)
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

  // Match the template metadata used by the main editor so proportional scaling works.
  json.__isCustomTemplate = true
  // This template was explicitly edited in the mini editor.
  // Preserve manual element positions on canvas reload/apply.
  json.__preserveManualLayout = true
  if (Array.isArray(json.objects)) {
    json.objects.forEach((obj: any) => {
      if (!obj) return

      obj.__originalLeft = obj.left
      obj.__originalTop = obj.top
      obj.__originalOriginX = obj.originX
      obj.__originalOriginY = obj.originY
      obj.__originalScaleX = obj.scaleX || 1
      obj.__originalScaleY = obj.scaleY || 1

      const t = String(obj.type || '').toLowerCase()
      if (t === 'text' || t === 'i-text' || t === 'textbox') {
        if (typeof obj.fontSize === 'number') obj.__originalFontSize = obj.fontSize
        if (typeof obj.fontFamily === 'string') (obj as any).__originalFontFamily = obj.fontFamily
        if (typeof obj.width === 'number') obj.__originalWidth = obj.width
        if (typeof obj.height === 'number') obj.__originalHeight = obj.height
      }

      if (obj.type === 'circle' && typeof obj.radius === 'number') {
        obj.__originalRadius = obj.radius
      }

      if (obj.type === 'rect') {
        if (typeof obj.width === 'number') obj.__originalWidth = obj.width
        if (typeof obj.height === 'number') obj.__originalHeight = obj.height
        if (typeof obj.rx === 'number') obj.__originalRx = obj.rx
        if (typeof obj.ry === 'number') obj.__originalRy = obj.ry

        if (obj.name === 'price_bg') {
          obj.__originalWidth = obj.width
          obj.__originalHeight = obj.height
          obj.__roundness =
            typeof obj.rx === 'number' && obj.height > 0 ? (obj.rx * 2) / obj.height : 1
          if (typeof obj.strokeWidth === 'number') obj.__strokeWidth = obj.strokeWidth
          if (obj.shadow && typeof obj.shadow.blur === 'number') obj.__shadowBlur = obj.shadow.blur
        }
      }

      if (typeof obj.strokeWidth === 'number') obj.__originalStrokeWidth = obj.strokeWidth
    })
  }
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

  // ===== ATACAREJO TEMPLATE SUPPORT =====
  // Check if this is an atacarejo (2-price) template by looking for the retail background
  const retailBg = all.find(o => o?.name === 'atac_retail_bg')
  const isAtacarejo = !!retailBg

  if (isAtacarejo) {
    // This is an atacarejo template - normalize all atacarejo elements
    const bannerBg = all.find(o => o?.name === 'atac_banner_bg')
    const wholesaleBg = all.find(o => o?.name === 'atac_wholesale_bg')

    const retailCurrency = all.find(o => o?.name === 'retail_currency_text')
    const retailInteger = all.find(o => o?.name === 'retail_integer_text')
    const retailDecimal = all.find(o => o?.name === 'retail_decimal_text')
    const retailUnit = all.find(o => o?.name === 'retail_unit_text')
    const retailPack = all.find(o => o?.name === 'retail_pack_line_text')

    const bannerText = all.find(o => o?.name === 'wholesale_banner_text')

    const wholesaleCurrency = all.find(o => o?.name === 'wholesale_currency_text')
    const wholesaleInteger = all.find(o => o?.name === 'wholesale_integer_text')
    const wholesaleDecimal = all.find(o => o?.name === 'wholesale_decimal_text')
    const wholesaleUnit = all.find(o => o?.name === 'wholesale_unit_text')
    const wholesalePack = all.find(o => o?.name === 'wholesale_pack_line_text')

    // Use a standard preview size that matches the editor canvas
    const previewW = 320
    const previewH = 220
    const totalH = previewH * 0.8  // Total height for the price tag

    // Section heights (same proportions as layoutAtacarejoPriceGroup)
    const bannerH = totalH * 0.14
    const retailH = totalH * 0.43
    const wholesaleH = totalH - retailH - bannerH

    // Vertical positions (centered around 0)
    const y0 = -totalH / 2
    const retailCY = y0 + retailH / 2
    const bannerCY = y0 + retailH + bannerH / 2
    const wholesaleCY = y0 + retailH + bannerH + wholesaleH / 2

    // Backgrounds - center horizontally, position vertically
    if (retailBg) retailBg.set({ originX: 'center', originY: 'center', width: previewW, height: retailH, left: 0, top: retailCY })
    if (bannerBg) bannerBg.set({ originX: 'center', originY: 'center', width: previewW, height: bannerH, left: 0, top: bannerCY })
    if (wholesaleBg) wholesaleBg.set({ originX: 'center', originY: 'center', width: previewW, height: wholesaleH, left: 0, top: wholesaleCY })

    // Helper to set font size based on block height
    const setFontSize = (obj: any, scale: number, baseH: number) => {
      if (obj) {
        const fontSize = typeof obj.__fontScale === 'number' ? baseH * obj.__fontScale : baseH * scale
        obj.set({ fontSize, scaleX: 1, scaleY: 1 })
        if (typeof obj.initDimensions === 'function') obj.initDimensions()
      }
    }

    // Layout retail tier (top section - red background)
    setFontSize(retailInteger, 0.60, retailH)
    setFontSize(retailDecimal, 0.36, retailH)
    setFontSize(retailCurrency, 0.22, retailH)
    setFontSize(retailUnit, 0.22, retailH)
    setFontSize(retailPack, 0.18, retailH)

    if (retailCurrency) retailCurrency.set({ originX: 'left', originY: 'center', left: -60, top: retailCY - (retailH * 0.05) })
    if (retailInteger) retailInteger.set({ originX: 'left', originY: 'center', left: -40, top: retailCY })
    if (retailDecimal) retailDecimal.set({ originX: 'left', originY: 'center', left: 10, top: retailCY - (retailH * 0.18) })
    if (retailUnit) retailUnit.set({ originX: 'left', originY: 'center', left: 45, top: retailCY + (retailH * 0.18) })
    if (retailPack) retailPack.set({ originX: 'center', originY: 'center', left: 0, top: retailCY + (retailH * 0.30) })

    // Layout banner (middle section - white background)
    setFontSize(bannerText, 0.32, bannerH)
    if (bannerText) bannerText.set({ originX: 'center', originY: 'center', left: 0, top: bannerCY })

    // Layout wholesale tier (bottom section - yellow background)
    setFontSize(wholesaleInteger, 0.60, wholesaleH)
    setFontSize(wholesaleDecimal, 0.36, wholesaleH)
    setFontSize(wholesaleCurrency, 0.22, wholesaleH)
    setFontSize(wholesaleUnit, 0.22, wholesaleH)
    setFontSize(wholesalePack, 0.18, wholesaleH)

    if (wholesaleCurrency) wholesaleCurrency.set({ originX: 'left', originY: 'center', left: -60, top: wholesaleCY - (wholesaleH * 0.05) })
    if (wholesaleInteger) wholesaleInteger.set({ originX: 'left', originY: 'center', left: -40, top: wholesaleCY })
    if (wholesaleDecimal) wholesaleDecimal.set({ originX: 'left', originY: 'center', left: 10, top: wholesaleCY - (wholesaleH * 0.18) })
    if (wholesaleUnit) wholesaleUnit.set({ originX: 'left', originY: 'center', left: 45, top: wholesaleCY + (wholesaleH * 0.18) })
    if (wholesalePack) wholesalePack.set({ originX: 'center', originY: 'center', left: 0, top: wholesaleCY + (wholesaleH * 0.30) })

    safeAddWithUpdate(g)
    return
  }

  // ===== STANDARD SINGLE-PRICE TEMPLATE =====
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
  normalizeEditorGroupTransform(group)

  console.log('[MiniEditor] Template loaded, listing objects:')
  listAllObjects(group)

  canvas.add(group)
  canvas.setActiveObject(group)
  resizeCanvasToViewport()
  fitToViewport()
  canvas.requestRenderAll()
}

const setSelected = (opt?: any) => {
  if (!canvas) return

  // When editing a Group with `subTargetCheck`, Fabric keeps the activeObject as the Group.
  // The actually clicked child comes via `subTargets` in pointer events.
  let sub: any = null

  // Try multiple ways to get the sub-target (Fabric v7 compatibility)
  if (Array.isArray(opt?.subTargets) && opt.subTargets.length) {
    sub = opt.subTargets[0]
  } else if (opt?.subTarget) {
    sub = opt.subTarget
  } else if (Array.isArray(opt?.selected) && opt.selected.length) {
    // When a child is selected, check if it's inside our group
    const active = opt.selected[0]
    if (active && active !== group && group && typeof group.getObjects === 'function') {
      const children = group.getObjects()
      if (children.includes(active)) {
        sub = active
      }
    }
  }

  const target = sub || opt?.target || (Array.isArray(opt?.selected) ? opt.selected[0] : null) || canvas.getActiveObject?.()

  console.log('[MiniEditor] setSelected:', {
    targetType: target?.type,
    targetName: target?.name,
    isGroup: target?.type === 'group',
    isSubTarget: !!sub,
    groupName: group?.name,
    hasActiveObject: !!canvas.getActiveObject?.()
  })

  selectedObj.value = target || null
  updateKey.value++
}

const patch = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) {
    console.warn('[MiniEditor] patch: no object or canvas', { obj, canvas })
    return
  }

  // Fabric.Image doesn't render `stroke` / `strokeWidth`.
  // In label templates, the splash image is usually clipped by (and sits on top of)
  // the `price_bg` rect, which should carry the border and fill.
  const isProxiedProp = prop === 'fill' || prop === 'stroke' || prop === 'strokeWidth' || prop.startsWith('stroke') || prop === 'rx' || prop === 'ry' || prop === 'width' || prop === 'height'
  const isSplashImage = obj?.type === 'image' && (obj?.name === 'price_bg_image' || obj?.name === 'splash_image')
  const isPriceGroup = obj?.type === 'group' && (obj === group || obj?.name === 'priceGroup')

  let proxyTarget = obj
  if (isProxiedProp && (isSplashImage || isPriceGroup) && group) {
    const bg = findObjectByNameDeep(group, 'price_bg')
    if (bg) {
      proxyTarget = bg
      console.log('[MiniEditor] patch: using price_bg proxy instead of', obj?.name)
    } else {
      console.warn('[MiniEditor] patch: price_bg NOT FOUND in group!')
      listAllObjects(group, '  ')
    }
  }

  console.log('[MiniEditor] patch:', prop, '=', value, 'on', proxyTarget?.type, proxyTarget?.name, 'id:', proxyTarget?.cacheKey)

  // Use set() method which handles all internal updates
  proxyTarget.set(prop, value)

  // Persist responsive-layout knobs for the price pill.
  if (proxyTarget?.name === 'price_bg' && (prop === 'strokeWidth' || prop === 'rx' || prop === 'ry')) {
    const n = Number(value)
    if (Number.isFinite(n)) (proxyTarget as any)[`__${prop}`] = n
  }

  // Force dirty flag for proper re-rendering
  proxyTarget.dirty = true

  // Handle text objects
  if (proxyTarget.type === 'textbox' && typeof proxyTarget.initDimensions === 'function') proxyTarget.initDimensions()
  if (proxyTarget.type?.includes('text') && typeof proxyTarget.initDimensions === 'function') proxyTarget.initDimensions()

  // CRITICAL: Update the group properly when modifying children
  // Check if the target is inside our group
  let targetParent = proxyTarget.group
  let needsGroupUpdate = false

  if (targetParent === group) {
    needsGroupUpdate = true
  } else if (group && typeof group.getObjects === 'function') {
    // Check if target is a child of our group
    const groupChildren = group.getObjects()
    if (groupChildren.includes(proxyTarget)) {
      needsGroupUpdate = true
    }
  }

  if (needsGroupUpdate && group) {
    console.log('[MiniEditor] patch: updating group after child change')
    safeAddWithUpdate(group)
  }

  // Update coordinates
  if (typeof proxyTarget.setCoords === 'function') proxyTarget.setCoords()

  // Also update the main group coords if needed
  if (group && typeof group.setCoords === 'function') {
    group.setCoords()
  }

  // Render
  canvas.requestRenderAll()
  updateKey.value++ // Force reactivity

  // Verify the change was applied
  const actualValue = typeof proxyTarget.get === 'function' ? proxyTarget.get(prop) : proxyTarget[prop]
  console.log('[MiniEditor] after patch:', prop, '=', actualValue, 'expected:', value, 'match:', actualValue === value)
}

const patchCustom = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) return
  obj[prop] = value
  if (obj.type?.includes('text') && typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  if (typeof obj.setCoords === 'function') obj.setCoords()
  canvas.requestRenderAll()
  updateKey.value++ // Force reactivity
}

const current = (prop: string, fallback: any = '') => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateKey.value // Track for reactivity
  const obj = selectedObj.value
  if (!obj) return fallback

  const isProxiedProp = prop === 'fill' || prop === 'stroke' || prop === 'strokeWidth' || prop.startsWith('stroke') || prop === 'rx' || prop === 'ry' || prop === 'width' || prop === 'height'
  const isSplashImage = obj?.type === 'image' && (obj?.name === 'price_bg_image' || obj?.name === 'splash_image')
  const isPriceGroup = obj?.type === 'group' && (obj === group || obj?.name === 'priceGroup')

  let target = obj
  if (isProxiedProp && (isSplashImage || isPriceGroup) && group) {
    const bg = findObjectByNameDeep(group, 'price_bg')
    if (bg) target = bg
  }

  const val = typeof target.get === 'function' ? target.get(prop) : target[prop]
  const result = val ?? fallback

  // For stroke, if it's transparent/null/undefined, return a default visible color
  // This prevents the ColorPicker from starting with alpha=0 (invisible)
  if (prop === 'stroke' && (!result || result === 'transparent' || result === null)) {
    return fallback || '#000000'
  }

  return result
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
const isPriceGroupSelected = computed(() => {
  const obj = selectedObj.value
  return obj?.type === 'group' && (obj === group || obj?.name === 'priceGroup')
})

const isSplashImageSelected = computed(() => {
  const obj = selectedObj.value
  return obj?.type === 'image' && (obj?.name === 'price_bg_image' || obj?.name === 'splash_image')
})

const isRect = computed(() => {
  if (selectedObj.value?.type === 'rect') return true
  if (isPriceGroupSelected.value || isSplashImageSelected.value) {
    return findObjectByNameDeep(group, 'price_bg')?.type === 'rect'
  }
  return false
})

const isCircle = computed(() => {
  if (selectedObj.value?.type === 'circle') return true
  if (isPriceGroupSelected.value || isSplashImageSelected.value) {
    return findObjectByNameDeep(group, 'price_bg')?.type === 'circle'
  }
  return false
})

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
  
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => reject(new Error('FileReader failed'))
      r.readAsDataURL(file)
    })

    // Fabric v7: fromURL returns a Promise
    const img: any = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' })
    
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
    
    console.log('✅ [MiniEditor] Imagem adicionada com sucesso:', img.name)
  } catch (err) {
    console.error('❌ [MiniEditor] Erro ao adicionar imagem:', err)
  }

  if (input) input.value = ''
}

const replaceSelectedImage = async (e: Event) => {
  const obj = selectedObj.value
  if (!obj || !fabric || !canvas || !group) return
  if (obj.type !== 'image') return

  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => reject(new Error('FileReader failed'))
      r.readAsDataURL(file)
    })

    // Fabric v7: fromURL returns a Promise
    const img: any = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' })
    
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
    
    console.log('✅ [MiniEditor] Imagem substituída com sucesso')
  } catch (err) {
    console.error('❌ [MiniEditor] Erro ao substituir imagem:', err)
  }

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

const commitEditingTextObjects = (root: any) => {
  if (!root) return
  const queue: any[] = [root]
  while (queue.length) {
    const cur = queue.shift()
    if (!cur) continue
    const t = String(cur?.type || '').toLowerCase()
    if ((t === 'i-text' || t === 'textbox' || t === 'text') && cur?.isEditing && typeof cur.exitEditing === 'function') {
      try {
        cur.exitEditing()
      } catch {
        // ignore individual object failures and continue committing the rest
      }
      cur.initDimensions?.()
      cur.setCoords?.()
    }
    const children: any[] = Array.isArray(cur?._objects)
      ? cur._objects
      : (typeof cur?.getObjects === 'function' ? cur.getObjects() : [])
    for (const child of children || []) queue.push(child)
  }
}

const save = async () => {
  if (!props.template || !group) return
  if (isSaving.value) return
  isSaving.value = true
  saveError.value = null
  // Persist the editor name onto the template too.
  const name = editorName.value.trim() || props.template.name

  try {
    // Commit any in-place text editing before serialization.
    try {
      const active = canvas?.getActiveObject?.()
      const t = String(active?.type || '').toLowerCase()
      if ((t === 'i-text' || t === 'textbox') && active?.isEditing && typeof active.exitEditing === 'function') {
        active.exitEditing()
        active.setCoords?.()
        canvas?.requestRenderAll?.()
      }
      // In subTarget/group editing mode the active object can be the parent group.
      // Ensure all nested text edits are committed before serializing.
      commitEditingTextObjects(group)
      if (active && active !== group) commitEditingTextObjects(active)
      safeAddWithUpdate(group)
    } catch {
      // ignore
    }

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

  // Enhanced selection handling for groups with subTargetCheck
  const handleSelection = (e: any) => {
    console.log('[MiniEditor] selection event:', e?.kind, 'selected:', e?.selected?.[0]?.name || e?.selected?.[0]?.type)

    // Try to get the actual sub-target that was clicked
    let actualTarget = e?.selected?.[0]

    // If it's our group, try to find what was actually clicked
    if (actualTarget === group && e?.subTargets && e.subTargets.length > 0) {
      actualTarget = e.subTargets[0]
      console.log('[MiniEditor] using subTarget:', actualTarget?.name)
    }

    setSelected({
      target: actualTarget || e?.selected?.[0],
      subTargets: e?.subTargets,
      selected: e?.selected
    })
  }

  canvas.on('selection:created', handleSelection)
  canvas.on('selection:updated', handleSelection)
  canvas.on('selection:cleared', () => {
    console.log('[MiniEditor] selection cleared')
    selectedObj.value = null
    updateKey.value++
  })

  // Also try to catch clicks on objects
  canvas.on('mouse:down', (e: any) => {
    console.log('[MiniEditor] mouse:down', {
      target: e?.target?.name || e?.target?.type,
      subTarget: e?.subTarget?.name || e?.subTarget?.type
    })
    setSelected({
      target: e?.target,
      subTarget: e?.subTarget,
      subTargets: e?.subTargets
    })
  })

  canvas.on('mouse:up', (e: any) => {
    // Don't clear selection on mouse up
    if (e?.target) {
      setSelected({
        target: e.target,
        subTarget: e?.subTarget,
        subTargets: e?.subTargets
      })
    }
  })

  // Add path modifier to ensure subTargetCheck works
  canvas.on('path:created', (e: any) => {
    console.log('[MiniEditor] path:created', e?.path?.name)
  })

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
  <div class="me-container">
    <input ref="imageInputEl" type="file" class="hidden" accept="image/*" @change="onAddImage" />
    <input ref="replaceImageInputEl" type="file" class="hidden" accept="image/*" @change="replaceSelectedImage" />

    <!-- Floating Top Bar (compact) -->
    <div class="me-top-bar">
      <div class="me-top-left">
        <input
          v-model="editorName"
          class="me-name-input-compact"
          placeholder="Nome do modelo..."
        />
      </div>
      <div class="me-top-actions">
        <button class="me-save-btn-compact" :disabled="isSaving" @click="save">
          <svg v-if="!isSaving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isSaving ? 'Salvando...' : 'Salvar' }}
        </button>
        <button class="me-close-compact" @click="emit('close')" title="Fechar (Esc)">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="saveError" class="me-error-msg-compact">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ saveError }}
    </div>

    <div class="me-grid">
      <!-- Left Panel - Canvas (main area) -->
      <div class="me-main-panel">
        <!-- Floating Toolbar -->
        <div class="me-toolbar-floating">
          <button class="me-tool-btn-compact" @click="addText" title="Adicionar texto">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </button>
          <button class="me-tool-btn-compact" @click="addRect" title="Adicionar retângulo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            </svg>
          </button>
          <button class="me-tool-btn-compact" @click="addCircle" title="Adicionar círculo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke-width="2" />
            </svg>
          </button>
          <button class="me-tool-btn-compact" @click="openAddImage" title="Adicionar imagem">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div class="me-toolbar-divider"></div>
          <button
            class="me-tool-btn-compact"
            :class="{ 'me-tool-btn--disabled': !selectedObj || selectedObj === group }"
            :disabled="!selectedObj || selectedObj === group"
            @click="moveLayer(1)"
            title="Trazer para frente"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
          <button
            class="me-tool-btn-compact"
            :class="{ 'me-tool-btn--disabled': !selectedObj || selectedObj === group }"
            :disabled="!selectedObj || selectedObj === group"
            @click="moveLayer(-1)"
            title="Enviar para trás"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          <div class="me-toolbar-divider"></div>
          <button
            class="me-tool-btn-compact me-tool-btn--danger"
            :class="{ 'me-tool-btn--disabled': !selectedObj || selectedObj === group }"
            :disabled="!selectedObj || selectedObj === group"
            @click="deleteSelected"
            title="Excluir (Delete)"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <!-- Canvas Viewport (now the main focus) -->
        <div ref="viewportEl" class="me-viewport">
          <canvas ref="canvasEl" />
          <div class="me-zoom-badge">{{ zoomPct }}%</div>
        </div>

        <!-- Floating Bottom Controls -->
        <div class="me-bottom-controls-floating">
          <button class="me-control-btn-compact" @click="fitToViewport()" title="Centralizar">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <div class="me-zoom-control-compact">
            <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="range"
              min="50"
              max="200"
              :value="zoomPct"
              class="me-zoom-slider-compact"
              @input="setZoom(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- Right Panel - Properties -->
      <div class="me-props-panel custom-scrollbar">
        <!-- No Selection State -->
        <div v-if="!selectedObj" class="me-empty-state">
          <div class="me-empty-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <p class="me-empty-title">Selecione um elemento</p>
          <p class="me-empty-text">Clique em um item da etiqueta para editar suas propriedades</p>
        </div>

        <div v-else class="me-props-content">
          <!-- Selection Header with Quick Actions -->
          <div class="me-selection-header">
            <div class="me-type-badge">
              {{ (selectedObj.type || 'O').charAt(0).toUpperCase() }}
            </div>
            <div class="me-selection-info">
              <input
                class="me-selection-name"
                :value="current('name', '')"
                placeholder="Nome do elemento"
                @input="patch('name', ($event.target as HTMLInputElement).value)"
              />
              <span class="me-selection-type">{{ selectedObj.type || 'objeto' }}</span>
            </div>
            <!-- Quick Actions (Figma-inspired) -->
            <div class="me-quick-actions">
              <button
                class="me-quick-btn"
                :class="{ 'me-quick-btn--active': !!current('visible', true) }"
                :title="!!current('visible', true) ? 'Ocultar' : 'Mostrar'"
                @click="patch('visible', !current('visible', true))"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                class="me-quick-btn me-quick-btn--danger"
                title="Excluir"
                @click="deleteSelected"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Collapsible: Transform Section -->
          <div class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('transform') }"
              @click="toggleSection('transform')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span>Posição &amp; Tamanho</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('transform')" class="me-accordion-content">
              <div class="me-props-grid me-props-grid--4">
                <div class="me-prop-item">
                  <label class="me-prop-label">X</label>
                  <input
                    type="number"
                    class="me-prop-input"
                    :value="Math.round(current('left', 0))"
                    @input="patch('left', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div class="me-prop-item">
                  <label class="me-prop-label">Y</label>
                  <input
                    type="number"
                    class="me-prop-input"
                    :value="Math.round(current('top', 0))"
                    @input="patch('top', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div class="me-prop-item">
                  <label class="me-prop-label">Escala X</label>
                  <input
                    type="number"
                    step="0.05"
                    class="me-prop-input"
                    :value="Number(current('scaleX', 1)).toFixed(2)"
                    @input="patch('scaleX', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div class="me-prop-item">
                  <label class="me-prop-label">Escala Y</label>
                  <input
                    type="number"
                    step="0.05"
                    class="me-prop-input"
                    :value="Number(current('scaleY', 1)).toFixed(2)"
                    @input="patch('scaleY', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
              <div class="me-props-grid me-props-grid--3">
                <div class="me-prop-item">
                  <label class="me-prop-label">Rotação</label>
                  <div class="me-prop-input-with-unit">
                    <input
                      type="number"
                      class="me-prop-input me-prop-input--compact"
                      :value="Math.round(current('angle', 0))"
                      @input="patch('angle', Number(($event.target as HTMLInputElement).value))"
                    />
                    <span class="me-prop-unit">°</span>
                  </div>
                </div>
                <div class="me-prop-item">
                  <label class="me-prop-label">Opacidade</label>
                  <div class="me-opacity-control">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      :value="Number(current('opacity', 1))"
                      @input="patch('opacity', parseFloat(($event.target as HTMLInputElement).value))"
                    />
                    <span class="me-opacity-value">{{ Math.round(Number(current('opacity', 1)) * 100) }}%</span>
                  </div>
                </div>
                <div class="me-prop-item">
                  <label class="me-prop-label">Ângulo</label>
                  <input
                    type="number"
                    class="me-prop-input"
                    :value="Math.round(current('angle', 0))"
                    @input="patch('angle', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Collapsible: Appearance Section (Fill & Stroke) -->
          <div class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('appearance') }"
              @click="toggleSection('appearance')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>Cor &amp; Aparência</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('appearance')" class="me-accordion-content">
              <!-- Preset Colors (Figma-inspired) -->
              <div class="me-preset-colors">
                <button
                  v-for="color in PRICE_LABEL_COLORS"
                  :key="color"
                  class="me-preset-color"
                  :class="{ 'me-preset-color--active': String(current('fill', '')).toLowerCase() === color.toLowerCase() }"
                  :style="{ backgroundColor: color }"
                  :title="color"
                  @click="applyPresetColor(color, 'fill')"
                ></button>
              </div>

              <div class="me-props-grid me-props-grid--2">
                <div>
                  <label class="me-prop-label">Preenchimento</label>
                  <div class="me-color-row">
                    <div
                      :ref="isText ? 'fillColorTrigger' : 'fillColorTrigger2'"
                      class="me-color-swatch-large"
                      :style="{ backgroundColor: current('fill', '#ffffff') }"
                      @click="isText ? (showFillColorPicker = true) : (showFillColorPicker2 = true)"
                    ></div>
                    <input
                      class="me-color-hex-input"
                      :value="String(current('fill', '#ffffff')).replace('#', '').toUpperCase()"
                      maxlength="6"
                      @input="patch('fill', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
                    />
                    <ColorPicker
                      :show="isText ? showFillColorPicker : showFillColorPicker2"
                      :model-value="current('fill', '#ffffff')"
                      :trigger-element="isText ? fillColorTrigger : fillColorTrigger2"
                      @update:show="isText ? (showFillColorPicker = $event) : (showFillColorPicker2 = $event)"
                      @update:model-value="(val: string) => patch('fill', val)"
                    />
                  </div>
                </div>
                <div>
                  <label class="me-prop-label">Contorno</label>
                  <div class="me-color-row">
                    <div
                      ref="strokeColorTrigger"
                      class="me-color-swatch-large me-color-swatch--stroke checkerboard-bg"
                      @click="showStrokeColorPicker = true"
                    >
                      <div
                        class="absolute inset-0"
                        :style="{ backgroundColor: current('stroke', null) || 'transparent' }"
                      ></div>
                    </div>
                    <input
                      class="me-color-hex-input"
                      :value="String(current('stroke', '000000')).replace('#', '').toUpperCase()"
                      maxlength="6"
                      @input="patch('stroke', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
                    />
                    <ColorPicker
                      :show="showStrokeColorPicker"
                      :model-value="current('stroke', '#000000')"
                      :trigger-element="strokeColorTrigger"
                      @update:show="showStrokeColorPicker = $event"
                      @update:model-value="(val: string) => patch('stroke', val)"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label class="me-prop-label">Largura do Contorno</label>
                <div class="me-stroke-width-control">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    :value="Number(current('strokeWidth', 0))"
                    @input="patch('strokeWidth', Number(($event.target as HTMLInputElement).value))"
                  />
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    class="me-stroke-width-number"
                    :value="Number(current('strokeWidth', 0)).toFixed(1)"
                    @input="(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) patch('strokeWidth', v) }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Collapsible: Typography Section (Text only) -->
          <div v-if="isText" class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('typography') }"
              @click="toggleSection('typography')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              <span>Tipografia</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('typography')" class="me-accordion-content">
              <div>
                <label class="me-prop-label">Conteúdo</label>
                <input
                  class="me-text-input"
                  :value="current('text', '')"
                  @input="patch('text', ($event.target as HTMLInputElement).value)"
                />
              </div>

              <div v-if="isUnitText" class="me-hint-box">
                💡 Use para gramatura/unidade (ex: 1KG, 900ML, UN)
              </div>

              <div>
                <label class="me-prop-label">Fonte</label>
                <select
                  class="me-select-input"
                  :value="current('fontFamily', '')"
                  @change="patch('fontFamily', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">(selecionar)</option>
                  <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
                </select>
              </div>

              <!-- Font Size & Weight (Figma-style inline controls) -->
              <div class="me-font-controls">
                <div class="me-font-control-group">
                  <label class="me-prop-label">Tamanho</label>
                  <div class="me-font-control-row">
                    <input
                      type="number"
                      class="me-font-number"
                      :value="Math.round(current('fontSize', 20))"
                      @input="patch('fontSize', Number(($event.target as HTMLInputElement).value))"
                    />
                    <button
                      class="me-font-btn"
                      @click="patch('fontSize', Number(current('fontSize', 20)) - 1)"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                      </svg>
                    </button>
                    <button
                      class="me-font-btn"
                      @click="patch('fontSize', Number(current('fontSize', 20)) + 1)"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="me-font-control-group">
                  <label class="me-prop-label">Peso</label>
                  <select
                    class="me-font-select"
                    :value="String(currentFontWeight)"
                    @change="patch('fontWeight', Number(($event.target as HTMLSelectElement).value))"
                  >
                    <option v-for="opt in FONT_WEIGHT_OPTIONS" :key="opt.value" :value="String(opt.value)">{{ opt.label }}</option>
                  </select>
                </div>
              </div>

              <!-- Text Style Buttons (Figma-style) -->
              <div class="me-text-style-buttons">
                <button
                  class="me-style-btn"
                  :class="{ 'me-style-btn--active': !!current('underline', false) }"
                  title="Sublinhado"
                  @click="patch('underline', !current('underline', false))"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
                  </svg>
                </button>
                <button
                  class="me-style-btn"
                  :class="{ 'me-style-btn--active': !!current('linethrough', false) }"
                  title="Riscado"
                  @click="patch('linethrough', !current('linethrough', false))"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v7a5 5 0 0010 0V4M3 12h18" />
                  </svg>
                </button>
                <button
                  class="me-style-btn"
                  :class="{ 'me-style-btn--active': current('fontStyle') === 'italic' }"
                  title="Itálico"
                  @click="patch('fontStyle', current('fontStyle') === 'italic' ? 'normal' : 'italic')"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l4-14m-4 14h6m-6 0H6m10 0h-2" />
                  </svg>
                </button>
              </div>

              <!-- Text Alignment (Figma-style) -->
              <div class="me-align-buttons">
                <button
                  class="me-align-btn"
                  :class="{ 'me-align-btn--active': current('textAlign') === 'left' }"
                  @click="patch('textAlign', 'left')"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h7" />
                  </svg>
                </button>
                <button
                  class="me-align-btn"
                  :class="{ 'me-align-btn--active': current('textAlign') === 'center' }"
                  @click="patch('textAlign', 'center')"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14" />
                  </svg>
                </button>
                <button
                  class="me-align-btn"
                  :class="{ 'me-align-btn--active': current('textAlign') === 'right' }"
                  @click="patch('textAlign', 'right')"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M8 18h12" />
                  </svg>
                </button>
              </div>

              <!-- Text Case -->
              <div>
                <label class="me-prop-label">Caixa de Texto</label>
                <select
                  class="me-select-input"
                  :value="currentTextCase"
                  @change="setTextCase(($event.target as HTMLSelectElement).value as any)"
                >
                  <option value="none">Normal</option>
                  <option value="upper">MAIÚSCULAS</option>
                  <option value="lower">minúsculas</option>
                </select>
              </div>

              <div class="me-props-grid me-props-grid--2">
                <div>
                  <label class="me-prop-label">Altura de Linha</label>
                  <input
                    type="number"
                    step="0.1"
                    class="me-text-input"
                    :value="Number(current('lineHeight', 1)).toFixed(1)"
                    @input="patch('lineHeight', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div>
                  <label class="me-prop-label">Espaçamento</label>
                  <input
                    type="number"
                    step="10"
                    class="me-text-input"
                    :value="Math.round(currentNumber('charSpacing', 0))"
                    @input="patch('charSpacing', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <!-- Decimal special fields -->
              <div v-if="isDecimalText" class="me-decimal-section">
                <div class="me-decimal-header">
                  ⚡ Ajustes Automáticos (Centavos)
                </div>
                <div class="me-props-grid me-props-grid--2">
                  <div>
                    <label class="me-prop-label">Escala</label>
                    <input
                      type="number"
                      step="0.01"
                      class="me-amber-input"
                      :value="Number(current('__fontScale', 0.42)).toFixed(2)"
                      @input="patchCustom('__fontScale', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                  <div>
                    <label class="me-prop-label">Offset Y</label>
                    <input
                      type="number"
                      step="0.01"
                      class="me-amber-input"
                      :value="Number(current('__yOffsetRatio', -0.18)).toFixed(2)"
                      @input="patchCustom('__yOffsetRatio', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                </div>
                <p class="me-decimal-hint">Controla tamanho/altura ao adaptar no card</p>
              </div>
            </div>
          </div>

          <!-- Collapsible: Dimensions Section (Shapes only) -->
          <div v-if="!isText" class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('dimensions') }"
              @click="toggleSection('dimensions')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
              <span>Dimensões</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('dimensions')" class="me-accordion-content">
              <!-- Rect specific -->
              <div v-if="isRect" class="me-props-grid me-props-grid--2">
                <div>
                  <label class="me-prop-label">Largura</label>
                  <input
                    type="number"
                    class="me-text-input"
                    :value="Math.round(current('width', 0))"
                    @input="patch('width', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div>
                  <label class="me-prop-label">Altura</label>
                  <input
                    type="number"
                    class="me-text-input"
                    :value="Math.round(current('height', 0))"
                    @input="patch('height', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <!-- Border Radius for Rects -->
              <div v-if="isRect">
                <label class="me-prop-label">Arredondamento dos Cantos</label>
                <div class="me-radius-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    class="me-range-slider"
                    :value="Math.round(current('rx', 0))"
                    @input="patch('rx', Number(($event.target as HTMLInputElement).value)); patch('ry', Number(($event.target as HTMLInputElement).value))"
                  />
                  <input
                    type="number"
                    min="0"
                    class="me-radius-number"
                    :value="Math.round(current('rx', 0))"
                    @input="patch('rx', Number(($event.target as HTMLInputElement).value)); patch('ry', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <!-- Circle specific -->
              <div v-if="isCircle">
                <label class="me-prop-label">Raio</label>
                <input
                  type="number"
                  class="me-text-input"
                  :value="Math.round(current('radius', 0))"
                  @input="patch('radius', Number(($event.target as HTMLInputElement).value))"
                />
              </div>

              <!-- Image specific -->
              <div v-if="isImage" class="me-image-section">
                <button
                  class="me-replace-image-btn"
                  @click="openReplaceImage"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Trocar Imagem
                </button>
                <div class="me-props-grid me-props-grid--2">
                  <label class="me-checkbox-label">
                    <input
                      type="checkbox"
                      class="me-small-checkbox"
                      :checked="!!current('flipX', false)"
                      @change="patch('flipX', ($event.target as HTMLInputElement).checked)"
                    />
                    Espelhar Horizontal
                  </label>
                  <label class="me-checkbox-label">
                    <input
                      type="checkbox"
                      class="me-small-checkbox"
                      :checked="!!current('flipY', false)"
                      @change="patch('flipY', ($event.target as HTMLInputElement).checked)"
                    />
                    Espelhar Vertical
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Layer Controls -->
          <div class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('layers') }"
              @click="toggleSection('layers')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Camadas</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('layers')" class="me-accordion-content">
              <div class="me-layer-controls">
                <button
                  class="me-layer-btn"
                  :disabled="!selectedObj || selectedObj === group"
                  @click="moveLayer(1)"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  Trazer para Frente
                </button>
                <button
                  class="me-layer-btn"
                  :disabled="!selectedObj || selectedObj === group"
                  @click="moveLayer(-1)"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Enviar para Trás
                </button>
              </div>
            </div>
          </div>

          <!-- Help text -->
          <div class="me-help-box">
            <p class="me-help-text">
              💡 <strong>Dica:</strong> Use nomes especiais como <code class="me-help-code">price_decimal_text</code>,
              <code class="me-help-code">price_unit_text</code>,
              <code class="me-help-code">price_integer_text</code>
              para layout automático no card.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

/* Container */
.me-container {
  @apply flex flex-col h-full p-2;
}

/* Floating Top Bar (compact) */
.me-top-bar {
  @apply flex items-center justify-between gap-3 px-3 py-2 mb-2 bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-800/50;
}

.me-top-left {
  @apply flex-1;
}

.me-name-input-compact {
  @apply w-full bg-transparent text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none;
}

.me-top-actions {
  @apply flex items-center gap-2;
}

.me-save-btn-compact {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed;
}

.me-close-compact {
  @apply w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors;
}

.me-close-compact svg {
  @apply w-4 h-4;
}

.me-error-msg-compact {
  @apply flex items-center gap-2 px-3 py-1.5 mx-auto mb-2 text-xs text-red-400 bg-red-500/10 rounded-lg border border-red-500/20 max-w-md;
}

.me-error-msg-compact svg {
  @apply w-3.5 h-3.5 shrink-0;
}

/* Grid Layout */
.me-grid {
  @apply grid grid-cols-1 lg:grid-cols-6 gap-3 flex-1 min-h-0;
}

.me-main-panel {
  @apply lg:col-span-4 flex flex-col gap-2 min-h-0 relative;
}

/* Floating Toolbar */
.me-toolbar-floating {
  @apply absolute top-3 left-3 z-20 flex items-center gap-1 p-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-800/50 shadow-lg;
}

.me-tool-btn-compact {
  @apply w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all;
}

.me-tool-btn-compact svg {
  @apply w-4 h-4;
}

.me-tool-btn-compact--disabled {
  @apply opacity-30 cursor-not-allowed hover:bg-transparent hover:text-zinc-400;
}

.me-tool-btn-compact--danger {
  @apply text-red-400 hover:text-red-300;
}

.me-toolbar-divider {
  @apply w-px h-5 bg-zinc-700 mx-0.5;
}

/* Viewport - now takes maximum space */
.me-viewport {
  @apply relative rounded-xl border border-zinc-800/50 bg-zinc-950/80 overflow-hidden flex-1;
}

.me-viewport canvas {
  @apply w-full h-full;
}

.me-zoom-badge {
  @apply absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] text-zinc-400 font-mono;
}

/* Floating Bottom Controls */
.me-bottom-controls-floating {
  @apply absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-800/50 shadow-lg;
}

.me-control-btn-compact {
  @apply flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors;
}

.me-control-btn-compact svg {
  @apply w-4 h-4;
}

.me-zoom-control-compact {
  @apply flex items-center gap-2;
}

.me-zoom-slider-compact {
  @apply w-24 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500;
}

/* Properties Panel */
.me-props-panel {
  @apply lg:col-span-2 overflow-y-auto pr-1 min-h-[80vh];
}

/* Empty State */
.me-empty-state {
  @apply flex flex-col items-center justify-center py-12 px-4 text-center;
}

.me-empty-icon {
  @apply w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center mb-3;
}

.me-empty-icon svg {
  @apply w-7 h-7 text-zinc-700;
}

.me-empty-title {
  @apply text-sm font-medium text-zinc-400 mb-1;
}

.me-empty-text {
  @apply text-[10px] text-zinc-600 max-w-45;
}

/* Props Content */
.me-props-content {
  @apply flex flex-col gap-3;
}

/* Selection Header */
.me-selection-header {
  @apply flex items-center gap-3 p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30;
}

.me-type-badge {
  @apply w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0;
  @apply text-violet-400 text-lg font-bold;
}

.me-selection-info {
  @apply flex-1 min-w-0;
}

.me-selection-name {
  @apply w-full bg-transparent text-sm font-semibold text-white focus:outline-none placeholder-zinc-500;
}

.me-selection-type {
  @apply text-[10px] text-zinc-500 capitalize;
}

/* Props Section */
.me-props-section {
  @apply p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 space-y-3;
}

.me-props-section-title {
  @apply text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2;
}

.me-props-section-title svg {
  @apply w-3.5 h-3.5;
}

.me-props-grid {
  @apply grid gap-2;
}

.me-props-grid--4 {
  @apply grid-cols-4;
}

.me-props-grid--2 {
  @apply grid-cols-2;
}

.me-prop-item {
  @apply flex flex-col;
}

.me-prop-label {
  @apply text-[10px] text-zinc-500 mb-1;
}

.me-prop-input {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 transition-colors;
}

.me-prop-input--compact {
  @apply flex-1 rounded-r-none border-r-0;
}

.me-prop-input-with-unit {
  @apply flex items-center;
}

.me-prop-unit {
  @apply text-[10px] text-zinc-500 px-2;
}

.me-opacity-control {
  @apply flex items-center gap-2 h-7 flex-1;
}

.me-opacity-control input {
  @apply flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500;
}

.me-opacity-value {
  @apply text-[10px] text-zinc-400 w-10 text-right tabular-nums;
}

.me-checkbox-row {
  @apply flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer;
}

.me-checkbox {
  @apply w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500/20 cursor-pointer;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Range Input Styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #8b5cf6;
  cursor: pointer;
  margin-top: -4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background: #3f3f46;
  border-radius: 2px;
}

/* Checkbox Styling */
input[type="checkbox"] {
  accent-color: #8b5cf6;
}

/* Text Properties Section */
.me-text-props {
  @apply p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 space-y-3;
}

.me-props-subsection-title {
  @apply text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2;
}

.me-text-input {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50;
}

.me-select-input {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50;
}

.me-hint-box {
  @apply text-[10px] text-amber-400/80 bg-amber-500/10 rounded-lg px-2 py-1.5;
}

.me-grid-2 {
  @apply grid grid-cols-2 gap-2;
}

.me-grid-3 {
  @apply grid grid-cols-3 gap-2;
}

.me-color-picker-group {
  @apply flex items-center gap-2;
}

.me-color-swatch {
  @apply w-8 h-8 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden shadow-inner shrink-0;
}

.me-fill-swatch {
  @apply w-8 h-8 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden shadow-inner shrink-0;
}

.me-color-hex-input {
  @apply flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500/50;
}

.me-checkbox-group {
  @apply flex items-center gap-4 p-2 rounded-lg bg-zinc-800/30;
}

.me-checkbox-label {
  @apply flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer;
}

.me-small-checkbox {
  @apply w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600 text-amber-500 cursor-pointer;
}

.me-stroke-section {
  @apply pt-3 border-t border-zinc-800/50 space-y-2;
}

.me-stroke-header {
  @apply text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5;
}

.me-stroke-swatch {
  @apply w-full h-8 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden;
}

.me-decimal-section {
  @apply pt-3 border-t border-amber-500/20 space-y-2;
}

.me-decimal-header {
  @apply text-[10px] font-semibold text-amber-400 flex items-center gap-1.5;
}

.me-amber-input {
  @apply w-full bg-zinc-800/50 border border-amber-500/30 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50;
}

.me-decimal-hint {
  @apply text-[9px] text-zinc-500;
}

/* Shape Properties Section */
.me-shape-props {
  @apply p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 space-y-3;
}

.me-shape-props-title {
  @apply text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2;
}

.me-fill-swatch-large {
  @apply w-full h-9 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden;
}

.me-stroke-swatch-large {
  @apply w-full h-9 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden;
}

.me-stroke-width-input {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50;
}

.me-dimensions-section {
  @apply pt-3 border-t border-zinc-800/50 space-y-3;
}

.me-dimensions-header {
  @apply text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5;
}

.me-border-radius-section {
  @apply pt-2 space-y-2;
}

.me-radius-header {
  @apply text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5;
}

.me-range-group {
  @apply flex items-center gap-2;
}

.me-range-input {
  @apply flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500;
}

.me-range-number {
  @apply w-14 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-amber-500/50;
}

.me-radius-hint {
  @apply text-[9px] text-zinc-500;
}

.me-circle-section {
  @apply pt-3 border-t border-zinc-800/50 space-y-2;
}

.me-image-section {
  @apply pt-3 border-t border-zinc-800/50 space-y-3;
}

.me-replace-image-btn {
  @apply w-full px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors flex items-center justify-center gap-2;
}

.me-image-checkboxes {
  @apply flex items-center gap-4;
}

/* Help Box */
.me-help-box {
  @apply p-3 rounded-xl bg-amber-500/5 border border-amber-500/10;
}

.me-help-text {
  @apply text-[10px] text-amber-400/80 leading-relaxed;
}

.me-help-code {
  @apply bg-black/20 px-1 rounded text-[9px];
}

/* Checkerboard background for transparent colors */
.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #3f3f46 25%, transparent 25%),
    linear-gradient(-45deg, #3f3f46 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3f3f46 75%),
    linear-gradient(-45deg, transparent 75%, #3f3f46 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

/* ============================
   Figma-inspired Components
   ============================ */

/* Quick Actions in Selection Header */
.me-quick-actions {
  @apply flex items-center gap-1;
}

.me-quick-btn {
  @apply w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all;
}

.me-quick-btn svg {
  @apply w-4 h-4;
}

.me-quick-btn--active {
  @apply text-violet-400 bg-violet-500/10;
}

.me-quick-btn--danger {
  @apply text-red-400 hover:text-red-300 hover:bg-red-500/10;
}

/* Accordion Sections (Figma-style collapsible panels) */
.me-accordion-section {
  @apply mb-2 rounded-xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden;
}

.me-accordion-header {
  @apply w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors cursor-pointer;
}

.me-accordion-header--collapsed {
  @apply bg-zinc-900/20;
}

.me-accordion-icon {
  @apply w-4 h-4 text-zinc-500 shrink-0;
}

.me-accordion-header span {
  @apply flex-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide;
}

.me-accordion-chevron {
  @apply w-4 h-4 text-zinc-600 transition-transform duration-200 shrink-0;
}

.me-accordion-header--collapsed .me-accordion-chevron {
  @apply -rotate-90;
}

.me-accordion-content {
  @apply px-3 pb-3 space-y-3;
}

/* Preset Color Swatches (Figma-style) */
.me-preset-colors {
  @apply flex flex-wrap gap-1.5 mb-3;
}

.me-preset-color {
  @apply w-6 h-6 rounded-lg border border-zinc-400 hover:scale-110 hover:shadow-xl hover:border-white transition-all cursor-pointer relative overflow-hidden;
  /* Strong shadow for better definition on all backgrounds */
  box-shadow: 0 0 0 1px rgba(255,255,255,0.3), inset 0 1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.2);
}

/* Inner white ring for better visibility of dark colors - stronger opacity */
.me-preset-color::after {
  content: '';
  @apply absolute inset-0.5 border border-white/60 rounded-lg pointer-events-none;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
}

.me-preset-color--active {
  @apply border-violet-400 ring-2 ring-violet-500/30;
}

.me-preset-color--active::after {
  @apply border-white/80;
}

/* Improved Color Row Layout */
.me-color-row {
  @apply flex items-center gap-2;
}

.me-color-swatch-large {
  @apply w-10 h-10 rounded-lg border border-zinc-700/50 cursor-pointer relative overflow-hidden shadow-inner shrink-0;
}

.me-color-swatch--stroke {
  @apply bg-transparent;
}

/* Font Controls (Figma-style) */
.me-font-controls {
  @apply space-y-2;
}

.me-font-control-group {
  @apply space-y-1;
}

.me-font-control-row {
  @apply flex items-center gap-1;
}

.me-font-number {
  @apply flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50;
}

.me-font-btn {
  @apply w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all flex items-center justify-center;
}

.me-font-btn svg {
  @apply w-3 h-3;
}

.me-font-select {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50;
}

/* Text Style Buttons (Figma-style) */
.me-text-style-buttons {
  @apply flex items-center gap-1 p-1 rounded-lg bg-zinc-800/30 border border-zinc-700/30;
}

.me-style-btn {
  @apply flex-1 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all;
}

.me-style-btn svg {
  @apply w-4 h-4;
}

.me-style-btn--active {
  @apply text-violet-400 bg-violet-500/10;
}

/* Text Alignment Buttons (Figma-style) */
.me-align-buttons {
  @apply flex items-center gap-1 p-1 rounded-lg bg-zinc-800/30 border border-zinc-700/30;
}

.me-align-btn {
  @apply flex-1 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all;
}

.me-align-btn svg {
  @apply w-4 h-4;
}

.me-align-btn--active {
  @apply text-violet-400 bg-violet-500/10;
}

/* Stroke Width Control */
.me-stroke-width-control {
  @apply flex items-center gap-2;
}

.me-stroke-width-control input[type="range"] {
  @apply flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500;
}

.me-stroke-width-number {
  @apply w-16 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-violet-500/50;
}

/* Radius Control */
.me-radius-control {
  @apply flex items-center gap-2;
}

.me-range-slider {
  @apply flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500;
}

.me-radius-number {
  @apply w-16 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-violet-500/50;
}

/* Layer Controls */
.me-layer-controls {
  @apply space-y-2;
}

.me-layer-btn {
  @apply w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-xs text-zinc-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed;
}

.me-layer-btn svg {
  @apply w-4 h-4;
}

/* Props Grid Variants */
.me-props-grid--3 {
  @apply grid grid-cols-3 gap-2;
}
</style>
