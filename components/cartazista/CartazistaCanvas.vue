<script setup lang="ts">
import ArtCanvas from '~/components/art-studio/ArtCanvas.client.vue'
import type { ArtComposition } from '~/types/art-studio'
import { fitCartazistaComposition } from '~/utils/cartazista/render'
const props=defineProps<{composition:ArtComposition;selectedId:string|null}>()
const emit=defineEmits<{change:[ArtComposition];select:[string|null];error:[string]}>()
const fitted=shallowRef<ArtComposition>()
const inner=ref<{exportPng:()=>Promise<string>;refreshImages:()=>Promise<void>}>()
let generation=0
async function fit(){const current=++generation;try{const value=await fitCartazistaComposition(props.composition);if(current===generation)fitted.value=value}catch{emit('error','Não foi possível carregar as fontes do cartaz.')}}
onMounted(fit)
watch(()=>props.composition,fit,{deep:true})
onBeforeUnmount(()=>generation++)
defineExpose({exportPng:async()=>{if(!inner.value)throw new Error('Aguarde o cartaz carregar.');return inner.value.exportPng()},refreshImages:async()=>inner.value?.refreshImages()})
</script>
<template><ArtCanvas v-if="fitted" ref="inner" :composition="fitted" :selected-id="selectedId" @change="emit('change',$event)" @select="emit('select',$event)" @error="emit('error',$event)" /></template>
