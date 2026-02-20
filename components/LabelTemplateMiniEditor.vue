<script setup lang="ts">
import type { LabelTemplate } from '~/types/label-template'
import ColorPicker from './ui/ColorPicker.vue'
import {
  AVAILABLE_FONT_FAMILIES,
  getFontWeightOptionsForFamily,
  normalizeFontWeightForFamily
} from '~/utils/font-catalog'

const props = defineProps<{
  template: LabelTemplate | null
}>()

type TemplateSaveResult = {
  ok: boolean
  message?: string
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', templateId: string, updates: { group: any; previewDataUrl?: string; name?: string }, done?: (result: TemplateSaveResult) => void): void
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
const isLoadingTemplate = ref(false)

const MINI_EDITOR_HISTORY_LIMIT = 120
const historyStack = ref<any[]>([])
const historyIndex = ref(-1)
const historyFingerprint = ref('')
let isRestoringHistory = false
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
const allContentMoveMode = ref(false)
const childInteractivityCache = new WeakMap<any, { selectable: boolean; evented: boolean; hasControls: boolean; hasBorders: boolean }>()
let renderQueued = false

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
  '__forceAtacarejoCanonical',
  '__atacValueVariants',
  '__atacVariantGroups',
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
  '__shadowBlur',
  '__manualTemplateBaseW',
  '__manualTemplateBaseH',
  '__manualGapSingle',
  '__manualGapRetail',
  '__manualGapWholesale',
  '__manualSingleAnchors'
]

const ATAC_VALUE_VARIANT_KEYS = ['tiny', 'normal', 'large'] as const
type AtacValueVariantKey = (typeof ATAC_VALUE_VARIANT_KEYS)[number]
type AtacValueVariantField = 'chainWidthRatio' | 'minScale' | 'intDecimalGap' | 'currencyGapRatio' | 'packWidthRatio'
type AtacValueVariantConfig = Record<AtacValueVariantField, number>

const DEFAULT_ATAC_VALUE_VARIANTS: Record<AtacValueVariantKey, AtacValueVariantConfig> = {
  tiny: {
    chainWidthRatio: 0.48,
    minScale: 0.62,
    intDecimalGap: -8,
    currencyGapRatio: 0.02,
    packWidthRatio: 0.86
  },
  normal: {
    chainWidthRatio: 0.64,
    minScale: 0.56,
    intDecimalGap: -4,
    currencyGapRatio: 0.024,
    packWidthRatio: 0.9
  },
  large: {
    chainWidthRatio: 0.82,
    minScale: 0.44,
    intDecimalGap: -1,
    currencyGapRatio: 0.03,
    packWidthRatio: 0.95
  }
}

const ATAC_VALUE_VARIANT_BOUNDS: Record<AtacValueVariantField, { min: number; max: number }> = {
  chainWidthRatio: { min: 0.35, max: 0.95 },
  minScale: { min: 0.3, max: 1 },
  intDecimalGap: { min: -18, max: 12 },
  currencyGapRatio: { min: 0.005, max: 0.08 },
  packWidthRatio: { min: 0.55, max: 0.99 }
}

const atacVariantModes: Array<{ key: AtacValueVariantKey; label: string; hint: string }> = [
  { key: 'tiny', label: 'Valor pequeno', hint: '0,33 · 1,99' },
  { key: 'normal', label: 'Valor normal', hint: '12,99 · 129,99' },
  { key: 'large', label: 'Valor grande', hint: '1.299,99+' }
]
type AtacPreviewMode = 'current' | AtacValueVariantKey
const ATAC_PREVIEW_OBJECT_NAMES = [
  'retail_currency_text',
  'retail_integer_text',
  'retail_decimal_text',
  'retail_unit_text',
  'retail_pack_line_text',
  'wholesale_banner_text',
  'wholesale_currency_text',
  'wholesale_integer_text',
  'wholesale_decimal_text',
  'wholesale_unit_text',
  'wholesale_pack_line_text'
] as const
const ATAC_PREVIEW_PRESETS: Record<AtacValueVariantKey, {
  label: string
  retailPrice: string
  wholesalePrice: string
  retailPack: string
  wholesalePack: string
  banner: string
}> = {
  tiny: {
    label: 'Pequeno',
    retailPrice: '1,99',
    wholesalePrice: '1,49',
    retailPack: 'FD C/12UN: R$ 23,88',
    wholesalePack: 'FD C/12UN: R$ 17,88',
    banner: '★ ACIMA 10 FD ★'
  },
  normal: {
    label: 'Normal',
    retailPrice: '12,99',
    wholesalePrice: '11,89',
    retailPack: 'FD C/12UN: R$ 155,88',
    wholesalePack: 'FD C/12UN: R$ 142,68',
    banner: '★ ACIMA 10 FD ★'
  },
  large: {
    label: 'Grande',
    retailPrice: '1.299,99',
    wholesalePrice: '1.189,49',
    retailPack: 'FD C/12UN: R$ 15.599,88',
    wholesalePack: 'FD C/12UN: R$ 14.273,88',
    banner: '★ ACIMA 10 FD ★'
  }
}
const atacPreviewButtons: Array<{ key: AtacPreviewMode; label: string }> = [
  { key: 'current', label: 'Atual' },
  { key: 'tiny', label: 'Pequeno' },
  { key: 'normal', label: 'Normal' },
  { key: 'large', label: 'Grande' }
]
const atacPreviewMode = ref<AtacPreviewMode>('current')
type AtacPreviewSnapshotItem = {
  text?: string
  left?: number
  top?: number
  scaleX?: number
  scaleY?: number
  originX?: string
  originY?: string
  visible?: boolean
}
type AtacPreviewSnapshot = Record<string, AtacPreviewSnapshotItem>
const atacPreviewSnapshot = ref<AtacPreviewSnapshot>({})
const atacBaseGroupSnapshot = ref<any | null>(null)

const parseNumericInput = (value: any): number => {
  if (typeof value === 'number') return value
  const raw = String(value ?? '').trim()
  if (!raw) return Number.NaN

  // Accept both pt-BR and en-US typed formats.
  // Examples:
  // - "0,65" -> 0.65
  // - "1.299,99" -> 1299.99
  // - "1299.99" -> 1299.99
  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  let normalized = raw
  if (hasComma && hasDot) {
    normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (hasComma) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = raw.replace(/,/g, '.')
  }

  return Number(normalized)
}

const asFiniteNumber = (value: any, fallback: number) => {
  const n = parseNumericInput(value)
  return Number.isFinite(n) ? n : fallback
}

const clampAtacVariantValue = (field: AtacValueVariantField, value: number) => {
  const bounds = ATAC_VALUE_VARIANT_BOUNDS[field]
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

const buildDefaultAtacVariants = (): Record<AtacValueVariantKey, AtacValueVariantConfig> => ({
  tiny: { ...DEFAULT_ATAC_VALUE_VARIANTS.tiny },
  normal: { ...DEFAULT_ATAC_VALUE_VARIANTS.normal },
  large: { ...DEFAULT_ATAC_VALUE_VARIANTS.large }
})

const collectObjectsDeepLocal = (root: any): any[] => {
  if (!root) return []
  const out: any[] = []
  const stack: any[] = [root]
  const seen = new Set<any>()
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || seen.has(cur)) continue
    seen.add(cur)
    out.push(cur)
    const children: any[] = Array.isArray(cur?._objects) ? cur._objects : (typeof cur?.getObjects === 'function' ? cur.getObjects() : [])
    for (const child of children || []) stack.push(child)
  }
  return out
}

const findByNameInObjects = (objects: any[], name: string) => (objects || []).find((o: any) => String(o?.name || '') === name)

const parsePriceBRLocal = (rawValue: string): { integer: string; decimal: string } => {
  const s0 = String(rawValue ?? '')
    .replace(/R\$\s*/gi, '')
    .replace(/\s+/g, '')
    .trim()
  if (!s0) return { integer: '0', decimal: '00' }

  const lastComma = s0.lastIndexOf(',')
  const lastDot = s0.lastIndexOf('.')
  const sepIdx = Math.max(lastComma, lastDot)
  if (sepIdx < 0) {
    return { integer: s0.replace(/[^\d]/g, '') || '0', decimal: '00' }
  }
  const integer = s0.slice(0, sepIdx).replace(/[^\d]/g, '') || '0'
  const decimal = s0.slice(sepIdx + 1).replace(/[^\d]/g, '').padEnd(2, '0').slice(0, 2) || '00'
  return { integer, decimal }
}

const getScaledWidthLocal = (obj: any) => {
  if (!obj) return 0
  if (typeof obj.getScaledWidth === 'function') return Number(obj.getScaledWidth()) || 0
  const width = Number(obj.width || 0)
  const scaleX = Math.abs(Number(obj.scaleX ?? 1)) || 1
  return width * scaleX
}

const getScaledHeightLocal = (obj: any) => {
  if (!obj) return 0
  if (typeof obj.getScaledHeight === 'function') return Number(obj.getScaledHeight()) || 0
  const height = Number(obj.height || 0)
  const scaleY = Math.abs(Number(obj.scaleY ?? 1)) || 1
  return height * scaleY
}

const isObjectShownForBoundsLocal = (obj: any) => {
  if (!obj || obj.visible === false) return false
  const sx = Number(obj.scaleX ?? 1)
  const sy = Number(obj.scaleY ?? 1)
  return sx !== 0 && sy !== 0
}

const getObjectHorizontalBoundsLocal = (obj: any): { left: number; right: number } | null => {
  if (!isObjectShownForBoundsLocal(obj)) return null
  const width = getScaledWidthLocal(obj)
  if (!Number.isFinite(width) || width <= 0) return null
  const x = Number(obj?.left ?? 0)
  const ox = String(obj?.originX || 'left')
  if (ox === 'center') return { left: x - (width / 2), right: x + (width / 2) }
  if (ox === 'right') return { left: x - width, right: x }
  return { left: x, right: x + width }
}

const measureHorizontalBoundsLocal = (objects: any[]): { left: number; right: number; width: number } | null => {
  const bounds = (objects || [])
    .map((o) => getObjectHorizontalBoundsLocal(o))
    .filter(Boolean) as Array<{ left: number; right: number }>
  if (!bounds.length) return null
  const left = Math.min(...bounds.map((b) => b.left))
  const right = Math.max(...bounds.map((b) => b.right))
  return { left, right, width: Math.max(0, right - left) }
}

const getObjectVerticalBoundsLocal = (obj: any): { top: number; bottom: number } | null => {
  if (!isObjectShownForBoundsLocal(obj)) return null
  const height = getScaledHeightLocal(obj)
  if (!Number.isFinite(height) || height <= 0) return null
  const y = Number(obj?.top ?? 0)
  const oy = String(obj?.originY || 'top')
  if (oy === 'center') return { top: y - (height / 2), bottom: y + (height / 2) }
  if (oy === 'bottom') return { top: y - height, bottom: y }
  return { top: y, bottom: y + height }
}

const measureContentBoundsLocal = (
  objects: any[]
): { left: number; right: number; top: number; bottom: number; width: number; height: number } | null => {
  const h = (objects || [])
    .map((o) => getObjectHorizontalBoundsLocal(o))
    .filter(Boolean) as Array<{ left: number; right: number }>
  const v = (objects || [])
    .map((o) => getObjectVerticalBoundsLocal(o))
    .filter(Boolean) as Array<{ top: number; bottom: number }>
  if (!h.length || !v.length) return null
  const left = Math.min(...h.map((b) => b.left))
  const right = Math.max(...h.map((b) => b.right))
  const top = Math.min(...v.map((b) => b.top))
  const bottom = Math.max(...v.map((b) => b.bottom))
  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

const parseColorRgbaLocal = (input: any): { r: number; g: number; b: number; a: number } | null => {
  if (typeof input !== 'string') return null
  const raw = input.trim().toLowerCase()
  if (!raw || raw === 'transparent' || raw === 'none') return { r: 0, g: 0, b: 0, a: 0 }

  if (raw.startsWith('#')) {
    const hex = raw.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r0 = hex.charAt(0)
      const g0 = hex.charAt(1)
      const b0 = hex.charAt(2)
      const a0 = hex.charAt(3)
      const r = parseInt(r0 + r0, 16)
      const g = parseInt(g0 + g0, 16)
      const b = parseInt(b0 + b0, 16)
      const a = hex.length === 4 ? parseInt(a0 + a0, 16) / 255 : 1
      return { r, g, b, a }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
    return null
  }

  const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/)
  if (rgbaMatch) {
    const parts = rgbaMatch[1]!.split(',').map((p) => p.trim())
    if (parts.length < 3) return null
    const r = Math.max(0, Math.min(255, Number(parts[0] || 0)))
    const g = Math.max(0, Math.min(255, Number(parts[1] || 0)))
    const b = Math.max(0, Math.min(255, Number(parts[2] || 0)))
    const a = parts.length >= 4 ? Math.max(0, Math.min(1, Number(parts[3] || 1))) : 1
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) return null
    return { r, g, b, a }
  }

  return null
}

const isTransparentLikeColorLocal = (fill: any) => {
  if (fill === null || fill === undefined) return true
  if (typeof fill !== 'string') return false
  const rgba = parseColorRgbaLocal(fill)
  if (!rgba) return false
  return rgba.a <= 0.12
}

const isDarkOpaqueColorLocal = (fill: any) => {
  if (typeof fill !== 'string') return false
  const rgba = parseColorRgbaLocal(fill)
  if (!rgba || rgba.a <= 0.3) return false
  const luminance = ((0.2126 * rgba.r) + (0.7152 * rgba.g) + (0.0722 * rgba.b)) / 255
  return luminance < 0.19
}

const ensureAtacarejoPreviewContrast = (priceGroup: any) => {
  if (!priceGroup) return
  const all = collectObjectsDeepLocal(priceGroup)
  const retailBg = findByNameInObjects(all, 'atac_retail_bg')
  const bannerBg = findByNameInObjects(all, 'atac_banner_bg')
  const wholesaleBg = findByNameInObjects(all, 'atac_wholesale_bg')
  if (!retailBg && !bannerBg && !wholesaleBg) return

  const shouldFixRetail = !!retailBg && (
    retailBg.visible === false ||
    isTransparentLikeColorLocal(retailBg.fill) ||
    isDarkOpaqueColorLocal(retailBg.fill)
  )
  const shouldFixWholesale = !!wholesaleBg && (
    wholesaleBg.visible === false ||
    isTransparentLikeColorLocal(wholesaleBg.fill) ||
    isDarkOpaqueColorLocal(wholesaleBg.fill)
  )
  const shouldFixBanner = !!bannerBg && (
    bannerBg.visible === false ||
    isTransparentLikeColorLocal(bannerBg.fill) ||
    isDarkOpaqueColorLocal(bannerBg.fill)
  )
  if (!shouldFixRetail && !shouldFixWholesale && !shouldFixBanner) return

  if (shouldFixRetail) retailBg.set?.({ fill: '#ef4444', visible: true, opacity: 1 })
  if (shouldFixBanner) bannerBg.set?.({ fill: '#ffffff', visible: true, opacity: 1 })
  if (shouldFixWholesale) wholesaleBg.set?.({ fill: '#fde047', visible: true, opacity: 1 })

  const ensureTextVisible = (name: string, fallbackColor: string) => {
    const obj = findByNameInObjects(all, name)
    if (!obj) return
    const noFill = isTransparentLikeColorLocal(obj.fill)
    if (noFill) obj.set?.({ fill: fallbackColor })
    if (obj.visible === false) obj.set?.({ visible: true })
  }

  ensureTextVisible('retail_currency_text', '#ffffff')
  ensureTextVisible('retail_integer_text', '#ffffff')
  ensureTextVisible('retail_decimal_text', '#ffffff')
  ensureTextVisible('retail_unit_text', '#ffffff')
  ensureTextVisible('retail_pack_line_text', '#ffffff')
  ensureTextVisible('wholesale_banner_text', '#111827')
  ensureTextVisible('wholesale_currency_text', '#111827')
  ensureTextVisible('wholesale_integer_text', '#111827')
  ensureTextVisible('wholesale_decimal_text', '#111827')
  ensureTextVisible('wholesale_unit_text', '#111827')
  ensureTextVisible('wholesale_pack_line_text', '#111827')

  safeAddWithUpdate(priceGroup)
}

const layoutPriceLocal = (opts: {
  integer: any
  decimal: any
  unit?: any
  intX: number
  intY: number
  decY: number
  unitY: number
  maxWidth?: number
  gapPx?: number
  minGapPx?: number
  maxGapPx?: number
}) => {
  const integer = opts.integer
  const decimal = opts.decimal
  if (!integer || !decimal) return

  const minGap = Number.isFinite(Number(opts.minGapPx)) ? Number(opts.minGapPx) : -8
  const maxGap = Number.isFinite(Number(opts.maxGapPx)) ? Number(opts.maxGapPx) : 6
  const digitsCount = String(integer?.text || '').replace(/[^\d]/g, '').length || 1
  const autoGap = digitsCount <= 1 ? -6 : (digitsCount === 2 ? -4 : (digitsCount === 3 ? -3 : -2))
  let gap = Number.isFinite(Number(opts.gapPx)) ? Number(opts.gapPx) : autoGap
  gap = Math.min(maxGap, Math.max(minGap, gap))

  integer.set?.({ originX: 'left', originY: 'center' })
  decimal.set?.({ originX: 'left', originY: 'center' })

  const maxWidth = Number.isFinite(Number(opts.maxWidth)) ? Number(opts.maxWidth) : 0
  let intW = getScaledWidthLocal(integer)
  const decWInitial = getScaledWidthLocal(decimal)
  if (maxWidth > 0 && intW > 0) {
    const allowedIntW = Math.max(8, maxWidth - decWInitial - gap)
    if (intW > allowedIntW) {
      const baseScaleX = Number(integer.scaleX || 1)
      const baseScaleY = Number(integer.scaleY || 1)
      const shrink = Math.min(1, Math.max(0.35, allowedIntW / intW))
      integer.set?.({ scaleX: baseScaleX * shrink, scaleY: baseScaleY * shrink })
      integer.initDimensions?.()
      intW = getScaledWidthLocal(integer)
    }
  }

  integer.set?.({ left: opts.intX, top: opts.intY })
  const centsX = opts.intX + intW + gap
  decimal.set?.({ left: centsX, top: opts.decY })
  const decW = getScaledWidthLocal(decimal)

  if (opts.unit && opts.unit.visible !== false) {
    const unitCenterX = centsX + (decW / 2)
    opts.unit.set?.({ originX: 'center', originY: 'center', left: unitCenterX, top: opts.unitY })
    const unitW = getScaledWidthLocal(opts.unit)
    if (decW > 0 && unitW > decW) {
      const s = decW / unitW
      opts.unit.set?.({ scaleX: s, scaleY: s, left: unitCenterX })
    } else {
      opts.unit.set?.({ scaleX: 1, scaleY: 1, left: unitCenterX })
    }
  }
}

const readAtacValueVariants = (): Record<AtacValueVariantKey, AtacValueVariantConfig> => {
  const merged = buildDefaultAtacVariants()
  const raw = (group as any)?.__atacValueVariants
  if (!raw || typeof raw !== 'object') return merged

  for (const key of ATAC_VALUE_VARIANT_KEYS) {
    const src = (raw as any)?.[key]
    if (!src || typeof src !== 'object') continue
    const base = merged[key]
    merged[key] = {
      chainWidthRatio: clampAtacVariantValue('chainWidthRatio', asFiniteNumber(src.chainWidthRatio, base.chainWidthRatio)),
      minScale: clampAtacVariantValue('minScale', asFiniteNumber(src.minScale, base.minScale)),
      intDecimalGap: clampAtacVariantValue('intDecimalGap', asFiniteNumber(src.intDecimalGap, base.intDecimalGap)),
      currencyGapRatio: clampAtacVariantValue('currencyGapRatio', asFiniteNumber(src.currencyGapRatio, base.currencyGapRatio)),
      packWidthRatio: clampAtacVariantValue('packWidthRatio', asFiniteNumber(src.packWidthRatio, base.packWidthRatio))
    }
  }

  return merged
}

const fitAtacarejoValuesForPreview = (priceGroup: any) => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return

  const all = collectObjectsDeepLocal(priceGroup)
  const retailBg = findByNameInObjects(all, 'atac_retail_bg')
  const wholesaleBg = findByNameInObjects(all, 'atac_wholesale_bg')
  const bannerBg = findByNameInObjects(all, 'atac_banner_bg')
  if (!retailBg) return

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  const getIntegerDigitsCount = (obj: any) => {
    const raw = String(obj?.text ?? '').replace(/[^\d]/g, '')
    const normalized = raw.replace(/^0+(?=\d)/, '')
    return Math.max(1, normalized.length || raw.length || 1)
  }
  const resolveVariantKey = (digitsCount: number): AtacValueVariantKey => {
    if (digitsCount <= 1) return 'tiny'
    if (digitsCount >= 4) return 'large'
    return 'normal'
  }
  const getInnerWidth = (bg: any, padRatio: number, minPad: number, maxPad: number) => {
    if (!bg) return 0
    const bw = Math.max(1, Number(bg.width || 0) * Math.abs(Number(bg.scaleX ?? 1) || 1))
    const pad = clamp(bw * padRatio, minPad, maxPad)
    return Math.max(8, bw - (pad * 2))
  }
  const restoreBaseScale = (obj: any) => {
    if (!obj || typeof obj.set !== 'function') return
    const sx = Number((obj as any).__originalScaleX)
    const sy = Number((obj as any).__originalScaleY)
    obj.set({
      scaleX: Number.isFinite(sx) && sx > 0 ? sx : 1,
      scaleY: Number.isFinite(sy) && sy > 0 ? sy : 1
    })
    obj.initDimensions?.()
  }
  const fitText = (obj: any, maxW: number, minScale: number) => {
    if (!obj || !Number.isFinite(maxW) || maxW <= 0) return
    restoreBaseScale(obj)
    const w = getScaledWidthLocal(obj)
    if (!w || w <= maxW) return
    const s = clamp(maxW / w, minScale, 1)
    obj.set?.({ scaleX: Number(obj.scaleX || 1) * s, scaleY: Number(obj.scaleY || 1) * s })
  }
  const fitChain = (objs: any[], maxW: number, minScale: number) => {
    const shown = (objs || []).filter((o: any) => isObjectShownForBoundsLocal(o))
    if (!shown.length || !Number.isFinite(maxW) || maxW <= 0) return
    shown.forEach((o: any) => restoreBaseScale(o))
    const bounds = measureHorizontalBoundsLocal(shown)
    if (!bounds || bounds.width <= maxW) return
    const s = clamp(maxW / bounds.width, minScale, 1)
    shown.forEach((o: any) => o?.set?.({ scaleX: Number(o.scaleX || 1) * s, scaleY: Number(o.scaleY || 1) * s }))
  }
  const centerObjectsX = (objs: any[], centerX = 0) => {
    if (!Array.isArray(objs) || !objs.length) return
    const bounds = measureHorizontalBoundsLocal(objs)
    if (!bounds) return
    const currentCenter = (bounds.left + bounds.right) / 2
    const dx = centerX - currentCenter
    if (Math.abs(dx) < 0.001) return
    objs.forEach((obj: any) => obj?.set?.({ left: Number(obj.left || 0) + dx }))
  }

  const variants = readAtacValueVariants()
  const applyTierVariant = (opts: {
    bg: any
    currency: any
    integer: any
    decimal: any
    unit: any
    pack: any
  }) => {
    const { bg, currency, integer, decimal, unit, pack } = opts
    if (!bg || !integer || !decimal) return

    const digits = getIntegerDigitsCount(integer)
    const variant = variants[resolveVariantKey(digits)]
    const maxW = getInnerWidth(bg, 0.075, 12, 34)
    const chainMaxW = Math.max(20, maxW * variant.chainWidthRatio)

    restoreBaseScale(integer)
    restoreBaseScale(decimal)
    restoreBaseScale(unit)
    restoreBaseScale(currency)

    const intY = Number(integer.top || 0)
    const decY = Number(decimal.top || intY)
    const unitY = Number(unit?.top || decY)
    const unitVisible = isObjectShownForBoundsLocal(unit)

    layoutPriceLocal({
      integer,
      decimal,
      unit: unitVisible ? unit : undefined,
      intX: 0,
      intY,
      decY,
      unitY,
      maxWidth: chainMaxW,
      gapPx: variant.intDecimalGap,
      minGapPx: -24,
      maxGapPx: 14
    })

    const chain = [integer, decimal, unitVisible ? unit : null].filter(Boolean) as any[]
    const chainBounds = measureHorizontalBoundsLocal(chain)
    if (currency && chainBounds) {
      const curGap = Math.max(2, maxW * variant.currencyGapRatio)
      currency.set?.({
        originX: 'left',
        originY: 'center',
        left: chainBounds.left - curGap - getScaledWidthLocal(currency)
      })
    }

    const full = [currency, ...chain].filter((o: any) => isObjectShownForBoundsLocal(o))
    centerObjectsX(full, 0)
    fitChain(full, maxW, variant.minScale)
    centerObjectsX(full, 0)

    if (pack && isObjectShownForBoundsLocal(pack)) fitText(pack, maxW * variant.packWidthRatio, 0.5)
  }

  const retailCurrency = findByNameInObjects(all, 'retail_currency_text')
  const retailInteger = findByNameInObjects(all, 'retail_integer_text')
  const retailDecimal = findByNameInObjects(all, 'retail_decimal_text')
  const retailUnit = findByNameInObjects(all, 'retail_unit_text')
  const retailPack = findByNameInObjects(all, 'retail_pack_line_text')
  const wholesaleCurrency = findByNameInObjects(all, 'wholesale_currency_text')
  const wholesaleInteger = findByNameInObjects(all, 'wholesale_integer_text')
  const wholesaleDecimal = findByNameInObjects(all, 'wholesale_decimal_text')
  const wholesaleUnit = findByNameInObjects(all, 'wholesale_unit_text')
  const wholesalePack = findByNameInObjects(all, 'wholesale_pack_line_text')
  const bannerText = findByNameInObjects(all, 'wholesale_banner_text')

  const retailInnerW = getInnerWidth(retailBg, 0.075, 12, 34)
  const wholesaleInnerW = getInnerWidth(wholesaleBg, 0.075, 12, 34)
  const bannerInnerW = getInnerWidth(bannerBg, 0.06, 8, 28)

  applyTierVariant({ bg: retailBg, currency: retailCurrency, integer: retailInteger, decimal: retailDecimal, unit: retailUnit, pack: retailPack })
  applyTierVariant({ bg: wholesaleBg, currency: wholesaleCurrency, integer: wholesaleInteger, decimal: wholesaleDecimal, unit: wholesaleUnit, pack: wholesalePack })
  fitText(retailPack, retailInnerW, 0.5)
  fitText(wholesalePack, wholesaleInnerW, 0.5)
  fitText(bannerText, bannerInnerW, 0.5)
}

const cloneJsonSafe = <T>(value: T): T => {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

const isAtacVariantKey = (v: any): v is AtacValueVariantKey =>
  v === 'tiny' || v === 'normal' || v === 'large'

const serializeCurrentGroupSnapshot = () => {
  if (!group) return null
  const json: any = serializeGroupForTemplate(group)
  if (!json || typeof json !== 'object') return null
  delete json.__atacVariantGroups
  return json
}

const getAtacVariantGroupsMap = (): Partial<Record<AtacValueVariantKey, any>> => {
  if (!shouldUseAtacVariantSnapshots()) return {}
  if (!group) return {}
  const raw = (group as any).__atacVariantGroups
  if (!raw || typeof raw !== 'object') return {}
  return raw as Partial<Record<AtacValueVariantKey, any>>
}

const snapshotLooksLikeAtacTemplate = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return false
  const objects = Array.isArray(snapshot.objects) ? snapshot.objects : []
  if (!objects.length) return false
  return objects.some((o: any) => String(o?.name || '') === 'atac_retail_bg')
}

const getRecoverableAtacSnapshot = (): any | null => {
  if (!shouldUseAtacVariantSnapshots()) return null
  if (!group) return null
  const map = getAtacVariantGroupsMap()
  for (const key of ATAC_VALUE_VARIANT_KEYS) {
    const candidate = (map as any)?.[key]
    if (snapshotLooksLikeAtacTemplate(candidate)) {
      return cloneJsonSafe(candidate)
    }
  }
  return null
}

const setAtacVariantGroupSnapshot = (key: AtacValueVariantKey, snapshot: any) => {
  if (!shouldUseAtacVariantSnapshots()) return
  if (!group || !snapshot || typeof snapshot !== 'object') return
  const map = cloneJsonSafe(getAtacVariantGroupsMap())
  ;(map as any)[key] = cloneJsonSafe(snapshot)
  ;(group as any).__atacVariantGroups = map
}

const persistAtacPreviewMetadata = () => {
  if (!group) return
  const snapshot: AtacPreviewSnapshot = {}
  const finiteOrUndef = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  for (const name of ATAC_PREVIEW_OBJECT_NAMES) {
    const obj = findObjectByNameDeep(group, name)
    if (!obj) continue
    snapshot[name] = {
      text: typeof obj.text === 'string' ? String(obj.text) : undefined,
      left: finiteOrUndef(obj.left),
      top: finiteOrUndef(obj.top),
      scaleX: finiteOrUndef(obj.scaleX),
      scaleY: finiteOrUndef(obj.scaleY),
      originX: typeof obj.originX === 'string' ? String(obj.originX) : undefined,
      originY: typeof obj.originY === 'string' ? String(obj.originY) : undefined,
      visible: typeof obj.visible === 'boolean' ? obj.visible : undefined
    }
  }
  atacPreviewSnapshot.value = snapshot
}

const ensureAtacarejoMinimumVisible = (priceGroup: any) => {
  if (!priceGroup) return
  const all = collectObjectsDeepLocal(priceGroup)
  const pick = (name: string) => findByNameInObjects(all, name)
  const mustShow = [
    pick('atac_retail_bg'),
    pick('atac_banner_bg'),
    pick('atac_wholesale_bg'),
    pick('retail_currency_text'),
    pick('retail_integer_text'),
    pick('retail_decimal_text'),
    pick('retail_unit_text'),
    pick('wholesale_banner_text'),
    pick('wholesale_currency_text'),
    pick('wholesale_integer_text'),
    pick('wholesale_decimal_text'),
    pick('wholesale_unit_text')
  ].filter(Boolean)

  const toFinite = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  mustShow.forEach((obj: any) => {
    const sx = toFinite(obj?.scaleX)
    const sy = toFinite(obj?.scaleY)
    const needsRestore = obj?.visible === false || sx === 0 || sy === 0
    if (!needsRestore || !obj || typeof obj.set !== 'function') return
    const restoreScaleX =
      toFinite((obj as any).__visibleScaleX) ??
      toFinite((obj as any).__originalScaleX) ??
      (sx != null && Math.abs(sx) > 0 ? sx : 1)
    const restoreScaleY =
      toFinite((obj as any).__visibleScaleY) ??
      toFinite((obj as any).__originalScaleY) ??
      (sy != null && Math.abs(sy) > 0 ? sy : 1)
    obj.set({ visible: true, scaleX: restoreScaleX, scaleY: restoreScaleY })
    obj.initDimensions?.()
    obj.setCoords?.()
  })
  safeAddWithUpdate(priceGroup)
}

const applySerializedSnapshotToCurrentGroup = async (
  snapshot: any,
  options: { preservePlacement?: boolean } = {}
) => {
  if (!group || !snapshot || typeof snapshot !== 'object') return
  const preservePlacement = options.preservePlacement !== false
  const prevPlacement = {
    left: Number(group.left || 0),
    top: Number(group.top || 0),
    scaleX: Number(group.scaleX || 1),
    scaleY: Number(group.scaleY || 1),
    angle: Number(group.angle || 0),
    originX: String(group.originX || 'center'),
    originY: String(group.originY || 'center')
  }
  const objectsJson = Array.isArray(snapshot.objects) ? snapshot.objects : []
  const opts = { ...snapshot }
  delete (opts as any).objects
  delete (opts as any).type
  delete (opts as any).layoutManager
  delete (opts as any).layout

  const variantGroupsMap = shouldUseAtacVariantSnapshots()
    ? cloneJsonSafe((opts as any).__atacVariantGroups || (group as any).__atacVariantGroups || {})
    : {}
  const valueVariants = cloneJsonSafe((opts as any).__atacValueVariants || (group as any).__atacValueVariants || {})

  const enlivened = await enlivenObjectsAsync(objectsJson)
  const current = typeof group.getObjects === 'function' ? group.getObjects().slice() : []
  current.forEach((o: any) => group.remove?.(o))
  enlivened.forEach((o: any) => safeAddWithUpdate(group, o))

  group.set({
    ...(opts || {}),
    name: 'priceGroup',
    originX: preservePlacement ? prevPlacement.originX : String((opts as any).originX || prevPlacement.originX),
    originY: preservePlacement ? prevPlacement.originY : String((opts as any).originY || prevPlacement.originY),
    left: preservePlacement ? prevPlacement.left : Number((opts as any).left ?? prevPlacement.left),
    top: preservePlacement ? prevPlacement.top : Number((opts as any).top ?? prevPlacement.top),
    scaleX: preservePlacement ? prevPlacement.scaleX : Number((opts as any).scaleX ?? prevPlacement.scaleX),
    scaleY: preservePlacement ? prevPlacement.scaleY : Number((opts as any).scaleY ?? prevPlacement.scaleY),
    angle: preservePlacement ? prevPlacement.angle : Number((opts as any).angle ?? prevPlacement.angle),
    subTargetCheck: true,
    interactive: true
  })
  ;(group as any).__preserveManualLayout = true
  ;(group as any).__isCustomTemplate = true
  // Mini editor templates should preserve authored geometry; never force code-driven canonical layout.
  ;(group as any).__forceAtacarejoCanonical = false
  ;(group as any).__atacVariantGroups = variantGroupsMap
  ;(group as any).__atacValueVariants = (opts as any)?.__atacValueVariants || valueVariants
  safeAddWithUpdate(group)
  canvas?.requestRenderAll?.()
  persistAtacPreviewMetadata()
}

const captureAtacPreviewSnapshot = () => {
  if (!group) return
  // Store the "Atual" baseline so we can edit other variants without mutating it.
  // IMPORTANT: do NOT embed __atacVariantGroups inside this snapshot (avoids recursion/overwrites).
  atacBaseGroupSnapshot.value = serializeCurrentGroupSnapshot()
  persistAtacPreviewMetadata()
}

const restoreAtacPreviewSnapshot = async () => {
  if (!group || !atacBaseGroupSnapshot.value) return
  await applySerializedSnapshotToCurrentGroup(atacBaseGroupSnapshot.value)
}

const persistCurrentVariantSnapshotIfNeeded = () => {
  if (!shouldUseAtacVariantSnapshots()) return
  if (!group) return
  if (!isAtacVariantKey(atacPreviewMode.value)) return
  const snap = serializeCurrentGroupSnapshot()
  if (!snap) return
  setAtacVariantGroupSnapshot(atacPreviewMode.value, snap)
}

const applyAtacPreviewMode = async (mode: AtacPreviewMode) => {
  if (!group || !findObjectByNameDeep(group, 'atac_retail_bg')) return

  if (mode === atacPreviewMode.value) {
    if (isAtacVariantKey(mode)) {
      ensureAtacarejoPreviewContrast(group)
      safeAddWithUpdate(group)
      canvas?.requestRenderAll?.()
      persistCurrentVariantSnapshotIfNeeded()
      persistAtacPreviewMetadata()
      updateKey.value++
    }
    return
  }

  // Persist the outgoing mode snapshot so switching tabs never mutates other variants.
  if (atacPreviewMode.value === 'current') {
    captureAtacPreviewSnapshot()
  } else {
    persistCurrentVariantSnapshotIfNeeded()
  }

  if (mode === 'current') {
    await restoreAtacPreviewSnapshot()
    ensureAtacarejoPreviewContrast(group)
    canvas?.requestRenderAll?.()
    atacPreviewMode.value = 'current'
    updateKey.value++
    return
  }

  const variantMap = getAtacVariantGroupsMap()
  const variantSnapshot = shouldUseAtacVariantSnapshots()
    ? cloneJsonSafe((variantMap as any)?.[mode])
    : null
  if (variantSnapshot && typeof variantSnapshot === 'object') {
    await applySerializedSnapshotToCurrentGroup(variantSnapshot)
    ensureAtacarejoPreviewContrast(group)
    canvas?.requestRenderAll?.()
  } else {
    // First time opening this tab: start from "Atual" baseline, then apply preview texts.
    if (atacBaseGroupSnapshot.value) await applySerializedSnapshotToCurrentGroup(atacBaseGroupSnapshot.value)

    const preset = ATAC_PREVIEW_PRESETS[mode]
    if (preset) {
      const retail = parsePriceBRLocal(preset.retailPrice)
      const wholesale = parsePriceBRLocal(preset.wholesalePrice)

      const setText = (name: string, value: string) => {
        const obj = findObjectByNameDeep(group, name)
        if (!obj) return
        obj.set?.('text', value)
        obj.initDimensions?.()
      }

      setText('retail_currency_text', 'R$')
      setText('retail_integer_text', retail.integer)
      setText('retail_decimal_text', retail.decimal)
      setText('retail_unit_text', 'UN')
      setText('retail_pack_line_text', preset.retailPack)
      setText('wholesale_banner_text', preset.banner)
      setText('wholesale_currency_text', 'R$')
      setText('wholesale_integer_text', wholesale.integer)
      setText('wholesale_decimal_text', wholesale.decimal)
      setText('wholesale_unit_text', 'UN')
      setText('wholesale_pack_line_text', preset.wholesalePack)
    }
    ensureAtacarejoPreviewContrast(group)
    safeAddWithUpdate(group)
    canvas?.requestRenderAll?.()
    persistCurrentVariantSnapshotIfNeeded()
    persistAtacPreviewMetadata()
  }

  atacPreviewMode.value = mode
  updateKey.value++
}

const setAtacValueVariant = (mode: AtacValueVariantKey, field: AtacValueVariantField, rawValue: any) => {
  if (!group) return
  const current = readAtacValueVariants()
  const fallback = current[mode][field]
  const value = clampAtacVariantValue(field, asFiniteNumber(rawValue, fallback))
  current[mode] = { ...current[mode], [field]: value }
  ;(group as any).__atacValueVariants = current
  safeAddWithUpdate(group)
  if (isAtacVariantKey(atacPreviewMode.value)) {
    ensureAtacarejoPreviewContrast(group)
    safeAddWithUpdate(group)
    persistCurrentVariantSnapshotIfNeeded()
    persistAtacPreviewMetadata()
  }
  canvas?.requestRenderAll?.()
  updateKey.value++
  recordHistorySnapshot(`atacVariant:${mode}:${field}`)
}

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

const isTemplateGroupJsonRenderable = (groupJson: any) => {
  if (!groupJson || typeof groupJson !== 'object') return false
  const rootObjects = Array.isArray(groupJson.objects) ? groupJson.objects : []
  if (!rootObjects.length) return false

  const stack = rootObjects.slice()
  let hasRenderableObject = false
  let hasRenderableText = false
  let hasRenderableShape = false

  while (stack.length) {
    const obj = stack.pop()
    if (!obj || typeof obj !== 'object') continue

    const nested = Array.isArray((obj as any).objects) ? (obj as any).objects : []
    if (nested.length) stack.push(...nested)

    if ((obj as any).visible === false) continue
    const sx = Number((obj as any).scaleX ?? 1)
    const sy = Number((obj as any).scaleY ?? 1)
    if (sx === 0 || sy === 0) continue

    const type = String((obj as any).type || '').toLowerCase()
    if (!type) continue

    const isTextLike = type === 'text' || type === 'i-text' || type === 'textbox'
    const isShapeLike = type === 'rect' || type === 'circle' || type === 'image' || type === 'path' || type === 'line' || type === 'polygon'
    if (!isTextLike && !isShapeLike) continue

    hasRenderableObject = true
    if (isTextLike && String((obj as any).text || '').trim().length > 0) hasRenderableText = true
    if (isShapeLike) hasRenderableShape = true
  }

  // A valid template should have at least one visible renderable object and some visual structure.
  return hasRenderableObject && (hasRenderableText || hasRenderableShape)
}

const pickRenderableTemplateGroupJson = (tpl: LabelTemplate) => {
  const baseGroupJson: any = tpl?.group
  const variantMap = ((baseGroupJson as any)?.__atacVariantGroups || {}) as Record<string, any>
  const isCanonicalAtac = shouldForceCanonicalAtacLayout(baseGroupJson)

  // In the mini editor, Atacarejo variations are independent snapshots.
  // Prefer base, but recover from any valid variation snapshot if base is corrupted.
  if (isCanonicalAtac) {
    if (isTemplateGroupJsonRenderable(baseGroupJson)) return baseGroupJson
    const orderedRecoveryKeys = ['normal', 'tiny', 'large']
    for (const key of orderedRecoveryKeys) {
      const snap = (variantMap as any)?.[key]
      if (isTemplateGroupJsonRenderable(snap)) return snap
    }
    for (const snap of Object.values(variantMap || {})) {
      if (isTemplateGroupJsonRenderable(snap)) return snap
    }
    return baseGroupJson
  }

  if (isTemplateGroupJsonRenderable(baseGroupJson)) return baseGroupJson

  const orderedKeys = ['normal', 'tiny', 'large']
  for (const key of orderedKeys) {
    const snap = (variantMap as any)?.[key]
    if (isTemplateGroupJsonRenderable(snap)) return snap
  }

  for (const snap of Object.values(variantMap || {})) {
    if (isTemplateGroupJsonRenderable(snap)) return snap
  }

  return baseGroupJson
}

const snapshotHasAtacStructure = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== 'object') return false
  if (String((snapshot as any).name || '') === 'atac_retail_bg') return true
  const stack: any[] = []
  const rootJsonChildren = Array.isArray((snapshot as any).objects) ? (snapshot as any).objects : []
  const rootFabricChildren = Array.isArray((snapshot as any)._objects)
    ? (snapshot as any)._objects
    : (typeof (snapshot as any).getObjects === 'function' ? (snapshot as any).getObjects() : [])
  if (rootJsonChildren.length) stack.push(...rootJsonChildren)
  if (rootFabricChildren.length) stack.push(...rootFabricChildren)
  while (stack.length) {
    const obj = stack.pop()
    if (!obj || typeof obj !== 'object') continue
    if (String((obj as any).name || '') === 'atac_retail_bg') return true
    const nestedJson = Array.isArray((obj as any).objects) ? (obj as any).objects : []
    const nestedFabric = Array.isArray((obj as any)._objects)
      ? (obj as any)._objects
      : (typeof (obj as any).getObjects === 'function' ? (obj as any).getObjects() : [])
    if (nestedJson.length) stack.push(...nestedJson)
    if (nestedFabric.length) stack.push(...nestedFabric)
  }
  return false
}

const shouldForceCanonicalAtacLayout = (snapshot?: any) => {
  if (snapshotHasAtacStructure(snapshot)) return true
  const variantGroups = (snapshot as any)?.__atacVariantGroups
  if (variantGroups && typeof variantGroups === 'object') {
    for (const snap of Object.values(variantGroups as Record<string, any>)) {
      if (snapshotHasAtacStructure(snap)) return true
    }
  }
  return false
}

// Fixed Atacarejo layout: no per-variant snapshots. Values are fit dynamically at runtime.
const shouldUseAtacVariantSnapshots = () => false

const instantiateGroupFromTemplate = async (tpl: LabelTemplate) => {
  const baseGroupJson: any = tpl.group
  const groupJson: any = pickRenderableTemplateGroupJson(tpl)
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

  // Fabric may drop unknown/custom JSON props when constructing a Group from options.
  // Rehydrate template metadata explicitly so variant settings persist across reopen.
  const cloneSafe = <T>(value: T): T => {
    try {
      return typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value))
    } catch {
      return value
    }
  }
  if (baseGroupJson && typeof baseGroupJson === 'object') {
    const rehydrateKeys = [
      '__preserveManualLayout',
      '__forceAtacarejoCanonical',
      '__atacValueVariants',
      '__atacVariantGroups',
      '__isCustomTemplate',
      '__manualTemplateBaseW',
      '__manualTemplateBaseH',
      '__manualGapSingle',
      '__manualGapRetail',
      '__manualGapWholesale',
      '__manualSingleAnchors'
    ] as const
    for (const key of rehydrateKeys) {
      if (key in baseGroupJson) {
        ;(g as any)[key] = cloneSafe((baseGroupJson as any)[key])
      }
    }
  }
  if (!shouldUseAtacVariantSnapshots()) {
    ;(g as any).__atacVariantGroups = {}
  }
  // Never force canonical layout in mini editor; templates are manual.
  ;(g as any).__forceAtacarejoCanonical = false

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

  // Persist a stable visual base size so product-canvas layout matches mini editor.
  const topLevel = typeof g.getObjects === 'function' ? g.getObjects() : []
  const deepVisible = collectObjectsDeepLocal(g).filter((o: any) => o && o !== g && isObjectShownForBoundsLocal(o))
  const byNameDeep = (name: string) => deepVisible.find((o: any) => String(o?.name || '') === name)
  const atacAnchors = [
    byNameDeep('atac_retail_bg'),
    byNameDeep('atac_banner_bg'),
    byNameDeep('atac_wholesale_bg')
  ].filter((o: any) => isObjectShownForBoundsLocal(o))
  const singleAnchors = [
    byNameDeep('price_bg'),
    byNameDeep('price_bg_image'),
    byNameDeep('splash_image')
  ].filter((o: any) => isObjectShownForBoundsLocal(o))
  const fitTargets =
    atacAnchors.length > 0
      ? atacAnchors
      : (singleAnchors.length > 0
        ? singleAnchors
        : (deepVisible.length > 0 ? deepVisible : topLevel.filter((o: any) => isObjectShownForBoundsLocal(o))))
  const baseBounds = measureContentBoundsLocal(fitTargets)
  if (baseBounds && Number.isFinite(baseBounds.width) && Number.isFinite(baseBounds.height) && baseBounds.width > 0 && baseBounds.height > 0) {
    json.__manualTemplateBaseW = Math.max(1, Number(baseBounds.width))
    json.__manualTemplateBaseH = Math.max(1, Number(baseBounds.height))
  } else {
    const fallbackW = Number(g.width || 0)
    const fallbackH = Number(g.height || 0)
    if (Number.isFinite(fallbackW) && fallbackW > 0) json.__manualTemplateBaseW = fallbackW
    if (Number.isFinite(fallbackH) && fallbackH > 0) json.__manualTemplateBaseH = fallbackH
  }

  // Hard-include template metadata that may be dropped by Fabric's generic serializer
  // in some runtime paths (especially nested custom objects/props).
  const cloneSafe = <T>(value: T): T => {
    try {
      return typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value))
    } catch {
      return value
    }
  }
  json.__preserveManualLayout = true
  // Never persist canonical enforcement from mini editor.
  json.__forceAtacarejoCanonical = false
  if ((g as any).__atacValueVariants && typeof (g as any).__atacValueVariants === 'object') {
    json.__atacValueVariants = cloneSafe((g as any).__atacValueVariants)
  } else if (findObjectByNameDeep(g, 'atac_retail_bg')) {
    json.__atacValueVariants = {
      tiny: { ...DEFAULT_ATAC_VALUE_VARIANTS.tiny },
      normal: { ...DEFAULT_ATAC_VALUE_VARIANTS.normal },
      large: { ...DEFAULT_ATAC_VALUE_VARIANTS.large }
    }
  }
  if ((g as any).__atacVariantGroups && typeof (g as any).__atacVariantGroups === 'object') {
    if (shouldUseAtacVariantSnapshots()) json.__atacVariantGroups = cloneSafe((g as any).__atacVariantGroups)
  }
  if (!shouldUseAtacVariantSnapshots()) delete json.__atacVariantGroups

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

const serializeGroupForHistory = (g: any) => {
  if (!g || typeof g.toObject !== 'function') return null
  const json: any = g.toObject(TEMPLATE_EXTRA_PROPS)
  delete json.layoutManager
  delete json.layout
  if ((g as any).__atacValueVariants && typeof (g as any).__atacValueVariants === 'object') {
    json.__atacValueVariants = cloneJsonSafe((g as any).__atacValueVariants)
  }
  if ((g as any).__atacVariantGroups && typeof (g as any).__atacVariantGroups === 'object') {
    if (shouldUseAtacVariantSnapshots()) json.__atacVariantGroups = cloneJsonSafe((g as any).__atacVariantGroups)
  }
  if (!shouldUseAtacVariantSnapshots()) delete json.__atacVariantGroups
  return json
}

const getSnapshotFingerprint = (snapshot: any) => {
  try {
    return JSON.stringify(snapshot)
  } catch {
    return `${Date.now()}-${Math.random()}`
  }
}

const recordHistorySnapshot = (reason = 'manual') => {
  if (!group || isLoadingTemplate.value || isRestoringHistory) return
  const snapshot = serializeGroupForHistory(group)
  if (!snapshot) return
  const fp = getSnapshotFingerprint(snapshot)
  if (fp === historyFingerprint.value) return

  let base = historyStack.value.slice(0, historyIndex.value + 1)
  base.push(snapshot)
  if (base.length > MINI_EDITOR_HISTORY_LIMIT) {
    base = base.slice(base.length - MINI_EDITOR_HISTORY_LIMIT)
  }

  historyStack.value = base
  historyIndex.value = base.length - 1
  historyFingerprint.value = fp
  console.debug?.('[MiniEditor] history snapshot:', reason, historyIndex.value, '/', historyStack.value.length)
}

const queueHistorySnapshot = (reason = 'manual', delayMs = 120) => {
  if (historyDebounceTimer) clearTimeout(historyDebounceTimer)
  historyDebounceTimer = setTimeout(() => {
    historyDebounceTimer = null
    recordHistorySnapshot(reason)
  }, delayMs)
}

const queueRender = () => {
  if (!canvas) return
  if (renderQueued) return
  renderQueued = true
  if (typeof window === 'undefined') {
    renderQueued = false
    canvas.requestRenderAll?.()
    return
  }
  window.requestAnimationFrame(() => {
    renderQueued = false
    canvas?.requestRenderAll?.()
  })
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyStack.value.length - 1)

const setAllContentMoveMode = (enabled: boolean) => {
  if (!group || typeof group.getObjects !== 'function') return
  allContentMoveMode.value = enabled
  group.set?.({
    subTargetCheck: !enabled,
    interactive: true,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: false,
    hoverCursor: enabled ? 'move' : undefined,
    moveCursor: enabled ? 'move' : undefined
  })
  if (typeof group.setControlsVisibility === 'function') {
    group.setControlsVisibility({
      mt: true, mb: true, ml: true, mr: true,
      tl: true, tr: true, bl: true, br: true, mtr: true
    })
  }

  const children = group.getObjects()
  children.forEach((child: any) => {
    if (!child) return
    if (enabled) {
      if (!childInteractivityCache.has(child)) {
        childInteractivityCache.set(child, {
          selectable: !!child.selectable,
          evented: !!child.evented,
          hasControls: !!child.hasControls,
          hasBorders: !!child.hasBorders
        })
      }
      child.set?.({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false
      })
    } else {
      const prev = childInteractivityCache.get(child)
      if (prev) {
        child.set?.({
          selectable: prev.selectable,
          evented: prev.evented,
          hasControls: prev.hasControls,
          hasBorders: prev.hasBorders
        })
      }
    }
    child.setCoords?.()
  })

  group.setCoords?.()
  canvas?.discardActiveObject?.()
  canvas?.setActiveObject?.(group)
  queueRender()
}

const restoreHistoryAt = async (index: number) => {
  if (!group) return
  const snapshot = historyStack.value[index]
  if (!snapshot) return
  isRestoringHistory = true
  try {
    await applySerializedSnapshotToCurrentGroup(snapshot, { preservePlacement: false })
    historyIndex.value = index
    historyFingerprint.value = getSnapshotFingerprint(snapshot)
    canvas?.setActiveObject?.(group)
    selectedObj.value = group
    updateKey.value++
  } finally {
    isRestoringHistory = false
  }
}

const undoHistory = async () => {
  if (!canUndo.value) return
  await restoreHistoryAt(historyIndex.value - 1)
}

const redoHistory = async () => {
  if (!canRedo.value) return
  await restoreHistoryAt(historyIndex.value + 1)
}

const selectAllContent = () => {
  if (!canvas || !group) return
  setAllContentMoveMode(true)
  group.set?.({
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: false
  })
  canvas.setActiveObject(group)
  selectedObj.value = group
  group.setCoords?.()
  queueRender()
  updateKey.value++
}

const moveActiveObjectBy = (dx: number, dy: number) => {
  if (!canvas) return
  const target = canvas.getActiveObject?.() || selectedObj.value || group
  if (!target || typeof target.set !== 'function') return
  target.set({
    left: Number(target.left || 0) + dx,
    top: Number(target.top || 0) + dy
  })
  target.setCoords?.()
  if (target !== group && target.group === group) safeAddWithUpdate(group)
  queueRender()
  queueHistorySnapshot('keyboard-move', 140)
}

const scaleSelection = (factor: number) => {
  if (!canvas) return
  const target = canvas.getActiveObject?.() || selectedObj.value || group
  if (!target || typeof target.set !== 'function') return
  const currentScaleX = Number(target.scaleX || 1)
  const currentScaleY = Number(target.scaleY || 1)
  const nextScaleX = Math.max(0.05, Math.min(12, currentScaleX * factor))
  const nextScaleY = Math.max(0.05, Math.min(12, currentScaleY * factor))
  target.set({ scaleX: nextScaleX, scaleY: nextScaleY })
  target.setCoords?.()
  if (target !== group && target.group === group) safeAddWithUpdate(group)
  queueRender()
  queueHistorySnapshot('keyboard-scale', 140)
}

const isTypingTarget = (eventTarget: EventTarget | null) => {
  if (!(eventTarget instanceof HTMLElement)) return false
  const tag = eventTarget.tagName.toLowerCase()
  if (eventTarget.isContentEditable) return true
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

const handleMiniEditorKeydown = async (e: KeyboardEvent) => {
  if (!isReady.value || !canvas || !group) return
  if (isTypingTarget(e.target)) return
  const key = String(e.key || '').toLowerCase()
  const mod = e.metaKey || e.ctrlKey

  if (mod && key === 'a') {
    e.preventDefault()
    selectAllContent()
    return
  }

  if (key === 'escape' && allContentMoveMode.value) {
    e.preventDefault()
    setAllContentMoveMode(false)
    return
  }

  if (mod && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) await redoHistory()
    else await undoHistory()
    return
  }

  if (mod && key === 'y') {
    e.preventDefault()
    await redoHistory()
    return
  }

  if (!mod && !e.altKey && key === 't') {
    e.preventDefault()
    addText()
    return
  }

  if (mod && e.shiftKey && (key === '=' || key === '+')) {
    e.preventDefault()
    scaleSelection(1.05)
    return
  }

  if (mod && e.shiftKey && key === '-') {
    e.preventDefault()
    scaleSelection(0.95)
    return
  }

  if ((key === 'delete' || key === 'backspace') && selectedObj.value && selectedObj.value !== group) {
    e.preventDefault()
    deleteSelected()
    return
  }

  const step = e.shiftKey ? 10 : 1
  if (key === 'arrowleft') {
    e.preventDefault()
    moveActiveObjectBy(-step, 0)
    return
  }
  if (key === 'arrowright') {
    e.preventDefault()
    moveActiveObjectBy(step, 0)
    return
  }
  if (key === 'arrowup') {
    e.preventDefault()
    moveActiveObjectBy(0, -step)
    return
  }
  if (key === 'arrowdown') {
    e.preventDefault()
    moveActiveObjectBy(0, step)
    return
  }
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

const setVisibleForEditor = (obj: any, visible: boolean) => {
  if (!obj || typeof obj.set !== 'function') return
  if (visible) {
    const sx = Number((obj as any).__visibleScaleX ?? (obj as any).__originalScaleX ?? obj.scaleX ?? 1)
    const sy = Number((obj as any).__visibleScaleY ?? (obj as any).__originalScaleY ?? obj.scaleY ?? 1)
    obj.set({
      visible: true,
      scaleX: Number.isFinite(sx) && Math.abs(sx) > 0 ? sx : 1,
      scaleY: Number.isFinite(sy) && Math.abs(sy) > 0 ? sy : 1
    })
    return
  }

  const sx = Number(obj.scaleX)
  const sy = Number(obj.scaleY)
  if (Number.isFinite(sx) && Math.abs(sx) > 0) (obj as any).__visibleScaleX = sx
  if (Number.isFinite(sy) && Math.abs(sy) > 0) (obj as any).__visibleScaleY = sy
  obj.set({ visible: false, scaleX: 0, scaleY: 0 })
}

const layoutAtacarejoCanonicalForEditor = (priceGroup: any, previewW = 340, previewH = 620) => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
  const all = collectObjectsDeepLocal(priceGroup)

  const retailBg = findByNameInObjects(all, 'atac_retail_bg')
  if (!retailBg) return false

  const bannerBg = findByNameInObjects(all, 'atac_banner_bg')
  const wholesaleBg = findByNameInObjects(all, 'atac_wholesale_bg')

  const retailCurrency = findByNameInObjects(all, 'retail_currency_text')
  const retailInteger = findByNameInObjects(all, 'retail_integer_text')
  const retailDecimal = findByNameInObjects(all, 'retail_decimal_text')
  const retailUnit = findByNameInObjects(all, 'retail_unit_text')
  const retailPack = findByNameInObjects(all, 'retail_pack_line_text')

  const bannerText = findByNameInObjects(all, 'wholesale_banner_text')

  const wholesaleCurrency = findByNameInObjects(all, 'wholesale_currency_text')
  const wholesaleInteger = findByNameInObjects(all, 'wholesale_integer_text')
  const wholesaleDecimal = findByNameInObjects(all, 'wholesale_decimal_text')
  const wholesaleUnit = findByNameInObjects(all, 'wholesale_unit_text')
  const wholesalePack = findByNameInObjects(all, 'wholesale_pack_line_text')

  const isShown = (o: any) => !!(o && o.visible !== false && Number(o.scaleX ?? 1) !== 0 && Number(o.scaleY ?? 1) !== 0)

  let showRetail = isShown(retailBg)
  let showWholesale = isShown(wholesaleBg)
  const bannerHasText = String(bannerText?.text || '').trim().length > 0
  const showBanner = bannerHasText || isShown(bannerBg) || isShown(bannerText)

  if (!showRetail && !showWholesale) {
    showRetail = true
    setVisibleForEditor(retailBg, true)
    setVisibleForEditor(retailCurrency, true)
    setVisibleForEditor(retailInteger, true)
    setVisibleForEditor(retailDecimal, true)
    setVisibleForEditor(retailUnit, true)
  }

  setVisibleForEditor(retailBg, showRetail)
  setVisibleForEditor(retailCurrency, showRetail)
  setVisibleForEditor(retailInteger, showRetail)
  setVisibleForEditor(retailDecimal, showRetail)
  setVisibleForEditor(retailUnit, showRetail)
  setVisibleForEditor(retailPack, showRetail && String(retailPack?.text || '').trim().length > 0)

  setVisibleForEditor(wholesaleBg, showWholesale)
  setVisibleForEditor(wholesaleCurrency, showWholesale)
  setVisibleForEditor(wholesaleInteger, showWholesale)
  setVisibleForEditor(wholesaleDecimal, showWholesale)
  setVisibleForEditor(wholesaleUnit, showWholesale)
  setVisibleForEditor(wholesalePack, showWholesale && String(wholesalePack?.text || '').trim().length > 0)

  if (showBanner) {
    setVisibleForEditor(bannerBg, true)
    setVisibleForEditor(bannerText, true)
  } else {
    setVisibleForEditor(bannerBg, false)
    setVisibleForEditor(bannerText, false)
  }

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  const totalW = clamp(previewW * 0.94, 190, previewW * 0.99)
  const totalH = clamp(previewH * 0.44, 138, previewH * 0.66)
  const padX = clamp(totalW * 0.055, 12, 28)
  const sectionGap = clamp(totalH * 0.014, 3, 6)

  const sections: Array<'retail' | 'banner' | 'wholesale'> = []
  if (showRetail) sections.push('retail')
  if (showBanner) sections.push('banner')
  if (showWholesale) sections.push('wholesale')

  const gapCount = Math.max(0, sections.length - 1)
  const usableH = Math.max(24, totalH - (sectionGap * gapCount))

  let retailH = 0
  let bannerH = 0
  let wholesaleH = 0
  if (showRetail && showWholesale) {
    if (showBanner) {
      retailH = clamp(usableH * 0.30, 38, 72)
      bannerH = clamp(usableH * 0.18, 22, 38)
      wholesaleH = usableH - retailH - bannerH
      if (wholesaleH < 52) {
        const need = 52 - wholesaleH
        const giveFromRetail = Math.min(need, Math.max(0, retailH - 34))
        retailH -= giveFromRetail
        const rest = need - giveFromRetail
        bannerH = Math.max(20, bannerH - rest)
        wholesaleH = usableH - retailH - bannerH
      }
    } else {
      retailH = usableH * 0.36
      wholesaleH = usableH - retailH
    }
  } else if (showRetail || showWholesale) {
    if (showBanner) {
      bannerH = clamp(usableH * 0.22, 22, 40)
      if (showRetail) retailH = usableH - bannerH
      if (showWholesale) wholesaleH = usableH - bannerH
    } else {
      if (showRetail) retailH = usableH
      if (showWholesale) wholesaleH = usableH
    }
  }

  const centers: { retail: number; banner: number; wholesale: number } = { retail: 0, banner: 0, wholesale: 0 }
  let y = -totalH / 2
  sections.forEach((section, idx) => {
    const h = section === 'retail' ? retailH : section === 'banner' ? bannerH : wholesaleH
    centers[section] = y + (h / 2)
    y += h
    if (idx < sections.length - 1) y += sectionGap
  })

  const setBg = (bg: any, h: number, cy: number, rx: number, color?: string) => {
    if (!bg || typeof bg.set !== 'function') return
    bg.set({
      width: totalW,
      height: h,
      rx,
      ry: rx,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: cy,
      ...(color ? { fill: color } : {})
    })
  }

  const setTextSizing = (txt: any, defaultScale: number, baseH: number, color?: string) => {
    if (!txt || !String(txt.type || '').includes('text')) return
    txt.set({
      fontFamily: txt.fontFamily || 'Inter',
      fontWeight: '900',
      fill: color ?? txt.fill,
      fontSize: Math.max(8, baseH * defaultScale),
      scaleX: 1,
      scaleY: 1
    })
    txt.initDimensions?.()
  }

  const fitTextWidth = (txt: any, maxW: number, minScale = 0.6) => {
    if (!txt || !Number.isFinite(maxW) || maxW <= 0) return
    const w = getScaledWidthLocal(txt)
    if (!w || w <= maxW) return
    const s = clamp(maxW / w, minScale, 1)
    txt.set?.({ scaleX: s, scaleY: s })
  }

  const getVerticalBounds = (obj: any) => {
    if (!obj) return null
    const h = getScaledHeightLocal(obj)
    if (!h || !Number.isFinite(h)) return null
    const y0 = Number(obj.top || 0)
    const oy = String(obj.originY || 'top')
    if (oy === 'center') return { min: y0 - (h / 2), max: y0 + (h / 2) }
    if (oy === 'bottom') return { min: y0 - h, max: y0 }
    return { min: y0, max: y0 + h }
  }

  if (showRetail) setBg(retailBg, retailH, centers.retail, clamp(retailH * 0.22, 10, 28), '#ef4444')
  if (showBanner && bannerBg) setBg(bannerBg, bannerH, centers.banner, clamp(bannerH * 0.48, 8, 20), '#ffffff')
  if (showWholesale) setBg(wholesaleBg, wholesaleH, centers.wholesale, clamp(wholesaleH * 0.22, 10, 28), '#fde047')

  const layoutTier = (tier: {
    blockH: number
    blockCY: number
    currency: any
    integer: any
    decimal: any
    unit: any
    pack: any
    color: string
    emphasis?: 'normal' | 'high'
  }) => {
    const { blockH, blockCY, currency, integer, decimal, unit, pack, color, emphasis } = tier
    if (!blockH || !Number.isFinite(blockH)) return

    const maxPriceW = totalW - (padX * 2)
    const currencyGap = clamp(blockH * 0.045, 2, 9)
    const integerDecimalGap = clamp(blockH * 0.02, 1, 4)
    const isHigh = emphasis === 'high'
    const integerScale = isHigh ? 0.72 : 0.60
    const decimalScale = isHigh ? 0.38 : 0.31
    const currencyScale = isHigh ? 0.26 : 0.21
    const unitScale = isHigh ? 0.27 : 0.22
    const packScale = isHigh ? 0.17 : 0.155

    setTextSizing(integer, integerScale, blockH, color)
    setTextSizing(decimal, decimalScale, blockH, color)
    setTextSizing(currency, currencyScale, blockH, color)
    setTextSizing(unit, unitScale, blockH, color)
    setTextSizing(pack, packScale, blockH, color)

    const packVisible = isShown(pack) && String(pack?.text || '').trim().length > 0
    const unitVisible = isShown(unit) && String(unit?.text || '').trim().length > 0

    let centsBlockW = unitVisible ? Math.max(getScaledWidthLocal(decimal), getScaledWidthLocal(unit)) : getScaledWidthLocal(decimal)
    let priceW = getScaledWidthLocal(currency) + currencyGap + getScaledWidthLocal(integer) + integerDecimalGap + centsBlockW
    if (priceW > maxPriceW && priceW > 0) {
      const s = Math.max(isHigh ? 0.65 : 0.58, maxPriceW / priceW)
      ;[currency, integer, decimal, unit].forEach((t: any) => t?.set?.({ scaleX: s, scaleY: s }))
      centsBlockW = unitVisible ? Math.max(getScaledWidthLocal(decimal), getScaledWidthLocal(unit)) : getScaledWidthLocal(decimal)
      priceW = getScaledWidthLocal(currency) + currencyGap + getScaledWidthLocal(integer) + integerDecimalGap + centsBlockW
    }

    const blockTop = blockCY - (blockH / 2)
    const blockBottom = blockCY + (blockH / 2)
    const innerTop = blockTop + (blockH * 0.10)
    const innerBottom = blockBottom - (blockH * 0.10)

    const maxPackW = totalW - (padX * 2)
    let chainBottomLimit = innerBottom
    if (pack && packVisible) {
      const pw = getScaledWidthLocal(pack)
      if (pw > maxPackW && pw > 0) {
        const s = maxPackW / pw
        pack.set({ scaleX: s, scaleY: s })
      } else {
        pack.set({ scaleX: 1, scaleY: 1 })
      }
      fitTextWidth(pack, maxPackW, isHigh ? 0.6 : 0.55)
      const packH = Math.max(8, getScaledHeightLocal(pack))
      const packCenterY = Math.min(innerBottom - (packH / 2), blockBottom - (packH / 2) - 2)
      pack.set({ originX: 'center', originY: 'center', left: 0, top: packCenterY })
      chainBottomLimit = Math.max(innerTop + 6, packCenterY - (packH / 2) - (blockH * 0.08))
    }

    const chainCenterY = (innerTop + chainBottomLimit) / 2
    const startX = -priceW / 2
    const intY = chainCenterY + (isHigh ? (blockH * 0.02) : (blockH * 0.01))
    const decY = intY - (blockH * (isHigh ? 0.18 : 0.16))
    const curY = intY + (blockH * (isHigh ? 0.02 : 0.01))

    const curW = getScaledWidthLocal(currency)
    currency?.set?.({ originX: 'left', originY: 'center', left: startX, top: curY })
    const intX = startX + curW + currencyGap

    layoutPriceLocal({
      integer,
      decimal,
      unit: unitVisible ? unit : undefined,
      intX,
      intY,
      decY,
      unitY: intY + (blockH * (isHigh ? 0.26 : 0.22)),
      maxWidth: Math.max(20, maxPriceW - (curW + currencyGap)),
      gapPx: integerDecimalGap,
      minGapPx: integerDecimalGap,
      maxGapPx: integerDecimalGap
    })

    const chainBounds = measureHorizontalBoundsLocal([currency, integer, decimal, unitVisible ? unit : null].filter(Boolean) as any[])
    if (chainBounds) {
      const chainCenterX = (chainBounds.left + chainBounds.right) / 2
      const dx = -chainCenterX
      if (Math.abs(dx) > 0.001) {
        ;[currency, integer, decimal, unitVisible ? unit : null].forEach((obj: any) => {
          if (!obj || typeof obj.set !== 'function') return
          obj.set({ left: Number(obj.left || 0) + dx })
        })
      }
    }

    const chainObjects = [currency, integer, decimal, unitVisible ? unit : null].filter(Boolean)
    const yBounds = chainObjects
      .map((obj: any) => getVerticalBounds(obj))
      .filter(Boolean) as Array<{ min: number; max: number }>
    if (yBounds.length > 0) {
      const minY = Math.min(...yBounds.map((b) => b.min))
      const maxY = Math.max(...yBounds.map((b) => b.max))
      const topLimit = innerTop
      const bottomLimit = chainBottomLimit
      let dy = 0
      if (minY < topLimit) dy += (topLimit - minY)
      if ((maxY + dy) > bottomLimit) dy += (bottomLimit - (maxY + dy))
      if (Math.abs(dy) > 0.001) {
        chainObjects.forEach((obj: any) => obj?.set?.({ top: Number(obj.top || 0) + dy }))
      }
    }
  }

  if (showRetail) {
    layoutTier({
      blockH: retailH,
      blockCY: centers.retail,
      currency: retailCurrency,
      integer: retailInteger,
      decimal: retailDecimal,
      unit: retailUnit,
      pack: retailPack,
      color: '#ffffff',
      emphasis: 'normal'
    })
  }

  if (showWholesale) {
    layoutTier({
      blockH: wholesaleH,
      blockCY: centers.wholesale,
      currency: wholesaleCurrency,
      integer: wholesaleInteger,
      decimal: wholesaleDecimal,
      unit: wholesaleUnit,
      pack: wholesalePack,
      color: '#000000',
      emphasis: 'high'
    })
  }

  if (showBanner && bannerText) {
    setTextSizing(bannerText, 0.58, bannerH, '#000000')
    fitTextWidth(bannerText, totalW - (padX * 0.9), 0.56)
    const bannerTop = centers.banner - (bannerH / 2)
    const bannerBottom = centers.banner + (bannerH / 2)
    bannerText.set({ originX: 'center', originY: 'center', left: 0, top: centers.banner })
    const bannerBounds = getVerticalBounds(bannerText)
    if (bannerBounds) {
      let dy = 0
      if (bannerBounds.min < (bannerTop + 2)) dy += ((bannerTop + 2) - bannerBounds.min)
      if ((bannerBounds.max + dy) > (bannerBottom - 2)) dy += ((bannerBottom - 2) - (bannerBounds.max + dy))
      if (Math.abs(dy) > 0.001) bannerText.set({ top: Number(bannerText.top || 0) + dy })
    }
  }

  priceGroup.set({ width: totalW, height: totalH })
  const parts = priceGroup.getObjects?.() || []
  parts.forEach((o: any) => o?.setCoords?.())
  priceGroup.dirty = true
  priceGroup.setCoords?.()
  safeAddWithUpdate(priceGroup)
  return true
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
    layoutAtacarejoCanonicalForEditor(g)
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
  const cw = canvas.getWidth?.() ?? 1
  const ch = canvas.getHeight?.() ?? 1
  const deepVisible = collectObjectsDeepLocal(group).filter((o: any) => o && o !== group && isObjectShownForBoundsLocal(o))
  const topLevel = typeof group.getObjects === 'function' ? group.getObjects() : []
  const byNameDeep = (name: string) => deepVisible.find((o: any) => String(o?.name || '') === name)

  // Use stable fit anchors first (price backgrounds), avoiding noisy/deep bounds.
  const atacAnchors = [
    byNameDeep('atac_retail_bg'),
    byNameDeep('atac_banner_bg'),
    byNameDeep('atac_wholesale_bg')
  ].filter((o: any) => isObjectShownForBoundsLocal(o))
  const singleAnchors = [
    byNameDeep('price_bg'),
    byNameDeep('price_bg_image'),
    byNameDeep('splash_image')
  ].filter((o: any) => isObjectShownForBoundsLocal(o))

  const fitTargets =
    atacAnchors.length > 0
      ? atacAnchors
      : (singleAnchors.length > 0
        ? singleAnchors
        : (deepVisible.length > 0 ? deepVisible : topLevel.filter((o: any) => isObjectShownForBoundsLocal(o))))

  const bounds = measureContentBoundsLocal(fitTargets)
  const bw = Math.max(1, Number(bounds?.width || group.width || 1))
  const bh = Math.max(1, Number(bounds?.height || group.height || 1))
  const rawScale = Math.min((cw * 0.9) / bw, (ch * 0.85) / bh)
  // Keep the label large/visible by default in the mini editor.
  const scale = Math.max(0.25, Math.min(12, Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1))
  let centerX = Number(bounds ? (bounds.left + bounds.right) / 2 : 0)
  let centerY = Number(bounds ? (bounds.top + bounds.bottom) / 2 : 0)

  // Safety: corrupted coordinates can explode center values and push the label off-screen.
  // Do NOT mutate object coordinates here; only clamp fit center for viewport.
  if (!Number.isFinite(centerX)) centerX = 0
  if (!Number.isFinite(centerY)) centerY = 0
  if (Math.abs(centerX) > 5000 || Math.abs(centerY) > 5000) {
    centerX = 0
    centerY = 0
  }

  group.set({
    originX: 'center',
    originY: 'center',
    left: (cw / 2) - (centerX * scale),
    top: (ch / 2) - (centerY * scale),
    scaleX: scale,
    scaleY: scale
  })
  safeAddWithUpdate(group)
  group.setCoords()
  canvas.requestRenderAll()
}

const getGroupVisibleBoundsForEditor = (g: any) => {
  if (!g) return null
  const deepVisible = collectObjectsDeepLocal(g).filter((o: any) => o && o !== g && isObjectShownForBoundsLocal(o))
  if (!deepVisible.length) return null
  return measureContentBoundsLocal(deepVisible)
}

const hasReasonableEditorBounds = (g: any) => {
  const bounds = getGroupVisibleBoundsForEditor(g)
  if (!bounds) return false
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return false
  if (bounds.width < 18 || bounds.height < 10) return false
  if (bounds.width > 10000 || bounds.height > 10000) return false
  return true
}

const recoverMiniEditorLayoutIfNeeded = (g: any) => {
  if (!g) return
  if (hasReasonableEditorBounds(g)) return
  console.warn('[MiniEditor] invalid bounds detected, normalizing layout for editor preview')
  normalizeAndLayoutForEditor(g)
  ensureAtacarejoPreviewContrast(g)
  safeAddWithUpdate(g)
}

const loadTemplate = async () => {
  if (!canvas || !props.template) return
  isLoadingTemplate.value = true
  allContentMoveMode.value = false
  historyStack.value = []
  historyIndex.value = -1
  historyFingerprint.value = ''
  editorName.value = props.template.name || ''
  selectedObj.value = null
  atacPreviewMode.value = 'current'
  atacPreviewSnapshot.value = {}
  atacBaseGroupSnapshot.value = null

  try {
    canvas.clear()
    group = await instantiateGroupFromTemplate(props.template)
    normalizeEditorGroupTransform(group)

    // Safety recovery: if the baseline saved group is corrupted but variant snapshots exist,
    // restore from the first valid atac snapshot to keep the template editable.
    const hasAtacBaseline = !!findObjectByNameDeep(group, 'atac_retail_bg')
    const recoverable = !hasAtacBaseline ? getRecoverableAtacSnapshot() : null
    if (recoverable) {
      await applySerializedSnapshotToCurrentGroup(recoverable, { preservePlacement: false })
    }
    ensureAtacarejoPreviewContrast(group)
    if (findObjectByNameDeep(group, 'atac_retail_bg')) {
      // Capture "Atual" baseline for independent variant tabs.
      captureAtacPreviewSnapshot()
    }
    recoverMiniEditorLayoutIfNeeded(group)

    console.log('[MiniEditor] Template loaded, listing objects:')
    listAllObjects(group)

    canvas.add(group)
    canvas.setActiveObject(group)
    resizeCanvasToViewport()
    fitToViewport()
    canvas.requestRenderAll()
    recordHistorySnapshot('loadTemplate')
  } finally {
    isLoadingTemplate.value = false
  }
}

const setSelected = (opt?: any) => {
  if (!canvas) return

  if (allContentMoveMode.value && group) {
    canvas.setActiveObject?.(group)
    selectedObj.value = group
    updateKey.value++
    return
  }

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
  recordHistorySnapshot(`patch:${prop}`)
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
  recordHistorySnapshot(`patchCustom:${prop}`)
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

  // ColorPicker expects string values. Fabric objects (gradients/patterns) can leak here
  // and break prop validation/update cycle. Normalize them to a usable color string.
  if (prop === 'fill' || prop === 'stroke') {
    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (!trimmed) return fallback
      if (prop === 'stroke' && (trimmed === 'transparent' || trimmed === 'none')) {
        return fallback || '#000000'
      }
      return trimmed
    }

    if (result && typeof result === 'object') {
      const directColor = (result as any).color
      if (typeof directColor === 'string' && directColor.trim()) {
        return directColor.trim()
      }
      const stops = Array.isArray((result as any).colorStops) ? (result as any).colorStops : []
      const firstStop = stops.find((s: any) => typeof s?.color === 'string' && s.color.trim())
      if (firstStop?.color) return String(firstStop.color).trim()
    }

    return fallback
  }

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
  recordHistorySnapshot(`textCase:${mode}`)
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
const isAtacarejoTemplate = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateKey.value
  return !!findObjectByNameDeep(group, 'atac_retail_bg')
})
const atacValueVariants = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateKey.value
  return readAtacValueVariants()
})

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

const currentFontFamily = computed(() => String(current('fontFamily', '') || '').trim())

const fontWeightOptions = computed(() =>
  getFontWeightOptionsForFamily(currentFontFamily.value, {
    ensureWeight: currentFontWeight.value
  })
)

const handleFontFamilyChange = (event: Event) => {
  const nextFont = String((event.target as HTMLSelectElement).value || '').trim()
  patch('fontFamily', nextFont)

  const normalizedWeight = normalizeFontWeightForFamily(nextFont, currentFontWeight.value)
  if (normalizedWeight !== currentFontWeight.value) {
    patch('fontWeight', normalizedWeight)
  }
}

const currentTextCase = computed(() => {
  const v = String((selectedObj.value as any)?.__textCase || 'none') as any
  return (v === 'upper' || v === 'lower' || v === 'none') ? v : 'none'
})

const isTextLikeObject = (obj: any) => {
  const t = String(obj?.type || '').toLowerCase()
  return t === 'text' || t === 'i-text' || t === 'textbox'
}

const extractColorStringFromFill = (fill: any): string | null => {
  if (typeof fill === 'string' && fill.trim()) return fill.trim()
  if (!fill || typeof fill !== 'object') return null
  if (typeof fill.color === 'string' && fill.color.trim()) return fill.color.trim()
  const stops = Array.isArray(fill.colorStops) ? fill.colorStops : []
  const firstStop = stops.find((s: any) => typeof s?.color === 'string' && s.color.trim())
  if (firstStop?.color) return String(firstStop.color).trim()
  return null
}

const getDefaultAddTextFill = () => {
  const selected = selectedObj.value
  if (isTextLikeObject(selected)) {
    const selectedFill = extractColorStringFromFill(selected?.fill)
    if (selectedFill) return selectedFill
  }

  const candidates = [
    findObjectByNameDeep(group, 'price_bg'),
    findObjectByNameDeep(group, 'atac_retail_bg'),
    findObjectByNameDeep(group, 'atac_wholesale_bg'),
    findObjectByNameDeep(group, 'atac_banner_bg'),
    group
  ].filter(Boolean)

  for (const candidate of candidates) {
    const color = extractColorStringFromFill((candidate as any)?.fill)
    if (!color) continue
    const rgba = parseColorRgbaLocal(color)
    if (!rgba || rgba.a <= 0.2) continue
    const luminance = ((0.2126 * rgba.r) + (0.7152 * rgba.g) + (0.0722 * rgba.b)) / 255
    return luminance > 0.58 ? '#111827' : '#ffffff'
  }

  return '#111827'
}

const focusAddedText = (txt: any) => {
  if (!txt || !canvas) return
  selectedObj.value = txt
  updateKey.value++
  queueRender()
  if (typeof txt.enterEditing !== 'function') return
  const run = () => {
    try {
      txt.enterEditing()
      txt.selectAll?.()
      txt.hiddenTextarea?.focus?.()
    } catch {
      // best effort only
    }
  }
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(run)
  } else {
    run()
  }
}

const addText = () => {
  if (!fabric || !canvas || !group) return
  const selected = selectedObj.value
  const baseText = isTextLikeObject(selected) ? selected : null
  const topOffset = Number(group?.height || 0) > 0
    ? -Math.max(18, Math.min(56, Math.round(Number(group.height) * 0.18)))
    : -26
  const txt = new fabric.IText('Novo texto', {
    left: 0,
    top: topOffset,
    originX: 'center',
    originY: 'center',
    fontSize: Math.max(10, Number(baseText?.fontSize || 28)),
    fontFamily: String(baseText?.fontFamily || 'Inter'),
    fontWeight: baseText?.fontWeight || '700',
    fill: extractColorStringFromFill(baseText?.fill) || getDefaultAddTextFill(),
    textAlign: String(baseText?.textAlign || 'center'),
    lineHeight: Math.max(0.8, Number(baseText?.lineHeight || 1)),
    charSpacing: Number(baseText?.charSpacing || 0),
    name: `custom_text_${Math.random().toString(36).slice(2, 7)}`
  })
  safeAddWithUpdate(group, txt)
  canvas.setActiveObject?.(txt)
  setSelected({ target: txt, subTarget: txt, subTargets: [txt], selected: [txt] })
  focusAddedText(txt)
  canvas.requestRenderAll()
  recordHistorySnapshot('addText')
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
  recordHistorySnapshot('addRect')
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
  recordHistorySnapshot('addCircle')
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
    recordHistorySnapshot('addImage')
    
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
    recordHistorySnapshot('replaceImage')
    
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
  recordHistorySnapshot('deleteSelected')
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
  recordHistorySnapshot('moveLayer')
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
    // Persist current tab snapshot before serializing.
    if (findObjectByNameDeep(group, 'atac_retail_bg')) {
      if (atacPreviewMode.value === 'current') captureAtacPreviewSnapshot()
      else persistCurrentVariantSnapshotIfNeeded()
    }

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

    let groupJson = serializeGroupForTemplate(group)

    // If saving while on a variation tab, save the "Atual" baseline as template root
    // and keep variations inside `__atacVariantGroups` (independent snapshots).
    if (findObjectByNameDeep(group, 'atac_retail_bg') && atacPreviewMode.value !== 'current' && atacBaseGroupSnapshot.value) {
      const base = cloneJsonSafe(atacBaseGroupSnapshot.value)
      const map = cloneJsonSafe(getAtacVariantGroupsMap())
      base.__atacVariantGroups = map
      base.__preserveManualLayout = true
      base.__forceAtacarejoCanonical = false
      groupJson = base
    }

    // Preview = current editor canvas. This can fail if the canvas is tainted
    // (e.g. external image without CORS). In that case, still save the template.
    let previewDataUrl: string | undefined = undefined
    try {
      previewDataUrl = canvas?.toDataURL?.({ format: 'png', multiplier: 1 })
    } catch (e: any) {
      console.warn('[LabelTemplateMiniEditor] preview toDataURL failed (tainted canvas?)', e)
      previewDataUrl = undefined
    }

    const saveResult = await new Promise<TemplateSaveResult>((resolve) => {
      let settled = false
      const finalize = (result: TemplateSaveResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      emit('save', props.template.id, { group: groupJson, previewDataUrl, name }, finalize)
      setTimeout(() => {
        finalize({ ok: false, message: 'Tempo esgotado ao salvar a etiqueta. Tente novamente.' })
      }, 20000)
    })

    if (!saveResult?.ok) {
      saveError.value = saveResult?.message || 'Falha ao salvar a etiqueta'
      return
    }

    // Keep the edited tag visible and centered after save/reload cycles.
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => fitToViewport())
    } else {
      fitToViewport()
    }
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

  const handleCanvasObjectModified = () => {
    queueHistorySnapshot('object:modified', 80)
  }

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
    if (allContentMoveMode.value) setAllContentMoveMode(false)
    selectedObj.value = null
    updateKey.value++
  })

  // Also try to catch clicks on objects
  canvas.on('mouse:down', (e: any) => {
    if (allContentMoveMode.value && group) {
      canvas.setActiveObject?.(group)
      selectedObj.value = group
      updateKey.value++
      return
    }
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
    if (allContentMoveMode.value && group) {
      canvas.setActiveObject?.(group)
      selectedObj.value = group
      updateKey.value++
      return
    }
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
  canvas.on('object:modified', handleCanvasObjectModified)

  isReady.value = true
  setZoom(100)
  await loadTemplate()
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleMiniEditorKeydown)
  }

  // Keep the Fabric canvas strictly inside the preview viewport.
  if (viewportEl.value && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      resizeCanvasToViewport()
      fitToViewport()
    })
    ro.observe(viewportEl.value)
  }
})

onBeforeUnmount(() => {
  if (historyDebounceTimer) {
    clearTimeout(historyDebounceTimer)
    historyDebounceTimer = null
  }
  renderQueued = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleMiniEditorKeydown)
  }
  try {
    canvas?.dispose?.()
  } catch {
    // ignore dispose errors
  }
  canvas = null
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
          <button class="me-tool-btn-compact" @click="addText" title="Adicionar texto (T)">
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
        <div class="me-insert-actions">
          <button class="me-insert-btn me-insert-btn--primary" @click="addText" title="Adicionar texto (T)">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            Adicionar texto
          </button>
          <button class="me-insert-btn" @click="addRect" title="Adicionar retângulo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
            </svg>
            Retângulo
          </button>
          <button class="me-insert-btn" @click="addCircle" title="Adicionar círculo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke-width="2" />
            </svg>
            Círculo
          </button>
          <button class="me-insert-btn" @click="openAddImage" title="Adicionar imagem">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Imagem
          </button>
        </div>

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
                  @change="handleFontFamilyChange"
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
                    <option v-for="opt in fontWeightOptions" :key="opt.value" :value="String(opt.value)">{{ opt.label }}</option>
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

          <!-- Collapsible: Atacarejo Value Variants -->
          <div v-if="false && isAtacarejoTemplate" class="me-accordion-section">
            <button
              class="me-accordion-header"
              :class="{ 'me-accordion-header--collapsed': isSectionCollapsed('atacVariants') }"
              @click="toggleSection('atacVariants')"
            >
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-3.314 0-6 2.239-6 5s2.686 5 6 5 6-2.239 6-5-2.686-5-6-5zm0 0V4m0 0l-3 3m3-3l3 3" />
              </svg>
              <span>Variações de Valor</span>
              <svg class="me-accordion-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="!isSectionCollapsed('atacVariants')" class="me-accordion-content">
              <p class="me-atac-variants-hint">
                Layout fixo: os valores se ajustam automaticamente no produto (sem variações).
              </p>
              <div class="me-atac-preview-strip">
                <span>Editar variação:</span>
                <button
                  v-for="btn in atacPreviewButtons"
                  :key="btn.key"
                  class="me-atac-preview-btn"
                  :class="{ 'me-atac-preview-btn--active': atacPreviewMode === btn.key }"
                  @click="void applyAtacPreviewMode(btn.key)"
                >
                  {{ btn.label }}
                </button>
              </div>
              <div class="me-atac-variants-list">
                <div v-for="mode in atacVariantModes" :key="mode.key" class="me-atac-variant-card">
                  <div class="me-atac-variant-header">
                    <strong>{{ mode.label }}</strong>
                    <span>{{ mode.hint }}</span>
                  </div>
                  <div class="me-atac-variant-fields">
                    <label class="me-atac-variant-row">
                      <span>Largura cadeia</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.35"
                        max="0.95"
                        class="me-atac-variant-input"
                        :value="atacValueVariants[mode.key].chainWidthRatio.toFixed(2)"
                        @input="setAtacValueVariant(mode.key, 'chainWidthRatio', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                    <label class="me-atac-variant-row">
                      <span>Escala mínima</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.30"
                        max="1"
                        class="me-atac-variant-input"
                        :value="atacValueVariants[mode.key].minScale.toFixed(2)"
                        @input="setAtacValueVariant(mode.key, 'minScale', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                    <label class="me-atac-variant-row">
                      <span>Gap inteiro/decimal</span>
                      <input
                        type="number"
                        step="1"
                        min="-18"
                        max="12"
                        class="me-atac-variant-input"
                        :value="Math.round(atacValueVariants[mode.key].intDecimalGap)"
                        @input="setAtacValueVariant(mode.key, 'intDecimalGap', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                    <label class="me-atac-variant-row">
                      <span>Gap moeda</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0.005"
                        max="0.08"
                        class="me-atac-variant-input"
                        :value="atacValueVariants[mode.key].currencyGapRatio.toFixed(3)"
                        @input="setAtacValueVariant(mode.key, 'currencyGapRatio', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                    <label class="me-atac-variant-row">
                      <span>Largura pack line</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.55"
                        max="0.99"
                        class="me-atac-variant-input"
                        :value="atacValueVariants[mode.key].packWidthRatio.toFixed(2)"
                        @input="setAtacValueVariant(mode.key, 'packWidthRatio', ($event.target as HTMLInputElement).value)"
                      />
                    </label>
                  </div>
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

.me-insert-actions {
  @apply mb-3 grid grid-cols-2 gap-2;
}

.me-insert-btn {
  @apply flex items-center justify-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-2.5 py-2 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800/60 hover:text-white transition-colors;
}

.me-insert-btn svg {
  @apply w-3.5 h-3.5;
}

.me-insert-btn--primary {
  @apply border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25;
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

/* Atacarejo variants */
.me-atac-variants-hint {
  @apply text-[10px] text-zinc-500 leading-relaxed;
}

.me-atac-variants-list {
  @apply space-y-2;
}

.me-atac-preview-strip {
  @apply flex items-center flex-wrap gap-1.5 mb-2;
}

.me-atac-preview-strip > span {
  @apply text-[10px] text-zinc-500 mr-1;
}

.me-atac-preview-btn {
  @apply px-2 py-1 rounded-md border border-zinc-700/60 bg-zinc-900/50 text-[10px] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors;
}

.me-atac-preview-btn--active {
  @apply border-violet-500/70 bg-violet-500/15 text-violet-200;
}

.me-atac-variant-card {
  @apply rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-2.5;
}

.me-atac-variant-header {
  @apply flex items-baseline justify-between gap-2 mb-2;
}

.me-atac-variant-header strong {
  @apply text-[11px] text-zinc-200;
}

.me-atac-variant-header span {
  @apply text-[10px] text-zinc-500;
}

.me-atac-variant-fields {
  @apply space-y-1.5;
}

.me-atac-variant-row {
  @apply grid grid-cols-[1fr_88px] items-center gap-2 text-[10px] text-zinc-400;
}

.me-atac-variant-input {
  @apply w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1 text-[11px] text-white text-right tabular-nums focus:outline-none focus:border-violet-500/50;
}
</style>
