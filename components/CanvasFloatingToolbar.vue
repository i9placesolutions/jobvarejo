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
  <div class="absolute left-1/2 -translate-x-1/2 floating-toolbar flex items-center gap-1 bg-[#2a2a2a] p-1.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] border border-white/10 z-30 select-none backdrop-blur-sm">
    <button @click="emit('select-tool')" title="Mover (V)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all" :class="!isDrawing ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'">
      <MousePointer2 class="w-4 h-4" />
    </button>
    <div class="w-px h-6 bg-white/10 mx-0.5"></div>

    <div class="relative group">
      <button @click="emit('add-frame')" title="Quadro (F)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Frame class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-frame')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Quadro</button>
        <button @click="emit('add-shape', 'rect')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retangulo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'rect')" title="Retangulo (R)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Square class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-shape', 'rect')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retangulo</button>
        <button @click="emit('add-shape', 'rect', { rx: 20, ry: 20 })" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retangulo Arredondado</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'circle')" title="Circulo (O)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Circle class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-shape', 'circle')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Circulo</button>
        <button @click="emit('add-shape', 'ellipse')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Elipse</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-text')" title="Texto (T)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
        <Type class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-text')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Texto</button>
        <button @click="emit('add-text', 'heading')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Titulo</button>
        <button @click="emit('add-text', 'body')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Corpo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('toggle-pen-mode')" title="Caneta (P)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all relative" :class="isPenMode ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'">
        <PenTool class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('toggle-pen-mode')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Caneta</button>
        <button @click="emit('toggle-drawing')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Lapis</button>
        <div class="h-px bg-white/10 my-1"></div>
        <button @click="emit('set-pen-width', 5)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Fino (5px)</button>
        <button @click="emit('set-pen-width', 10)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Medio (10px)</button>
        <button @click="emit('set-pen-width', 20)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Grosso (20px)</button>
      </div>
    </div>

    <div class="w-px h-6 bg-white/10 mx-0.5"></div>

    <button @click="emit('add-grid-zone')" title="Zona de Produtos" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
      <LayoutGrid class="w-4 h-4" />
    </button>

    <button @click="emit('open-label-templates')" title="Modelos de Etiqueta" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
      <Tag class="w-4 h-4" />
    </button>
  </div>
</template>
