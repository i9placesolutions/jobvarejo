<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlignLeft, AlignCenter, AlignRight,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Target,
  Bold, Italic, Underline,
  Type, Palette, Layers, Box,
  Plus, Minus, Trash2, MousePointer2,
  Copy,
  FlipHorizontal, FlipVertical,
  Group, Ungroup,
  ArrowRightFromLine, ArrowDownFromLine,
  Combine, // For Union
  Scissors, // For Subtract
  Cloud, // For Blur (proxy)
  Scan, // For Mask (Replacement)
  GripVertical, // For Spacing
  Component, // For Create Component
  Sparkles,
  LayoutGrid, // For Product Zone
  Eye,
  Zap,
  ChevronsUp,
  ChevronsDown,
  Crop // For Crop mode
} from 'lucide-vue-next'
import ColorPicker from './ui/ColorPicker.vue'
import ProductZoneSettings from './ProductZoneSettings.vue'
import type { ProductZone, GlobalStyles } from '~/types/product-zone'
import type { LabelTemplate } from '~/types/label-template'
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog'

const props = defineProps<{
  selectedObject: any | null,
  activeMode?: 'design' | 'prototype',
  pageSettings: { backgroundColor: string },
  colorStyles?: {id: string, name: string, value: string}[],
  // Product Zone Props
  productZone?: Partial<ProductZone>,
  productGlobalStyles?: Partial<GlobalStyles>,
  labelTemplates?: LabelTemplate[]
}>()

const emit = defineEmits<{
  (e: 'update-property', prop: string, value: any): void
  (e: 'update-smart-group', prop: string | any, value?: any): void
  (e: 'update-page-settings', prop: string, value: any): void
  (e: 'action', action: string): void
  (e: 'add-color-style', color: string): void
  (e: 'apply-color-style', styleId: string): void
  // Product Zone Events
  (e: 'update-zone', prop: string, value: any): void
  (e: 'update-global-styles', prop: string, value: any): void
  (e: 'apply-preset', presetId: string): void
  (e: 'sync-gaps', padding: number): void
  (e: 'recalculate-layout'): void
  (e: 'manage-label-templates'): void
  (e: 'apply-template-to-zone'): void
  (e: 'change-mode', mode: 'design' | 'prototype'): void
  (e: 'add-interaction'): void
}>()

// --- Computed Helpers ---
const isText = computed(() => props.selectedObject && (props.selectedObject.type === 'i-text' || props.selectedObject.type === 'text' || props.selectedObject.type === 'textbox'))

const getSelectionObjects = (obj: any): any[] => {
  if (!obj) return []
  if (typeof obj.getObjects === 'function') {
    const list = obj.getObjects()
    return Array.isArray(list) ? list : []
  }
  const legacy = (obj as any)._objects
  return Array.isArray(legacy) ? legacy : []
}

const isImage = computed(() => {
  const t = String(props.selectedObject?.type || '').toLowerCase()
  return t === 'image'
})

const findImageTarget = computed(() => {
  const obj = props.selectedObject
  if (!obj) return null

  // Direct image
  if (String(obj.type || '').toLowerCase() === 'image') return obj
  if (typeof (obj as any).getSrc === 'function' && (obj as any).getSrc()) return obj
  if (typeof (obj as any).src === 'string' && (obj as any).src) return obj
  if (typeof (obj as any)._element?.src === 'string' && (obj as any)._element?.src) return obj

  // Group / activeSelection: find first image inside
  const t = String(obj.type || '').toLowerCase()
  if (t === 'group' || t === 'activeselection') {
    const list = getSelectionObjects(obj)
    const img = list.find((o: any) => String(o?.type || '').toLowerCase() === 'image' || typeof o?.getSrc === 'function' || typeof o?.src === 'string')
    return img || null
  }

  return null
})

const canRemoveImageBg = computed(() => !!findImageTarget.value)
const isSmartGroup = computed(() => props.selectedObject?.type === 'group' && props.selectedObject.isSmartObject)
const isGroup = computed(() => props.selectedObject?.type === 'group' || props.selectedObject?.type === 'activeSelection')
const isMultiSelect = computed(() => props.selectedObject?.type === 'activeSelection')
const canMask = computed(() => props.selectedObject && !isMultiSelect.value)
const canCrop = computed(() => props.selectedObject && !isMultiSelect.value)
const isComponent = computed(() => props.selectedObject?.isComponent)

// Helper to detect if selected object is a ProductCard
const isProductCard = computed(() => {
  const obj = props.selectedObject
  if (!obj) return false
  return obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || String(obj.name || '').startsWith('product-card'))
})

const isChildInsideProductCard = computed(() => {
  const obj: any = props.selectedObject
  const parent = obj?.group
  if (!parent) return false
  return parent.type === 'group' && (parent.isSmartObject || parent.isProductCard || String(parent.name || '').startsWith('product-card'))
})

const canReplaceProductCardImage = computed(() => {
  return isProductCard.value || isChildInsideProductCard.value
})

// Helper to get the background element of a ProductCard/SmartGroup for styling
const getBackgroundElement = computed(() => {
  const obj = props.selectedObject
  if (!obj) return null
  
  // For ProductCard/SmartObject groups, find the offerBackground
  if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || String(obj.name || '').startsWith('product-card'))) {
    const objs = typeof obj.getObjects === 'function' ? obj.getObjects() : (obj._objects || [])
    return objs.find((o: any) => o?.name === 'offerBackground') || null
  }
  
  // For ProductZones, find the zone rect
  if (isLikelyProductZone(obj)) {
    const objs = typeof obj.getObjects === 'function' ? obj.getObjects() : (obj._objects || [])
    return objs.find((o: any) => o?.type === 'rect' && (o.name === 'zoneRect' || o.name === 'zone-border')) || 
           objs.find((o: any) => o?.type === 'rect') || null
  }
  
  return null
})

// Get the effective fill value (from background element for groups, or from object directly)
const getEffectiveFill = computed(() => {
  const bg = getBackgroundElement.value
  if (bg) {
    return bg.fill || '#000000'
  }
  return props.selectedObject?.fill || '#000000'
})

// Get the effective stroke value
const getEffectiveStroke = computed(() => {
  const bg = getBackgroundElement.value
  if (bg) {
    return bg.stroke || '#000000'
  }
  return props.selectedObject?.stroke || '#000000'
})

// Get the effective strokeWidth value
const getEffectiveStrokeWidth = computed(() => {
  const bg = getBackgroundElement.value
  if (bg) {
    return bg.strokeWidth ?? 0
  }
  return props.selectedObject?.strokeWidth ?? 0
})

// Helper function to detect product zone (same logic as isLikelyProductZone in EditorCanvas)
const isLikelyProductZone = (obj: any): boolean => {
  if (!obj) return false
  if (obj.type !== 'group') return false
  if (obj.isGridZone || obj.isProductZone) return true
  if (obj.name === 'gridZone' || obj.name === 'productZoneContainer') return true
  // CRITICAL: Detect zones via zone-specific custom properties that are ALWAYS preserved
  // in both CANVAS_CUSTOM_PROPS (serialization) and snapshotForPropertiesPanel (reactivity).
  // This catches legacy arts where flags may not have been serialized originally.
  if (typeof obj._zonePadding === 'number' && typeof obj._zoneWidth === 'number' && typeof obj._zoneHeight === 'number') return true
  // Check for zone rect with dashed stroke
  const objs = typeof obj.getObjects === 'function' ? obj.getObjects() : (obj._objects || [])
  const zoneRect = objs.find((o: any) => 
    o?.type === 'rect' && (o.name === 'zoneRect' || o.name === 'zone-border' || Array.isArray(o.strokeDashArray))
  ) || objs.find((o: any) => o?.type === 'rect' && Array.isArray(o.strokeDashArray))
  return !!(zoneRect && Array.isArray(zoneRect.strokeDashArray))
}

const isProductZone = computed(() => isLikelyProductZone(props.selectedObject))

// Extract zone data directly from selected object when it's a product zone
const currentZoneData = computed(() => {
  if (!isProductZone.value || !props.selectedObject) return props.productZone ?? {}

  const obj = props.selectedObject
  const pad = typeof obj._zonePadding === 'number' ? obj._zonePadding : (obj.padding || 20)

  return {
    columns: obj.columns ?? 0,
    rows: obj.rows ?? 0,
    padding: pad,
    gapHorizontal: typeof obj.gapHorizontal === 'number' ? obj.gapHorizontal : pad,
    gapVertical: typeof obj.gapVertical === 'number' ? obj.gapVertical : pad,
    layoutDirection: obj.layoutDirection ?? 'horizontal',
    cardAspectRatio: obj.cardAspectRatio ?? 'auto',
    lastRowBehavior: obj.lastRowBehavior ?? 'fill',
    verticalAlign: obj.verticalAlign ?? 'top',
    highlightCount: obj.highlightCount ?? 0,
    highlightPos: obj.highlightPos ?? 'first',
    highlightHeight: obj.highlightHeight ?? 1.5,
    isLocked: !!(obj.lockMovementX || obj.lockMovementY || obj.lockScalingX || obj.lockScalingY),
    backgroundColor: obj.backgroundColor,
    borderColor: obj.borderColor,
    showBorder: obj.showBorder
  }
})

// Extract global styles from selected zone object
const currentGlobalStyles = computed(() => {
  if (!isProductZone.value || !props.selectedObject) return props.productGlobalStyles

  // Get styles from zone object, fall back to prop
  const zoneStyles = (props.selectedObject as any)._zoneGlobalStyles
  if (zoneStyles && typeof zoneStyles === 'object') {
    return { ...props.productGlobalStyles, ...zoneStyles }
  }

  return props.productGlobalStyles
})

const isFrame = computed(() => props.selectedObject?.isFrame)
const isVectorPath = computed(() => props.selectedObject?.isVectorPath || props.selectedObject?.type === 'path')
const isRectLike = computed(() => {
  const t = String(props.selectedObject?.type || '').toLowerCase()
  return t === 'rect' || isFrame.value
})
const isLineLike = computed(() => {
  const t = String(props.selectedObject?.type || '').toLowerCase()
  return t === 'line'
})

const isLocked = computed(() => {
  const o: any = props.selectedObject
  return !!(o && (o.lockMovementX || o.lockMovementY || o.lockScalingX || o.lockScalingY || o.lockRotation))
})

const clipContentEnabled = computed(() => {
  const v = props.selectedObject?.clipContent
  if (v === false || v === 0 || v === 'false' || v === '0') return false
  // Default behavior for Frames: enabled unless explicitly disabled.
  return true
})

const isSmartElement = computed(() => {
    return props.selectedObject?.data?.smartType;
})
const smartElementType = computed(() => {
    if (!isSmartElement.value) return '';
    return props.selectedObject.data.smartType.replace('product-', '').replace('-', ' ').toUpperCase();
})

const applyGlobalStyle = (prop: string) => {
    if (!props.selectedObject?.data?.smartType) return;
    const type = props.selectedObject.data.smartType;
    const val = props.selectedObject[prop];
    
    // Emit special event with the type to target
    emit('update-smart-group', {
        targetType: type,
        property: prop,
        value: val
    } as any);
}

// --- Local State for UI ---
const activeTab = computed(() => props.activeMode || 'design') // design | prototype

// Collapsible sections state (Figma-inspired)
const collapsedSections = ref<Set<string>>(new Set(['export', 'prototype-info', 'corner-radius'])) // Start some collapsed

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

const showFillColorPicker = ref(false)
const showStrokeColorPicker = ref(false)
const showPageColorPicker = ref(false)
const showStickerOutlineColorPicker = ref(false)
const showShadowColorPicker = ref(false)
const fillColorPickerRef = ref<HTMLElement | null>(null)
const strokeColorPickerRef = ref<HTMLElement | null>(null)
const pageColorPickerRef = ref<HTMLElement | null>(null)
const stickerOutlineColorPickerRef = ref<HTMLElement | null>(null)
const shadowColorPickerRef = ref<HTMLElement | null>(null)

const clamp01 = (n: any) => Math.min(1, Math.max(0, Number(n ?? 0)))
const parseColorToRgba = (input: any) => {
  const s = String(input ?? '').trim()
  const m = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+)\s*)?\)/i.exec(s)
  if (m) {
    return {
      r: Math.round(Number(m[1] || 0)),
      g: Math.round(Number(m[2] || 0)),
      b: Math.round(Number(m[3] || 0)),
      a: clamp01(m[4] ?? 1)
    }
  }
  if (s.startsWith('#') && (s.length === 7 || s.length === 4)) {
    const hex = s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
      a: 1
    }
  }
  // fallback: default black
  return { r: 0, g: 0, b: 0, a: 0.5 }
}
const rgbToHex = (r: number, g: number, b: number) => {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}
const rgbaString = (r: number, g: number, b: number, a: number) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp01(a)})`

const selectedShadow = computed(() => (props.selectedObject as any)?.shadow || null)
const shadowEnabled = computed(() => !!selectedShadow.value)
const shadowRgba = computed(() => parseColorToRgba(selectedShadow.value?.color || 'rgba(0,0,0,0.5)'))
const shadowHex = computed(() => rgbToHex(shadowRgba.value.r, shadowRgba.value.g, shadowRgba.value.b))
const shadowOpacity = computed(() => shadowRgba.value.a)
const shadowType = computed<'drop' | 'glow'>(() => {
  const sx = Number(selectedShadow.value?.offsetX || 0)
  const sy = Number(selectedShadow.value?.offsetY || 0)
  return (Math.abs(sx) + Math.abs(sy)) === 0 ? 'glow' : 'drop'
})

const filtersList = computed<any[]>(() => {
  const f = getVal('filters', [])
  return Array.isArray(f) ? f : []
})
const getFilter = (type: string) => filtersList.value.find((f: any) => f?.type === type)
const filterBrightness = computed(() => Number(getFilter('Brightness')?.brightness || 0))
const filterContrast = computed(() => Number(getFilter('Contrast')?.contrast || 0))
const filterSaturation = computed(() => Number(getFilter('Saturation')?.saturation || 0))
const filterHue = computed(() => Number(getFilter('HueRotation')?.rotation || 0))
const filterBlurPx = computed(() => Math.round(Number(getFilter('Blur')?.blur || 0) * 20))
const filterGrayscale = computed(() => !!getFilter('Grayscale'))
const filterSepia = computed(() => !!getFilter('Sepia'))
const filterInvert = computed(() => !!getFilter('Invert'))

const effectsCount = computed(() => {
  let n = 0
  if (shadowEnabled.value) n++
  if (isImage.value) {
    if (filterBlurPx.value > 0) n++
    if (filterBrightness.value !== 0) n++
    if (filterContrast.value !== 0) n++
    if (filterSaturation.value !== 0) n++
    if (filterHue.value !== 0) n++
    if (filterGrayscale.value) n++
    if (filterSepia.value) n++
    if (filterInvert.value) n++
  }
  return n
})

// Track which input is currently focused to prevent value override during typing
const focusedInput = ref<string | null>(null)

// Helper to safely get value
const getVal = (prop: string, defaultVal: any = '') => props.selectedObject ? (props.selectedObject[prop] ?? defaultVal) : defaultVal

const textSelectionActive = computed(() => {
  if (!isText.value) return false
  return !!(props.selectedObject as any)?.__textSelectionActive
})

const textFillMixed = computed(() => {
  if (!textSelectionActive.value) return false
  return !!(props.selectedObject as any)?.__textFillMixed
})

const resolveFillColorForControl = (value: any, fallback = '#000000') => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed && trimmed !== '[object Object]') return trimmed
  }
  if (value && typeof value === 'object') {
    const stops = Array.isArray((value as any).colorStops) ? (value as any).colorStops : []
    if (stops.length > 0) {
      const first = stops.find((stop: any) => Number(stop?.offset) === 0) || stops[0]
      const stopColor = typeof first?.color === 'string' ? first.color.trim() : ''
      if (stopColor) return stopColor
    }
  }
  return fallback
}

const textFillValue = computed(() => {
  const selectionVal = (props.selectedObject as any)?.__textFillValue
  if (textSelectionActive.value) {
    const fromSelection = resolveFillColorForControl(selectionVal, '')
    if (fromSelection) return fromSelection
  }
  return resolveFillColorForControl(getVal('fill', '#000000'), '#000000')
})

const fillControlValue = computed(() => textFillValue.value)
const fillHexInputValue = computed(() => {
  if (textFillMixed.value) return ''
  const value = String(fillControlValue.value || '').trim()
  return value.startsWith('#') ? value.slice(1).toUpperCase() : ''
})
const fillHexInputPlaceholder = computed(() => textFillMixed.value ? 'MISTO' : '1E1E1E')

const textFontSizeMixed = computed(() => {
  if (!textSelectionActive.value) return false
  return !!(props.selectedObject as any)?.__textFontSizeMixed
})

const textFontSizeValue = computed(() => {
  const selectionVal = Number((props.selectedObject as any)?.__textFontSizeValue)
  if (textSelectionActive.value && Number.isFinite(selectionVal) && selectionVal > 0) {
    return selectionVal
  }
  const base = Number(getVal('fontSize', 20))
  return Number.isFinite(base) && base > 0 ? base : 20
})

const fontSizeInputValue = computed(() => textFontSizeMixed.value ? '' : String(Math.round(textFontSizeValue.value)))
const fontSizeInputPlaceholder = computed(() => textFontSizeMixed.value ? 'MISTO' : '')

const handleFillHexChange = (raw: any) => {
  const cleaned = String(raw ?? '').replace('#', '').trim()
  if (!cleaned) return
  emit('update-property', 'fill', `#${cleaned}`)
}

const handleFontSizeChange = (raw: any) => {
  const next = Number(String(raw ?? '').replace(',', '.').trim())
  if (!Number.isFinite(next) || next <= 0) return
  emit('update-property', 'fontSize', next)
}

// Safe getters for Fabric.js methods (defined early for use in computed)
const getScaledWidth = () => {
  if (!props.selectedObject) return 0
  if (typeof props.selectedObject.getScaledWidth === 'function') {
    return props.selectedObject.getScaledWidth()
  }
  // Fallback for proxy objects or objects without the method
  return props.selectedObject.width * (props.selectedObject.scaleX || 1) || 0
}

const getScaledHeight = () => {
  if (!props.selectedObject) return 0
  if (typeof props.selectedObject.getScaledHeight === 'function') {
    return props.selectedObject.getScaledHeight()
  }
  // Fallback for proxy objects or objects without the method
  return props.selectedObject.height * (props.selectedObject.scaleY || 1) || 0
}

// Computed values that respect focus state (don't override during typing)
const displayLeft = computed(() => focusedInput.value === 'left' ? undefined : Math.round(getVal('left', 0)))
const displayTop = computed(() => focusedInput.value === 'top' ? undefined : Math.round(getVal('top', 0)))
const displayWidth = computed(() => focusedInput.value === 'width' ? undefined : Math.round(getScaledWidth()))
const displayHeight = computed(() => focusedInput.value === 'height' ? undefined : Math.round(getScaledHeight()))
const displayAngle = computed(() => focusedInput.value === 'angle' ? undefined : Math.round(getVal('angle', 0)))

// Handlers for input focus/blur
const handleFocus = (inputName: string) => {
  focusedInput.value = inputName
}
const handleBlur = () => {
  focusedInput.value = null
}

// Input handler that emits and maintains local state
const handlePropertyInput = (prop: string, value: any) => {
  emit('update-property', prop, value)
}

// Helper functions for page color/opacity
const getPageColorHex = () => {
  const bg = props.pageSettings.backgroundColor || '#e9edf2'
  if (bg.startsWith('rgba') || bg.startsWith('rgb')) {
    const match = bg.match(/rgba?\(([^)]+)\)/)
    if (match) {
      const rgbRaw = match[1] ?? ''
      const [rRaw = '0', gRaw = '0', bRaw = '0'] = rgbRaw.split(',').map(s => s.trim())
      const r = parseInt(rRaw, 10)
      const g = parseInt(gRaw, 10)
      const b = parseInt(bRaw, 10)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
  }
  return bg.startsWith('#') ? bg : `#${bg}`
}

const getPageOpacity = () => {
  const bg = props.pageSettings.backgroundColor || '#e9edf2'
  if (bg.startsWith('rgba')) {
    const match = bg.match(/rgba\(([^)]+)\)/)
    if (match) {
      const rgbaRaw = match[1] ?? ''
      const [, , , alpha = '1'] = rgbaRaw.split(',').map(s => s.trim())
      const opacity = parseFloat(alpha)
      return Math.round(opacity * 100)
    }
  }
  return 100
}

const handlePageColorChange = (color: string) => {
  const opacity = getPageOpacity() / 100
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    emit('update-page-settings', 'backgroundColor', `rgba(${r}, ${g}, ${b}, ${opacity})`)
  } else {
    emit('update-page-settings', 'backgroundColor', color)
  }
}

const handlePageOpacityChange = (opacity: number) => {
  const hex = getPageColorHex()
  const hexColor = hex.replace('#', '')
  const r = parseInt(hexColor.substr(0, 2), 16)
  const g = parseInt(hexColor.substr(2, 2), 16)
  const b = parseInt(hexColor.substr(4, 2), 16)
  emit('update-page-settings', 'backgroundColor', `rgba(${r}, ${g}, ${b}, ${opacity})`)
}

const handleAddColorStyle = () => {
  // Use selected object's fill color if available, otherwise use page background
  const colorToAdd = props.selectedObject ? fillControlValue.value : getPageColorHex()
  emit('add-color-style', colorToAdd)
}

const isTransparentColor = (c: any) => {
  if (c == null) return true
  if (c === '' || c === 'transparent') return true
  if (typeof c !== 'string') return false
  // crude rgba alpha=0 detection
  return c.startsWith('rgba') && c.replace(/\s/g, '').endsWith(',0)')
}

const fillEnabled = computed(() => {
  const v = (props.selectedObject as any)?.__fillEnabled
  if (typeof v === 'boolean') return v
  return !isTransparentColor(getVal('fill', null))
})

const strokeEnabled = computed(() => {
  const v = (props.selectedObject as any)?.__strokeEnabled
  if (typeof v === 'boolean') return v
  const s = getVal('stroke', null)
  const w = Number(getVal('strokeWidth', 0))
  return !isTransparentColor(s) && w > 0
})

	const stickerOutlineEnabled = computed(() => {
	  return !!(props.selectedObject as any)?.__stickerOutlineEnabled
	})
	const stickerOutlineMode = computed(() => {
	  return (props.selectedObject as any)?.__stickerOutlineMode === 'inside' ? 'inside' : 'outside'
	})
	const stickerOutlineWidth = computed(() => {
	  return Number((props.selectedObject as any)?.__stickerOutlineWidth) || 4
	})
	const stickerOutlineColor = computed(() => {
	  return (props.selectedObject as any)?.__stickerOutlineColor || '#FFFFFF'
	})
const stickerOutlineOpacity = computed(() => {
  const v = (props.selectedObject as any)?.__stickerOutlineOpacity
  return v != null ? Number(v) : 1
})
const stickerNoTransparency = computed(() => {
  return !!(props.selectedObject as any)?.__stickerNoTransparency
})

const cornerRadii = computed(() => {
  const cr = (props.selectedObject as any)?.cornerRadii
  if (cr && typeof cr === 'object') {
    return {
      tl: Number(cr.tl ?? 0),
      tr: Number(cr.tr ?? 0),
      br: Number(cr.br ?? 0),
      bl: Number(cr.bl ?? 0)
    }
  }
  const r = Number(getVal('rx', 0))
  return { tl: r, tr: r, br: r, bl: r }
})

const useIndividualRadii = computed(() => {
  const cr = (props.selectedObject as any)?.cornerRadii
  return !!(cr && typeof cr === 'object')
})

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']

// Prototype Options
import { useProject } from '~/composables/useProject'
const { project } = useProject()
const targetPages = computed(() => project.pages.map((p, i) => ({ id: i, name: p.name })))

</script>

<template>
  <div v-if="selectedObject" class="h-full bg-white text-zinc-900 min-h-0 flex flex-col font-sans select-none overflow-hidden">

    <!-- Abas (Design / Protótipo) -->
    <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[#e7e7e7] bg-white shrink-0">
      <div @click="emit('change-mode', 'design')" class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide cursor-pointer transition-all" :class="activeTab === 'design' ? 'bg-[#fde9e7] text-[#b3261e]' : 'text-zinc-500 hover:text-zinc-400'">
        <Palette class="w-3 h-3" />
        <span>Design</span>
      </div>
      <div @click="emit('change-mode', 'prototype')" class="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide cursor-pointer transition-all" :class="activeTab === 'prototype' ? 'bg-[#fde9e7] text-[#b3261e]' : 'text-zinc-500 hover:text-zinc-400'">
        <MousePointer2 class="w-3 h-3" />
        <span>Protótipo</span>
      </div>
    </div>

    <!-- Scrollable Inspector -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">

      <!-- PROTOTYPE TAB (Figma-style interactions panel) -->
      <div v-if="activeTab === 'prototype'" class="p-3 space-y-3">
        <!-- Empty state for prototype -->
        <div v-if="!getVal('interactionDestination', '')" class="text-center py-8">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-200/50 flex items-center justify-center">
            <MousePointer2 class="w-5 h-5 text-zinc-600" />
          </div>
          <p class="text-xs text-zinc-500 mb-1">Sem interações</p>
          <p class="text-[10px] text-zinc-600">Adicione uma ação ao clicar neste elemento</p>
        </div>

        <!-- Interaction Card -->
        <div v-else class="pp-interaction-card">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-[#fde9e7] flex items-center justify-center">
                <MousePointer2 class="w-3.5 h-3.5 text-[#b3261e]" />
              </div>
              <div>
                <p class="text-xs font-medium text-zinc-900">Ao clicar</p>
                <p class="text-[10px] text-zinc-500">Ação de navegação</p>
              </div>
            </div>
            <button @click="$emit('update-property', 'interactionDestination', '')" class="w-6 h-6 rounded hover:bg-[#ececec] flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors" title="Remover interação">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Navegar para</label>
            <select :value="getVal('interactionDestination', '')" @change="e => $emit('update-property', 'interactionDestination', (e.target as any).value)" class="w-full bg-[#f7f7f7] text-xs text-zinc-900 rounded-lg border border-zinc-800 h-9 px-3 focus:outline-none focus:border-[#b3261e]/55">
              <option value="">Selecionar página...</option>
              <option v-for="page in targetPages" :key="page.id" :value="page.id">{{ page.name }}</option>
            </select>
          </div>
        </div>

        <!-- Prototype Info Section -->
        <div class="pp-info-box" :class="{ 'pp-info-box--collapsed': isSectionCollapsed('prototype-info') }">
          <button @click="toggleSection('prototype-info')" class="w-full flex items-center justify-between text-left">
            <div class="flex items-center gap-2">
              <Zap class="w-4 h-4 text-amber-500" />
              <span class="text-[10px] font-medium text-zinc-400">Dica Prototype</span>
            </div>
            <ChevronsDown class="w-4 h-4 text-zinc-600 transition-transform" :class="{ '-rotate-90': isSectionCollapsed('prototype-info') }" />
          </button>
          <div v-show="!isSectionCollapsed('prototype-info')" class="mt-2 text-[10px] text-zinc-500 leading-relaxed">
            No modo <span class="text-[#b3261e]">Apresentar</span>, clique em elementos com interações para navegar entre páginas.
          </div>
        </div>
      </div>

      <!-- DESIGN TAB (Figma-style design properties) -->
      <div v-else class="pp-design-panel">

      <!-- Ações Rápidas (Visibilidade, Bloquear, Excluir) -->
      <div class="flex items-center justify-between px-2 py-1 border-b border-[#e7e7e7] bg-[#f7f7f7]/50">
        <div class="flex items-center gap-1">
          <button
            class="w-6 h-6 rounded flex items-center justify-center transition-all"
            :class="getVal('visible', true) ? 'text-[#b3261e] bg-[#fde9e7]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-[#ececec]'"
            @click="$emit('update-property', 'visible', !getVal('visible', true))"
            :title="getVal('visible', true) ? 'Ocultar elemento' : 'Mostrar elemento'"
          >
            <Eye class="w-3.5 h-3.5" />
          </button>
          <button
            class="w-6 h-6 rounded flex items-center justify-center transition-all"
            :class="isLocked ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-900 hover:bg-[#ececec]'"
            @click="$emit('update-property', 'lockMovement', !isLocked)"
            :title="isLocked ? 'Desbloquear movimento' : 'Bloquear movimento'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
          <button
            class="w-6 h-6 rounded flex items-center justify-center transition-all text-zinc-500 hover:text-zinc-900 hover:bg-[#ececec]"
            @click="$emit('action', 'duplicate')"
            title="Duplicar"
          >
            <Copy class="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          @click="$emit('action', 'delete')"
          title="Excluir elemento"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Alinhamento e Distribuição -->
      <div class="px-2 py-1 border-b border-[#e7e7e7] flex flex-wrap gap-1 justify-between text-zinc-400">
          <div class="flex gap-0.5">
            <button @click="$emit('update-property', 'alignment', 'left')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Alinhar à esquerda"><AlignLeft class="w-3 h-3" /></button>
            <button @click="$emit('update-property', 'alignment', 'center')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Centralizar"><AlignCenter class="w-3 h-3" /></button>
            <button @click="$emit('update-property', 'alignment', 'right')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Alinhar à direita"><AlignRight class="w-3 h-3" /></button>
          </div>
          
          <div class="w-px h-3 bg-[#ececec] my-auto"></div>

          <div class="flex gap-0.5">
             <button @click="$emit('action', 'center-h')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Centralizar horizontalmente"><AlignHorizontalJustifyCenter class="w-3 h-3" /></button>
             <button @click="$emit('action', 'center-v')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Centralizar verticalmente"><AlignVerticalJustifyCenter class="w-3 h-3" /></button>
             <button @click="$emit('action', 'center-both')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Centralizar (ambos)"><Target class="w-3 h-3" /></button>
          </div>

          <div class="w-px h-3 bg-[#ececec] my-auto"></div>

          <div class="flex gap-0.5">
             <button @click="$emit('action', 'align-top')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Alinhar ao topo"><ChevronsUp class="w-3 h-3" /></button>
             <button @click="$emit('action', 'align-middle')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Alinhar ao meio"><Minus class="w-3 h-3" /></button>
             <button @click="$emit('action', 'align-bottom')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Alinhar à base"><ChevronsDown class="w-3 h-3" /></button>
          </div>

          <div class="w-px h-3 bg-[#ececec] my-auto"></div>

          <div class="flex gap-0.5">
             <button @click="$emit('action', 'distribute-h')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Distribuir horizontalmente"><ArrowRightFromLine class="w-3 h-3" /></button>
             <button @click="$emit('action', 'distribute-v')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Distribuir verticalmente"><ArrowDownFromLine class="w-3 h-3" /></button>
          </div>

          <div class="w-px h-3 bg-[#ececec] my-auto"></div>

          <div class="flex gap-0.5">
            <button @click="$emit('action', 'flip-h')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Espelhar horizontal"><FlipHorizontal class="w-3 h-3" /></button>
            <button @click="$emit('action', 'flip-v')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Espelhar vertical"><FlipVertical class="w-3 h-3" /></button>
          </div>

          <div v-if="isGroup" class="w-px h-3 bg-[#ececec] my-auto"></div>
          
          <div v-if="isGroup" class="flex gap-0.5">
             <button v-if="selectedObject.type === 'activeSelection'" @click="$emit('action', 'group')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Agrupar"><Group class="w-3 h-3" /></button>
             <button v-if="selectedObject.type === 'group'" @click="$emit('action', 'ungroup')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Desagrupar"><Ungroup class="w-3 h-3" /></button>
          </div>

          <!-- Operações Booleanas -->
          <div v-if="isMultiSelect" class="w-px h-3 bg-[#ececec] my-auto"></div>
          <div v-if="isMultiSelect" class="flex gap-0.5">
             <button @click="$emit('action', 'union')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Unir seleção"><Combine class="w-3 h-3" /></button>
             <button @click="$emit('action', 'subtract')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Subtrair seleção"><Scissors class="w-3 h-3" /></button>
          </div>

          <!-- Máscara -->
          <div v-if="canMask" class="w-px h-3 bg-[#ececec] my-auto"></div>
          <div v-if="canMask" class="flex gap-0.5">
             <button @click="$emit('action', 'toggle-mask')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" :class="selectedObject.isMask ? 'text-[#b3261e] bg-[#fde9e7]' : ''" title="Usar como máscara"><Scan class="w-3 h-3" /></button>
          </div>

          <!-- Recortar -->
          <div v-if="canCrop" class="w-px h-3 bg-[#ececec] my-auto"></div>
          <div v-if="canCrop" class="flex gap-0.5">
             <button @click="$emit('action', 'activate-crop')" class="hover:text-zinc-900 p-1 rounded hover:bg-[#f4f4f4] transition-colors" title="Ativar modo de recorte"><Crop class="w-3 h-3" /></button>
          </div>

          <!-- Espaçamento do Layout -->
          <div v-if="isGroup" class="w-px h-3 bg-[#ececec] my-auto"></div>
          <div v-if="isGroup" class="flex items-center gap-0.5 bg-[#f2f2f2] rounded px-1 h-5" title="Espaçamento entre itens">
              <GripVertical class="w-2.5 h-2.5 text-zinc-500" />
              <input type="number" :value="selectedObject.gap || 0" @input="e => $emit('action', 'update-gap:' + (e.target as any).value)" class="bg-transparent w-6 text-[9px] text-zinc-900 focus:outline-none text-center" />
          </div>
      </div>

      <!-- Posição e Tamanho -->
      <div class="border-b border-[#e7e7e7]">
        <button
          class="pp-section-header"
          :class="{ 'pp-section-header--collapsed': isSectionCollapsed('transform') }"
          @click="toggleSection('transform')"
        >
          <svg class="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span>Posição e Tamanho</span>
          <svg class="pp-section-chevron" :class="{ 'pp-section-chevron--collapsed': isSectionCollapsed('transform') }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!isSectionCollapsed('transform')" class="pp-section-content">
          <div class="pp-grid-4">
            <div class="pp-input-row">
              <span class="pp-input-label" title="Posição horizontal">X</span>
              <input type="number" :value="displayLeft ?? Math.round(getVal('left', 0))" @focus="handleFocus('left')" @blur="handleBlur" @input="e => handlePropertyInput('left', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label" title="Posição vertical">Y</span>
              <input type="number" :value="displayTop ?? Math.round(getVal('top', 0))" @focus="handleFocus('top')" @blur="handleBlur" @input="e => handlePropertyInput('top', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label" title="Largura">L</span>
              <input type="number" :value="displayWidth ?? Math.round(getScaledWidth())" @focus="handleFocus('width')" @blur="handleBlur" @input="e => handlePropertyInput('width', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label" title="Altura">A</span>
              <input type="number" :value="displayHeight ?? Math.round(getScaledHeight())" @focus="handleFocus('height')" @blur="handleBlur" @input="e => handlePropertyInput('height', Number((e.target as any).value))" class="pp-number-input" />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="pp-input-row w-16 shrink-0">
              <span class="pp-input-label" title="Rotação">∠</span>
              <input type="number" :value="displayAngle ?? Math.round(getVal('angle', 0))" @focus="handleFocus('angle')" @blur="handleBlur" @input="e => handlePropertyInput('angle', Number((e.target as any).value))" class="pp-number-input" />
              <span class="text-[9px] text-zinc-600">°</span>
            </div>
            <div class="pp-input-row w-14 shrink-0" v-if="isRectLike && !isText">
              <span class="pp-input-label" title="Raio dos cantos">R</span>
              <input type="number" :value="Math.round(cornerRadii.tl || 0)" @input="e => { $emit('update-property', 'rx', Number((e.target as any).value)); $emit('update-property', 'ry', Number((e.target as any).value)) }" class="pp-number-input" />
            </div>
            <div class="flex-1 flex items-center gap-1 min-w-0">
              <input type="range" min="0" max="1" step="0.05" :value="Number(getVal('opacity', 1))" @input="$emit('update-property', 'opacity', Number(($event.target as any).value))" class="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e] min-w-0" title="Opacidade" />
              <span class="text-[9px] text-zinc-500 w-7 text-right shrink-0">{{ Math.round(Number(getVal('opacity', 1)) * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Seção Vetor -->
      <div v-if="isVectorPath" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center gap-1.5">
              <svg class="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2L2 7l10 5 10-5-10-5z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 17l10 5 10-5" /></svg>
              <span class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Vetor</span>
          </div>
          
          <!-- Alinhamento -->
          <div class="space-y-1">
              <label class="text-[9px] text-zinc-500 font-medium">Alinhamento</label>
              <div class="flex items-center gap-0.5 flex-wrap">
                  <button @click="$emit('update-property', 'textAlign', 'left')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Alinhar à esquerda"><AlignLeft class="w-3 h-3" /></button>
                  <button @click="$emit('update-property', 'textAlign', 'center')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Centralizar"><AlignCenter class="w-3 h-3" /></button>
                  <button @click="$emit('update-property', 'textAlign', 'right')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Alinhar à direita"><AlignRight class="w-3 h-3" /></button>
                  <button @click="$emit('action', 'align-top')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Alinhar ao topo"><ChevronsUp class="w-3 h-3" /></button>
                  <button @click="$emit('action', 'align-middle')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Alinhar ao meio"><Minus class="w-3 h-3" /></button>
                  <button @click="$emit('action', 'align-bottom')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Alinhar à base"><ChevronsDown class="w-3 h-3" /></button>
                  <button @click="$emit('action', 'distribute-h')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Distribuir horizontalmente"><ArrowRightFromLine class="w-3 h-3" /></button>
              </div>
          </div>
          
          <!-- Posição -->
          <div class="space-y-1">
              <label class="text-[9px] text-zinc-500 font-medium">Posição</label>
              <div class="grid grid-cols-2 gap-1.5">
                  <div class="flex items-center gap-1">
                      <span class="text-[9px] text-zinc-500">X</span>
                      <input type="number" :value="Math.round(getVal('left', 0))" @input="e => $emit('update-property', 'left', Number((e.target as any).value))" class="flex-1 bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55" />
                  </div>
                  <div class="flex items-center gap-1">
                      <span class="text-[9px] text-zinc-500">Y</span>
                      <input type="number" :value="Math.round(getVal('top', 0))" @input="e => $emit('update-property', 'top', Number((e.target as any).value))" class="flex-1 bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55" />
                  </div>
              </div>
          </div>
          
          <!-- Tipo de Ponto -->
          <div class="space-y-1">
              <label class="text-[9px] text-zinc-500 font-medium">Tipo de Ponto</label>
              <div class="flex items-center gap-0.5">
                  <button @click="$emit('action', 'convert-to-smooth')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Converter para suave (S)">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'convert-to-corner')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Converter para canto (C)">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                  </button>
              </div>
          </div>
          
          <!-- Espelhamento -->
          <div class="space-y-1">
              <label class="text-[9px] text-zinc-500 font-medium">Espelhamento</label>
              <div class="flex items-center gap-0.5">
                  <button @click="$emit('action', 'mirror-handles')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Espelhar alças (M)">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'reset-handles')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Redefinir alças">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'smooth-handles')" class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Suavizar alças (S)">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                  </button>
              </div>
          </div>
          
          <!-- Raio dos Cantos -->
          <div class="space-y-1">
              <div class="flex items-center justify-between">
                  <label class="text-[9px] text-zinc-500 font-medium">Raio dos cantos</label>
                  <button class="w-4 h-4 hover:bg-[#ececec] rounded flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-all" title="Cantos independentes">
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                  </button>
              </div>
              <input type="number" :value="Math.round(cornerRadii.tl || 0)" @input="e => { $emit('update-property', 'rx', Number((e.target as any).value)); $emit('update-property', 'ry', Number((e.target as any).value)) }" class="w-full bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55" />
          </div>
      </div>

      <!-- Frame -->
      <div v-if="isFrame" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center gap-1.5">
              <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/></svg>
              <span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Frame</span>
          </div>
          <button
            type="button"
            class="w-full flex items-center justify-between rounded px-2 py-1.5 bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors"
            @click="$emit('update-property', 'clipContent', !clipContentEnabled)"
          >
            <span class="text-[11px] text-zinc-200">Recortar conteúdo</span>
            <span
              class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              :class="clipContentEnabled ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'"
            >
              {{ clipContentEnabled ? 'ATIVO' : 'INATIVO' }}
            </span>
          </button>
      </div>

      <!-- Camada (Blend Mode) -->
      <div class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center gap-1.5">
              <Layers class="w-3 h-3 text-zinc-400" />
              <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Camada</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
              <select :value="getVal('globalCompositeOperation', 'source-over')" @change="e => $emit('update-property', 'globalCompositeOperation', (e.target as any).value)" class="bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55">
                  <option value="source-over">Normal</option>
                  <option v-for="mode in BLEND_MODES" :key="mode" :value="mode">{{ mode }}</option>
              </select>
              <div class="flex items-center gap-1.5 bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6">
                  <span class="text-[9px] text-zinc-500">%</span>
                  <input type="number" :value="Math.round(getVal('opacity', 1) * 100)" @input="e => $emit('update-property', 'opacity', Number((e.target as any).value) / 100)" class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none text-right" title="Opacidade" />
              </div>
          </div>
      </div>

      <!-- Texto -->
      <div v-if="isText" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center gap-1.5">
              <Type class="w-3 h-3 text-orange-400" />
              <span class="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Texto</span>
          </div>
          
          <select :value="getVal('fontFamily', 'Arial')" @change="e => $emit('update-property', 'fontFamily', (e.target as any).value)" class="w-full bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55">
              <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
          </select>

          <div class="grid grid-cols-2 gap-1.5">
              <select :value="getVal('fontWeight', 'normal')" @change="e => $emit('update-property', 'fontWeight', (e.target as any).value)" class="bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55">
                  <option value="normal">Regular</option>
                  <option value="bold">Negrito</option>
                  <option value="900">Extra Negrito</option>
              </select>
              <div class="flex items-center bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6">
                  <span class="text-[9px] text-zinc-500 mr-1" title="Tamanho da fonte">Tam</span>
                  <input
                    type="text"
                    :value="fontSizeInputValue"
                    :placeholder="fontSizeInputPlaceholder"
                    @input="e => handleFontSizeChange((e.target as any).value)"
                    class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none"
                  />
              </div>
          </div>

          <!-- Text Style Buttons (Bold, Italic, Underline) -->
          <div class="flex gap-0.5">
            <button
              class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all"
              :class="{ 'bg-[#fde9e7] text-[#b3261e]': getVal('fontWeight') === 'bold' || getVal('fontWeight') === '700' || getVal('fontWeight') === 700 }"
              @click="$emit('update-property', 'fontWeight', getVal('fontWeight') === 'bold' || getVal('fontWeight') === '700' || getVal('fontWeight') === 700 ? 'normal' : 'bold')"
              title="Negrito"
            >
              <Bold class="w-3 h-3" />
            </button>
            <button
              class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all"
              :class="{ 'bg-[#fde9e7] text-[#b3261e]': getVal('fontStyle') === 'italic' }"
              @click="$emit('update-property', 'fontStyle', getVal('fontStyle') === 'italic' ? 'normal' : 'italic')"
              title="Itálico"
            >
              <Italic class="w-3 h-3" />
            </button>
            <button
              class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all"
              :class="{ 'bg-[#fde9e7] text-[#b3261e]': !!getVal('underline') }"
              @click="$emit('update-property', 'underline', !getVal('underline'))"
              title="Sublinhado"
            >
              <Underline class="w-3 h-3" />
            </button>
            <button
              class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all"
              :class="{ 'bg-[#fde9e7] text-[#b3261e]': !!getVal('linethrough') }"
              @click="$emit('update-property', 'linethrough', !getVal('linethrough'))"
              title="Tachado"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Propriedades avançadas de texto -->
          <div class="grid grid-cols-2 gap-1.5">
               <div class="flex items-center bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6" title="Altura da linha">
                  <span class="text-[9px] text-zinc-500 mr-1">Alt.L</span>
                  <input type="number" step="0.1" :value="getVal('lineHeight', 1.2)" @input="e => $emit('update-property', 'lineHeight', Number((e.target as any).value))" class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none" />
              </div>
              <div class="flex items-center bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6" title="Espaçamento entre letras">
                  <span class="text-[9px] text-zinc-500 mr-1">Esp.</span>
                  <input type="number" :value="getVal('charSpacing', 0)" @input="e => $emit('update-property', 'charSpacing', Number((e.target as any).value))" class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none" />
              </div>
          </div>
          
          <!-- Alinhamento e Maiúsculas/Minúsculas -->
          <div class="flex gap-1.5">
            <div class="flex flex-1 bg-[#f7f7f7] rounded border border-[#dfdfdf] p-0.5 gap-0.5">
                <button class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all" :class="getVal('textAlign') == 'left' ? 'bg-[#fde9e7] text-[#b3261e]' : ''" @click="$emit('update-property', 'textAlign', 'left')" title="Alinhar à esquerda"><AlignLeft class="w-3 h-3"/></button>
                <button class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all" :class="getVal('textAlign') == 'center' ? 'bg-[#fde9e7] text-[#b3261e]' : ''" @click="$emit('update-property', 'textAlign', 'center')" title="Centralizar"><AlignCenter class="w-3 h-3"/></button>
                <button class="flex-1 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-900 hover:bg-[#ececec] transition-all" :class="getVal('textAlign') == 'right' ? 'bg-[#fde9e7] text-[#b3261e]' : ''" @click="$emit('update-property', 'textAlign', 'right')" title="Alinhar à direita"><AlignRight class="w-3 h-3"/></button>
            </div>
            <div class="flex bg-[#f7f7f7] rounded border border-[#dfdfdf] p-0.5 gap-0.5">
                <button class="w-6 h-6 flex items-center justify-center hover:bg-[#ececec] rounded text-[9px] font-bold text-zinc-400 hover:text-zinc-900 transition-all" title="Maiúsculas" @click="$emit('action', 'text-upper')">AG</button>
                <button class="w-6 h-6 flex items-center justify-center hover:bg-[#ececec] rounded text-[9px] text-zinc-400 hover:text-zinc-900 transition-all" title="Minúsculas" @click="$emit('action', 'text-lower')">ag</button>
            </div>
          </div>

          <!-- Botão Componente -->
          <div class="flex justify-center">
             <button @click="$emit('action', 'create-component')" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[9px] font-bold uppercase tracking-widest" :class="isComponent ? 'border-[#b3261e] text-[#b3261e] bg-[#fde9e7]' : 'border-zinc-700 text-zinc-400 hover:border-[#b3261e] hover:text-[#b3261e]'">
                 <Component class="w-3 h-3" />
                 <span>{{ isComponent ? 'Componente Principal' : 'Criar Componente' }}</span>
             </button>
          </div>
      </div>

      <!-- Preenchimento -->
      <div v-if="!isImage && !isLineLike" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center justify-between group">
              <div class="flex items-center gap-1.5">
                <Palette class="w-3 h-3 text-zinc-400" />
                <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Preenchimento</span>
              </div>
              <button
                type="button"
                class="flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors"
                @click="$emit('update-property', 'fillEnabled', !fillEnabled)"
              >
                <span :class="fillEnabled ? 'text-green-400' : 'text-red-400'">{{ fillEnabled ? 'ATIVO' : 'INATIVO' }}</span>
              </button>
          </div>
          
          <div class="flex items-center gap-1.5 group" :class="!fillEnabled ? 'opacity-50 pointer-events-none' : ''">
              <div 
                ref="fillColorPickerRef"
                class="relative"
              >
                <div 
                  class="w-5 h-5 rounded border border-[#dfdfdf] cursor-pointer shrink-0 relative overflow-hidden"
                  :style="{ backgroundColor: fillControlValue }"
                  @click="showFillColorPicker = true"
                ></div>
                <ColorPicker
                  :show="showFillColorPicker"
                  :model-value="fillControlValue"
                  :trigger-element="fillColorPickerRef"
                  @update:show="showFillColorPicker = $event"
                  @update:model-value="(val: string) => $emit('update-property', 'fill', val)"
                />
              </div>
              <div v-if="textFillMixed" class="text-[9px] text-amber-400 font-bold uppercase tracking-widest shrink-0">MISTO</div>
              <input 
                type="text" 
                :value="fillHexInputValue" 
                @change="e => handleFillHexChange((e.target as any).value)" 
                class="flex-1 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 font-mono focus:outline-none focus:border-[#b3261e]/55 uppercase min-w-0" 
                :placeholder="fillHexInputPlaceholder"
                maxlength="6"
              />
              <input 
                type="text" 
                value="100" 
                class="w-10 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1 text-center focus:outline-none focus:border-[#b3261e]/55" 
              />
              <span class="text-[10px] text-zinc-400 shrink-0">%</span>
          </div>
          
          <!-- Ações de Gradiente -->
          <div class="flex justify-between items-center">
             <div class="text-[9px] text-[#b3261e] cursor-pointer hover:underline" @click="$emit('update-property', 'fill-gradient', 'linear')">Usar Gradiente</div>
             <button class="text-[9px] text-zinc-500 hover:text-zinc-900" @click="$emit('add-color-style', fillControlValue)">+ Estilo</button>
          </div>
          
          <!-- Color Styles List -->
          <div v-if="colorStyles && colorStyles.length > 0" class="flex flex-wrap gap-1 mt-2">
              <button 
                v-for="style in colorStyles" 
                :key="style.id" 
                @click="$emit('apply-color-style', style.id)"
                class="w-4 h-4 rounded-full border border-[#dfdfdf] hover:border-[#b3261e]/45 transition-all"
                :style="{backgroundColor: style.value}"
                :title="style.name"
              ></button>
          </div>
      </div>

	      <!-- Layout Automático -->
	      <div v-if="isGroup" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <svg class="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
                <span class="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Layout Automático</span>
              </div>
              <div class="flex items-center gap-0.5 bg-[#f2f2f2] rounded px-1 h-5">
                  <GripVertical class="w-2.5 h-2.5 text-zinc-500" />
                  <input type="number" :value="getVal('gap', 0)" @input="e => $emit('action', 'update-gap:' + (e.target as any).value)" class="bg-transparent w-5 text-[9px] text-zinc-900 focus:outline-none text-center" placeholder="0" title="Espaçamento" />
              </div>
          </div>
          
          <div class="grid grid-cols-2 gap-1.5">
              <div class="flex items-center gap-1.5 bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6" title="Preenchimento horizontal">
                  <span class="text-[9px] text-zinc-500">PH</span>
                  <input type="number" :value="getVal('paddingX', 0)" @input="e => $emit('action', 'update-padding-x:' + (e.target as any).value)" class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none" />
              </div>
              <div class="flex items-center gap-1.5 bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6" title="Preenchimento vertical">
                  <span class="text-[9px] text-zinc-500">PV</span>
                  <input type="number" :value="getVal('paddingY', 0)" @input="e => $emit('action', 'update-padding-y:' + (e.target as any).value)" class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none" />
              </div>
          </div>
          
          <div class="flex gap-1">
              <button @click="$emit('action', 'layout-hug')" class="flex-1 py-1 text-[9px] bg-[#f7f7f7] border border-[#dfdfdf] rounded hover:border-zinc-500 transition-colors text-zinc-400 hover:text-zinc-900" title="Ajustar ao conteúdo">Ajustar</button>
              <button @click="$emit('action', 'layout-fill')" class="flex-1 py-1 text-[9px] bg-[#f7f7f7] border border-[#dfdfdf] rounded hover:border-zinc-500 transition-colors text-zinc-400 hover:text-zinc-900" title="Preencher container">Preencher</button>
          </div>
      </div>

      <!-- Contorno Sticker (alpha-based, somente imagens) -->
      <div v-if="isImage" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center justify-between group">
              <div class="flex items-center gap-1.5">
                <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                <span class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Contorno Sticker</span>
              </div>
              <button
                type="button"
                class="flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors"
                @click="$emit('update-property', 'stickerOutlineEnabled', !stickerOutlineEnabled)"
              >
                <span :class="stickerOutlineEnabled ? 'text-green-400' : 'text-red-400'">{{ stickerOutlineEnabled ? 'ATIVO' : 'INATIVO' }}</span>
              </button>
          </div>

          <!-- Aviso: sem transparência -->
          <div v-if="stickerOutlineEnabled && stickerNoTransparency" class="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
              <svg class="w-3 h-3 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              <span class="text-[9px] text-yellow-300">Imagem sem transparência — o contorno será retangular.</span>
          </div>

	          <div :class="!stickerOutlineEnabled ? 'opacity-50 pointer-events-none' : ''" class="space-y-1.5">
	              <!-- Posição (Interno / Externo) -->
	              <div class="flex items-center justify-between gap-2">
	                  <span class="text-[9px] text-zinc-500">Posição</span>
	                  <div class="flex items-center bg-[#f7f7f7] border border-[#dfdfdf] rounded overflow-hidden h-6">
	                      <button
	                        type="button"
	                        class="px-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
	                        :class="stickerOutlineMode === 'outside' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-900'"
	                        @click="$emit('update-property', 'stickerOutlineMode', 'outside')"
	                      >
	                        Externo
	                      </button>
	                      <div class="w-px h-full bg-[#ececec]"></div>
	                      <button
	                        type="button"
	                        class="px-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
	                        :class="stickerOutlineMode === 'inside' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-zinc-900'"
	                        @click="$emit('update-property', 'stickerOutlineMode', 'inside')"
	                      >
	                        Interno
	                      </button>
	                  </div>
	              </div>

	              <!-- Cor + Espessura -->
	              <div class="flex items-center gap-1.5">
	                  <div
	                    ref="stickerOutlineColorPickerRef"
                    class="relative"
                  >
                    <div
                      class="w-5 h-5 rounded border border-[#dfdfdf] cursor-pointer shrink-0 relative overflow-hidden"
                      :style="{ backgroundColor: stickerOutlineColor }"
                      @click="showStickerOutlineColorPicker = true"
                    ></div>
                    <ColorPicker
                      :show="showStickerOutlineColorPicker"
                      :model-value="stickerOutlineColor"
                      :trigger-element="stickerOutlineColorPickerRef"
                      @update:show="showStickerOutlineColorPicker = $event"
                      @update:model-value="(val: string) => $emit('update-property', 'stickerOutlineColor', val)"
                    />
                  </div>
                  <input
                    type="text"
                    :value="stickerOutlineColor.replace('#', '').toUpperCase()"
                    @change="e => $emit('update-property', 'stickerOutlineColor', '#' + (e.target as any).value.replace('#', ''))"
                    class="flex-1 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 font-mono focus:outline-none focus:border-amber-500/50 uppercase min-w-0"
                    placeholder="FFFFFF"
                    maxlength="6"
                  />
                  <div class="flex items-center gap-0.5">
                    <span class="text-[9px] text-zinc-500">W</span>
                    <input
                      type="number"
                      :value="stickerOutlineWidth"
                      @input="e => $emit('update-property', 'stickerOutlineWidth', Math.max(1, Number((e.target as any).value)))"
                      class="w-10 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 text-center focus:outline-none focus:border-amber-500/50"
                      title="Espessura do contorno sticker (px)"
                      min="1"
                      max="50"
                    />
                  </div>
              </div>

              <!-- Opacidade -->
              <div class="space-y-0.5">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] text-zinc-500">Opacidade</span>
                    <span class="text-[9px] text-zinc-400">{{ Math.round(stickerOutlineOpacity * 100) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    :value="stickerOutlineOpacity"
                    @input="e => $emit('update-property', 'stickerOutlineOpacity', Number((e.target as any).value))"
                    class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
              </div>
          </div>
      </div>

      <!-- Contorno -->
      <div class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center justify-between group">
              <div class="flex items-center gap-1.5">
                <svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" stroke-dasharray="4 2"/></svg>
                <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Contorno</span>
              </div>
              <button
                type="button"
                class="flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors"
                @click="$emit('update-property', 'strokeEnabled', !strokeEnabled)"
              >
                <span :class="strokeEnabled ? 'text-green-400' : 'text-red-400'">{{ strokeEnabled ? 'ATIVO' : 'INATIVO' }}</span>
              </button>
          </div>
          
          <div class="flex items-center gap-1.5 group" :class="!strokeEnabled ? 'opacity-50 pointer-events-none' : ''">
              <div 
                ref="strokeColorPickerRef"
                class="relative"
              >
                <div 
                  class="w-5 h-5 rounded border border-[#dfdfdf] cursor-pointer shrink-0 relative overflow-hidden"
                  :style="{ backgroundColor: getVal('stroke', '#000000') || '#000000' }"
                  @click="showStrokeColorPicker = true"
                ></div>
                <ColorPicker
                  :show="showStrokeColorPicker"
                  :model-value="getVal('stroke', '#000000') || '#000000'"
                  :trigger-element="strokeColorPickerRef"
                  @update:show="showStrokeColorPicker = $event"
                  @update:model-value="(val: string) => $emit('update-property', 'stroke', val)"
                />
              </div>
              <input 
                type="text" 
                :value="(getVal('stroke', '') || '#000000').toString().replace('#', '').toUpperCase()" 
                @change="e => $emit('update-property', 'stroke', '#' + (e.target as any).value.replace('#', ''))" 
                class="flex-1 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 font-mono focus:outline-none focus:border-[#b3261e]/55 uppercase min-w-0" 
                placeholder="1E1E1E"
                maxlength="6"
              />
              
              <input type="number" :value="getVal('strokeWidth', 0)" @input="e => $emit('update-property', 'strokeWidth', Number((e.target as any).value))" class="w-10 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 text-center focus:outline-none focus:border-[#b3261e]/55" title="Espessura do contorno" />
          </div>
          
          <!-- Opções do Contorno -->
          <div class="space-y-1.5" v-if="strokeEnabled && getVal('strokeWidth', 0) > 0">
               <!-- Posição (Interno/Centro/Externo) -->
               <div v-if="isVectorPath" class="space-y-0.5">
                   <label class="text-[9px] text-zinc-500 font-medium">Posição</label>
                   <select :value="getVal('strokePosition', 'center')" @change="e => $emit('update-property', 'strokePosition', (e.target as any).value)" class="w-full bg-[#f7f7f7] text-[10px] text-zinc-900 rounded border border-[#dfdfdf] h-5 px-1.5 focus:outline-none focus:border-[#b3261e]/55">
                       <option value="inside">Interno</option>
                       <option value="center">Centro</option>
                       <option value="outside">Externo</option>
                   </select>
               </div>
               
               <!-- Espessura -->
               <div v-if="isVectorPath" class="space-y-0.5">
                   <label class="text-[9px] text-zinc-500 font-medium">Espessura</label>
                   <div class="flex items-center gap-1.5">
                       <input type="number" :value="getVal('strokeWidth', 1)" @input="e => $emit('update-property', 'strokeWidth', Number((e.target as any).value))" class="flex-1 bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55" />
                   </div>
               </div>
               
               <div class="grid grid-cols-2 gap-1.5">
                    <select :value="getVal('strokeLineCap', 'butt')" @change="e => $emit('update-property', 'strokeLineCap', (e.target as any).value)" class="bg-[#f7f7f7] text-[9px] text-zinc-900 rounded border border-[#dfdfdf] h-5 px-1 focus:outline-none focus:border-[#b3261e]/55">
                        <option value="butt">Terminal: Reto</option>
                        <option value="round">Terminal: Arredondado</option>
                        <option value="square">Terminal: Quadrado</option>
                    </select>
                    <select :value="getVal('strokeLineJoin', 'miter')" @change="e => $emit('update-property', 'strokeLineJoin', (e.target as any).value)" class="bg-[#f7f7f7] text-[9px] text-zinc-900 rounded border border-[#dfdfdf] h-5 px-1 focus:outline-none focus:border-[#b3261e]/55">
                        <option value="miter">Junção: Esquadro</option>
                        <option value="round">Junção: Arredondada</option>
                        <option value="bevel">Junção: Chanfro</option>
                    </select>
               </div>
               
               <!-- Limite de Esquadro -->
               <div v-if="getVal('strokeLineJoin', 'miter') === 'miter'" class="space-y-0.5">
                   <label class="text-[9px] text-zinc-500 font-medium">Limite de esquadro</label>
                   <input type="number" :value="getVal('strokeMiterLimit', 4)" @input="e => $emit('update-property', 'strokeMiterLimit', Number((e.target as any).value))" class="w-full bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] px-1.5 h-6 focus:outline-none focus:border-[#b3261e]/55" min="1" max="100" step="0.1" />
               </div>
               
               <!-- Padrão de Traço -->
               <div class="space-y-0.5">
                   <label class="text-[9px] text-zinc-500 font-medium">Padrão de traço</label>
                   <div class="flex justify-between items-center">
                       <button class="text-[9px] px-2 py-0.5 rounded hover:bg-[#ececec] transition-colors" :class="!getVal('strokeDashArray') ? 'bg-[#fde9e7] text-[#b3261e]' : 'text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'strokeDashArray', null)">Sólido</button>
                       <button class="text-[9px] px-2 py-0.5 rounded hover:bg-[#ececec] transition-colors" :class="JSON.stringify(getVal('strokeDashArray')) === JSON.stringify([12, 8]) ? 'bg-[#fde9e7] text-[#b3261e]' : 'text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'strokeDashArray', [12, 8])">Tracejado</button>
                       <button class="text-[9px] px-2 py-0.5 rounded hover:bg-[#ececec] transition-colors" :class="JSON.stringify(getVal('strokeDashArray')) === JSON.stringify([2, 6]) ? 'bg-[#fde9e7] text-[#b3261e]' : 'text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'strokeDashArray', [2, 6])">Pontilhado</button>
                   </div>
               </div>
               
               <!-- Botão Avançado -->
               <button class="w-full flex items-center justify-between px-1.5 py-1 bg-[#f7f7f7] border border-[#dfdfdf] rounded hover:bg-[#f4f4f4] transition-colors text-[9px] text-zinc-400 hover:text-zinc-900">
                   <span>Avançado</span>
                   <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                   </svg>
               </button>
          </div>
      </div>

      <!-- Arredondamento -->
      <div v-if="isRectLike && !isImage" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5">
          <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2"/></svg>
                <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Arredondamento</span>
              </div>
              <button
                type="button"
                class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors text-zinc-400 hover:text-zinc-900"
                @click="() => {
                  if (useIndividualRadii) {
                    $emit('update-property', 'cornerRadius', Number(cornerRadii.tl || 0))
                    $emit('update-property', 'cornerRadii', null)
                  } else {
                    $emit('update-property', 'cornerRadii', { ...cornerRadii })
                  }
                }"
              >
                {{ useIndividualRadii ? 'Unificar' : 'Individuais' }}
              </button>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
              <div class="flex items-center gap-1.5 bg-[#f7f7f7] rounded border border-[#dfdfdf] px-1.5 h-6">
                  <span class="text-[9px] text-zinc-500">R</span>
                  <input
                    type="number"
                    :value="Math.round(cornerRadii.tl || 0)"
                    @input="e => $emit('update-property', 'cornerRadius', Number((e.target as any).value))"
                    class="bg-transparent w-full text-[11px] text-zinc-900 focus:outline-none"
                  />
              </div>
              <div class="text-[9px] text-zinc-500 flex items-center justify-end">
                  {{ useIndividualRadii ? 'Individuais' : 'Todos iguais' }}
              </div>
          </div>

          <div class="grid grid-cols-4 gap-1.5" v-if="useIndividualRadii">
              <div class="flex flex-col gap-0.5">
                  <label class="text-[8px] text-zinc-500" title="Superior esquerdo">SE</label>
                  <input type="number" class="w-full bg-[#f7f7f7] border border-[#dfdfdf] rounded px-1.5 h-6 text-[11px] text-zinc-900 focus:outline-none focus:border-[#b3261e]/55" :value="cornerRadii.tl" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, tl: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-0.5">
                  <label class="text-[8px] text-zinc-500" title="Superior direito">SD</label>
                  <input type="number" class="w-full bg-[#f7f7f7] border border-[#dfdfdf] rounded px-1.5 h-6 text-[11px] text-zinc-900 focus:outline-none focus:border-[#b3261e]/55" :value="cornerRadii.tr" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, tr: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-0.5">
                  <label class="text-[8px] text-zinc-500" title="Inferior direito">ID</label>
                  <input type="number" class="w-full bg-[#f7f7f7] border border-[#dfdfdf] rounded px-1.5 h-6 text-[11px] text-zinc-900 focus:outline-none focus:border-[#b3261e]/55" :value="cornerRadii.br" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, br: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-0.5">
                  <label class="text-[8px] text-zinc-500" title="Inferior esquerdo">IE</label>
                  <input type="number" class="w-full bg-[#f7f7f7] border border-[#dfdfdf] rounded px-1.5 h-6 text-[11px] text-zinc-900 focus:outline-none focus:border-[#b3261e]/55" :value="cornerRadii.bl" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, bl: Number((e.target as any).value) })" />
              </div>
          </div>
      </div>

	      <!-- Efeitos (Geral / Texto / Imagem) -->
	      <div class="border-b border-[#e7e7e7]">
	          <button
	            type="button"
	            class="w-full px-3 py-2 flex items-center justify-between hover:bg-[#f4f4f4] transition-colors"
	            @click="toggleSection('effects')"
	          >
	              <div class="flex items-center gap-2">
	                <Sparkles class="w-3 h-3 text-zinc-300" />
	                <span class="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">Efeitos</span>
	                <span v-if="effectsCount > 0" class="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#fde9e7] text-[#8f1e19] border border-[#b3261e]/20">
	                  {{ effectsCount }}
	                </span>
	              </div>
	              <div class="flex items-center gap-1">
	                <button
	                  v-if="effectsCount > 0"
	                  type="button"
	                  class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors text-zinc-400 hover:text-zinc-900"
	                  @click.stop="$emit('update-property', 'effects-reset', true)"
	                  title="Resetar efeitos"
	                >
	                  Reset
	                </button>
	                <ChevronsDown v-if="isSectionCollapsed('effects')" class="w-3.5 h-3.5 text-zinc-500" />
	                <ChevronsUp v-else class="w-3.5 h-3.5 text-zinc-500" />
	              </div>
	          </button>

	          <div v-show="!isSectionCollapsed('effects')" class="px-3 pb-3 space-y-3">
	              <!-- Shadow / Glow -->
	              <div class="bg-[#f7f7f7] border border-[#dfdfdf] rounded-lg p-2 space-y-2">
	                  <div class="flex items-center justify-between">
	                      <div class="flex items-center gap-2">
	                          <Zap class="w-3 h-3 text-amber-300" />
	                          <span class="text-[10px] font-bold text-amber-200 uppercase tracking-widest">Sombra</span>
	                          <span v-if="shadowType === 'glow'" class="text-[9px] text-amber-300/80">(Glow)</span>
	                      </div>
	                      <button
	                        type="button"
	                        class="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors"
	                        @click="$emit('update-property', 'shadow', shadowEnabled ? null : { color: 'rgba(0,0,0,0.35)', blur: 12, x: 0, y: 6 })"
	                      >
	                        <span :class="shadowEnabled ? 'text-green-400' : 'text-red-400'">{{ shadowEnabled ? 'ATIVO' : 'INATIVO' }}</span>
	                      </button>
	                  </div>

	                  <div :class="!shadowEnabled ? 'opacity-50 pointer-events-none' : ''" class="space-y-2">
	                      <div class="flex items-center justify-between gap-2">
	                          <span class="text-[9px] text-zinc-500">Tipo</span>
	                          <div class="flex items-center bg-[#f7f7f7] border border-[#dfdfdf] rounded overflow-hidden h-6">
	                              <button
	                                type="button"
	                                class="px-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
	                                :class="shadowType === 'drop' ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-400 hover:text-zinc-900'"
	                                @click="$emit('update-property', 'shadow-x', Number(selectedShadow?.offsetX || 0)); $emit('update-property', 'shadow-y', 6)"
	                              >
	                                Sombra
	                              </button>
	                              <div class="w-px h-full bg-[#ececec]"></div>
	                              <button
	                                type="button"
	                                class="px-2 text-[9px] font-bold uppercase tracking-widest transition-colors"
	                                :class="shadowType === 'glow' ? 'bg-amber-500/20 text-amber-200' : 'text-zinc-400 hover:text-zinc-900'"
	                                @click="$emit('update-property', 'shadow-x', 0); $emit('update-property', 'shadow-y', 0)"
	                              >
	                                Glow
	                              </button>
	                          </div>
	                      </div>

	                      <div class="flex items-center gap-1.5">
	                          <div ref="shadowColorPickerRef" class="relative">
	                              <div
	                                class="w-5 h-5 rounded border border-[#dfdfdf] cursor-pointer shrink-0 relative overflow-hidden"
	                                :style="{ backgroundColor: shadowHex }"
	                                @click="showShadowColorPicker = true"
	                              ></div>
	                              <ColorPicker
	                                :show="showShadowColorPicker"
	                                :model-value="shadowHex"
	                                :trigger-element="shadowColorPickerRef"
	                                @update:show="showShadowColorPicker = $event"
	                                @update:model-value="(val: string) => {
	                                  const c = parseColorToRgba(val)
	                                  $emit('update-property', 'shadow-color', rgbaString(c.r, c.g, c.b, shadowOpacity))
	                                }"
	                              />
	                          </div>
	                          <input
	                            type="text"
	                            :value="shadowHex.replace('#', '')"
	                            @change="e => {
	                              const c = parseColorToRgba('#' + (e.target as any).value.replace('#',''))
	                              $emit('update-property', 'shadow-color', rgbaString(c.r, c.g, c.b, shadowOpacity))
	                            }"
	                            class="flex-1 h-6 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-[11px] text-zinc-900 px-1.5 font-mono focus:outline-none focus:border-amber-500/40 uppercase min-w-0"
	                            maxlength="6"
	                          />
	                          <div class="flex items-center gap-1">
	                              <span class="text-[9px] text-zinc-500">Op</span>
	                              <input
	                                type="range"
	                                min="0"
	                                max="1"
	                                step="0.05"
	                                :value="shadowOpacity"
	                                @input="e => $emit('update-property', 'shadow-opacity', Number((e.target as any).value))"
	                                class="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
	                                title="Opacidade"
	                              />
	                          </div>
	                      </div>

	                      <div class="grid grid-cols-3 gap-2">
	                          <div class="space-y-0.5">
	                              <div class="flex justify-between items-center">
	                                <span class="text-[9px] text-zinc-500">X</span>
	                                <span class="text-[9px] text-zinc-400">{{ Number(selectedShadow?.offsetX || 0) }}</span>
	                              </div>
	                              <input type="range" min="-50" max="50" step="1" :value="Number(selectedShadow?.offsetX || 0)" @input="e => $emit('update-property', 'shadow-x', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
	                          </div>
	                          <div class="space-y-0.5">
	                              <div class="flex justify-between items-center">
	                                <span class="text-[9px] text-zinc-500">Y</span>
	                                <span class="text-[9px] text-zinc-400">{{ Number(selectedShadow?.offsetY || 0) }}</span>
	                              </div>
	                              <input type="range" min="-50" max="50" step="1" :value="Number(selectedShadow?.offsetY || 0)" @input="e => $emit('update-property', 'shadow-y', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
	                          </div>
	                          <div class="space-y-0.5">
	                              <div class="flex justify-between items-center">
	                                <span class="text-[9px] text-zinc-500">Blur</span>
	                                <span class="text-[9px] text-zinc-400">{{ Number(selectedShadow?.blur || 0) }}</span>
	                              </div>
	                              <input type="range" min="0" max="60" step="1" :value="Number(selectedShadow?.blur || 0)" @input="e => $emit('update-property', 'shadow-blur', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
	                          </div>
	                      </div>
	                  </div>
	              </div>

	              <!-- Image-only effects -->
              <div v-if="canRemoveImageBg || canReplaceProductCardImage" class="bg-[#f7f7f7] border border-[#dfdfdf] rounded-lg p-2 space-y-2">
	                  <div class="flex items-center justify-between">
	                      <div class="flex items-center gap-2">
	                          <Scan class="w-3 h-3 text-pink-300" />
	                          <span class="text-[10px] font-bold text-pink-200 uppercase tracking-widest">Imagem</span>
	                      </div>
	                      <div class="flex items-center gap-1">
	                          <button
	                            type="button"
	                            @click="$emit('action', 'ai-edit-image')"
	                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
	                            title="Editar imagem com IA"
	                          >
	                            <Sparkles class="w-2.5 h-2.5" />
	                            IA
	                          </button>
                          <button
                            v-if="canReplaceProductCardImage"
                            type="button"
                            @click="$emit('action', 'replace-product-image-upload')"
                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
                            title="Substituir imagem usando uploads"
                          >
                            Upload
                          </button>
                          <button
                            v-if="canReplaceProductCardImage"
                            type="button"
                            @click="$emit('action', 'replace-product-image')"
                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
                            title="Substituir imagem por arquivo local"
                          >
                            Arquivo
                          </button>
                          <button
                            v-if="canReplaceProductCardImage"
                            type="button"
                            @click="$emit('action', 'add-product-image-upload')"
                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
                            title="Adicionar imagem do upload mantendo a atual"
                          >
                            +Upload
                          </button>
                          <button
                            v-if="canReplaceProductCardImage"
                            type="button"
                            @click="$emit('action', 'add-product-image-local')"
                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
                            title="Adicionar arquivo local mantendo a imagem atual"
                          >
                            +Arquivo
                          </button>
                          <button
                            type="button"
                            @click="$emit('action', 'remove-image-bg')"
                            class="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] bg-zinc-200 hover:bg-zinc-300 rounded transition-colors border border-[#dfdfdf]"
                            title="Remover fundo da imagem"
                            :disabled="!canRemoveImageBg"
                            :class="{ 'opacity-50 cursor-not-allowed': !canRemoveImageBg }"
                          >
                            Fundo
                          </button>
	                      </div>
	                  </div>

	                  <div v-if="isImage" class="space-y-2">
	                      <div class="space-y-0.5">
	                          <div class="flex justify-between items-center">
	                            <span class="text-[9px] text-zinc-500">Desfoque</span>
	                            <span class="text-[9px] text-zinc-400">{{ filterBlurPx }}px</span>
	                          </div>
	                          <input type="range" min="0" max="20" step="1" :value="filterBlurPx" @input="e => $emit('update-property', 'filter-blur', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e]" />
	                      </div>

	                      <div class="space-y-0.5">
	                          <div class="flex justify-between items-center">
	                            <span class="text-[9px] text-zinc-500">Brilho</span>
	                            <span class="text-[9px] text-zinc-400">{{ filterBrightness.toFixed(2) }}</span>
	                          </div>
	                          <input type="range" min="-1" max="1" step="0.05" :value="filterBrightness" @input="e => $emit('update-property', 'filter-brightness', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e]" />
	                      </div>

	                      <div class="space-y-0.5">
	                          <div class="flex justify-between items-center">
	                            <span class="text-[9px] text-zinc-500">Contraste</span>
	                            <span class="text-[9px] text-zinc-400">{{ filterContrast.toFixed(2) }}</span>
	                          </div>
	                          <input type="range" min="-1" max="1" step="0.05" :value="filterContrast" @input="e => $emit('update-property', 'filter-contrast', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e]" />
	                      </div>

	                      <div class="space-y-0.5">
	                          <div class="flex justify-between items-center">
	                            <span class="text-[9px] text-zinc-500">Saturação</span>
	                            <span class="text-[9px] text-zinc-400">{{ filterSaturation.toFixed(2) }}</span>
	                          </div>
	                          <input type="range" min="-1" max="1" step="0.05" :value="filterSaturation" @input="e => $emit('update-property', 'filter-saturation', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e]" />
	                      </div>

	                      <div class="space-y-0.5">
	                          <div class="flex justify-between items-center">
	                            <span class="text-[9px] text-zinc-500">Matiz</span>
	                            <span class="text-[9px] text-zinc-400">{{ filterHue.toFixed(2) }}</span>
	                          </div>
	                          <input type="range" min="-1" max="1" step="0.05" :value="filterHue" @input="e => $emit('update-property', 'filter-hue', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#b3261e]" />
	                      </div>

	                      <div class="grid grid-cols-3 gap-1.5">
	                          <button type="button" class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors" :class="filterGrayscale ? 'bg-[#fde9e7] text-[#8f1e19] border-[#b3261e]/30' : 'bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'filter-grayscale', !filterGrayscale)">P&B</button>
	                          <button type="button" class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors" :class="filterSepia ? 'bg-[#fde9e7] text-[#8f1e19] border-[#b3261e]/30' : 'bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'filter-sepia', !filterSepia)">Sépia</button>
	                          <button type="button" class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors" :class="filterInvert ? 'bg-[#fde9e7] text-[#8f1e19] border-[#b3261e]/30' : 'bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900'" @click="$emit('update-property', 'filter-invert', !filterInvert)">Inverter</button>
	                      </div>

	                      <div class="flex justify-end">
	                          <button
	                            type="button"
	                            class="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#f2f2f2] border border-[#dfdfdf] hover:bg-[#ececec] transition-colors text-zinc-400 hover:text-zinc-900"
	                            @click="$emit('update-property', 'filters-reset', true)"
	                            title="Resetar ajustes da imagem"
	                          >
	                            Reset ajustes
	                          </button>
	                      </div>
	                  </div>

	                  <div v-else class="text-[10px] text-zinc-500">
	                    Selecione uma imagem para aplicar ajustes.
	                  </div>
	              </div>

	              <!-- Text helper effects (quick access) -->
	              <div v-if="isText" class="bg-[#f7f7f7] border border-[#dfdfdf] rounded-lg p-2 space-y-2">
	                  <div class="flex items-center gap-2">
	                      <Type class="w-3 h-3 text-teal-300" />
	                      <span class="text-[10px] font-bold text-teal-200 uppercase tracking-widest">Efeitos de Texto</span>
	                  </div>
	                  <div class="grid grid-cols-2 gap-1.5">
	                      <button
	                        type="button"
	                        class="h-7 rounded border text-[9px] font-bold uppercase tracking-widest transition-colors"
	                        :class="getVal('__text3dEnabled', false) ? 'border-amber-400/60 bg-amber-500/20 text-amber-200' : 'border-[#dfdfdf] bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900'"
	                        @click="$emit('action', 'text-3d-gold')"
	                        title="Aplicar efeito 3D dourado"
	                      >
	                        3D Ouro
	                      </button>
	                      <button
	                        type="button"
	                        class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900"
	                        @click="$emit('action', 'text-gradient-gold')"
	                        title="Aplicar gradiente dourado"
	                      >
	                        Gradiente Ouro
	                      </button>
	                      <button
	                        type="button"
	                        class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900"
	                        @click="$emit('action', 'text-gradient-sunset')"
	                        title="Aplicar gradiente quente"
	                      >
	                        Gradiente Quente
	                      </button>
	                      <button
	                        type="button"
	                        class="h-7 rounded border border-[#dfdfdf] text-[9px] font-bold uppercase tracking-widest transition-colors bg-[#f7f7f7] text-zinc-400 hover:text-zinc-900"
	                        @click="$emit('action', 'text-3d-clear')"
	                        title="Remover efeito 3D e sombra"
	                      >
	                        Limpar 3D
	                      </button>
	                  </div>
	              </div>
	          </div>
	      </div>

      <!-- Grade Inteligente -->
      <div v-if="isSmartGroup" class="px-3 py-2 border-b border-[#e7e7e7] space-y-1.5 bg-[#fde9e7]/45">
          <div class="flex items-center gap-1.5">
             <Box class="w-3 h-3 text-[#b3261e]" />
             <span class="text-[10px] font-bold text-[#b3261e] uppercase tracking-widest">Item de Grade Inteligente</span>
          </div>
          <div class="space-y-1">
               <label class="text-[9px] text-zinc-400 font-medium">Modo</label>
               <select :value="getVal('priceMode', 'standard')" @change="e => $emit('update-smart-group', 'priceMode', (e.target as any).value)" class="w-full bg-[#f7f7f7] text-[11px] text-zinc-900 rounded border border-[#dfdfdf] h-6 px-1.5 focus:outline-none focus:border-[#b3261e]/55">
                   <option value="standard">Padrão</option>
                   <option value="de_por">De / Por</option>
                   <option value="clube">Clube</option>
                   <option value="atacarejo">Atacarejo</option>
               </select>
          </div>
      </div>

      <!-- 9. Zona de Produtos -->
      <div v-show="isProductZone" class="border-b border-[#e7e7e7]">
          <div class="px-3 py-1.5 flex items-center gap-1.5 border-b border-[#e7e7e7]">
             <LayoutGrid class="w-3 h-3 text-green-400" />
             <span class="text-[10px] font-bold text-green-400 uppercase tracking-widest">Zona de Produtos</span>
          </div>
          <ProductZoneSettings
            v-if="isProductZone"
            :zone="currentZoneData"
            :global-styles="currentGlobalStyles"
            :label-templates="labelTemplates"
            @update:zone="(prop, val) => $emit('update-zone', prop, val)"
            @update:global-styles="(prop, val) => $emit('update-global-styles', prop, val)"
            @apply-preset="presetId => $emit('apply-preset', presetId)"
            @sync-gaps="padding => $emit('sync-gaps', padding)"
            @recalculate="$emit('recalculate-layout')"
            @manage-label-templates="$emit('manage-label-templates')"
            @apply-template-to-zone="$emit('apply-template-to-zone')"
          />
      </div>

      </div> <!-- End Design Tab -->

      <!-- Prototype Tab -->
      <div v-if="activeTab === 'prototype'" class="flex-1 overflow-y-auto">
        <!-- Seção de Interações -->
        <div v-if="selectedObject" class="p-4 border-b border-[#e7e7e7] space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <MousePointer2 class="w-3.5 h-3.5 text-[#b3261e]" />
              <span class="text-[11px] font-bold text-[#b3261e] uppercase tracking-widest">Interações</span>
            </div>
            <button
              @click="$emit('add-interaction')"
              class="w-6 h-6 hover:bg-[#ececec] rounded-lg flex items-center justify-center transition-all"
              title="Adicionar interação"
            >
              <Plus class="w-3 h-3 text-zinc-400" />
            </button>
          </div>
          
          <!-- Lista de Interações -->
          <div v-if="getVal('interactionDestination')" class="space-y-2">
            <div class="flex items-center justify-between p-2.5 bg-[#f7f7f7] rounded-lg border border-[#dfdfdf]">
              <div class="flex items-center gap-2">
                <ArrowRightFromLine class="w-3 h-3 text-[#b3261e]" />
                <span class="text-xs text-zinc-900">Navegar para página</span>
              </div>
              <select
                :value="getVal('interactionDestination')"
                @change="e => $emit('update-property', 'interactionDestination', (e.target as any).value)"
                class="bg-white border border-[#dfdfdf] rounded-md text-xs text-zinc-900 px-2 py-1 focus:outline-none focus:border-[#b3261e]/55"
              >
                <option value="">Nenhuma</option>
                <option v-for="(page, idx) in targetPages" :key="idx" :value="idx">{{ page.name }}</option>
              </select>
            </div>
          </div>
          
          <div v-else class="text-center py-8 text-zinc-500 text-xs">
            Sem interações adicionadas
          </div>
        </div>

        <!-- Seção de Animação -->
        <div v-if="selectedObject" class="p-4 border-b border-[#e7e7e7] space-y-3">
          <div class="flex items-center gap-2">
            <Zap class="w-3.5 h-3.5 text-amber-400" />
            <span class="text-[11px] font-bold text-amber-400 uppercase tracking-widest">Animação</span>
          </div>
          
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500 font-medium">Tipo</label>
            <select
              :value="getVal('animationType', 'none')"
              @change="e => $emit('update-property', 'animationType', (e.target as any).value)"
              class="w-full bg-[#f7f7f7] text-xs text-zinc-900 rounded-md border border-[#dfdfdf] px-2 h-7 focus:outline-none focus:border-[#b3261e]/55"
            >
              <option value="none">Nenhuma</option>
              <option value="fade">Desvanecer</option>
              <option value="slide">Deslizar</option>
              <option value="scale">Escala</option>
            </select>
          </div>
          
          <div v-if="getVal('animationType') !== 'none'" class="space-y-1.5">
            <label class="text-[10px] text-zinc-500 font-medium">Duração (ms)</label>
            <input
              type="number"
              :value="getVal('animationDuration', 300)"
              @input="e => $emit('update-property', 'animationDuration', Number((e.target as any).value))"
              class="w-full bg-[#f7f7f7] border border-[#dfdfdf] rounded-md px-2 h-7 text-xs text-zinc-900 focus:outline-none focus:border-[#b3261e]/55"
              min="0"
              max="5000"
            />
          </div>
        </div>
      </div> <!-- Fim aba Protótipo -->

    </div>
  </div>

  <!-- Estado vazio (sem seleção) -->
  <div v-else class="h-full bg-white text-zinc-900 flex flex-col font-sans border-l border-[#e7e7e7] overflow-y-auto">
      <!-- Seção Página -->
      <div class="border-b border-[#e7e7e7]">
        <div class="px-3 py-2.5">
          <span class="text-xs font-semibold text-zinc-900">Página</span>
        </div>
        
        <!-- Propriedades da Página -->
        <div class="px-3 pb-3 overflow-visible">
          <div class="flex items-center gap-1.5 min-w-0 overflow-visible">
            <!-- Color Swatch -->
            <div 
              ref="pageColorPickerRef"
              class="relative shrink-0"
            >
              <div 
                class="w-6 h-6 rounded-md border border-[#dfdfdf] cursor-pointer shrink-0 relative overflow-hidden"
                :style="{ backgroundColor: getPageColorHex() }"
                @click="showPageColorPicker = true"
              ></div>
              <ColorPicker
                :show="showPageColorPicker"
                :model-value="getPageColorHex()"
                :trigger-element="pageColorPickerRef"
                @update:show="showPageColorPicker = $event"
                @update:model-value="(val: string) => handlePageColorChange(val)"
              />
            </div>
            
            <!-- Color Hex Input -->
            <input 
              type="text" 
              :value="getPageColorHex().replace('#', '').toUpperCase()" 
              @change="e => {
                const hex = '#' + (e.target as any).value.replace('#', '');
                handlePageColorChange(hex);
              }"
              class="flex-1 min-w-15 h-7 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-xs text-zinc-900 px-2 font-mono focus:outline-none focus:border-[#b3261e]/55 uppercase"
              placeholder="1E1E1E"
              maxlength="6"
            />
            
            <!-- Opacity Input -->
            <input 
              type="number" 
              :value="getPageOpacity()" 
              @input="e => {
                const opacity = Number((e.target as any).value) / 100;
                handlePageOpacityChange(opacity);
              }"
              class="w-9 h-7 bg-[#f7f7f7] border border-[#dfdfdf] rounded text-xs text-zinc-900 px-1 text-center focus:outline-none focus:border-[#b3261e]/55"
              min="0"
              max="100"
            />
            
            <span class="text-xs text-zinc-400 shrink-0">%</span>
            
            <!-- Visibilidade -->
            <button class="w-6 h-6 hover:bg-[#ececec] rounded flex items-center justify-center transition-all shrink-0 ml-auto" title="Alternar visibilidade da página">
              <Eye class="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Seção Variáveis -->
      <div class="border-b border-[#e7e7e7]">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#f4f4f4] transition-colors">
          <div class="flex items-center gap-2">
            <!-- Ícone de variáveis -->
            <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 16 16">
              <circle cx="4" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
              <circle cx="12" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
              <line x1="4" y1="6" x2="4" y2="10" stroke="currentColor" stroke-width="1"/>
              <line x1="12" y1="6" x2="12" y2="10" stroke="currentColor" stroke-width="1"/>
              <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1"/>
            </svg>
            <span class="text-xs font-semibold text-zinc-900">Variáveis</span>
          </div>
        </div>
      </div>
      
      <!-- Seção Estilos -->
      <div class="border-b border-[#e7e7e7]">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#f4f4f4] transition-colors">
          <span class="text-xs font-semibold text-zinc-900">Estilos</span>
          <button 
            @click="handleAddColorStyle"
            class="w-5 h-5 hover:bg-[#ececec] rounded-lg flex items-center justify-center transition-all shrink-0"
            title="Adicionar estilo de cor"
          >
            <Plus class="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
        <div v-if="colorStyles && colorStyles.length > 0" class="px-3 pb-2 flex flex-wrap gap-1.5">
          <button
            v-for="style in colorStyles"
            :key="style.id"
            @click="$emit('apply-color-style', style.id)"
            class="w-5 h-5 rounded border border-[#dfdfdf] hover:border-[#cfcfcf] transition-all relative shrink-0"
            :style="{ backgroundColor: style.value }"
            :title="style.name || style.value"
          >
            <span v-if="getPageColorHex() === style.value || (props.selectedObject && getVal('fill') === style.value)" class="absolute inset-0 border-2 border-[#111111] rounded"></span>
          </button>
        </div>
        <div v-else class="px-3 pb-2 text-[10px] text-zinc-500">
          Nenhum estilo ainda. Clique + para adicionar.
        </div>
      </div>
      
      <!-- Seção Exportar -->
      <div class="border-b border-[#e7e7e7]">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#f4f4f4] transition-colors">
          <span class="text-xs font-semibold text-zinc-900">Exportar</span>
          <button 
            @click="$emit('action', 'export-png')"
            class="w-5 h-5 hover:bg-[#ececec] rounded-lg flex items-center justify-center transition-all"
            title="Exportar página"
          >
            <Plus class="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
        <div class="px-3 pb-2 space-y-1">
          <button
            @click="$emit('action', 'export-png')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-900 hover:bg-[#f4f4f4] rounded-md transition-all"
          >
            Exportar como PNG
          </button>
          <button
            @click="$emit('action', 'export-svg')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-900 hover:bg-[#f4f4f4] rounded-md transition-all"
          >
            Exportar como SVG
          </button>
          <button
            @click="$emit('action', 'export-jpg')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-zinc-900 hover:bg-[#f4f4f4] rounded-md transition-all"
          >
            Exportar como JPG
          </button>
        </div>
      </div>
      
      <!-- Botão Ajuda -->
      <div class="mt-auto p-3 flex justify-end">
        <button class="w-7 h-7 hover:bg-[#ececec] rounded-full flex items-center justify-center transition-all" title="Ajuda">
          <span class="text-xs text-zinc-900 font-semibold">?</span>
        </button>
      </div>
  </div>
</template>

<style scoped>
/* ============================
   Painel de Propriedades - Estilos
   ============================ */

/* Scrollbar personalizada */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(113, 113, 122, 0.3); border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(113, 113, 122, 0.5); }

/* Remover setas de input numérico */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] { -moz-appearance: textfield; }

/* Protótipo */
.pp-interaction-card {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(179, 38, 30, 0.25);
  background: rgba(179, 38, 30, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pp-info-box {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e7e7e7;
  background: #f8f8f8;
}

.pp-info-box--collapsed {
  background: #f2f2f2;
}

/* Painel Design */
.pp-design-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Cabeçalho de seção (colapsável) */
.pp-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  text-align: left;
  transition: background-color 0.15s;
  cursor: pointer;
  border-bottom: 1px solid #e7e7e7;
}

.pp-section-header:hover {
  background: #f4f4f4;
}

.pp-section-header span {
  flex: 1;
  font-size: 10px;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pp-section-chevron {
  width: 14px;
  height: 14px;
  color: #52525b;
  transition: transform 0.2s ease;
}

.pp-section-chevron--collapsed {
  transform: rotate(-90deg);
}

.pp-section-content {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid #e7e7e7;
}

/* Linha de input */
.pp-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pp-input-label {
  font-size: 9px;
  color: #71717a;
  width: 14px;
  font-weight: 500;
  text-align: center;
  flex-shrink: 0;
}

/* Campo de input genérico */
.pp-input-field {
  flex: 1;
  background: #f7f7f7;
  border: 1px solid #dfdfdf;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 11px;
  color: #111827;
  transition: border-color 0.15s;
}

.pp-input-field:focus {
  outline: none;
  border-color: rgba(179, 38, 30, 0.5);
}

/* Input numérico */
.pp-number-input {
  width: 100%;
  background: #f7f7f7;
  border: 1px solid #dfdfdf;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 11px;
  color: #111827;
  text-align: center;
  transition: border-color 0.15s;
}

.pp-number-input:focus {
  outline: none;
  border-color: rgba(179, 38, 30, 0.5);
}

.pp-number-input:hover {
  border-color: #cfcfcf;
}

/* Slider com estilo */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  background: #d1d5db;
  border-radius: 3px;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #b3261e;
  border: 2px solid #ffffff;
  cursor: pointer;
  transition: transform 0.1s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

/* Select com estilo */
select {
  cursor: pointer;
  transition: border-color 0.15s;
}

select:hover {
  border-color: #cfcfcf !important;
}

/* Grids de layout */
.pp-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.pp-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.pp-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
</style>
