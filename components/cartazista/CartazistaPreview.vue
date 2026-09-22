<script setup lang="ts">
import type { ArtComposition } from '~/types/art-studio'
import { renderCartazistaSvg } from '~/utils/cartazista/render'
const props=defineProps<{composition:ArtComposition;label?:string}>()
const svg=ref(''),error=ref('')
let generation=0
async function render(){
  const current=++generation
  try { const result=await renderCartazistaSvg(props.composition);if(current===generation){svg.value=result;error.value=''} }
  catch {if(current===generation)error.value='Não foi possível carregar a prévia.'}
}
onMounted(render)
watch(()=>props.composition,render,{deep:true})
onBeforeUnmount(()=>generation++)
</script>
<template>
  <div class="art-preview cartazista-preview" role="img" :aria-label="label || 'Prévia do cartaz'">
    <span v-if="error" role="alert">{{ error }}</span>
    <div v-else-if="svg" class="cartazista-vector" v-html="svg" />
    <span v-else class="cartazista-preview-loading">Preparando cartaz…</span>
  </div>
</template>
<style scoped>
.cartazista-preview{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:white;overflow:hidden}
.cartazista-vector{width:100%;height:100%}.cartazista-vector :deep(svg){display:block;width:100%;height:100%}
.cartazista-preview-loading{font:12px sans-serif;color:#767676}
</style>
