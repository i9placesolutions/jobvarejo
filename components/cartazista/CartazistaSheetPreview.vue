<script setup lang="ts">
import ArtPreview from '~/components/cartazista/CartazistaPreview.vue'
import type { ArtComposition } from '~/types/art-studio'
import type { CartazistaFormat } from '~/types/cartazista'

defineProps<{
  compositions: ArtComposition[]
  format: CartazistaFormat
  columns?: number
}>()
</script>

<template>
  <div class="cartazista-print-preview">
    <div class="cartazista-print-toolbar">
      <span>Prévia de impressão · {{ compositions.length }} cartaz(es)</span>
      <small>{{ format.label }} · organize e use “Imprimir” para salvar em PDF</small>
    </div>
    <div class="cartazista-print-grid" :style="{ '--print-columns': columns || format.sheetColumns }">
      <div v-for="(composition, index) in compositions" :key="`${composition.width}-${composition.height}-${index}`" class="cartazista-print-card">
        <ArtPreview :composition="composition" :label="`Prévia do cartaz ${index + 1}`" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cartazista-print-preview { min-height: 100%; background: #fff; color: #172334; padding: 24px; }
.cartazista-print-toolbar { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid #e0e7ef; }
.cartazista-print-toolbar span { font-weight: 800; }
.cartazista-print-toolbar small { color: #758394; }
.cartazista-print-grid { display: grid; grid-template-columns: repeat(var(--print-columns), minmax(0,1fr)); gap: 14px; padding: 20px 0; align-items: start; }
.cartazista-print-card { min-width: 0; aspect-ratio: 1 / 1.414; border: 1px dashed #ced8e3; background: #fafcff; overflow: hidden; }
.cartazista-print-card :deep(.art-preview) { width: 100%; height: 100%; }
@media print {
  .cartazista-print-toolbar { display: none; }
  .cartazista-print-preview { padding: 0; }
  .cartazista-print-grid { gap: 0; }
  .cartazista-print-card { border: 0; break-inside: avoid; }
}
</style>
