<script setup lang="ts">
import {
  MousePointer2,
  Frame,
  ChevronDown,
  Square,
  Circle,
  Type,
  PenTool,
  LayoutGrid,
  Tag
} from 'lucide-vue-next'

defineProps<{
  isDrawing: boolean
  isPenMode: boolean
}>()

const emit = defineEmits<{
  (e: 'select-tool'): void
  (e: 'add-frame'): void
  (e: 'add-shape', type: string, options?: Record<string, any>): void
  (e: 'add-text', variant?: string): void
  (e: 'toggle-pen-mode'): void
  (e: 'toggle-drawing'): void
  (e: 'set-pen-width', width: number): void
  (e: 'add-grid-zone'): void
  (e: 'open-label-templates'): void
}>()
</script>

<template>
  <div class="absolute left-1/2 -translate-x-1/2 floating-toolbar flex items-center gap-1.5 bg-[#18181b]/80 p-1.5 rounded-2xl shadow-2xl border border-white/10 z-30 select-none backdrop-blur-md">
    <button @click="emit('select-tool')" title="Mover (V)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all shadow-inner" :class="!isDrawing && !isPenMode ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'">
      <MousePointer2 class="w-4 h-4" />
    </button>
    <div class="w-px h-6 bg-white/10 mx-0.5"></div>

    <div class="relative group">
      <button @click="emit('add-frame')" title="Quadro (F)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Frame class="w-4 h-4" />
        <ChevronDown class="absolute bottom-1 right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button @click="emit('add-frame')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Quadro</button>
        <button @click="emit('add-shape', 'rect')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Retângulo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'rect')" title="Forma (R)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Square class="w-4 h-4" />
        <ChevronDown class="absolute bottom-1 right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button @click="emit('add-shape', 'rect')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Retângulo</button>
        <button @click="emit('add-shape', 'rect', { rx: 20, ry: 20 })" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Retângulo Arredondado</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'circle')" title="Círculo (O)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Circle class="w-4 h-4" />
        <ChevronDown class="absolute bottom-1 right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button @click="emit('add-shape', 'circle')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Círculo</button>
        <button @click="emit('add-shape', 'ellipse')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Elipse</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-text')" title="Texto (T)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Type class="w-4 h-4" />
        <ChevronDown class="absolute bottom-1 right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button @click="emit('add-text')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Texto</button>
        <button @click="emit('add-text', 'heading')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Título</button>
        <button @click="emit('add-text', 'body')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Corpo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('toggle-pen-mode')" title="Caneta (P)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-all relative shadow-inner" :class="isPenMode ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white border border-transparent'">
        <PenTool class="w-4 h-4" />
        <ChevronDown class="absolute bottom-1 right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <button @click="emit('toggle-pen-mode')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Caneta</button>
        <button @click="emit('toggle-drawing')" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Lápis</button>
        <div class="h-px bg-white/10 my-1"></div>
        <button @click="emit('set-pen-width', 5)" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Fino (5px)</button>
        <button @click="emit('set-pen-width', 10)" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Médio (10px)</button>
        <button @click="emit('set-pen-width', 20)" class="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">Grosso (20px)</button>
      </div>
    </div>

    <div class="w-px h-6 bg-white/10 mx-0.5"></div>

    <button @click="emit('add-grid-zone')" title="Nova Zona de Produtos" class="w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-inner border border-transparent hover:border-violet-500/30 hover:bg-violet-500/10 text-cyan-400">
      <LayoutGrid class="w-4 h-4 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
    </button>

    <button @click="emit('open-label-templates')" title="Modelos de Etiqueta" class="w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer shadow-inner border border-transparent hover:border-amber-500/30 hover:bg-amber-500/10 text-amber-400">
      <Tag class="w-4 h-4 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
    </button>
  </div>
</template>
