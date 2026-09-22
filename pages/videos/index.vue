<script setup lang="ts">
import {defaultTransform,elementTransform,setElementTransform,elementNames,type VideoElementTransform} from '~/shared/video-studio/layout-editing'
import {VIDEO_BACKGROUNDS} from '~/shared/video-studio/backgrounds'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Clapperboard, Copy, Download, Headphones, ImagePlus, LoaderCircle, Monitor, Music2, Play, Plus, Save, Smartphone, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-vue-next'
import { VIDEO_THEMES, VIDEO_EFFECTS, VIDEO_FORMATS, newVideoDocument, suggestVideoScripts, videoSpeechSource, videoAudioIdentity, buildVideoTimeline, validateVideoForGeneration, type VideoDocument, type VideoFormat, type VideoRenderProps } from '~/shared/video-studio/model'
import {newVideoFromTemplate,applyVideoTemplate} from '~/shared/video-studio/templates'
import {resolveVideoLabel} from '~/shared/video-studio/labels'
import {flyerRecipe} from '~/shared/video-studio/flyer-recipes'
import {BUILTIN_MUSIC,isBuiltinMusic} from '~/shared/video-studio/effect-catalog'
definePageMeta({layout:false,middleware:'auth',ssr:false})
useHead({title:'Vídeos de ofertas | JobVarejo'})
const route=useRoute()
const view=ref<'library'|'editor'>('library'),step=ref(0),steps=['Modelo','Produtos','Locução e som','Revisar e gerar']
const doc=ref<VideoDocument>(newVideoDocument()),projectId=ref(''),revision=ref(0),scriptSource=ref(''),baseline=ref('')
const modelSearch=ref(''),modelLimit=ref(12)
const filteredModels=computed(()=>VIDEO_THEMES.filter(t=>t.name.toLocaleLowerCase('pt-BR').includes(modelSearch.value.toLocaleLowerCase('pt-BR'))))
const visibleModels=computed(()=>filteredModels.value.slice(0,modelLimit.value))
watch(modelSearch,()=>modelLimit.value=12)
const labels=ref<any[]>([]),labelOptions=ref<any[]>([])
const editingLayout=ref(false),editScene=ref('intro'),editElement=ref('seal')
const editOffer=computed(()=>doc.value.offers.find(o=>o.id===editScene.value))
const editElements=computed(()=>editScene.value==='intro'?['seal','logo','validity']:editScene.value==='outro'?['logo','outro-social','outro-phone','outro-address']:['seal','logo','name','price','validity','condition','product-0','product-1','product-2'])
const selectedTransform=computed(()=>elementTransform(doc.value,previewFormat.value,editScene.value,editElement.value))
const editFrame=computed(()=>{if(!editingLayout.value)return undefined;const scene=composition.value.scenes.find(s=>s.id===editScene.value);return (scene?.from||0)+(editScene.value==='intro'&&previewFormat.value==='horizontal'&&editElement.value==='seal'?18:40)})
function updateTransform(id:string,value:VideoElementTransform){setElementTransform(doc.value,previewFormat.value,editScene.value,id,{...value,x:Math.max(-4000,Math.min(4000,value.x)),y:Math.max(-4000,Math.min(4000,value.y))})}
function changeTransform(key:keyof VideoElementTransform,event:Event){const value=Number((event.target as HTMLInputElement).value);if(Number.isFinite(value))updateTransform(editElement.value,{...selectedTransform.value,[key]:value})}
function resetScene(){if(doc.value.layoutEdits?.[previewFormat.value])delete doc.value.layoutEdits[previewFormat.value]![editScene.value]}
watch(editScene,()=>editElement.value=editScene.value==='outro'?'logo':editScene.value==='intro'?'seal':'product-0')

const projects=ref<any[]>([]),jobs=ref<any[]>([]),assets=ref<any[]>([]),voices=ref<any[]>([]),sources=ref<any[]>([])
const workerReady=ref(false),musicgpt=ref(false),loading=ref(true),busy=ref(''),saving=ref(false),notice=ref(''),error=ref(''),savedAt=ref('')
const previewFormat=ref<VideoFormat>('vertical'),advanced=ref(false),pronunciationOpen=ref(false),normalized=ref<any[]>([]),previewError=ref('')
const showListImport=ref(false)
const showImport=ref(false),sourceId=ref(''),sourceOffers=ref<any[]>([]),selectedOffers=ref<number[]>([]),musicPrompt=ref('Trilha instrumental animada para ofertas de supermercado, sem voz')
let poll:ReturnType<typeof setInterval>|undefined,autosave:ReturnType<typeof setTimeout>|undefined
const serialize=()=>JSON.stringify({document:doc.value,scriptSource:scriptSource.value})
const dirty=computed(()=>serialize()!==baseline.value)
const theme=computed(()=>VIDEO_THEMES.find(t=>t.id===doc.value.theme)!)
const voiceJob=computed(()=>jobs.value.find(j=>j.kind==='voice'&&j.status==='ready'&&j.result?.audioIdentity===videoAudioIdentity(doc.value)))
const renderJob=computed(()=>jobs.value.find(j=>j.kind==='render'&&j.status==='ready'&&!dirty.value&&j.revision===revision.value))
const activeJobs=computed(()=>jobs.value.filter(j=>['queued','running'].includes(j.status)))
const scriptChanged=computed(()=>doc.value.voice.enabled&&scriptSource.value!==videoSpeechSource(doc.value))
const issues=computed(()=>validateVideoForGeneration(doc.value))
const mediaUrl=(id:string)=>`/api/videos/assets/${id}`
const readyProjectCoverIds=ref(new Set<string>())
function markProjectCoverReady(id:string){
 const current=readyProjectCoverIds.value
 if(current.has(id))return
 const next=new Set(current)
 next.add(id)
 readyProjectCoverIds.value=next
}
const musicItems=computed(()=>assets.value.filter(a=>a.kind==='music'))
const composition=computed<VideoRenderProps>(()=>{
 const d=doc.value,voice=voiceJob.value?.result,clips=voice?.clips||{}
 let scenes
 try{scenes=buildVideoTimeline(d,voice?Object.fromEntries(Object.entries(clips).map(([id,v]:[string,any])=>[id,v.duration])):undefined)}catch{const ids=['intro',...d.offers.map(o=>o.id),'outro'],frames=Math.floor((d.duration*30-2)/ids.length);scenes=ids.map((id,i)=>({id,from:i*frames,frames}))}
 const media:Record<string,string>={};for(const id of [d.brand.logo,...d.offers.map(o=>o.image)].filter(Boolean))media[id]=mediaUrl(id)
 return {editor:editingLayout.value?{enabled:true,sceneId:editScene.value,selected:editElement.value,select:(id:string)=>editElement.value=id,change:updateTransform}:undefined,document:d,label:resolveVideoLabel(labels.value,d.theme,d.priceLabel),scenes:scenes.map(s=>({...s,...(clips[s.id]?{audio:mediaUrl(clips[s.id].assetId),speechFrames:Math.ceil(clips[s.id].duration*30)}:{})})),media,format:previewFormat.value,music:d.audio.music==='none'?undefined:isBuiltinMusic(d.audio.music)?`/video-studio/audio/${d.audio.music}.mp3`:mediaUrl(d.audio.music),impact:'/video-studio/audio/impact.mp3',whoosh:'/video-studio/audio/whoosh.mp3'}
})
const estimated=computed(()=>Math.round(composition.value.scenes.reduce((n,s)=>n+s.frames,0)/30*10)/10)
const sayError=(e:any)=>{error.value=e?.data?.statusMessage||e?.statusMessage||e?.message||'Não foi possível concluir. Tente novamente.'}
async function action(label:string,fn:()=>Promise<void>){if(busy.value)return;busy.value=label;error.value='';notice.value='';try{await fn()}catch(e){sayError(e)}finally{busy.value=''}}
async function refreshLibrary(){const r=await $fetch<any>('/api/videos/projects',{query:{view:'library'}});projects.value=r.items}
async function refreshJobs(){if(!projectId.value)return;const r=await $fetch<any>('/api/videos/jobs',{query:{projectId:projectId.value}});jobs.value=r.items}
async function refreshHealth(){try{const r=await $fetch<any>('/api/videos/health');workerReady.value=r.ready;musicgpt.value=r.musicgpt}catch{workerReady.value=false}}
async function refreshAssets(){assets.value=(await $fetch<any>('/api/videos/assets')).items}
let editorDataPromise:Promise<void>|undefined
let labelOptionsPromise:Promise<void>|undefined
async function loadSelectedLabel(labelId:string){
 if(!labelId||labels.value.some(label=>label.id===labelId))return
 try{
  const r=await $fetch<any>('/api/videos/labels',{query:{id:labelId}})
  if(!r.items.length)return
  labels.value=[...labels.value.filter(label=>label.id!==labelId),...r.items]
  labelOptions.value=[...labelOptions.value.filter(label=>label.id!==labelId),...r.items]
 }catch(e){sayError(e)}
}
async function loadLabelOptions(){
 if(!labelOptionsPromise)labelOptionsPromise=$fetch<any>('/api/videos/labels').then(r=>{
  labels.value=r.items
  labelOptions.value=r.items
 }).catch(e=>{labelOptionsPromise=undefined;sayError(e)})
 await labelOptionsPromise
}
function selectPriceLabel(){
 if(doc.value.priceLabel){void loadSelectedLabel(doc.value.priceLabel);return}
 labels.value=[]
 void loadLabelOptions()
}
async function loadEditorData(labelId=''){
 const selectedLabel=loadSelectedLabel(labelId)
 if(!editorDataPromise)editorDataPromise=(async()=>{
  const results=await Promise.allSettled([
   refreshHealth(),
   refreshAssets(),
   $fetch<any>('/api/videos/voices').then(r=>voices.value=r.items),
   $fetch<any>('/api/videos/sources').then(r=>sources.value=r.items)
  ])
  for(const result of results)if(result.status==='rejected')sayError(result.reason)
 })()
 await Promise.all([editorDataPromise,selectedLabel])
}
let savePromise:Promise<void>|null=null
async function save(){if(savePromise)await savePromise;if(!dirty.value&&projectId.value)return
 const snapshot=serialize(),data=JSON.parse(snapshot);saving.value=true
 savePromise=(async()=>{const row=await $fetch<any>('/api/videos/projects',{method:'POST',body:{...(projectId.value?{id:projectId.value}:{}),revision:revision.value,...data}});projectId.value=row.id;revision.value=row.revision;baseline.value=snapshot;await navigateTo({path:'/videos',query:{project:row.id}},{replace:true});savedAt.value=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})()
 try{await savePromise}finally{saving.value=false;savePromise=null}
}
async function createVideo(){await action('Preparando seu vídeo',async()=>{doc.value=newVideoFromTemplate();if(voices.value[0])doc.value.voice.id=voices.value[0].id;projectId.value='';revision.value=0;jobs.value=[];scriptSource.value='';normalized.value=[];step.value=0;previewFormat.value='vertical';view.value='editor';void loadEditorData(doc.value.priceLabel);baseline.value='';const r=await $fetch<any>('/api/videos/brand',{method:'POST'});doc.value.brand={...r.brand,logoStyle:'sticker'};if(r.warning)notice.value=r.warning;await save();await refreshAssets()})}
async function openVideo(id:string){await action('Abrindo vídeo',async()=>{const p=await $fetch<any>(`/api/videos/projects/${id}`);doc.value=p.document;scriptSource.value=p.script_source;projectId.value=p.id;revision.value=p.revision;baseline.value=serialize();const currentRecipe=flyerRecipe(doc.value.theme);if(currentRecipe&&doc.value.templateRevision!==currentRecipe.revision)doc.value.templateRevision=currentRecipe.revision;step.value=0;view.value='editor';void loadEditorData(doc.value.priceLabel);previewFormat.value=doc.value.formats[0]!;normalized.value=[];await refreshJobs()})}
async function library(){await action('Salvando',async()=>{await save();await refreshLibrary();view.value='library'})}
async function duplicate(){await action('Duplicando',async()=>{await save();projectId.value='';revision.value=0;doc.value.title+=' — cópia';jobs.value=[];await save();notice.value='Cópia criada. Você pode trocar as ofertas.'})}
function selectTheme(id:VideoDocument['theme']){if(id!==doc.value.theme)doc.value.layoutEdits=undefined;applyVideoTemplate(doc.value,id);editScene.value='intro';editingLayout.value=false}
function toggleFormat(format:VideoFormat){const i=doc.value.formats.indexOf(format);if(i>=0&&doc.value.formats.length>1)doc.value.formats.splice(i,1);else if(i<0)doc.value.formats.push(format);if(!doc.value.formats.includes(previewFormat.value))previewFormat.value=doc.value.formats[0]!}
function addOffer(){if(doc.value.offers.length<6)doc.value.offers.push({id:crypto.randomUUID(),name:'',price:'',unit:'un',condition:'',image:''})}
function moveOffer(index:number,delta:number){const next=index+delta;if(next<0||next>=doc.value.offers.length)return;const item=doc.value.offers.splice(index,1)[0]!;doc.value.offers.splice(next,0,item);const map=new Map(doc.value.scripts.map(s=>[s.id,s]));doc.value.scripts=['intro',...doc.value.offers.map(o=>o.id),'outro'].flatMap(id=>map.has(id)?[map.get(id)!]:[])}
async function upload(event:Event,target:string){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;await action('Enviando arquivo',async()=>{const body=new FormData();body.append('file',file);body.append('kind',target==='music'?'music':'image');const asset=await $fetch<any>('/api/videos/assets',{method:'POST',body});if(target==='logo')doc.value.brand.logo=asset.id;else if(target==='music')doc.value.audio.music=asset.id;else{const offer=doc.value.offers.find(o=>o.id===target);if(offer){offer.image=asset.id;offer.imageAspectRatio=asset.aspectRatio}}await refreshAssets();await save()});input.value=''}
function suggest(){doc.value.scripts=suggestVideoScripts(doc.value);normalized.value=[];notice.value='Texto sugerido. Revise os nomes, preços e condições antes de confirmar.'}
async function normalize(){await action('Preparando a pronúncia',async()=>{const r=await $fetch<any>('/api/videos/normalize',{method:'POST',body:{scripts:doc.value.scripts,pronunciations:doc.value.voice.pronunciations}});normalized.value=r.scripts})}
function confirmScript(){scriptSource.value=videoSpeechSource(doc.value);notice.value='Roteiro conferido. Agora você pode gerar a locução.'}
async function generate(kind:'voice'|'render'|'music'){if(kind==='render'){step.value=3;editingLayout.value=false}await action(kind==='voice'?'Solicitando locução':kind==='music'?'Solicitando música':'Preparando exportação',async()=>{await save();await $fetch('/api/videos/jobs',{method:'POST',body:{projectId:projectId.value,revision:revision.value,kind,...(kind==='music'?{musicPrompt:musicPrompt.value}:{})}});await refreshJobs();notice.value=kind==='render'?'Seu vídeo entrou na fila. Você pode acompanhar abaixo.':'Solicitação enviada. A geração de áudio pode levar alguns minutos.'})}
async function chooseSource(){await action('Lendo ofertas',async()=>{const r=await $fetch<any>('/api/videos/import',{method:'POST',body:{projectId:sourceId.value}});sourceOffers.value=r.items;selectedOffers.value=[];notice.value=r.warning||''})}
async function importOffers(){await action('Importando produtos',async()=>{const r=await $fetch<any>('/api/videos/import',{method:'POST',body:{projectId:sourceId.value,indices:selectedOffers.value.slice(0,6-doc.value.offers.length)}});doc.value.offers.push(...r.offers);showImport.value=false;notice.value=r.warning||'Produtos importados. Confira preços e unidades.';await refreshAssets();await save()})}
async function receiveList(offers:VideoDocument['offers']){doc.value.offers.push(...offers.slice(0,6-doc.value.offers.length));showListImport.value=false;notice.value=offers.some(o=>!o.image)?'Lista importada. Confira preços e complete as fotos pendentes.':'Lista e fotos importadas. Confira preços, unidades e condições.';await refreshAssets();await action('Salvando lista',save)}
async function refreshBrand(){await action('Atualizando dados da loja',async()=>{const r=await $fetch<any>('/api/videos/brand',{method:'POST'});doc.value.brand={...r.brand,logoStyle:doc.value.brand.logoStyle||'sticker'};notice.value=r.warning||'Dados atualizados a partir do seu cadastro.';await refreshAssets();await save()})}
function updateValidity(){const range=doc.value.validityRange;if(!range?.start||!range.end){doc.value.validity='';return}const display=(s:string)=>s.split('-').reverse().join('/');doc.value.validity=`DE ${display(range.start)} A ${display(range.end)}`}
function changeDate(key:'start'|'end',event:Event){doc.value.validityRange ||= {start:'',end:''};doc.value.validityRange[key]=(event.target as HTMLInputElement).value;updateValidity()}
async function next(){if(step.value===0&&!doc.value.brand.name.trim()){error.value='Informe o nome da empresa para continuar.';return}if(step.value===1&&!doc.value.offers.length){error.value='Adicione pelo menos um produto.';return}if(step.value===1&&!doc.value.scripts.length)suggest();step.value=Math.min(3,step.value+1);error.value='';await action('Salvando',save)}
watch([doc,scriptSource],()=>{normalized.value=[];if(autosave)clearTimeout(autosave);if(view.value==='editor'&&projectId.value)autosave=setTimeout(()=>save().catch(sayError),1800)},{deep:true})
onMounted(async()=>{try{await refreshLibrary();const selected=String(route.query.project||'');if(selected)await openVideo(selected)}catch(e){sayError(e)}finally{loading.value=false}poll=setInterval(()=>{if(view.value!=='editor')return;refreshHealth();if(projectId.value)refreshJobs().catch(()=>{})},6000)})
onBeforeUnmount(()=>{if(poll)clearInterval(poll);if(autosave)clearTimeout(autosave)})
onBeforeRouteLeave(async()=>{if(view.value==='editor'&&dirty.value){try{await save()}catch(e){sayError(e);return false}}})
</script>

<template>
 <div class="vs-app">
  <header class="vs-header">
   <div class="vs-header-inner">
    <NuxtLink to="/" class="vs-brand" aria-label="JobVarejo, início"><img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="176" height="56"/></NuxtLink>
    <nav class="vs-header-context" aria-label="Navegação de vídeos"><NuxtLink to="/" class="vs-solutions-link"><ArrowLeft :size="16"/><span>Todas as soluções</span></NuxtLink><span class="vs-header-divider" aria-hidden="true"></span><span class="vs-product-title"><span class="vs-product-icon"><Clapperboard :size="17"/></span> Vídeos de ofertas</span></nav>
    <div class="vs-header-actions"><span v-if="view==='editor'" class="vs-save-status" role="status">{{ saving?'Salvando…':dirty?'Alterações por salvar':`Salvo${savedAt?' às '+savedAt:''}` }}</span><button v-if="view==='editor'" class="vs-button quiet" :disabled="!!busy" @click="library"><ArrowLeft :size="16"/> Meus vídeos</button></div>
   </div>
  </header>
  <div v-if="error" class="vs-message error" role="alert"><span>{{ error }}</span><button aria-label="Fechar aviso" @click="error=''"><X :size="18"/></button></div>
  <div v-if="notice" class="vs-message" role="status"><span>{{ notice }}</span><button aria-label="Fechar aviso" @click="notice=''"><X :size="18"/></button></div>
  <VideoStudioListImport v-if="showListImport" :remaining="6-doc.offers.length" @close="showListImport=false" @import="receiveList"/><main v-if="view==='library'" class="vs-library">
   <section class="vs-hero"><div class="vs-hero-copy"><span class="vs-eyebrow"><Clapperboard :size="14"/> Estúdio de vídeos</span><h1>Sua oferta<br><span>em movimento.</span></h1><p>Crie vídeos para Reels, Stories e TV com as ofertas, a locução e a identidade da sua loja no mesmo fluxo.</p><div class="vs-hero-actions"><button class="vs-button primary large" :disabled="!!busy||loading" @click="createVideo"><Plus :size="20"/> Criar vídeo</button><span class="vs-hero-assurance"><Check :size="15"/> Comece por um modelo pronto</span></div><div class="vs-hero-tags"><span><Smartphone :size="15"/> Reels e Stories</span><span><Monitor :size="15"/> TV da loja</span><span><Volume2 :size="15"/> Locução e música</span></div></div><div class="vs-hero-art" aria-hidden="true"><div class="vs-hero-glow"/><div class="vs-hero-grid"/><article class="vs-art-card"><div class="vs-art-card__top"><span><Clapperboard :size="13"/> Vídeo da campanha</span><b>15s</b></div><div class="vs-art-card__copy"><span>OFERTAS DA SEMANA</span><strong>PREÇO<br>QUE CHAMA</strong></div><div class="vs-art-card__price"><small>A PARTIR DE</small><strong>R$ 9,99</strong></div><div class="vs-art-card__footer"><span><Play :size="13" fill="currentColor"/> Prévia em vídeo</span><span>9:16</span></div></article><div class="vs-hero-render-card"><span class="vs-hero-render-card__play"><Play :size="15" fill="currentColor"/></span><span><small>Pronto para publicar</small><strong>Reels • Stories • TV</strong></span><Check class="vs-hero-render-card__check" :size="17"/></div><span class="vs-floating-tag"><Sparkles :size="15"/> Sua marca, seus produtos.</span></div></section>
   <section>
    <div class="vs-section-heading"><div><h2>Meus vídeos</h2><p>Continue uma edição ou aproveite um vídeo para novas ofertas.</p></div><span>{{ projects.length }} projetos</span></div>
    <div v-if="loading" class="vs-empty"><LoaderCircle class="vs-spin"/> Carregando seus vídeos…</div>
    <div v-else-if="!projects.length" class="vs-empty"><Clapperboard :size="36"/><h3>Seu primeiro vídeo começa aqui</h3><p>Você não precisa saber editar. Vamos ajudar em cada etapa.</p><button class="vs-button secondary" @click="createVideo">Escolher um modelo <ArrowRight :size="16"/></button></div>
    <div v-else class="vs-project-grid">
     <button v-for="(p,index) in projects" :key="p.id" type="button" class="vs-project-card" :aria-label="`Abrir vídeo ${p.title}`" @click="openVideo(p.id)">
      <div class="vs-project-cover" :class="{'has-video-cover':!!p.coverAssetId,'is-vertical-cover':p.coverFormat==='vertical','is-cover-ready':readyProjectCoverIds.has(p.id)}" :style="{'--accent':VIDEO_THEMES.find(t=>t.id===p.summary.theme)?.accent,'--base':VIDEO_THEMES.find(t=>t.id===p.summary.theme)?.base}">
       <img v-if="p.coverAssetId" class="vs-project-cover-media" :src="mediaUrl(String(p.coverAssetId))" alt="" :loading="index<3?'eager':'lazy'" :fetchpriority="index<3?'high':'low'" decoding="async" @load="markProjectCoverReady(p.id)"/>
       <div class="vs-project-cover-fallback"><span>{{ p.summary.brand?.name||'Sua empresa' }}</span><img v-if="p.summary.theme==='impact'&&p.summary.campaign==='FECHA MÊS'" src="/video-studio/templates/fecha-mes-badge-v1.png" alt="" style="height:130px;max-width:85%;object-fit:contain"/><strong v-else>{{ p.summary.campaign }}</strong></div>
       <div v-if="p.coverAssetId" class="vs-project-cover-overlay" aria-hidden="true"></div>
       <span class="vs-cover-play"><Play :size="18" fill="currentColor"/><span>{{ p.coverAssetId?'Assistir':'Em edição' }}</span></span>
      </div>
      <div class="vs-project-info"><h3>{{ p.title }}</h3><span>{{ p.summary.offerCount||0 }} produtos · até {{ p.summary.duration }} s</span></div>
     </button>
    </div>
   </section>
  </main>
  <main v-else class="vs-editor">
   <div class="vs-editor-title"><div><span class="vs-eyebrow">PASSO A PASSO</span><input v-model="doc.title" aria-label="Nome do projeto" maxlength="100" class="vs-title-input"/></div><button class="vs-button quiet" :disabled="!!busy" @click="duplicate"><Copy :size="16"/> Fazer uma cópia</button></div>
   <nav class="vs-steps" aria-label="Etapas da criação"><button v-for="(label,i) in steps" :key="label" :class="{active:step===i,complete:step>i}" :aria-current="step===i?'step':undefined" @click="step=i"><span><Check v-if="step>i" :size="15"/><template v-else>{{ i+1 }}</template></span>{{ label }}</button></nav>
   <div class="vs-workspace"><section class="vs-form-panel">
    <div v-if="step===0" class="vs-step-content"><span class="vs-eyebrow">01 · ESCOLHA O ESTILO</span><h2>Qual é a sua campanha?</h2><p class="vs-lead">Escolha um modelo. Use a logo, as ofertas e a voz da sua loja. Os movimentos e efeitos já vêm combinados.</p><label class="vs-field">Buscar modelo<input v-model="modelSearch" placeholder="Ex.: quinta, relâmpago, hortifruti" /></label><div class="vs-theme-grid"><button v-for="t in visibleModels" :key="t.id" class="vs-theme" :class="{selected:doc.theme===t.id}" :style="{'--accent':t.accent,'--base':t.base}" @click="selectTheme(t.id)"><span class="vs-theme-sample"><img v-if="flyerRecipe(t.id)?.seal" :src="'/video-studio/templates/'+flyerRecipe(t.id)!.seal" class="vs-theme-badge" :alt="t.title" /><img v-else-if="t.id==='impact'" :src="doc.layoutVersion===2?'/video-studio/templates/fecha-mes-emerald-v2.png':'/video-studio/templates/fecha-mes-badge-v1.png'" alt="Fecha Mês em 3D" class="vs-theme-badge"/><template v-else>{{ t.title }}</template></span><span class="vs-theme-caption"><strong>{{ t.name }}</strong><small>{{ t.description }}</small></span><Check v-if="doc.theme===t.id" class="vs-theme-check" :size="19"/></button></div>
     <button v-if="visibleModels.length<filteredModels.length" class="vs-button secondary" @click="modelLimit+=12">Ver mais modelos ({{ filteredModels.length }})</button><label class="vs-field">Título da campanha<input v-model="doc.campaign" maxlength="65" placeholder="Ex.: Ofertas da semana"/></label>
     <div class="vs-divider"/><label v-if="!flyerRecipe(doc.theme)" class="vs-field">Montagem do vídeo<select :value="doc.layoutVersion===2?'showcase':'broadcast'" @change="doc.layoutVersion=($event.target as HTMLSelectElement).value==='showcase'?2:undefined"><option value="showcase">Vitrine • selo grande e produtos livres</option><option value="broadcast">Moldura • modelo anterior</option></select></label><label class="vs-toggle"><span><strong>Duplicar a imagem do produto</strong><small>Até duas embalagens no Reels e três na TV, quando houver espaço. O preço e a unidade não mudam.</small></span><input v-model="doc.duplicateProducts" type="checkbox"/></label><label v-if="flyerRecipe(doc.theme)" class="vs-field">Fundo do vídeo<select v-model="doc.background"><option :value="undefined">Combinado com o modelo</option><option v-for="bg in VIDEO_BACKGROUNDS" :key="bg.id" :value="bg.id">{{ bg.name }}</option></select><small>Os fundos já vêm com movimento e versões próprias para Reels e TV.</small></label><label class="vs-field">Etiqueta de preço<select v-model="doc.priceLabel" @focus="loadLabelOptions" @change="selectPriceLabel"><option value="">Automática · combina com o modelo</option><option v-for="label in labelOptions" :key="label.id" :value="label.id">{{ label.name }}</option></select><small>Uma cópia da etiqueta cadastrada, aplicada somente neste vídeo.</small></label><h3>Onde você vai usar?</h3><div class="vs-choice-row"><button v-for="(format,key) in VIDEO_FORMATS" :key="key" class="vs-choice" :class="{selected:doc.formats.includes(key)}" :aria-pressed="doc.formats.includes(key)" @click="toggleFormat(key)"><Smartphone v-if="key==='vertical'"/><Monitor v-else/><strong>{{ format.label }}</strong><small>{{ key==='vertical'?'Em pé · 9:16':'Deitado · 16:9' }}</small></button></div>
     <label class="vs-field">Duração máxima<select v-model.number="doc.duration"><option :value="15">Até 15 segundos</option><option :value="20">Até 20 segundos</option><option :value="30">Até 30 segundos</option></select></label>
     <div class="vs-divider"/><h3>A identidade da sua loja</h3><button class="vs-button quiet" :disabled="!!busy" @click="refreshBrand">Atualizar com meu cadastro</button><p class="vs-hint">Preenchida a partir do seu cadastro. As mudanças aqui valem apenas para este vídeo.</p><div class="vs-brand-fields"><label class="vs-logo-upload"><img v-if="doc.brand.logo" :src="mediaUrl(doc.brand.logo)" alt="Logo da empresa"/><ImagePlus v-else :size="28"/><span>{{ doc.brand.logo?'Trocar logo':'Enviar logo' }}</span><input type="file" accept="image/png,image/jpeg,image/webp" @change="upload($event,'logo')"/></label><label class="vs-field">Nome da empresa<input v-model="doc.brand.name" maxlength="100" placeholder="Como sua loja se chama?"/></label></div><label class="vs-field">Aparência da logo<select v-model="doc.brand.logoStyle"><option value="sticker">Contorno branco • sticker</option><option value="clean">Sem contorno</option></select></label><details class="vs-details"><summary>Endereço e contatos <ChevronDown :size="16"/></summary><label class="vs-field">Endereço<input v-model="doc.brand.address" maxlength="160"/></label><div class="vs-two"><label class="vs-field">WhatsApp<input v-model="doc.brand.whatsapp" maxlength="45"/></label><label class="vs-field">Instagram<input v-model="doc.brand.instagram" maxlength="70"/></label></div><label class="vs-field">Slogan<input v-model="doc.brand.slogan" maxlength="160"/></label><label class="vs-field">Telefone<input v-model="doc.brand.phone" maxlength="60"/></label><label class="vs-field">Facebook<input v-model="doc.brand.facebook" maxlength="100"/></label><label class="vs-field">Site<input v-model="doc.brand.website" maxlength="120"/></label><label class="vs-field">Horário de funcionamento<input v-model="doc.brand.hours" maxlength="160"/></label><label class="vs-field">Informações de pagamento<input v-model="doc.brand.paymentNotes" maxlength="180"/></label><button v-if="doc.brand.logo" class="vs-button quiet" @click="doc.brand.logo=''">Usar apenas o nome da empresa</button></details>
    </div>
    <div v-if="step===1" class="vs-step-content"><span class="vs-eyebrow">02 · ESCOLHA AS OFERTAS</span><h2>O que vamos anunciar?</h2><p class="vs-lead">Para 30 segundos, comece com 3 ou 4 produtos. Nomes curtos deixam a locução mais natural.</p><div class="vs-inline-actions"><button class="vs-button primary" :disabled="doc.offers.length>=6" @click="showListImport=true"><Upload :size="16"/> Enviar lista de produtos</button><button class="vs-button secondary" :disabled="doc.offers.length>=6" @click="addOffer"><Plus :size="16"/> Adicionar produto</button><button class="vs-button quiet" :disabled="!sources.length||doc.offers.length>=6" @click="showImport=true"><Copy :size="16"/> Trazer de um encarte</button></div>
     <div v-if="!doc.offers.length" class="vs-mini-empty">Adicione a primeira oferta para ver seu vídeo ganhar forma.</div>
     <article v-for="(offer,i) in doc.offers" :key="offer.id" class="vs-offer"><div class="vs-offer-top"><strong>Oferta {{ i+1 }}</strong><div><button :disabled="i===0" aria-label="Mover produto para cima" @click="moveOffer(i,-1)"><ChevronUp :size="17"/></button><button :disabled="i===doc.offers.length-1" aria-label="Mover produto para baixo" @click="moveOffer(i,1)"><ChevronDown :size="17"/></button><button aria-label="Retirar produto deste vídeo" @click="doc.offers.splice(i,1)"><Trash2 :size="16"/></button></div></div><div class="vs-offer-body"><label class="vs-product-upload"><img v-if="offer.image" :src="mediaUrl(offer.image)" :alt="offer.name||'Imagem do produto'"/><ImagePlus v-else :size="27"/><span>{{ offer.image?'Trocar foto':'Adicionar foto' }}</span><input type="file" accept="image/png,image/jpeg,image/webp" @change="upload($event,offer.id)"/></label><div><label class="vs-field">Produto<input v-model="offer.name" maxlength="120" placeholder="Ex.: Café Tesouro 500 g"/></label><div class="vs-two"><label class="vs-field">Preço (R$)<input v-model="offer.price" inputmode="decimal" maxlength="20" placeholder="19,90"/></label><label class="vs-field">Unidade<input v-model="offer.unit" maxlength="30" placeholder="un, kg, pacote…"/></label></div></div></div><label class="vs-field">Imagens deste produto<select v-model="offer.copies"><option :value="undefined">Automático · preencher o formato</option><option :value="1">Uma imagem</option><option :value="2">Duas imagens</option><option :value="3">Três imagens</option></select></label><details class="vs-details"><summary>Condição da oferta <ChevronDown :size="15"/></summary><label class="vs-field">Informe se houver restrição<input v-model="offer.condition" maxlength="140" placeholder="Ex.: Limite de 3 unidades por cliente"/></label></details></article>
     <div class="vs-two"><label class="vs-field">Data inicial<input type="date" :value="doc.validityRange?.start||''" @change="changeDate('start',$event)"/></label><label class="vs-field">Data final<input type="date" :value="doc.validityRange?.end||''" :min="doc.validityRange?.start" @change="changeDate('end',$event)"/></label></div><label class="vs-field">Validade das ofertas<input v-model="doc.validity" @input="doc.validityRange=undefined" maxlength="160" placeholder="Ex.: Ofertas válidas de 26 a 29/09"/><small>A validade também aparece no vídeo. Confira antes de publicar.</small></label>
    </div>
    <div v-if="step===2" class="vs-step-content"><span class="vs-eyebrow">03 · DÊ VOZ ÀS OFERTAS</span><h2>Do seu jeito. Com a sua voz.</h2><p class="vs-lead">Revise o texto, escolha o locutor e ouça antes de finalizar.</p><label class="vs-toggle"><span><strong>Usar locução</strong><small>O locutor anuncia sua loja e os produtos.</small></span><input v-model="doc.voice.enabled" type="checkbox"/></label>
     <template v-if="doc.voice.enabled"><label class="vs-field">Locutor<select v-model="doc.voice.id"><option v-if="!voices.length" value="default">Nenhum locutor disponível nesta conta</option><option v-for="v in voices" :key="v.id" :value="v.id">{{ v.name }}</option></select></label><div v-if="!voices.length" class="vs-inline-note">Ainda não há uma voz disponível para sua conta. Você pode preparar o roteiro ou criar o vídeo sem locução.</div><button class="vs-button secondary" @click="suggest"><Sparkles :size="16"/> {{ doc.scripts.length?'Sugerir texto novamente':'Sugerir texto das ofertas' }}</button><p v-if="doc.scripts.length" class="vs-hint">Uma nova sugestão substitui o texto abaixo. Edite cada trecho como preferir.</p>
      <div v-for="script in doc.scripts" :key="script.id" class="vs-script"><label class="vs-field">{{ script.id==='intro'?'Abertura':script.id==='outro'?'Encerramento':doc.offers.find(o=>o.id===script.id)?.name||'Oferta' }}<textarea v-model="script.text" rows="3" maxlength="700"/></label></div>
      <details class="vs-details"><summary>Ajustar a pronúncia de um nome <ChevronDown :size="16"/></summary><p class="vs-hint">Exemplo: nome “I9” → falar “i nove”. O nome escrito no vídeo não muda.</p><div v-for="(p,i) in doc.voice.pronunciations" :key="i" class="vs-pronunciation"><input v-model="p.from" aria-label="Nome escrito" placeholder="Como se escreve" maxlength="80"/><input v-model="p.to" aria-label="Pronúncia desejada" placeholder="Como se fala" maxlength="120"/><button aria-label="Remover pronúncia" @click="doc.voice.pronunciations.splice(i,1)"><X :size="16"/></button></div><button class="vs-button quiet" :disabled="doc.voice.pronunciations.length>=30" @click="doc.voice.pronunciations.push({from:'',to:''})"><Plus :size="15"/> Adicionar pronúncia</button></details>
      <button class="vs-button quiet" :disabled="!!busy||!doc.scripts.length" @click="normalize">Ver como o locutor vai ler</button><div v-if="normalized.length" class="vs-normalized"><p v-for="s in normalized" :key="s.id">{{ s.text }}</p></div>
      <div v-if="scriptChanged" class="vs-inline-note">Confira se o texto corresponde aos produtos, preços e validade atuais.</div><button class="vs-button secondary" :disabled="!doc.scripts.length" @click="confirmScript"><Check :size="16"/> Conferi o texto e os preços</button><div class="vs-voice-generation"><button class="vs-button primary" :disabled="!!busy||!workerReady||!musicgpt||!voices.length||scriptChanged||!!activeJobs.find(j=>j.kind==='voice')" @click="generate('voice')"><Headphones :size="18"/> {{ voiceJob?'Gerar / recuperar locução':'Gerar locução' }}</button><small>A geração pelo MusicGPT pode consumir créditos. Revise antes de solicitar.</small></div>
      <div v-if="voiceJob" class="vs-clips"><div v-for="(clip,id) in voiceJob.result.clips" :key="id"><strong>{{ String(id)==='intro'?'Abertura':String(id)==='outro'?'Encerramento':doc.offers.find(o=>o.id===String(id))?.name }}</strong><audio controls preload="none" :src="mediaUrl(clip.assetId)"/></div></div>
     </template>
     <div class="vs-divider"/><h3>Música de fundo</h3><p class="vs-hint">A música baixa automaticamente enquanto o locutor fala.</p><label class="vs-field">Escolha a trilha<select v-model="doc.audio.music"><option v-for="track in BUILTIN_MUSIC" :key="track.id" :value="track.id">{{ track.name }}</option><option v-for="a in musicItems" :key="a.id" :value="a.id">{{ a.name }}</option><option value="none">Sem música</option></select></label><audio v-if="composition.music" :key="composition.music" controls preload="none" :src="composition.music" class="vs-audio"/><label class="vs-button quiet vs-upload-inline"><Upload :size="16"/> Enviar minha música<input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac" @change="upload($event,'music')"/></label>
     <details class="vs-details"><summary>Criar uma trilha com IA <Sparkles :size="16"/></summary><label class="vs-field">Descreva o clima<textarea v-model="musicPrompt" maxlength="500" rows="2"/></label><button class="vs-button secondary" :disabled="!!busy||!workerReady||!musicgpt" @click="generate('music')">Gerar música pelo MusicGPT</button><p class="vs-hint">Pode consumir créditos. A trilha pronta ficará disponível nos resultados abaixo.</p></details>
     <label class="vs-toggle"><span><strong>Sons na abertura e transições</strong><small>Impactos na logo, no selo e nas mudanças de oferta.</small></span><input v-model="doc.audio.sounds" type="checkbox"/></label><details class="vs-details"><summary>Ajustar volumes <Volume2 :size="16"/></summary><label v-for="item in ([{key:'musicVolume',name:'Música'},{key:'voiceVolume',name:'Locutor'},{key:'effectsVolume',name:'Efeitos sonoros'}] as const)" :key="item.key" class="vs-field">{{ item.name }} · {{ Math.round(doc.audio[item.key]*100) }}%<input v-model.number="doc.audio[item.key]" type="range" min="0" max="1" step="0.05"/></label></details>
    </div>
    <div v-if="step===3" class="vs-step-content"><span class="vs-eyebrow">04 · QUASE PRONTO</span><h2>Confira. Dê o play. Gere.</h2><p class="vs-lead">Assista aos formatos escolhidos e confira os preços e a locução.</p><div class="vs-summary"><span><strong>{{ doc.offers.length }}</strong> produtos</span><span><strong>{{ doc.duration }}s</strong> no máximo</span><span><strong>{{ doc.formats.length }}</strong> formatos</span></div>
     <div v-if="issues.length" class="vs-inline-note"><strong>Antes de gerar:</strong><ul><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul></div><div v-if="doc.voice.enabled&&!voiceJob" class="vs-inline-note">Gere a locução dos produtos atuais na etapa 3 antes de exportar.</div><div v-if="!workerReady" class="vs-inline-note">A geração está temporariamente indisponível. Seu projeto pode ser salvo e editado.</div>
     <button class="vs-button primary large" :disabled="!!busy||!workerReady||issues.length>0||(doc.voice.enabled&&(!voiceJob||scriptChanged))||activeJobs.some(j=>j.kind==='render')" @click="generate('render')"><Clapperboard :size="20"/> Salvar e gerar vídeo</button><p class="vs-hint">A geração continua no servidor. Você pode voltar depois para baixar.</p>
     <div v-for="job in activeJobs.filter(j=>j.kind==='render')" :key="job.id" class="vs-render-progress" role="status"><strong>{{ job.status==='queued'?'Seu vídeo está na fila':'Renderizando seu vídeo' }} · {{ job.progress }}%</strong><progress :value="job.progress" max="100"/><p>O download aparecerá aqui quando os formatos estiverem prontos. Você pode sair e voltar.</p></div><div v-if="renderJob" class="vs-results"><h3>Seus vídeos estão prontos</h3><div v-for="out in renderJob.result.outputs" :key="out.assetId"><strong>{{ VIDEO_FORMATS[out.format as VideoFormat].label }} · {{ Number(out.duration).toFixed(1) }} s</strong><video :src="mediaUrl(out.assetId)" controls preload="metadata"/><a class="vs-button secondary" :href="mediaUrl(out.assetId)" target="_blank" rel="noopener"><Download :size="16"/> Abrir / baixar MP4</a></div></div>
    </div>
    <div class="vs-form-footer"><button v-if="step>0" class="vs-button quiet" @click="step--"><ArrowLeft :size="16"/> Voltar</button><span v-else/><button v-if="step<3" class="vs-button primary" :disabled="!!busy" @click="next">{{ step===0?'Escolher produtos':step===1?'Preparar locução':'Revisar vídeo' }} <ArrowRight :size="16"/></button><button v-else class="vs-button quiet" :disabled="!!busy||saving||!workerReady||issues.length>0||(doc.voice.enabled&&(!voiceJob||scriptChanged))||activeJobs.some(j=>j.kind==='render')" @click="generate('render')"><Save :size="16"/> Salvar e renderizar</button></div>
   </section>
   <aside class="vs-preview-panel"><div class="vs-preview-heading"><span><span class="vs-live-dot"/> SUA PRÉVIA</span><div class="vs-format-switch"><button v-for="format in doc.formats" :key="format" :class="{active:previewFormat===format}" :aria-label="VIDEO_FORMATS[format].label" @click="previewFormat=format"><Smartphone v-if="format==='vertical'" :size="17"/><Monitor v-else :size="17"/></button></div></div><div v-if="flyerRecipe(doc.theme)" class="vs-layout-tools"><button class="vs-button secondary" @click="editingLayout=!editingLayout">{{ editingLayout?'Voltar à reprodução':'Editar posições e tamanhos' }}</button><template v-if="editingLayout"><p class="vs-hint">Arraste os elementos na prévia. As mudanças valem para esta cena e este formato.</p><label class="vs-field">Cena<select v-model="editScene"><option value="intro">Abertura</option><option v-for="(offer,i) in doc.offers" :key="offer.id" :value="offer.id">{{ i+1 }} · {{ offer.name||'Produto' }}</option><option value="outro">Encerramento</option></select></label><label v-if="editOffer" class="vs-field">Quantidade de imagens<select v-model="editOffer.copies"><option :value="undefined">Automático</option><option :value="1">Uma imagem</option><option :value="2">Duas imagens</option><option :value="3">Três imagens</option></select></label><label class="vs-field">Elemento<select v-model="editElement"><option v-for="id in editElements" :key="id" :value="id">{{ elementNames[id] }}</option></select></label><div class="vs-two"><label class="vs-field">Posição horizontal<input type="number" :value="selectedTransform.x" min="-4000" max="4000" @input="changeTransform('x',$event)"/></label><label class="vs-field">Posição vertical<input type="number" :value="selectedTransform.y" min="-4000" max="4000" @input="changeTransform('y',$event)"/></label></div><label class="vs-field">Tamanho · {{ Math.round(selectedTransform.scale*100) }}%<input type="range" min="0.1" max="4" step="0.02" :value="selectedTransform.scale" @input="changeTransform('scale',$event)"/></label><label class="vs-field">Inclinação<input type="range" min="-180" max="180" step="1" :value="selectedTransform.rotation" @input="changeTransform('rotation',$event)"/></label><div class="vs-inline-actions"><button class="vs-button quiet" @click="updateTransform(editElement,{...selectedTransform,hidden:!selectedTransform.hidden})">{{ selectedTransform.hidden?'Mostrar elemento':'Ocultar elemento' }}</button><button class="vs-button quiet" @click="updateTransform(editElement,defaultTransform())">Restaurar elemento</button><button class="vs-button quiet" @click="resetScene">Restaurar montagem</button></div></template></div><div class="vs-preview-stage" :class="previewFormat"><ClientOnly><NuxtErrorBoundary @error="previewError='Não foi possível carregar a prévia. Salve e reabra o projeto.'"><LazyVideoStudioPreview :composition="composition" :editing-frame="editFrame"/><template #error><p role="alert">{{ previewError }}</p></template></NuxtErrorBoundary><template #fallback><div class="vs-mini-empty">Preparando prévia…</div></template></ClientOnly></div><p class="vs-preview-caption">{{ VIDEO_FORMATS[previewFormat].label }} · {{ voiceJob||!doc.voice.enabled?'Duração':'Tempo estimado' }}: {{ estimated }} s</p><p v-if="doc.voice.enabled&&!voiceJob" class="vs-hint center">A voz aparece na prévia depois de gerar a locução.</p>
    <VideoStudioEffectsLibrary v-if="doc.layoutVersion===2&&(doc.theme==='impact'||flyerRecipe(doc.theme))" v-model="doc"/><details class="vs-effects"><summary><Sparkles :size="17"/> Personalizar os efeitos <ChevronDown :size="16"/></summary><p class="vs-hint">O modelo já vem pronto. Ajuste só se quiser.</p><div class="vs-effect-grid"><label v-for="effect in VIDEO_EFFECTS" :key="effect.id" :title="effect.description"><input v-model="doc.effects" type="checkbox" :value="effect.id"/><span>{{ effect.name }}</span></label></div><label class="vs-field">Intensidade<select v-model.number="doc.intensity"><option :value="0.25">Suave</option><option :value="0.55">Equilibrada</option><option :value="0.85">Impactante</option></select></label><label v-if="doc.layoutVersion!==2||(doc.theme!=='impact'&&!flyerRecipe(doc.theme))" class="vs-field">Troca de cenas<select v-model="doc.transition"><option value="light">{{ doc.layoutVersion===2 ? "Zoom com luz" : "Passagem de luz" }}</option><option value="slide">{{ doc.layoutVersion===2 ? "Câmera rápida" : "Deslizamento" }}</option><option value="smoke">Fumaça</option><option value="fade">Corte suave</option></select></label></details>
    <div v-if="jobs.length" class="vs-job-list"><h3>Gerações deste projeto</h3><div v-for="j in jobs.slice(0,8)" :key="j.id" class="vs-job"><div><strong>{{ j.kind==='voice'?'Locução':j.kind==='music'?'Música':'Vídeo' }}</strong><span>{{ j.status==='queued'?'Na fila':j.status==='running'?'Gerando…':j.status==='ready'?'Concluído':'Precisa de atenção' }}</span></div><progress v-if="['queued','running'].includes(j.status)" :value="j.progress" max="100"/><p v-if="j.error" role="alert">{{ j.error }}</p><button v-if="j.kind==='music'&&j.status==='ready'" class="vs-button quiet" @click="doc.audio.music=j.result.assetId;refreshAssets()">Usar esta música</button><div v-if="j.kind==='render'&&j.status==='ready'"><a v-for="o in j.result.outputs" :key="o.assetId" :href="mediaUrl(o.assetId)" target="_blank" rel="noopener" class="vs-download">Baixar {{ VIDEO_FORMATS[o.format as VideoFormat].label }}</a><small v-if="j.revision!==revision">Gerado de uma versão anterior.</small></div></div></div>
   </aside></div>
  </main>
  <div v-if="busy" class="vs-busy" role="status"><LoaderCircle :size="17" class="vs-spin"/> {{ busy }}…</div>
  <div v-if="showImport" class="vs-modal-backdrop" @click.self="showImport=false"><section class="vs-modal" role="dialog" aria-modal="true" aria-label="Importar ofertas de um encarte"><div class="vs-section-heading"><h2>Trazer ofertas do encarte</h2><button aria-label="Fechar importação" @click="showImport=false"><X/></button></div><p>O encarte original permanece igual. Escolha até {{ 6-doc.offers.length }} produtos.</p><label class="vs-field">Encarte<select v-model="sourceId" @change="chooseSource"><option value="">Escolha um encarte</option><option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option></select></label><div class="vs-import-list"><label v-for="o in sourceOffers" :key="o.index"><input v-model="selectedOffers" type="checkbox" :value="o.index" :disabled="o.complex||(!selectedOffers.includes(o.index)&&selectedOffers.length>=6-doc.offers.length)"/><span><strong>{{ o.name }}</strong><small>R$ {{ o.price }} {{ o.unit }} {{ o.complex?'· Múltiplos preços: cadastrar manualmente':'' }}</small></span></label></div><button class="vs-button primary" :disabled="!!busy||!selectedOffers.length" @click="importOffers">Importar {{ selectedOffers.length }} produtos <ArrowRight :size="16"/></button></section></div>
 </div>
</template>

<style scoped>
.vs-render-progress{display:grid;gap:12px;padding:20px;margin-top:20px;border-radius:12px;background:#e6f3e9}.vs-render-progress progress{width:100%;accent-color:#216748}.vs-layout-tools{padding:14px 0;display:grid;gap:10px}
.vs-app{--ink:#18272b;--muted:#697a7c;--line:#dfe7e5;--green:#126557;--mint:#dceee6;min-height:100vh;background:#f4f6f3;color:var(--ink);font-family:'Barlow',system-ui,sans-serif;font-size:15px}.vs-app *{box-sizing:border-box}.vs-app button,.vs-app a,.vs-app input,.vs-app select,.vs-app textarea{outline-offset:4px}.vs-app button{cursor:pointer}.vs-app button:disabled{opacity:.45;cursor:not-allowed}.vs-app h1,.vs-app h2,.vs-app h3,.vs-app p{margin:0}.vs-app h2{font-size:29px;line-height:1.15;letter-spacing:-.7px;font-weight:700}.vs-app h3{font-size:19px;font-weight:700}.vs-header{height:86px;padding:0 5%;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid var(--line)}.vs-brand{display:flex;align-items:center;gap:12px;color:var(--ink);text-decoration:none;font-size:22px;font-weight:700;line-height:1}.vs-brand small{display:block;font-size:10px;letter-spacing:2px;margin-top:7px;font-weight:600}.vs-brand-icon{width:43px;height:43px;display:grid;place-items:center;background:var(--green);color:#fff;border-radius:13px}.vs-header-actions{display:flex;gap:22px;align-items:center}.vs-save-status{font-size:12px;color:var(--muted)}.vs-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:11px;min-height:43px;padding:11px 17px;font:600 14px 'Barlow',sans-serif;text-decoration:none;transition:background .18s,transform .18s}.vs-button:not(:disabled):hover{transform:translateY(-1px)}.vs-button.primary{background:var(--green);color:#fff;box-shadow:0 4px 10px #12655715}.vs-button.primary:hover{background:#0c5146}.vs-button.secondary{border-color:#cbd9d3;background:#f4f8f5;color:var(--green)}.vs-button.quiet{color:#4b6260;background:transparent}.vs-button.quiet:hover{background:#e7eeea}.vs-button.large{padding:15px 24px;min-height:52px;font-size:16px}.vs-library{max-width:1360px;margin:auto;padding:44px 5% 80px}.vs-hero{border-radius:26px;background:#e5eee5;display:grid;grid-template-columns:1.2fr 1fr;padding:55px;gap:40px;overflow:hidden;margin-bottom:55px;border:1px solid #d6e2d7}.vs-eyebrow{font-size:11px;letter-spacing:2px;font-weight:700;color:var(--green);display:block;margin-bottom:14px}.vs-hero h1{font-size:clamp(38px,4.4vw,64px);line-height:1.04;letter-spacing:-2px;font-weight:700}.vs-hero p{font-size:17px;line-height:1.6;color:#526963;max-width:440px;margin:22px 0}.vs-hero-tags{display:flex;flex-wrap:wrap;gap:18px;margin-top:25px;font-size:12px;color:#526963}.vs-hero-tags span{display:flex;gap:5px;align-items:center}.vs-hero-art{position:relative;display:grid;place-items:center;min-height:340px}.vs-art-orbit{position:absolute;border:1px solid #b0c7b5;border-radius:50%;width:390px;height:390px}.vs-art-orbit.two{width:300px;height:300px}.vs-art-card{transform:rotate(7deg);width:240px;height:320px;background:radial-gradient(ellipse at 60% 25%,#7f3334,#230d19 70%);box-shadow:10px 20px 40px #22352230;border:5px solid #fff;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffdd75;gap:22px}.vs-art-card>span:first-child{font-size:12px;letter-spacing:3px}.vs-art-card strong{font-family:'Barlow Condensed',sans-serif;font-size:68px;line-height:.88;text-align:center;font-weight:800;text-shadow:0 4px #a46636}.vs-art-pill{font-size:10px;display:flex;gap:6px;align-items:center;border:1px solid #af785f;padding:9px 12px;border-radius:24px}.vs-floating-tag{position:absolute;bottom:12px;left:15px;background:white;padding:13px 21px;border-radius:10px;box-shadow:0 8px 20px #1c392b14;font-weight:600;transform:rotate(-4deg)}.vs-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.vs-section-heading p{color:var(--muted);margin-top:8px}.vs-section-heading>span{color:var(--muted);font-size:13px}.vs-empty{border:1px dashed #c6d5cb;border-radius:20px;padding:50px 24px;display:flex;align-items:center;flex-direction:column;gap:14px;background:#ffffff77;text-align:center;color:var(--muted)}.vs-project-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.vs-project-card{text-align:left;background:white;border:1px solid var(--line);border-radius:17px;overflow:hidden}.vs-project-card:hover{box-shadow:0 10px 26px #243a3014}.vs-project-cover{aspect-ratio:1.6;background:radial-gradient(ellipse at 40% 10%,#ffffff22,transparent),var(--base);color:var(--accent);padding:24px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;position:relative}.vs-project-cover>span{font-size:12px;color:#ffffffbb}.vs-project-cover strong{font:800 32px/.95 'Barlow Condensed',sans-serif;max-width:75%}.vs-cover-play{position:absolute;right:20px;bottom:20px;padding:10px;background:#ffffff1a;border-radius:50%}.vs-project-info{padding:20px}.vs-project-info span{display:block;color:var(--muted);font-size:13px;margin-top:6px}.vs-message{max-width:1240px;margin:15px auto 0;padding:14px 22px;border:1px solid #b7d9c8;background:#e9f6ec;border-radius:12px;display:flex;justify-content:space-between;gap:20px}.vs-message.error{background:#fff1eb;border-color:#e9c5b5;color:#94391e}.vs-editor{max-width:1400px;padding:32px 4% 65px;margin:auto}.vs-editor-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:25px}.vs-title-input{font-size:28px;font-weight:700;background:transparent;border:0;border-bottom:1px solid transparent;width:100%;max-width:650px;color:var(--ink);padding:0 0 4px}.vs-title-input:hover,.vs-title-input:focus{border-bottom-color:#adbbb3}.vs-steps{display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:25px;border:1px solid var(--line);border-radius:14px;background:white;padding:7px}.vs-steps button{padding:12px;display:flex;align-items:center;justify-content:center;gap:11px;color:var(--muted);border-radius:9px;font-size:14px;font-weight:600}.vs-steps button>span{border-radius:50%;border:1px solid #cfd9d2;height:26px;width:26px;display:grid;place-items:center;font-size:12px}.vs-steps button.active{background:#e8f1eb;color:var(--green)}.vs-steps button.active>span,.vs-steps button.complete>span{background:var(--green);color:white;border-color:var(--green)}.vs-workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr);gap:30px;align-items:start}.vs-form-panel{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}.vs-step-content{padding:34px}.vs-lead{color:var(--muted);font-size:15px;line-height:1.55;margin:12px 0 25px!important}.vs-theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.vs-theme{position:relative;border-radius:13px;overflow:hidden;border:2px solid #e6ebe7;text-align:left;background:#fff}.vs-theme.selected{border-color:var(--green)}.vs-theme-sample{display:flex;align-items:center;justify-content:center;height:110px;text-align:center;padding:15px;background:radial-gradient(ellipse at 60% 0%,#ffffff22,transparent),var(--base);color:var(--accent);font:800 32px/.93 'Barlow Condensed',sans-serif;text-shadow:0 2px 0 #0005}.vs-theme-badge{height:95px;width:100%;object-fit:contain}.vs-theme-caption{display:flex;flex-direction:column;gap:5px;padding:13px}.vs-theme-caption small{font-size:12px;line-height:1.4;color:var(--muted)}.vs-theme-check{position:absolute;right:10px;top:10px;background:#fff;border-radius:50%;padding:2px;color:var(--green)}.vs-field{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600;margin:17px 0;color:#344e48}.vs-field input:not([type=range]),.vs-field select,.vs-field textarea,.vs-pronunciation input{border:1px solid #d8e0dc;border-radius:9px;background:#fcfdfb;min-height:44px;padding:11px 13px;color:var(--ink);font-size:15px;font-weight:400;width:100%;font-family:inherit}.vs-field textarea{line-height:1.5;resize:vertical}.vs-field input:focus,.vs-field select:focus,.vs-field textarea:focus{border-color:var(--green);box-shadow:0 0 0 3px #12655710}.vs-field small,.vs-hint{font-size:12px;color:var(--muted);font-weight:400;line-height:1.5}.vs-hint{margin-top:9px!important}.vs-field input[type=range]{accent-color:var(--green);width:100%}.vs-divider{height:1px;background:#e7ede8;margin:28px 0}.vs-choice-row{display:flex;gap:12px;margin:15px 0}.vs-choice{flex:1;border:1px solid var(--line);padding:18px;border-radius:12px;display:flex;flex-direction:column;gap:7px;align-items:flex-start}.vs-choice.selected{border-color:var(--green);background:#eff6f1;color:var(--green)}.vs-choice small{color:var(--muted)}.vs-brand-fields{display:grid;grid-template-columns:100px 1fr;gap:20px;align-items:center;margin-top:20px}.vs-logo-upload,.vs-product-upload{position:relative;border:1px dashed #bccfc3;background:#f2f6ef;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;cursor:pointer;color:var(--green);overflow:hidden;min-height:110px}.vs-logo-upload img{max-height:65px;max-width:80px;object-fit:contain}.vs-logo-upload span,.vs-product-upload span{font-size:11px}.vs-logo-upload input,.vs-product-upload input,.vs-upload-inline input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.vs-details{margin:18px 0;border-top:1px solid var(--line);padding-top:15px}.vs-details summary,.vs-effects summary{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;list-style:none}.vs-details summary svg:last-child,.vs-effects summary svg:last-child{margin-left:auto}.vs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vs-two .vs-field{margin:8px 0}.vs-inline-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}.vs-mini-empty{padding:35px 20px;text-align:center;color:var(--muted);font-size:14px;background:#f4f7f2;border-radius:12px;margin:15px 0}.vs-offer{border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:15px}.vs-offer-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted)}.vs-offer-top>div{display:flex;gap:8px}.vs-offer-top button{padding:5px;border-radius:6px}.vs-offer-top button:hover{background:#eef2ec}.vs-offer-body{display:grid;grid-template-columns:105px 1fr;gap:18px;align-items:center}.vs-product-upload{height:130px}.vs-product-upload img{max-width:95px;max-height:93px;object-fit:contain}.vs-toggle{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f4f7f3;border-radius:12px;padding:18px;margin:18px 0}.vs-toggle span{display:flex;flex-direction:column;gap:5px}.vs-toggle small{color:var(--muted);font-size:12px}.vs-toggle input{width:20px;height:20px;accent-color:var(--green)}.vs-inline-note{background:#fff8e9;border:1px solid #eadbb6;border-radius:11px;padding:14px 17px;font-size:13px;line-height:1.5;margin:18px 0;color:#765c20}.vs-inline-note ul{margin:8px 0 0;padding-left:18px}.vs-script{margin-top:18px}.vs-script textarea{background:#fcfdfb}.vs-pronunciation{display:flex;gap:8px;margin:12px 0}.vs-pronunciation input{min-width:0;font-size:13px}.vs-normalized{background:#f0f5ee;border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.5}.vs-voice-generation{display:flex;flex-direction:column;gap:10px;align-items:flex-start;margin-top:20px}.vs-voice-generation small{font-size:11px;color:var(--muted)}.vs-clips{display:flex;flex-direction:column;gap:15px;margin:20px 0}.vs-clips strong{font-size:13px;display:block;margin-bottom:7px}.vs-clips audio,.vs-audio{width:100%;height:40px}.vs-upload-inline{position:relative}.vs-summary{display:flex;background:#eff5ef;border-radius:13px;padding:20px;gap:26px;margin:20px 0}.vs-summary span{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}.vs-summary strong{font-size:26px;color:var(--green)}.vs-form-footer{padding:21px 32px;background:#fafcf9;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px}.vs-preview-panel{position:sticky;top:25px;border:1px solid var(--line);border-radius:20px;padding:23px;background:#edf1eb}.vs-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}.vs-preview-heading>span{font-size:10px;letter-spacing:2px;font-weight:700;display:flex;align-items:center;gap:7px}.vs-live-dot{width:6px;height:6px;background:var(--green);border-radius:50%}.vs-format-switch{display:flex;gap:4px;padding:4px;background:#e0e7df;border-radius:8px}.vs-format-switch button{padding:7px;border-radius:6px;color:#657971}.vs-format-switch button.active{background:#fff;color:var(--green);box-shadow:0 2px 4px #0001}.vs-preview-stage{margin:auto;filter:drop-shadow(0 12px 18px #20342515)}.vs-preview-stage.vertical{max-width:270px}.vs-preview-stage.horizontal{width:100%;padding:50px 0}.vs-preview-caption{text-align:center;color:#65776e;font-size:12px;margin-top:16px!important}.center{text-align:center}.vs-effects{border-top:1px solid #d1dbd0;margin-top:20px;padding-top:18px}.vs-effect-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 8px;margin:17px 0}.vs-effect-grid label{display:flex;gap:7px;align-items:center;font-size:12px}.vs-effect-grid input{accent-color:var(--green)}.vs-job-list{margin-top:24px;border-top:1px solid #d1dbd0;padding-top:20px}.vs-job-list h3{font-size:14px}.vs-job{padding:14px 0;border-bottom:1px solid #d6dfd5;font-size:12px}.vs-job>div:first-child{display:flex;justify-content:space-between;gap:12px}.vs-job p{margin-top:8px;color:#9b412d;line-height:1.4}.vs-job progress{width:100%;height:6px;accent-color:var(--green);margin-top:12px}.vs-job small{display:block;color:var(--muted)}.vs-download{display:block;color:var(--green);text-decoration:underline;margin-top:8px}.vs-results{margin:25px 0;display:flex;flex-direction:column;gap:18px}.vs-results>div{display:flex;flex-direction:column;gap:12px}.vs-results video{max-height:400px;max-width:100%;background:#111;border-radius:12px}.vs-busy{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#173e33;color:#fff;padding:13px 22px;border-radius:40px;box-shadow:0 10px 30px #0002;z-index:50;font-size:14px}.vs-spin{animation:vs-spin 1s linear infinite}@keyframes vs-spin{to{transform:rotate(360deg)}}.vs-modal-backdrop{position:fixed;inset:0;background:#0b1d1880;backdrop-filter:blur(4px);z-index:60;display:grid;place-items:center;padding:20px}.vs-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:30px}.vs-import-list{margin:20px 0;max-height:320px;overflow:auto}.vs-import-list label{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:13px 0}.vs-import-list span{display:flex;flex-direction:column;gap:5px}.vs-import-list small{color:var(--muted)}.vs-import-list input{accent-color:var(--green)}
@media(min-width:1500px){.vs-preview-stage.vertical{max-width:300px}}@media(max-width:1000px){.vs-workspace{grid-template-columns:minmax(0,1.35fr) minmax(280px,1fr);gap:18px}.vs-step-content{padding:25px}.vs-preview-panel{padding:18px}.vs-hero{padding:35px}.vs-hero-art{min-height:320px}.vs-art-card{width:205px;height:290px}.vs-project-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.vs-header{height:72px;padding:0 18px}.vs-brand{font-size:19px}.vs-brand small{font-size:8px}.vs-header-actions{gap:6px}.vs-save-status{display:none}.vs-header-actions .vs-button{font-size:12px;padding:9px}.vs-library{padding:25px 18px}.vs-hero{grid-template-columns:1fr;padding:30px;gap:15px}.vs-hero h1{font-size:45px}.vs-hero-art{min-height:250px}.vs-art-card{width:170px;height:225px;border-radius:19px}.vs-art-card strong{font-size:48px}.vs-art-orbit{width:250px;height:250px}.vs-art-orbit.two{width:200px;height:200px}.vs-hero-tags{gap:12px}.vs-editor{padding:22px 14px}.vs-title-input{font-size:23px}.vs-editor-title .vs-button{font-size:0;padding:10px}.vs-steps{gap:0;padding:5px}.vs-steps button{flex-direction:column;font-size:10px;gap:6px;padding:9px 3px;line-height:1.2}.vs-workspace{display:flex;flex-direction:column}.vs-form-panel{width:100%}.vs-preview-panel{position:static;width:100%;padding:24px}.vs-preview-stage.vertical{max-width:260px}.vs-step-content{padding:23px}.vs-theme-sample{font-size:28px;height:95px}.vs-theme-badge{height:95px;width:100%;object-fit:contain}.vs-theme-caption{padding:10px}.vs-theme-caption small{font-size:11px}.vs-offer{padding:13px}.vs-offer-body{grid-template-columns:80px 1fr;gap:12px}.vs-product-upload{height:110px}.vs-product-upload img{max-width:72px;max-height:75px}.vs-product-upload span{font-size:9px}.vs-form-footer{padding:18px}.vs-project-grid{grid-template-columns:1fr 1fr;gap:12px}.vs-project-cover{padding:16px}.vs-project-cover strong{font-size:24px}.vs-project-info{padding:14px}.vs-project-info h3{font-size:16px}.vs-message{margin:12px;font-size:13px}.vs-busy{max-width:94%;width:max-content;font-size:12px}.vs-modal{padding:23px}.vs-brand-fields{grid-template-columns:80px 1fr;gap:14px}}@media(prefers-reduced-motion:reduce){.vs-button{transition:none}.vs-spin{animation:none}}
/* A moldura do estúdio segue a mesma linguagem visual do hub e da landing. */
.vs-app {
  --ink: #172f50;
  --muted: #60758f;
  --line: #dbe5f0;
  --green: #5f5aa7;
  --mint: #efeffc;
  min-height: 100dvh;
  color: var(--ink);
  background:
    radial-gradient(circle at 13% -7%, rgba(75, 139, 221, .15), transparent 29rem),
    radial-gradient(circle at 94% 24%, rgba(104, 91, 180, .12), transparent 24rem),
    #f6f8fb;
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, sans-serif;
}

.vs-header {
  height: auto;
  padding: 0;
  border-bottom-color: rgba(208, 221, 236, .9);
  background: rgba(255, 255, 255, .82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.vs-header-inner {
  display: flex;
  width: min(1180px, calc(100% - 48px));
  min-height: 82px;
  align-items: center;
  gap: 26px;
  margin: 0 auto;
}

.vs-brand {
  flex: 0 0 auto;
  color: inherit;
}

.vs-brand img {
  display: block;
  width: 176px;
  height: auto;
}

.vs-header-context {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  color: #667b96;
  font-size: 12px;
  font-weight: 700;
}

.vs-solutions-link,
.vs-product-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}

.vs-solutions-link {
  transition: color .18s ease;
}

.vs-solutions-link:hover { color: #335f9c; }

.vs-header-divider {
  width: 1px;
  height: 20px;
  background: #dce6f1;
}

.vs-product-title { color: #29466d; }

.vs-product-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: #5f5aa7;
  background: #efeffc;
  border-radius: 9px;
}

.vs-header-actions {
  min-width: 0;
  margin-left: auto;
  gap: 14px;
}

.vs-save-status { color: #60758f; }

.vs-button {
  min-height: 42px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
}

.vs-button.primary {
  background: #5f5aa7;
  box-shadow: 0 10px 22px rgba(95, 90, 167, .2);
}

.vs-button.primary:hover { background: #4d4890; }

.vs-button.secondary {
  color: #4d4890;
  border-color: #cfceed;
  background: #f7f7ff;
}

.vs-button.quiet { color: #56708f; }
.vs-button.quiet:hover { color: #315a91; background: #edf4fc; }

.vs-library,
.vs-editor {
  width: min(1180px, calc(100% - 48px));
  max-width: none;
  margin: 0 auto;
}

.vs-library { padding: 58px 0 80px; }
.vs-editor { padding: 34px 0 68px; }

.vs-hero {
  position: relative;
  min-height: 396px;
  margin-bottom: 55px;
  padding: clamp(34px, 5.2vw, 62px);
  border: 1px solid #dae6f5;
  border-radius: 26px;
  background:
    radial-gradient(circle at 90% 50%, rgba(123, 112, 203, .15), transparent 23rem),
    linear-gradient(120deg, #fff 6%, #f1f5ff 100%);
  box-shadow: 0 22px 55px rgba(30, 66, 108, .08);
}

.vs-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5f5aa7;
  font-family: inherit;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
}

.vs-hero h1 {
  color: #17375f;
  font-size: clamp(39px, 4.7vw, 66px);
  font-weight: 700;
  letter-spacing: -.07em;
  line-height: .98;
}

.vs-hero p {
  max-width: 500px;
  color: var(--muted);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.8;
}

.vs-hero-tags {
  gap: 9px;
  margin-top: 24px;
  color: #5e7190;
  font-family: inherit;
}

.vs-hero-tags span {
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #dde6f4;
  border-radius: 999px;
  background: rgba(255, 255, 255, .78);
}

.vs-hero-tags svg { color: #5f5aa7; }

.vs-hero-art::before {
  position: absolute;
  inset: 13% 8% 10% 12%;
  border: 1px dashed rgba(95, 90, 167, .22);
  border-radius: 30px;
  content: '';
  transform: rotate(-7deg);
}

.vs-art-orbit { border-color: rgba(95, 90, 167, .28); }
.vs-art-orbit.two { border-color: rgba(46, 103, 181, .19); }

.vs-art-card {
  position: relative;
  z-index: 1;
  width: 250px;
  height: 320px;
  color: #fff;
  border-color: #fff;
  border-radius: 24px;
  background:
    radial-gradient(circle at 68% 20%, rgba(151, 146, 231, .65), transparent 30%),
    linear-gradient(145deg, #2d2a60 0%, #5f5aa7 100%);
  box-shadow: 15px 23px 43px rgba(44, 48, 105, .25);
}

.vs-art-card > span:first-child { color: #d9d8ff; }

.vs-art-card strong {
  color: #fff;
  font-family: "Barlow Condensed", "Plus Jakarta Sans", sans-serif;
  font-size: 61px;
  text-shadow: 0 4px 0 rgba(24, 22, 68, .24);
}

.vs-art-pill {
  color: #f4f4ff;
  border-color: rgba(255, 255, 255, .28);
  background: rgba(255, 255, 255, .11);
}

.vs-floating-tag {
  z-index: 2;
  color: #374b78;
  border: 1px solid #e1e8f4;
  box-shadow: 0 12px 26px rgba(30, 66, 108, .1);
}

.vs-section-heading h2,
.vs-editor-title h2 { color: #1b3759; }
.vs-section-heading p,
.vs-section-heading > span { color: var(--muted); }

.vs-empty {
  color: var(--muted);
  border-color: #cbdced;
  background: rgba(255, 255, 255, .72);
}

.vs-project-card {
  border-color: #dce6f2;
  border-radius: 18px;
  box-shadow: 0 10px 26px rgba(30, 66, 108, .05);
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.vs-project-card:hover {
  border-color: #b9c9ed;
  box-shadow: 0 20px 40px rgba(30, 66, 108, .12);
  transform: translateY(-3px);
}

.vs-project-info h3 { color: #1b3759; }

.vs-message {
  width: min(1180px, calc(100% - 48px));
  max-width: none;
  margin: 16px auto 0;
  color: #28577b;
  border-color: #c6dcec;
  background: #edf6ff;
  font-family: inherit;
}

.vs-message.error { color: #9a3e44; border-color: #f0c9cc; background: #fff2f2; }

.vs-title-input {
  color: #1b3759;
  font-family: inherit;
  letter-spacing: -.05em;
}

.vs-steps,
.vs-form-panel {
  border-color: #dce6f2;
  box-shadow: 0 10px 28px rgba(30, 66, 108, .045);
}

.vs-steps { background: rgba(255, 255, 255, .82); }
.vs-steps button { font-family: inherit; }
.vs-steps button.active { color: #fff; background: #5f5aa7; box-shadow: 0 8px 18px rgba(95, 90, 167, .21); }
.vs-steps button.complete { color: #4d4890; }

.vs-preview-panel {
  border-color: #d9e4f4;
  background: linear-gradient(145deg, #f8faff, #eef3ff);
}

.vs-preview-heading > span { color: #4d4890; }
.vs-live-dot { background: #5f5aa7; }
.vs-format-switch { background: #e2e9f7; }
.vs-format-switch button.active { color: #4d4890; }
.vs-summary { background: #f0effc; }
.vs-summary strong { color: #4d4890; }
.vs-busy { background: #243f72; }

.vs-step-content h2,
.vs-step-content h3,
.vs-offer-top strong { color: #1b3759; }

.vs-lead,
.vs-hint,
.vs-field small,
.vs-preview-caption { color: #60758f; }

.vs-field { color: #385675; }

.vs-field input:not([type=range]),
.vs-field select,
.vs-field textarea,
.vs-pronunciation input {
  color: #203c60;
  border-color: #d5e1ef;
  background: #fbfdff;
}

.vs-field input:focus,
.vs-field select:focus,
.vs-field textarea:focus {
  border-color: #8b87ce;
  box-shadow: 0 0 0 3px rgba(95, 90, 167, .12);
}

.vs-divider,
.vs-details,
.vs-effects,
.vs-job-list { border-color: #e0e8f2; }
.vs-divider { background: #e4ebf4; }

.vs-theme { border-color: #dbe5f1; }
.vs-theme.selected { border-color: #5f5aa7; box-shadow: 0 8px 20px rgba(95, 90, 167, .12); }
.vs-theme-caption small { color: #60758f; }
.vs-theme-check { color: #5f5aa7; }

.vs-choice { border-color: #d8e3f0; }
.vs-choice.selected { color: #4d4890; border-color: #8a86cf; background: #f1f0fc; }

.vs-logo-upload,
.vs-product-upload {
  color: #5f5aa7;
  border-color: #c7d7e9;
  background: #f5f8fd;
}

.vs-mini-empty,
.vs-toggle,
.vs-normalized { background: #f4f7fc; }

.vs-offer { border-color: #dce6f1; }
.vs-offer-top { color: #60758f; }
.vs-offer-top button:hover { background: #edf3fb; }
.vs-toggle input,
.vs-effect-grid input,
.vs-import-list input { accent-color: #5f5aa7; }

.vs-form-footer { border-top-color: #dce6f1; background: #f9fbfe; }
.vs-preview-stage { filter: drop-shadow(0 12px 18px rgba(39, 68, 118, .14)); }
.vs-job { border-bottom-color: #dce6f1; }
.vs-download { color: #4d4890; }

@media (max-width: 800px) {
  .vs-header-inner,
  .vs-library,
  .vs-editor,
  .vs-message { width: min(100% - 32px, 1180px); }

  .vs-header-inner { min-height: 72px; gap: 12px; }
  .vs-brand img { width: 136px; }
  .vs-header-context { flex: 1; justify-content: flex-end; gap: 8px; font-size: 10px; }
  .vs-header-divider,
  .vs-solutions-link span { display: none; }
  .vs-solutions-link { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 9px; background: #edf4fc; }
  .vs-product-title { font-size: 10px; }
  .vs-product-icon { width: 27px; height: 27px; }
  .vs-header-actions { margin-left: 0; }
  .vs-header-actions .vs-button { min-height: 33px; padding: 7px 9px; font-size: 10px; }
  .vs-header-actions .vs-button svg { width: 14px; }
  .vs-save-status { display: none; }
  .vs-library { padding: 30px 0 56px; }
  .vs-editor { padding: 26px 0 54px; }
  .vs-hero { min-height: 0; margin-bottom: 36px; padding: 30px 26px; }
  .vs-hero h1 { font-size: 43px; }
  .vs-hero-art { min-height: 245px; }
  .vs-art-card { width: 178px; height: 230px; }
  .vs-art-card strong { font-size: 44px; }
  .vs-floating-tag { bottom: 4px; left: 3px; padding: 10px 14px; font-size: 11px; }
}

@media (max-width: 520px) {
  .vs-header-inner { gap: 9px; }
  .vs-header-context { flex: 0 0 auto; }
  .vs-solutions-link { display: none; }
  .vs-product-title { gap: 0; font-size: 0; }
  .vs-header-actions .vs-button { font-size: 0; }
  .vs-header-actions .vs-button svg { width: 16px; height: 16px; }
}
/* Hero de Vídeos: prévia editorial, com mais densidade visual e foco no CTA. */
.vs-hero {
  display: grid;
  grid-template-columns: minmax(0, .95fr) minmax(420px, 1.05fr);
  min-height: 454px;
  align-items: center;
  gap: clamp(30px, 6vw, 84px);
  padding: clamp(38px, 4.8vw, 64px);
  overflow: hidden;
  border-color: #d9e5f4;
  border-radius: 28px;
  background:
    radial-gradient(circle at 79% 45%, rgba(112, 103, 196, .14), transparent 24rem),
    radial-gradient(circle at 12% 100%, rgba(68, 128, 209, .08), transparent 22rem),
    linear-gradient(118deg, #fff 0%, #f8faff 47%, #f0f1ff 100%);
  box-shadow: 0 24px 58px rgba(30, 66, 108, .075);
}

.vs-hero::after {
  position: absolute;
  width: 560px;
  height: 560px;
  right: -255px;
  bottom: -400px;
  border: 1px solid rgba(95, 90, 167, .14);
  border-radius: 50%;
  content: '';
}

.vs-hero-copy { position: relative; z-index: 2; max-width: 520px; }

.vs-hero .vs-eyebrow {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  color: #554ea2;
  border: 1px solid #dbd9f3;
  border-radius: 999px;
  background: rgba(247, 247, 255, .9);
  font-family: inherit;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .1em;
  line-height: 1;
  text-transform: uppercase;
}

.vs-hero h1 {
  margin: 19px 0 17px;
  color: #17375f;
  font-size: clamp(47px, 4.25vw, 69px);
  font-weight: 700;
  letter-spacing: -.073em;
  line-height: .93;
}

.vs-hero h1 span { color: #5d57ab; }

.vs-hero-copy > p {
  max-width: 475px;
  margin: 0;
  color: var(--muted);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.78;
}

.vs-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 15px;
  margin-top: 27px;
}

.vs-hero .vs-button.primary {
  min-height: 54px;
  padding: 15px 22px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, .25);
  background: linear-gradient(135deg, #403990 0%, #6961c4 100%);
  box-shadow: 0 14px 24px rgba(77, 70, 161, .25);
}

.vs-hero .vs-button.primary:hover {
  background: linear-gradient(135deg, #342e7d 0%, #5b54b2 100%);
  box-shadow: 0 17px 28px rgba(77, 70, 161, .3);
}

.vs-hero-assurance {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #53708e;
  font-size: 11px;
  font-weight: 700;
}

.vs-hero-assurance svg { color: #5f5aa7; }

.vs-hero-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 25px; }
.vs-hero-tags span { padding: 7px 11px; background: rgba(255, 255, 255, .88); font-size: 11px; font-weight: 600; }

.vs-hero-art {
  position: absolute;
  z-index: 1;
  right: clamp(18px, 3.5vw, 54px);
  width: min(42vw, 485px);
  min-height: 365px;
  display: grid;
  place-items: center;
  isolation: isolate;
}

.vs-hero-art::before { content: none; }

.vs-hero-glow {
  position: absolute;
  z-index: -2;
  width: 330px;
  height: 330px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(106, 95, 195, .25), rgba(122, 159, 229, .06) 55%, transparent 72%);
  filter: blur(2px);
}

.vs-hero-grid {
  position: absolute;
  z-index: -1;
  width: min(100%, 445px);
  height: 285px;
  border: 1px solid rgba(95, 90, 167, .16);
  border-radius: 28px;
  background-image: linear-gradient(rgba(95, 90, 167, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(95, 90, 167, .07) 1px, transparent 1px);
  background-size: 28px 28px;
  box-shadow: inset 0 0 0 8px rgba(255, 255, 255, .23);
  transform: rotate(-5deg);
}

.vs-art-card {
  position: relative;
  z-index: 2;
  width: 270px;
  height: 338px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  gap: 0;
  padding: 22px;
  color: #fff;
  border: 6px solid #fff;
  border-radius: 29px;
  background:
    radial-gradient(circle at 82% 15%, rgba(167, 160, 239, .68), transparent 28%),
    linear-gradient(150deg, #27235e 0%, #494492 55%, #6d65c1 100%);
  box-shadow: 19px 25px 44px rgba(44, 48, 105, .24);
  transform: rotate(5deg);
  animation: vs-hero-card-float 8s ease-in-out infinite;
}

.vs-art-card::before {
  position: absolute;
  inset: 12px;
  border: 1px solid rgba(255, 255, 255, .17);
  border-radius: 17px;
  content: '';
  pointer-events: none;
}

.vs-art-card__top,
.vs-art-card__footer,
.vs-art-card__top span,
.vs-art-card__footer span { display: flex; align-items: center; }

.vs-art-card__top,
.vs-art-card__footer {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  color: #e2e0ff;
  font-size: 9px;
  font-weight: 700;
}

.vs-art-card__top span,
.vs-art-card__footer span { gap: 5px; }
.vs-art-card__top b { padding: 5px 7px; color: #fff; border-radius: 999px; background: rgba(255, 255, 255, .14); font-size: 8px; }

.vs-art-card__copy { position: relative; z-index: 1; display: grid; gap: 10px; }
.vs-art-card__copy > span { color: #d8d5ff; font-size: 9px; font-weight: 800; letter-spacing: .14em; }

.vs-art-card__copy strong {
  color: #fff;
  font-family: "Barlow Condensed", "Plus Jakarta Sans", sans-serif;
  font-size: 57px;
  font-weight: 800;
  letter-spacing: .01em;
  line-height: .8;
  text-shadow: 0 4px 0 rgba(24, 22, 68, .24);
}

.vs-art-card__price {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 3px;
  padding: 11px 13px;
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 13px;
  background: rgba(18, 15, 62, .18);
}

.vs-art-card__price small { color: #dcd9ff; font-size: 8px; font-weight: 700; letter-spacing: .08em; }
.vs-art-card__price strong { color: #fff; font-family: "Barlow Condensed", sans-serif; font-size: 34px; font-weight: 800; line-height: .85; }
.vs-art-card__footer { color: #eeedff; font-size: 8px; }

.vs-hero-render-card {
  position: absolute;
  z-index: 3;
  left: 7%;
  bottom: 23px;
  display: flex;
  width: 224px;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  color: #314b76;
  border: 1px solid #e3e9f5;
  border-radius: 15px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 15px 30px rgba(41, 68, 114, .13);
  transform: rotate(-3deg);
  animation: vs-hero-render-float 8s ease-in-out -2s infinite;
}

.vs-hero-render-card__play {
  display: grid;
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 10px;
  background: linear-gradient(145deg, #534ca6, #746dc7);
}

.vs-hero-render-card > span:nth-child(2) { display: grid; min-width: 0; gap: 2px; }
.vs-hero-render-card small { color: #71849e; font-size: 8px; font-weight: 600; }
.vs-hero-render-card strong { color: #314b76; font-size: 9px; font-weight: 800; white-space: nowrap; }
.vs-hero-render-card__check { margin-left: auto; flex: 0 0 auto; color: #4c9b76; }

.vs-floating-tag {
  position: absolute;
  z-index: 3;
  top: 23px;
  right: 1%;
  left: auto;
  bottom: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 11px;
  color: #3e5b86;
  border: 1px solid rgba(213, 225, 242, .95);
  border-radius: 11px;
  background: rgba(255, 255, 255, .83);
  box-shadow: 0 12px 26px rgba(30, 66, 108, .1);
  font-size: 9px;
  font-weight: 800;
  transform: rotate(2deg);
}

.vs-floating-tag svg { color: #5f5aa7; }

@keyframes vs-hero-card-float { 50% { transform: translateY(-8px) rotate(4deg); } }
@keyframes vs-hero-render-float { 50% { transform: translateY(6px) rotate(-2deg); } }

@media (max-width: 980px) {
  .vs-hero { grid-template-columns: 1fr; min-height: 0; gap: 28px; }
  .vs-hero-copy { max-width: none; }
  .vs-hero-art { position: relative; right: auto; width: 100%; min-height: 360px; }
}

@media (max-width: 800px) {
  .vs-hero { padding: 30px 25px; }
  .vs-hero h1 { font-size: clamp(43px, 12vw, 57px); }
  .vs-hero-actions { gap: 12px; margin-top: 23px; }
  .vs-hero-assurance { font-size: 10px; }
  .vs-hero-art { min-height: 300px; }
  .vs-hero-grid { width: min(100%, 365px); height: 235px; background-size: 22px 22px; }
  .vs-art-card { width: 207px; height: 270px; padding: 17px; border-width: 5px; border-radius: 24px; }
  .vs-art-card__copy strong { font-size: 45px; }
  .vs-art-card__price { padding: 8px 10px; }
  .vs-art-card__price strong { font-size: 28px; }
  .vs-hero-render-card { left: 4%; bottom: 12px; width: 205px; padding: 9px 10px; }
  .vs-floating-tag { top: 9px; right: 0; font-size: 8px; }
}

@media (max-width: 520px) {
  .vs-hero { padding: 27px 21px; }
  .vs-hero h1 { font-size: 45px; }
  .vs-hero .vs-button.primary { width: 100%; }
  .vs-hero-assurance { width: 100%; }
  .vs-hero-art { min-height: 282px; }
  .vs-art-card { width: 188px; height: 248px; padding: 15px; }
  .vs-art-card__copy strong { font-size: 40px; }
  .vs-art-card__top, .vs-art-card__footer { font-size: 7px; }
  .vs-art-card__price strong { font-size: 25px; }
  .vs-hero-render-card { width: 182px; }
  .vs-hero-render-card strong { font-size: 8px; }
  .vs-floating-tag { right: -8px; }
}

@media (prefers-reduced-motion: reduce) {
  .vs-art-card,
  .vs-hero-render-card { animation: none; }
}

/* Capas reais: o card mostra o quadro inicial do render e só usa a arte do modelo como fallback. */
.vs-project-card {
  position: relative;
  overflow: hidden;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}

.vs-project-card:hover {
  transform: translateY(-3px);
  border-color: #cbd9ec;
  box-shadow: 0 16px 34px rgba(39, 68, 118, .14);
}

.vs-project-card:focus-visible {
  outline: 3px solid rgba(95, 90, 167, .42);
  outline-offset: 3px;
}

.vs-project-cover {
  isolation: isolate;
  overflow: hidden;
}

.vs-project-cover-media {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  background: var(--base);
  object-fit: cover;
  object-position: center;
  transition: opacity .28s ease;
}

.vs-project-cover.is-vertical-cover .vs-project-cover-media { object-fit: contain; }
.vs-project-cover.is-cover-ready .vs-project-cover-media { opacity: 1; }

.vs-project-cover-fallback {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px;
  color: var(--accent);
  transition: opacity .24s ease, transform .3s ease;
}

.vs-project-cover-fallback > span { color: #ffffffbb; font-size: 12px; }
.vs-project-cover-fallback > strong { max-width: 75%; font: 800 32px/.95 "Barlow Condensed", sans-serif; }
.vs-project-cover.is-cover-ready .vs-project-cover-fallback { opacity: 0; transform: scale(1.03); }

.vs-project-cover-overlay {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(180deg, rgba(6, 17, 40, .04) 25%, rgba(6, 17, 40, .62) 100%);
  transition: opacity .28s ease;
}

.vs-project-cover.is-cover-ready .vs-project-cover-overlay { opacity: 1; }

.vs-cover-play {
  position: absolute;
  z-index: 3;
  right: 17px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, .38);
  border-radius: 999px;
  background: rgba(19, 29, 55, .42);
  box-shadow: 0 8px 18px rgba(11, 22, 45, .15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 10px;
  font-weight: 800;
  transition: transform .2s ease, background .2s ease;
}

.vs-project-card:hover .vs-cover-play { transform: translateY(-2px); background: rgba(74, 67, 157, .78); }

@media (max-width: 760px) {
  .vs-project-cover-fallback { padding: 16px; }
  .vs-project-cover-fallback > strong { font-size: 24px; }
  .vs-cover-play { right: 12px; bottom: 12px; padding: 7px 9px; }
}

@media (prefers-reduced-motion: reduce) {
  .vs-project-card,
  .vs-project-cover-media,
  .vs-project-cover-fallback,
  .vs-project-cover-overlay,
  .vs-cover-play { transition: none; }
}
</style>
