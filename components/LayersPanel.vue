<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from './ui/Button.vue'
import { Eye, EyeOff, Lock, Unlock, Trash2, ArrowUp, ArrowDown, Box, Type, Image as ImageIcon, Square, Circle, Triangle } from 'lucide-vue-next'

const props = defineProps<{
  objects: any[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'toggle-visible', id: string): void
  (e: 'toggle-lock', id: string): void
  (e: 'delete', id: string): void
  (e: 'move-up', id: string): void
  (e: 'move-down', id: string): void
  (e: 'rename', id: string, name: string): void // New
}>()

const editingId = ref<string | null>(null)
const editingName = ref('')

const startEditing = (obj: any) => {
    editingId.value = obj._customId;
    editingName.value = getLayerName(obj, 0);
}

const finishEditing = () => {
    if (editingId.value && editingName.value.trim()) {
        emit('rename', editingId.value, editingName.value.trim());
    }
    editingId.value = null;
    editingName.value = '';
}

// Helper to get a name for the layer
const getLayerName = (obj: any, index: number) => {
    if (obj.layerName) return obj.layerName; // Custom override
    
    // Frames should always be labeled as FRAMER by default (even if Fabric `name` says otherwise),
    // unless the user explicitly renamed via `layerName`.
    const isFigmaBlue = (stroke: any) => {
      if (stroke == null) return false
      const s = String(stroke).trim().toLowerCase()
      if (!s) return false
      if (s === '#0d99ff') return true
      // rgb/rgba formats: rgb(13, 153, 255) or rgba(13,153,255,1)
      const m = s.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i)
      if (m) {
        const r = Number(m[1]), g = Number(m[2]), b = Number(m[3])
        return Math.abs(r - 13) <= 1 && Math.abs(g - 153) <= 1 && Math.abs(b - 255) <= 1
      }
      return false
    }

    const n = String(obj?.name || '').trim()
    const isFrameLike =
      !!obj?.isFrame ||
      /^frame\b/i.test(n) ||
      (obj?.type === 'rect' && (obj?.clipContent === true || obj?.clipContent === 1) && isFigmaBlue(obj?.stroke))

    // CRITICAL: Always show "FRAMER" for frames, regardless of name
    // This ensures persistence even if name gets corrupted during save/load
    if (isFrameLike) {
      // If user renamed via layerName, use that; otherwise show "FRAMER"
      return obj?.layerName && obj.layerName !== 'FRAMER' ? obj.layerName : 'FRAMER'
    }

    if (obj.name && obj.name !== '') return obj.name; // Fabric name property
    
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') return obj.text?.substring(0, 18) || 'Texto'
    if (obj.type === 'image') return obj.isBackground ? 'Plano de Fundo' : 'Imagem'
    if (obj.type === 'group') {
        if (obj.isSmartGroup) return '📦 GRID ' + (obj.productName?.substring(0, 10) || 'SMART')
        return 'Grupo'
    }
    // CRITICAL: Don't show "Retângulo" for frames - check again before returning
    if (obj.type === 'rect') {
        // Double-check if this is actually a frame (might have been missed above)
        const checkIsFrame = !!obj?.isFrame || 
            /^frame\b/i.test(String(obj?.name || '')) ||
            (obj?.clipContent === true || obj?.clipContent === 1) && isFigmaBlue(obj?.stroke);
        if (checkIsFrame) {
            // This is a frame, should have been caught above, but return FRAMER anyway
            return obj?.layerName && obj.layerName !== 'FRAMER' ? obj.layerName : 'FRAMER';
        }
        return 'Retângulo';
    }
    if (obj.type === 'circle') return 'Círculo'
    if (obj.type === 'line') return 'Linha'
    if (obj.type === 'path') return 'Vetor' 
    return 'Camada'
}
</script>

<template>
  <div class="flex flex-col h-full bg-transparent">
    <!-- Layers Header (Figma Style) -->
    <div class="px-3 py-2 border-b border-white/5 shrink-0">
      <span class="text-[10px] font-semibold uppercase text-zinc-500">Layers</span>
    </div>
    
    <div class="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
      <div 
        v-for="(obj, index) in [...objects].reverse().filter((o, idx, arr) => {
          // IMPORTANT: .reverse() ensures top layer (front) shows at top of list (like Figma)
          // In Fabric.js, last object in array = front/top z-index
          // Filter out artboard and guides
          if (o.id === 'artboard-bg' || o.id === 'guide-vertical' || o.id === 'guide-horizontal') return false;
          // Filter out objects marked as excludeFromExport (preview paths, control points, etc.)
          if ((o as any)?.excludeFromExport) return false;
          // Filter out editing control objects by name
          const name = (o as any)?.name || '';
          if (name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') return false;
          // CRITICAL: Filter out objects with control data (parentPath or parentObj)
          const data = (o as any)?.data;
          if (data && (data.parentPath || data.parentObj || data.type === 'node' || data.type === 'handle_in' || data.type === 'handle_out')) return false;
          // CRITICAL: Filter out small circles that are likely control points (radius <= 10)
          if (o.type === 'circle' && (o as any).radius && (o as any).radius <= 10) return false;
          // Filter out circles without _customId (orphaned control circles)
          if (o.type === 'circle' && !(o as any)._customId) return false;
          // Filter out lines without _customId (handle lines)
          if (o.type === 'line' && !(o as any)._customId) return false;
          // Filter out paths without _customId and without isVectorPath flag
          if (o.type === 'path' && !(o as any)._customId && !(o as any).isVectorPath) return false;
          // CRITICAL: Remove duplicates by _customId (same object appearing twice)
          const customId = (o as any)?._customId;
          if (!customId) return false; // Must have _customId to be valid
          const firstIndex = arr.findIndex(item => (item as any)?._customId === customId);
          return firstIndex === idx;
        })" 
        :key="(obj as any)?._customId || index"
        :class="[
            'flex items-center gap-2 px-3 py-1.5 rounded-[2px] transition-all duration-150 group cursor-default select-none border border-transparent',
            (obj as any)._customId === selectedId 
              ? 'bg-violet-500 text-white font-medium' 
              : 'hover:bg-white/5 text-zinc-400 hover:text-white'
        ]"
        @click="emit('select', (obj as any)._customId)"
      >
        <!-- Icon container -->
        <div class="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
           <Box v-if="obj.type === 'group'" class="w-3 h-3" />
           <Type v-else-if="obj.type.includes('text')" class="w-3.5 h-3.5" />
           <ImageIcon v-else-if="obj.type === 'image'" class="w-3.5 h-3.5" />
           <Square v-else-if="obj.type === 'rect'" class="w-3.5 h-3.5" />
           <Circle v-else-if="obj.type === 'circle'" class="w-3.5 h-3.5" />
           <Triangle v-else class="w-3.5 h-3.5" />
        </div>

        <div class="grow min-w-0" @dblclick.stop="startEditing(obj)">
            <input 
                v-if="editingId === (obj as any)._customId"
                v-model="editingName"
                @blur="finishEditing"
                @keyup.enter="finishEditing"
                class="w-full bg-[#1e1e1e] text-white text-[10px] px-1 py-0.5 border border-violet-500 rounded focus:outline-none"
                autoFocus
                ref="nameInput"
            />
            <span v-else :class="['text-[10px] font-bold uppercase tracking-wider truncate block transition-all', (obj as any)._customId === selectedId ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300']">
                {{ getLayerName(obj, objects.length - 1 - index) }}
            </span>
        </div>

        <!-- Actions (Simplified icons) -->
        <div :class="['flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity', (obj as any)._customId === selectedId ? 'opacity-100' : '']">
           <button @click.stop="emit('toggle-visible', (obj as any)._customId)" class="p-1.5 hover:text-white transition-colors text-zinc-600">
              <Eye v-if="obj.visible" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
              <EyeOff v-else class="w-3.5 h-3.5 text-red-500" />
           </button>
           <button @click.stop="emit('toggle-lock', (obj as any)._customId)" class="p-1.5 hover:text-white transition-colors text-zinc-600">
              <Unlock v-if="!obj.lockMovementX" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
              <Lock v-else class="w-3.5 h-3.5 text-amber-500" />
           </button>
           <button @click.stop="emit('delete', (obj as any)._customId)" class="p-1.5 hover:text-red-500 transition-colors text-zinc-600">
              <Trash2 class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
           </button>
        </div>
      </div>
      
      <div v-if="objects.length === 0" class="flex flex-col items-center justify-center py-20 opacity-20">
          <Box class="w-10 h-10 mb-3 text-zinc-600" />
          <p class="text-[9px] uppercase tracking-[0.3em] font-black text-zinc-600">Nenhuma Camada</p>
      </div>
    </div>

    <!-- Move Actions (Bottom) -->
    <div class="px-3 py-4 border-t border-zinc-800 flex items-center gap-2 bg-[#09090b]">
         <button @click="selectedId && emit('move-up', selectedId)" :disabled="!selectedId" class="flex-1 h-8 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] border border-zinc-700 rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm">
            <ArrowUp class="w-3 h-3" /> Subir
         </button>
         <button @click="selectedId && emit('move-down', selectedId)" :disabled="!selectedId" class="flex-1 h-8 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] border border-zinc-700 rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm">
            <ArrowDown class="w-3 h-3" /> Descer
         </button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
</style>
