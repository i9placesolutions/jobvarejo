<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'

type ShareScope = 'canvas' | 'selected-frame' | 'all-frames'
type ShareFormat = 'png' | 'jpeg'

const props = defineProps<{
  modelValue: boolean
  shareSettings: {
    format: ShareFormat | string
    scale: number
    quality: number
    shareScope: ShareScope | string
    selectedFrameId: string
    selectedFrameIds: string[]
    shareAsFiles: boolean
  }
  availableFramesForExport: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'share'): void
  (e: 'toggle-frame', frameId: string): void
  (e: 'select-all'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})
</script>

<template>
  <UiDialog v-model="open" title="Exportar" @close="open = false" width="400px">
    <template #default>
      <div class="space-y-5 py-3">
        <div class="space-y-1.5">
          <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Área</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              @click="shareSettings.shareScope = 'canvas'"
              :class="shareSettings.shareScope === 'canvas' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
              class="py-2 text-[11px] font-medium rounded-lg transition-all"
            >
              Página Inteira
            </button>
            <button
              @click="shareSettings.shareScope = 'selected-frame'"
              :class="shareSettings.shareScope === 'selected-frame' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
              class="py-2 text-[11px] font-medium rounded-lg transition-all"
            >
              Frame
            </button>
            <button
              @click="shareSettings.shareScope = 'all-frames'"
              :class="shareSettings.shareScope === 'all-frames' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
              class="py-2 text-[11px] font-medium rounded-lg transition-all"
            >
              Todos Frames
            </button>
          </div>
        </div>

        <div v-if="shareSettings.shareScope === 'selected-frame'" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Frames</label>
            <button
              @click="emit('select-all')"
              class="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              {{ shareSettings.selectedFrameIds.length === availableFramesForExport.length ? 'Desmarcar todos' : 'Selecionar todos' }}
            </button>
          </div>
          <div class="bg-zinc-800 border border-zinc-700 rounded-lg max-h-32 overflow-y-auto custom-scrollbar">
            <label
              v-for="frame in availableFramesForExport"
              :key="frame.id"
              class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-zinc-700/50 transition-colors border-b border-zinc-700/50 last:border-b-0"
            >
              <input
                type="checkbox"
                :checked="shareSettings.selectedFrameIds.includes(frame.id)"
                @change="emit('toggle-frame', frame.id)"
                class="w-3.5 h-3.5 rounded border-zinc-600 text-violet-500 focus:ring-violet-500/30 bg-zinc-700 shrink-0"
              />
              <span class="text-xs text-white truncate">{{ frame.name }}</span>
            </label>
            <div v-if="!availableFramesForExport.length" class="px-3 py-3 text-[10px] text-zinc-500 text-center">Nenhum frame encontrado</div>
          </div>
        </div>

        <div v-if="shareSettings.shareScope !== 'all-frames'" class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Formato</label>
            <div class="flex gap-1.5">
              <button @click="shareSettings.format = 'png'" :class="shareSettings.format === 'png' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">PNG</button>
              <button @click="shareSettings.format = 'jpeg'" :class="shareSettings.format === 'jpeg' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">JPG</button>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Escala</label>
            <div class="flex gap-1.5">
              <button @click="shareSettings.scale = 1" :class="shareSettings.scale === 1 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">1x</button>
              <button @click="shareSettings.scale = 2" :class="shareSettings.scale === 2 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">2x</button>
              <button @click="shareSettings.scale = 3" :class="shareSettings.scale === 3 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">3x</button>
            </div>
          </div>
        </div>

        <div v-if="shareSettings.shareScope === 'all-frames'" class="space-y-1.5">
          <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Escala</label>
          <div class="flex gap-1.5 max-w-50">
            <button @click="shareSettings.scale = 1" :class="shareSettings.scale === 1 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">1x</button>
            <button @click="shareSettings.scale = 2" :class="shareSettings.scale === 2 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">2x</button>
            <button @click="shareSettings.scale = 3" :class="shareSettings.scale === 3 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">3x</button>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <button @click="open = false" class="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-all">Cancelar</button>
        <Button variant="default" size="sm" @click="emit('share')" :disabled="shareSettings.shareScope === 'selected-frame' && shareSettings.selectedFrameIds.length === 0">
          <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar
        </Button>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-left: 1px solid #333;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 5px;
  border: 2px solid #1e1e1e;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>
