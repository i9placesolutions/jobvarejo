<script setup lang="ts">
import { createElement,createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { AnyZodObject } from 'zod'
import { Player,type PlayerRef } from '@remotion/player'
import { VideoComposition } from '~/shared/video-studio/composition'
import { VIDEO_FORMATS, type VideoRenderProps } from '~/shared/video-studio/model'
import { createPreviewImageCache } from '~/shared/video-studio/preview-media'
const props=defineProps<{ composition:VideoRenderProps;editingFrame?:number;previewRequest?:{frame:number;nonce:number} }>()
const host=ref<HTMLElement|null>(null),preparing=ref(true),loadError=ref('')
const cache=createPreviewImageCache()
const player=createRef<PlayerRef>()
const seekEdit=()=>{if(props.editingFrame!==undefined){player.current?.pause();player.current?.seekTo(props.editingFrame)}}
let lastPreviewNonce=-1
const seekRequested=()=>{const request=props.previewRequest;if(request&&player.current&&request.nonce!==lastPreviewNonce){player.current.pause();player.current.seekTo(request.frame);lastPreviewNonce=request.nonce}}
let root:Root|undefined,generation=0,disposed=false,loadedKey='',media:Record<string,string>={}
const render=()=>{
 if(!root||preparing.value||loadError.value)return
 const c={...props.composition,document:JSON.parse(JSON.stringify(props.composition.document)),media},size=VIDEO_FORMATS[c.format],duration=c.scenes.reduce((n,s)=>Math.max(n,s.from+s.frames),1)
 root.render(createElement(Player<AnyZodObject, VideoRenderProps>,{ref:player,component:VideoComposition,inputProps:c,durationInFrames:duration,fps:30,compositionWidth:size.width,compositionHeight:size.height,controls:!c.editor?.enabled,numberOfSharedAudioTags:16,loop:true,autoPlay:false,initialFrame:props.editingFrame||0,style:{width:'100%',borderRadius:18}}))
 requestAnimationFrame(()=>{if(!disposed)seekRequested()})
}
async function prepare(){
 const key=JSON.stringify(props.composition.media)
 if(key===loadedKey){render();return}
 const request=++generation
 preparing.value=true;loadError.value='';root?.render(null)
 try{
  const decoded=await Promise.all(Object.entries(props.composition.media).map(async([id,src])=>[id,await cache.get(src)] as const))
  if(disposed||request!==generation)return
  media=Object.fromEntries(decoded);loadedKey=key;preparing.value=false;render()
 }catch(error){if(!disposed&&request===generation){preparing.value=false;loadError.value='Não foi possível preparar as imagens. Tente carregar novamente.'}}
}
onMounted(()=>{if(host.value){root=createRoot(host.value);prepare()}})
watch(()=>props.composition,prepare,{deep:true})
watch(()=>props.editingFrame,()=>nextTick(seekEdit))
watch(()=>props.previewRequest,()=>nextTick(seekRequested))
onBeforeUnmount(()=>{disposed=true;generation++;root?.unmount();cache.dispose()})
</script>
<template>
 <div class="video-preview-shell">
  <div v-if="preparing" class="video-preview-loading" role="status">Preparando as imagens do vídeo…</div>
  <div v-if="loadError" class="video-preview-loading" role="alert">{{ loadError }}<button type="button" @click="prepare">Carregar novamente</button></div>
  <div ref="host" v-show="!preparing&&!loadError" class="video-player-host" aria-label="Prévia animada do vídeo" />
 </div>
</template>
<style scoped>
.video-preview-loading{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;color:#345a49;font-size:13px;padding:24px}
.video-preview-loading button{padding:10px 15px;border:1px solid #9bbca7;border-radius:8px;background:#f7fcf8}
.video-player-host :deep(*){transition:none!important;animation:none!important}
</style>
