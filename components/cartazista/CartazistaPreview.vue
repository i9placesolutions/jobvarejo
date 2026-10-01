<script setup lang="ts">
import type { ArtComposition } from '~/types/art-studio'
import { renderCartazistaSvg } from '~/utils/cartazista/render'
import { getCartazistaPreviewSvg } from '~/utils/cartazista/preview'
const props=defineProps<{composition:ArtComposition;label?:string;lazy?:boolean}>()
const host=ref<HTMLElement|null>(null)
const svg=ref(''),error=ref('')
let generation=0
let visible=false
let observer:IntersectionObserver|null=null
async function render(){
  if(props.lazy&&!visible)return
  const current=++generation
  const composition=JSON.parse(JSON.stringify(props.composition)) as ArtComposition
  try { const result=await getCartazistaPreviewSvg(composition,renderCartazistaSvg);if(current===generation){svg.value=result;error.value=''} }
  catch {if(current===generation)error.value='Não foi possível carregar a prévia.'}
}
onMounted(()=>{
  if(!props.lazy||typeof IntersectionObserver==='undefined'){
    visible=true
    void render()
    return
  }
  if(!host.value)return
  observer=new IntersectionObserver((entries)=>{
    const intersects=entries.some(entry=>entry.isIntersecting)
    if(intersects){
      visible=true
      void render()
    }else{
      if(visible)generation++
      visible=false
    }
  },{rootMargin:'180px'})
  observer.observe(host.value)
})
watch(()=>props.composition,()=>{
  generation++
  svg.value=''
  error.value=''
  void render()
},{deep:true})
onBeforeUnmount(()=>{generation++;observer?.disconnect()})
</script>
<template>
  <div ref="host" class="art-preview cartazista-preview" role="img" :aria-label="label || 'Prévia do cartaz'">
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
