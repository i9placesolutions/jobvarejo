<script setup lang="ts">
import { Plus, ClipboardPaste } from 'lucide-vue-next'

const { products, addProduct, reorderProducts } = useBuilderFlyer()

const pasteDialogOpen = ref(false)

// Drag & drop state
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const handleDragStart = (index: number, e: DragEvent) => {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

const handleDragOver = (index: number, e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

const handleDragLeave = () => {
  dragOverIndex.value = null
}

const handleDrop = (toIndex: number, e: DragEvent) => {
  e.preventDefault()
  const fromIndex = dragIndex.value
  if (fromIndex !== null && fromIndex !== toIndex) {
    reorderProducts(fromIndex, toIndex)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

const handleDragEnd = () => {
  dragIndex.value = null
  dragOverIndex.value = null
}

const handleAddProduct = () => {
  addProduct({})
}
</script>

<template>
  <div class="p-3 space-y-2">
    <!-- Header bar -->
    <div class="flex items-center justify-between gap-3">
      <span class="text-xs text-zinc-400 font-medium">
        {{ products.length }} {{ products.length === 1 ? 'produto' : 'produtos' }}
      </span>

      <div class="flex items-center gap-2">
        <button
          @click="pasteDialogOpen = true"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
        >
          <ClipboardPaste class="w-3.5 h-3.5" />
          Colar Lista
        </button>

        <button
          @click="handleAddProduct"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus class="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>
    </div>

    <!-- Horizontal scrollable product cards -->
    <div class="overflow-x-auto pb-2 -mx-1 px-1">
      <div class="flex gap-3 min-w-min">
        <div
          v-for="(product, idx) in products"
          :key="product.id"
          draggable="true"
          @dragstart="handleDragStart(idx, $event)"
          @dragover="handleDragOver(idx, $event)"
          @dragleave="handleDragLeave"
          @drop="handleDrop(idx, $event)"
          @dragend="handleDragEnd"
          :class="[
            'shrink-0 transition-all duration-150',
            dragIndex === idx ? 'opacity-40 scale-95' : '',
            dragOverIndex === idx && dragIndex !== idx ? 'translate-x-2' : ''
          ]"
        >
          <BuilderProductEditorCard :product="product" :index="idx" />
        </div>

        <!-- Add product card -->
        <button
          @click="handleAddProduct"
          class="shrink-0 w-[220px] min-h-[320px] border border-dashed border-white/10 rounded-xl
            flex flex-col items-center justify-center gap-2
            text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
        >
          <Plus class="w-6 h-6" />
          <span class="text-xs">Adicionar produto</span>
        </button>
      </div>
    </div>

    <!-- Paste list dialog -->
    <BuilderPasteListDialog
      :open="pasteDialogOpen"
      @close="pasteDialogOpen = false"
    />
  </div>
</template>
