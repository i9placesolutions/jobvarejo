<script setup lang="ts">
import { computed } from 'vue'
import {
  Combine,
  Scissors,
  Eye,
  PenTool,
  PlusCircle,
  MinusCircle,
  Move3D,
  X,
} from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  isVectorPath: boolean
  isNodeEditing: boolean
  canDeletePoint: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-visible'): void
  (e: 'toggle-handles'): void
  (e: 'add-point'): void
  (e: 'delete-point'): void
  (e: 'split-path'): void
  (e: 'simplify-path'): void
  (e: 'close-path'): void
}>()

const isVisible = computed(() => props.visible && props.isVectorPath)
</script>

<template>
  <Transition>
    <div
      v-if="isVisible"
      class="absolute left-1/2 -translate-x-1/2 bottom-20 contextual-toolbar flex items-center gap-1.5 bg-[#18181b]/80 p-1.5 rounded-2xl shadow-2xl border border-white/10 z-40 select-none backdrop-blur-md"
    >
      <button
        title="Unir (requer múltiplos caminhos)"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all opacity-50 cursor-not-allowed shadow-inner border border-transparent"
      >
        <Combine class="w-4 h-4" />
      </button>

      <button
        title="Subtrair (requer múltiplos caminhos)"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all opacity-50 cursor-not-allowed shadow-inner border border-transparent"
      >
        <Scissors class="w-4 h-4" />
      </button>

      <div class="w-px h-6 bg-white/10 mx-0.5"></div>

      <button
        title="Alternar Visibilidade"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        @click="emit('toggle-visible')"
      >
        <Eye class="w-4 h-4" />
      </button>

      <button
        title="Editar Nós"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all shadow-inner"
        :class="isNodeEditing ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white border border-transparent'"
        @click="emit('toggle-handles')"
      >
        <PenTool class="w-4 h-4" />
      </button>

      <button
        title="Adicionar Ponto"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        @click="emit('add-point')"
      >
        <PlusCircle class="w-4 h-4" />
      </button>

      <button
        title="Excluir Ponto (Delete)"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        :class="canDeletePoint ? '' : 'opacity-50 cursor-not-allowed'"
        @click="emit('delete-point')"
      >
        <MinusCircle class="w-4 h-4" />
      </button>

      <div class="w-px h-6 bg-white/10 mx-0.5"></div>

      <button
        title="Dividir Caminho"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        @click="emit('split-path')"
      >
        <Scissors class="w-4 h-4" />
      </button>

      <button
        title="Simplificar Caminho"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        @click="emit('simplify-path')"
      >
        <Move3D class="w-4 h-4" />
      </button>

      <button
        title="Fechar Caminho"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-inner border border-transparent"
        @click="emit('close-path')"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </Transition>
</template>
