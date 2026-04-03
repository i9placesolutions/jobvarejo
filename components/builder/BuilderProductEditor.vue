<script setup lang="ts">
import { Plus, ClipboardPaste, ChevronUp, ChevronDown, BookOpen } from 'lucide-vue-next'

const { products, addProduct, updateProduct, reorderProducts, removeAllProducts, productEditorOpen } = useBuilderFlyer()
const showConfirmRemoveAll = ref(false)

const isExpanded = productEditorOpen

const pasteDialogOpen = ref(false)
const catalogPickerOpen = ref(false)

const handleCatalogSelect = async (selected: Array<{ name: string; image: string | null; brand: string | null }>) => {
  const startIndex = products.value.length
  const needsImageSearch: Array<{ name: string; index: number }> = []

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i]!
    addProduct({
      custom_name: item.name,
      custom_image: item.image || undefined,
      observation: item.brand || undefined,
    })
    if (!item.image && item.name && item.name.length >= 3) {
      needsImageSearch.push({ name: item.name, index: startIndex + i })
    }
  }

  // Auto-search Wasabi images for catalog products without images
  if (needsImageSearch.length > 0) {
    try {
      const terms = needsImageSearch.map(p => p.name)
      const result = await $fetch<{ results: Record<string, { key: string; url: string; name: string } | null> }>('/api/builder/batch-search-images', {
        method: 'POST',
        body: { terms },
      })

      if (result.results) {
        for (const item of needsImageSearch) {
          const match = result.results[item.name]
          if (match) {
            updateProduct(item.index, { custom_image: match.key })
          }
        }
      }
    } catch (err) {
      console.error('[BuilderProductEditor] Auto-search catalog images error:', err)
    }
  }
}

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
  <div>
    <!-- Toggle header bar -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-100 transition-colors"
    >
      <div class="flex items-center gap-2">
        <component :is="isExpanded ? ChevronDown : ChevronUp" class="w-3.5 h-3.5 text-gray-400" />
        <span class="text-xs text-gray-500 font-medium">
          {{ products.length }} {{ products.length === 1 ? 'produto' : 'produtos' }}
        </span>
      </div>

      <div class="flex items-center gap-2" @click.stop>
        <button
          @click="catalogPickerOpen = true"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
            border border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
        >
          <BookOpen class="w-3 h-3" />
          Catalogo
        </button>

        <button
          @click="pasteDialogOpen = true"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
            border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
        >
          <ClipboardPaste class="w-3 h-3" />
          Colar
        </button>

        <button
          v-if="products.length > 0"
          @click="showConfirmRemoveAll = true"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
            border border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          Remover Todos
        </button>

        <button
          @click="handleAddProduct"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
            bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus class="w-3 h-3" />
          Adicionar
        </button>
      </div>
    </button>

    <!-- Collapsible product cards -->
    <div v-if="isExpanded" class="px-3 pb-3">
      <div class="overflow-x-auto pb-2 -mx-1 px-1">
        <div class="flex gap-2 min-w-min">
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
            class="shrink-0 w-44 min-h-52 border border-dashed border-gray-300 rounded-xl
              flex flex-col items-center justify-center gap-2
              text-gray-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
          >
            <Plus class="w-5 h-5" />
            <span class="text-[11px]">Adicionar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Paste list dialog -->
    <BuilderPasteListDialog
      :open="pasteDialogOpen"
      @close="pasteDialogOpen = false"
    />

    <!-- Catalog picker dialog -->
    <BuilderCatalogPicker
      :open="catalogPickerOpen"
      @close="catalogPickerOpen = false"
      @select="handleCatalogSelect"
    />

    <!-- Confirmar remocao de todos os produtos -->
    <Teleport to="body">
      <div
        v-if="showConfirmRemoveAll"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        @click.self="showConfirmRemoveAll = false"
      >
        <div class="bg-white border border-gray-200 rounded-xl p-5 mx-4 max-w-sm w-full shadow-2xl">
          <h3 class="text-sm font-semibold text-gray-900 mb-2">Remover todos os produtos?</h3>
          <p class="text-[11px] text-gray-500 mb-4">Esta acao vai remover todos os {{ products.length }} produtos do encarte. Nao pode ser desfeita.</p>
          <div class="flex gap-2 justify-end">
            <button
              @click="showConfirmRemoveAll = false"
              class="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="removeAllProducts(); showConfirmRemoveAll = false"
              class="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              Remover Todos
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
