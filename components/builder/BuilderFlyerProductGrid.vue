<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

const {
  flyer,
  layout,
  theme,
  paginatedProducts,
  productsPerPage,
  highlightPositions,
  addProduct,
  updateProduct,
  reorderProducts,
  productEditorOpen,
  cardTemplates,
} = useBuilderFlyer()

// Template de card ativo (do banco, se selecionado)
const activeCardTemplate = computed(() => {
  const tplId = (flyer.value as any)?.card_template_id
  if (tplId) {
    return cardTemplates.value.find((t: any) => t.id === tplId) || null
  }
  return cardTemplates.value[0] || null
})

// Duplo clique alterna destaque
const toggleHighlight = (idx: number) => {
  const prod = paginatedProducts.value[idx]
  if (!prod) return
  updateProduct(idx, { is_highlight: !prod.is_highlight })
}

// ── Drag & Drop para reordenar produtos ─────────────────────────────────────
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const onDragStart = (e: DragEvent, idx: number) => {
  dragFromIndex.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}

const onDragOver = (e: DragEvent, idx: number) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = idx
}

const onDragLeave = () => {
  dragOverIndex.value = null
}

const onDrop = (e: DragEvent, toIdx: number) => {
  e.preventDefault()
  const fromIdx = dragFromIndex.value
  if (fromIdx !== null && fromIdx !== toIdx) {
    reorderProducts(fromIdx, toIdx)
  }
  dragFromIndex.value = null
  dragOverIndex.value = null
}

const onDragEnd = () => {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

const {
  isAuto,
  effectiveGrid,
  hasHighlightLayout,
  highlightGridStyle,
  autoHighlightPositions,
  getCellAreaName,
} = useBuilderLayout()

const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const gap = computed(() => fontConfig.value.card_gap ?? theme.value?.body_config?.gap ?? 8)
const padding = computed(() => fontConfig.value.card_padding ?? theme.value?.body_config?.padding ?? 12)

// Standard grid style (no highlight areas)
const standardGridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${effectiveGrid.value.columns}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${effectiveGrid.value.rows}, minmax(0, 1fr))`,
  gap: `${gap.value}px`,
  padding: `${padding.value}px`,
  backgroundColor: 'var(--builder-body-bg, transparent)',
}))

// Use highlight layout if available, otherwise standard
const gridStyle = computed(() => {
  if (hasHighlightLayout.value && highlightGridStyle.value) {
    return {
      ...highlightGridStyle.value,
      gap: `${gap.value}px`,
      padding: `${padding.value}px`,
      backgroundColor: 'var(--builder-body-bg, transparent)',
    }
  }
  return standardGridStyle.value
})

// Build cells: product slots + empty placeholders
const cells = computed(() => {
  const perPage = isAuto.value
    ? paginatedProducts.value.length || 1
    : productsPerPage.value
  const prods = paginatedProducts.value
  const hlPositions = highlightPositions.value
  const autoHL = autoHighlightPositions.value
  const cols = effectiveGrid.value.columns
  const usingHighlightAreas = hasHighlightLayout.value
  const result: Array<{
    product: typeof prods[number] | null
    index: number
    isHighlight: boolean
    areaName: string
    colSpan: number
  }> = []

  // Rastrear posicoes consumidas por destaque (colSpan 2)
  let skipNext = false
  for (let i = 0; i < perPage; i++) {
    if (skipNext) { skipNext = false; continue }

    // Determine if this position is a highlight
    const isHL = hlPositions.includes(i) || autoHL.includes(i) || prods[i]?.is_highlight
    let colSpan = 1

    if (isHL && cols >= 2 && !usingHighlightAreas) {
      // Produto destacado ocupa 2 colunas (se nao estiver na ultima coluna da linha)
      const posInRow = i % cols
      if (posInRow < cols - 1) {
        colSpan = 2
        skipNext = true // pular proxima posicao (ocupada pelo span)
      }
    } else if (isAuto.value && !usingHighlightAreas && prods[i] && i === prods.length - 1) {
      // Ultimo produto preenche colunas restantes
      const posInRow = i % cols
      const remaining = cols - posInRow
      if (remaining > 1) colSpan = remaining
    }

    result.push({
      product: prods[i] || null,
      index: i,
      isHighlight: !!isHL,
      areaName: getCellAreaName(i, !!isHL),
      colSpan,
    })
  }
  return result
})

const columns = computed(() => effectiveGrid.value.columns)
const pageProductCount = computed(() => Math.max(1, paginatedProducts.value.length))

const hasProducts = computed(() => paginatedProducts.value.length > 0)

const handleOpenEditor = () => {
  productEditorOpen.value = true
}
</script>

<template>
  <!-- Empty state: no products — single large CTA -->
  <div
    v-if="!hasProducts"
    class="w-full h-full flex flex-col items-center justify-center cursor-pointer group"
    :style="{ padding: `${padding}px`, backgroundColor: 'var(--builder-body-bg, transparent)' }"
    @click="handleOpenEditor"
  >
    <div
      class="w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all
        group-hover:scale-110"
      :style="{ borderColor: 'var(--builder-text, rgba(150,150,150,0.3))' }"
    >
      <Plus
        class="w-8 h-8"
        :style="{ color: 'var(--builder-text, rgba(150,150,150,0.4))' }"
      />
    </div>
    <span
      class="text-base font-semibold mt-3 opacity-40 group-hover:opacity-70 transition-opacity"
      :style="{ color: 'var(--builder-text, #999)' }"
    >
      Adicionar produtos
    </span>
    <span
      class="text-xs mt-1 opacity-25 group-hover:opacity-50 transition-opacity"
      :style="{ color: 'var(--builder-text, #999)' }"
    >
      Clique para abrir o editor
    </span>
  </div>

  <!-- Grid with products -->
  <div v-else :style="gridStyle" class="w-full h-full overflow-hidden">
    <template v-for="cell in cells" :key="cell.index">
      <!-- Card dinamico (template do banco) ou card legado -->
      <BuilderDynamicCard
        v-if="cell.product && activeCardTemplate"
        :product="cell.product"
        :template="activeCardTemplate"
        :is-highlight="cell.isHighlight"
        :columns="columns"
        :page-product-count="pageProductCount"
        draggable="true"
        :style="{
          minHeight: 0,
          cursor: dragFromIndex !== null ? 'grabbing' : 'grab',
          opacity: dragFromIndex === cell.index ? 0.4 : 1,
          outline: dragOverIndex === cell.index && dragFromIndex !== cell.index ? '3px dashed var(--builder-accent, #10b981)' : 'none',
          outlineOffset: '-3px',
          transition: 'opacity 0.15s, outline 0.15s',
          ...(hasHighlightLayout ? { gridArea: cell.areaName } : {}),
          ...(cell.colSpan > 1 ? { gridColumn: `span ${cell.colSpan}` } : {}),
        }"
        @dragstart="onDragStart($event, cell.index)"
        @dragover="onDragOver($event, cell.index)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, cell.index)"
        @dragend="onDragEnd"
        @dblclick="toggleHighlight(cell.index)"
      />

      <!-- Card legado (fallback quando sem template dinamico) -->
      <BuilderFlyerProductCard
        v-else-if="cell.product && !activeCardTemplate"
        :product="cell.product"
        :is-highlight="cell.isHighlight"
        :columns="columns"
        :box-index="cell.index"
        :page-product-count="pageProductCount"
        draggable="true"
        :style="{
          minHeight: 0,
          cursor: dragFromIndex !== null ? 'grabbing' : 'grab',
          opacity: dragFromIndex === cell.index ? 0.4 : 1,
          outline: dragOverIndex === cell.index && dragFromIndex !== cell.index ? '3px dashed var(--builder-accent, #10b981)' : 'none',
          outlineOffset: '-3px',
          transition: 'opacity 0.15s, outline 0.15s',
          ...(hasHighlightLayout ? { gridArea: cell.areaName } : {}),
          ...(cell.colSpan > 1 ? { gridColumn: `span ${cell.colSpan}` } : {}),
        }"
        @dragstart="onDragStart($event, cell.index)"
        @dragover="onDragOver($event, cell.index)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, cell.index)"
        @dragend="onDragEnd"
        @dblclick="toggleHighlight(cell.index)"
      />

      <!-- Empty slot placeholder -->
      <div
        v-else
        class="flex items-center justify-center rounded border-2 border-dashed opacity-20 min-h-0 overflow-hidden"
        :style="{
          borderColor: 'var(--builder-text, #999)',
          borderRadius: 'var(--builder-border-radius, 8px)',
          ...(hasHighlightLayout ? { gridArea: cell.areaName } : {}),
        }"
      >
        <span class="text-3xl font-light" :style="{ color: 'var(--builder-text, #999)' }">+</span>
      </div>
    </template>
  </div>
</template>
