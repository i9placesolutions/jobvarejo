<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const PropertiesPanel = defineAsyncComponent(() => import('./PropertiesPanel.vue'))
const EditorTopControls = defineAsyncComponent(() => import('./EditorTopControls.vue'))

defineProps<{
  collaborators: any[]
  currentUser: any
  showZoomMenu: boolean
  currentZoom: number
  getColorFromString: (value: string) => string
  getInitial: (value: string | null | undefined) => string
  selectedObject: any
  activeMode: 'design' | 'prototype'
  pageSettings: any
  colorStyles: any[]
  productZone: any
  productGlobalStyles: any
  labelTemplates: any[]
  viewShowGrid: boolean
  viewShowRulers: boolean
  viewShowGuides: boolean
  snapToObjects: boolean
  snapToGuides: boolean
  snapToGrid: boolean
  gridSize: number
}>()

const emit = defineEmits<{
  (e: 'update:showZoomMenu', value: boolean): void
  (e: 'present'): void
  (e: 'open-ai-generate'): void
  (e: 'open-share'): void
  (e: 'zoom-50'): void
  (e: 'zoom-100'): void
  (e: 'zoom-200'): void
  (e: 'zoom-400'): void
  (e: 'zoom-fit'): void
  (e: 'zoom-selection'): void
  (e: 'toggle-grid'): void
  (e: 'toggle-rulers'): void
  (e: 'toggle-guides'): void
  (e: 'toggle-snap-objects'): void
  (e: 'toggle-snap-guides'): void
  (e: 'toggle-snap-grid'): void
  (e: 'set-grid-size', size: number): void
  (e: 'update-property', prop: string, value: any): void
  (e: 'update-smart-group', payload: any): void
  (e: 'update-page-settings', payload: any): void
  (e: 'action', action: string): void
  (e: 'add-color-style', color: string): void
  (e: 'apply-color-style', styleId: string): void
  (e: 'update-zone', prop: string, value: any): void
  (e: 'update-global-styles', prop: string, value: any): void
  (e: 'apply-template-to-zone'): void
  (e: 'apply-preset', presetId: string): void
  (e: 'sync-gaps', padding: number): void
  (e: 'recalculate-layout'): void
  (e: 'manage-label-templates'): void
  (e: 'change-mode', mode: 'design' | 'prototype'): void
}>()
</script>

<template>
  <aside class="w-75 border-l border-white/5 h-full bg-[#1a1a1a] text-white flex flex-col shrink-0 z-10 overflow-hidden">
    <div class="h-10 px-2 flex items-center justify-end border-b border-white/5 shrink-0 min-w-0">
      <EditorTopControls
        :collaborators="collaborators"
        :current-user="currentUser"
        :show-zoom-menu="showZoomMenu"
        :current-zoom="currentZoom"
        :get-color-from-string="getColorFromString"
        :get-initial="getInitial"
        :view-show-grid="viewShowGrid"
        :view-show-rulers="viewShowRulers"
        :view-show-guides="viewShowGuides"
        :snap-to-objects="snapToObjects"
        :snap-to-guides="snapToGuides"
        :snap-to-grid="snapToGrid"
        :grid-size="gridSize"
        @update:show-zoom-menu="emit('update:showZoomMenu', $event)"
        @present="emit('present')"
        @open-ai-generate="emit('open-ai-generate')"
        @open-share="emit('open-share')"
        @zoom-50="emit('zoom-50')"
        @zoom-100="emit('zoom-100')"
        @zoom-200="emit('zoom-200')"
        @zoom-400="emit('zoom-400')"
        @zoom-fit="emit('zoom-fit')"
        @zoom-selection="emit('zoom-selection')"
        @toggle-grid="emit('toggle-grid')"
        @toggle-rulers="emit('toggle-rulers')"
        @toggle-guides="emit('toggle-guides')"
        @toggle-snap-objects="emit('toggle-snap-objects')"
        @toggle-snap-guides="emit('toggle-snap-guides')"
        @toggle-snap-grid="emit('toggle-snap-grid')"
        @set-grid-size="emit('set-grid-size', $event)"
      />
    </div>

    <div class="min-h-0 flex-1 flex flex-col">
      <PropertiesPanel
        v-if="selectedObject"
        :selectedObject="selectedObject"
        :activeMode="activeMode"
        :pageSettings="pageSettings"
        :colorStyles="colorStyles"
        :productZone="productZone"
        :productGlobalStyles="productGlobalStyles"
        :labelTemplates="labelTemplates"
        @update-property="(prop, value) => emit('update-property', prop, value)"
        @update-smart-group="(payload) => emit('update-smart-group', payload)"
        @update-page-settings="(payload) => emit('update-page-settings', payload)"
        @action="(action) => emit('action', action)"
        @add-color-style="(color) => emit('add-color-style', color)"
        @apply-color-style="(styleId) => emit('apply-color-style', styleId)"
        @add-interaction="() => {}"
        @update-zone="(prop, value) => emit('update-zone', prop, value)"
        @update-global-styles="(prop, value) => emit('update-global-styles', prop, value)"
        @apply-template-to-zone="emit('apply-template-to-zone')"
        @apply-preset="(payload) => emit('apply-preset', payload)"
        @sync-gaps="(padding) => emit('sync-gaps', padding)"
        @recalculate-layout="emit('recalculate-layout')"
        @manage-label-templates="emit('manage-label-templates')"
        @change-mode="(mode: 'design' | 'prototype') => emit('change-mode', mode)"
      />
    </div>
  </aside>
</template>
