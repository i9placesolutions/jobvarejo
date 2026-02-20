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
  <div class="floating-toolbar-shell absolute left-1/2 -translate-x-1/2 floating-toolbar flex items-center gap-1 p-1.5 rounded-xl z-30 select-none backdrop-blur-sm">
    <button @click="emit('select-tool')" title="Mover (V)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all" :class="!isDrawing ? 'is-active' : ''">
      <MousePointer2 class="w-4 h-4" />
    </button>
    <div class="toolbar-separator w-px h-6 mx-0.5"></div>

    <div class="relative group">
      <button @click="emit('add-frame')" title="Quadro (F)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all relative">
        <Frame class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 toolbar-chevron opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="toolbar-menu absolute top-full left-0 mt-1 rounded-lg py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-frame')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Quadro</button>
        <button @click="emit('add-shape', 'rect')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Retangulo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'rect')" title="Retangulo (R)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all relative">
        <Square class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 toolbar-chevron opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="toolbar-menu absolute top-full left-0 mt-1 rounded-lg py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-shape', 'rect')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Retangulo</button>
        <button @click="emit('add-shape', 'rect', { rx: 20, ry: 20 })" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Retangulo Arredondado</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-shape', 'circle')" title="Circulo (O)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all relative">
        <Circle class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 toolbar-chevron opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="toolbar-menu absolute top-full left-0 mt-1 rounded-lg py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-shape', 'circle')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Circulo</button>
        <button @click="emit('add-shape', 'ellipse')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Elipse</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('add-text')" title="Texto (T)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all relative">
        <Type class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 toolbar-chevron opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="toolbar-menu absolute top-full left-0 mt-1 rounded-lg py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('add-text')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Texto</button>
        <button @click="emit('add-text', 'heading')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Titulo</button>
        <button @click="emit('add-text', 'body')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Corpo</button>
      </div>
    </div>

    <div class="relative group">
      <button @click="emit('toggle-pen-mode')" title="Caneta (P)" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all relative" :class="isPenMode ? 'is-active' : ''">
        <PenTool class="w-4 h-4" />
        <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 toolbar-chevron opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      <div class="toolbar-menu absolute top-full left-0 mt-1 rounded-lg py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <button @click="emit('toggle-pen-mode')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Caneta</button>
        <button @click="emit('toggle-drawing')" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Lapis</button>
        <div class="toolbar-separator h-px my-1"></div>
        <button @click="emit('set-pen-width', 5)" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Fino (5px)</button>
        <button @click="emit('set-pen-width', 10)" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Medio (10px)</button>
        <button @click="emit('set-pen-width', 20)" class="toolbar-menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Grosso (20px)</button>
      </div>
    </div>

    <div class="toolbar-separator w-px h-6 mx-0.5"></div>

    <button @click="emit('add-grid-zone')" title="Zona de Produtos" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all">
      <LayoutGrid class="w-4 h-4" />
    </button>

    <button @click="emit('open-label-templates')" title="Modelos de Etiqueta" class="toolbar-btn w-8 h-8 flex items-center justify-center rounded-lg transition-all">
      <Tag class="w-4 h-4" />
    </button>
  </div>
</template>

<style scoped>
.floating-toolbar-shell {
  color: #d8d4ce;
  background: linear-gradient(180deg, rgba(36, 31, 28, 0.92) 0%, rgba(24, 20, 18, 0.92) 100%);
  border: 1px solid rgba(255, 231, 199, 0.18);
  box-shadow: 0 16px 30px -16px rgba(0, 0, 0, 0.75);
}

.toolbar-btn {
  color: #b7afa5;
}

.toolbar-btn:hover {
  color: #fff8ef;
  background: rgba(255, 248, 239, 0.12);
}

.toolbar-btn.is-active {
  color: #ffd9c9;
  background: rgba(179, 38, 30, 0.28);
  border: 1px solid rgba(217, 120, 100, 0.45);
}

.toolbar-menu {
  background: linear-gradient(180deg, #2c2522 0%, #231d1a 100%);
  border: 1px solid rgba(255, 231, 199, 0.2);
  box-shadow: 0 16px 26px -18px rgba(0, 0, 0, 0.8);
}

.toolbar-menu-item {
  color: #f4ece2;
}

.toolbar-menu-item:hover {
  background: rgba(255, 248, 239, 0.12);
}

.toolbar-chevron {
  color: #948a7d;
}

.toolbar-separator {
  background: rgba(255, 231, 199, 0.16);
}
</style>
