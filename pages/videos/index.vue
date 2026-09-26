<script setup lang="ts">
import {fullVoiceTimeline} from '~/shared/video-studio/full-voice'
import AdminWorkspaceShell from '~/components/AdminWorkspaceShell.vue'
import {defaultTransform,elementTransform,setElementTransform,elementNames,type VideoElementTransform} from '~/shared/video-studio/layout-editing'
import {VIDEO_BACKGROUNDS} from '~/shared/video-studio/backgrounds'
import { Store, ShoppingBasket, SlidersHorizontal, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Clapperboard, Copy, Download, Headphones, ImagePlus, LoaderCircle, Monitor, Music2, Play, Plus, Save, Smartphone, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-vue-next'
import { VIDEO_THEMES, VIDEO_EFFECTS, VIDEO_FORMATS, newVideoDocument, suggestVideoScripts, narrationScripts, videoNarrationText, videoSpeechSource, videoSpeechSourceMatches, videoAudioIdentityMatches, buildVideoTimeline, validateVideoForGeneration, type VideoDocument, type VideoFormat, type VideoRenderProps } from '~/shared/video-studio/model'
import {isVideoModel} from '~/shared/video-studio/project-kind'
import {showVideoAlcoholBadge} from '~/shared/video-studio/personalization'
import {newVideoFromTemplate,applyVideoTemplate} from '~/shared/video-studio/templates'
import {resolveVideoLabel} from '~/shared/video-studio/labels'
import {flyerRecipe} from '~/shared/video-studio/flyer-recipes'
import {videoValidityText} from '~/shared/video-studio/validity'
import {BUILTIN_MUSIC,isBuiltinMusic} from '~/shared/video-studio/effect-catalog'
definePageMeta({layout:false,middleware:'auth',ssr:false})
useHead({title:'Vídeos de ofertas | JobVarejo'})
const route=useRoute(),auth=useAuth()
const view=ref<'library'|'editor'>('library'),step=ref(0),steps=['Marca','Produtos','Personalizar','Locução','Exportar']
const stepIcons=[Store,ShoppingBasket,SlidersHorizontal,Headphones,Download]
const doc=ref<VideoDocument>(newVideoDocument()),projectId=ref(''),revision=ref(0),scriptSource=ref(''),baseline=ref('')
const modelSearch=ref(''),modelLimit=ref(12)
const libraryTab=ref<'models'|'projects'>('models'),showModelPreview=ref(false)
const personalProjects=computed(()=>projects.value.filter(p=>!isVideoModel(p)))
let accountBrand:VideoDocument['brand']|undefined
let switchingProject=false
const filteredModels=computed(()=>VIDEO_THEMES.filter(t=>t.name.toLocaleLowerCase('pt-BR').includes(modelSearch.value.toLocaleLowerCase('pt-BR'))))
const visibleModels=computed(()=>filteredModels.value.slice(0,modelLimit.value))
watch(modelSearch,()=>modelLimit.value=12)
const labels=ref<any[]>([]),labelOptions=ref<any[]>([])
const editingLayout=ref(false),editScene=ref('intro'),editElement=ref('seal')
const previewRequest=ref<{frame:number;nonce:number}>()
let previewNonce=0
watch(projectId,()=>{previewRequest.value=undefined})
function previewOffer(id:string){
 const scene=composition.value.scenes.find(scene=>scene.id===id)
 if(!scene)return
 editScene.value=id
 previewRequest.value={frame:scene.from+Math.min(40,scene.frames-1),nonce:++previewNonce}
}
const editOffer=computed(()=>doc.value.offers.find(o=>o.id===editScene.value))
const editElements=computed(()=>editScene.value==='intro'?['seal','logo']:editScene.value==='outro'?['logo','outro-social','outro-phone','outro-address']:['seal','logo','name','price','validity','condition','product-0','product-1','product-2'])
const selectedTransform=computed(()=>elementTransform(doc.value,previewFormat.value,editScene.value,editElement.value))
const editFrame=computed(()=>{if(!editingLayout.value)return undefined;const scene=composition.value.scenes.find(s=>s.id===editScene.value);return (scene?.from||0)+(editScene.value==='intro'&&previewFormat.value==='horizontal'&&editElement.value==='seal'?18:40)})
function updateTransform(id:string,value:VideoElementTransform){setElementTransform(doc.value,previewFormat.value,editScene.value,id,{...value,x:Math.max(-4000,Math.min(4000,value.x)),y:Math.max(-4000,Math.min(4000,value.y))})}
function changeTransform(key:keyof VideoElementTransform,event:Event){const value=Number((event.target as HTMLInputElement).value);if(Number.isFinite(value))updateTransform(editElement.value,{...selectedTransform.value,[key]:value})}
function resetScene(){if(doc.value.layoutEdits?.[previewFormat.value])delete doc.value.layoutEdits[previewFormat.value]![editScene.value]}
watch(editScene,()=>editElement.value=editScene.value==='outro'?'logo':editScene.value==='intro'?'seal':'product-0')

const projects=ref<any[]>([]),jobs=ref<any[]>([]),assets=ref<any[]>([]),voices=ref<any[]>([]),sources=ref<any[]>([])
const workerReady=ref(false),musicgpt=ref(false),elevenlabs=ref(false),loading=ref(true),busy=ref(''),saving=ref(false),notice=ref(''),error=ref(''),savedAt=ref('')
const previewFormat=ref<VideoFormat>('vertical'),advanced=ref(false),pronunciationOpen=ref(false),normalized=ref<any[]>([]),previewError=ref('')
const showListImport=ref(false)
const legacyNarrationText=ref<string|null>(null)
const showImport=ref(false),sourceId=ref(''),sourceOffers=ref<any[]>([]),selectedOffers=ref<number[]>([]),musicPrompt=ref('Trilha instrumental animada para ofertas de supermercado, sem voz')
let poll:ReturnType<typeof setInterval>|undefined,autosave:ReturnType<typeof setTimeout>|undefined
const serialize=()=>JSON.stringify({document:doc.value,scriptSource:scriptSource.value})
const dirty=computed(()=>serialize()!==baseline.value)
const theme=computed(()=>VIDEO_THEMES.find(t=>t.id===doc.value.theme)!)
const narrationInvalid=computed(()=>doc.value.narrationText!==undefined&&JSON.stringify(narrationScripts(doc.value,doc.value.narrationText))!==JSON.stringify(doc.value.scripts))
const voiceJob=computed(()=>narrationInvalid.value?undefined:jobs.value.find(j=>j.kind==='voice'&&j.status==='ready'&&j.result?.provider==='elevenlabs'&&videoAudioIdentityMatches(j.result?.audioIdentity,doc.value)))
const renderJob=computed(()=>jobs.value.find(j=>j.kind==='render'&&j.status==='ready'&&!dirty.value&&j.revision===revision.value&&(!doc.value.voice.enabled||j.voice_asset_id===voiceJob.value?.result?.fullVoice?.assetId)))
const activeJobs=computed(()=>jobs.value.filter(j=>['queued','running'].includes(j.status)))
const scriptChanged=computed(()=>doc.value.voice.enabled&&!videoSpeechSourceMatches(doc.value,scriptSource.value))
const voiceGenerationBlocker=computed(()=>{
 if(!workerReady.value)return 'O serviço de geração está indisponível no momento. Atualize o estado para tentar novamente.'
 if(!elevenlabs.value)return 'O serviço de locução ainda não está disponível. Entre em contato com o suporte.'
 if(!voices.value.length)return 'Nenhum locutor está disponível nesta conta.'
 if(scriptChanged.value)return 'Confirme o roteiro após as alterações nas ofertas.'
 if(narrationInvalid.value)return `Mantenha ${doc.value.offers.length+2} linhas no roteiro: abertura, produtos e encerramento.`
 if(activeJobs.value.some(j=>j.kind==='voice'))return 'Uma locução já está sendo gerada. Aguarde a conclusão.'
 return ''
})
const narrationText=computed({get:()=>legacyNarrationText.value??videoNarrationText(doc.value),set:(value:string)=>{legacyNarrationText.value=null;doc.value.narrationText=value;const scripts=narrationScripts(doc.value,value);if(scripts)doc.value.scripts=scripts;scriptSource.value='';normalized.value=[]}})
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
const musicCursor=ref<string|null>(null)
const musicItems=computed(()=>assets.value.filter(a=>a.kind==='music'))
const composition=computed<VideoRenderProps>(()=>{
 const d=doc.value,voice=voiceJob.value?.result,clips=voice?.clips||{}
 let scenes
 try{scenes=voice?.fullVoice?fullVoiceTimeline(d,voice.fullVoice):buildVideoTimeline(d,voice?Object.fromEntries(Object.entries(clips).map(([id,v]:[string,any])=>[id,v.duration])):undefined)}catch{const ids=['intro',...d.offers.map(o=>o.id),'outro'],frames=Math.floor((d.duration*30-2)/ids.length);scenes=ids.map((id,i)=>({id,from:i*frames,frames}))}
 const media:Record<string,string>={};for(const id of [d.brand.logo,...d.offers.map(o=>o.image)].filter(Boolean))media[id]=mediaUrl(id)
 return {voiceAudio:voice?.fullVoice?mediaUrl(voice.fullVoice.assetId):undefined,editor:editingLayout.value?{enabled:true,sceneId:editScene.value,selected:editElement.value,select:(id:string)=>editElement.value=id,change:updateTransform}:undefined,document:d,label:resolveVideoLabel(labels.value,d.theme,d.priceLabel),scenes:scenes.map(s=>({...s,...(clips[s.id]?{audio:mediaUrl(clips[s.id].assetId)}:{})})),media,format:previewFormat.value,music:d.audio.music==='none'?undefined:isBuiltinMusic(d.audio.music)?`/video-studio/audio/${d.audio.music}.mp3`:mediaUrl(d.audio.music),impact:'/video-studio/audio/impact.mp3',whoosh:'/video-studio/audio/whoosh.mp3'}
})
const voicePlaybackRate=computed(()=>Math.max(1,...composition.value.scenes.map(scene=>scene.playbackRate||1)))
const estimated=computed(()=>Math.round(composition.value.scenes.reduce((n,s)=>n+s.frames,0)/30*10)/10)
const sayError=(e:any)=>{error.value=e?.data?.statusMessage||e?.statusMessage||e?.message||'Não foi possível concluir. Tente novamente.'}
async function action(label:string,fn:()=>Promise<void>){if(busy.value)return;busy.value=label;error.value='';notice.value='';try{await fn()}catch(e){sayError(e)}finally{busy.value=''}}
async function refreshLibrary(){const r=await $fetch<any>('/api/videos/projects',{query:{view:'library'}});projects.value=r.items}
let jobEvents:EventSource|undefined
const liveJobs=ref(false)
function applyJobs(items:any[]){
 const completed=items.find(j=>j.status==='ready'&&jobs.value.some(old=>old.id===j.id&&['queued','running'].includes(old.status)))
 jobs.value=items
 if(completed){notice.value=completed.kind==='voice'?'Locução pronta! Você já pode ouvir na prévia.':completed.kind==='music'?'Sua música está pronta.':'Seu vídeo está pronto para baixar.';void refreshAssets()}
}
async function refreshJobs(){const id=projectId.value;if(!id)return;const r=await $fetch<any>('/api/videos/jobs',{query:{projectId:id}});if(projectId.value===id)applyJobs(r.items)}
watch([projectId,view],([id,current])=>{
 jobEvents?.close();jobEvents=undefined;liveJobs.value=false
 if(!import.meta.client||!id||current!=='editor')return
 const source=new EventSource('/api/videos/job-events?projectId='+encodeURIComponent(id));jobEvents=source
 source.addEventListener('jobs',event=>{if(jobEvents!==source)return;liveJobs.value=true;try{applyJobs(JSON.parse((event as MessageEvent).data).items)}catch{}})
 source.onopen=()=>{if(jobEvents===source)liveJobs.value=true}
 source.onerror=()=>{if(jobEvents===source)liveJobs.value=false}
})
const trackedJob=computed(()=>activeJobs.value[0]||jobs.value[0])
function jobDescription(j:any){if(j.status==='ready')return j.kind==='voice'?'Locução pronta para ouvir na prévia':'Geração concluída';if(j.status==='failed')return j.error||'Não foi possível concluir';if(j.status==='queued')return 'Aguardando início do processamento';if(j.kind==='voice'&&j.total_clips===1)return 'Preparando a locução do seu vídeo';if(j.kind==='voice')return `${j.completed_clips||0} de ${j.total_clips||doc.value.scripts.length} trechos prontos · aguardando o próximo áudio`;return j.kind==='music'?'Aguardando a música ficar pronta':`Renderizando · ${j.progress}%`}

async function refreshHealth(){try{const r=await $fetch<any>('/api/videos/health');workerReady.value=r.ready;musicgpt.value=r.musicgpt;elevenlabs.value=r.elevenlabs}catch(e){workerReady.value=false;musicgpt.value=false;elevenlabs.value=false;if(Number((e as any)?.statusCode||(e as any)?.response?.status)===401){await auth.getSession();if(!auth.isAuthenticated.value)await navigateTo('/auth/login',{replace:true})}}}
async function refreshAssets(){
 const [images,music]=await Promise.all([$fetch<any>('/api/videos/assets',{query:{kind:'image'}}),$fetch<any>('/api/videos/assets',{query:{kind:'music'}})])
 assets.value=[...images.items,...music.items];musicCursor.value=music.nextCursor||null
}
async function moreMusic(){await action('Carregando músicas',async()=>{const r=await $fetch<any>('/api/videos/assets',{query:{kind:'music',cursor:musicCursor.value}});const ids=new Set(assets.value.map(a=>a.id));assets.value.push(...r.items.filter((a:any)=>!ids.has(a.id)));musicCursor.value=r.nextCursor||null})}
async function selectMusic(id:string){doc.value.audio.music=id;await action('Salvando música',async()=>{await save();notice.value='Música aplicada. Suas faixas continuam disponíveis na biblioteca.'})}

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
 const selectedLabel=labelId?loadSelectedLabel(labelId):loadLabelOptions()
 if(!editorDataPromise)editorDataPromise=(async()=>{
  const results=await Promise.allSettled([
   refreshHealth(),
   refreshAssets(),
   $fetch<any>('/api/videos/voices').then(r=>voices.value=r.items),
   $fetch<any>('/api/videos/sources').then(r=>sources.value=r.items)
  ])
  for(const result of results)if(result.status==='rejected')sayError(result.reason)
  if(voices.value.length&&!voices.value.some((voice:any)=>voice.id===doc.value.voice.id))doc.value.voice.id=voices.value[0].id
 })()
 await Promise.all([editorDataPromise,selectedLabel])
}
let savePromise:Promise<void>|null=null
async function save(){if(savePromise)await savePromise;if(!dirty.value&&projectId.value)return
 const snapshot=serialize(),data=JSON.parse(snapshot);saving.value=true
 savePromise=(async()=>{const row=await $fetch<any>('/api/videos/projects',{method:'POST',body:{...(projectId.value?{id:projectId.value}:{}),revision:revision.value,...data}});projectId.value=row.id;revision.value=row.revision;baseline.value=snapshot;await navigateTo({path:'/videos',query:{project:row.id}},{replace:true});savedAt.value=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})})()
 try{await savePromise}finally{saving.value=false;savePromise=null}
}
function createVideo(){libraryTab.value='models';modelSearch.value='';document.getElementById('video-catalog')?.scrollIntoView({behavior:'smooth'})}
async function prepareModel(themeId:string,source?:VideoDocument){
 if(autosave)clearTimeout(autosave)
 switchingProject=true
 try{
  projectId.value='';revision.value=0;jobs.value=[];scriptSource.value='';legacyNarrationText.value=null;editingLayout.value=false
  const draft=newVideoFromTemplate(themeId)
  if(!accountBrand){const r=await $fetch<any>('/api/videos/brand',{method:'POST'});accountBrand={...r.brand,logoStyle:'sticker'};if(r.warning)notice.value=r.warning}
  draft.brand=JSON.parse(JSON.stringify(accountBrand))
  // Produtos ilustrativos só são lidos de um modelo pertencente à própria conta.
  if(source)draft.offers=JSON.parse(JSON.stringify(source.offers))
  doc.value=draft;previewFormat.value='vertical';showModelPreview.value=true
  await loadEditorData(draft.priceLabel)
  await nextTick()
 }finally{switchingProject=false}
}
async function previewModel(themeId:string){await action('Preparando prévia com sua marca',async()=>{
 const model=projects.value.find(p=>isVideoModel(p)&&p.summary?.theme===themeId)
 const source=model?await $fetch<any>(`/api/videos/projects/${model.id}`):undefined
 await prepareModel(themeId,source?.document)
})}
async function useSelectedTemplate(){await action('Preparando seu vídeo',async()=>{
 switchingProject=true
 try{
  const result=await $fetch<any>('/api/videos/templates/use',{method:'POST',body:{theme:doc.value.theme}})
  const p=result.project
  doc.value=p.document;projectId.value=p.id;revision.value=p.revision;scriptSource.value=p.script_source||'';jobs.value=[];normalized.value=[];legacyNarrationText.value=null
  baseline.value=serialize();step.value=0;showModelPreview.value=false;view.value='editor';editingLayout.value=false
  await navigateTo({path:'/videos',query:{project:p.id}},{replace:true})
  await loadEditorData(doc.value.priceLabel);await refreshAssets();await nextTick()
  notice.value=result.warning||'Seu vídeo está pronto para receber as ofertas.'
 }finally{switchingProject=false}
})}
async function openVideo(id:string){await action('Abrindo vídeo',async()=>{
 if(autosave)clearTimeout(autosave)
 const p=await $fetch<any>(`/api/videos/projects/${id}`)
 if(isVideoModel(p)){view.value='library';libraryTab.value='models';await prepareModel(p.document.theme,p.document);await navigateTo('/videos',{replace:true});return}
 switchingProject=true
 try{doc.value=p.document;scriptSource.value=p.script_source;projectId.value=p.id;revision.value=p.revision;baseline.value=serialize();step.value=0;view.value='editor';editingLayout.value=false;void loadEditorData(doc.value.priceLabel);previewFormat.value=doc.value.formats[0]!;normalized.value=[];legacyNarrationText.value=null;await navigateTo({path:'/videos',query:{project:p.id}},{replace:true});await refreshJobs();await nextTick()}finally{switchingProject=false}
})}
async function library(){await action('Salvando',async()=>{await save();await refreshLibrary();view.value='library';libraryTab.value='projects';await navigateTo('/videos',{replace:true})})}
function selectTheme(id:VideoDocument['theme']){if(id!==doc.value.theme)doc.value.layoutEdits=undefined;applyVideoTemplate(doc.value,id);editScene.value='intro';editingLayout.value=false}
function toggleFormat(format:VideoFormat){const i=doc.value.formats.indexOf(format);if(i>=0&&doc.value.formats.length>1)doc.value.formats.splice(i,1);else if(i<0)doc.value.formats.push(format);if(!doc.value.formats.includes(previewFormat.value))previewFormat.value=doc.value.formats[0]!}
function addOffer(){if(doc.value.offers.length<6)doc.value.offers.push({id:crypto.randomUUID(),name:'',price:'',unit:'un',condition:'',image:''})}
function moveOffer(index:number,delta:number){const next=index+delta;if(next<0||next>=doc.value.offers.length)return;const item=doc.value.offers.splice(index,1)[0]!;doc.value.offers.splice(next,0,item);const map=new Map(doc.value.scripts.map(s=>[s.id,s]));doc.value.scripts=['intro',...doc.value.offers.map(o=>o.id),'outro'].flatMap(id=>map.has(id)?[map.get(id)!]:[]);if(doc.value.narrationText!==undefined)doc.value.narrationText=doc.value.scripts.map(s=>s.text).join('\n')}
function removeOffer(index:number){const removed=doc.value.offers.splice(index,1)[0];if(!removed)return;doc.value.scripts=doc.value.scripts.filter(s=>s.id!==removed.id);if(doc.value.narrationText!==undefined)doc.value.narrationText=doc.value.scripts.map(s=>s.text).join('\n')}
async function upload(event:Event,target:string){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;await action('Enviando arquivo',async()=>{const body=new FormData();body.append('file',file);body.append('kind',target==='music'?'music':'image');const asset=await $fetch<any>('/api/videos/assets',{method:'POST',body});if(target==='logo')doc.value.brand.logo=asset.id;else if(target==='music')doc.value.audio.music=asset.id;else{const offer=doc.value.offers.find(o=>o.id===target);if(offer){offer.image=asset.id;offer.imageAspectRatio=asset.aspectRatio}}await refreshAssets();await save();if(target==='music')notice.value='Música aplicada e salva em Minha biblioteca para seus próximos vídeos.'});input.value=''}
async function suggestWithAI(){await action('Sugerindo roteiro com IA',async()=>{const source=videoSpeechSource(doc.value);const r=await $fetch<any>('/api/videos/script',{method:'POST',body:doc.value});if(source!==videoSpeechSource(doc.value))throw Error('As ofertas mudaram durante a sugestão. Solicite novamente.');doc.value.scripts=r.scripts;doc.value.narrationText=r.scripts.map((s:{text:string})=>s.text).join('\n');legacyNarrationText.value=null;scriptSource.value='';notice.value='Roteiro sugerido por IA com números e unidades por extenso. Confira antes de gerar o áudio.'})}
async function suggest(){await action('Preparando roteiro',async()=>{const source=videoSpeechSource(doc.value),scripts=suggestVideoScripts(doc.value);const r=await $fetch<any>('/api/videos/normalize',{method:'POST',body:{scripts,pronunciations:doc.value.voice.pronunciations}});if(source!==videoSpeechSource(doc.value))throw Error('As ofertas mudaram durante a sugestão. Solicite novamente.');doc.value.scripts=r.scripts;doc.value.narrationText=r.scripts.map((s:{text:string})=>s.text).join('\n');legacyNarrationText.value=null;scriptSource.value='';normalized.value=[];notice.value='Texto preparado por extenso. Revise nomes, preços e condições antes de confirmar.'})}
async function previewLegacyNarration(){if(doc.value.narrationText!==undefined||!doc.value.scripts.length)return;try{const r=await $fetch<any>('/api/videos/normalize',{method:'POST',body:{scripts:doc.value.scripts,pronunciations:doc.value.voice.pronunciations}});legacyNarrationText.value=r.scripts.map((s:{text:string})=>s.text).join('\n')}catch{legacyNarrationText.value=null}}
async function normalize(){await action('Preparando a pronúncia',async()=>{const r=await $fetch<any>('/api/videos/normalize',{method:'POST',body:{scripts:doc.value.scripts,pronunciations:doc.value.voice.pronunciations}});normalized.value=r.scripts})}
async function confirmScript(){if(narrationInvalid.value){error.value=`Mantenha ${doc.value.offers.length+2} linhas no campo: abertura, uma por produto e encerramento.`;return}if(doc.value.narrationText===undefined){scriptSource.value=videoSpeechSource(doc.value);notice.value='Roteiro conferido.';return}await action('Preparando texto da locução',async()=>{const source=videoSpeechSource(doc.value),draft=doc.value.narrationText;const r=await $fetch<any>('/api/videos/normalize',{method:'POST',body:{scripts:doc.value.scripts,pronunciations:doc.value.voice.pronunciations}});if(source!==videoSpeechSource(doc.value)||draft!==doc.value.narrationText)throw Error('As ofertas ou o texto mudaram durante a preparação. Confira o roteiro novamente.');doc.value.scripts=r.scripts;doc.value.narrationText=r.scripts.map((s:{text:string})=>s.text).join('\n');scriptSource.value=source;notice.value='Roteiro por extenso conferido.'})}
async function generate(kind:'voice'|'render'|'music'){if(kind==='render'){step.value=4;editingLayout.value=false}await action(kind==='voice'?'Solicitando locução':kind==='music'?'Solicitando música':'Preparando exportação',async()=>{await save();await $fetch('/api/videos/jobs',{method:'POST',body:{projectId:projectId.value,revision:revision.value,kind,...(kind==='music'?{musicPrompt:musicPrompt.value}:{})}});await refreshJobs();notice.value=kind==='render'?'Seu vídeo entrou na fila. Você pode acompanhar abaixo.':'Solicitação enviada. A geração de áudio pode levar alguns minutos.'})}
async function chooseSource(){await action('Lendo ofertas',async()=>{const r=await $fetch<any>('/api/videos/import',{method:'POST',body:{projectId:sourceId.value}});sourceOffers.value=r.items;selectedOffers.value=[];notice.value=r.warning||''})}
async function importOffers(){await action('Importando produtos',async()=>{const r=await $fetch<any>('/api/videos/import',{method:'POST',body:{projectId:sourceId.value,indices:selectedOffers.value.slice(0,6-doc.value.offers.length)}});doc.value.offers.push(...r.offers);showImport.value=false;notice.value=r.warning||'Produtos importados. Confira preços e unidades.';await refreshAssets();await save()})}
async function receiveList(offers:VideoDocument['offers']){doc.value.offers.push(...offers.slice(0,6-doc.value.offers.length));showListImport.value=false;notice.value=offers.some(o=>!o.image)?'Lista importada. Confira preços e complete as fotos pendentes.':'Lista e fotos importadas. Confira preços, unidades e condições.';await refreshAssets();await action('Salvando lista',save)}
async function refreshBrand(){await action('Atualizando dados da loja',async()=>{const r=await $fetch<any>('/api/videos/brand',{method:'POST'});doc.value.brand={...r.brand,logoStyle:doc.value.brand.logoStyle||'sticker'};notice.value=r.warning||'Dados atualizados a partir do seu cadastro.';await refreshAssets();await save()})}
const validityMode=computed(()=>doc.value.validityMode|| (doc.value.validityRange ? doc.value.validityRange.start===doc.value.validityRange.end?'single_day':'date_range' : doc.value.validity?'custom':'none'))
const validityPreview=computed(()=>videoValidityText(doc.value))
const validityChoices=[
 {id:'single_day',title:'Só 1 dia',description:'Uma data para a campanha',symbol:'1'},
 {id:'date_range',title:'Vários dias',description:'Defina início e fim',symbol:'↔'},
 {id:'none',title:'Sem data',description:'Não mostrar validade',symbol:'—'},
] as const
const validityHelp=computed(()=>validityMode.value==='none'?'Nenhuma data, texto de validade ou calendário aparecerá no vídeo.':validityMode.value!=='custom'&&!doc.value.validityDateFormat?'Escolha entre formato numérico ou mês por extenso para ver a validade.':validityPreview.value||'Escolha a data para ver como ela aparecerá no vídeo.')
function updateValidity(){doc.value.validity=validityMode.value==='none'?'':videoValidityText({...doc.value,validity:''})}
function invalidateValidityNarration(){doc.value.scripts=[];doc.value.narrationText=undefined;scriptSource.value='';legacyNarrationText.value=null}
function changeValidityMode(mode:NonNullable<VideoDocument['validityMode']>){if(mode===validityMode.value)return;doc.value.validityMode=mode;if(mode==='none'){doc.value.validity='';doc.value.validityRange=undefined}else if(mode==='single_day'){const day=doc.value.validityRange?.start||doc.value.validityRange?.end||'';doc.value.validityRange={start:day,end:day};updateValidity()}else if(mode==='date_range'){doc.value.validityRange ||= {start:'',end:''};updateValidity()}else doc.value.validityRange=undefined;invalidateValidityNarration()}
function changeDate(key:'start'|'end',event:Event){doc.value.validityRange ||= {start:'',end:''};doc.value.validityRange[key]=(event.target as HTMLInputElement).value;if(validityMode.value==='single_day')doc.value.validityRange.end=doc.value.validityRange.start;updateValidity();invalidateValidityNarration()}
function changeValidityDateFormat(format:'numeric'|'long'){doc.value.validityDateFormat=format;updateValidity();invalidateValidityNarration()}
async function goStep(target:number){
 if(target>step.value){
  if(!doc.value.brand.name.trim()){step.value=0;error.value='Informe o nome da empresa para continuar.';return}
  if(target>1){const productIssues=validateVideoForGeneration({...doc.value,voice:{...doc.value.voice,enabled:false}});if(productIssues.length){step.value=1;error.value=productIssues[0]!;return}}
  if(target===3){const ids=['intro',...doc.value.offers.map(o=>o.id),'outro'];const stale=()=>!!scriptSource.value&&!videoSpeechSourceMatches(doc.value,scriptSource.value);const needsSuggestion=ids.some((id,i)=>doc.value.scripts[i]?.id!==id)||stale();if(needsSuggestion){await suggestWithAI();if(ids.some((id,i)=>doc.value.scripts[i]?.id!==id)||stale())await suggest();if(ids.some((id,i)=>doc.value.scripts[i]?.id!==id)||stale())return}await previewLegacyNarration()}
 }
 await action('Salvando',async()=>{await save();step.value=target;editingLayout.value=false;document.querySelector('.vs-editor-title')?.scrollIntoView({behavior:'smooth',block:'start'})})
}
watch(step,value=>{if(value===1&&!doc.value.offers.length)showListImport.value=true})
async function next(){await goStep(Math.min(4,step.value+1))}

watch([doc,scriptSource],()=>{if(switchingProject)return;normalized.value=[];if(autosave)clearTimeout(autosave);if(view.value==='editor'&&projectId.value)autosave=setTimeout(()=>save().catch(sayError),1800)},{deep:true})
onMounted(async()=>{try{if(!await auth.getSession()){await navigateTo('/auth/login',{replace:true});return}await refreshLibrary();const selected=String(route.query.project||'');if(selected)await openVideo(selected)}catch(e){if(Number((e as any)?.statusCode||(e as any)?.response?.status)===401){await auth.getSession();await navigateTo('/auth/login',{replace:true})}else sayError(e)}finally{loading.value=false;if(auth.isAuthenticated.value)poll=setInterval(()=>{if(view.value!=='editor')return;refreshHealth();if(projectId.value&&(!liveJobs.value||activeJobs.value.length))refreshJobs().catch(()=>{})},6000)}})
onBeforeUnmount(()=>{jobEvents?.close();if(poll)clearInterval(poll);if(autosave)clearTimeout(autosave)})
onBeforeRouteLeave(async()=>{if(view.value==='editor'&&dirty.value){try{await save()}catch(e){sayError(e);return false}}})
</script>

<template>
 <component :is="auth.isSuperAdmin.value&&view==='library'?AdminWorkspaceShell:'div'" active-nav="videos"><div class="vs-app" :class="{'vs-in-shell':auth.isSuperAdmin.value&&view==='library','vs-editing':view==='editor'}">
  <header v-if="!auth.isSuperAdmin.value||view==='editor'" class="vs-header">
   <div class="vs-header-inner">
    <NuxtLink to="/" class="vs-brand" aria-label="JobVarejo, início"><img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="176" height="56"/></NuxtLink>
    <nav class="vs-header-context" aria-label="Navegação de vídeos"><NuxtLink to="/" class="vs-solutions-link"><ArrowLeft :size="16"/><span>Todas as soluções</span></NuxtLink><span class="vs-header-divider" aria-hidden="true"></span><span class="vs-product-title"><span class="vs-product-icon"><Clapperboard :size="17"/></span> Vídeos de ofertas</span></nav>
    <div class="vs-header-actions"><span v-if="view==='editor'" class="vs-save-status" role="status">{{ saving?'Salvando…':dirty?'Alterações por salvar':`Salvo${savedAt?' às '+savedAt:''}` }}</span><button v-if="view==='editor'" class="vs-button quiet" :disabled="!!busy" @click="library"><ArrowLeft :size="16"/> Meus vídeos</button></div>
   </div>
  </header>

  <div v-if="error" class="vs-message error" role="alert"><span>{{ error }}</span><button aria-label="Fechar aviso" @click="error=''"><X :size="18"/></button></div>
  <div v-if="notice" class="vs-message" role="status"><span>{{ notice }}</span><button aria-label="Fechar aviso" @click="notice=''"><X :size="18"/></button></div>
  <main v-if="view==='library'" class="vs-library">
   <section class="vs-hero">
    <div class="vs-hero-copy">
     <span class="vs-eyebrow"><Clapperboard :size="14"/> Estúdio de vídeos</span>
     <h1>Sua oferta<br><span>em movimento.</span></h1>
     <p>Escolha um modelo, adicione os produtos e preços da sua loja e monte vídeos para Reels, Stories e TV com locução e música.</p>
     <div class="vs-hero-actions"><button class="vs-button primary large" :disabled="!!busy||loading" @click="createVideo"><Plus :size="20"/> Criar vídeo</button><span class="vs-hero-assurance"><Check :size="15"/> Comece por um modelo pronto</span></div>
     <div class="vs-hero-tags"><span><Smartphone :size="15"/> Reels e Stories</span><span><Monitor :size="15"/> TV da loja</span><span><Volume2 :size="15"/> Locução e música</span></div>
    </div>
    <div class="vs-hero-art" role="img" aria-label="Exemplo ilustrativo de um vídeo de oferta montado no JobVarejo">
     <div class="vs-studio-demo">
      <div class="vs-studio-demo__header"><span class="vs-studio-demo__status"><span/> EXEMPLO DE COMPOSIÇÃO</span><span>Alerta de Oferta <Clapperboard :size="14"/></span></div>
      <div class="vs-studio-demo__body">
       <div class="vs-studio-demo__reel"><span class="vs-studio-demo__format"><Smartphone :size="12"/> Reels · 9:16</span><div class="vs-studio-demo__scene"><img class="vs-studio-demo__seal" src="/video-studio/templates/alerta-seal.png" alt=""/><img class="vs-studio-demo__product" src="/coins/LEITE%20PO%20INTEGRAL%20ITALAC%20400G.png" alt=""/><span class="vs-studio-demo__price"><small>LEITE EM PÓ 400 G</small><strong>R$ 9,99</strong></span><span class="vs-studio-demo__sample">PREÇO ILUSTRATIVO</span></div></div>
       <div class="vs-studio-demo__side"><span class="vs-studio-demo__format"><Monitor :size="13"/> TV da loja · 16:9</span><div class="vs-studio-demo__tv"><img class="vs-studio-demo__tv-seal" src="/video-studio/templates/alerta-seal.png" alt=""/><img class="vs-studio-demo__tv-product" src="/coins/LEITE%20PO%20INTEGRAL%20ITALAC%20400G.png" alt=""/><span class="vs-studio-demo__tv-price">R$ 9,99</span></div><div class="vs-studio-demo__track"><span><Volume2 :size="13"/> Cenas e áudio</span><div><i/><i/><i/></div><small>abertura <b>·</b> produto <b>·</b> fechamento</small></div></div>
      </div>
     </div>
    </div>
   </section>
   <section id="video-catalog">
    <div class="vs-library-tabs" role="tablist" aria-label="Biblioteca de vídeos"><button role="tab" :aria-selected="libraryTab==='models'" :class="{active:libraryTab==='models'}" @click="libraryTab='models'">Modelos prontos <span>{{ VIDEO_THEMES.length }}</span></button><button role="tab" :aria-selected="libraryTab==='projects'" :class="{active:libraryTab==='projects'}" @click="libraryTab='projects'">Meus vídeos <span>{{ personalProjects.length }}</span></button></div>
    <div v-if="libraryTab==='models'" class="vs-catalog">
     <div class="vs-section-heading"><div><h2>Escolha o modelo. Deixe com a sua cara.</h2><p>Veja a animação com a marca da sua loja e escolha seu modelo.</p></div><label class="vs-field">Buscar modelo<input v-model="modelSearch" type="search" placeholder="Ex.: açougue, quinta, ofertas"/></label></div>
     <div class="vs-project-grid"><button v-for="t in visibleModels" :key="t.id" class="vs-project-card vs-model-card" :disabled="!!busy" @click="previewModel(t.id)"><div class="vs-model-art" :style="{'--base':t.base,'--accent':t.accent,backgroundImage:flyerRecipe(t.id)?.background?`url(/video-studio/templates/${flyerRecipe(t.id)!.background})`:undefined}"><img v-if="flyerRecipe(t.id)?.seal" :src="'/video-studio/templates/'+flyerRecipe(t.id)!.seal" :alt="t.title" loading="lazy"/><strong v-else>{{ t.title }}</strong><span class="vs-model-play"><Play :size="16"/> Ver prévia</span></div><div class="vs-project-info"><h3>{{ t.name }}</h3><span>Reels / Stories e TV · modelo reutilizável</span></div></button></div>
     <p v-if="!filteredModels.length" class="vs-mini-empty">Nenhum modelo encontrado. Tente outro nome.</p><button v-if="visibleModels.length<filteredModels.length" class="vs-button secondary" @click="modelLimit+=12">Carregar mais modelos</button>
    </div>
    <template v-else>
    <div class="vs-section-heading"><div><h2>Meus vídeos</h2><p>Continue uma edição ou aproveite um vídeo para novas ofertas.</p></div><span>{{ personalProjects.length }} projetos</span></div>
    <div v-if="loading" class="vs-empty"><LoaderCircle class="vs-spin"/> Carregando seus vídeos…</div>
    <div v-else-if="!personalProjects.length" class="vs-empty"><Clapperboard :size="36"/><h3>Seu primeiro vídeo começa aqui</h3><p>Você não precisa saber editar. Vamos ajudar em cada etapa.</p><button class="vs-button secondary" @click="createVideo">Escolher um modelo <ArrowRight :size="16"/></button></div>
    <div v-else class="vs-project-grid">
     <button v-for="(p,index) in personalProjects" :key="p.id" type="button" class="vs-project-card" :aria-label="`Abrir vídeo ${p.title}`" @click="openVideo(p.id)">
      <div class="vs-project-cover" :class="{'has-video-cover':!!p.coverAssetId,'is-vertical-cover':p.coverFormat==='vertical','is-cover-ready':readyProjectCoverIds.has(p.id)}" :style="{'--accent':VIDEO_THEMES.find(t=>t.id===p.summary.theme)?.accent,'--base':VIDEO_THEMES.find(t=>t.id===p.summary.theme)?.base}">
       <img v-if="p.coverAssetId" class="vs-project-cover-media" :src="mediaUrl(String(p.coverAssetId))" alt="" :loading="index<3?'eager':'lazy'" :fetchpriority="index<3?'high':'low'" decoding="async" @load="markProjectCoverReady(p.id)"/>
       <div class="vs-project-cover-fallback"><span>{{ p.summary.brand?.name||'Sua empresa' }}</span><img v-if="p.summary.theme==='impact'&&p.summary.campaign==='FECHA MÊS'" src="/video-studio/templates/fecha-mes-badge-v1.png" alt="" style="height:130px;max-width:85%;object-fit:contain"/><strong v-else>{{ p.summary.campaign }}</strong></div>
       <div v-if="p.coverAssetId" class="vs-project-cover-overlay" aria-hidden="true"></div>
       <span class="vs-cover-play"><Play :size="18" fill="currentColor"/><span>{{ p.coverAssetId?'Assistir':'Em edição' }}</span></span>
      </div>
      <div class="vs-project-info"><h3>{{ p.title }}</h3><span>{{ p.summary.offerCount||0 }} produtos · até {{ p.summary.duration }} s</span></div>
     </button>
    </div>
    </template>
   </section>
  </main>
  <main v-else class="vs-editor">
   <div class="vs-editor-title"><div class="vs-title-container"><span class="vs-eyebrow">SEU VÍDEO · SALVAMENTO AUTOMÁTICO</span><div class="vs-title-field"><span class="vs-title-input vs-title-mirror" aria-hidden="true">{{ doc.title + ' ' }}</span><textarea :value="doc.title" aria-label="Nome do projeto" maxlength="100" rows="1" class="vs-title-input" @keydown.enter.prevent @input="doc.title = ($event.target as HTMLTextAreaElement).value.replace(/[\r\n]+/g, ' ')"/></div></div></div>
   <nav class="vs-steps" aria-label="Etapas da criação"><button v-for="(label,i) in steps" :key="label" :class="{active:step===i,complete:step>i}" :aria-current="step===i?'step':undefined" :disabled="!!busy" @click="goStep(i)"><span><Check v-if="step>i" :size="15"/><component :is="stepIcons[i]" v-else :size="20"/></span>{{ label }}</button></nav>
   <div class="vs-workspace"><section class="vs-form-panel">
    <VideoStudioListImport v-if="showListImport" v-show="step===1" :remaining="6-doc.offers.length" @close="showListImport=false" @import="receiveList"/>
    <div v-if="step===0" class="vs-step-content"><span class="vs-eyebrow">01 · ESCOLHA O ESTILO</span><h2>Qual é a sua campanha?</h2><p class="vs-lead">Confira a marca e os formatos; depois envie a lista de ofertas.</p><details class="vs-details"><summary>Trocar modelo <ChevronDown :size="16"/></summary><label class="vs-field">Buscar modelo<input v-model="modelSearch" placeholder="Ex.: quinta, relâmpago, hortifruti" /></label><div class="vs-theme-grid"><button v-for="t in visibleModels" :key="t.id" class="vs-theme" :class="{selected:doc.theme===t.id}" :style="{'--accent':t.accent,'--base':t.base}" @click="selectTheme(t.id)"><span class="vs-theme-sample"><img v-if="flyerRecipe(t.id)?.seal" :src="'/video-studio/templates/'+flyerRecipe(t.id)!.seal" class="vs-theme-badge" :alt="t.title" /><img v-else-if="t.id==='impact'" :src="doc.layoutVersion===2?'/video-studio/templates/fecha-mes-emerald-v2.png':'/video-studio/templates/fecha-mes-badge-v1.png'" alt="Fecha Mês em 3D" class="vs-theme-badge"/><template v-else>{{ t.title }}</template></span><span class="vs-theme-caption"><strong>{{ t.name }}</strong><small>{{ t.description }}</small></span><Check v-if="doc.theme===t.id" class="vs-theme-check" :size="19"/></button></div>
     <button v-if="visibleModels.length<filteredModels.length" class="vs-button secondary" @click="modelLimit+=12">Ver mais modelos ({{ filteredModels.length }})</button></details><label class="vs-field">Título da campanha<input v-model="doc.campaign" maxlength="65" placeholder="Ex.: Ofertas da semana"/></label>
     <div class="vs-divider"/><label v-if="!flyerRecipe(doc.theme)" class="vs-field">Montagem do vídeo<select :value="doc.layoutVersion===2?'showcase':'broadcast'" @change="doc.layoutVersion=($event.target as HTMLSelectElement).value==='showcase'?2:undefined"><option value="showcase">Vitrine • selo grande e produtos livres</option><option value="broadcast">Moldura • modelo anterior</option></select></label><label class="vs-toggle"><span><strong>Duplicar a imagem do produto</strong><small>Até duas embalagens no Reels e três na TV, quando houver espaço. O preço e a unidade não mudam.</small></span><input v-model="doc.duplicateProducts" type="checkbox"/></label><label class="vs-field">Etiqueta de preço<select v-model="doc.priceLabel" @focus="loadLabelOptions" @change="selectPriceLabel"><option value="">Automática · combina com o modelo</option><option v-for="label in labelOptions" :key="label.id" :value="label.id">{{ label.name }}</option></select><small>Escolha uma etiqueta da sua biblioteca.</small></label><h3>Onde você vai usar?</h3><div class="vs-choice-row"><button v-for="(format,key) in VIDEO_FORMATS" :key="key" class="vs-choice" :class="{selected:doc.formats.includes(key)}" :aria-pressed="doc.formats.includes(key)" @click="toggleFormat(key)"><Smartphone v-if="key==='vertical'"/><Monitor v-else/><strong>{{ format.label }}</strong><small>{{ key==='vertical'?'Em pé · 9:16':'Deitado · 16:9' }}</small></button></div>
     <label class="vs-field">Duração máxima<select v-model.number="doc.duration"><option :value="15">Até 15 segundos</option><option :value="20">Até 20 segundos</option><option :value="30">Até 30 segundos</option></select></label>
     <div class="vs-divider"/><h3>A identidade da sua loja</h3><button class="vs-button quiet" :disabled="!!busy" @click="refreshBrand">Atualizar com meu cadastro</button><p class="vs-hint">Preenchida a partir do seu cadastro. As mudanças aqui valem apenas para este vídeo.</p><div class="vs-brand-fields"><label class="vs-logo-upload"><img v-if="doc.brand.logo" :src="mediaUrl(doc.brand.logo)" alt="Logo da empresa"/><ImagePlus v-else :size="28"/><span>{{ doc.brand.logo?'Trocar logo':'Enviar logo' }}</span><input type="file" accept="image/png,image/jpeg,image/webp" @change="upload($event,'logo')"/></label><label class="vs-field">Nome da empresa<input v-model="doc.brand.name" maxlength="100" placeholder="Como sua loja se chama?"/></label></div><label class="vs-field">Aparência da logo<select v-model="doc.brand.logoStyle"><option value="sticker">Contorno branco • sticker</option><option value="clean">Sem contorno</option></select></label><details class="vs-details"><summary>Endereço e contatos <ChevronDown :size="16"/></summary><label class="vs-field">Endereço<input v-model="doc.brand.address" maxlength="160"/></label><div class="vs-two"><label class="vs-field">WhatsApp<input v-model="doc.brand.whatsapp" maxlength="45"/></label><label class="vs-field">Instagram<input v-model="doc.brand.instagram" maxlength="70"/></label></div><label class="vs-field">Slogan<input v-model="doc.brand.slogan" maxlength="160"/></label><label class="vs-field">Telefone<input v-model="doc.brand.phone" maxlength="60"/></label><label class="vs-field">Facebook<input v-model="doc.brand.facebook" maxlength="100"/></label><label class="vs-field">Site<input v-model="doc.brand.website" maxlength="120"/></label><label class="vs-field">Horário de funcionamento<input v-model="doc.brand.hours" maxlength="160"/></label><label class="vs-field">Informações de pagamento<input v-model="doc.brand.paymentNotes" maxlength="180"/></label><button v-if="doc.brand.logo" class="vs-button quiet" @click="doc.brand.logo=''">Usar apenas o nome da empresa</button></details>
    </div>
    <div v-if="step===1&&!showListImport" class="vs-step-content"><span class="vs-eyebrow">02 · ESCOLHA AS OFERTAS</span><h2>O que vamos anunciar?</h2><p class="vs-lead">Para 30 segundos, comece com 3 ou 4 produtos. Nomes curtos deixam a locução mais natural.</p><div class="vs-inline-actions"><button class="vs-button primary" :disabled="doc.offers.length>=6" @click="showListImport=true"><Upload :size="16"/> Enviar lista de produtos</button><button class="vs-button secondary" :disabled="doc.offers.length>=6" @click="addOffer"><Plus :size="16"/> Adicionar produto</button><button class="vs-button quiet" :disabled="!sources.length||doc.offers.length>=6" @click="showImport=true"><Copy :size="16"/> Trazer de um encarte</button></div>
     <div v-if="!doc.offers.length" class="vs-mini-empty">Adicione a primeira oferta para ver seu vídeo ganhar forma.</div>
     <details v-for="(offer,i) in doc.offers" :key="offer.id" name="video-offer-editor" class="vs-offer vs-offer-compact"><summary class="vs-offer-summary"><img v-if="offer.image" :src="mediaUrl(offer.image)" alt=""/><ImagePlus v-else :size="24"/><span><strong>{{ offer.name || `Oferta ${i+1}` }}</strong><small>R$ {{ offer.price || '—' }}<template v-if="offer.unit"> · {{ offer.unit }}</template></small></span><ChevronDown :size="16"/></summary><div class="vs-offer-details"><div class="vs-offer-top"><strong>Oferta {{ i+1 }}</strong><div><button :disabled="i===0" aria-label="Mover produto para cima" @click="moveOffer(i,-1)"><ChevronUp :size="17"/></button><button :disabled="i===doc.offers.length-1" aria-label="Mover produto para baixo" @click="moveOffer(i,1)"><ChevronDown :size="17"/></button><button aria-label="Retirar produto deste vídeo" @click="removeOffer(i)"><Trash2 :size="16"/></button></div></div><div class="vs-offer-body"><label class="vs-product-upload"><img v-if="offer.image" :src="mediaUrl(offer.image)" :alt="offer.name||'Imagem do produto'"/><ImagePlus v-else :size="27"/><span>{{ offer.image?'Trocar foto':'Adicionar foto' }}</span><input type="file" accept="image/png,image/jpeg,image/webp" @change="upload($event,offer.id)"/></label><div><label class="vs-field">Produto<input v-model="offer.name" maxlength="120" placeholder="Ex.: Café Tesouro 500 g"/></label><div class="vs-two"><label class="vs-field">Preço (R$)<input v-model="offer.price" inputmode="decimal" maxlength="20" placeholder="19,90"/></label><label class="vs-field">Unidade<input v-model="offer.unit" maxlength="30" placeholder="un, kg, pacote…"/></label></div></div></div><label class="vs-field">Imagens deste produto<select v-model="offer.copies" @change="previewOffer(offer.id)"><option :value="undefined">Automático · conforme a imagem</option><option :value="1">Uma imagem</option><option :value="2">Duas imagens</option><option :value="3">Três imagens</option></select></label><label class="vs-field">Limite ou condição da oferta<input v-model="offer.condition" maxlength="140" placeholder="Ex.: Limite de 3 unidades por cliente"/></label><label class="vs-toggle"><span><strong>Selo de bebida alcoólica · 18 anos</strong><small>Aparece na cena deste produto, na prévia e na exportação.</small></span><input type="checkbox" :checked="showVideoAlcoholBadge(offer)" @change="offer.alcoholBadgeEnabled=($event.target as HTMLInputElement).checked"/></label></div></details>
     <section class="vs-validity-card" aria-labelledby="vs-validity-title">
      <div class="vs-validity-heading"><span class="vs-validity-icon" aria-hidden="true">◷</span><div><span class="vs-validity-kicker">VALOR COMERCIAL</span><h3 id="vs-validity-title">Quando valem as ofertas?</h3><p>Escolha como a validade aparece nas cenas. Você pode mudar depois.</p></div></div>
      <div class="vs-validity-options" role="radiogroup" aria-label="Validade das ofertas">
       <button v-for="choice in validityChoices" :key="choice.id" type="button" class="vs-validity-option" :class="{'is-selected':validityMode===choice.id}" role="radio" :aria-checked="validityMode===choice.id" @click="changeValidityMode(choice.id)"><span class="vs-validity-option-symbol" aria-hidden="true">{{ choice.symbol }}</span><span class="vs-validity-option-copy"><strong>{{ choice.title }}</strong><small>{{ choice.description }}</small></span><span class="vs-validity-radio" aria-hidden="true"/></button>
      </div>
      <p v-if="validityMode==='custom'" class="vs-validity-legacy">Este vídeo antigo tem um texto de validade próprio. Escolha uma opção acima para gerar o texto automaticamente.</p>
      <div v-if="validityMode==='single_day'||validityMode==='date_range'" class="vs-validity-fields">
       <label v-if="validityMode==='single_day'" class="vs-field">Dia da oferta<input type="date" :value="doc.validityRange?.start||''" @change="changeDate('start',$event)"/></label>
       <div v-if="validityMode==='date_range'" class="vs-validity-date-grid"><label class="vs-field">Data inicial<input type="date" :value="doc.validityRange?.start||''" @change="changeDate('start',$event)"/></label><label class="vs-field">Data final<input type="date" :value="doc.validityRange?.end||''" :min="doc.validityRange?.start" @change="changeDate('end',$event)"/></label></div>
       <fieldset class="vs-validity-format"><legend>Como a data deve aparecer? <span>Obrigatório</span></legend><div class="vs-validity-format-options"><button type="button" :class="{'is-selected':doc.validityDateFormat==='numeric'}" :aria-pressed="doc.validityDateFormat==='numeric'" @click="changeValidityDateFormat('numeric')"><strong>{{ validityMode === 'date_range' ? '25/09/2026 a 26/09/2026' : '25/09/2026' }}</strong><small>Numérico</small></button><button type="button" :class="{'is-selected':doc.validityDateFormat==='long'}" :aria-pressed="doc.validityDateFormat==='long'" @click="changeValidityDateFormat('long')"><strong>{{ validityMode === 'date_range' ? '25 a 26 de setembro' : '25 de setembro' }}</strong><small>Mês por extenso</small></button></div></fieldset>
      </div>
      <div class="vs-validity-preview" :class="{'is-empty':!validityPreview}" role="status" aria-live="polite"><span>{{ validityMode==='none'?'SEM VALIDADE VISÍVEL':'ASSIM APARECERÁ NO VÍDEO' }}</span><strong>{{ validityHelp }}</strong></div>
     </section>
    </div>
    <div v-if="step===2" class="vs-step-content"><span class="vs-eyebrow">03 · PERSONALIZE COM UM CLIQUE</span><h2>Seu vídeo, do seu jeito.</h2><p class="vs-lead">Escolha as combinações e confira na prévia. Você pode voltar às opções do modelo a qualquer momento.</p><VideoStudioPersonalize v-model="doc"/>
     <section class="vs-audio-card"><div class="vs-audio-card-heading"><span aria-hidden="true">♫</span><div><h3>Música de fundo</h3><p>A trilha baixa automaticamente enquanto o locutor fala.</p></div></div><label class="vs-field">Escolha a trilha<select :value="doc.audio.music" @change="selectMusic(($event.target as HTMLSelectElement).value)"><optgroup label="Músicas do sistema"><option v-for="track in BUILTIN_MUSIC" :key="track.id" :value="track.id">{{ track.name }}</option></optgroup><optgroup label="Minha biblioteca"><option v-for="a in musicItems" :key="a.id" :value="a.id">{{ a.name }}</option></optgroup><option value="none">Sem música</option></select></label><button v-if="musicCursor" class="vs-button quiet" :disabled="!!busy" @click="moreMusic">Carregar mais músicas da biblioteca</button><p class="vs-hint">As músicas que você envia ficam na sua biblioteca, disponíveis em todos os seus vídeos.</p><audio v-if="composition.music" :key="composition.music" controls preload="none" :src="composition.music" class="vs-audio"/><label class="vs-button quiet vs-upload-inline"><Upload :size="16"/> Trocar / enviar música<input type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac" @change="upload($event,'music')"/></label>
     <details class="vs-details"><summary>Criar uma trilha com IA <Sparkles :size="16"/></summary><label class="vs-field">Descreva o clima<textarea v-model="musicPrompt" maxlength="500" rows="2"/></label><button class="vs-button secondary" :disabled="!!busy||!workerReady||!musicgpt" @click="generate('music')">Gerar música</button><p class="vs-hint">A trilha pronta ficará disponível aqui para você ouvir e usar.</p></details>
     <label class="vs-toggle"><span><strong>Sons na abertura e transições</strong><small>Impactos na logo, no selo e nas mudanças de oferta.</small></span><input v-model="doc.audio.sounds" type="checkbox"/></label><details class="vs-details"><summary>Ajustar volumes <Volume2 :size="16"/></summary><label v-for="item in ([{key:'musicVolume',name:'Música'},{key:'voiceVolume',name:'Locutor'},{key:'effectsVolume',name:'Efeitos sonoros'}] as const)" :key="item.key" class="vs-field">{{ item.name }} · {{ Math.round(doc.audio[item.key]*100) }}%<input v-model.number="doc.audio[item.key]" type="range" min="0" max="1" step="0.05"/></label></details></section>
    </div>
    <div v-if="step===3" class="vs-step-content"><span class="vs-eyebrow">04 · DÊ VOZ ÀS OFERTAS</span><h2>Do seu jeito. Com a sua voz.</h2><p class="vs-lead">Revise o texto, escolha o locutor e ouça antes de finalizar.</p><label class="vs-toggle"><span><strong>Usar locução</strong><small>O locutor anuncia sua loja e os produtos.</small></span><input v-model="doc.voice.enabled" type="checkbox"/></label>
     <template v-if="doc.voice.enabled"><label class="vs-field">Locutor<select v-model="doc.voice.id"><option v-if="!voices.length" value="default">Nenhum locutor disponível nesta conta</option><option v-for="v in voices" :key="v.id" :value="v.id">{{ v.name }}</option></select></label><div v-if="!voices.length" class="vs-inline-note">Ainda não há uma voz disponível para sua conta. Você pode preparar o roteiro ou criar o vídeo sem locução.</div><button class="vs-button primary" :disabled="!!busy||!doc.offers.length" @click="suggestWithAI"><Sparkles :size="16"/> Gerar novo roteiro com IA</button><button class="vs-button quiet" :disabled="!!busy" @click="suggest"><Sparkles :size="16"/> Usar texto básico das ofertas</button><p v-if="doc.scripts.length" class="vs-hint">O roteiro é gerado automaticamente ao chegar nesta etapa. Uma nova sugestão substitui o texto abaixo.</p>
     <label v-if="doc.scripts.length||doc.narrationText" class="vs-field vs-narration-field">Texto completo da locução<textarea v-model="narrationText" :rows="Math.max(8,doc.offers.length+3)" maxlength="5600" placeholder="Abertura, ofertas e encerramento em um só roteiro"/><small>Uma linha para a abertura, uma para cada produto na ordem do vídeo e uma para o encerramento. Preços, medidas, unidades e datas são preparados por extenso.</small></label>
      <details class="vs-details"><summary>Ajustar a pronúncia de um nome <ChevronDown :size="16"/></summary><p class="vs-hint">Exemplo: nome “I9” → falar “i nove”. O nome escrito no vídeo não muda.</p><div v-for="(p,i) in doc.voice.pronunciations" :key="i" class="vs-pronunciation"><input v-model="p.from" aria-label="Nome escrito" placeholder="Como se escreve" maxlength="80"/><input v-model="p.to" aria-label="Pronúncia desejada" placeholder="Como se fala" maxlength="120"/><button aria-label="Remover pronúncia" @click="doc.voice.pronunciations.splice(i,1)"><X :size="16"/></button></div><button class="vs-button quiet" :disabled="doc.voice.pronunciations.length>=30" @click="doc.voice.pronunciations.push({from:'',to:''})"><Plus :size="15"/> Adicionar pronúncia</button></details>
      <button class="vs-button quiet" :disabled="!!busy||!doc.scripts.length" @click="normalize">Ver como o locutor vai ler</button><div v-if="normalized.length" class="vs-normalized"><p v-for="s in normalized" :key="s.id">{{ s.text }}</p></div>
      <div v-if="scriptChanged" class="vs-inline-note">Confira se o texto corresponde aos produtos, preços e validade atuais.</div><label class="vs-toggle"><span><strong>Ajustar a locução para caber em {{ doc.duration }} segundos</strong><small>Acelera somente quando necessário, até 2×, sem cortar o texto.</small></span><input type="checkbox" :checked="doc.autoFitVoice!==false" @change="doc.autoFitVoice=($event.target as HTMLInputElement).checked"/></label><p v-if="voicePlaybackRate>1" class="vs-hint">{{ voiceJob?'Velocidade aplicada':'Velocidade estimada' }}: {{ voicePlaybackRate.toFixed(2).replace('.',',') }}× · vídeo com até {{ doc.duration }} segundos.</p><button class="vs-button secondary" :disabled="!doc.scripts.length" @click="confirmScript"><Check :size="16"/> Conferi o texto e os preços</button><div class="vs-voice-generation"><button class="vs-button primary" :disabled="!!busy||!!voiceGenerationBlocker" @click="generate('voice')"><Headphones :size="18"/> {{ voiceJob?'Gerar / recuperar locução':'Gerar locução' }}</button><small>Locução ElevenLabs com a voz autorizada e interpretação animada para varejo.</small><div v-if="voiceGenerationBlocker" class="vs-inline-note" role="status">{{ voiceGenerationBlocker }} <button v-if="!workerReady" class="vs-button quiet" :disabled="!!busy" @click="refreshHealth">Atualizar estado</button></div></div>
      <div v-if="voiceJob?.result?.fullVoice" class="vs-clips"><strong>Locução completa</strong><audio controls preload="none" :src="mediaUrl(voiceJob.result.fullVoice.assetId)"/></div><div v-if="voiceJob&&!voiceJob.result.fullVoice" class="vs-clips"><div v-for="(clip,id) in voiceJob.result.clips" :key="id"><strong>{{ String(id)==='intro'?'Abertura':String(id)==='outro'?'Encerramento':doc.offers.find(o=>o.id===String(id))?.name }}</strong><audio controls preload="none" :src="mediaUrl(clip.assetId)"/></div></div>
     </template>

    </div>
    <div v-if="step===4" class="vs-step-content"><span class="vs-eyebrow">05 · QUASE PRONTO</span><h2>Tudo pronto para exportar?</h2><p class="vs-lead">Assista aos formatos escolhidos e confira os preços e a locução.</p><div class="vs-summary"><span><strong>{{ doc.offers.length }}</strong> produtos</span><span><strong>{{ doc.duration }}s</strong> no máximo</span><span><strong>{{ doc.formats.length }}</strong> formatos</span></div>
     <div v-if="issues.length" class="vs-inline-note"><strong>Antes de gerar:</strong><ul><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul></div><div v-if="doc.voice.enabled&&!voiceJob" class="vs-inline-note">Gere a locução dos produtos atuais na etapa 4 antes de exportar.</div><div v-if="!workerReady" class="vs-inline-note">A geração está temporariamente indisponível. Seu projeto pode ser salvo e editado.</div>
     <button class="vs-button primary large" :disabled="!!busy||!workerReady||issues.length>0||(doc.voice.enabled&&(!voiceJob||scriptChanged))||activeJobs.some(j=>j.kind==='render')" @click="generate('render')"><Clapperboard :size="20"/> Renderizar e exportar MP4</button><p class="vs-hint">A geração continua no servidor. Você pode voltar depois para baixar.</p>
     <div v-for="job in activeJobs.filter(j=>j.kind==='render')" :key="job.id" class="vs-render-progress" role="status"><strong>{{ job.status==='queued'?'Seu vídeo está na fila':'Renderizando seu vídeo' }} · {{ job.progress }}%</strong><progress :value="job.progress" max="100"/><p>O download aparecerá aqui quando os formatos estiverem prontos. Você pode sair e voltar.</p></div><div v-if="renderJob" class="vs-results"><h3>Seus vídeos estão prontos</h3><div v-for="out in renderJob.result.outputs" :key="out.assetId"><strong>{{ VIDEO_FORMATS[out.format as VideoFormat].label }} · {{ Number(out.duration).toFixed(1) }} s</strong><video :src="mediaUrl(out.assetId)" controls preload="metadata"/><a class="vs-button secondary" :href="mediaUrl(out.assetId)+'?download=1'" download><Download :size="16"/> Baixar MP4</a></div></div>
    </div>
    <div v-if="!(step===1&&showListImport)" class="vs-form-footer"><button v-if="step>0" class="vs-button quiet" @click="step--"><ArrowLeft :size="16"/> Voltar</button><span v-else/><button v-if="step<4" class="vs-button primary" :disabled="!!busy" @click="next">{{ step===0?'Escolher produtos':step===1?'Personalizar vídeo':step===2?'Preparar locução':'Revisar vídeo' }} <ArrowRight :size="16"/></button><button v-else class="vs-button quiet" :disabled="!!busy||saving||!workerReady||issues.length>0||(doc.voice.enabled&&(!voiceJob||scriptChanged))||activeJobs.some(j=>j.kind==='render')" @click="generate('render')"><Save :size="16"/> Salvar e renderizar</button></div>
   </section>
   <aside class="vs-preview-panel" :class="{'is-layout-editing':editingLayout}"><section v-if="trackedJob && trackedJob.status!=='ready'" class="vs-live-status" :class="{'is-complete':trackedJob.status==='ready'}" role="status" aria-live="polite"><div><LoaderCircle v-if="['queued','running'].includes(trackedJob.status)" :size="20" class="vs-spin"/><Check v-else-if="trackedJob.status==='ready'" :size="20"/><strong>{{ trackedJob.kind==='voice'?'Locução':trackedJob.kind==='music'?'Música':'Vídeo' }}</strong><small>{{ liveJobs?'Acompanhamento ao vivo':'Reconectando acompanhamento…' }}</small></div><p>{{ jobDescription(trackedJob) }}</p><progress v-if="trackedJob.kind==='render'&&trackedJob.status==='running'" :value="trackedJob.progress" max="100"/><progress v-else-if="trackedJob.kind==='voice'&&trackedJob.status==='running'" :value="trackedJob.completed_clips" :max="trackedJob.total_clips||1"/></section><div class="vs-preview-heading"><span><span class="vs-live-dot"/> SUA PRÉVIA</span><button v-if="flyerRecipe(doc.theme)" class="vs-button secondary vs-preview-edit" @click="editingLayout=!editingLayout">{{ editingLayout?'Voltar à reprodução':'Editar posições' }}</button><div class="vs-format-switch"><button v-for="format in doc.formats" :key="format" :class="{active:previewFormat===format}" :aria-label="VIDEO_FORMATS[format].label" @click="previewFormat=format"><Smartphone v-if="format==='vertical'" :size="17"/><Monitor v-else :size="17"/></button></div></div><div v-if="flyerRecipe(doc.theme)&&editingLayout" class="vs-layout-tools"><template v-if="editingLayout"><p class="vs-hint">Arraste os elementos na prévia. As mudanças valem para esta cena e este formato.</p><label class="vs-field">Cena<select v-model="editScene"><option value="intro">Abertura</option><option v-for="(offer,i) in doc.offers" :key="offer.id" :value="offer.id">{{ i+1 }} · {{ offer.name||'Produto' }}</option><option value="outro">Encerramento</option></select></label><label v-if="editOffer" class="vs-field">Quantidade de imagens<select v-model="editOffer.copies" @change="previewOffer(editOffer.id)"><option :value="undefined">Automático</option><option :value="1">Uma imagem</option><option :value="2">Duas imagens</option><option :value="3">Três imagens</option></select></label><label class="vs-field">Elemento<select v-model="editElement"><option v-for="id in editElements" :key="id" :value="id">{{ elementNames[id] }}</option></select></label><div class="vs-two"><label class="vs-field">Posição horizontal<input type="number" :value="selectedTransform.x" min="-4000" max="4000" @input="changeTransform('x',$event)"/></label><label class="vs-field">Posição vertical<input type="number" :value="selectedTransform.y" min="-4000" max="4000" @input="changeTransform('y',$event)"/></label></div><label class="vs-field">Tamanho · {{ Math.round(selectedTransform.scale*100) }}%<input type="range" min="0.1" max="4" step="0.02" :value="selectedTransform.scale" @input="changeTransform('scale',$event)"/></label><label class="vs-field">Inclinação<input type="range" min="-180" max="180" step="1" :value="selectedTransform.rotation" @input="changeTransform('rotation',$event)"/></label><div class="vs-inline-actions"><button class="vs-button quiet" @click="updateTransform(editElement,{...selectedTransform,hidden:!selectedTransform.hidden})">{{ selectedTransform.hidden?'Mostrar elemento':'Ocultar elemento' }}</button><button class="vs-button quiet" @click="updateTransform(editElement,defaultTransform())">Restaurar elemento</button><button class="vs-button quiet" @click="resetScene">Restaurar montagem</button></div></template></div><div class="vs-preview-viewport"><div class="vs-preview-stage" :class="previewFormat"><ClientOnly><NuxtErrorBoundary @error="previewError='Não foi possível carregar a prévia. Salve e reabra o projeto.'"><LazyVideoStudioPreview :composition="composition" :editing-frame="editFrame" :preview-request="previewRequest"/><template #error><p role="alert">{{ previewError }}</p></template></NuxtErrorBoundary><template #fallback><div class="vs-mini-empty">Preparando prévia…</div></template></ClientOnly></div></div><p class="vs-preview-caption">{{ VIDEO_FORMATS[previewFormat].label }} · {{ voiceJob||!doc.voice.enabled?'Duração':'Tempo estimado' }}: {{ estimated }} s</p><p v-if="doc.voice.enabled&&!voiceJob" class="vs-hint center">A voz aparece na prévia depois de gerar a locução.</p>

    <details v-if="jobs.length" class="vs-job-list"><summary>Histórico de gerações</summary><h3>Gerações deste projeto</h3><div v-for="j in jobs.slice(0,8)" :key="j.id" class="vs-job"><div><strong>{{ j.kind==='voice'?'Locução':j.kind==='music'?'Música':'Vídeo' }}</strong><span>{{ j.status==='queued'?'Na fila':j.status==='running'?'Gerando…':j.status==='ready'?'Concluído':'Precisa de atenção' }}</span></div><progress v-if="['queued','running'].includes(j.status)" :value="j.progress" max="100"/><p v-if="j.error" role="alert">{{ j.error }}</p><button v-if="j.kind==='music'&&j.status==='ready'" class="vs-button quiet" @click="selectMusic(j.result.assetId)">Usar esta música</button><div v-if="j.kind==='render'&&j.status==='ready'"><a v-for="o in j.result.outputs" :key="o.assetId" :href="mediaUrl(o.assetId)+'?download=1'" download class="vs-download">Baixar {{ VIDEO_FORMATS[o.format as VideoFormat].label }}</a><small v-if="j.revision!==revision">Gerado de uma versão anterior.</small></div></div></details>
   </aside></div>
  </main>
  <div v-if="showModelPreview" class="vs-modal-backdrop" @click.self="!busy&&(showModelPreview=false)"><section class="vs-model-modal" role="dialog" aria-modal="true" aria-label="Prévia do modelo com sua marca"><header><div><span class="vs-eyebrow">PRÉVIA DO MODELO</span><h2>{{ theme.name }}</h2></div><button class="vs-button quiet" :disabled="!!busy" aria-label="Fechar prévia" @click="showModelPreview=false"><X :size="20"/></button></header><div class="vs-model-modal-body"><div class="vs-model-preview" :class="previewFormat"><ClientOnly><LazyVideoStudioPreview :composition="composition" :editing-frame="40"/></ClientOnly></div><div class="vs-model-description"><span class="vs-eyebrow">SUA MARCA, SEU VÍDEO</span><h3>O próximo vídeo é da sua loja.</h3><p>Veja como o modelo fica com a sua marca. Depois, adicione as ofertas e personalize como preferir.</p><p v-if="doc.offers.length" class="vs-inline-note">Produtos e preços ilustrativos. Adicione sua lista na próxima etapa.</p><div class="vs-format-switch"><button v-for="(format,key) in VIDEO_FORMATS" :key="key" :class="{active:previewFormat===key}" @click="previewFormat=key">{{ format.label }}</button></div><ol><li>Confira a marca e o formato</li><li>Envie os produtos e encontre as fotos</li><li>Personalize fundo, música e efeitos</li><li>Prepare o roteiro e a locução</li><li>Revise e exporte o vídeo</li></ol><button class="vs-button primary large" :disabled="!!busy" @click="useSelectedTemplate"><Copy :size="18"/> Usar modelo</button><small>Continue para adicionar suas ofertas.</small></div></div></section></div>
  <div v-if="busy" class="vs-busy" role="status"><LoaderCircle :size="17" class="vs-spin"/> {{ busy }}…</div>
  <div v-if="showImport" class="vs-modal-backdrop" @click.self="showImport=false"><section class="vs-modal" role="dialog" aria-modal="true" aria-label="Importar ofertas de um encarte"><div class="vs-section-heading"><h2>Trazer ofertas do encarte</h2><button aria-label="Fechar importação" @click="showImport=false"><X/></button></div><p>O encarte original permanece igual. Escolha até {{ 6-doc.offers.length }} produtos.</p><label class="vs-field">Encarte<select v-model="sourceId" @change="chooseSource"><option value="">Escolha um encarte</option><option v-for="s in sources" :key="s.id" :value="s.id">{{ s.name }}</option></select></label><div class="vs-import-list"><label v-for="o in sourceOffers" :key="o.index"><input v-model="selectedOffers" type="checkbox" :value="o.index" :disabled="o.complex||(!selectedOffers.includes(o.index)&&selectedOffers.length>=6-doc.offers.length)"/><span><strong>{{ o.name }}</strong><small>R$ {{ o.price }} {{ o.unit }} {{ o.complex?'· Múltiplos preços: cadastrar manualmente':'' }}</small></span></label></div><button class="vs-button primary" :disabled="!!busy||!selectedOffers.length" @click="importOffers">Importar {{ selectedOffers.length }} produtos <ArrowRight :size="16"/></button></section></div>
 </div></component>
</template>

<style scoped>
.vs-render-progress{display:grid;gap:12px;padding:20px;margin-top:20px;border-radius:12px;background:#e6f3e9}.vs-render-progress progress{width:100%;accent-color:#216748}.vs-layout-tools{padding:14px 0;display:grid;gap:10px}
.vs-app{--ink:#18272b;--muted:#697a7c;--line:#dfe7e5;--green:#126557;--mint:#dceee6;min-height:100vh;background:#f4f6f3;color:var(--ink);font-family:'Barlow',system-ui,sans-serif;font-size:15px}.vs-app *{box-sizing:border-box}.vs-app button,.vs-app a,.vs-app input,.vs-app select,.vs-app textarea{outline-offset:4px}.vs-app button{cursor:pointer}.vs-app button:disabled{opacity:.45;cursor:not-allowed}.vs-app h1,.vs-app h2,.vs-app h3,.vs-app p{margin:0}.vs-app h2{font-size:29px;line-height:1.15;letter-spacing:-.7px;font-weight:700}.vs-app h3{font-size:19px;font-weight:700}.vs-header{height:86px;padding:0 5%;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid var(--line)}.vs-brand{display:flex;align-items:center;gap:12px;color:var(--ink);text-decoration:none;font-size:22px;font-weight:700;line-height:1}.vs-brand small{display:block;font-size:10px;letter-spacing:2px;margin-top:7px;font-weight:600}.vs-brand-icon{width:43px;height:43px;display:grid;place-items:center;background:var(--green);color:#fff;border-radius:13px}.vs-header-actions{display:flex;gap:22px;align-items:center}.vs-save-status{font-size:12px;color:var(--muted)}.vs-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid transparent;border-radius:11px;min-height:43px;padding:11px 17px;font:600 14px 'Barlow',sans-serif;text-decoration:none;transition:background .18s,transform .18s}.vs-button:not(:disabled):hover{transform:translateY(-1px)}.vs-button.primary{background:var(--green);color:#fff;box-shadow:0 4px 10px #12655715}.vs-button.primary:hover{background:#0c5146}.vs-button.secondary{border-color:#cbd9d3;background:#f4f8f5;color:var(--green)}.vs-button.quiet{color:#4b6260;background:transparent}.vs-button.quiet:hover{background:#e7eeea}.vs-button.large{padding:15px 24px;min-height:52px;font-size:16px}.vs-library{max-width:1360px;margin:auto;padding:44px 5% 80px}.vs-hero{border-radius:26px;background:#e5eee5;display:grid;grid-template-columns:1.2fr 1fr;padding:55px;gap:40px;overflow:hidden;margin-bottom:55px;border:1px solid #d6e2d7}.vs-eyebrow{font-size:11px;letter-spacing:2px;font-weight:700;color:var(--green);display:block;margin-bottom:14px}.vs-hero h1{font-size:clamp(38px,4.4vw,64px);line-height:1.04;letter-spacing:-2px;font-weight:700}.vs-hero p{font-size:17px;line-height:1.6;color:#526963;max-width:440px;margin:22px 0}.vs-hero-tags{display:flex;flex-wrap:wrap;gap:18px;margin-top:25px;font-size:12px;color:#526963}.vs-hero-tags span{display:flex;gap:5px;align-items:center}.vs-hero-art{position:relative;display:grid;place-items:center;min-height:340px}.vs-art-orbit{position:absolute;border:1px solid #b0c7b5;border-radius:50%;width:390px;height:390px}.vs-art-orbit.two{width:300px;height:300px}.vs-art-card{transform:rotate(7deg);width:240px;height:320px;background:radial-gradient(ellipse at 60% 25%,#7f3334,#230d19 70%);box-shadow:10px 20px 40px #22352230;border:5px solid #fff;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffdd75;gap:22px}.vs-art-card>span:first-child{font-size:12px;letter-spacing:3px}.vs-art-card strong{font-family:'Barlow Condensed',sans-serif;font-size:68px;line-height:.88;text-align:center;font-weight:800;text-shadow:0 4px #a46636}.vs-art-pill{font-size:10px;display:flex;gap:6px;align-items:center;border:1px solid #af785f;padding:9px 12px;border-radius:24px}.vs-floating-tag{position:absolute;bottom:12px;left:15px;background:white;padding:13px 21px;border-radius:10px;box-shadow:0 8px 20px #1c392b14;font-weight:600;transform:rotate(-4deg)}.vs-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.vs-section-heading p{color:var(--muted);margin-top:8px}.vs-section-heading>span{color:var(--muted);font-size:13px}.vs-empty{border:1px dashed #c6d5cb;border-radius:20px;padding:50px 24px;display:flex;align-items:center;flex-direction:column;gap:14px;background:#ffffff77;text-align:center;color:var(--muted)}.vs-project-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.vs-project-card{text-align:left;background:white;border:1px solid var(--line);border-radius:17px;overflow:hidden}.vs-project-card:hover{box-shadow:0 10px 26px #243a3014}.vs-project-cover{aspect-ratio:1.6;background:radial-gradient(ellipse at 40% 10%,#ffffff22,transparent),var(--base);color:var(--accent);padding:24px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;position:relative}.vs-project-cover>span{font-size:12px;color:#ffffffbb}.vs-project-cover strong{font:800 32px/.95 'Barlow Condensed',sans-serif;max-width:75%}.vs-cover-play{position:absolute;right:20px;bottom:20px;padding:10px;background:#ffffff1a;border-radius:50%}.vs-project-info{padding:20px}.vs-project-info span{display:block;color:var(--muted);font-size:13px;margin-top:6px}.vs-message{max-width:1240px;margin:15px auto 0;padding:14px 22px;border:1px solid #b7d9c8;background:#e9f6ec;border-radius:12px;display:flex;justify-content:space-between;gap:20px}.vs-message.error{background:#fff1eb;border-color:#e9c5b5;color:#94391e}.vs-editor{max-width:1400px;padding:32px 4% 65px;margin:auto}.vs-editor-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:25px}.vs-title-container{width:100%;min-width:0}.vs-title-field{display:grid;min-width:0}.vs-title-input{grid-area:1/1;font-size:28px;font-weight:700;line-height:1.3;background:transparent;border:0;border-bottom:1px solid transparent;width:100%;min-width:0;color:var(--ink);padding:0 0 4px;white-space:pre-wrap;overflow-wrap:anywhere;resize:none;overflow:hidden}.vs-title-mirror{visibility:hidden;pointer-events:none}.vs-title-input:hover,.vs-title-input:focus{border-bottom-color:#adbbb3}.vs-steps{display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:25px;border:1px solid var(--line);border-radius:14px;background:white;padding:7px}.vs-steps button{padding:12px;display:flex;align-items:center;justify-content:center;gap:11px;color:var(--muted);border-radius:9px;font-size:14px;font-weight:600}.vs-steps button>span{border-radius:50%;border:1px solid #cfd9d2;height:26px;width:26px;display:grid;place-items:center;font-size:12px}.vs-steps button.active{background:#e8f1eb;color:var(--green)}.vs-steps button.active>span,.vs-steps button.complete>span{background:var(--green);color:white;border-color:var(--green)}.vs-workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,1fr);gap:30px;align-items:start}.vs-form-panel{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}.vs-step-content{padding:34px}.vs-lead{color:var(--muted);font-size:15px;line-height:1.55;margin:12px 0 25px!important}.vs-theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.vs-theme{position:relative;border-radius:13px;overflow:hidden;border:2px solid #e6ebe7;text-align:left;background:#fff}.vs-theme.selected{border-color:var(--green)}.vs-theme-sample{display:flex;align-items:center;justify-content:center;height:110px;text-align:center;padding:15px;background:radial-gradient(ellipse at 60% 0%,#ffffff22,transparent),var(--base);color:var(--accent);font:800 32px/.93 'Barlow Condensed',sans-serif;text-shadow:0 2px 0 #0005}.vs-theme-badge{height:95px;width:100%;object-fit:contain}.vs-theme-caption{display:flex;flex-direction:column;gap:5px;padding:13px}.vs-theme-caption small{font-size:12px;line-height:1.4;color:var(--muted)}.vs-theme-check{position:absolute;right:10px;top:10px;background:#fff;border-radius:50%;padding:2px;color:var(--green)}.vs-field{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600;margin:17px 0;color:#344e48}.vs-field input:not([type=range]),.vs-field select,.vs-field textarea,.vs-pronunciation input{border:1px solid #d8e0dc;border-radius:9px;background:#fcfdfb;min-height:44px;padding:11px 13px;color:var(--ink);font-size:15px;font-weight:400;width:100%;font-family:inherit}.vs-field textarea{line-height:1.5;resize:vertical}.vs-field input:focus,.vs-field select:focus,.vs-field textarea:focus{border-color:var(--green);box-shadow:0 0 0 3px #12655710}.vs-field small,.vs-hint{font-size:12px;color:var(--muted);font-weight:400;line-height:1.5}.vs-hint{margin-top:9px!important}.vs-field input[type=range]{accent-color:var(--green);width:100%}.vs-divider{height:1px;background:#e7ede8;margin:28px 0}.vs-choice-row{display:flex;gap:12px;margin:15px 0}.vs-choice{flex:1;border:1px solid var(--line);padding:18px;border-radius:12px;display:flex;flex-direction:column;gap:7px;align-items:flex-start}.vs-choice.selected{border-color:var(--green);background:#eff6f1;color:var(--green)}.vs-choice small{color:var(--muted)}.vs-brand-fields{display:grid;grid-template-columns:100px 1fr;gap:20px;align-items:center;margin-top:20px}.vs-logo-upload,.vs-product-upload{position:relative;border:1px dashed #bccfc3;background:#f2f6ef;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;cursor:pointer;color:var(--green);overflow:hidden;min-height:110px}.vs-logo-upload img{max-height:65px;max-width:80px;object-fit:contain}.vs-logo-upload span,.vs-product-upload span{font-size:11px}.vs-logo-upload input,.vs-product-upload input,.vs-upload-inline input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.vs-details{margin:18px 0;border-top:1px solid var(--line);padding-top:15px}.vs-details summary,.vs-effects summary{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;list-style:none}.vs-details summary svg:last-child,.vs-effects summary svg:last-child{margin-left:auto}.vs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vs-two .vs-field{margin:8px 0}.vs-inline-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}.vs-mini-empty{padding:35px 20px;text-align:center;color:var(--muted);font-size:14px;background:#f4f7f2;border-radius:12px;margin:15px 0}.vs-offer{border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:15px}.vs-offer-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted)}.vs-offer-top>div{display:flex;gap:8px}.vs-offer-top button{padding:5px;border-radius:6px}.vs-offer-top button:hover{background:#eef2ec}.vs-offer-body{display:grid;grid-template-columns:105px 1fr;gap:18px;align-items:center}.vs-product-upload{height:130px}.vs-product-upload img{max-width:95px;max-height:93px;object-fit:contain}.vs-toggle{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f4f7f3;border-radius:12px;padding:18px;margin:18px 0}.vs-toggle span{display:flex;flex-direction:column;gap:5px}.vs-toggle small{color:var(--muted);font-size:12px}.vs-toggle input{width:20px;height:20px;accent-color:var(--green)}.vs-inline-note{background:#fff8e9;border:1px solid #eadbb6;border-radius:11px;padding:14px 17px;font-size:13px;line-height:1.5;margin:18px 0;color:#765c20}.vs-inline-note ul{margin:8px 0 0;padding-left:18px}.vs-script{margin-top:18px}.vs-script textarea{background:#fcfdfb}.vs-pronunciation{display:flex;gap:8px;margin:12px 0}.vs-pronunciation input{min-width:0;font-size:13px}.vs-normalized{background:#f0f5ee;border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.5}.vs-voice-generation{display:flex;flex-direction:column;gap:10px;align-items:flex-start;margin-top:20px}.vs-voice-generation small{font-size:11px;color:var(--muted)}.vs-clips{display:flex;flex-direction:column;gap:15px;margin:20px 0}.vs-clips strong{font-size:13px;display:block;margin-bottom:7px}.vs-clips audio,.vs-audio{width:100%;height:40px}.vs-upload-inline{position:relative}.vs-summary{display:flex;background:#eff5ef;border-radius:13px;padding:20px;gap:26px;margin:20px 0}.vs-summary span{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}.vs-summary strong{font-size:26px;color:var(--green)}.vs-form-footer{padding:21px 32px;background:#fafcf9;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px}.vs-preview-panel{position:sticky;top:25px;border:1px solid var(--line);border-radius:20px;padding:23px;background:#edf1eb}.vs-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}.vs-preview-heading>span{font-size:10px;letter-spacing:2px;font-weight:700;display:flex;align-items:center;gap:7px}.vs-live-dot{width:6px;height:6px;background:var(--green);border-radius:50%}.vs-format-switch{display:flex;gap:4px;padding:4px;background:#e0e7df;border-radius:8px}.vs-format-switch button{padding:7px;border-radius:6px;color:#657971}.vs-format-switch button.active{background:#fff;color:var(--green);box-shadow:0 2px 4px #0001}.vs-preview-stage{margin:auto;filter:drop-shadow(0 12px 18px #20342515)}.vs-preview-stage.vertical{max-width:270px}.vs-preview-stage.horizontal{width:100%;padding:50px 0}.vs-preview-caption{text-align:center;color:#65776e;font-size:12px;margin-top:16px!important}.center{text-align:center}.vs-effects{border-top:1px solid #d1dbd0;margin-top:20px;padding-top:18px}.vs-effect-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 8px;margin:17px 0}.vs-effect-grid label{display:flex;gap:7px;align-items:center;font-size:12px}.vs-effect-grid input{accent-color:var(--green)}.vs-job-list{margin-top:24px;border-top:1px solid #d1dbd0;padding-top:20px}.vs-job-list h3{font-size:14px}.vs-job{padding:14px 0;border-bottom:1px solid #d6dfd5;font-size:12px}.vs-job>div:first-child{display:flex;justify-content:space-between;gap:12px}.vs-job p{margin-top:8px;color:#9b412d;line-height:1.4}.vs-job progress{width:100%;height:6px;accent-color:var(--green);margin-top:12px}.vs-job small{display:block;color:var(--muted)}.vs-download{display:block;color:var(--green);text-decoration:underline;margin-top:8px}.vs-results{margin:25px 0;display:flex;flex-direction:column;gap:18px}.vs-results>div{display:flex;flex-direction:column;gap:12px}.vs-results video{max-height:400px;max-width:100%;background:#111;border-radius:12px}.vs-busy{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#173e33;color:#fff;padding:13px 22px;border-radius:40px;box-shadow:0 10px 30px #0002;z-index:50;font-size:14px}.vs-spin{animation:vs-spin 1s linear infinite}@keyframes vs-spin{to{transform:rotate(360deg)}}.vs-modal-backdrop{position:fixed;inset:0;background:#0b1d1880;backdrop-filter:blur(4px);z-index:60;display:grid;place-items:center;padding:20px}.vs-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:30px}.vs-import-list{margin:20px 0;max-height:320px;overflow:auto}.vs-import-list label{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:13px 0}.vs-import-list span{display:flex;flex-direction:column;gap:5px}.vs-import-list small{color:var(--muted)}.vs-import-list input{accent-color:var(--green)}
@media(min-width:1500px){.vs-preview-stage.vertical{max-width:300px}}@media(max-width:1000px){.vs-workspace{grid-template-columns:minmax(0,1.35fr) minmax(280px,1fr);gap:18px}.vs-step-content{padding:25px}.vs-preview-panel{padding:18px}.vs-hero{padding:35px}.vs-hero-art{min-height:320px}.vs-art-card{width:205px;height:290px}.vs-project-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.vs-header{height:72px;padding:0 18px}.vs-brand{font-size:19px}.vs-brand small{font-size:8px}.vs-header-actions{gap:6px}.vs-save-status{display:none}.vs-header-actions .vs-button{font-size:12px;padding:9px}.vs-library{padding:25px 18px}.vs-hero{grid-template-columns:1fr;padding:30px;gap:15px}.vs-hero h1{font-size:45px}.vs-hero-art{min-height:250px}.vs-art-card{width:170px;height:225px;border-radius:19px}.vs-art-card strong{font-size:48px}.vs-art-orbit{width:250px;height:250px}.vs-art-orbit.two{width:200px;height:200px}.vs-hero-tags{gap:12px}.vs-editor{padding:22px 14px}.vs-title-input{font-size:23px}.vs-steps{gap:0;padding:5px}.vs-steps button{flex-direction:column;font-size:10px;gap:6px;padding:9px 3px;line-height:1.2}.vs-workspace{display:flex;flex-direction:column}.vs-form-panel{width:100%}.vs-preview-panel{position:static;width:100%;padding:24px}.vs-preview-stage.vertical{max-width:260px}.vs-step-content{padding:23px}.vs-theme-sample{font-size:28px;height:95px}.vs-theme-badge{height:95px;width:100%;object-fit:contain}.vs-theme-caption{padding:10px}.vs-theme-caption small{font-size:11px}.vs-offer{padding:13px}.vs-offer-body{grid-template-columns:80px 1fr;gap:12px}.vs-product-upload{height:110px}.vs-product-upload img{max-width:72px;max-height:75px}.vs-product-upload span{font-size:9px}.vs-form-footer{padding:18px}.vs-project-grid{grid-template-columns:1fr 1fr;gap:12px}.vs-project-cover{padding:16px}.vs-project-cover strong{font-size:24px}.vs-project-info{padding:14px}.vs-project-info h3{font-size:16px}.vs-message{margin:12px;font-size:13px}.vs-busy{max-width:94%;width:max-content;font-size:12px}.vs-modal{padding:23px}.vs-brand-fields{grid-template-columns:80px 1fr;gap:14px}}@media(prefers-reduced-motion:reduce){.vs-button{transition:none}.vs-spin{animation:none}}
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


.vs-editing .vs-preview-panel{display:flex;flex-direction:column;overflow:hidden;gap:8px}
.vs-live-status{flex:none;padding:14px 16px;background:#fff;border:1px solid #dcd9ef;border-radius:12px;color:#253f60}
.vs-live-status>div{display:flex;align-items:center;gap:9px}.vs-live-status small{margin-left:auto;color:#697895;font-size:11px}.vs-live-status p{font-size:13px;margin-top:8px}.vs-live-status progress{width:100%;height:5px;accent-color:#655bac;margin-top:10px}
.vs-editing .vs-preview-stage.vertical{min-width:0;width:min(100%,300px,calc((100dvh - 460px)*.5625));margin:auto}
.vs-editing .vs-preview-stage.horizontal{width:min(100%,calc((100dvh - 460px)*1.777));padding:0;margin:auto}
.vs-editing .vs-preview-heading,.vs-editing .vs-layout-tools,.vs-editing .vs-preview-caption,.vs-editing .vs-preview-panel>.vs-hint{flex:none;margin:0!important}
.vs-editing .vs-job-list{flex:none;margin-top:4px;padding-top:8px;font-size:12px}.vs-editing .vs-job-list[open]{max-height:160px;overflow:auto}.vs-job-list summary{cursor:pointer;color:#60758f}
.vs-editing .vs-preview-panel.is-layout-editing{overflow-y:auto}
@media(max-width:760px){.vs-live-status{position:sticky;top:0;z-index:2}.vs-editing .vs-preview-stage.vertical{width:200px}}
</style>

<style scoped>
.vs-validity-card{margin-top:22px;padding:19px;border:1px solid #d9e3f1;border-radius:18px;background:linear-gradient(150deg,#fff 0%,#f8faff 100%);box-shadow:0 9px 28px #2441680d}
.vs-validity-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}
.vs-validity-icon{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#ebe9fa;color:#5f54a7;font-size:26px;line-height:1}
.vs-validity-kicker{display:block;color:#6559ac;font-size:9px;font-weight:800;letter-spacing:.12em;margin-bottom:5px}
.vs-validity-heading h3{margin:0!important;color:#253b5c;font-size:17px!important;line-height:1.25}
.vs-validity-heading p{margin:5px 0 0;color:#647791;font-size:11px;line-height:1.5}
.vs-validity-options{display:grid;gap:8px}
.vs-validity-option{display:flex;align-items:center;gap:11px;width:100%;min-height:61px;padding:9px 12px;border:1px solid #dce5f0;border-radius:11px;background:#fff;color:#304563;text-align:left;transition:border-color .18s,background .18s,transform .18s,box-shadow .18s}
.vs-validity-option:hover{border-color:#9488d0;transform:translateY(-1px)}
.vs-validity-option.is-selected{border-color:#6d60bb;background:#f4f1ff;box-shadow:0 0 0 1px #6d60bb}
.vs-validity-option-symbol{flex:none;display:grid;place-items:center;width:35px;height:35px;border-radius:9px;background:#f0f2f8;color:#6559ac;font-size:16px;font-weight:800}
.vs-validity-option.is-selected .vs-validity-option-symbol{background:#ded8fa}
.vs-validity-option-copy{display:grid;gap:3px;min-width:0;flex:1}
.vs-validity-option-copy strong{font-size:12px;line-height:1.2}
.vs-validity-option-copy small{color:#6b7b94;font-size:10px;line-height:1.3}
.vs-validity-radio{flex:none;width:16px;height:16px;border:2px solid #b9c6d8;border-radius:50%;background:#fff}
.vs-validity-option.is-selected .vs-validity-radio{border:5px solid #685bb3}
.vs-validity-fields{padding-top:13px}
.vs-validity-fields .vs-field{margin:5px 0 12px}
.vs-validity-date-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.vs-validity-date-grid .vs-field{min-width:0}
.vs-validity-date-grid input{min-width:0}
.vs-validity-format{min-width:0;margin:6px 0 0;padding:0;border:0}
.vs-validity-format legend{padding:0 0 8px;color:#314866;font-size:11px;font-weight:750}
.vs-validity-format legend span{margin-left:6px;color:#6559ac;font-size:9px;text-transform:uppercase;letter-spacing:.05em}
.vs-validity-format-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.vs-validity-format-options button{display:grid;align-content:center;gap:4px;min-height:56px;min-width:0;padding:8px 10px;border:1px solid #dce5f0;border-radius:10px;background:#fff;color:#304563;text-align:left}
.vs-validity-format-options button.is-selected{border-color:#6d60bb;background:#f4f1ff;box-shadow:0 0 0 1px #6d60bb}
.vs-validity-format-options strong{font-size:11px;line-height:1.25;overflow-wrap:anywhere}
.vs-validity-format-options small{color:#6b7b94;font-size:10px}
.vs-validity-preview{display:grid;gap:5px;margin-top:15px;padding:12px 14px;border:1px solid #cfdced;border-radius:11px;background:#eef4fb;color:#294264}
.vs-validity-preview.is-empty{border-style:dashed;background:#f6f8fc}
.vs-validity-preview span{font-size:9px;font-weight:800;letter-spacing:.1em;color:#617698}
.vs-validity-preview strong{font-size:12px;line-height:1.45;font-weight:650;overflow-wrap:anywhere}
.vs-validity-legacy{padding:10px 12px;margin:12px 0 0;color:#6b587f;background:#f7f2fb;border-radius:9px;font-size:11px;line-height:1.5}
.vs-validity-card button:focus-visible{outline:3px solid #9285d0;outline-offset:2px}
@media(max-width:430px){.vs-validity-card{padding:15px}.vs-validity-date-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.vs-validity-option{transition:none}}
</style>

<style scoped>
.vs-in-shell{min-height:100%;background:transparent}.vs-in-shell .vs-library,.vs-in-shell .vs-editor{width:100%;padding:28px}.vs-shell-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 28px;border-bottom:1px solid #dce1eb}.vs-in-shell .vs-workspace{grid-template-columns:minmax(0,1.3fr) minmax(280px,.85fr);gap:20px}.vs-in-shell .vs-step-content{padding:25px}.vs-library-tabs{display:flex;gap:8px;border-bottom:1px solid #dddfea;margin-bottom:30px;padding-bottom:12px}.vs-library-tabs button{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:12px;font-weight:650;color:#64748b}.vs-library-tabs button.active{background:#5f5aa7;color:white}.vs-library-tabs span{font-size:12px;background:#ffffff25;border-radius:20px;padding:3px 8px}.vs-catalog>.vs-button{margin-top:24px}.vs-model-art{height:240px;background-color:var(--base);background-size:cover;background-position:center;position:relative;display:grid;place-items:center;overflow:hidden;padding:24px}.vs-model-art>img{width:90%;height:170px;object-fit:contain;filter:drop-shadow(0 8px 18px #0004)}.vs-model-art>strong{font-size:32px;color:var(--accent);max-width:80%;text-align:center;line-height:1}.vs-model-play{position:absolute;bottom:14px;right:14px;display:flex;gap:8px;align-items:center;border-radius:25px;background:#17142edb;color:#fff;padding:9px 14px;font-size:12px}.vs-model-modal{width:min(1120px,100%);max-height:94dvh;overflow:auto;background:#f7f8fc;color:#233554;border-radius:24px;padding:28px}.vs-model-modal>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.vs-model-modal h2{font-size:25px;font-weight:700}.vs-model-modal-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,1fr);gap:32px;align-items:center}.vs-model-preview{background:#e8e9f2;border-radius:18px;padding:18px}.vs-model-preview.vertical{width:min(320px,100%);margin:auto}.vs-model-description{display:grid;gap:18px;line-height:1.6}.vs-model-description h3{font-size:30px;line-height:1.15;font-weight:700}.vs-model-description p,.vs-model-description li{font-size:14px;color:#60718a}.vs-model-description ol{list-style:decimal;padding-left:22px}.vs-model-description li{padding:5px 0}.vs-model-description small{font-size:12px;color:#60718a}.vs-model-modal .vs-format-switch button{font-size:13px;padding:10px}.vs-app button:focus-visible,.vs-app a:focus-visible{outline:3px solid #9186dd;outline-offset:3px}.vs-render-progress{margin-top:24px;padding:20px;background:#eeedf7;border-radius:14px}.vs-render-progress progress{width:100%;accent-color:#5f5aa7}.vs-render-progress p{font-size:13px;margin-top:10px}.vs-steps button:disabled{opacity:.55}
@media(max-width:760px){.vs-model-modal{padding:18px}.vs-model-modal-body{grid-template-columns:1fr;gap:20px}.vs-model-preview.vertical{max-width:220px}.vs-model-description h3{font-size:24px}.vs-model-art{height:180px;padding:12px}.vs-model-art>img{height:135px}.vs-model-art>strong{font-size:24px}.vs-catalog .vs-section-heading{display:block}.vs-library-tabs button{padding:10px 12px;font-size:13px}}


/* Biblioteca dentro do painel admin: mesma superficie, navegacao e tokens do shell. */
.vs-in-shell {
  --vs-admin-navy: var(--jv-navy, #173d70);
  --vs-admin-blue: var(--jv-blue, #2160b4);
  --vs-admin-sky: var(--jv-sky, #eaf3ff);
  --vs-admin-ink: var(--jv-ink, #172b45);
  --vs-admin-muted: var(--jv-muted, #60758f);
  --vs-admin-line: var(--jv-line, #d7e4f1);
  color: var(--vs-admin-ink);
}

.vs-in-shell .vs-library {
  width: 100%;
  max-width: 1540px;
  margin: 0 auto;
  padding: 30px 32px 74px;
}

.vs-in-shell .vs-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, .92fr);
  min-height: 342px;
  margin-bottom: 28px;
  padding: 36px 42px;
  border: 1px solid var(--vs-admin-line);
  border-radius: 22px;
  background:
    radial-gradient(circle at 88% 16%, rgba(72, 157, 128, .12), transparent 18rem),
    linear-gradient(135deg, #fff 0%, #f7fbff 62%, #eef6ff 100%);
  box-shadow: 0 18px 48px rgba(26, 68, 113, .08);
}

.vs-in-shell .vs-hero-copy {
  position: relative;
  z-index: 2;
  align-self: center;
  max-width: 620px;
}

.vs-in-shell .vs-eyebrow { color: var(--vs-admin-blue); }

.vs-in-shell .vs-hero h1 {
  color: var(--vs-admin-navy);
  font-size: clamp(36px, 3.6vw, 54px);
  letter-spacing: -.06em;
}

.vs-in-shell .vs-hero h1 span { color: var(--vs-admin-blue); }

.vs-in-shell .vs-hero p {
  max-width: 560px;
  color: var(--vs-admin-muted);
  font-size: 14px;
  line-height: 1.72;
}

.vs-in-shell .vs-hero-actions {
  align-items: center;
  gap: 14px;
  margin-top: 24px;
}

.vs-in-shell .vs-button.primary {
  background: var(--vs-admin-blue);
  box-shadow: 0 9px 20px rgba(33, 96, 180, .2);
}

.vs-in-shell .vs-button.primary:hover { background: #1b4f96; }

.vs-in-shell .vs-button.secondary {
  color: var(--vs-admin-blue);
  border-color: #c5daf3;
  background: #f7fbff;
}

.vs-in-shell .vs-button.quiet { color: var(--vs-admin-muted); }
.vs-in-shell .vs-button.quiet:hover { color: var(--vs-admin-blue); background: var(--vs-admin-sky); }

.vs-in-shell .vs-hero-assurance,
.vs-in-shell .vs-hero-tags { color: var(--vs-admin-muted); }

.vs-in-shell .vs-hero-assurance svg,
.vs-in-shell .vs-hero-tags svg { color: #2d8a69; }

.vs-in-shell .vs-hero-tags span {
  border-color: var(--vs-admin-line);
  background: rgba(255, 255, 255, .8);
}

.vs-in-shell .vs-hero-art {
  position: relative;
  right: auto;
  width: 100%;
  min-height: 286px;
  align-self: center;
}

.vs-in-shell .vs-hero-art::before { content: none; }

.vs-in-shell .vs-hero-grid {
  width: min(100%, 420px);
  height: 250px;
}

.vs-in-shell .vs-art-card {
  width: 220px;
  height: 280px;
  border-color: #fff;
  background:
    radial-gradient(circle at 82% 15%, rgba(97, 160, 221, .64), transparent 28%),
    linear-gradient(150deg, #173d70 0%, #2160b4 58%, #4b8fc8 100%);
  box-shadow: 16px 23px 40px rgba(26, 68, 113, .22);
}

.vs-in-shell .vs-art-card__copy strong { font-size: 50px; }
.vs-in-shell .vs-art-card__price { background: rgba(14, 44, 83, .2); }

.vs-in-shell .vs-floating-tag {
  color: var(--vs-admin-navy);
  border-color: var(--vs-admin-line);
  background: rgba(255, 255, 255, .9);
}

.vs-in-shell .vs-floating-tag svg { color: var(--vs-admin-blue); }

.vs-in-shell .vs-library-tabs {
  display: inline-flex;
  gap: 4px;
  margin: 0 0 28px;
  padding: 4px;
  border: 1px solid var(--vs-admin-line);
  border-radius: 13px;
  background: rgba(255, 255, 255, .72);
  box-shadow: 0 4px 14px rgba(26, 68, 113, .04);
}

.vs-in-shell .vs-library-tabs button {
  min-height: 38px;
  padding: 8px 15px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--vs-admin-muted);
  font-size: 12px;
  font-weight: 700;
}

.vs-in-shell .vs-library-tabs button:hover { color: var(--vs-admin-blue); background: rgba(33, 96, 180, .06); }

.vs-in-shell .vs-library-tabs button.active {
  color: #1d4ed8;
  border-color: #c5daf3;
  background: var(--vs-admin-sky);
  box-shadow: none;
}

.vs-in-shell .vs-library-tabs span { color: #1d4ed8; background: #dbeafe; }

.vs-in-shell .vs-section-heading {
  align-items: flex-end;
  margin-bottom: 18px;
}

.vs-in-shell .vs-section-heading h2 {
  color: var(--vs-admin-navy);
  font-size: 22px;
  letter-spacing: -.035em;
}

.vs-in-shell .vs-section-heading p,
.vs-in-shell .vs-section-heading > span { color: var(--vs-admin-muted); }

.vs-in-shell .vs-section-heading .vs-field {
  width: min(100%, 292px);
  margin: 0;
  color: var(--vs-admin-muted);
  font-size: 11px;
}

.vs-in-shell .vs-section-heading .vs-field input {
  min-height: 40px;
  border-color: var(--vs-admin-line);
  border-radius: 10px;
  background: #fff;
  font-size: 12px;
}

.vs-in-shell .vs-project-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.vs-in-shell .vs-project-card {
  border-color: var(--vs-admin-line);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 7px 20px rgba(26, 68, 113, .05);
}

.vs-in-shell .vs-project-card:hover {
  border-color: #b9d0ec;
  box-shadow: 0 16px 34px rgba(26, 68, 113, .12);
  transform: translateY(-4px);
}

.vs-in-shell .vs-model-art {
  height: 216px;
  border-bottom: 1px solid rgba(255, 255, 255, .28);
}

.vs-in-shell .vs-model-play {
  background: rgba(23, 61, 112, .88);
  box-shadow: 0 8px 18px rgba(23, 61, 112, .18);
}

.vs-in-shell .vs-model-play:hover { background: var(--vs-admin-blue); }

.vs-in-shell .vs-project-info { padding: 16px 17px 18px; }

.vs-in-shell .vs-project-info h3 {
  color: var(--vs-admin-navy);
  font-size: 15px;
  letter-spacing: -.015em;
}

.vs-in-shell .vs-project-info span { color: var(--vs-admin-muted); font-size: 11px; }

.vs-in-shell .vs-empty {
  border-color: #c8d9eb;
  background: rgba(255, 255, 255, .78);
}

.vs-in-shell .vs-mini-empty {
  border: 1px dashed #c8d9eb;
  background: #f7fbff;
  color: var(--vs-admin-muted);
}

.vs-in-shell .vs-message {
  width: calc(100% - 64px);
  max-width: 1476px;
  margin: 12px auto 0;
}

@media (max-width: 1180px) {
  .vs-in-shell .vs-project-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
  .vs-in-shell .vs-hero { grid-template-columns: 1fr; gap: 18px; }
  .vs-in-shell .vs-hero-art { min-height: 260px; }
  .vs-in-shell .vs-project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .vs-in-shell .vs-library { padding: 22px 16px 54px; }
  .vs-in-shell .vs-hero { padding: 28px 24px; }
  .vs-in-shell .vs-library-tabs { width: 100%; }
  .vs-in-shell .vs-library-tabs button { flex: 1; padding-inline: 8px; }
  .vs-in-shell .vs-section-heading { display: block; }
  .vs-in-shell .vs-section-heading .vs-field { width: 100%; margin-top: 16px; }
  .vs-in-shell .vs-project-grid { gap: 12px; }
  .vs-in-shell .vs-model-art { height: 174px; }
  .vs-in-shell .vs-project-info { padding: 13px; }
  .vs-in-shell .vs-project-info h3 { font-size: 13px; }
  .vs-in-shell .vs-message { width: calc(100% - 32px); }
}

@media (max-width: 520px) {
  .vs-in-shell .vs-project-grid { grid-template-columns: 1fr; }
  .vs-in-shell .vs-model-art { height: 210px; }
}

/* Mostra os elementos reais do estúdio: modelo, produto, preço, formatos e cenas. */
.vs-in-shell .vs-hero { grid-template-columns: minmax(0, 1fr) minmax(390px, .94fr); gap: clamp(22px, 3vw, 48px); }
.vs-in-shell .vs-hero::after { content: none; }
.vs-in-shell .vs-hero-art { min-width: 0; min-height: 320px; }
.vs-studio-demo {
  width: 100%;
  max-width: 550px;
  padding: 12px;
  border: 1px solid #d7e2ef;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: 0 18px 40px rgba(27, 63, 107, .14);
}
.vs-studio-demo__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 5px 12px; color: #425a77; font-size: 11px; font-weight: 700; }
.vs-studio-demo__header > span:last-child { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.vs-studio-demo__status { display: inline-flex; align-items: center; gap: 6px; color: #5b6e85; font-size: 9px; letter-spacing: .08em; }
.vs-studio-demo__status > span { width: 7px; height: 7px; border-radius: 50%; background: #eaa523; }
.vs-studio-demo__body { display: grid; grid-template-columns: minmax(0, .69fr) minmax(0, 1fr); gap: 12px; }
.vs-studio-demo__reel, .vs-studio-demo__side { min-width: 0; }
.vs-studio-demo__format { display: flex; align-items: center; gap: 5px; height: 23px; color: #425a77; font-size: 10px; font-weight: 800; }
.vs-studio-demo__scene, .vs-studio-demo__tv { position: relative; overflow: hidden; border: 3px solid #fff; border-radius: 12px; background: #d81b0e url('/video-studio/templates/alerta-background.png') center / cover; box-shadow: 0 5px 18px rgba(72, 38, 31, .16); }
.vs-studio-demo__scene { height: 255px; }
.vs-studio-demo__seal { position: absolute; z-index: 1; top: 4%; left: 13%; width: 74%; height: 31%; object-fit: contain; filter: drop-shadow(0 4px 5px #6e1609aa); }
.vs-studio-demo__product { position: absolute; z-index: 1; top: 32%; right: 5%; width: 57%; height: 45%; object-fit: contain; filter: drop-shadow(0 7px 5px #75100b88); }
.vs-studio-demo__price { position: absolute; z-index: 2; bottom: 11%; left: 6%; display: grid; gap: 2px; max-width: 70%; padding: 7px 10px 6px; color: #fff; border: 2px solid #ffe938; border-radius: 9px; background: #b80c14; box-shadow: 3px 4px 0 #661018; transform: rotate(-4deg); }
.vs-studio-demo__price small { overflow: hidden; font-size: 8px; font-weight: 800; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.vs-studio-demo__price strong { color: #fff035; font-family: 'Barlow Condensed', sans-serif; font-size: clamp(25px, 2.2vw, 36px); line-height: .9; white-space: nowrap; }
.vs-studio-demo__sample { position: absolute; right: 5%; bottom: 2%; color: #fff; font-size: 7px; font-weight: 800; letter-spacing: .06em; text-shadow: 0 1px 3px #5e0e0e; }
.vs-studio-demo__tv { height: 143px; }
.vs-studio-demo__tv-seal { position: absolute; top: 4%; left: 3%; width: 40%; height: 64%; object-fit: contain; filter: drop-shadow(0 3px 4px #6e1609aa); }
.vs-studio-demo__tv-product { position: absolute; top: 6%; right: 5%; width: 37%; height: 75%; object-fit: contain; filter: drop-shadow(0 4px 4px #75100b88); }
.vs-studio-demo__tv-price { position: absolute; bottom: 8%; left: 8%; padding: 3px 8px; color: #fff035; border: 2px solid #ffe938; border-radius: 7px; background: #b80c14; font: 800 24px/.95 'Barlow Condensed', sans-serif; box-shadow: 2px 3px 0 #661018; }
.vs-studio-demo__track { display: grid; gap: 8px; margin-top: 11px; padding: 12px; border: 1px solid #dce6f1; border-radius: 11px; background: #fff; }
.vs-studio-demo__track > span { display: flex; align-items: center; gap: 6px; color: #294965; font-size: 10px; font-weight: 800; }
.vs-studio-demo__track > div { display: grid; grid-template-columns: .6fr 1fr .7fr; gap: 3px; height: 22px; }
.vs-studio-demo__track i { border-radius: 4px; background: #dceaff; }
.vs-studio-demo__track i:nth-child(2) { background: #ffd49b; }
.vs-studio-demo__track small { color: #70829a; font-size: 8px; white-space: nowrap; }
.vs-studio-demo__track b { padding: 0 2px; }

@media (max-width: 900px) {
  .vs-in-shell .vs-hero { grid-template-columns: 1fr; }
  .vs-in-shell .vs-hero-art { min-height: 0; }
  .vs-studio-demo { max-width: 580px; margin: 0 auto; }
}
@media (max-width: 520px) {
  .vs-in-shell .vs-hero { padding: 25px 18px; }
  .vs-studio-demo { padding: 8px; border-radius: 14px; }
  .vs-studio-demo__header { font-size: 9px; }
  .vs-studio-demo__status { font-size: 7px; }
  .vs-studio-demo__body { gap: 7px; }
  .vs-studio-demo__scene { height: 220px; }
  .vs-studio-demo__tv { height: 118px; }
  .vs-studio-demo__price { padding: 5px; }
  .vs-studio-demo__price strong { font-size: 24px; }
  .vs-studio-demo__price small { font-size: 6px; }
  .vs-studio-demo__tv-price { font-size: 17px; }
  .vs-studio-demo__track { padding: 8px; gap: 5px; }
  .vs-studio-demo__track small { font-size: 7px; white-space: normal; }
}

/* Constrain every grid row so only the tools and preview scroll. */
.vs-app.vs-editing{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;overflow:hidden;background:#f3f5f9}
.vs-editing .vs-header{flex:none;height:64px;padding:0 20px}
.vs-editing .vs-header-inner{max-width:none;width:100%}
.vs-editing .vs-editor{flex:1;min-height:0;max-width:none;width:100%;margin:0;padding:0;display:grid;grid-template-columns:88px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:0;overflow:hidden}
.vs-editing .vs-editor-title{grid-column:1/-1;margin:0;padding:12px 22px;border-bottom:1px solid #dce3ec;background:white}
.vs-editing .vs-editor-title .vs-eyebrow{display:none}
.vs-editing .vs-title-input{font-size:18px;letter-spacing:-.025em}
.vs-editing .vs-steps{height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;border:0;border-right:1px solid #dce3ec;border-radius:0;margin:0;padding:16px 7px;box-shadow:none;overflow-y:auto;background:#fafbfe}
.vs-editing .vs-steps button{flex:none;flex-direction:column;gap:6px;width:100%;font-size:10px;font-weight:600;padding:11px 2px;border:1px solid transparent;border-radius:12px;color:#64748b;box-shadow:none}
.vs-editing .vs-steps button.active{background:#f0edf9;border-color:#ded7f0;color:#655bab;box-shadow:none}
.vs-editing .vs-steps button span{background:transparent;border:0;color:inherit;width:26px;height:26px}
.vs-editing .vs-workspace{height:100%;min-height:0;display:grid;grid-template-columns:386px minmax(0,1fr);grid-template-rows:minmax(0,1fr);align-items:stretch;gap:0;overflow:hidden}
.vs-editing .vs-form-panel{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:0;border-right:1px solid #dce3ec;border-radius:0;box-shadow:none;background:#fff}
.vs-editing .vs-step-content{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:22px 20px}
.vs-editing .vs-step-content h2{font-size:20px;line-height:1.3;letter-spacing:-.025em}
.vs-editing .vs-step-content h3{font-size:15px;margin:22px 0 10px}
.vs-editing .vs-step-content>.vs-eyebrow{font-size:10px;letter-spacing:.12em;margin-bottom:7px}
.vs-editing .vs-lead{font-size:13px;line-height:1.6;margin-top:8px;margin-bottom:18px}
.vs-editing .vs-field{font-size:12px;gap:6px;margin:14px 0}
.vs-editing .vs-field input:not([type=range]),.vs-editing .vs-field select{font-size:14px;padding:10px 12px;min-height:42px;border-radius:10px}
.vs-editing .vs-field select{height:42px}
.vs-editing .vs-field small,.vs-editing .vs-hint{font-size:11px;line-height:1.5}
.vs-editing .vs-toggle{gap:12px;padding:13px;margin:16px 0;border:1px solid #ece9f6;background:#f7f6fc}
.vs-editing .vs-toggle strong{font-size:13px;line-height:1.4}
.vs-editing .vs-toggle small{font-size:11px;line-height:1.5}
.vs-editing .vs-toggle input{flex:none;width:18px;height:18px}
.vs-editing .vs-details{margin-top:18px;padding-top:14px}
.vs-editing .vs-two{grid-template-columns:1fr}
.vs-editing .vs-form-footer{flex:none;position:static;padding:14px 16px;gap:8px;z-index:2;background:#fafbfe}
.vs-editing .vs-form-footer .vs-button{font-size:12px;padding:10px 12px;min-height:40px}
.vs-editing .vs-preview-panel{position:static;height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;border:0;border-radius:0;padding:20px 28px;background:#edf0f6;box-shadow:none}
.vs-editing .vs-preview-heading{margin-bottom:10px}
.vs-editing .vs-layout-tools{padding:8px 0;justify-items:start}
.vs-editing .vs-layout-tools>.vs-button{font-size:12px;padding:8px 12px;background:white}
.vs-editing .vs-preview-stage.vertical{width:min(100%,380px,calc((100dvh - 310px)*.5625));max-width:380px;min-width:170px;margin:14px auto}
.vs-editing .vs-preview-stage.horizontal{width:min(100%,1080px);padding:20px 0;margin:auto}
.vs-editing .vs-inline-actions{flex-wrap:wrap;gap:8px}
.vs-editing .vs-inline-actions .vs-button{font-size:12px;padding:10px 12px}
.vs-editing .vs-message{flex:none;margin:0;border-radius:0;padding:8px 20px}
.vs-editing .vs-step-content,.vs-editing .vs-preview-panel{scrollbar-width:thin;scrollbar-color:#b8b1d3 #f4f5fa}
.vs-editing .vs-step-content::-webkit-scrollbar,.vs-editing .vs-preview-panel::-webkit-scrollbar{width:7px}
.vs-editing .vs-step-content::-webkit-scrollbar-thumb,.vs-editing .vs-preview-panel::-webkit-scrollbar-thumb{background:#b8b1d3;border-radius:8px}
@media(max-width:1000px){.vs-editing .vs-workspace{grid-template-columns:340px minmax(0,1fr)}.vs-editing .vs-preview-panel{padding:16px}.vs-editing .vs-header-context{display:none}}
@media(max-width:760px){.vs-editing .vs-editor{display:flex;flex-direction:column;overflow-y:auto}.vs-editing .vs-editor-title{flex:none;padding:10px 14px}.vs-editing .vs-steps{height:auto;flex-direction:row;overflow:visible;flex:none;padding:5px;border-right:0;border-bottom:1px solid #dce3ec}.vs-editing .vs-steps button{flex:1;padding:7px 2px;font-size:10px}.vs-editing .vs-workspace{display:flex;flex-direction:column;height:auto;overflow:visible;min-height:auto}.vs-editing .vs-form-panel{height:auto;overflow:visible;min-height:440px;flex:none}.vs-editing .vs-step-content{overflow:visible;flex:none}.vs-editing .vs-form-panel :deep(.embedded-product-review){height:70dvh;min-height:440px}.vs-editing .vs-preview-panel{height:auto;overflow:visible;flex:none}.vs-editing .vs-preview-stage.vertical{width:240px;min-width:0}.vs-editing .vs-header{padding:0 12px}.vs-editing .vs-header-actions .vs-button{font-size:11px}.vs-editing .vs-form-footer{position:static}}

.vs-offer.vs-offer-compact{padding:0;margin-top:8px;border-radius:10px;overflow:hidden}
.vs-offer-summary{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;list-style:none}
.vs-offer-summary::-webkit-details-marker{display:none}
.vs-offer-summary>img{width:42px;height:42px;object-fit:contain;background:#fff;border-radius:6px}
.vs-offer-summary>span{flex:1;min-width:0}
.vs-offer-summary strong{display:block;font-size:12px;line-height:1.4;overflow-wrap:anywhere}
.vs-offer-summary small{display:block;font-size:12px;color:#60758f;margin-top:3px}
.vs-offer-summary>svg{flex-shrink:0;color:#655bab}
.vs-offer-summary:focus-visible{outline:2px solid #655bab;outline-offset:-3px}
.vs-offer-compact[open]>.vs-offer-summary{background:#f3f0fa;border-bottom:1px solid #dce6f1}
.vs-offer-compact[open]>.vs-offer-summary>svg:last-child{transform:rotate(180deg)}
.vs-offer-details{padding:12px}

.vs-editing .vs-preview-panel{display:flex;flex-direction:column;overflow:hidden;gap:8px}
.vs-live-status{flex:none;padding:14px 16px;background:#fff;border:1px solid #dcd9ef;border-radius:12px;color:#253f60}
.vs-live-status>div{display:flex;align-items:center;gap:9px}.vs-live-status small{margin-left:auto;color:#697895;font-size:11px}.vs-live-status p{font-size:13px;margin-top:8px}.vs-live-status progress{width:100%;height:5px;accent-color:#655bac;margin-top:10px}
.vs-editing .vs-preview-stage.vertical{min-width:0;width:min(100%,300px,calc((100dvh - 460px)*.5625));margin:auto}
.vs-editing .vs-preview-stage.horizontal{width:min(100%,calc((100dvh - 460px)*1.777));padding:0;margin:auto}
.vs-editing .vs-preview-heading,.vs-editing .vs-layout-tools,.vs-editing .vs-preview-caption,.vs-editing .vs-preview-panel>.vs-hint{flex:none;margin:0!important}
.vs-editing .vs-job-list{flex:none;margin-top:4px;padding-top:8px;font-size:12px}.vs-editing .vs-job-list[open]{max-height:160px;overflow:auto}.vs-job-list summary{cursor:pointer;color:#60758f}
.vs-editing .vs-preview-panel.is-layout-editing{overflow-y:auto}
@media(max-width:760px){.vs-live-status{position:sticky;top:0;z-index:2}.vs-editing .vs-preview-stage.vertical{width:200px}}

/* Preview uses the actual remaining panel space, not a fixed viewport deduction. */
.vs-editing .vs-preview-panel{padding:12px 18px;gap:7px;position:relative}
.vs-editing .vs-preview-viewport{flex:1 1 0;min-height:180px;min-width:0;display:grid;place-items:center;container-type:size}
.vs-editing .vs-preview-viewport .vs-preview-stage.vertical{width:min(100cqw,calc(100cqh * .5625));max-width:none;min-width:0;margin:0}
.vs-editing .vs-preview-viewport .vs-preview-stage.horizontal{width:min(100cqw,calc(100cqh * 1.77777));max-width:none;padding:0;margin:0}
.vs-editing .vs-live-status{padding:9px 12px;border-radius:10px}
.vs-editing .vs-live-status p{margin-top:4px;font-size:12px}
.vs-editing .vs-live-status.is-complete{display:flex;align-items:center;gap:12px;background:#f8fafc;border-color:#dce3ee}
.vs-editing .vs-live-status.is-complete p{margin:0;font-size:11px;color:#62758e}
.vs-editing .vs-live-status.is-complete small{display:none}
.vs-editing .vs-preview-heading{min-height:32px}
.vs-editing .vs-format-switch{padding:2px}
.vs-editing .vs-layout-tools{padding:0}
.vs-editing .vs-layout-tools>.vs-button{min-height:30px;padding:5px 10px;font-size:11px}
.vs-editing .vs-preview-caption{font-size:11px;padding:2px}
.vs-editing .vs-job-list{font-size:11px;padding-top:5px}
.vs-editing .vs-preview-panel.is-layout-editing .vs-preview-viewport{flex:none;height:55dvh;min-height:300px}
@media(max-width:760px){
 .vs-editing .vs-preview-viewport{flex:none;height:65dvh;min-height:320px}
 .vs-editing .vs-live-status.is-complete{flex-wrap:wrap;gap:4px}
}

/* The video owns the panel height; tools stay in a single compact row. */
.vs-editing .vs-preview-panel{padding:8px 12px;gap:4px}
.vs-editing .vs-preview-heading{gap:10px;min-height:32px}
.vs-editing .vs-preview-edit{margin-left:auto;min-height:28px;padding:4px 9px;font-size:11px;background:#fff}
.vs-editing .vs-format-switch{flex:none}
.vs-editing .vs-preview-caption{padding:0;font-size:10px}
.vs-editing .vs-job-list{position:absolute;bottom:10px;right:12px;max-width:250px;border:0;background:#f7f8fc;border-radius:8px;padding:6px 9px;z-index:3}
.vs-editing .vs-job-list[open]{max-height:240px;box-shadow:0 8px 24px #26385b22;border:1px solid #dce3ee}
@media(max-width:760px){.vs-editing .vs-job-list{position:static;max-width:none}.vs-editing .vs-preview-heading>span{font-size:9px}}
</style>

<style scoped>
.vs-audio-card{margin-top:16px;padding:19px;border:1px solid #d9e3f1;border-radius:18px;background:#fff;box-shadow:0 7px 24px #1f3d6310}
.vs-audio-card-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.vs-audio-card-heading>span{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#ebe9fa;color:#5f54a7;font-size:19px}
.vs-audio-card-heading h3{margin:0!important;color:#233657;font-size:17px!important;line-height:1.2}
.vs-audio-card-heading p{margin:5px 0 0;color:#657791;font-size:11px;line-height:1.5}
.vs-audio-card>.vs-field{margin:0 0 12px}
.vs-audio-card>.vs-hint{margin:10px 0 12px;color:#647791;font-size:11px;line-height:1.5}
.vs-audio-card .vs-audio{display:block;width:100%;margin:10px 0}
.vs-audio-card .vs-details{border-top:1px solid #e4eaf3;padding-top:13px;margin-top:14px}
.vs-audio-card .vs-toggle{margin:14px 0 0}
@media(max-width:430px){.vs-audio-card{padding:15px}}
</style>
