<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlignLeft, AlignCenter, AlignRight, 
  Bold, Italic, Underline, 
  Type, Palette, Layers, Box, 
  Plus, Minus, Trash2, MousePointer2,
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
  ChevronsDown
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
const isComponent = computed(() => props.selectedObject?.isComponent)

// Helper to detect if selected object is a ProductCard
const isProductCard = computed(() => {
  const obj = props.selectedObject
  if (!obj) return false
  return obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || String(obj.name || '').startsWith('product-card'))
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
  if (obj.isGridZone || obj.isProductZone) return true
  if (obj.name === 'gridZone' || obj.name === 'productZoneContainer') return true
  if (obj.type !== 'group') return false
  // Check for zone rect with dashed stroke
  const objs = typeof obj.getObjects === 'function' ? obj.getObjects() : (obj._objects || [])
  const zoneRect = objs.find((o: any) => 
    o?.type === 'rect' && (o.name === 'zoneRect' || o.name === 'zone-border' || Array.isArray(o.strokeDashArray))
  ) || objs.find((o: any) => o?.type === 'rect' && Array.isArray(o.strokeDashArray))
  return !!(zoneRect && Array.isArray(zoneRect.strokeDashArray))
}

const isProductZone = computed(() => isLikelyProductZone(props.selectedObject))
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
const collapsedSections = ref<Set<string>>(new Set(['effects', 'export', 'prototype-info'])) // Start some collapsed

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
const fillColorPickerRef = ref<HTMLElement | null>(null)
const strokeColorPickerRef = ref<HTMLElement | null>(null)
const pageColorPickerRef = ref<HTMLElement | null>(null)

// Track which input is currently focused to prevent value override during typing
const focusedInput = ref<string | null>(null)

// Helper to safely get value
const getVal = (prop: string, defaultVal: any = '') => props.selectedObject ? (props.selectedObject[prop] ?? defaultVal) : defaultVal

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
  const bg = props.pageSettings.backgroundColor || '#1e1e1e'
  if (bg.startsWith('rgba') || bg.startsWith('rgb')) {
    const match = bg.match(/rgba?\(([^)]+)\)/)
    if (match) {
      const parts = match[1].split(',').map(s => s.trim())
      const r = parseInt(parts[0])
      const g = parseInt(parts[1])
      const b = parseInt(parts[2])
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
  }
  return bg.startsWith('#') ? bg : `#${bg}`
}

const getPageOpacity = () => {
  const bg = props.pageSettings.backgroundColor || '#1e1e1e'
  if (bg.startsWith('rgba')) {
    const match = bg.match(/rgba\(([^)]+)\)/)
    if (match) {
      const parts = match[1].split(',').map(s => s.trim())
      const opacity = parseFloat(parts[3] || '1')
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
  const colorToAdd = props.selectedObject && getVal('fill') ? getVal('fill') : getPageColorHex()
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
  <div v-if="selectedObject" class="h-full bg-[#1a1a1a] text-white min-h-0 flex flex-col font-sans select-none">

    <!-- Tab Indicator (shows which tab is active) -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-white/5">
      <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" :class="activeTab === 'design' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-500'">
        <Palette class="w-3.5 h-3.5" />
        <span>Design</span>
      </div>
      <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" :class="activeTab === 'prototype' ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-500'">
        <MousePointer2 class="w-3.5 h-3.5" />
        <span>Prototype</span>
      </div>
    </div>

    <!-- Scrollable Inspector -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">

      <!-- PROTOTYPE TAB (Figma-style interactions panel) -->
      <div v-if="activeTab === 'prototype'" class="p-3 space-y-3">
        <!-- Empty state for prototype -->
        <div v-if="!getVal('interactionDestination', '')" class="text-center py-8">
          <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <MousePointer2 class="w-5 h-5 text-zinc-600" />
          </div>
          <p class="text-xs text-zinc-500 mb-1">Sem interações</p>
          <p class="text-[10px] text-zinc-600">Adicione uma ação ao clicar neste elemento</p>
        </div>

        <!-- Interaction Card -->
        <div v-else class="pp-interaction-card">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <MousePointer2 class="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div>
                <p class="text-xs font-medium text-white">Ao clicar</p>
                <p class="text-[10px] text-zinc-500">Ação de navegação</p>
              </div>
            </div>
            <button @click="$emit('update-property', 'interactionDestination', '')" class="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors" title="Remover interação">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Navegar para</label>
            <select :value="getVal('interactionDestination', '')" @change="e => $emit('update-property', 'interactionDestination', (e.target as any).value)" class="w-full bg-[#1e1e1e] text-xs text-white rounded-lg border border-zinc-800 h-9 px-3 focus:outline-none focus:border-violet-500/50">
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
            No modo <span class="text-violet-400">Apresentar</span>, clique em elementos com interações para navegar entre páginas.
          </div>
        </div>
      </div>

      <!-- DESIGN TAB (Figma-style design properties) -->
      <div v-else class="pp-design-panel">

      <!-- Quick Actions Bar (Visibility, Lock, Delete) -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div class="flex items-center gap-1">
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            :class="getVal('visible', true) ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/10'"
            @click="$emit('update-property', 'visible', !getVal('visible', true))"
            title="Visibilidade"
          >
            <Eye class="w-4 h-4" />
          </button>
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            :class="getVal('lockMovement', false) ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/10'"
            @click="$emit('update-property', 'lockMovement', !getVal('lockMovement', false))"
            :title="getVal('lockMovement', false) ? 'Desbloquear' : 'Bloquear'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
        </div>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          @click="$emit('action', 'delete')"
          title="Excluir"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <!-- 1. ALIGN & DISTRIBUTE (Top Bar) -->
      <div class="p-2 border-b border-white/5 flex flex-wrap gap-2 justify-between px-4 text-zinc-400">
          <div class="flex gap-1">
            <button @click="$emit('update-property', 'alignment', 'left')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Align Left"><AlignLeft class="w-3.5 h-3.5" /></button>
            <button @click="$emit('update-property', 'alignment', 'center')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Align Center"><AlignCenter class="w-3.5 h-3.5" /></button>
            <button @click="$emit('update-property', 'alignment', 'right')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Align Right"><AlignRight class="w-3.5 h-3.5" /></button>
          </div>
          
          <div class="w-px h-4 bg-white/10 my-auto"></div>

          <div class="flex gap-1">
             <button @click="$emit('action', 'distribute-h')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Distribute Horizontal"><ArrowRightFromLine class="w-3.5 h-3.5" /></button>
             <button @click="$emit('action', 'distribute-v')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Distribute Vertical"><ArrowDownFromLine class="w-3.5 h-3.5" /></button>
          </div>

          <div class="w-px h-4 bg-white/10 my-auto"></div>

          <div class="flex gap-1">
            <button @click="$emit('action', 'flip-h')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Flip Horizontal"><FlipHorizontal class="w-3.5 h-3.5" /></button>
            <button @click="$emit('action', 'flip-v')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Flip Vertical"><FlipVertical class="w-3.5 h-3.5" /></button>
          </div>

          <div v-if="isGroup" class="w-px h-4 bg-white/10 my-auto"></div>
          
          <div v-if="isGroup" class="flex gap-1">
             <button v-if="selectedObject.type === 'activeSelection'" @click="$emit('action', 'group')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Group"><Group class="w-3.5 h-3.5" /></button>
             <button v-if="selectedObject.type === 'group'" @click="$emit('action', 'ungroup')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Ungroup"><Ungroup class="w-3.5 h-3.5" /></button>
          </div>

          <!-- Boolean Operations -->
          <div v-if="isMultiSelect" class="w-px h-4 bg-white/10 my-auto"></div>
          <div v-if="isMultiSelect" class="flex gap-1">
             <button @click="$emit('action', 'union')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Union selection"><Combine class="w-3.5 h-3.5" /></button>
             <button @click="$emit('action', 'subtract')" class="hover:text-white p-1 rounded hover:bg-white/5" title="Subtract selection"><Scissors class="w-3.5 h-3.5" /></button>
          </div>

          <!-- Masking -->
          <div v-if="canMask" class="w-px h-4 bg-white/10 my-auto"></div>
          <div v-if="canMask" class="flex gap-1">
             <button @click="$emit('action', 'toggle-mask')" class="hover:text-white p-1 rounded hover:bg-white/5" :class="selectedObject.isMask ? 'text-violet-400 bg-violet-500/10' : ''" title="Use as Mask"><Scan class="w-3.5 h-3.5" /></button>
          </div>

          <!-- Auto-Layout Spacing (Gap) -->
          <div v-if="isGroup" class="w-px h-4 bg-white/10 my-auto"></div>
          <div v-if="isGroup" class="flex items-center gap-1 bg-[#2c2c2c] rounded px-1.5 h-7" title="Item Spacing (Gap)">
              <GripVertical class="w-3 h-3 text-zinc-500" />
              <input type="number" :value="selectedObject.gap || 0" @input="e => $emit('action', 'update-gap:' + (e.target as any).value)" class="bg-transparent w-8 text-[10px] text-white focus:outline-none text-center" />
          </div>
      </div>

      <!-- 2. LAYOUT & TRANSFORM (Collapsible) -->
      <div class="border-b border-white/5">
        <button
          class="pp-section-header"
          :class="{ 'pp-section-header--collapsed': isSectionCollapsed('transform') }"
          @click="toggleSection('transform')"
        >
          <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span>Posição & Tamanho</span>
          <svg class="pp-section-chevron" :class="{ 'pp-section-chevron--collapsed': isSectionCollapsed('transform') }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!isSectionCollapsed('transform')" class="pp-section-content">
          <div class="pp-grid-4">
            <div class="pp-input-row">
              <span class="pp-input-label">X</span>
              <input type="number" :value="displayLeft ?? Math.round(getVal('left', 0))" @focus="handleFocus('left')" @blur="handleBlur" @input="e => handlePropertyInput('left', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label">Y</span>
              <input type="number" :value="displayTop ?? Math.round(getVal('top', 0))" @focus="handleFocus('top')" @blur="handleBlur" @input="e => handlePropertyInput('top', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label">W</span>
              <input type="number" :value="displayWidth ?? Math.round(getScaledWidth())" @focus="handleFocus('width')" @blur="handleBlur" @input="e => handlePropertyInput('width', Number((e.target as any).value))" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label">H</span>
              <input type="number" :value="displayHeight ?? Math.round(getScaledHeight())" @focus="handleFocus('height')" @blur="handleBlur" @input="e => handlePropertyInput('height', Number((e.target as any).value))" class="pp-number-input" />
            </div>
          </div>
          <div class="pp-grid-3">
            <div class="pp-input-row">
              <span class="pp-input-label">∠</span>
              <input type="number" :value="displayAngle ?? Math.round(getVal('angle', 0))" @focus="handleFocus('angle')" @blur="handleBlur" @input="e => handlePropertyInput('angle', Number((e.target as any).value))" class="pp-number-input" />
              <span class="text-[10px] text-zinc-600">°</span>
            </div>
            <div class="pp-input-row" v-if="isRectLike && !isText">
              <span class="pp-input-label">R</span>
              <input type="number" :value="Math.round(cornerRadii.tl || 0)" @input="e => { $emit('update-property', 'rx', Number((e.target as any).value)); $emit('update-property', 'ry', Number((e.target as any).value)) }" class="pp-number-input" />
            </div>
            <div class="pp-input-row">
              <span class="pp-input-label opacity-0">O</span>
              <div class="flex-1 flex items-center gap-1">
                <input type="range" min="0" max="1" step="0.05" :value="Number(getVal('opacity', 1))" @input="$emit('update-property', 'opacity', Number(($event.target as any).value))" class="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                <span class="text-[10px] text-zinc-500 w-6 text-right">{{ Math.round(Number(getVal('opacity', 1)) * 100) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- VECTOR PATH SECTION (Figma Style) -->
      <div v-if="isVectorPath" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Vector</span>
          </div>
          
          <!-- Alignment Controls -->
          <div class="space-y-2">
              <label class="text-[10px] text-zinc-500">Alignment</label>
              <div class="flex items-center gap-1 flex-wrap">
                  <button @click="$emit('update-property', 'textAlign', 'left')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Left"><AlignLeft class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('update-property', 'textAlign', 'center')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Center"><AlignCenter class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('update-property', 'textAlign', 'right')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Right"><AlignRight class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('action', 'align-top')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Top"><ChevronsUp class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('action', 'align-middle')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Middle"><Minus class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('action', 'align-bottom')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Align Bottom"><ChevronsDown class="w-3.5 h-3.5" /></button>
                  <button @click="$emit('action', 'distribute-h')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Distribute Horizontal"><ArrowRightFromLine class="w-3.5 h-3.5" /></button>
              </div>
          </div>
          
          <!-- Position Controls -->
          <div class="space-y-2">
              <label class="text-[10px] text-zinc-500">Position</label>
              <div class="grid grid-cols-2 gap-2">
                  <div class="flex items-center gap-1.5">
                      <span class="text-[10px] text-zinc-500">X</span>
                      <input type="number" :value="Math.round(getVal('left', 0))" @input="e => $emit('update-property', 'left', Number((e.target as any).value))" class="flex-1 bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none" />
                  </div>
                  <div class="flex items-center gap-1.5">
                      <span class="text-[10px] text-zinc-500">Y</span>
                      <input type="number" :value="Math.round(getVal('top', 0))" @input="e => $emit('update-property', 'top', Number((e.target as any).value))" class="flex-1 bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none" />
                  </div>
              </div>
          </div>
          
          <!-- Point Type Conversion -->
          <div class="space-y-2">
              <label class="text-[10px] text-zinc-500">Point Type</label>
              <div class="flex items-center gap-1">
                  <button @click="$emit('action', 'convert-to-smooth')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Convert to Smooth (S)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'convert-to-corner')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Convert to Corner (C)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                  </button>
              </div>
          </div>
          
          <!-- Mirroring Controls -->
          <div class="space-y-2">
              <label class="text-[10px] text-zinc-500">Mirroring</label>
              <div class="flex items-center gap-1">
                  <button @click="$emit('action', 'mirror-handles')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Mirror Handles (M)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'reset-handles')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Reset Handles">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                  </button>
                  <button @click="$emit('action', 'smooth-handles')" class="w-7 h-7 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Smooth Handles (S)">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                  </button>
              </div>
          </div>
          
          <!-- Corner Radius (for closed paths) -->
          <div class="space-y-2">
              <div class="flex items-center justify-between">
                  <label class="text-[10px] text-zinc-500">Corner radius</label>
                  <button class="w-5 h-5 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Independent Corners">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                  </button>
              </div>
              <input type="number" :value="Math.round(cornerRadii.tl || 0)" @input="e => { $emit('update-property', 'rx', Number((e.target as any).value)); $emit('update-property', 'ry', Number((e.target as any).value)) }" class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none" />
          </div>
      </div>

      <!-- FRAME -->
      <div v-if="isFrame" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Frame</span>
          </div>
          <button
            type="button"
            class="w-full flex items-center justify-between rounded-md px-2.5 py-2 bg-[#2c2c2c] border border-white/10 hover:bg-white/10 transition-colors"
            @click="$emit('update-property', 'clipContent', !clipContentEnabled)"
          >
            <span class="text-xs text-zinc-200">Recortar conteudo</span>
            <span
              class="text-[10px] font-bold uppercase tracking-widest"
              :class="clipContentEnabled ? 'text-green-400' : 'text-red-400'"
            >
              {{ clipContentEnabled ? 'ON' : 'OFF' }}
            </span>
          </button>
      </div>

      <!-- 3. LAYER (Blend Mode) -->
      <div class="p-4 border-b border-black/20 space-y-2">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Layer</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
              <select :value="getVal('globalCompositeOperation', 'source-over')" @change="e => $emit('update-property', 'globalCompositeOperation', (e.target as any).value)" class="bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none">
                  <option value="source-over">Pass Through</option>
                  <option v-for="mode in BLEND_MODES" :key="mode" :value="mode">{{ mode }}</option>
              </select>
              <div class="flex items-center gap-2 bg-[#1e1e1e] rounded border border-black px-2 h-7">
                  <span class="text-[10px] text-zinc-500">%</span>
                  <input type="number" :value="Math.round(getVal('opacity', 1) * 100)" @input="e => $emit('update-property', 'opacity', Number((e.target as any).value) / 100)" class="bg-transparent w-full text-xs text-white focus:outline-none text-right" />
              </div>
          </div>
      </div>

      <!-- 4. TEXT (If Text) -->
      <div v-if="isText" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Text</span>
          </div>
          
          <select :value="getVal('fontFamily', 'Arial')" @change="e => $emit('update-property', 'fontFamily', (e.target as any).value)" class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 mb-2 focus:outline-none">
              <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
          </select>

          <div class="grid grid-cols-2 gap-2">
              <select :value="getVal('fontWeight', 'normal')" @change="e => $emit('update-property', 'fontWeight', (e.target as any).value)" class="bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none">
                  <option value="normal">Regular</option>
                  <option value="bold">Bold</option>
                  <option value="900">Black</option>
              </select>
              <div class="flex items-center bg-[#1e1e1e] rounded border border-black px-2 h-7">
                  <span class="text-[10px] text-zinc-500 mr-1">Sz</span>
                  <input type="number" :value="getVal('fontSize', 20)" @input="e => $emit('update-property', 'fontSize', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none" />
              </div>
          </div>

          <!-- Text Style Buttons (Bold, Italic, Underline) -->
          <div class="flex gap-1 pt-1">
            <button
              class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              :class="{ 'bg-violet-500/20 text-violet-400': getVal('fontWeight') === 'bold' || getVal('fontWeight') === '700' || getVal('fontWeight') === 700 }"
              @click="$emit('update-property', 'fontWeight', getVal('fontWeight') === 'bold' || getVal('fontWeight') === '700' || getVal('fontWeight') === 700 ? 'normal' : 'bold')"
              title="Negrito"
            >
              <Bold class="w-3.5 h-3.5" />
            </button>
            <button
              class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              :class="{ 'bg-violet-500/20 text-violet-400': getVal('fontStyle') === 'italic' }"
              @click="$emit('update-property', 'fontStyle', getVal('fontStyle') === 'italic' ? 'normal' : 'italic')"
              title="Itálico"
            >
              <Italic class="w-3.5 h-3.5" />
            </button>
            <button
              class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              :class="{ 'bg-violet-500/20 text-violet-400': !!getVal('underline') }"
              @click="$emit('update-property', 'underline', !getVal('underline'))"
              title="Sublinhado"
            >
              <Underline class="w-3.5 h-3.5" />
            </button>
            <button
              class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              :class="{ 'bg-violet-500/20 text-violet-400': !!getVal('linethrough') }"
              @click="$emit('update-property', 'linethrough', !getVal('linethrough'))"
              title="Tachado"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Advanced Text Props -->
          <div class="grid grid-cols-2 gap-2 pt-1">
               <div class="flex items-center bg-[#1e1e1e] rounded border border-black px-2 h-7" title="Line Height">
                  <span class="text-[10px] text-zinc-500 mr-1">LH</span>
                  <input type="number" step="0.1" :value="getVal('lineHeight', 1.2)" @input="e => $emit('update-property', 'lineHeight', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none" />
              </div>
              <div class="flex items-center bg-[#1e1e1e] rounded border border-black px-2 h-7" title="Letter Spacing">
                  <span class="text-[10px] text-zinc-500 mr-1">LS</span>
                  <input type="number" :value="getVal('charSpacing', 0)" @input="e => $emit('update-property', 'charSpacing', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none" />
              </div>
          </div>
          
          <!-- Alignment & Case -->
          <div class="flex gap-2">
            <div class="flex flex-1 bg-[#1e1e1e] rounded border border-black p-1 gap-1">
                <button class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all" :class="getVal('textAlign') == 'left' ? 'bg-violet-500/20 text-violet-400' : ''" @click="$emit('update-property', 'textAlign', 'left')"><AlignLeft class="w-3.5 h-3.5"/></button>
                <button class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all" :class="getVal('textAlign') == 'center' ? 'bg-violet-500/20 text-violet-400' : ''" @click="$emit('update-property', 'textAlign', 'center')"><AlignCenter class="w-3.5 h-3.5"/></button>
                <button class="flex-1 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-all" :class="getVal('textAlign') == 'right' ? 'bg-violet-500/20 text-violet-400' : ''" @click="$emit('update-property', 'textAlign', 'right')"><AlignRight class="w-3.5 h-3.5"/></button>
            </div>
            <div class="flex bg-[#1e1e1e] rounded border border-black p-1 gap-1">
                <button class="w-7 h-6 flex items-center justify-center hover:bg-white/10 rounded text-[10px] font-bold" title="Uppercase" @click="$emit('action', 'text-upper')">AG</button>
                <button class="w-7 h-6 flex items-center justify-center hover:bg-white/10 rounded text-[10px]" title="Lowercase" @click="$emit('action', 'text-lower')">ag</button>
            </div>
          </div>
          
          <!-- Component Button (Centered Below) -->
          <div class="pt-2 flex justify-center">
             <button @click="$emit('action', 'create-component')" class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-widest" :class="isComponent ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-400'">
                 <Component class="w-3.5 h-3.5" />
                 <span>{{ isComponent ? 'Main Component' : 'Create Component' }}</span>
             </button>
          </div>
      </div>

      <!-- 5. FILL -->
      <div v-if="!isImage && !isLineLike" class="p-4 border-b border-black/20 space-y-2">
          <div class="flex items-center justify-between group">
              <span class="text-[11px] font-bold text-zinc-400">Fill</span>
              <button
                type="button"
                class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#2c2c2c] border border-white/10 hover:bg-white/10 transition-colors"
                @click="$emit('update-property', 'fillEnabled', !fillEnabled)"
              >
                <span :class="fillEnabled ? 'text-green-400' : 'text-red-400'">{{ fillEnabled ? 'ON' : 'OFF' }}</span>
              </button>
          </div>
          
          <div class="flex items-center gap-2 group" :class="!fillEnabled ? 'opacity-50 pointer-events-none' : ''">
              <div 
                ref="fillColorPickerRef"
                class="relative"
              >
                <div 
                  class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                  :style="{ backgroundColor: getVal('fill', '#000000') }"
                  @click="showFillColorPicker = true"
                ></div>
                <ColorPicker
                  :show="showFillColorPicker"
                  :model-value="getVal('fill', '#000000')"
                  :trigger-element="fillColorPickerRef"
                  @update:show="showFillColorPicker = $event"
                  @update:model-value="(val: string) => $emit('update-property', 'fill', val)"
                />
              </div>
              <input 
                type="text" 
                :value="getVal('fill', '#000000').toString().replace('#', '').toUpperCase()" 
                @change="e => $emit('update-property', 'fill', '#' + (e.target as any).value.replace('#', ''))" 
                class="flex-1 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-2 font-mono focus:outline-none focus:border-violet-500/50 uppercase" 
                placeholder="1E1E1E"
                maxlength="6"
              />
              <input 
                type="text" 
                value="100" 
                class="w-14 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50" 
              />
              <span class="text-xs text-zinc-400">%</span>
              <button class="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-zinc-500 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-all"><Minus class="w-3 h-3" /></button>
          </div>
          
          <!-- Gradient Quick Action -->
          <div class="flex justify-between items-center pt-1">
             <div class="text-[9px] text-violet-400 cursor-pointer hover:underline" @click="$emit('update-property', 'fill-gradient', 'linear')">Usar Gradiente</div>
             <button class="text-[9px] text-zinc-500 hover:text-white" @click="$emit('add-color-style', getVal('fill', '#000000'))">+ Style</button>
          </div>
          
          <!-- Color Styles List -->
          <div v-if="colorStyles && colorStyles.length > 0" class="flex flex-wrap gap-1 mt-2">
              <button 
                v-for="style in colorStyles" 
                :key="style.id" 
                @click="$emit('apply-color-style', style.id)"
                class="w-4 h-4 rounded-full border border-white/10 hover:border-white transition-all"
                :style="{backgroundColor: style.value}"
                :title="style.name"
              ></button>
          </div>
      </div>

      <!-- IMAGE FILTERS / REMOVE BG -->
      <div v-if="canRemoveImageBg" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Image Filters</span>
              <div class="flex items-center gap-2">
                <button
                    type="button"
                    @click="$emit('action', 'ai-edit-image')"
                    class="flex items-center gap-1 px-2 py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 rounded transition-colors border border-white/10"
                    title="Editar esta imagem com IA (máscara)"
                >
                    <Sparkles class="w-3 h-3" />
                    Editar com IA
                </button>
                <button
                    type="button"
                    @click="$emit('action', 'remove-image-bg')"
                    class="flex items-center gap-1 px-2 py-1 text-[9px] bg-zinc-800 hover:bg-zinc-700 rounded transition-colors border border-white/10"
                    title="Remover fundo da imagem"
                >
                    <Scan class="w-3 h-3" />
                    Remover Fundo
                </button>
              </div>
          </div>

          <div v-if="isImage" class="space-y-2">
              <div class="flex justify-between items-center"><span class="text-[10px] text-zinc-500">Brightness</span><span class="text-[10px] text-zinc-400">{{ (getVal('filters', []).find((f: any) => f.type === 'Brightness')?.brightness || 0).toFixed(2) }}</span></div>
              <input type="range" min="-1" max="1" step="0.05" :value="getVal('filters', []).find((f: any) => f.type === 'Brightness')?.brightness || 0" @input="e => $emit('update-property', 'filter-brightness', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div v-if="isImage" class="space-y-2">
              <div class="flex justify-between items-center"><span class="text-[10px] text-zinc-500">Contrast</span><span class="text-[10px] text-zinc-400">{{ (getVal('filters', []).find((f: any) => f.type === 'Contrast')?.contrast || 0).toFixed(2) }}</span></div>
              <input type="range" min="-1" max="1" step="0.05" :value="getVal('filters', []).find((f: any) => f.type === 'Contrast')?.contrast || 0" @input="e => $emit('update-property', 'filter-contrast', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
          </div>
          
          <div v-if="isImage" class="space-y-2">
              <div class="flex justify-between items-center"><span class="text-[10px] text-zinc-500">Saturation</span><span class="text-[10px] text-zinc-400">{{ (getVal('filters', []).find((f: any) => f.type === 'Saturation')?.saturation || 0).toFixed(2) }}</span></div>
              <input type="range" min="-1" max="1" step="0.05" :value="getVal('filters', []).find((f: any) => f.type === 'Saturation')?.saturation || 0" @input="e => $emit('update-property', 'filter-saturation', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
          </div>
      </div>

      <!-- AUTO LAYOUT (New Section) -->
      <div v-if="isGroup" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Auto Layout</span>
              <div class="flex items-center gap-1 bg-[#2c2c2c] rounded px-1.5 h-6">
                  <GripVertical class="w-3 h-3 text-zinc-500" />
                  <input type="number" :value="getVal('gap', 0)" @input="e => $emit('action', 'update-gap:' + (e.target as any).value)" class="bg-transparent w-6 text-[10px] text-white focus:outline-none text-center" placeholder="0" />
              </div>
          </div>
          
          <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center gap-2 bg-[#1e1e1e] rounded border border-black px-2 h-7" title="Horizontal Padding">
                  <span class="text-[10px] text-zinc-500">PX</span>
                  <input type="number" :value="getVal('paddingX', 0)" @input="e => $emit('action', 'update-padding-x:' + (e.target as any).value)" class="bg-transparent w-full text-xs text-white focus:outline-none" />
              </div>
              <div class="flex items-center gap-2 bg-[#1e1e1e] rounded border border-black px-2 h-7" title="Vertical Padding">
                  <span class="text-[10px] text-zinc-500">PY</span>
                  <input type="number" :value="getVal('paddingY', 0)" @input="e => $emit('action', 'update-padding-y:' + (e.target as any).value)" class="bg-transparent w-full text-xs text-white focus:outline-none" />
              </div>
          </div>
          
          <div class="flex gap-1 pt-1">
              <button @click="$emit('action', 'layout-hug')" class="flex-1 py-1 text-[9px] bg-[#1e1e1e] border border-black rounded hover:border-zinc-500 transition-colors" title="Hug Contents">Hug</button>
              <button @click="$emit('action', 'layout-fill')" class="flex-1 py-1 text-[9px] bg-[#1e1e1e] border border-black rounded hover:border-zinc-500 transition-colors" title="Fill Container">Fill</button>
          </div>
      </div>

      <!-- 6. STROKE -->
      <div class="p-4 border-b border-black/20 space-y-2">
          <div class="flex items-center justify-between group">
              <span class="text-[11px] font-bold text-zinc-400">Stroke</span>
              <button
                type="button"
                class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#2c2c2c] border border-white/10 hover:bg-white/10 transition-colors"
                @click="$emit('update-property', 'strokeEnabled', !strokeEnabled)"
              >
                <span :class="strokeEnabled ? 'text-green-400' : 'text-red-400'">{{ strokeEnabled ? 'ON' : 'OFF' }}</span>
              </button>
          </div>
          
          <div class="flex items-center gap-2 group" :class="!strokeEnabled ? 'opacity-50 pointer-events-none' : ''">
              <div 
                ref="strokeColorPickerRef"
                class="relative"
              >
                <div 
                  class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
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
                class="flex-1 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-2 font-mono focus:outline-none focus:border-violet-500/50 uppercase" 
                placeholder="1E1E1E"
                maxlength="6"
              />
              
              <input type="number" :value="getVal('strokeWidth', 0)" @input="e => $emit('update-property', 'strokeWidth', Number((e.target as any).value))" class="w-14 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50" />
          </div>
          
          <!-- Stroke Options -->
          <div class="space-y-2 pt-1" v-if="strokeEnabled && getVal('strokeWidth', 0) > 0">
               <!-- Position (Inside/Center/Outside) - Only for vector paths -->
               <div v-if="isVectorPath" class="space-y-1">
                   <label class="text-[10px] text-zinc-500">Position</label>
                   <select :value="getVal('strokePosition', 'center')" @change="e => $emit('update-property', 'strokePosition', (e.target as any).value)" class="w-full bg-[#1e1e1e] text-[10px] text-white rounded border border-black h-6 px-2 focus:outline-none">
                       <option value="inside">Inside</option>
                       <option value="center">Center</option>
                       <option value="outside">Outside</option>
                   </select>
               </div>
               
               <!-- Weight -->
               <div v-if="isVectorPath" class="space-y-1">
                   <label class="text-[10px] text-zinc-500">Weight</label>
                   <div class="flex items-center gap-2">
                       <input type="number" :value="getVal('strokeWidth', 1)" @input="e => $emit('update-property', 'strokeWidth', Number((e.target as any).value))" class="flex-1 bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none" />
                       <button class="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Stroke Weight">
                           <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                           </svg>
                       </button>
                   </div>
               </div>
               
               <div class="grid grid-cols-2 gap-2">
                    <select :value="getVal('strokeLineCap', 'butt')" @change="e => $emit('update-property', 'strokeLineCap', (e.target as any).value)" class="bg-[#1e1e1e] text-[10px] text-white rounded border border-black h-6 px-1">
                        <option value="butt">Cap: Butt</option>
                        <option value="round">Cap: Round</option>
                        <option value="square">Cap: Square</option>
                    </select>
                    <select :value="getVal('strokeLineJoin', 'miter')" @change="e => $emit('update-property', 'strokeLineJoin', (e.target as any).value)" class="bg-[#1e1e1e] text-[10px] text-white rounded border border-black h-6 px-1">
                        <option value="miter">Join: Miter</option>
                        <option value="round">Join: Round</option>
                        <option value="bevel">Join: Bevel</option>
                    </select>
               </div>
               
               <!-- Miter Limit (only for miter join) -->
               <div v-if="getVal('strokeLineJoin', 'miter') === 'miter'" class="space-y-1">
                   <label class="text-[10px] text-zinc-500">Miter Limit</label>
                   <input type="number" :value="getVal('strokeMiterLimit', 4)" @input="e => $emit('update-property', 'strokeMiterLimit', Number((e.target as any).value))" class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none" min="1" max="100" step="0.1" />
               </div>
               
               <!-- Dash Pattern -->
               <div class="space-y-1">
                   <label class="text-[10px] text-zinc-500">Dash Pattern</label>
                   <div class="flex justify-between items-center">
                       <button class="text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors" :class="!getVal('strokeDashArray') ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-white'" @click="$emit('update-property', 'strokeDashArray', null)">Solid</button>
                       <button class="text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors" :class="JSON.stringify(getVal('strokeDashArray')) === JSON.stringify([12, 8]) ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-white'" @click="$emit('update-property', 'strokeDashArray', [12, 8])">Dashed</button>
                       <button class="text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors" :class="JSON.stringify(getVal('strokeDashArray')) === JSON.stringify([2, 6]) ? 'bg-violet-500/20 text-violet-400' : 'text-zinc-400 hover:text-white'" @click="$emit('update-property', 'strokeDashArray', [2, 6])">Dotted</button>
                   </div>
               </div>
               
               <!-- Advanced Stroke Settings Button -->
               <button class="w-full flex items-center justify-between px-2 py-1.5 bg-[#1e1e1e] border border-black rounded hover:bg-white/5 transition-colors text-[10px] text-zinc-400 hover:text-white">
                   <span>Advanced</span>
                   <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                   </svg>
               </button>
          </div>
      </div>

      <!-- 6b. CORNER RADIUS (Figma-like) -->
      <div v-if="isRectLike && !isImage" class="p-4 border-b border-black/20 space-y-2">
          <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-zinc-400">Arredondamento</span>
              <button
                type="button"
                class="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[#2c2c2c] border border-white/10 hover:bg-white/10 transition-colors"
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

          <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center gap-2 bg-[#1e1e1e] rounded border border-black px-2 h-7">
                  <span class="text-[10px] text-zinc-500">R</span>
                  <input
                    type="number"
                    :value="Math.round(cornerRadii.tl || 0)"
                    @input="e => $emit('update-property', 'cornerRadius', Number((e.target as any).value))"
                    class="bg-transparent w-full text-xs text-white focus:outline-none"
                  />
              </div>
              <div class="text-[10px] text-zinc-500 flex items-center justify-end">
                  {{ useIndividualRadii ? 'Individuais' : 'Todos iguais' }}
              </div>
          </div>

          <div class="grid grid-cols-4 gap-2 pt-1" v-if="useIndividualRadii">
              <div class="flex flex-col gap-1">
                  <label class="text-[9px] text-zinc-500">TL</label>
                  <input type="number" class="w-full bg-[#1e1e1e] border border-black rounded px-2 h-7 text-xs" :value="cornerRadii.tl" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, tl: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-1">
                  <label class="text-[9px] text-zinc-500">TR</label>
                  <input type="number" class="w-full bg-[#1e1e1e] border border-black rounded px-2 h-7 text-xs" :value="cornerRadii.tr" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, tr: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-1">
                  <label class="text-[9px] text-zinc-500">BR</label>
                  <input type="number" class="w-full bg-[#1e1e1e] border border-black rounded px-2 h-7 text-xs" :value="cornerRadii.br" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, br: Number((e.target as any).value) })" />
              </div>
              <div class="flex flex-col gap-1">
                  <label class="text-[9px] text-zinc-500">BL</label>
                  <input type="number" class="w-full bg-[#1e1e1e] border border-black rounded px-2 h-7 text-xs" :value="cornerRadii.bl" @input="e => $emit('update-property', 'cornerRadii', { ...cornerRadii, bl: Number((e.target as any).value) })" />
              </div>
          </div>
      </div>

      <!-- 7. EFFECTS (Shadows & Blur) -->
      <div class="p-4 border-b border-black/20 space-y-2">
          <div class="flex items-center justify-between group">
              <span class="text-[11px] font-bold text-zinc-400">Effects</span>
              <div class="flex gap-1">
                <button @click="$emit('update-property', 'shadow', {color: 'rgba(0,0,0,0.5)', blur: 10, x: 0, y: 4})" class="hover:text-white text-zinc-500" title="Add Shadow"><Plus class="w-3 h-3" /></button>
                <button @click="$emit('update-property', 'blur', 10)" class="hover:text-white text-zinc-500" title="Add Blur"><Cloud class="w-3 h-3" /></button>
              </div>
          </div>
          
          <!-- Shadow Item -->
          <div v-if="selectedObject.shadow" class="space-y-2 group">
              <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-[8px]">S</div>
                      <span class="text-xs text-white">Drop Shadow</span>
                  </div>
                  <button @click="$emit('update-property', 'shadow', null)" class="opacity-0 group-hover:opacity-100 hover:text-white text-zinc-500"><Minus class="w-3 h-3" /></button>
              </div>
              <div class="grid grid-cols-3 gap-2 pl-5">
                  <div class="flex items-center gap-1"><span class="text-[9px] text-zinc-500">X</span><input type="number" :value="selectedObject.shadow.offsetX" @input="e => $emit('update-property', 'shadow-x', Number((e.target as any).value))" class="w-full bg-transparent text-xs border-b border-zinc-700" /></div>
                  <div class="flex items-center gap-1"><span class="text-[9px] text-zinc-500">Y</span><input type="number" :value="selectedObject.shadow.offsetY" @input="e => $emit('update-property', 'shadow-y', Number((e.target as any).value))" class="w-full bg-transparent text-xs border-b border-zinc-700" /></div>
                  <div class="flex items-center gap-1"><span class="text-[9px] text-zinc-500">B</span><input type="number" :value="selectedObject.shadow.blur" @input="e => $emit('update-property', 'shadow-blur', Number((e.target as any).value))" class="w-full bg-transparent text-xs border-b border-zinc-700" /></div>
              </div>
          </div>

          <!-- Blur Item -->
          <div v-if="selectedObject.blur" class="space-y-2 group pt-2">
              <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                      <div class="w-3 h-3 rounded-full bg-violet-500/20 text-violet-500 flex items-center justify-center text-[8px]">B</div>
                      <span class="text-xs text-white">Layer Blur</span>
                  </div>
                  <button @click="$emit('update-property', 'blur', null)" class="opacity-0 group-hover:opacity-100 hover:text-white text-zinc-500"><Minus class="w-3 h-3" /></button>
              </div>
              <div class="grid grid-cols-3 gap-2 pl-5">
                  <div class="flex items-center gap-1 col-span-2">
                      <span class="text-[9px] text-zinc-500">Radius</span>
                      <input type="number" :value="selectedObject.blur" @input="e => $emit('update-property', 'blur', Number((e.target as any).value))" class="w-full bg-transparent text-xs border-b border-zinc-700" />
                  </div>
              </div>
          </div>
      </div>

      <!-- 8. SMART GRID CONFIG (If Group) -->
      <div v-if="isSmartGroup" class="p-4 border-b border-black/20 space-y-3 bg-violet-500/5">
          <div class="flex items-center gap-2">
             <Box class="w-3 h-3 text-violet-400" />
             <span class="text-[11px] font-bold text-violet-400 uppercase tracking-widest">Smart Grid Item</span>
          </div>
          <div class="space-y-2">
               <label class="text-[10px] text-zinc-400">Mode</label>
               <select :value="getVal('priceMode', 'standard')" @change="e => $emit('update-smart-group', 'priceMode', (e.target as any).value)" class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black h-7 px-2">
                   <option value="standard">Standard</option>
                   <option value="de_por">De / Por</option>
                   <option value="clube">Clube</option>
                   <option value="atacarejo">Atacarejo</option>
               </select>
          </div>
      </div>

      <!-- 9. PRODUCT ZONE SETTINGS (If Product Zone) -->
      <div v-if="isProductZone" class="border-b border-black/20">
          <div class="p-4 pb-2 flex items-center gap-2 border-b border-white/5">
             <LayoutGrid class="w-3.5 h-3.5 text-green-400" />
             <span class="text-[11px] font-bold text-green-400 uppercase tracking-widest">Zona de Produtos</span>
          </div>
          <ProductZoneSettings
            v-if="productZone"
            :zone="productZone"
            :global-styles="productGlobalStyles"
            :label-templates="labelTemplates"
            @update:zone="(prop, val) => $emit('update-zone', prop, val)"
            @update:global-styles="(prop, val) => $emit('update-global-styles', prop, val)"
            @apply-preset="presetId => $emit('apply-preset', presetId)"
            @sync-gaps="padding => $emit('sync-gaps', padding)"
            @recalculate="$emit('recalculate-layout')"
            @manage-label-templates="$emit('manage-label-templates')"
          />
      </div>

      </div> <!-- End Design Tab -->

      <!-- Prototype Tab -->
      <div v-if="activeTab === 'prototype'" class="flex-1 overflow-y-auto">
        <!-- Interactions Section -->
        <div v-if="selectedObject" class="p-4 border-b border-black/20 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-zinc-400">Interactions</span>
            <button
              @click="$emit('add-interaction')"
              class="w-6 h-6 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all"
              title="Add Interaction"
            >
              <Plus class="w-3 h-3 text-zinc-400" />
            </button>
          </div>
          
          <!-- Interaction List -->
          <div v-if="getVal('interactionDestination')" class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-[#2a2a2a] rounded border border-white/10">
              <div class="flex items-center gap-2">
                <ArrowRightFromLine class="w-3 h-3 text-violet-400" />
                <span class="text-xs text-white">Navigate to Page</span>
              </div>
              <select
                :value="getVal('interactionDestination')"
                @change="e => $emit('update-property', 'interactionDestination', (e.target as any).value)"
                class="bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 py-1 focus:outline-none"
              >
                <option value="">None</option>
                <option v-for="(page, idx) in targetPages" :key="idx" :value="idx">{{ page.name }}</option>
              </select>
            </div>
          </div>
          
          <div v-else class="text-center py-8 text-zinc-500 text-xs">
            No interactions added
          </div>
        </div>

        <!-- Animation Section -->
        <div v-if="selectedObject" class="p-4 border-b border-black/20 space-y-3">
          <span class="text-[11px] font-bold text-zinc-400">Animation</span>
          
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500">Type</label>
            <select
              :value="getVal('animationType', 'none')"
              @change="e => $emit('update-property', 'animationType', (e.target as any).value)"
              class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black px-2 h-7 focus:outline-none"
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="scale">Scale</option>
            </select>
          </div>
          
          <div v-if="getVal('animationType') !== 'none'" class="space-y-2">
            <label class="text-[10px] text-zinc-500">Duration (ms)</label>
            <input
              type="number"
              :value="getVal('animationDuration', 300)"
              @input="e => $emit('update-property', 'animationDuration', Number((e.target as any).value))"
              class="w-full bg-[#1e1e1e] border border-black rounded px-2 h-7 text-xs text-white focus:outline-none"
              min="0"
              max="5000"
            />
          </div>
        </div>
      </div> <!-- End Prototype Tab -->

    </div>
  </div>

  <!-- Empty State (Figma Style) -->
  <div v-else class="h-full bg-[#1a1a1a] text-white flex flex-col font-sans border-l border-white/5 overflow-y-auto">
      <!-- Page Section (Figma Style) -->
      <div class="border-b border-white/5">
        <div class="px-3 py-2.5">
          <span class="text-xs font-semibold text-white">Page</span>
        </div>
        
        <!-- Page Properties Row (Figma Style) -->
        <div class="px-3 pb-3 overflow-visible">
          <div class="flex items-center gap-1.5 min-w-0 overflow-visible">
            <!-- Color Swatch -->
            <div 
              ref="pageColorPickerRef"
              class="relative shrink-0"
            >
              <div 
                class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
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
              class="flex-1 min-w-15 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-2 font-mono focus:outline-none focus:border-violet-500/50 uppercase"
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
              class="w-9 h-7 bg-[#2a2a2a] border border-white/10 rounded text-xs text-white px-1 text-center focus:outline-none focus:border-violet-500/50"
              min="0"
              max="100"
            />
            
            <span class="text-xs text-zinc-400 shrink-0">%</span>
            
            <!-- Eye Icon (Visibility) -->
            <button class="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center transition-all shrink-0 ml-auto" title="Toggle Page Visibility">
              <Eye class="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Variables Section (Figma Style) -->
      <div class="border-b border-white/5">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
          <div class="flex items-center gap-2">
            <!-- Variables Icon (two circles with lines) -->
            <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 16 16">
              <circle cx="4" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
              <circle cx="12" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
              <line x1="4" y1="6" x2="4" y2="10" stroke="currentColor" stroke-width="1"/>
              <line x1="12" y1="6" x2="12" y2="10" stroke="currentColor" stroke-width="1"/>
              <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1"/>
            </svg>
            <span class="text-xs font-semibold text-white">Variables</span>
          </div>
        </div>
      </div>
      
      <!-- Styles Section (Figma Style) -->
      <div class="border-b border-white/5">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
          <span class="text-xs font-semibold text-white">Styles</span>
          <button 
            @click="handleAddColorStyle"
            class="w-5 h-5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all shrink-0"
            title="Add Color Style"
          >
            <Plus class="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
        <div v-if="colorStyles && colorStyles.length > 0" class="px-3 pb-2 flex flex-wrap gap-1.5">
          <button
            v-for="style in colorStyles"
            :key="style.id"
            @click="$emit('apply-color-style', style.id)"
            class="w-5 h-5 rounded border border-white/10 hover:border-white/30 transition-all relative shrink-0"
            :style="{ backgroundColor: style.value }"
            :title="style.name || style.value"
          >
            <span v-if="getPageColorHex() === style.value || (props.selectedObject && getVal('fill') === style.value)" class="absolute inset-0 border-2 border-white rounded"></span>
          </button>
        </div>
        <div v-else class="px-3 pb-2 text-[10px] text-zinc-500">
          No styles yet. Click + to add.
        </div>
      </div>
      
      <!-- Export Section (Figma Style) -->
      <div class="border-b border-white/5">
        <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
          <span class="text-xs font-semibold text-white">Export</span>
          <button 
            @click="$emit('action', 'export-png')"
            class="w-5 h-5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all"
            title="Export Page"
          >
            <Plus class="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
        <div class="px-3 pb-2 space-y-1">
          <button
            @click="$emit('action', 'export-png')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-all"
          >
            Export as PNG
          </button>
          <button
            @click="$emit('action', 'export-svg')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-all"
          >
            Export as SVG
          </button>
          <button
            @click="$emit('action', 'export-jpg')"
            class="w-full text-left px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-all"
          >
            Export as JPG
          </button>
        </div>
      </div>
      
      <!-- Help Button (Bottom Right) -->
      <div class="mt-auto p-3 flex justify-end">
        <button class="w-7 h-7 hover:bg-white/10 rounded-full flex items-center justify-center transition-all">
          <span class="text-xs text-white font-semibold">?</span>
        </button>
      </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* ============================
   Figma-inspired Panel Styles
   ============================ */

/* Prototype Panel */
.pp-interaction-card {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(139, 92, 246, 0.3);
  background: rgba(139, 92, 246, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pp-info-box {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(24, 24, 27, 0.5);
}

.pp-info-box--collapsed {
  background: rgba(24, 24, 27, 0.3);
}

/* Design Panel */
.pp-design-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Section Header (collapsible) */
.pp-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  text-align: left;
  transition: background-color 0.15s;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pp-section-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pp-section-header span {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pp-section-chevron {
  width: 16px;
  height: 16px;
  color: #52525b;
  transition: transform 0.2s;
}

.pp-section-chevron--collapsed {
  transform: rotate(-90deg);
}

.pp-section-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

/* Quick action buttons */
.pp-quick-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(39, 39, 42, 0.8);
}

.pp-quick-btn {
  flex: 1;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  transition: all 0.15s;
}

.pp-quick-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.pp-quick-btn svg {
  width: 16px;
  height: 16px;
}

.pp-quick-btn--active {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
}

/* Input fields */
.pp-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pp-input-label {
  font-size: 10px;
  color: #71717a;
  width: 16px;
}

.pp-input-field {
  flex: 1;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(39, 39, 42, 0.8);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: white;
}

.pp-input-field:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
}

.pp-number-input {
  width: 100%;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(39, 39, 42, 0.8);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: white;
  text-align: center;
}

.pp-number-input:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
}

/* Color row */
.pp-color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pp-color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(39, 39, 42, 0.8);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.pp-color-hex {
  flex: 1;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(39, 39, 42, 0.8);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: white;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
}

.pp-color-hex:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
}

/* Range slider with number */
.pp-range-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pp-range-control input[type="range"] {
  flex: 1;
  height: 6px;
  background: #3f3f46;
  border-radius: 8px;
  appearance: none;
  cursor: pointer;
  accent-color: #8b5cf6;
}

.pp-range-number {
  width: 56px;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(39, 39, 42, 0.8);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 10px;
  color: white;
  text-align: center;
}

.pp-range-number:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
}

/* Grid layouts */
.pp-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pp-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.pp-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
</style>
