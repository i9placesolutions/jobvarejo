<script setup lang="ts">
const {
  layout,
  theme,
  paginatedProducts,
  productsPerPage,
  highlightPositions,
} = useBuilderFlyer()

const {
  isAuto,
  effectiveGrid,
  hasHighlightLayout,
  highlightGridStyle,
  getCellAreaName,
} = useBuilderLayout()

const gap = computed(() => theme.value?.body_config?.gap ?? 8)
const padding = computed(() => theme.value?.body_config?.padding ?? 12)

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
  const result: Array<{
    product: typeof prods[number] | null
    index: number
    isHighlight: boolean
    areaName: string
  }> = []

  for (let i = 0; i < perPage; i++) {
    const isHL = hlPositions.includes(i) || prods[i]?.is_highlight
    result.push({
      product: prods[i] || null,
      index: i,
      isHighlight: !!isHL,
      areaName: getCellAreaName(i, !!isHL),
    })
  }
  return result
})
</script>

<template>
  <div :style="gridStyle" class="w-full h-full overflow-hidden">
    <template v-for="cell in cells" :key="cell.index">
      <!-- Product card -->
      <BuilderFlyerProductCard
        v-if="cell.product"
        :product="cell.product"
        :is-highlight="cell.isHighlight"
        :style="hasHighlightLayout ? { gridArea: cell.areaName, minHeight: 0 } : { minHeight: 0 }"
      />

      <!-- Empty slot placeholder -->
      <div
        v-else
        class="flex items-center justify-center rounded border-2 border-dashed opacity-30 min-h-0 overflow-hidden"
        :style="{
          borderColor: 'var(--builder-text, #999)',
          borderRadius: 'var(--builder-border-radius, 8px)',
          ...(hasHighlightLayout ? { gridArea: cell.areaName } : {}),
        }"
      >
        <span
          class="text-3xl font-light"
          :style="{ color: 'var(--builder-text, #999)' }"
        >
          +
        </span>
      </div>
    </template>
  </div>
</template>
