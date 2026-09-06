<script setup lang="ts">
import type { LabelTemplate } from '~/types/label-template'
import ColorPicker from './ui/ColorPicker.vue'
import {
  AVAILABLE_FONT_FAMILIES,
  getFontWeightOptionsForFamily,
  normalizeFontWeightForFamily
} from '~/utils/font-catalog'
import {
  getRichPriceSegmentFontSize,
  getRichPriceSegmentOffset,
  isRichPriceTextObject,
  applyRichPriceTextValue,
  installRichPriceTextRenderer,
  setRichPriceBaseFontSize,
  setRichPriceSegmentOffset,
  setRichPriceSegmentStyle,
  positionRichPriceUnit,
  migratePriceGroupToRichText
} from '~/utils/priceRichText'
import {
  applyImageTrimBounds,
  detectImageTrimBounds
} from '~/utils/fabricImageHelpers'
import { resolveFardoSpecialPricePalette } from '~/utils/fardoSpecialPriceHelpers'
import {
  LABEL_TEMPLATE_EXTRA_PROPS,
  MANUAL_TEMPLATE_DERIVED_PROPS,
  MANUAL_TEMPLATE_STABLE_PROPS
} from '~/utils/labelTemplateHelpers'
import {
  disableFabricGroupAutoLayout,
  refreshFabricGroupBounds
} from '~/utils/fabricGroupHelpers'

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
const backgroundImageInputEl = ref<HTMLInputElement | null>(null)
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

const MAX_LABEL_IMAGE_BYTES = 15 * 1024 * 1024
const LABEL_IMAGE_TRIM_ALPHA_THRESHOLD = 12

const isLabelBackgroundImageName = (name: unknown): boolean => {
  const normalized = String(name || '').trim()
  return normalized === 'label_bg_image'
    || normalized === 'price_bg_image'
    || normalized === 'splash_image'
}

const trimLabelImageToVisibleContent = (img: any): boolean => {
  if (!img || String(img.type || '').toLowerCase() !== 'image') return false

  const bounds = detectImageTrimBounds(img, {
    alphaThreshold: LABEL_IMAGE_TRIM_ALPHA_THRESHOLD,
    padding: 0
  })
  if (!bounds) return false

  const current = {
    left: Number(img.cropX || 0),
    top: Number(img.cropY || 0),
    width: Number(img.width || 0),
    height: Number(img.height || 0)
  }
  const alreadyTrimmed = Math.abs(current.left - bounds.left) < 0.5 &&
    Math.abs(current.top - bounds.top) < 0.5 &&
    Math.abs(current.width - bounds.width) < 0.5 &&
    Math.abs(current.height - bounds.height) < 0.5
  if (alreadyTrimmed) return false

  const applied = applyImageTrimBounds(img, bounds, { preserveVisualPosition: true })
  if (!applied) return false
  img.set?.({ dirty: true, objectCaching: false })
  img.setCoords?.()
  return true
}

const trimCustomLabelImages = (root: any): number => {
  let trimmed = 0
  const visit = (obj: any) => {
    if (!obj) return
    const type = String(obj.type || '').toLowerCase()
    if (type === 'image' && !isLabelBackgroundImageName(obj.name)) {
      if (trimLabelImageToVisibleContent(obj)) trimmed += 1
    }
    const children = getObjectChildren(obj)
    children.forEach(visit)
  }
  visit(root)
  return trimmed
}

const decodeLabelImageElement = async (el: any): Promise<void> => {
  if (!el) return
  // Preferir decode(): garante que os pixels do WebP/remoto estejam prontos
  // para leitura via canvas (getImageData) antes de qualquer recorte.
  try {
    if (typeof el.decode === 'function') {
      await el.decode()
      return
    }
  } catch {
    // decode() pode rejeitar em alguns navegadores/imagens; cai para o onload.
  }
  if (el.complete && (el.naturalWidth || el.width)) return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    try {
      el.addEventListener?.('load', done, { once: true })
      el.addEventListener?.('error', done, { once: true })
    } catch {
      resolve()
      return
    }
    // Timeout de seguranca: nunca travar a abertura do editor por uma imagem.
    setTimeout(done, 4000)
  })
}

const waitForLabelImagesDecoded = async (root: any): Promise<void> => {
  if (!root) return
  const elements: any[] = []
  const seen = new Set<any>()
  const visit = (obj: any) => {
    if (!obj) return
    if (String(obj.type || '').toLowerCase() === 'image') {
      const el = obj.getElement?.() || obj._element || obj._originalElement
      if (el && !seen.has(el)) {
        seen.add(el)
        elements.push(el)
      }
    }
    getObjectChildren(obj).forEach(visit)
  }
  visit(root)
  if (!elements.length) return
  await Promise.all(elements.map((el) => decodeLabelImageElement(el)))
}

const getEditorErrorMessage = (error: unknown, fallback: string) => {
  const message = String((error as any)?.message || '').trim()
  return message || fallback
}

const validateLabelImageFile = (file: File) => {
  if (!file.type || !file.type.toLowerCase().startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.')
  }
  if (file.size > MAX_LABEL_IMAGE_BYTES) {
    throw new Error('A imagem deve ter no máximo 15 MB.')
  }
}

const readLabelImageFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
  reader.readAsDataURL(file)
})

const reportEditorError = (error: unknown, fallback: string) => {
  const message = getEditorErrorMessage(error, fallback)
  editorError.value = message
  console.error(`[LabelTemplateMiniEditor] ${message}`, error)
}

const getObjectChildren = (root: any): any[] => {
  if (!root) return []
  if (Array.isArray(root?._objects)) return root._objects
  return typeof root?.getObjects === 'function' ? root.getObjects() || [] : []
}

const getObjectParent = (obj: any): any | null => {
  const parent = obj?.group
  return parent && parent !== canvas ? parent : null
}

const getDirectChildOfEditorGroup = (obj: any): any | null => {
  if (!obj || !group || obj === group) return null
  let current = obj
  const visited = new Set<any>()
  while (current && current !== group && !visited.has(current)) {
    visited.add(current)
    const parent = current.group
    if (!parent) return null
    if (parent === group) return current
    current = parent
  }
  return null
}

const markObjectTreeDirty = (obj: any) => {
  let current = obj
  const visited = new Set<any>()
  while (current && !visited.has(current)) {
    visited.add(current)
    current.dirty = true
    current.setCoords?.()
    if (current === group) break
    current = current.group
  }
  group?.setCoords?.()
  group && (group.dirty = true)
}

const removeObjectFromEditorTree = (obj: any): boolean => {
  if (!obj || obj === group) return false
  const parent = getObjectParent(obj) || (group && getObjectChildren(group).includes(obj) ? group : null)
  if (!parent) return false

  let removed = false
  if (typeof parent.remove === 'function') {
    const result = parent.remove(obj)
    removed = Array.isArray(result) ? result.includes(obj) : result === obj || result === true
  }
  if (!removed) {
    const objects = getObjectChildren(parent)
    const index = objects.indexOf(obj)
    if (index >= 0) {
      objects.splice(index, 1)
      parent._onObjectRemoved?.(obj)
      removed = true
    }
  }
  if (!removed) return false

  obj.group = undefined
  refreshManualGroupBounds(parent)
  markObjectTreeDirty(parent)
  return true
}

const reorderObjectInParent = (obj: any, direction: -1 | 1): boolean => {
  if (!obj || obj === group) return false
  const parent = getObjectParent(obj) || (group && getObjectChildren(group).includes(obj) ? group : null)
  if (!parent) return false
  const objects = getObjectChildren(parent)
  const index = objects.indexOf(obj)
  const next = index + direction
  if (index < 0 || next < 0 || next >= objects.length) return false
  ;[objects[index], objects[next]] = [objects[next], objects[index]]
  parent._onStackOrderChanged?.(obj)
  markObjectTreeDirty(parent)
  return true
}

const selectedObj = shallowRef<any>(null)
const updateKey = ref(0) // Force reactivity on property changes

const editorName = ref('')
const isReady = ref(false)
const zoomPct = ref(100)
const saveError = ref<string | null>(null)
const editorError = ref<string | null>(null)
const isSaving = ref(false)
const isLoadingTemplate = ref(false)

const MINI_EDITOR_HISTORY_LIMIT = 120
const historyStack = ref<any[]>([])
const historyIndex = ref(-1)
const historyFingerprint = ref('')
const savedHistoryFingerprint = ref('')
const savedEditorName = ref('')
let isRestoringHistory = false
let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
const allContentMoveMode = ref(false)
const childInteractivityCache = new WeakMap<any, { selectable: boolean; evented: boolean; hasControls: boolean; hasBorders: boolean }>()
let renderQueued = false

const showFillColorPicker = ref(false)
const showFillColorPicker2 = ref(false)
const showStrokeColorPicker = ref(false)
const showTextStrokeColorPicker = ref(false)

// Cores por trecho permitem montar um texto com mais de uma cor sem criar
// um novo modelo de dados: o Fabric persiste os estilos de cada caractere.
const textSegmentColor = ref('#facc15')
const textSecondColor = ref('#facc15')
const gradientStart = ref('#ffffff')
const gradientEnd = ref('#f59e0b')
const gradientDirection = ref('vertical')
const applyTextGradient = () => {
  const obj = selectedObj.value
  if (!obj || !isText.value || !fabric?.Gradient) return
  // Cores por caractere prevalecem sobre o preenchimento do texto.
  for (const line of Object.values(obj.styles || {}) as any[]) {
    for (const style of Object.values(line) as any[]) delete style.fill
  }
  for (const key of ['__priceRichIntegerStyle', '__priceRichDecimalStyle']) {
    if (obj[key]) obj[key] = { ...obj[key], fill: undefined }
  }
  obj.set('fill', new fabric.Gradient({
    type: 'linear', gradientUnits: 'percentage',
    coords: { x1: 0, y1: 0, x2: gradientDirection.value === 'vertical' ? 0 : 1, y2: gradientDirection.value === 'horizontal' ? 0 : 1 },
    colorStops: [{ offset: 0, color: gradientStart.value }, { offset: 1, color: gradientEnd.value }]
  }))
  finishTextColorChange(obj, 'textGradient')
}
const textRangeStart = ref(0)
const textRangeEnd = ref(0)
const textRangeIsActive = ref(false)

// Trigger elements for color pickers positioning
const fillColorTrigger = ref<HTMLElement | null>(null)
const fillColorTrigger2 = ref<HTMLElement | null>(null)
const strokeColorTrigger = ref<HTMLElement | null>(null)
const textStrokeColorTrigger = ref<HTMLElement | null>(null)

// Controle de cantos individuais (vinculados ou independentes)
const cornersLinked = ref(true)

// Controle de cantos individuais no MiniEditor
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
const TEMPLATE_EXTRA_PROPS = LABEL_TEMPLATE_EXTRA_PROPS

const ATAC_VALUE_VARIANT_KEYS = ['tiny', 'normal', 'large'] as const
type AtacValueVariantKey = (typeof ATAC_VALUE_VARIANT_KEYS)[number]
type AtacValueVariantField = 'chainWidthRatio' | 'minScale' | 'intDecimalGap' | 'currencyGapRatio' | 'packWidthRatio'
type AtacValueVariantConfig = Record<AtacValueVariantField, number>
const PRICE_INTEGER_DECIMAL_GAP_PX = 6

const DEFAULT_ATAC_VALUE_VARIANTS: Record<AtacValueVariantKey, AtacValueVariantConfig> = {
  tiny: {
    chainWidthRatio: 0.48,
    minScale: 0.62,
    intDecimalGap: PRICE_INTEGER_DECIMAL_GAP_PX,
    currencyGapRatio: 0.02,
    packWidthRatio: 0.86
  },
  normal: {
    chainWidthRatio: 0.64,
    minScale: 0.56,
    intDecimalGap: PRICE_INTEGER_DECIMAL_GAP_PX,
    currencyGapRatio: 0.024,
    packWidthRatio: 0.9
  },
  large: {
    chainWidthRatio: 0.82,
    minScale: 0.44,
    intDecimalGap: PRICE_INTEGER_DECIMAL_GAP_PX,
    currencyGapRatio: 0.03,
    packWidthRatio: 0.95
  }
}

const ATAC_VALUE_VARIANT_BOUNDS: Record<AtacValueVariantField, { min: number; max: number }> = {
  chainWidthRatio: { min: 0.35, max: 0.95 },
  minScale: { min: 0.3, max: 1 },
  intDecimalGap: { min: PRICE_INTEGER_DECIMAL_GAP_PX, max: PRICE_INTEGER_DECIMAL_GAP_PX },
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
  'retail_price_text',
  'retail_unit_text',
  'retail_pack_line_text',
  'wholesale_banner_text',
  'wholesale_currency_text',
  'wholesale_integer_text',
  'wholesale_decimal_text',
  'wholesale_price_text',
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

const getLabelVisualBaseBounds = () => {
  if (!group) return null
  const all = collectObjectsDeepLocal(group)
  const isAtacarejo = !!findObjectByNameDeep(group, 'atac_retail_bg')
  const hasPriceBackground = !!findObjectByNameDeep(group, 'price_bg')
  const names = isAtacarejo
    ? ['atac_retail_bg', 'atac_banner_bg', 'atac_wholesale_bg']
    : hasPriceBackground
      ? ['price_bg']
      : ['label_bg_image', 'price_bg_image', 'splash_image']
  const anchors = names
    .map((name) => findByNameInObjects(all, name))
    .filter((obj) => isObjectShownForBoundsLocal(obj))
  const bounds = measureContentBoundsLocal(anchors)
  if (bounds && bounds.width > 0 && bounds.height > 0) return bounds

  const width = Number((group as any).__manualTemplateBaseW || group.width || 300)
  const height = Number((group as any).__manualTemplateBaseH || group.height || 220)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return {
    left: -width / 2,
    right: width / 2,
    top: -height / 2,
    bottom: height / 2,
    width,
    height
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
  const palette = (priceGroup as any).__atacarejoPalette
    ? resolveFardoSpecialPricePalette((priceGroup as any).__atacarejoPalette)
    : {
      retailBg: '#ef4444',
      bannerBg: '#ffffff',
      wholesaleBg: '#fde047',
      retailText: '#ffffff',
      bannerText: '#000000',
      wholesaleText: '#000000'
    }
  if (!retailBg && !bannerBg && !wholesaleBg) return
  const hasAuthoredPalette = !!(priceGroup as any).__atacarejoPalette

  const shouldFixRetail = !!retailBg && (
    retailBg.visible === false ||
    isTransparentLikeColorLocal(retailBg.fill) ||
    (!hasAuthoredPalette && isDarkOpaqueColorLocal(retailBg.fill))
  )
  const shouldFixWholesale = !!wholesaleBg && (
    wholesaleBg.visible === false ||
    isTransparentLikeColorLocal(wholesaleBg.fill) ||
    (!hasAuthoredPalette && isDarkOpaqueColorLocal(wholesaleBg.fill))
  )
  const shouldFixBanner = !!bannerBg && (
    bannerBg.visible === false ||
    isTransparentLikeColorLocal(bannerBg.fill) ||
    (!hasAuthoredPalette && isDarkOpaqueColorLocal(bannerBg.fill))
  )
  if (!shouldFixRetail && !shouldFixWholesale && !shouldFixBanner) return

  if (shouldFixRetail) retailBg.set?.({ fill: hasAuthoredPalette ? palette.retailBg : '#ef4444', visible: true, opacity: 1 })
  if (shouldFixBanner) bannerBg.set?.({ fill: hasAuthoredPalette ? palette.bannerBg : '#ffffff', visible: true, opacity: 1 })
  if (shouldFixWholesale) wholesaleBg.set?.({ fill: hasAuthoredPalette ? palette.wholesaleBg : '#fde047', visible: true, opacity: 1 })

  const ensureTextVisible = (name: string, fallbackColor: string) => {
    const obj = findByNameInObjects(all, name)
    if (!obj) return
    const noFill = isTransparentLikeColorLocal(obj.fill)
    if (noFill) obj.set?.({ fill: fallbackColor })
    if (obj.visible === false) obj.set?.({ visible: true })
  }

  ensureTextVisible('retail_currency_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('retail_integer_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('retail_decimal_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('retail_price_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('retail_unit_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('retail_pack_line_text', hasAuthoredPalette ? palette.retailText : '#ffffff')
  ensureTextVisible('wholesale_banner_text', hasAuthoredPalette ? palette.bannerText : '#111827')
  ensureTextVisible('wholesale_currency_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')
  ensureTextVisible('wholesale_integer_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')
  ensureTextVisible('wholesale_decimal_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')
  ensureTextVisible('wholesale_price_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')
  ensureTextVisible('wholesale_unit_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')
  ensureTextVisible('wholesale_pack_line_text', hasAuthoredPalette ? palette.wholesaleText : '#111827')

  safeAddWithUpdate(priceGroup)
}

const normalizeVisibleScaleLocal = (raw: any, fallback: any, min = 0.08, max = 3.2) => {
  const fallbackNum = Number(fallback)
  const safeFallback = Number.isFinite(fallbackNum) && Math.abs(fallbackNum) > 0 ? fallbackNum : 1
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed === 0) return safeFallback
  const sign = parsed < 0 ? -1 : 1
  const mag = Math.min(max, Math.max(min, Math.abs(parsed)))
  return sign * mag
}

const reviveRedBurstNodeLocal = (
  obj: any,
  opts: { fallbackFill?: string; fallbackFontSize?: number; fallbackText?: string; forceVisible?: boolean } = {}
) => {
  if (!obj || typeof obj.set !== 'function') return false
  let changed = false
  const next: Record<string, any> = {}
  const forceVisible = opts.forceVisible !== false

  if (forceVisible && obj.visible === false) {
    next.visible = true
    changed = true
  }
  const opacity = Number(obj.opacity ?? 1)
  if (!Number.isFinite(opacity) || opacity <= 0) {
    next.opacity = 1
    changed = true
  }

  const restoreScaleX = normalizeVisibleScaleLocal((obj as any).__visibleScaleX ?? (obj as any).__originalScaleX, obj.scaleX)
  const restoreScaleY = normalizeVisibleScaleLocal((obj as any).__visibleScaleY ?? (obj as any).__originalScaleY, obj.scaleY)
  if (!Number.isFinite(Number(obj.scaleX)) || Math.abs(Number(obj.scaleX || 0)) < 0.0001) {
    next.scaleX = restoreScaleX
    changed = true
  }
  if (!Number.isFinite(Number(obj.scaleY)) || Math.abs(Number(obj.scaleY || 0)) < 0.0001) {
    next.scaleY = restoreScaleY
    changed = true
  }

  if (Object.keys(next).length) obj.set(next)

  const type = String(obj.type || '').toLowerCase()
  const isText = type === 'text' || type === 'i-text' || type === 'itext' || type === 'textbox'
  if (isText) {
    const currentFont = Number(obj.fontSize)
    const fallbackFont = Number(opts.fallbackFontSize ?? (obj as any).__originalFontSize ?? currentFont)
    if (!Number.isFinite(currentFont) || currentFont <= 0) {
      obj.set('fontSize', Number.isFinite(fallbackFont) && fallbackFont > 0 ? fallbackFont : 18)
      changed = true
    }
    if (typeof opts.fallbackText === 'string' && !String(obj.text || '').trim()) {
      obj.set('text', opts.fallbackText)
      changed = true
    }
    if (typeof opts.fallbackFill === 'string' && isTransparentLikeColorLocal(obj.fill)) {
      obj.set('fill', opts.fallbackFill)
      changed = true
    }
    obj.initDimensions?.()
  }

  obj.setCoords?.()
  return changed
}

const ensureRedBurstPreviewVisibility = (priceGroup: any) => {
  if (!priceGroup) return
  const all = collectObjectsDeepLocal(priceGroup)
  const byName = (name: string) => findByNameInObjects(all, name)
  const priceBg = byName('price_bg')
  const headerBg = byName('price_header_bg')
  const headerText = byName('price_header_text')
  const burst = byName('price_burst_line_a')
  const currencyText = byName('price_currency_text')
  const richPrice = byName('price_value_text')
  const priceInteger = byName('price_integer_text')
  const priceDecimal = byName('price_decimal_text')
  if (!(priceBg && headerBg && headerText && burst && (richPrice || (priceInteger && priceDecimal)))) return

  let changed = false
  const ensureShellVisible = (obj: any) => {
    if (!obj || typeof obj.set !== 'function') return
    const next: Record<string, any> = {}
    if (obj.visible === false) next.visible = true
    const opacity = Number(obj.opacity ?? 1)
    if (!Number.isFinite(opacity) || opacity <= 0) next.opacity = 1
    if (!Object.keys(next).length) return
    obj.set(next)
    obj.setCoords?.()
    changed = true
  }

  ensureShellVisible(priceBg)
  ensureShellVisible(headerBg)
  changed = reviveRedBurstNodeLocal(headerText, { fallbackFill: '#ffd94c', fallbackFontSize: 28, fallbackText: 'OFERTA' }) || changed
  changed = reviveRedBurstNodeLocal(currencyText, { fallbackFill: '#ffffff', fallbackFontSize: 30, fallbackText: 'R$' }) || changed
  changed = reviveRedBurstNodeLocal(priceInteger || richPrice, { fallbackFill: '#ffffff', fallbackFontSize: 92, fallbackText: '0' }) || changed
  if (priceDecimal) {
    changed = reviveRedBurstNodeLocal(priceDecimal, { fallbackFill: '#ffffff', fallbackFontSize: 44, fallbackText: ',00' }) || changed
  }

  if (changed) safeAddWithUpdate(priceGroup)
}

const getSinglePriceBackgroundCandidateLocal = (priceGroup: any) => {
  const all = collectObjectsDeepLocal(priceGroup)
  const byName = (name: string) => findByNameInObjects(all, name)
  const named = byName('price_bg') || byName('price_bg_image') || byName('splash_image')
  if (named) return named

  const candidates = all.filter((obj: any) => {
    if (!obj || obj === priceGroup) return false
    const type = String(obj?.type || '').toLowerCase()
    if (type !== 'image' && type !== 'rect') return false
    const name = String(obj?.name || '')
    if (name === 'price_currency_bg' || name === 'priceSymbolBg') return false
    if (name.startsWith('atac_') || name.startsWith('retail_') || name.startsWith('wholesale_')) return false
    return true
  })
  if (!candidates.length) return null

  const getArea = (obj: any) => {
    const width = Math.max(1, Number(obj?.width || 0))
    const height = Math.max(1, Number(obj?.height || 0))
    const scaleX = Math.abs(Number(obj?.scaleX ?? (String(obj?.type || '').toLowerCase() === 'image' ? 1 : 0))) || 1
    const scaleY = Math.abs(Number(obj?.scaleY ?? (String(obj?.type || '').toLowerCase() === 'image' ? 1 : 0))) || 1
    const effectiveArea = width * height * scaleX * scaleY
    return Number.isFinite(effectiveArea) && effectiveArea > 0 ? effectiveArea : (width * height)
  }

  return candidates.sort((a: any, b: any) => getArea(b) - getArea(a))[0] || null
}

const getSinglePriceCurrencyTextCandidateLocal = (objects: any[]) =>
  findByNameInObjects(objects, 'price_currency_text') ||
  findByNameInObjects(objects, 'priceSymbol') ||
  findByNameInObjects(objects, 'price_currency')

const getSinglePriceCurrencyCircleCandidateLocal = (objects: any[], currencyTextOverride?: any) => {
  const named = findByNameInObjects(objects, 'price_currency_bg') || findByNameInObjects(objects, 'priceSymbolBg')
  if (named) return named

  const currencyText = currencyTextOverride || getSinglePriceCurrencyTextCandidateLocal(objects)
  if (!currencyText) return null

  const currencyBounds = measureContentBoundsLocal([currencyText])
  if (!currencyBounds) return null

  const currencyCenterX = (currencyBounds.left + currencyBounds.right) / 2
  const currencyCenterY = (currencyBounds.top + currencyBounds.bottom) / 2
  const currencyArea = Math.max(1, currencyBounds.width * currencyBounds.height)
  const bg = objects?.length ? getSinglePriceBackgroundCandidateLocal({ getObjects: () => objects }) : null
  const bgBounds = bg ? measureContentBoundsLocal([bg]) : null
  const bgArea = bgBounds ? Math.max(1, bgBounds.width * bgBounds.height) : Number.POSITIVE_INFINITY

  const candidates = (objects || [])
    .map((obj: any) => {
      if (!obj || obj === currencyText || !isObjectShownForBoundsLocal(obj)) return null
      const type = String(obj?.type || '').toLowerCase()
      const isTextLike = type === 'text' || type === 'i-text' || type === 'itext' || type === 'textbox'
      if (isTextLike) return null

      if (type !== 'circle' && type !== 'ellipse' && type !== 'rect') return null

      const name = String(obj?.name || '')
      if (name === 'price_bg' || name === 'price_bg_image' || name === 'splash_image' || name === 'price_header_bg') return null
      if (name.startsWith('atac_') || name.startsWith('retail_') || name.startsWith('wholesale_')) return null

      const bounds = measureContentBoundsLocal([obj])
      if (!bounds) return null

      const area = Math.max(1, bounds.width * bounds.height)
      const aspectRatio = Math.min(bounds.width, bounds.height) / Math.max(bounds.width, bounds.height)
      if (!Number.isFinite(area) || area < 64) return null
      if (!Number.isFinite(aspectRatio) || aspectRatio < 0.72) return null
      if (Number.isFinite(bgArea) && bgArea > 0 && area >= (bgArea * 0.45)) return null

      const centerX = (bounds.left + bounds.right) / 2
      const centerY = (bounds.top + bounds.bottom) / 2
      const overlapW = Math.max(0, Math.min(currencyBounds.right, bounds.right) - Math.max(currencyBounds.left, bounds.left))
      const overlapH = Math.max(0, Math.min(currencyBounds.bottom, bounds.bottom) - Math.max(currencyBounds.top, bounds.top))
      const overlapRatio = (overlapW * overlapH) / currencyArea
      const containsCenter =
        currencyCenterX >= bounds.left &&
        currencyCenterX <= bounds.right &&
        currencyCenterY >= bounds.top &&
        currencyCenterY <= bounds.bottom
      const distance = Math.hypot(centerX - currencyCenterX, centerY - currencyCenterY)
      const maxDistance = Math.max(bounds.width, bounds.height) * 0.75
      if (!containsCenter && overlapRatio < 0.15 && distance > maxDistance) return null

      const score =
        (containsCenter ? 1000 : 0) +
        (overlapRatio * 500) +
        (aspectRatio * 100) -
        distance

      return { obj, score }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))

  return candidates[0]?.obj || null
}

const ensureSinglePriceCurrencyCircleAnchorLocal = (priceGroup: any) => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null
  const all = collectObjectsDeepLocal(priceGroup)
  const currencyText = getSinglePriceCurrencyTextCandidateLocal(all)
  const currencyCircle = getSinglePriceCurrencyCircleCandidateLocal(all, currencyText)
  if (currencyCircle && typeof currencyCircle.set === 'function' && String(currencyCircle?.name || '') !== 'price_currency_bg') {
    currencyCircle.set('name', 'price_currency_bg')
    currencyCircle.setCoords?.()
  }
  return currencyCircle
}

const hasCollapsedSinglePriceTemplateGeometryLocal = (priceGroup: any) => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
  const all = collectObjectsDeepLocal(priceGroup)
  if (findByNameInObjects(all, 'atac_retail_bg')) return false

  const priceText = findByNameInObjects(all, 'price_value_text') || findByNameInObjects(all, 'smart_price')
  const integer = findByNameInObjects(all, 'price_integer_text') || findByNameInObjects(all, 'priceInteger') || findByNameInObjects(all, 'price_integer')
  const decimal = findByNameInObjects(all, 'price_decimal_text') || findByNameInObjects(all, 'priceDecimal') || findByNameInObjects(all, 'price_decimal')
  if (!(priceText || (integer && decimal))) return false

  const bounds = measureContentBoundsLocal(all.filter((o: any) => o && o !== priceGroup && isObjectShownForBoundsLocal(o)))
  const background = getSinglePriceBackgroundCandidateLocal(priceGroup)
  const backgroundBounds = background ? measureContentBoundsLocal([background]) : null
  const baseW = Number((priceGroup as any).__manualTemplateBaseW)
  const baseH = Number((priceGroup as any).__manualTemplateBaseH)
  const textNodes = [
    findByNameInObjects(all, 'price_currency_text') || findByNameInObjects(all, 'priceSymbol') || findByNameInObjects(all, 'price_currency'),
    integer,
    decimal,
    findByNameInObjects(all, 'price_unit_text') || findByNameInObjects(all, 'priceUnit') || findByNameInObjects(all, 'price_unit'),
    priceText
  ].filter(Boolean) as any[]
  const tinyScales = textNodes.filter((obj: any) => {
    const sx = Math.abs(Number(obj?.scaleX ?? 1))
    const sy = Math.abs(Number(obj?.scaleY ?? 1))
    return sx > 0 && sy > 0 && (sx < 0.02 || sy < 0.02)
  }).length
  const clusteredAtOrigin = textNodes.length > 0 && textNodes.every((obj: any) =>
    Math.abs(Number(obj?.left || 0)) < 0.02 && Math.abs(Number(obj?.top || 0)) < 0.02
  )

  return (
    (Number.isFinite(baseW) && baseW > 0 && baseW <= 2.5) ||
    (Number.isFinite(baseH) && baseH > 0 && baseH <= 2.5) ||
    (!!bounds && (bounds.width < 18 || bounds.height < 10)) ||
    (!!backgroundBounds && (backgroundBounds.width < 18 || backgroundBounds.height < 10)) ||
    (tinyScales >= Math.max(2, textNodes.length - 1) && clusteredAtOrigin)
  )
}

const repairCollapsedSinglePriceTemplateGeometryLocal = (priceGroup: any, reason = 'unknown') => {
  if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
  if (!hasCollapsedSinglePriceTemplateGeometryLocal(priceGroup)) return false

  const all = collectObjectsDeepLocal(priceGroup)
  const background = getSinglePriceBackgroundCandidateLocal(priceGroup)
  const currency = findByNameInObjects(all, 'price_currency_text') || findByNameInObjects(all, 'priceSymbol') || findByNameInObjects(all, 'price_currency')
  const integer = findByNameInObjects(all, 'price_integer_text') || findByNameInObjects(all, 'priceInteger') || findByNameInObjects(all, 'price_integer')
  const decimal = findByNameInObjects(all, 'price_decimal_text') || findByNameInObjects(all, 'priceDecimal') || findByNameInObjects(all, 'price_decimal')
  const unit = findByNameInObjects(all, 'price_unit_text') || findByNameInObjects(all, 'priceUnit') || findByNameInObjects(all, 'price_unit')
  const legacyPrice = findByNameInObjects(all, 'price_value_text') || findByNameInObjects(all, 'smart_price')
  if (!(legacyPrice || (integer && decimal))) return false

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  const reviveNode = (obj: any, opts: { defaultScale?: number; defaultFontSize?: number; defaultText?: string } = {}) => {
    if (!obj || typeof obj.set !== 'function') return
    const defaultScale = Number.isFinite(Number(opts.defaultScale)) ? Number(opts.defaultScale) : 1
    const fallbackScaleX = Number((obj as any).__visibleScaleX ?? (obj as any).__originalScaleX)
    const fallbackScaleY = Number((obj as any).__visibleScaleY ?? (obj as any).__originalScaleY)
    const nextScaleX = Number.isFinite(fallbackScaleX) && Math.abs(fallbackScaleX) >= 0.08 ? Math.abs(fallbackScaleX) : defaultScale
    const nextScaleY = Number.isFinite(fallbackScaleY) && Math.abs(fallbackScaleY) >= 0.08 ? Math.abs(fallbackScaleY) : defaultScale
    const next: Record<string, any> = { visible: true, opacity: 1 }
    if (!Number.isFinite(Number(obj.scaleX)) || Math.abs(Number(obj.scaleX || 0)) < 0.02) next.scaleX = nextScaleX
    if (!Number.isFinite(Number(obj.scaleY)) || Math.abs(Number(obj.scaleY || 0)) < 0.02) next.scaleY = nextScaleY
    obj.set(next)
    const type = String(obj.type || '').toLowerCase()
    if (type === 'text' || type === 'i-text' || type === 'itext' || type === 'textbox') {
      const currentFont = Number(obj.fontSize || 0)
      const fallbackFont = Number((obj as any).__originalFontSize ?? opts.defaultFontSize ?? currentFont)
      if (!Number.isFinite(currentFont) || currentFont <= 0) {
        obj.set('fontSize', Number.isFinite(fallbackFont) && fallbackFont > 0 ? fallbackFont : 18)
      }
      if (typeof opts.defaultText === 'string' && !String(obj.text || '').trim()) obj.set('text', opts.defaultText)
      obj.initDimensions?.()
    }
    obj.setCoords?.()
  }
  const centerObjectsX = (objs: any[], centerX = 0) => {
    const shown = (objs || []).filter((o: any) => isObjectShownForBoundsLocal(o))
    const bounds = measureHorizontalBoundsLocal(shown)
    if (!bounds) return
    const currentCenter = (bounds.left + bounds.right) / 2
    const dx = centerX - currentCenter
    if (Math.abs(dx) < 0.001) return
    shown.forEach((obj: any) => obj?.set?.({ left: Number(obj.left || 0) + dx }))
  }

  reviveNode(background, { defaultScale: 1 })
  reviveNode(currency, { defaultScale: 1, defaultFontSize: 18, defaultText: 'R$' })
  reviveNode(integer, { defaultScale: 1, defaultFontSize: 42, defaultText: '22' })
  reviveNode(decimal, { defaultScale: 1, defaultFontSize: 24, defaultText: ',99' })
  reviveNode(unit, { defaultScale: 1, defaultFontSize: 15, defaultText: 'UN' })
  reviveNode(legacyPrice, { defaultScale: 1, defaultFontSize: 36, defaultText: '22,99' })

  if (background && String(background?.type || '').toLowerCase() === 'image') {
    const name = String(background?.name || '')
    if (!name || name.startsWith('custom_image_')) background.set('name', 'splash_image')
  }

  const unitVisible = isObjectShownForBoundsLocal(unit) && String(unit?.text || '').trim().length > 0
  const rawBgW = Math.max(1, Number(background?.width || 0))
  const rawBgH = Math.max(1, Number(background?.height || 0))
  const measuredChainW = legacyPrice
    ? getScaledWidthLocal(legacyPrice)
    : (getScaledWidthLocal(integer) + getScaledWidthLocal(decimal) + (unitVisible ? Math.max(0, getScaledWidthLocal(unit) - (getScaledWidthLocal(decimal) * 0.2)) : 0))
  const measuredChainH = legacyPrice
    ? getScaledHeightLocal(legacyPrice)
    : Math.max(getScaledHeightLocal(integer), getScaledHeightLocal(decimal) + (unitVisible ? getScaledHeightLocal(unit) * 0.72 : 0))
  const targetH = clamp(Math.max(56, measuredChainH * 1.45), 56, 140)
  const targetW = clamp(Math.max(140, measuredChainW * 1.22 + 26), 140, 360)

  let effectiveW = targetW
  let effectiveH = targetH
  if (background && typeof background.set === 'function') {
    const type = String(background?.type || '').toLowerCase()
    if (type === 'rect') {
      background.set({
        name: 'price_bg',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        width: targetW,
        height: targetH,
        scaleX: 1,
        scaleY: 1
      })
      effectiveW = targetW
      effectiveH = targetH
    } else {
      const scale = clamp(Math.max(targetW / rawBgW, targetH / rawBgH), 0.04, 2.5)
      background.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        visible: true,
        opacity: 1
      })
      effectiveW = rawBgW * scale
      effectiveH = rawBgH * scale
    }
  }

  if (legacyPrice && (!integer || !decimal)) {
    legacyPrice.set({ originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1 })
    const maxLegacyW = Math.max(40, effectiveW * 0.76)
    const legacyW = getScaledWidthLocal(legacyPrice)
    if (legacyW > maxLegacyW && legacyW > 0) {
      const shrink = clamp(maxLegacyW / legacyW, 0.4, 1)
      legacyPrice.set({ scaleX: shrink, scaleY: shrink })
    }
  } else if (integer && decimal) {
    integer.set?.({ originX: 'left', originY: 'center', scaleX: 1, scaleY: 1 })
    decimal.set?.({ originX: 'left', originY: 'center', scaleX: 1, scaleY: 1 })
    if (unit) unit.set?.({ originX: 'center', originY: 'center', visible: unitVisible, scaleX: 1, scaleY: 1 })
    if (currency) currency.set?.({ originX: 'left', originY: 'center', scaleX: 1, scaleY: 1 })
    integer.initDimensions?.()
    decimal.initDimensions?.()
    unit?.initDimensions?.()
    currency?.initDimensions?.()

    const leftPad = clamp(effectiveW * 0.11, 10, 28)
    const rightPad = clamp(effectiveW * 0.08, 8, 24)
    const currencyGap = Math.max(4, effectiveH * 0.028)
    const currencyW = currency ? getScaledWidthLocal(currency) : 0
    const maxTextW = Math.max(36, effectiveW - leftPad - rightPad - (currency ? (currencyW + currencyGap) : 0))
    const intY = effectiveH * 0.03
    const decY = -effectiveH * 0.17
    const unitY = effectiveH * 0.22
    const intX = (-effectiveW / 2) + leftPad + (currency ? (currencyW + currencyGap) : 0)

    layoutPriceLocal({
      integer,
      decimal,
      unit: unitVisible ? unit : undefined,
      intX,
      intY,
      decY,
      unitY,
      maxWidth: maxTextW,
      gapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
      minGapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
      maxGapPx: PRICE_INTEGER_DECIMAL_GAP_PX
    })

    const chain = [integer, decimal, unitVisible ? unit : null].filter(Boolean) as any[]
    const chainBounds = measureHorizontalBoundsLocal(chain)
    if (currency && chainBounds) {
      currency.set({
        originX: 'left',
        originY: 'center',
        left: chainBounds.left - currencyGap - getScaledWidthLocal(currency),
        top: 0
      })
      currency.initDimensions?.()
    }

    const full = [currency, ...chain].filter((o: any) => isObjectShownForBoundsLocal(o))
    centerObjectsX(full, 0)
    ;(priceGroup as any).__manualSingleAnchors = {
      targetCenterX: 0,
      intX: Number(getObjectHorizontalBoundsLocal(integer)?.left ?? integer.left ?? 0),
      intY: Number(integer.top || 0),
      decY: Number(decimal.top || 0),
      unitY: Number(unit?.top || decimal.top || 0),
      currencyY: Number(currency?.top || integer.top || 0),
      intDecGap: PRICE_INTEGER_DECIMAL_GAP_PX,
      currencyGap,
      padLeft: leftPad,
      padRight: rightPad
    }
  }

  ;(priceGroup as any).__manualTemplateBaseW = Math.max(1, effectiveW)
  ;(priceGroup as any).__manualTemplateBaseH = Math.max(1, effectiveH)
  safeAddWithUpdate(priceGroup)
  console.warn('[MiniEditor] single-price template recovered from collapsed geometry', { reason, background: String(background?.name || background?.type || 'none') })
  return true
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

  const minGap = Number.isFinite(Number(opts.minGapPx)) ? Number(opts.minGapPx) : PRICE_INTEGER_DECIMAL_GAP_PX
  const maxGap = Number.isFinite(Number(opts.maxGapPx)) ? Number(opts.maxGapPx) : PRICE_INTEGER_DECIMAL_GAP_PX
  const autoGap = PRICE_INTEGER_DECIMAL_GAP_PX
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
    const raw = (String(obj?.text ?? '').split(/[,.]/, 1)[0] || '').replace(/[^\d]/g, '')
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
    rich?: any
    unit: any
    pack: any
  }) => {
    const { bg, currency, integer, decimal, rich, unit, pack } = opts
    if (!bg || (!rich && (!integer || !decimal))) return

    const valueText = rich || integer
    const digits = getIntegerDigitsCount(valueText)
    const variant = variants[resolveVariantKey(digits)]
    const maxW = getInnerWidth(bg, 0.075, 12, 34)
    const chainMaxW = Math.max(20, maxW * variant.chainWidthRatio)

    restoreBaseScale(integer)
    restoreBaseScale(decimal)
    restoreBaseScale(rich)
    restoreBaseScale(unit)
    restoreBaseScale(currency)

    const intY = Number(valueText?.top || 0)
    const decY = Number(decimal?.top || intY)
    const unitY = Number(unit?.top || decY)
    const unitVisible = isObjectShownForBoundsLocal(unit)

    if (rich && isRichPriceTextObject(rich)) {
      rich.set?.({ originX: 'left', originY: 'center', left: 0, top: intY })
      if (unitVisible) {
        positionRichPriceUnit(rich, unit, unitY)
      }
    } else {
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
        minGapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
        maxGapPx: PRICE_INTEGER_DECIMAL_GAP_PX
      })
    }

    const chain = [valueText, rich ? null : decimal, unitVisible ? unit : null].filter(Boolean) as any[]
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
    if (rich && unitVisible) {
      positionRichPriceUnit(rich, unit, unitY)
      centerObjectsX(full, 0)
    }

    if (pack && isObjectShownForBoundsLocal(pack)) fitText(pack, maxW * variant.packWidthRatio, 0.5)
  }

  const retailCurrency = findByNameInObjects(all, 'retail_currency_text')
  const retailInteger = findByNameInObjects(all, 'retail_integer_text')
  const retailDecimal = findByNameInObjects(all, 'retail_decimal_text')
  const retailRichPrice = findByNameInObjects(all, 'retail_price_text')
  const retailUnit = findByNameInObjects(all, 'retail_unit_text')
  const retailPack = findByNameInObjects(all, 'retail_pack_line_text')
  const wholesaleCurrency = findByNameInObjects(all, 'wholesale_currency_text')
  const wholesaleInteger = findByNameInObjects(all, 'wholesale_integer_text')
  const wholesaleDecimal = findByNameInObjects(all, 'wholesale_decimal_text')
  const wholesaleRichPrice = findByNameInObjects(all, 'wholesale_price_text')
  const wholesaleUnit = findByNameInObjects(all, 'wholesale_unit_text')
  const wholesalePack = findByNameInObjects(all, 'wholesale_pack_line_text')
  const bannerText = findByNameInObjects(all, 'wholesale_banner_text')

  const retailInnerW = getInnerWidth(retailBg, 0.075, 12, 34)
  const wholesaleInnerW = getInnerWidth(wholesaleBg, 0.075, 12, 34)
  const bannerInnerW = getInnerWidth(bannerBg, 0.06, 8, 28)

  applyTierVariant({ bg: retailBg, currency: retailCurrency, integer: retailInteger, decimal: retailDecimal, rich: retailRichPrice, unit: retailUnit, pack: retailPack })
  applyTierVariant({ bg: wholesaleBg, currency: wholesaleCurrency, integer: wholesaleInteger, decimal: wholesaleDecimal, rich: wholesaleRichPrice, unit: wholesaleUnit, pack: wholesalePack })
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
    pick('retail_price_text'),
    pick('retail_unit_text'),
    pick('wholesale_banner_text'),
    pick('wholesale_currency_text'),
    pick('wholesale_integer_text'),
    pick('wholesale_decimal_text'),
    pick('wholesale_price_text'),
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
  migratePriceGroupToRichText(group, fabric)

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
      const setText = (name: string, value: string) => {
        const obj = findObjectByNameDeep(group, name)
        if (!obj) return
        obj.set?.('text', value)
        obj.initDimensions?.()
      }
      const setPrice = (richName: string, integerName: string, decimalName: string, value: string) => {
        const rich = findObjectByNameDeep(group, richName)
        if (rich && isRichPriceTextObject(rich)) {
          applyRichPriceTextValue(rich, value)
          return
        }
        const parts = parsePriceBRLocal(value)
        setText(integerName, parts.integer)
        setText(decimalName, parts.decimal)
      }

      setText('retail_currency_text', 'R$')
      setPrice('retail_price_text', 'retail_integer_text', 'retail_decimal_text', preset.retailPrice)
      setText('retail_unit_text', 'UN')
      setText('retail_pack_line_text', preset.retailPack)
      setText('wholesale_banner_text', preset.banner)
      setText('wholesale_currency_text', 'R$')
      setPrice('wholesale_price_text', 'wholesale_integer_text', 'wholesale_decimal_text', preset.wholesalePrice)
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
  installRichPriceTextRenderer(fabric)
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

const disableManualGroupLayout = (g: any) => {
  disableFabricGroupAutoLayout(g)
}

const refreshManualGroupBounds = (g: any) => refreshFabricGroupBounds(g)

const getManualChildScale = () => {
  const sx = Math.abs(Number(group?.scaleX || 1))
  const sy = Math.abs(Number(group?.scaleY || 1))
  return 1 / Math.max(1, sx, sy)
}

const addManualChild = (obj: any, parent: any = group) => {
  if (!group || !obj || !parent) return false
  disableManualGroupLayout(parent)
  const placement = {
    left: Number(obj.left || 0),
    top: Number(obj.top || 0),
    angle: Number(obj.angle || 0),
    scaleX: Number(obj.scaleX || 1),
    scaleY: Number(obj.scaleY || 1)
  }
  if (typeof parent.add === 'function') parent.add(obj)
  else safeAddWithUpdate(parent, obj)
  obj.set?.(placement)
  obj.setCoords?.()
  refreshManualGroupBounds(parent)
  markObjectTreeDirty(parent)
  return true
}

const bringGroupObjectToFront = (obj: any) => {
  if (!group || !obj || obj === group) return
  const parent = getObjectParent(obj) || (getObjectChildren(group).includes(obj) ? group : null)
  if (!parent) return
  const stack = (parent as any)._objects
  if (Array.isArray(stack)) {
    const index = stack.indexOf(obj)
    if (index >= 0 && index !== stack.length - 1) {
      stack.splice(index, 1)
      stack.push(obj)
      ;(parent as any)._onStackOrderChanged?.(obj)
    }
  } else if (typeof parent.bringObjectToFront === 'function') parent.bringObjectToFront(obj)
  else if (typeof obj.bringToFront === 'function') obj.bringToFront()
  obj.set?.({ visible: true, selectable: true, evented: true })
  markObjectTreeDirty(parent)
}

const enlivenObjectsAsync = (objectsJson: any[]) => {
  if (!fabric?.util?.enlivenObjects) return Promise.resolve([])
  const fn = fabric.util.enlivenObjects
  try {
    const maybe = fn(objectsJson)
    if (maybe && typeof maybe.then === 'function') return maybe
  } catch (_) {
    // Fabric legacy: enlivenObjects nao aceita chamada sem callback.
    // Cai para o caminho com callback abaixo; nao e erro.
  }
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
  migratePriceGroupToRichText(g, fabric)
  disableManualGroupLayout(g)

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
      '__autoCollapseMissingPrices',
      '__atacarejoPalette',
      '__atacarejoLabelVariant',
      '__atacDisplayUnit',
      '__atacPackLineCompact',
      '__atacConditionFormat',
      '__atacValueVariants',
      '__atacVariantGroups',
      '__isCustomTemplate',
      ...MANUAL_TEMPLATE_STABLE_PROPS
    ] as const
    for (const key of rehydrateKeys) {
      if (key in baseGroupJson) {
        ;(g as any)[key] = cloneSafe((baseGroupJson as any)[key])
      }
    }
  }
  MANUAL_TEMPLATE_DERIVED_PROPS.forEach((key) => {
    try { delete (g as any)[key] } catch { /* ignore */ }
  })
  if (!shouldUseAtacVariantSnapshots()) {
    ;(g as any).__atacVariantGroups = {}
  }
  // Never force canonical layout in mini editor; templates are manual.
  ;(g as any).__forceAtacarejoCanonical = false
  repairCollapsedSinglePriceTemplateGeometryLocal(g, `instantiate:${String(tpl?.id || tpl?.name || 'template')}`)

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
  disableManualGroupLayout(g)
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
  ensureRedBurstPreviewVisibility(g)
  ensureSinglePriceCurrencyCircleAnchorLocal(g)
  repairCollapsedSinglePriceTemplateGeometryLocal(g, 'serialize')
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
  ;[
    '__autoCollapseMissingPrices',
    '__atacarejoPalette',
    '__atacarejoLabelVariant',
    '__atacDisplayUnit',
    '__atacPackLineCompact',
    '__atacConditionFormat'
  ].forEach((key) => {
    if (key in (g as any)) json[key] = cloneSafe((g as any)[key])
  })
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
  // Derived layout caches are recomputed from the authored geometry on apply/open.
  MANUAL_TEMPLATE_DERIVED_PROPS.forEach((key) => {
    delete json[key]
  })

  g.set(prev)
  safeAddWithUpdate(g)

  delete json.layoutManager
  delete json.layout

  // Match the template metadata used by the main editor so proportional scaling works.
  json.__isCustomTemplate = true
  // This template was explicitly edited in the mini editor.
  // Preserve manual element positions on canvas reload/apply.
  json.__preserveManualLayout = true
  const stack = Array.isArray(json.objects) ? [...json.objects] : []
  while (stack.length) {
    const obj: any = stack.pop()
    if (!obj) continue
    if (Array.isArray(obj?.objects)) {
      for (let i = obj.objects.length - 1; i >= 0; i--) stack.push(obj.objects[i])
    }
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
}

const setAutoCollapseMissingPrices = (enabled: boolean) => {
  if (!group || !isAtacarejoTemplate.value) return
  ;(group as any).__autoCollapseMissingPrices = enabled
  group.dirty = true
  group.setCoords?.()
  updateKey.value++
  queueRender()
  recordHistorySnapshot('autoCollapseMissingPrices')
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
const hasUnsavedChanges = computed(() => (
  (!!historyFingerprint.value && historyFingerprint.value !== savedHistoryFingerprint.value) ||
  editorName.value.trim() !== savedEditorName.value.trim()
))

const requestClose = (): boolean => {
  if (isSaving.value) return false
  if (hasUnsavedChanges.value && typeof window !== 'undefined') {
    const shouldDiscard = window.confirm('Existem alterações não salvas nesta etiqueta. Deseja sair mesmo assim?')
    if (!shouldDiscard) return false
  }
  emit('close')
  return true
}

defineExpose({ requestClose })

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
  const target = selectedObj.value && selectedObj.value !== group
    ? selectedObj.value
    : (canvas.getActiveObject?.() || group)
  if (!target || typeof target.set !== 'function') return
  target.set({
    left: Number(target.left || 0) + dx,
    top: Number(target.top || 0) + dy
  })
  target.setCoords?.()
  if (target !== group && getDirectChildOfEditorGroup(target)) markObjectTreeDirty(target)
  queueRender()
  queueHistorySnapshot('keyboard-move', 140)
}

const scaleSelection = (factor: number) => {
  if (!canvas) return
  const target = selectedObj.value && selectedObj.value !== group
    ? selectedObj.value
    : (canvas.getActiveObject?.() || group)
  if (!target || typeof target.set !== 'function') return
  const currentScaleX = Number(target.scaleX || 1)
  const currentScaleY = Number(target.scaleY || 1)
  const nextScaleX = Math.max(0.05, Math.min(12, currentScaleX * factor))
  const nextScaleY = Math.max(0.05, Math.min(12, currentScaleY * factor))
  target.set({ scaleX: nextScaleX, scaleY: nextScaleY })
  target.setCoords?.()
  if (target !== group && getDirectChildOfEditorGroup(target)) markObjectTreeDirty(target)
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

  if (key === 'escape') {
    e.preventDefault()
    requestClose()
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
  const palette = (priceGroup as any).__atacarejoPalette
    ? resolveFardoSpecialPricePalette((priceGroup as any).__atacarejoPalette)
    : {
      retailBg: '#ef4444',
      bannerBg: '#ffffff',
      wholesaleBg: '#fde047',
      retailText: '#ffffff',
      bannerText: '#000000',
      wholesaleText: '#000000'
    }

  const retailCurrency = findByNameInObjects(all, 'retail_currency_text')
  const retailInteger = findByNameInObjects(all, 'retail_integer_text')
  const retailDecimal = findByNameInObjects(all, 'retail_decimal_text')
  const retailRichPrice = findByNameInObjects(all, 'retail_price_text')
  const retailUnit = findByNameInObjects(all, 'retail_unit_text')
  const retailPack = findByNameInObjects(all, 'retail_pack_line_text')

  const bannerText = findByNameInObjects(all, 'wholesale_banner_text')

  const wholesaleCurrency = findByNameInObjects(all, 'wholesale_currency_text')
  const wholesaleInteger = findByNameInObjects(all, 'wholesale_integer_text')
  const wholesaleDecimal = findByNameInObjects(all, 'wholesale_decimal_text')
  const wholesaleRichPrice = findByNameInObjects(all, 'wholesale_price_text')
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
    setVisibleForEditor(retailRichPrice, true)
    setVisibleForEditor(retailUnit, true)
  }

  setVisibleForEditor(retailBg, showRetail)
  setVisibleForEditor(retailCurrency, showRetail)
  setVisibleForEditor(retailInteger, showRetail)
  setVisibleForEditor(retailDecimal, showRetail)
  setVisibleForEditor(retailRichPrice, showRetail)
  setVisibleForEditor(retailUnit, showRetail)
  setVisibleForEditor(retailPack, showRetail && String(retailPack?.text || '').trim().length > 0)

  setVisibleForEditor(wholesaleBg, showWholesale)
  setVisibleForEditor(wholesaleCurrency, showWholesale)
  setVisibleForEditor(wholesaleInteger, showWholesale)
  setVisibleForEditor(wholesaleDecimal, showWholesale)
  setVisibleForEditor(wholesaleRichPrice, showWholesale)
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

  if (showRetail) setBg(retailBg, retailH, centers.retail, clamp(retailH * 0.22, 10, 28), palette.retailBg)
  if (showBanner && bannerBg) setBg(bannerBg, bannerH, centers.banner, clamp(bannerH * 0.48, 8, 20), palette.bannerBg)
  if (showWholesale) setBg(wholesaleBg, wholesaleH, centers.wholesale, clamp(wholesaleH * 0.22, 10, 28), palette.wholesaleBg)

  const layoutTier = (tier: {
    blockH: number
    blockCY: number
    currency: any
    integer: any
    decimal: any
    rich?: any
    unit: any
    pack: any
    color: string
    emphasis?: 'normal' | 'high'
  }) => {
    const { blockH, blockCY, currency, integer, decimal, rich, unit, pack, color, emphasis } = tier
    if (!blockH || !Number.isFinite(blockH)) return
    const valueText = rich || integer
    const decimalText = rich ? null : decimal

    const maxPriceW = totalW - (padX * 2)
    const currencyGap = clamp(blockH * 0.045, 2, 9)
    const integerDecimalGap = PRICE_INTEGER_DECIMAL_GAP_PX
    const isHigh = emphasis === 'high'
    const integerScale = isHigh ? 0.72 : 0.60
    const decimalScale = isHigh ? 0.38 : 0.31
    const currencyScale = isHigh ? 0.26 : 0.21
    const unitScale = isHigh ? 0.27 : 0.22
    const packScale = isHigh ? 0.17 : 0.155

    if (rich && isRichPriceTextObject(rich)) {
      setRichPriceBaseFontSize(rich, Math.max(8, blockH * (isHigh ? 0.72 : 0.60)))
      setRichPriceSegmentStyle(rich, 'integer', { fill: color })
      setRichPriceSegmentStyle(rich, 'decimal', { fill: color })
      rich.set?.({ fill: color, scaleX: 1, scaleY: 1 })
    } else {
      setTextSizing(integer, integerScale, blockH, color)
      setTextSizing(decimal, decimalScale, blockH, color)
    }
    setTextSizing(currency, currencyScale, blockH, color)
    setTextSizing(unit, unitScale, blockH, color)
    setTextSizing(pack, packScale, blockH, color)

    const packVisible = isShown(pack) && String(pack?.text || '').trim().length > 0
    const unitVisible = isShown(unit) && String(unit?.text || '').trim().length > 0

    let centsBlockW = unitVisible ? Math.max(getScaledWidthLocal(decimalText), getScaledWidthLocal(unit)) : getScaledWidthLocal(decimalText)
    let priceW = getScaledWidthLocal(currency) + currencyGap + getScaledWidthLocal(valueText) + (rich ? 0 : integerDecimalGap) + centsBlockW
    if (priceW > maxPriceW && priceW > 0) {
      const s = Math.max(isHigh ? 0.65 : 0.58, maxPriceW / priceW)
      ;[currency, valueText, decimalText, unit].forEach((t: any) => t?.set?.({ scaleX: s, scaleY: s }))
      centsBlockW = unitVisible ? Math.max(getScaledWidthLocal(decimalText), getScaledWidthLocal(unit)) : getScaledWidthLocal(decimalText)
      priceW = getScaledWidthLocal(currency) + currencyGap + getScaledWidthLocal(valueText) + (rich ? 0 : integerDecimalGap) + centsBlockW
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

    const unitY = intY + (blockH * (isHigh ? 0.26 : 0.22))
    if (rich && isRichPriceTextObject(rich)) {
      rich.set({ originX: 'left', originY: 'center', left: intX, top: intY })
      if (unitVisible) {
        positionRichPriceUnit(rich, unit, unitY)
      }
    } else {
      layoutPriceLocal({
        integer,
        decimal,
        unit: unitVisible ? unit : undefined,
        intX,
        intY,
        decY,
        unitY,
        maxWidth: Math.max(20, maxPriceW - (curW + currencyGap)),
        gapPx: integerDecimalGap,
        minGapPx: integerDecimalGap,
        maxGapPx: integerDecimalGap
      })
    }

    const chainBounds = measureHorizontalBoundsLocal([currency, valueText, decimalText, unitVisible ? unit : null].filter(Boolean) as any[])
    if (chainBounds) {
      const chainCenterX = (chainBounds.left + chainBounds.right) / 2
      const dx = -chainCenterX
      if (Math.abs(dx) > 0.001) {
        ;[currency, valueText, decimalText, unitVisible ? unit : null].forEach((obj: any) => {
          if (!obj || typeof obj.set !== 'function') return
          obj.set({ left: Number(obj.left || 0) + dx })
        })
      }
    }

    const chainObjects = [currency, valueText, decimalText, unitVisible ? unit : null].filter(Boolean)
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
      rich: retailRichPrice,
      unit: retailUnit,
      pack: retailPack,
      color: palette.retailText,
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
      rich: wholesaleRichPrice,
      unit: wholesaleUnit,
      pack: wholesalePack,
      color: palette.wholesaleText,
      emphasis: 'high'
    })
  }

  if (showBanner && bannerText) {
    setTextSizing(bannerText, 0.58, bannerH, palette.bannerText)
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

  migratePriceGroupToRichText(g, fabric)
  // Normalize group transform so it doesn't open off-screen.
  g.set({ originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0 })
  repairCollapsedSinglePriceTemplateGeometryLocal(g, 'normalize-editor')

  const all: any[] = g.getObjects()

  // ===== ATACAREJO TEMPLATE SUPPORT =====
  // Check if this is an atacarejo (2-price) template by looking for the retail background
  const retailBg = all.find(o => o?.name === 'atac_retail_bg')
  const isAtacarejo = !!retailBg

  if (isAtacarejo) {
    layoutAtacarejoCanonicalForEditor(g)
    return
  }

  ensureRedBurstPreviewVisibility(g)

  // ===== STANDARD SINGLE-PRICE TEMPLATE =====
  const priceBg = all.find(o => o?.name === 'price_bg')
  const img = all.find(o => o?.name === 'price_bg_image' || o?.name === 'splash_image')
  const currencyCircle = ensureSinglePriceCurrencyCircleAnchorLocal(g)
  const currencyText = getSinglePriceCurrencyTextCandidateLocal(all)
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
  const viewportTransform = Array.isArray(canvas.viewportTransform)
    ? canvas.viewportTransform
    : [1, 0, 0, 1, 0, 0]
  const viewportZoom = Math.max(
    0.01,
    Math.abs(Number(canvas.getZoom?.() || viewportTransform[0] || 1))
  )
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
  // Fabric stores object coordinates in scene space while zoom changes the
  // viewport transform. Fit against scene-space dimensions so "Centralizar"
  // remains correct after the user zooms in or out.
  const sceneWidth = cw / viewportZoom
  const sceneHeight = ch / viewportZoom
  const rawScale = Math.min((sceneWidth * 0.9) / bw, (sceneHeight * 0.85) / bh)
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

  const translateX = Number(viewportTransform[4] || 0)
  const translateY = Number(viewportTransform[5] || 0)
  const sceneCenterX = ((cw / 2) - translateX) / viewportZoom
  const sceneCenterY = ((ch / 2) - translateY) / viewportZoom

  group.set({
    originX: 'center',
    originY: 'center',
    left: sceneCenterX - (centerX * scale),
    top: sceneCenterY - (centerY * scale),
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
  if (repairCollapsedSinglePriceTemplateGeometryLocal(g, 'recover-editor')) {
    safeAddWithUpdate(g)
    return
  }
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
  savedHistoryFingerprint.value = ''
  editorError.value = null
  editorName.value = props.template.name || ''
  savedEditorName.value = editorName.value.trim()
  selectedObj.value = null
  cornersLinked.value = true
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
    // Aguarda o decode real dos pixels (WebP/imagem remota) antes de recortar.
    // Sem isso, detectImageTrimBounds le um canvas vazio e o auto-trim da imagem
    // de fundo do preco (splash_image) nao e aplicado ao abrir o editor.
    await waitForLabelImagesDecoded(group)
    trimCustomLabelImages(group)
    fitExistingLabelBackgroundImages()
    refreshManualGroupBounds(group)

    canvas.add(group)
    canvas.setActiveObject(group)
    resizeCanvasToViewport()
    fitToViewport()
    canvas.requestRenderAll()
    recordHistorySnapshot('loadTemplate')
    savedHistoryFingerprint.value = historyFingerprint.value
    savedEditorName.value = editorName.value.trim()
  } catch (error) {
    group = null
    selectedObj.value = null
    canvas.clear()
    reportEditorError(error, 'Não foi possível abrir esta etiqueta. Verifique se o modelo contém dados válidos.')
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
  syncTextSelectionState(selectedObj.value)
  updateKey.value++
}

const patch = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) {
    return
  }

  const numericLimits: Record<string, { min?: number; max?: number }> = {
    left: { min: -100000, max: 100000 },
    top: { min: -100000, max: 100000 },
    scaleX: { min: 0.01, max: 100 },
    scaleY: { min: 0.01, max: 100 },
    angle: { min: -36000, max: 36000 },
    opacity: { min: 0, max: 1 },
    strokeWidth: { min: 0, max: 1000 },
    width: { min: 1, max: 100000 },
    height: { min: 1, max: 100000 },
    rx: { min: 0, max: 100000 },
    ry: { min: 0, max: 100000 },
    radius: { min: 1, max: 100000 },
    fontSize: { min: 1, max: 2000 },
    fontWeight: { min: 100, max: 1000 },
    lineHeight: { min: 0.1, max: 10 },
    charSpacing: { min: -1000, max: 1000 }
  }
  const limits = numericLimits[prop]
  if (limits) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return
    value = Math.min(limits.max ?? numericValue, Math.max(limits.min ?? numericValue, numericValue))
  }

  // Fabric.Image doesn't render `stroke` / `strokeWidth`.
  // In label templates, the splash image is usually clipped by (and sits on top of)
  // the `price_bg` rect, which should carry the border and fill.
  const isProxiedProp = prop === 'fill' || prop === 'stroke' || prop === 'strokeWidth' || prop.startsWith('stroke') || prop === 'rx' || prop === 'ry' || prop === 'width' || prop === 'height'
  const isSplashImage = obj?.type === 'image' && (obj?.name === 'price_bg_image' || obj?.name === 'splash_image')
  const isPriceGroup = obj?.type === 'group' && (obj === group || obj?.name === 'priceGroup')
  const isRichPriceText = isRichPriceTextObject(obj)
  const richStyleProps = new Set([
    'fontFamily',
    'fontWeight',
    'fill',
    'stroke',
    'strokeWidth',
    'fontStyle',
    'underline',
    'linethrough',
    'overline',
    'charSpacing'
  ])

  let proxyTarget = obj
  if (isProxiedProp && (isSplashImage || isPriceGroup) && group) {
    const bg = findObjectByNameDeep(group, 'price_bg')
    if (bg) {
      proxyTarget = bg
    }
  }

  // A rich price is one IText with per-character styles. Keep both value
  // ranges synchronized when the generic typography controls are used.
  if (isRichPriceText && prop === 'text') {
    applyRichPriceTextValue(obj, value)
  } else if (isRichPriceText && prop === 'fontSize') {
    setRichPriceBaseFontSize(obj, Number(value))
  } else if (isRichPriceText && richStyleProps.has(prop)) {
    setRichPriceSegmentStyle(obj, 'integer', { [prop]: value })
    setRichPriceSegmentStyle(obj, 'decimal', { [prop]: value })
    obj.set(prop, value)
  } else {
    // Use set() method which handles all internal updates
    proxyTarget.set(prop, value)
  }

  // Persist responsive-layout knobs for the price pill.
  if (proxyTarget?.name === 'price_bg' && (prop === 'strokeWidth' || prop === 'rx' || prop === 'ry')) {
    const n = Number(value)
    if (Number.isFinite(n)) (proxyTarget as any)[`__${prop}`] = n
  }

  // Cantos individuais: ao setar __cornerTL/TR/BL/BR, marca dirty e persiste.
  if (proxyTarget?.name === 'price_bg' && prop.startsWith('__corner')) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) {
      (proxyTarget as any)[prop] = n
    } else {
      delete (proxyTarget as any)[prop]
    }
  }

  // Force dirty flag for proper re-rendering
  proxyTarget.dirty = true

  // Handle text objects
  if (proxyTarget.type === 'textbox' && typeof proxyTarget.initDimensions === 'function') proxyTarget.initDimensions()
  if (proxyTarget.type?.includes('text') && typeof proxyTarget.initDimensions === 'function') proxyTarget.initDimensions()

  // CRITICAL: nested label groups are valid Fabric trees. Updating only the
  // direct child used to leave parent bounds/cache stale, so the next save or
  // reload could move the edited item back or make it disappear.
  if (getDirectChildOfEditorGroup(proxyTarget)) {
    markObjectTreeDirty(proxyTarget)
    if (group) safeAddWithUpdate(group)
  }

  // A splash image delegates its dimensions/radius to price_bg. Re-fit the
  // image immediately so changing the pill does not leave an old crop/clip.
  if (
    proxyTarget?.name === 'price_bg' &&
    ['width', 'height', 'rx', 'ry'].includes(prop)
  ) {
    const backgroundImage = findObjectByNameDeep(group, 'price_bg_image') || findObjectByNameDeep(group, 'splash_image')
    if (backgroundImage) fitImageAsLabelBackground(backgroundImage)
  }

  // Update coordinates
  if (typeof proxyTarget.setCoords === 'function') proxyTarget.setCoords()

  // Also update the main group coords if needed
  markObjectTreeDirty(proxyTarget)

  // Render
  canvas.requestRenderAll()
  updateKey.value++ // Force reactivity

  recordHistorySnapshot(`patch:${prop}`)
}

// Helper: obtém o target price_bg (com proxy de splash/group)
const getPriceBgTarget = () => {
  const obj = selectedObj.value
  if (!obj) return null
  const isSplashImage = obj?.type === 'image' && (obj?.name === 'price_bg_image' || obj?.name === 'splash_image')
  const isPriceGroup = obj?.type === 'group' && (obj === group || obj?.name === 'priceGroup')
  if (isSplashImage || isPriceGroup) {
    return group ? findObjectByNameDeep(group, 'price_bg') : null
  }
  if (obj?.name === 'price_bg') return obj
  return null
}

// Lê o valor de um canto individual do price_bg
const getCornerValue = (cornerProp: string): number => {
  updateKey.value // Track for reactivity
  const bg = getPriceBgTarget()
  if (!bg) return Number(current('rx', 0))
  const val = (bg as any)[cornerProp]
  if (typeof val === 'number' && val >= 0) return val
  // Fallback: usa rx uniforme
  return Number(bg.rx || 0)
}

// Aplica canto individual no price_bg
const patchCorner = (cornerProp: string, value: number) => {
  const bg = getPriceBgTarget()
  if (!bg || !canvas) return
  const n = Math.max(0, Number(value) || 0);
  (bg as any)[cornerProp] = n
  bg.dirty = true
  if (group) {
    markObjectTreeDirty(bg)
    safeAddWithUpdate(group)
  }
  canvas.requestRenderAll()
  updateKey.value++
  recordHistorySnapshot(`patchCorner:${cornerProp}`)
}

const patchCustom = (prop: string, value: any) => {
  const obj = selectedObj.value
  if (!obj || !canvas) return
  obj[prop] = value
  if (obj.type?.includes('text') && typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  if (typeof obj.setCoords === 'function') obj.setCoords()
  markObjectTreeDirty(obj)
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

const solidFillColor = () => {
  const fill = current('fill', '#ffffff')
  return typeof fill === 'string' ? fill : (fill?.colorStops?.[0]?.color || '#ffffff')
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
  if (isRichPriceTextObject(obj)) applyRichPriceTextValue(obj, next)
  else obj.set('text', next)
  obj.__textCase = mode
  obj.dynamicTextCase = mode
  if (typeof obj.initDimensions === 'function') obj.initDimensions()
  if (obj.group && typeof obj.group.triggerLayout === 'function') obj.group.triggerLayout()
  markObjectTreeDirty(obj)
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
const isRichPriceText = computed(() => isRichPriceTextObject(selectedObj.value))

const richPriceSegmentSize = (segment: 'integer' | 'decimal', fallback: number) => {
  updateKey.value
  return Math.round(getRichPriceSegmentFontSize(selectedObj.value, segment, fallback))
}

const setRichPriceSegmentFontSize = (segment: 'integer' | 'decimal', rawValue: unknown) => {
  const obj = selectedObj.value
  if (!obj || !canvas || !isRichPriceTextObject(obj)) return
  const value = Math.min(320, Math.max(6, Number(rawValue) || 6))
  setRichPriceSegmentStyle(obj, segment, { fontSize: value })
  obj.dirty = true
  obj.group?.setCoords?.()
  obj.setCoords?.()
  canvas.requestRenderAll()
  updateKey.value++
  recordHistorySnapshot(`richPrice:${segment}:fontSize`)
}

const richPriceSegmentOffset = (
  segment: 'integer' | 'decimal',
  axis: 'x' | 'y',
  fallback = 0
) => {
  updateKey.value
  return Number(getRichPriceSegmentOffset(selectedObj.value, segment, axis) || fallback)
}

const setRichPriceSegmentOffsetValue = (
  segment: 'integer' | 'decimal',
  axis: 'x' | 'y',
  rawValue: unknown
) => {
  const obj = selectedObj.value
  if (!obj || !canvas || !isRichPriceTextObject(obj)) return
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return
  const value = Math.min(240, Math.max(-240, parsed))
  if (!setRichPriceSegmentOffset(obj, segment, axis, value)) return
  markObjectTreeDirty(obj)
  canvas.requestRenderAll?.()
  updateKey.value++
  recordHistorySnapshot(`richPrice:${segment}:offset:${axis}`)
}

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
const isBackgroundImageObject = (obj: any) => {
  const name = String(obj?.name || '').trim()
  return obj?.type === 'image' && (
    name === 'label_bg_image' ||
    name === 'price_bg_image' ||
    name === 'splash_image'
  )
}
const isBackgroundImageSelected = computed(() => isBackgroundImageObject(selectedObj.value))
const isAtacarejoTemplate = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateKey.value
  return !!findObjectByNameDeep(group, 'atac_retail_bg')
})
const autoCollapseMissingPrices = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  updateKey.value
  return !group || (group as any).__autoCollapseMissingPrices !== false
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

const syncTextSelectionState = (obj: any = selectedObj.value) => {
  if (!isTextLikeObject(obj)) {
    textRangeStart.value = 0
    textRangeEnd.value = 0
    textRangeIsActive.value = false
    return
  }

  const length = String(obj?.text || '').length
  const editingStart = Number(obj?.selectionStart)
  const editingEnd = Number(obj?.selectionEnd)
  const hasEditingSelection = !!obj?.isEditing && Number.isFinite(editingStart) && Number.isFinite(editingEnd)
  const start = hasEditingSelection
    ? Math.min(length, Math.max(0, editingStart))
    : 0
  const end = hasEditingSelection
    ? Math.min(length, Math.max(start, editingEnd))
    : length

  textRangeStart.value = start
  textRangeEnd.value = end
  textRangeIsActive.value = hasEditingSelection && end > start
  const fill = extractColorStringFromFill(obj?.fill)
  if (fill && /^#[0-9a-f]{6}$/i.test(fill)) textSegmentColor.value = fill
  updateKey.value++
}

const getTextRangeForColor = (obj: any) => {
  const length = String(obj?.text || '').length
  if (!length) return { start: 0, end: 0 }

  const liveStart = Number(obj?.selectionStart)
  const liveEnd = Number(obj?.selectionEnd)
  if (obj?.isEditing && Number.isFinite(liveStart) && Number.isFinite(liveEnd) && liveEnd > liveStart) {
    return {
      start: Math.min(length, Math.max(0, liveStart)),
      end: Math.min(length, Math.max(0, liveEnd))
    }
  }

  const start = Math.min(length, Math.max(0, Number(textRangeStart.value) || 0))
  const requestedEnd = Number(textRangeEnd.value)
  const end = Math.min(length, Math.max(start, Number.isFinite(requestedEnd) ? requestedEnd : length))
  return end > start ? { start, end } : { start: 0, end: length }
}

const applyTextColorRange = (obj: any, color: string, start: number, end: number) => {
  if (!isTextLikeObject(obj) || !color || end <= start) return false

  // Rich price text has two dynamic segments. Keep their persisted segment
  // styles in sync so a future product-price refresh does not erase colors.
  if (isRichPriceTextObject(obj)) {
    const commaIndex = String(obj.text || '').indexOf(',')
    if (commaIndex < 0 || start < commaIndex) setRichPriceSegmentStyle(obj, 'integer', { fill: color })
    if (commaIndex >= 0 && end > commaIndex) setRichPriceSegmentStyle(obj, 'decimal', { fill: color })
  }

  if (typeof obj.setSelectionStyles === 'function') {
    obj.setSelectionStyles({ fill: color }, start, end)
  } else {
    const styles = obj.styles && typeof obj.styles === 'object' ? obj.styles : {}
    styles[0] ||= {}
    for (let index = start; index < end; index++) {
      styles[0][index] = { ...(styles[0][index] || {}), fill: color }
    }
    obj.styles = styles
  }
  obj.dirty = true
  obj.initDimensions?.()
  obj.setCoords?.()
  return true
}

const finishTextColorChange = (obj: any, reason: string) => {
  if (!obj || !canvas) return
  markObjectTreeDirty(obj)
  obj.dirty = true
  obj.setCoords?.()
  canvas.requestRenderAll?.()
  updateKey.value++
  recordHistorySnapshot(reason)
}

const applyTextSegmentColor = () => {
  const obj = selectedObj.value
  if (!isTextLikeObject(obj)) return
  const range = getTextRangeForColor(obj)
  if (!applyTextColorRange(obj, textSegmentColor.value, range.start, range.end)) return
  textRangeStart.value = range.start
  textRangeEnd.value = range.end
  finishTextColorChange(obj, 'textSegmentColor')
}

const applyTextColorToWhole = () => {
  const obj = selectedObj.value
  if (!isTextLikeObject(obj)) return
  const length = String(obj.text || '').length
  if (!length) return
  obj.set?.('fill', textSegmentColor.value)
  applyTextColorRange(obj, textSegmentColor.value, 0, length)
  finishTextColorChange(obj, 'textWholeColor')
}

const applyTwoTextColors = () => {
  const obj = selectedObj.value
  if (!isTextLikeObject(obj)) return
  const length = String(obj.text || '').length
  if (length < 2) {
    applyTextColorToWhole()
    return
  }
  const splitAt = Math.max(1, Math.ceil(length / 2))
  const firstColor = extractColorStringFromFill(obj.fill) || '#ffffff'
  obj.set?.('fill', firstColor)
  applyTextColorRange(obj, firstColor, 0, splitAt)
  applyTextColorRange(obj, textSecondColor.value, splitAt, length)
  textRangeStart.value = splitAt
  textRangeEnd.value = length
  finishTextColorChange(obj, 'textTwoColors')
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
  const customTextCount = (group.getObjects?.() || []).filter((item: any) => isTextLikeObject(item) && String(item?.name || '').startsWith('custom_text_')).length
  // O grupo ja chega escalado para caber no canvas. Posicoes muito grandes aqui
  // sao multiplicadas pela escala do grupo e acabam fora da etiqueta.
  const designWidth = Math.max(120, Number(group?.width || 220))
  const designHeight = Math.max(100, Number(group?.height || 180))
  const spreadX = Math.max(10, Math.min(26, designWidth * 0.06))
  const rowHeight = Math.max(16, Math.min(28, designHeight * 0.08))
  const topOffset = -Math.max(6, Math.min(16, Math.round(designHeight * 0.04)))
  const txt = new fabric.IText('Novo texto', {
    left: ((customTextCount % 3) - 1) * spreadX,
    top: topOffset + Math.floor(customTextCount / 3) * rowHeight,
    originX: 'center',
    originY: 'center',
    fontSize: Math.max(10, Number(baseText?.fontSize || 28)),
    fontFamily: String(baseText?.fontFamily || 'Inter'),
    fontWeight: baseText?.fontWeight || '700',
    fill: extractColorStringFromFill(baseText?.fill) || getDefaultAddTextFill(),
    textAlign: String(baseText?.textAlign || 'center'),
    lineHeight: Math.max(0.8, Number(baseText?.lineHeight || 1)),
    charSpacing: Number(baseText?.charSpacing || 0),
    scaleX: getManualChildScale(),
    scaleY: getManualChildScale(),
    name: `custom_text_${makeId()}`
  })
  addManualChild(txt)
  bringGroupObjectToFront(txt)
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
    scaleX: getManualChildScale(),
    scaleY: getManualChildScale(),
    name: `custom_rect_${makeId()}`
  })
  addManualChild(rect)
  bringGroupObjectToFront(rect)
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
    scaleX: getManualChildScale(),
    scaleY: getManualChildScale(),
    name: `custom_circle_${makeId()}`
  })
  addManualChild(c)
  bringGroupObjectToFront(c)
  canvas.setActiveObject(c)
  setSelected()
  canvas.requestRenderAll()
  recordHistorySnapshot('addCircle')
}

const getLabelBackgroundShape = () => {
  if (!group) return null
  return findObjectByNameDeep(group, 'price_bg') ||
    findObjectByNameDeep(group, 'atac_retail_bg') ||
    findObjectByNameDeep(group, 'atac_wholesale_bg') ||
    findObjectByNameDeep(group, 'atac_banner_bg')
}

const getImageNaturalDimensions = (img: any) => {
  const element: any = img?._originalElement || img?._element
  return {
    width: Math.max(1, Number(element?.naturalWidth || element?.width || img?.width || 1)),
    height: Math.max(1, Number(element?.naturalHeight || element?.height || img?.height || 1))
  }
}

const fitImageAsLabelBackground = (
  img: any,
  options: { baseBounds?: { left: number; right: number; top: number; bottom: number; width: number; height: number } | null } = {}
) => {
  if (!img || !group) return false
  const hasPriceBackground = !!findObjectByNameDeep(group, 'price_bg')
  const isFullLabelBackground = String(img?.name || '') === 'label_bg_image' && !hasPriceBackground
  const background = isFullLabelBackground ? null : getLabelBackgroundShape()
  const storedBaseWidth = Number((group as any).__manualTemplateBaseW || 0)
  const storedBaseHeight = Number((group as any).__manualTemplateBaseH || 0)
  const stableFullLabelBounds = !hasPriceBackground &&
    Number.isFinite(storedBaseWidth) && storedBaseWidth > 0 &&
    Number.isFinite(storedBaseHeight) && storedBaseHeight > 0
    ? {
        left: -storedBaseWidth / 2,
        right: storedBaseWidth / 2,
        top: -storedBaseHeight / 2,
        bottom: storedBaseHeight / 2,
        width: storedBaseWidth,
        height: storedBaseHeight
      }
    : null
  const baseBounds = options.baseBounds || getLabelVisualBaseBounds()
  const backgroundBounds = background ? measureContentBoundsLocal([background]) : null
  const targetBounds = backgroundBounds || (isFullLabelBackground && stableFullLabelBounds) || baseBounds
  const backgroundScaleX = Math.abs(Number(background?.scaleX || 1))
  const backgroundScaleY = Math.abs(Number(background?.scaleY || 1))
  const backgroundWidth = targetBounds
    ? Math.max(1, Number(targetBounds.width || 0))
    : Math.max(1, Number((group as any).__manualTemplateBaseW || group.width || 300))
  const backgroundHeight = targetBounds
    ? Math.max(1, Number(targetBounds.height || 0))
    : Math.max(1, Number((group as any).__manualTemplateBaseH || group.height || 220))
  const dimensions = getImageNaturalDimensions(img)
  const visibleBounds = detectImageTrimBounds(img, {
    alphaThreshold: LABEL_IMAGE_TRIM_ALPHA_THRESHOLD,
    padding: 0
  })
  const sourceLeft = Math.max(0, Number(visibleBounds?.left || 0))
  const sourceTop = Math.max(0, Number(visibleBounds?.top || 0))
  const sourceWidth = Math.max(1, Number(visibleBounds?.width || dimensions.width))
  const sourceHeight = Math.max(1, Number(visibleBounds?.height || dimensions.height))
  const imageScale = Math.max(backgroundWidth / sourceWidth, backgroundHeight / sourceHeight)
  const cropWidth = Math.min(sourceWidth, backgroundWidth / Math.max(0.0001, imageScale))
  const cropHeight = Math.min(sourceHeight, backgroundHeight / Math.max(0.0001, imageScale))
  const cropX = sourceLeft + Math.max(0, (sourceWidth - cropWidth) / 2)
  const cropY = sourceTop + Math.max(0, (sourceHeight - cropHeight) / 2)
  const radiusX = Math.max(0, Number(background?.rx || 0) * backgroundScaleX)
  const radiusY = Math.max(0, Number(background?.ry || 0) * backgroundScaleY)
  const currentName = String(img?.name || '')
  const backgroundName = isFullLabelBackground
    ? 'label_bg_image'
    : (currentName === 'splash_image' ? 'splash_image' : 'price_bg_image')

  img.set({
    left: Number(targetBounds ? (targetBounds.left + targetBounds.right) / 2 : background?.left || 0),
    top: Number(targetBounds ? (targetBounds.top + targetBounds.bottom) / 2 : background?.top || 0),
    originX: 'center',
    originY: 'center',
    width: cropWidth,
    height: cropHeight,
    cropX,
    cropY,
    scaleX: imageScale,
    scaleY: imageScale,
    opacity: 1,
    name: backgroundName,
    __labelBackgroundImage: true,
    crossOrigin: 'anonymous'
  })

  if (isFullLabelBackground) {
    // A imagem de fundo já é recortada pelas dimensões calculadas acima.
    // Não reutilize o clipPath do selo de preço: no Fabric ele usa outra
    // referência local e encolhe a arte para o centro da etiqueta.
    img.set('clipPath', undefined)
    try { delete (img as any).clipPath } catch { /* ignore */ }
  } else if (fabric?.Rect) {
    img.set('clipPath', new fabric.Rect({
      width: backgroundWidth,
      height: backgroundHeight,
      rx: radiusX,
      ry: radiusY,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0
    }))
  }

  if (!isFullLabelBackground && background && typeof background.fill === 'string' && background.fill !== 'transparent') {
    ;(background as any).__originalFill = background.fill
    background.set('fill', 'transparent')
  }
  const imageParent = getObjectParent(img) || (getObjectChildren(group).includes(img) ? group : null)
  if (imageParent && typeof imageParent.sendObjectToBack === 'function') imageParent.sendObjectToBack(img)
  else if (typeof img.sendToBack === 'function') img.sendToBack()
  img.dirty = true
  if (background) background.dirty = true
  refreshManualGroupBounds(imageParent || group)
  markObjectTreeDirty(img)
  return true
}

const fitExistingLabelBackgroundImages = () => {
  if (!group) return 0

  const images: any[] = []
  ;['label_bg_image', 'price_bg_image', 'splash_image'].forEach((name) => {
    const image = findObjectByNameDeep(group, name)
    if (!image || String(image.type || '').toLowerCase() !== 'image' || images.includes(image)) return
    images.push(image)
  })

  let fitted = 0
  images.forEach((image) => {
    if (fitImageAsLabelBackground(image)) fitted += 1
  })
  return fitted
}

const setImageAsBackground = (img: any, options: { replaceExisting?: boolean } = {}) => {
  if (!img || !group) return false
  // Capture the label base before renaming/adding the new image. For legacy
  // templates without `price_bg`, the new image would otherwise become its
  // own sizing reference and never be fitted to the original label.
  const baseBoundsBeforeChange = getLabelVisualBaseBounds()
  const existing = findObjectByNameDeep(group, 'label_bg_image') ||
    findObjectByNameDeep(group, 'price_bg_image') ||
    findObjectByNameDeep(group, 'splash_image')
  if (options.replaceExisting !== false && existing && existing !== img) {
    if (!removeObjectFromEditorTree(existing)) return false
  }
  img.set?.({ name: 'label_bg_image', __labelBackgroundImage: true })
  return fitImageAsLabelBackground(img, { baseBounds: baseBoundsBeforeChange })
}

const promoteSelectedImageToBackground = () => {
  const obj = selectedObj.value
  if (!obj || obj.type !== 'image' || !group) return
  if (!setImageAsBackground(obj)) return
  group.setCoords?.()
  group.dirty = true
  canvas?.setActiveObject?.(obj)
  setSelected({ target: obj, subTarget: obj, subTargets: [obj], selected: [obj] })
  canvas?.requestRenderAll?.()
  recordHistorySnapshot('promoteImageToBackground')
}

const removeSelectedImageAsBackground = () => {
  const obj = selectedObj.value
  if (!isBackgroundImageObject(obj) || !group) return
  const background = getLabelBackgroundShape()
  const restoredFill = String((background as any)?.__originalFill || '').trim()
  if (background && restoredFill) background.set('fill', restoredFill)
  if (background) background.dirty = true
  obj.set?.({ name: `custom_image_${makeId()}`, clipPath: undefined, __labelBackgroundImage: false })
  try { delete (obj as any).clipPath } catch { /* ignore */ }
  group.setCoords?.()
  group.dirty = true
  canvas?.setActiveObject?.(obj)
  setSelected({ target: obj, subTarget: obj, subTargets: [obj], selected: [obj] })
  canvas?.requestRenderAll?.()
  recordHistorySnapshot('removeBackgroundImage')
}

const openAddImage = () => imageInputEl.value?.click()
const openAddBackgroundImage = () => backgroundImageInputEl.value?.click()
const openReplaceImage = () => replaceImageInputEl.value?.click()

const onAddImage = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !fabric || !canvas || !group) {
    if (input) input.value = ''
    return
  }
  
  try {
    validateLabelImageFile(file)
    editorError.value = null
    const dataUrl = await readLabelImageFile(file)

    // Fabric v7: fromURL returns a Promise
    const img: any = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' })
    
    img.set({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      name: `custom_image_${makeId()}`
    })

    trimLabelImageToVisibleContent(img)
    
    const iw = img.width || 1
    const ih = img.height || 1
    const targetW = 180
    const childScale = getManualChildScale()
    const s = (targetW / iw) * childScale
    img.set({ scaleX: s, scaleY: s })
    if (ih > iw) img.set({ scaleX: ((targetW * 0.7) / iw) * childScale, scaleY: ((targetW * 0.7) / iw) * childScale })
    
    addManualChild(img)
    bringGroupObjectToFront(img)
    refreshManualGroupBounds(group)
    canvas.setActiveObject(img)
    setSelected()
    canvas.requestRenderAll()
    recordHistorySnapshot('addImage')
    
  } catch (err) {
    reportEditorError(err, 'Não foi possível adicionar a imagem.')
  } finally {
    if (input) input.value = ''
  }
}

const onAddBackgroundImage = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !fabric || !canvas || !group) {
    if (input) input.value = ''
    return
  }

  try {
    validateLabelImageFile(file)
    editorError.value = null
    const dataUrl = await readLabelImageFile(file)
    const img: any = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' })
    if (!addManualChild(img) || !setImageAsBackground(img)) {
      removeObjectFromEditorTree(img)
      throw new Error('Não foi possível preparar a imagem de fundo.')
    }
    group.setCoords?.()
    group.dirty = true
    canvas.setActiveObject?.(img)
    setSelected({ target: img, subTarget: img, subTargets: [img], selected: [img] })
    canvas.requestRenderAll?.()
    recordHistorySnapshot('addBackgroundImage')
  } catch (err) {
    reportEditorError(err, 'Não foi possível adicionar a imagem de fundo.')
  } finally {
    if (input) input.value = ''
  }
}

const replaceSelectedImage = async (e: Event) => {
  const obj = selectedObj.value
  if (!obj || !fabric || !canvas || !group) return
  if (obj.type !== 'image') return

  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    if (input) input.value = ''
    return
  }

  try {
    validateLabelImageFile(file)
    editorError.value = null
    const dataUrl = await readLabelImageFile(file)

    // Fabric v7: fromURL returns a Promise
    const img: any = await fabric.Image.fromURL(dataUrl, { crossOrigin: 'anonymous' })
    
    const prev = obj
    const previousBaseBounds = getLabelVisualBaseBounds()
    const wasBackgroundImage = isBackgroundImageObject(prev)
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
    if (wasBackgroundImage) {
      img.set({
        name: String(prev.name || '') === 'label_bg_image' ? 'label_bg_image' : 'price_bg_image',
        __labelBackgroundImage: true
      })
    }
    const oldDisplayWidth = Math.abs(Number(prev.width || 1) * Number(prev.scaleX || 1))
    const oldDisplayHeight = Math.abs(Number(prev.height || 1) * Number(prev.scaleY || 1))
    const didTrim = wasBackgroundImage ? false : trimLabelImageToVisibleContent(img)

    // Preserve an existing crop only when the new image has no detectable
    // transparent margin. Otherwise the new visible bounds must win.
    if (!wasBackgroundImage && !didTrim) {
      if (typeof prev.cropX === 'number') img.set('cropX', prev.cropX)
      if (typeof prev.cropY === 'number') img.set('cropY', prev.cropY)
      if (typeof prev.width === 'number') img.set('width', prev.width)
      if (typeof prev.height === 'number') img.set('height', prev.height)
    }
    if (prev.clipPath && !wasBackgroundImage) img.set('clipPath', prev.clipPath)
    if (didTrim) {
      const trimmedWidth = Math.max(1, Number(img.width || 1))
      const trimmedHeight = Math.max(1, Number(img.height || 1))
      const scaleSignX = Number(prev.scaleX || 1) < 0 ? -1 : 1
      const scaleSignY = Number(prev.scaleY || 1) < 0 ? -1 : 1
      img.set({
        scaleX: scaleSignX * (oldDisplayWidth / trimmedWidth),
        scaleY: scaleSignY * (oldDisplayHeight / trimmedHeight)
      })
    }

    const previousParent = getObjectParent(prev) || (getObjectChildren(group).includes(prev) ? group : null)
    if (!previousParent || !removeObjectFromEditorTree(prev)) {
      throw new Error('Não foi possível substituir a imagem selecionada.')
    }
    if (!addManualChild(img, previousParent)) {
      addManualChild(prev, previousParent)
      throw new Error('Não foi possível substituir a imagem selecionada.')
    }
    if (wasBackgroundImage) fitImageAsLabelBackground(img, { baseBounds: previousBaseBounds })
    else refreshManualGroupBounds(previousParent)
    markObjectTreeDirty(img)
    canvas.setActiveObject(img)
    setSelected()
    canvas.requestRenderAll()
    recordHistorySnapshot('replaceImage')
    
  } catch (err) {
    reportEditorError(err, 'Não foi possível substituir a imagem selecionada.')
  } finally {
    if (input) input.value = ''
  }
}

const deleteSelected = () => {
  if (!canvas || !group) return
  const obj = selectedObj.value
  if (!obj || obj === group) return
  const background = isBackgroundImageObject(obj) ? getLabelBackgroundShape() : null
  const restoredFill = String((background as any)?.__originalFill || '').trim()
  if (!removeObjectFromEditorTree(obj)) {
    reportEditorError(new Error('O elemento não pôde ser removido.'), 'Não foi possível excluir o elemento selecionado.')
    return
  }
  if (background && restoredFill) {
    background.set('fill', restoredFill)
    background.dirty = true
  }
  markObjectTreeDirty(group)
  canvas.discardActiveObject?.()
  selectedObj.value = null
  canvas.requestRenderAll()
  recordHistorySnapshot('deleteSelected')
}

const moveLayer = (dir: -1 | 1) => {
  if (!group || !selectedObj.value || selectedObj.value === group) return
  const obj = selectedObj.value
  if (!reorderObjectInParent(obj, dir)) return
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

const clampMiniEditorNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toMiniEditorNumber = (value: unknown, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const setZoomFromInput = (value: unknown) => {
  setZoom(clampMiniEditorNumber(toMiniEditorNumber(value, zoomPct.value), 50, 200))
}

const patchClampedMiniEditorNumber = (
  prop: string,
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  precision = 0
) => {
  const factor = 10 ** precision
  const next = clampMiniEditorNumber(
    Math.round(toMiniEditorNumber(value, fallback) * factor) / factor,
    min,
    max
  )
  patch(prop, next)
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
    // Direct editing on the Fabric canvas can change the character count
    // without going through the sidebar input. Rebuild the rich-price ranges
    // before serializing so integer/cents styles remain aligned with the text.
    if (isRichPriceTextObject(cur)) {
      applyRichPriceTextValue(cur, cur.text)
    }
    const children: any[] = Array.isArray(cur?._objects)
      ? cur._objects
      : (typeof cur?.getObjects === 'function' ? cur.getObjects() : [])
    for (const child of children || []) queue.push(child)
  }
}

const renderMiniEditorPreview = (): string | undefined => {
  if (!canvas || typeof canvas.toDataURL !== 'function') return undefined
  try {
    group?.setCoords?.()
    const canvasWidth = Number(canvas.getWidth?.() || canvas.width || 0)
    const canvasHeight = Number(canvas.getHeight?.() || canvas.height || 0)
    const bounds = group?.getBoundingRect?.()
    const hasBounds = bounds &&
      Number.isFinite(Number(bounds.left)) &&
      Number.isFinite(Number(bounds.top)) &&
      Number.isFinite(Number(bounds.width)) &&
      Number.isFinite(Number(bounds.height)) &&
      Number(bounds.width) > 1 &&
      Number(bounds.height) > 1

    const preview = hasBounds && canvasWidth > 1 && canvasHeight > 1
      ? (() => {
          // Fabric returns getBoundingRect() in scene coordinates, while
          // toDataURL's crop offsets are canvas/viewport coordinates. Using
          // scene bounds directly makes thumbnails drift or become empty as
          // soon as the user changes the mini-editor zoom.
          const viewportTransform = Array.isArray(canvas.viewportTransform)
            ? canvas.viewportTransform
            : [1, 0, 0, 1, 0, 0]
          const zoom = Math.max(0.01, Math.abs(Number(canvas.getZoom?.() || viewportTransform[0] || 1)))
          const translateX = Number(viewportTransform[4] || 0)
          const translateY = Number(viewportTransform[5] || 0)
          const screenLeft = Number(bounds.left) * zoom + translateX
          const screenTop = Number(bounds.top) * zoom + translateY
          const screenWidth = Number(bounds.width) * zoom
          const screenHeight = Number(bounds.height) * zoom
          const padding = Math.max(8, Math.min(24, Math.max(screenWidth, screenHeight) * 0.04))
          const left = Math.max(0, screenLeft - padding)
          const top = Math.max(0, screenTop - padding)
          const right = Math.min(canvasWidth, screenLeft + screenWidth + padding)
          const bottom = Math.min(canvasHeight, screenTop + screenHeight + padding)
          const width = right - left
          const height = bottom - top
          if (width <= 1 || height <= 1) return undefined
          return canvas.toDataURL({
            format: 'png',
            left,
            top,
            width,
            height,
            multiplier: 1,
            enableRetinaScaling: false
          })
        })()
      : canvas.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false })
    return typeof preview === 'string' && preview.startsWith('data:image/') ? preview : undefined
  } catch (error) {
    console.warn('[LabelTemplateMiniEditor] Não foi possível gerar o preview', error)
    return undefined
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

    const saveResult = await new Promise<TemplateSaveResult>((resolve) => {
      let settled = false
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null
      const finalize = (result: TemplateSaveResult) => {
        if (settled) return
        settled = true
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
          timeoutHandle = null
        }
        resolve(result)
      }
      const templateId = String(props.template?.id || '').trim()
      if (!templateId) {
        finalize({ ok: false, message: 'Template inválido para salvar.' })
        return
      }
      const previewDataUrl = renderMiniEditorPreview()
      emit('save', templateId, {
        group: groupJson,
        name,
        ...(previewDataUrl ? { previewDataUrl } : {})
      }, finalize)
      timeoutHandle = setTimeout(() => {
        finalize({ ok: false, message: 'Tempo esgotado ao salvar a etiqueta. Tente novamente.' })
      }, 20000)
    })

    if (!saveResult?.ok) {
      saveError.value = saveResult?.message || 'Falha ao salvar a etiqueta'
      return
    }

    // A successful persistence establishes the current history state as the
    // clean baseline, so Esc/Fechar does not ask about changes already saved.
    recordHistorySnapshot('save')
    savedHistoryFingerprint.value = historyFingerprint.value
    savedEditorName.value = name.trim()

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
  try {
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
    // Try to get the actual sub-target that was clicked
    let actualTarget = e?.selected?.[0]

    // If it's our group, try to find what was actually clicked
    if (actualTarget === group && e?.subTargets && e.subTargets.length > 0) {
      actualTarget = e.subTargets[0]
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

    const handleTextSelectionChanged = (e: any) => {
    const target = e?.target || canvas?.getActiveObject?.() || selectedObj.value
    if (target && isTextLikeObject(target)) syncTextSelectionState(target)
    }
    const handleTextChanged = (e: any) => {
      const target = e?.target
      if (!target || !isTextLikeObject(target)) return
      if (isRichPriceTextObject(target)) applyRichPriceTextValue(target, target.text)
      markObjectTreeDirty(target)
      target.dirty = true
      target.setCoords?.()
      updateKey.value++
      queueHistorySnapshot('text:changed', 120)
      canvas?.requestRenderAll?.()
    }
    canvas.on('text:selection:changed', handleTextSelectionChanged)
    canvas.on('text:editing:entered', handleTextSelectionChanged)
    canvas.on('text:editing:exited', handleTextSelectionChanged)
    canvas.on('text:changed', handleTextChanged)

    canvas.on('object:modified', handleCanvasObjectModified)

    isReady.value = true
    setZoom(100)
    await loadTemplate()
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleMiniEditorKeydown)
    }

    // Keep the Fabric canvas strictly inside the preview viewport.
    if (viewportEl.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvasToViewport()
        fitToViewport()
      })
      resizeObserver.observe(viewportEl.value)
    }
  } catch (error) {
    isReady.value = false
    reportEditorError(error, 'Não foi possível iniciar o editor de etiquetas.')
  }
})

onBeforeUnmount(() => {
  if (historyDebounceTimer) {
    clearTimeout(historyDebounceTimer)
    historyDebounceTimer = null
  }
  renderQueued = false
  resizeObserver?.disconnect()
  resizeObserver = null
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
  () => [
    props.template?.id,
    props.template?.updatedAt,
    props.template?.createdAt,
    (props.template as any)?.group?._customId,
    Array.isArray((props.template as any)?.group?.objects) ? (props.template as any).group.objects.length : 0
  ],
  async () => {
    if (!isReady.value) return
    await loadTemplate()
  }
)
</script>

<template>
  <div class="me-container">
    <input ref="imageInputEl" type="file" class="hidden" accept="image/*" @change="onAddImage" />
    <input ref="backgroundImageInputEl" type="file" class="hidden" accept="image/*" @change="onAddBackgroundImage" />
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
        <button type="button" class="me-close-compact" @click="requestClose" title="Fechar (Esc)">
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

    <div v-if="editorError" class="me-error-msg-compact" role="alert">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ editorError }}
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
          <button class="me-tool-btn-compact" @click="openAddBackgroundImage" title="Adicionar imagem de fundo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16l1.5-1.5a2 2 0 012.5-.2" />
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
            <div class="me-prop-input-with-unit me-range-value">
              <input
                type="number"
                min="50"
                max="200"
                step="1"
                class="me-prop-input me-prop-input--compact"
                :value="zoomPct"
                @input="setZoomFromInput(($event.target as HTMLInputElement).valueAsNumber)"
              />
              <span class="me-prop-unit">%</span>
            </div>
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
          <button class="me-insert-btn me-insert-btn--background" @click="openAddBackgroundImage" title="Adicionar imagem de fundo">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16l1.5-1.5a2 2 0 012.5-.2" />
            </svg>
            Imagem de fundo
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
                    <div class="me-prop-input-with-unit me-range-value">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        class="me-prop-input me-prop-input--compact"
                        :value="Math.round(Number(current('opacity', 1)) * 100)"
                        @input="patchClampedMiniEditorNumber('opacity', Number(($event.target as HTMLInputElement).value) / 100, Number(current('opacity', 1)), 0, 1, 2)"
                      />
                      <span class="me-prop-unit">%</span>
                    </div>
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
              <div v-if="isText" class="mb-4 space-y-2">
                <label class="me-prop-label">Degradê do texto</label>
                <div class="flex items-center gap-2">
                  <input v-model="gradientStart" type="color" aria-label="Cor inicial do degradê" title="Cor inicial" />
                  <input v-model="gradientEnd" type="color" aria-label="Cor final do degradê" title="Cor final" />
                  <select v-model="gradientDirection" aria-label="Direção do degradê" class="me-input">
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                    <option value="diagonal">Diagonal</option>
                  </select>
                </div>
                <button class="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500" @click="applyTextGradient">Aplicar degradê</button>
              </div>
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
                      :style="{ backgroundColor: solidFillColor() }"
                      @click="isText ? (showFillColorPicker = true) : (showFillColorPicker2 = true)"
                    ></div>
                    <input
                      class="me-color-hex-input"
                      :value="String(solidFillColor()).replace('#', '').toUpperCase()"
                      maxlength="6"
                      @input="patch('fill', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
                    />
                    <ColorPicker
                      :show="isText ? showFillColorPicker : showFillColorPicker2"
                      :model-value="solidFillColor()"
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

              <div class="me-text-color-section">
                <div class="me-text-color-section__header">
                  <span>Cores por trecho</span>
                  <span class="me-text-color-section__status">
                    {{ textRangeIsActive ? 'seleção ativa' : `${textRangeStart}-${textRangeEnd}` }}
                  </span>
                </div>
                <p class="me-text-color-section__hint">Escolha o intervalo e aplique a cor no texto selecionado.</p>
                <div class="me-props-grid me-props-grid--2">
                  <div>
                    <label class="me-prop-label">Início</label>
                    <input v-model.number="textRangeStart" type="number" min="0" class="me-text-input" />
                  </div>
                  <div>
                    <label class="me-prop-label">Fim</label>
                    <input v-model.number="textRangeEnd" type="number" min="0" class="me-text-input" />
                  </div>
                </div>
                <div class="me-text-color-row">
                  <label class="me-prop-label">Cor do trecho</label>
                  <div class="me-text-color-picker">
                    <input v-model="textSegmentColor" type="color" aria-label="Cor do trecho" />
                    <span>{{ textSegmentColor.toUpperCase() }}</span>
                  </div>
                </div>
                <div class="me-text-color-row">
                  <label class="me-prop-label">Cor 2</label>
                  <div class="me-text-color-picker">
                    <input v-model="textSecondColor" type="color" aria-label="Segunda cor do texto" />
                    <span>{{ textSecondColor.toUpperCase() }}</span>
                  </div>
                </div>
                <div class="me-text-color-actions">
                  <button type="button" class="me-text-color-action me-text-color-action--primary" @click="applyTextSegmentColor">Aplicar trecho</button>
                  <button type="button" class="me-text-color-action" @click="applyTwoTextColors">Dividir em 2 cores</button>
                  <button type="button" class="me-text-color-action" @click="applyTextColorToWhole">Aplicar no texto todo</button>
                </div>
              </div>

              <div v-if="isRichPriceText" class="me-rich-price-section">
                <div class="me-rich-price-header">
                  <span>Preço em um único texto</span>
                  <code>10,99</code>
                </div>
                <p class="me-rich-price-hint">Controle o tamanho do inteiro e dos centavos sem separar o valor em objetos diferentes.</p>
                <div class="me-props-grid me-props-grid--2">
                  <div>
                    <label class="me-prop-label">Inteiro (10)</label>
                    <input
                      type="number"
                      min="6"
                      max="320"
                      class="me-text-input"
                      :value="richPriceSegmentSize('integer', 48)"
                      @input="setRichPriceSegmentFontSize('integer', ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                  <div>
                    <label class="me-prop-label">Centavos (99)</label>
                    <input
                      type="number"
                      min="6"
                      max="320"
                      class="me-text-input"
                      :value="richPriceSegmentSize('decimal', 26)"
                      @input="setRichPriceSegmentFontSize('decimal', ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                </div>
                <div class="me-rich-price-offsets">
                  <div class="me-rich-price-offsets__header">
                    <span>Posição independente (px)</span>
                    <span class="me-rich-price-offsets__hint">X / Y por trecho</span>
                  </div>
                  <div class="me-props-grid me-props-grid--2">
                    <div>
                      <label class="me-prop-label">Inteiro X</label>
                      <input
                        type="number"
                        step="0.5"
                        min="-240"
                        max="240"
                        class="me-text-input"
                        :value="richPriceSegmentOffset('integer', 'x')"
                        @input="setRichPriceSegmentOffsetValue('integer', 'x', ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                    <div>
                      <label class="me-prop-label">Inteiro Y</label>
                      <input
                        type="number"
                        step="0.5"
                        min="-240"
                        max="240"
                        class="me-text-input"
                        :value="richPriceSegmentOffset('integer', 'y')"
                        @input="setRichPriceSegmentOffsetValue('integer', 'y', ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                    <div>
                      <label class="me-prop-label">Centavos X</label>
                      <input
                        type="number"
                        step="0.5"
                        min="-240"
                        max="240"
                        class="me-text-input"
                        :value="richPriceSegmentOffset('decimal', 'x')"
                        @input="setRichPriceSegmentOffsetValue('decimal', 'x', ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                    <div>
                      <label class="me-prop-label">Centavos Y</label>
                      <input
                        type="number"
                        step="0.5"
                        min="-240"
                        max="240"
                        class="me-text-input"
                        :value="richPriceSegmentOffset('decimal', 'y')"
                        @input="setRichPriceSegmentOffsetValue('decimal', 'y', ($event.target as HTMLInputElement).value)"
                      />
                    </div>
                  </div>
                </div>
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

              <!-- Border Radius for Rects — cantos individuais -->
              <div v-if="isRect">
                <div class="me-corners-header">
                  <label class="me-prop-label" style="margin-bottom:0">Cantos</label>
                  <button
                    class="me-corners-link-btn"
                    :class="{ 'me-corners-linked': cornersLinked }"
                    :title="cornersLinked ? 'Desvincular cantos (definir individualmente)' : 'Vincular cantos (todos iguais)'"
                    @click="cornersLinked = !cornersLinked"
                  >
                    <svg v-if="cornersLinked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                  </button>
                </div>

                <!-- Modo vinculado: um slider para todos -->
                <div v-if="cornersLinked" class="me-radius-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    class="me-range-slider"
                    :value="Math.round(current('rx', 0))"
                    @input="(() => { const v = Number(($event.target as HTMLInputElement).value); patch('rx', v); patch('ry', v); patchCorner('__cornerTL', v); patchCorner('__cornerTR', v); patchCorner('__cornerBL', v); patchCorner('__cornerBR', v); })()"
                  />
                  <input
                    type="number"
                    min="0"
                    class="me-radius-number"
                    :value="Math.round(current('rx', 0))"
                    @input="(() => { const v = Number(($event.target as HTMLInputElement).value); patch('rx', v); patch('ry', v); patchCorner('__cornerTL', v); patchCorner('__cornerTR', v); patchCorner('__cornerBL', v); patchCorner('__cornerBR', v); })()"
                  />
                </div>

                <!-- Modo desvinculado: 4 inputs individuais -->
                <div v-else class="me-corners-grid">
                  <div class="me-corner-item">
                    <label class="me-corner-label">↖ Sup. Esq.</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      class="me-corner-input"
                      :value="Math.round(getCornerValue('__cornerTL'))"
                      @input="patchCorner('__cornerTL', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                  <div class="me-corner-item">
                    <label class="me-corner-label">↗ Sup. Dir.</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      class="me-corner-input"
                      :value="Math.round(getCornerValue('__cornerTR'))"
                      @input="patchCorner('__cornerTR', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                  <div class="me-corner-item">
                    <label class="me-corner-label">↙ Inf. Esq.</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      class="me-corner-input"
                      :value="Math.round(getCornerValue('__cornerBL'))"
                      @input="patchCorner('__cornerBL', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
                  <div class="me-corner-item">
                    <label class="me-corner-label">↘ Inf. Dir.</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      class="me-corner-input"
                      :value="Math.round(getCornerValue('__cornerBR'))"
                      @input="patchCorner('__cornerBR', Number(($event.target as HTMLInputElement).value))"
                    />
                  </div>
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
                <button
                  v-if="!isBackgroundImageSelected"
                  class="me-image-background-btn"
                  @click="promoteSelectedImageToBackground"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16l1.5-1.5a2 2 0 012.5-.2" />
                  </svg>
                  Usar como fundo
                </button>
                <button
                  v-else
                  class="me-image-background-btn me-image-background-btn--active"
                  @click="removeSelectedImageAsBackground"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  Tirar do fundo
                </button>
                <p class="me-image-hint">
                  {{ isBackgroundImageSelected ? 'Preenche a base da etiqueta e fica atrás dos textos.' : 'Imagem livre: mova, aumente e escolha quando ela deve virar fundo.' }}
                </p>
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

          <div v-if="isAtacarejoTemplate" class="me-accordion-section me-atacarejo-behavior-section">
            <div class="me-accordion-header me-accordion-header--static">
              <svg class="me-accordion-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Comportamento comercial</span>
            </div>
            <div class="me-accordion-content me-atacarejo-behavior-content">
              <label class="me-checkbox-label">
                <input
                  type="checkbox"
                  class="me-small-checkbox"
                  :checked="autoCollapseMissingPrices"
                  @change="setAutoCollapseMissingPrices(($event.target as HTMLInputElement).checked)"
                />
                Auto-colapsar faixas sem preço
              </label>
              <p class="me-atac-variants-hint">
                Oculta a faixa sem valor e reduz a etiqueta quando o produto não tiver todas as condições.
              </p>
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

.me-rich-price-section {
  @apply rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2.5;
}

.me-rich-price-header {
  @apply flex items-center justify-between gap-2 text-[11px] font-semibold text-indigo-200;
}

.me-rich-price-header code {
  @apply rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] text-indigo-100;
}

.me-rich-price-hint {
  @apply mt-1 text-[10px] leading-4 text-zinc-400;
}

.me-rich-price-offsets {
  @apply mt-2 rounded-md border border-indigo-500/15 bg-black/10 p-2;
}

.me-rich-price-offsets__header {
  @apply mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-indigo-100;
}

.me-rich-price-offsets__hint {
  @apply font-normal text-zinc-500;
}

.me-text-color-section {
  @apply rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-2;
}

.me-text-color-section__header {
  @apply flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-200;
}

.me-text-color-section__status {
  @apply rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-100;
}

.me-text-color-section__hint {
  @apply text-[10px] leading-4 text-zinc-400;
}

.me-text-color-row {
  @apply flex items-center justify-between gap-2;
}

.me-text-color-row .me-prop-label {
  @apply mb-0;
}

.me-text-color-picker {
  @apply flex items-center gap-2;
}

.me-text-color-picker input[type="color"] {
  @apply h-7 w-9 cursor-pointer rounded border border-zinc-600 bg-transparent p-0.5;
}

.me-text-color-picker span {
  @apply min-w-16 font-mono text-[10px] text-zinc-300;
}

.me-text-color-actions {
  @apply grid grid-cols-1 gap-1.5;
}

.me-text-color-action {
  @apply rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-2 py-1.5 text-[10px] font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white;
}

.me-text-color-action--primary {
  @apply border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25;
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

.me-insert-btn--background {
  @apply border-sky-500/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20;
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

.me-range-value {
  @apply w-20 shrink-0;
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

.me-image-background-btn {
  @apply w-full px-3 py-2 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-xs text-sky-100 transition-colors flex items-center justify-center gap-2;
}

.me-image-background-btn--active {
  @apply border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20;
}

.me-image-hint {
  @apply text-[10px] leading-4 text-zinc-500;
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

/* Cantos individuais */
.me-corners-header {
  @apply flex items-center justify-between mb-1.5;
}

.me-corners-link-btn {
  @apply p-1 rounded transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50;
}

.me-corners-link-btn.me-corners-linked {
  @apply text-violet-400 hover:text-violet-300;
}

.me-corners-grid {
  @apply grid grid-cols-2 gap-2;
}

.me-corner-item {
  @apply flex flex-col gap-0.5;
}

.me-corner-label {
  @apply text-[9px] text-zinc-500 leading-none;
}

.me-corner-input {
  @apply w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-violet-500/50;
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
