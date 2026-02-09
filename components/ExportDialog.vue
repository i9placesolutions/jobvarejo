<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'

type ExportScope = 'canvas' | 'selected-frame' | 'all-frames'
type ExportFormat = 'png' | 'jpeg' | 'svg'

const props = defineProps<{
  modelValue: boolean
  exportSettings: {
    format: ExportFormat | string
    scale: number
    quality: number
    exportScope: ExportScope | string
    selectedFrameId: string
  }
  availableFramesForExport: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'export'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})
</script>

<template>
  <UiDialog v-model="open" title="Exportar Design" @close="open = false" width="450px">
    <template #default>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que exportar</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="exportSettings.exportScope = 'canvas'"
              :class="exportSettings.exportScope === 'canvas' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
              class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Tela Inteira</span>
            </button>
            <button
              @click="exportSettings.exportScope = 'selected-frame'"
              :class="exportSettings.exportScope === 'selected-frame' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
              class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <span>Frame Selecionado</span>
            </button>
            <button
              @click="exportSettings.exportScope = 'all-frames'"
              :class="exportSettings.exportScope === 'all-frames' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
              class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              <span>Todos os Frames</span>
            </button>
          </div>
        </div>

        <div v-if="exportSettings.exportScope === 'selected-frame'" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selecione o Frame</label>
          <select
            v-model="exportSettings.selectedFrameId"
            class="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="">Selecione um frame...</option>
            <option v-for="frame in availableFramesForExport" :key="frame.id" :value="frame.id">
              {{ frame.name }}
            </option>
          </select>
          <p v-if="availableFramesForExport.length === 0" class="text-[10px] text-amber-500">
            Nenhum frame encontrado no canvas. Crie um frame primeiro.
          </p>
        </div>

        <div v-if="exportSettings.exportScope !== 'all-frames' || exportSettings.format !== 'svg'" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formato</label>
          <div class="flex gap-2">
            <button @click="exportSettings.format = 'png'" :class="exportSettings.format === 'png' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">PNG</button>
            <button @click="exportSettings.format = 'jpeg'" :class="exportSettings.format === 'jpeg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">JPG</button>
            <button v-if="exportSettings.exportScope === 'canvas'" @click="exportSettings.format = 'svg'" :class="exportSettings.format === 'svg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">SVG</button>
          </div>
          <p v-if="exportSettings.exportScope === 'all-frames'" class="text-[10px] text-zinc-500">
            A exportação de múltiplos frames suporta apenas PNG/JPG
          </p>
        </div>

        <div v-if="exportSettings.format !== 'svg'" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escala (Resolução)</label>
          <div class="flex gap-2">
            <button @click="exportSettings.scale = 1" :class="exportSettings.scale === 1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">1x</button>
            <button @click="exportSettings.scale = 2" :class="exportSettings.scale === 2 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">2x</button>
            <button @click="exportSettings.scale = 3" :class="exportSettings.scale === 3 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">3x</button>
          </div>
          <p class="text-[10px] text-zinc-500 text-right">
            {{ exportSettings.scale === 1 ? '72 DPI (Tela)' : exportSettings.scale === 2 ? '144 DPI (Retina)' : '300 DPI (Impressão)' }}
          </p>
        </div>

        <div v-if="exportSettings.exportScope === 'all-frames' && availableFramesForExport.length > 1" class="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <svg class="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-[10px] text-blue-200">
            Cada frame será exportado como um arquivo separado. {{ availableFramesForExport.length }} frames serão exportados.
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-[10px] text-muted-foreground">
          {{ exportSettings.exportScope === 'all-frames' ? `${availableFramesForExport.length} arquivos` : '1 arquivo' }}
        </span>
        <div class="flex gap-2">
          <Button variant="ghost" @click="open = false">Cancelar</Button>
          <Button variant="default" @click="emit('export')" :disabled="exportSettings.exportScope === 'selected-frame' && !exportSettings.selectedFrameId">Exportar</Button>
        </div>
      </div>
    </template>
  </UiDialog>
</template>
