<script setup lang="ts">
import { computed } from 'vue'
import type { GlobalStyles, ProductPalette } from '~/types/product-zone'
import { getProductPalette } from '~/utils/productPalette'
import { resolveProductCardColor } from '~/utils/productCardColors'
import { resolveProductNameColor } from '~/utils/productNameColors'
const props = defineProps<{ styles: Partial<GlobalStyles>; authoring?: boolean; busy?: boolean }>()
const emit = defineEmits<{ change: [value: Partial<ProductPalette>]; reset: [] }>()
const entries: Array<{key: keyof ProductPalette; label: string}> = [
  {key:'cardColor',label:'Fundo dos cards'}, {key:'prodNameColor',label:'Nome nos cards'},
  {key:'highlightCardColor',label:'Fundo dos destaques'}, {key:'highlightProdNameColor',label:'Nome nos destaques'}
]
const colors = computed(() => {
  const base = resolveProductCardColor(props.styles, false), highlight = resolveProductCardColor(props.styles, true)
  return {cardColor:base,highlightCardColor:highlight,prodNameColor:resolveProductNameColor(base,{},props.styles),highlightProdNameColor:resolveProductNameColor(highlight,{},props.styles,true)}
})
const change = (key: keyof ProductPalette, value: string) => emit('change', {
  ...(props.authoring ? getProductPalette(props.styles) : props.styles.productPalette), [key]:value
})
</script>
<template>
  <section class="mb-4 rounded-xl border border-white/15 bg-white/[0.03] p-4 text-white">
    <h3 class="text-sm font-semibold">{{ authoring ? 'Paleta inicial do modelo' : 'Paleta dos produtos' }}</h3>
    <p class="mt-1 text-xs text-zinc-400">{{ authoring ? 'Cores iniciais. O cliente poderá alterá-las no encarte.' : 'Personalize esta zona. Escolhas individuais dos produtos são preservadas.' }}</p>
    <div class="mt-3 grid grid-cols-2 gap-3">
      <label v-for="entry in entries" :key="entry.key" class="flex items-center gap-2 text-xs">
        <input type="color" :aria-label="entry.label" :value="/^#[\da-f]{6}$/i.test(colors[entry.key]) ? colors[entry.key] : '#ffffff'" :disabled="busy" class="h-8 w-9 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent" @change="change(entry.key, ($event.target as HTMLInputElement).value)" />
        {{ entry.label }}
      </label>
    </div>
    <div class="mt-3 flex gap-2 text-xs font-bold" aria-label="Amostra da paleta">
      <span class="flex-1 rounded p-3 text-center" :style="{background:colors.cardColor,color:colors.prodNameColor}">Produto</span>
      <span class="flex-1 rounded p-3 text-center" :style="{background:colors.highlightCardColor,color:colors.highlightProdNameColor}">Destaque</span>
    </div>
    <button v-if="!authoring && styles.templateProductPalette" type="button" :disabled="busy" class="mt-3 text-xs text-violet-300 underline" @click="emit('reset')">Restaurar paleta do modelo</button>
  </section>
</template>
