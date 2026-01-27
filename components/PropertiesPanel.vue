<script setup lang="ts">
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
  LayoutGrid // For Product Zone
} from 'lucide-vue-next'
import ProductZoneSettings from './ProductZoneSettings.vue'
import type { ProductZone, GlobalStyles } from '~/types/product-zone'
import type { LabelTemplate } from '~/types/label-template'
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog'

const props = defineProps<{
  selectedObject: any | null,
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
const isImage = computed(() => props.selectedObject?.type === 'image')
const isSmartGroup = computed(() => props.selectedObject?.type === 'group' && props.selectedObject.isSmartObject)
const isGroup = computed(() => props.selectedObject?.type === 'group' || props.selectedObject?.type === 'activeSelection')
const isMultiSelect = computed(() => props.selectedObject?.type === 'activeSelection')
const canMask = computed(() => props.selectedObject && !isMultiSelect.value)
const isComponent = computed(() => props.selectedObject?.isComponent)
const isProductZone = computed(() => props.selectedObject?.isGridZone || props.selectedObject?.isProductZone)
const isFrame = computed(() => props.selectedObject?.isFrame)
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
const activeTab = ref('design') // design | prototype

// Helper to safely get value
const getVal = (prop: string, defaultVal: any = '') => props.selectedObject ? (props.selectedObject[prop] ?? defaultVal) : defaultVal

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
  <div v-if="selectedObject" class="h-full bg-[#1e1e1e] text-white min-h-0 flex flex-col font-sans select-none border-l border-white/5">
    
    <!-- Header (Design/Prototype) -->
    <div class="h-10 flex items-center px-4 gap-6 bg-[#1e1e1e] shrink-0 border-b border-white/5 font-bold text-[11px] text-zinc-500">
      <button @click="activeTab = 'design'" class="h-full border-b-2 transition-colors" :class="activeTab === 'design' ? 'border-white text-white' : 'border-transparent hover:text-zinc-300'">Design</button>
      <button @click="activeTab = 'prototype'" class="h-full border-b-2 transition-colors" :class="activeTab === 'prototype' ? 'border-white text-white' : 'border-transparent hover:text-zinc-300'">Prototype</button>
    </div>

    <!-- Scrollable Inspector -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      
      <!-- PROTOTYPE TAB -->
      <div v-if="activeTab === 'prototype'" class="p-4 space-y-4">
          <div class="space-y-2">
              <label class="text-[11px] font-bold text-zinc-400">Interactions</label>
              <div class="p-3 border border-white/10 rounded-lg bg-white/5 space-y-3">
                  <div class="flex justify-between items-center">
                      <span class="text-xs font-bold">On Click</span>
                      <MousePointer2 class="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  
                  <div class="space-y-1">
                      <label class="text-[10px] text-zinc-500">Navigate to</label>
                      <select :value="getVal('interactionDestination', '')" @change="e => $emit('update-property', 'interactionDestination', (e.target as any).value)" class="w-full bg-[#1e1e1e] text-xs text-white rounded border border-black h-7 px-2">
                          <option value="">None</option>
                          <option v-for="page in targetPages" :key="page.id" :value="page.id">{{ page.name }}</option>
                      </select>
                  </div>
              </div>
          </div>
          <div class="text-[10px] text-zinc-500 leading-relaxed">
              Conecte este objeto a outra página. No modo "Apresentar", clicar nele levará ao destino escolhido.
          </div>
      </div>

      <!-- DESIGN TAB (Existing Content) -->
      <div v-else>
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

      <!-- 2. LAYOUT & TRANSFORM -->
      <div class="p-4 border-b border-black/20 space-y-3">
          <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center gap-2 group">
                  <span class="text-[10px] text-zinc-500 w-3">X</span>
                  <input type="number" :value="Math.round(getVal('left', 0))" @input="e => $emit('update-property', 'left', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
              <div class="flex items-center gap-2 group">
                  <span class="text-[10px] text-zinc-500 w-3">Y</span>
                  <input type="number" :value="Math.round(getVal('top', 0))" @input="e => $emit('update-property', 'top', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
              <div class="flex items-center gap-2 group">
                  <span class="text-[10px] text-zinc-500 w-3">W</span>
                  <input type="number" :value="Math.round(selectedObject.getScaledWidth())" @input="e => $emit('update-property', 'width', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
              <div class="flex items-center gap-2 group">
                  <span class="text-[10px] text-zinc-500 w-3">H</span>
                  <input type="number" :value="Math.round(selectedObject.getScaledHeight())" @input="e => $emit('update-property', 'height', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
              
              <!-- Rotation & Corner Radius -->
              <div class="flex items-center gap-2 group">
                  <span class="text-[10px] text-zinc-500 w-3">∠</span>
                  <input type="number" :value="Math.round(getVal('angle', 0))" @input="e => $emit('update-property', 'angle', Number((e.target as any).value))" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
              <div class="flex items-center gap-2 group" v-if="isRectLike && !isText">
                  <span class="text-[10px] text-zinc-500 w-3">R</span>
                  <input type="number" :value="Math.round(cornerRadii.tl || 0)" @input="e => { $emit('update-property', 'rx', Number((e.target as any).value)); $emit('update-property', 'ry', Number((e.target as any).value)) }" class="bg-transparent w-full text-xs text-white focus:outline-none hover:bg-white/5 rounded px-1" />
              </div>
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
                <button class="flex-1 h-6 flex items-center justify-center hover:bg-white/10 rounded" :class="getVal('textAlign') == 'left' ? 'bg-white/20' : ''" @click="$emit('update-property', 'textAlign', 'left')"><AlignLeft class="w-3 h-3"/></button>
                <button class="flex-1 h-6 flex items-center justify-center hover:bg-white/10 rounded" :class="getVal('textAlign') == 'center' ? 'bg-white/20' : ''" @click="$emit('update-property', 'textAlign', 'center')"><AlignCenter class="w-3 h-3"/></button>
                <button class="flex-1 h-6 flex items-center justify-center hover:bg-white/10 rounded" :class="getVal('textAlign') == 'right' ? 'bg-white/20' : ''" @click="$emit('update-property', 'textAlign', 'right')"><AlignRight class="w-3 h-3"/></button>
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
              <div class="w-4 h-4 border border-zinc-600 rounded bg-white relative overflow-hidden shrink-0">
                  <input type="color" :value="getVal('fill', '#000000')" @input="e => $emit('update-property', 'fill', (e.target as any).value)" class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0" />
                  <div class="w-full h-full" :style="{backgroundColor: getVal('fill', '#000000')}"></div>
              </div>
              <input type="text" :value="getVal('fill', '#000000').toString().toUpperCase()" @change="e => $emit('update-property', 'fill', (e.target as any).value)" class="bg-transparent text-xs text-white w-16 focus:outline-none uppercase" />
              <span class="text-[10px] text-zinc-500">100%</span>
              <button class="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-zinc-500"><Minus class="w-3 h-3" /></button>
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

      <!-- IMAGE FILTERS (New) -->
      <div v-if="isImage" class="p-4 border-b border-black/20 space-y-3">
          <span class="text-[11px] font-bold text-zinc-400">Image Filters</span>
          
          <div class="space-y-2">
              <div class="flex justify-between items-center"><span class="text-[10px] text-zinc-500">Brightness</span><span class="text-[10px] text-zinc-400">{{ (getVal('filters', []).find((f: any) => f.type === 'Brightness')?.brightness || 0).toFixed(2) }}</span></div>
              <input type="range" min="-1" max="1" step="0.05" :value="getVal('filters', []).find((f: any) => f.type === 'Brightness')?.brightness || 0" @input="e => $emit('update-property', 'filter-brightness', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div class="space-y-2">
              <div class="flex justify-between items-center"><span class="text-[10px] text-zinc-500">Contrast</span><span class="text-[10px] text-zinc-400">{{ (getVal('filters', []).find((f: any) => f.type === 'Contrast')?.contrast || 0).toFixed(2) }}</span></div>
              <input type="range" min="-1" max="1" step="0.05" :value="getVal('filters', []).find((f: any) => f.type === 'Contrast')?.contrast || 0" @input="e => $emit('update-property', 'filter-contrast', Number((e.target as any).value))" class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
          </div>
          
          <div class="space-y-2">
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
              <div class="w-4 h-4 border border-zinc-600 rounded relative overflow-hidden shrink-0">
                   <input type="color" :value="getVal('stroke', '#000000')" @input="e => $emit('update-property', 'stroke', (e.target as any).value)" class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0" />
                   <div class="w-full h-full border-2 border-white" :style="{borderColor: getVal('stroke', '#000000')}"></div>
              </div>
              <input type="text" :value="getVal('stroke', '').toString().toUpperCase() || 'NONE'" class="bg-transparent text-xs text-white w-16 focus:outline-none uppercase" />
              
              <input type="number" :value="getVal('strokeWidth', 0)" @input="e => $emit('update-property', 'strokeWidth', Number((e.target as any).value))" class="bg-[#1e1e1e] w-8 h-6 text-xs text-right text-white focus:outline-none border border-black rounded px-1" />
          </div>
          
          <!-- Stroke Options -->
          <div class="space-y-2 pt-1" v-if="strokeEnabled && getVal('strokeWidth', 0) > 0">
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
               <div class="flex justify-between items-center">
                   <button class="text-[10px] text-zinc-400 hover:text-white" @click="$emit('update-property', 'strokeDashArray', null)">Solid</button>
                   <button class="text-[10px] text-zinc-400 hover:text-white" @click="$emit('update-property', 'strokeDashArray', [12, 8])">Dashed</button>
                   <button class="text-[10px] text-zinc-400 hover:text-white" @click="$emit('update-property', 'strokeDashArray', [2, 6])">Dotted</button>
               </div>
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

    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="h-full bg-[#1e1e1e] text-white flex flex-col font-sans border-l border-white/5">
      <div class="h-10 border-b border-white/5 flex items-center px-4">
          <span class="text-[11px] font-bold text-zinc-500">Page Settings</span>
      </div>
      <div class="p-4 space-y-6">
          <div class="space-y-2">
             <label class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Background</label>
             <div class="flex items-center gap-2 group">
                 <div class="w-4 h-4 border border-zinc-600 rounded relative overflow-hidden shrink-0">
                     <input 
                        type="color" 
                        :value="pageSettings.backgroundColor" 
                        @input="e => $emit('update-page-settings', 'backgroundColor', (e.target as any).value)" 
                        class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer opacity-0" 
                     />
                     <div class="w-full h-full" :style="{backgroundColor: pageSettings.backgroundColor}"></div>
                 </div>
                 <input 
                    type="text" 
                    :value="pageSettings.backgroundColor.toUpperCase()" 
                    @change="e => $emit('update-page-settings', 'backgroundColor', (e.target as any).value)"
                    class="bg-transparent text-xs text-white w-20 focus:outline-none uppercase font-mono" 
                 />
             </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>
