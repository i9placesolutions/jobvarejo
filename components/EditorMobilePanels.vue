<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import EditorMobileBottomSheet from './EditorMobileBottomSheet.vue'

const AssetsPanel = defineAsyncComponent(() => import('./AssetsPanel.vue'))
const LayersPanel = defineAsyncComponent(() => import('./LayersPanel.vue'))
const EditorRightSidebar = defineAsyncComponent(() => import('./EditorRightSidebar.vue'))
const PageNavigator = defineAsyncComponent(() => import('./PageNavigator.vue'))

type MobilePanel = 'tools' | 'layers' | 'properties' | 'pages' | 'uploads' | 'more'
type LayerSelectPayload = string | { id: string; additive?: boolean; toggle?: boolean; range?: boolean }

const props = defineProps<{
  panel: MobilePanel
  title: string
  currentZoom: number
  pages: any[]
  currentPageId: string
  canvasObjects: any[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  currentUser: any
  selectedObject: any
  activeMode: 'design' | 'prototype'
  pageSettings: any
  colorStyles: any[]
  productZone: any
  productZoneInspector: any
  productGlobalStyles: any
  labelTemplates: any[]
  viewShowGrid: boolean
  viewShowRulers: boolean
  viewShowGuides: boolean
  snapToObjects: boolean
  snapToGuides: boolean
  snapToGrid: boolean
  gridSize: number
  getColorFromString: (value: string) => string
  getInitial: (value: string) => string
}>()

const getMobileColorFromString = (value: string | null | undefined) => props.getColorFromString(String(value || ''))
const getMobileInitial = (value: string | null | undefined) => props.getInitial(String(value || ''))

const emit = defineEmits<{
  close: []
  setPanel: [panel: MobilePanel]
  command: [name: string, payload?: any]
  insertAsset: [asset: any]
  selectLayer: [payload: LayerSelectPayload]
  toggleVisible: [id: string]
  toggleLock: [id: string]
  deleteLayer: [id: string]
  moveLayer: [id: string, direction: 'up' | 'down']
  renameLayer: [id: string, name: string]
  reorderLayer: [payload: any]
  updateProperty: [name: string, value: any]
  updateSmartGroup: [payload: any]
  updatePageSettings: [prop: string, value: any]
  addColorStyle: [color: string]
  applyColorStyle: [id: string]
  updateZone: [prop: string, value: any, meta?: any]
  updateGlobalStyles: [prop: string, value: any, meta?: any]
  applyTemplateToZone: []
  applyPreset: [payload: any]
  syncGaps: [padding: number, meta?: any]
  recalculateLayout: []
  manageLabelTemplates: []
  openZoneReview: []
  changeMode: [mode: 'design' | 'prototype']
  selectPage: [id: string]
  addPage: []
  duplicatePage: [id: string]
  deletePage: [index: number]
  reorderPages: [payload: any]
}>()
</script>

<template>
  <EditorMobileBottomSheet
    :title="title"
    @close="emit('close')"
  >
    <div v-if="panel === 'tools'" class="space-y-4">
      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Formas</div>
        <div class="grid grid-cols-4 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-frame')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            <span class="text-[11px]">Frame</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'rect' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
            <span class="text-[11px]">Retângulo</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'rect', options: { rx: 16, ry: 16 } })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="6"/></svg>
            <span class="text-[11px]">Arredondado</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'circle' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/></svg>
            <span class="text-[11px]">Círculo</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'ellipse' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>
            <span class="text-[11px]">Elipse</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'triangle' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4L3 20h18L12 4z"/></svg>
            <span class="text-[11px]">Triângulo</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'line' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="19" x2="19" y2="5"/></svg>
            <span class="text-[11px]">Linha</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-shape', { type: 'star' })">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span class="text-[11px]">Estrela</span>
          </button>
        </div>
      </div>

      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Texto & Desenho</div>
        <div class="grid grid-cols-4 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-text')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M8 20h8"/></svg>
            <span class="text-[11px]">Texto</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-heading')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 12h12"/><path d="M6 4v16"/><path d="M18 4v16"/></svg>
            <span class="text-[11px]">Título</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'toggle-pen')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            <span class="text-[11px]">Caneta</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'toggle-drawing')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
            <span class="text-[11px]">Desenho</span>
          </button>
        </div>
      </div>

      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Produtos & Templates</div>
        <div class="grid grid-cols-4 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'add-grid-zone')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span class="text-[11px]">Grid Zone</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('manageLabelTemplates')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
            <span class="text-[11px]">Etiquetas</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('setPanel', 'uploads')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            <span class="text-[11px]">Imagens</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'open-ai-generate')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            <span class="text-[11px]">IA Gerar</span>
          </button>
        </div>
      </div>
    </div>

    <template v-if="panel === 'uploads'">
      <AssetsPanel class="-mx-4 -mb-4 flex-1 min-h-0" @insert-asset="asset => emit('insertAsset', asset)" />
    </template>

    <template v-if="panel === 'layers'">
      <LayersPanel
        class="flex-1 min-h-0"
        :objects="canvasObjects"
        :selectedId="selectedObjectId"
        :selectedIds="selectedObjectIds"
        @select="(payload: LayerSelectPayload) => emit('selectLayer', payload)"
        @toggle-visible="(id: string) => emit('toggleVisible', id)"
        @toggle-lock="(id: string) => emit('toggleLock', id)"
        @delete="(id: string) => emit('deleteLayer', id)"
        @move-up="(id: string) => emit('moveLayer', id, 'up')"
        @move-down="(id: string) => emit('moveLayer', id, 'down')"
        @rename="(id: string, name: string) => emit('renameLayer', id, name)"
        @reorder="payload => emit('reorderLayer', payload)"
      />
    </template>

    <template v-if="panel === 'properties'">
      <EditorRightSidebar
        :collaborators="[]"
        :current-user="currentUser"
        :show-zoom-menu="false"
        :current-zoom="currentZoom"
        :get-color-from-string="getMobileColorFromString"
        :get-initial="getMobileInitial"
        :selected-object="selectedObject"
        :active-mode="activeMode"
        :page-settings="pageSettings"
        :color-styles="colorStyles"
        :product-zone="productZone"
        :product-zone-inspector="productZoneInspector"
        :product-global-styles="productGlobalStyles"
        :label-templates="labelTemplates"
        :view-show-grid="viewShowGrid"
        :view-show-rulers="viewShowRulers"
        :view-show-guides="viewShowGuides"
        :snap-to-objects="snapToObjects"
        :snap-to-guides="snapToGuides"
        :snap-to-grid="snapToGrid"
        :grid-size="gridSize"
        class="relative! w-full! shadow-none! border-0!"
        @update-property="(name, value) => emit('updateProperty', name, value)"
        @update-smart-group="payload => emit('updateSmartGroup', payload)"
        @update-page-settings="(prop: string, value: any) => emit('updatePageSettings', prop, value)"
        @action="payload => emit('command', 'sidebar-action', payload)"
        @add-color-style="color => emit('addColorStyle', color)"
        @apply-color-style="id => emit('applyColorStyle', id)"
        @update-zone="(prop, value, meta) => emit('updateZone', prop, value, meta)"
        @update-global-styles="(prop, value, meta) => emit('updateGlobalStyles', prop, value, meta)"
        @apply-template-to-zone="emit('applyTemplateToZone')"
        @apply-preset="payload => emit('applyPreset', payload)"
        @sync-gaps="(padding, meta) => emit('syncGaps', padding, meta)"
        @recalculate-layout="emit('recalculateLayout')"
        @manage-label-templates="emit('manageLabelTemplates')"
        @open-zone-review="emit('openZoneReview')"
        @change-mode="mode => emit('changeMode', mode)"
      />
    </template>

    <template v-if="panel === 'pages'">
      <PageNavigator
        :pages="pages || []"
        :active-page-id="currentPageId"
        @select-page="(id: string) => emit('selectPage', id)"
        @add-page="emit('addPage')"
        @duplicate-page="(id: string) => emit('duplicatePage', id)"
        @delete-page="(idx: number) => emit('deletePage', idx)"
        @reorder-pages="(payload: any) => emit('reorderPages', payload)"
      />
    </template>

    <div v-if="panel === 'more'" class="space-y-4">
      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Zoom ({{ Math.round(currentZoom) }}%)</div>
        <div class="grid grid-cols-4 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'zoom-50')"><span class="text-sm font-semibold">50%</span></button>
          <button class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'zoom-100')"><span class="text-sm font-semibold">100%</span></button>
          <button class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'zoom-200')"><span class="text-sm font-semibold">200%</span></button>
          <button class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'zoom-fit')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></svg>
            <span class="text-[10px]">Ajustar</span>
          </button>
        </div>
      </div>

      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Ações</div>
        <div class="grid grid-cols-4 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 active:text-white col-span-2" @click="emit('command', 'export')">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            <span class="text-[11px] font-semibold">Exportar (PNG / JPG / PDF)</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'presentation')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span class="text-[11px]">Apresentar</span>
          </button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 active:text-white" @click="emit('command', 'share')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            <span class="text-[11px]">Compartilhar</span>
          </button>
        </div>
      </div>

      <div>
        <div class="text-[11px] text-white/40 uppercase tracking-wider mb-2 px-1">Visualização</div>
        <div class="grid grid-cols-3 gap-2">
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="viewShowGrid ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-grid')"><span class="text-[11px]">Grid</span></button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="viewShowRulers ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-rulers')"><span class="text-[11px]">Réguas</span></button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="viewShowGuides ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-guides')"><span class="text-[11px]">Guias</span></button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="snapToObjects ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-snap-objects')"><span class="text-[10px]">Snap Obj</span></button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="snapToGuides ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-snap-guides')"><span class="text-[10px]">Snap Guia</span></button>
          <button class="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 active:text-white" :class="snapToGrid ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/70'" @click="emit('command', 'toggle-snap-grid')"><span class="text-[10px]">Snap Grid</span></button>
        </div>
      </div>
    </div>
  </EditorMobileBottomSheet>
</template>
