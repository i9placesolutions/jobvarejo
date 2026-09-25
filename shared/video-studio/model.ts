import type {VideoLayoutEdits,VideoEditorState} from './layout-editing'
import type {VideoBackground} from './backgrounds'
import {FLYER_RECIPES} from './flyer-recipes'
import {videoTemplateCopy} from './template-copy'
import type {VideoMotionSettings, SceneTransition} from './effect-catalog'
export const VIDEO_FPS = 30
export const VIDEO_VERSION = 1
export const VIDEO_FORMATS = { vertical: { width: 1080, height: 1920, label: 'Reels e Stories' }, horizontal: { width: 1920, height: 1080, label: 'TV' } } as const
export type VideoFormat = keyof typeof VIDEO_FORMATS
export const VIDEO_THEMES = [
  ...Object.values(FLYER_RECIPES).map(r=>({id:r.id,...videoTemplateCopy(r),description:r.layoutName||'Composição própria do encarte.',accent:r.accent,base:r.base})),
  { id: 'impact', name: 'Fecha Mês • Profissional', description: 'Selo 3D, cenário cinematográfico e efeitos de impacto.', accent: '#ffce45', base: '#230b13', title: 'FECHA MÊS' },
  { id: 'fresh', name: 'Feira de ofertas', description: 'Verde fresco, luz e movimento suave.', accent: '#d1fa74', base: '#082e25', title: 'FEIRA DE OFERTAS' },
  { id: 'grill', name: 'Festival do churrasco', description: 'Fumaça, brasas e um toque de impacto.', accent: '#ffb566', base: '#251816', title: 'FESTIVAL DO CHURRASCO' },
  { id: 'party', name: 'Ofertas especiais', description: 'Confetes, brilho e clima de comemoração.', accent: '#e5c1ff', base: '#26133f', title: 'OFERTAS ESPECIAIS' }
] as const
export const VIDEO_EFFECTS = [
  { id: 'shake', name: 'Tremida de impacto', description: 'Impacto curto na câmera, com estabilização para leitura.' },
  { id: 'smoke', name: 'Fumaça', description: 'Nuvens suaves atrás das ofertas.' },
  { id: 'embers', name: 'Brasas e faíscas', description: 'Pequenos pontos de luz ao fundo.' },
  { id: 'glow', name: 'Brilho', description: 'Reflexo iluminando os destaques.' },
  { id: 'confetti', name: 'Confetes', description: 'Um clima de festa para sua campanha.' },
  { id: 'zoom', name: 'Zoom na entrada', description: 'O produto entra inteiro, com aproximação rápida.' },
  { id: 'bounce', name: 'Entrada com impulso', description: 'Um pequeno salto ao aparecer.' },
  { id: 'rays', name: 'Raios de luz', description: 'Raios, arcos e trilhos de luz em movimento.' },
  { id: 'fire', name: 'Chamas', description: 'Luz e chamas estilizadas nas bordas.' },
  { id: 'pulse', name: 'Pulso', description: 'Um movimento suave para chamar atenção.' }
] as const
export type VideoEffect = typeof VIDEO_EFFECTS[number]['id']
export interface VideoOffer { alcoholBadgeEnabled?: boolean; copies?: 1|2|3; imageAspectRatio?: number; id: string; name: string; price: string; unit: string; image: string; condition: string }
export interface VideoScript { id: string; text: string }
export interface VideoDocument {
  validityMode?: 'single_day' | 'date_range' | 'none' | 'custom';
  validityDateFormat?: 'numeric' | 'long';
  appearance?: {textColor?:string;accent?:string;nameColor?:string;priceColor?:string;currencyColor?:string;unitColor?:string;conditionColor?:string;validityColor?:string;contactColor?:string};
  validityRange?: {start:string;end:string};
  layoutEdits?: VideoLayoutEdits;
  templateRevision?: number; background?: VideoBackground;
  layoutVersion?: 2; duplicateProducts?: boolean; version: 1; title: string; theme: typeof VIDEO_THEMES[number]['id']; campaign: string
  autoFitVoice?: boolean; formats: VideoFormat[]; duration: 15 | 20 | 30
  brand: { logoStyle?: 'sticker' | 'clean'; name: string; logo: string; address: string; whatsapp: string; instagram: string; phone?:string; facebook?:string; website?:string; slogan?:string; hours?:string; paymentNotes?:string; addresses?:string[]; whatsappNumbers?:string[] }
  priceLabel?: string; validity: string; offers: VideoOffer[]; scripts: VideoScript[]; narrationText?: string
  voice: { enabled: boolean; id: string; pronunciations: { from: string; to: string }[] }
  effects: VideoEffect[]; intensity: number; transition: SceneTransition; motion?: VideoMotionSettings
  audio: { music: string; musicVolume: number; voiceVolume: number; effectsVolume: number; sounds: boolean }
}
export interface VideoScene { id: string; from: number; frames: number; audio?: string; playbackRate?: number; speechFrames?: number }
import type { VideoLabel } from './labels'
export interface VideoRenderProps extends Record<string, unknown> { editor?: VideoEditorState; fastPreview?: boolean; document: VideoDocument; scenes: VideoScene[]; media: Record<string, string>; format: VideoFormat; voiceAudio?: string; music?: string; impact?: string; whoosh?: string; audioBase?: string; fontBase?: string; templateBase?: string; label?: VideoLabel }
export function newVideoDocument(): VideoDocument {
  return { layoutVersion:2,duplicateProducts:true,priceLabel:'',version: 1, title: 'Meu vídeo de ofertas', theme: 'impact', campaign: 'FECHA MÊS', formats: ['vertical','horizontal'], duration: 30,
    brand: { logoStyle:'sticker',name: '', logo: '', address: '', whatsapp: '', instagram: '' }, validityMode:'none', validity: '', offers: [], scripts: [],
    voice: { enabled: true, id: 'default', pronunciations: [] }, effects: ['zoom','shake','smoke','embers','glow','rays','pulse'], intensity: 0.85, transition: 'light',
    audio: { music: 'upbeat', musicVolume: 0.23, voiceVolume: 1, effectsVolume: 0.3, sounds: true } }
}
export function parseOfferPrice(value: string): number | null {
  const s = value.trim().replace(/^R\$\s*/i, '')
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(s)) return null
  const n = Number(s.replace(/\./g,'').replace(',','.'))
  return Number.isFinite(n) && n > 0 && n <= 999999 ? n : null
}
export function displayPrice(value: string): string { const n = parseOfferPrice(value); return n === null ? value : n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) }
function spokenOfferName(offer: VideoOffer): string {
  const unit=offer.unit.trim().toLowerCase()
  if(!['kg','g','ml','l','un','pct'].includes(unit))return offer.name
  return offer.name.replace(new RegExp(`\\s+${unit}\\.?$`,'i'),'').trim()
}
export function suggestVideoScripts(doc: VideoDocument): VideoScript[] {
  return [ {id:'intro', text:`${doc.campaign} no ${doc.brand.name}!`}, ...doc.offers.map(o=>({id:o.id, text:`${spokenOfferName(o)}, por R$ ${displayPrice(o.price)}${o.unit ? ` ${o.unit}` : ''}.${o.condition ? ` ${o.condition}.` : ''}`})),
    {id:'outro', text:`Aproveite no ${doc.brand.name}!${doc.validityMode!=='none'&&doc.validity ? ` ${doc.validity}.` : ''}`} ]
}
export function narrationScripts(doc: VideoDocument, text: string): VideoScript[] | null {
  const ids=['intro',...doc.offers.map(o=>o.id),'outro']
  const lines=text.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean)
  if(lines.length!==ids.length||lines.some(line=>line.length>700))return null
  return ids.map((id,index)=>({id,text:lines[index]!}))
}
export function videoNarrationText(doc: VideoDocument): string {
  return doc.narrationText ?? doc.scripts.map(script=>script.text).join('\n')
}
function normalizedSpeechValidityRange(doc: VideoDocument) {
  if(doc.validityMode==='none'||!doc.validityRange)return undefined
  return {start:doc.validityRange.start,end:doc.validityRange.end}
}
function canonicalJson(value: unknown): string {
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']'
  if(value&&typeof value==='object'){
    const record=value as Record<string,unknown>
    return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(record[key])).join(',')+'}'
  }
  return JSON.stringify(value)
}
function speechSourceEquals(source: string, expected: string): boolean {
  if(source===expected)return true
  try{return canonicalJson(JSON.parse(source))===canonicalJson(JSON.parse(expected))}catch{return false}
}
// Fonte comercial permanece separada do texto editável. O usuário confirma o roteiro após mudanças.
export function videoSpeechSource(doc: VideoDocument): string { return JSON.stringify({brand:doc.brand.name,campaign:doc.campaign,validity:doc.validityMode==='none'?'':doc.validity,validityMode:doc.validityMode,validityDateFormat:doc.validityDateFormat,validityRange:normalizedSpeechValidityRange(doc),offers:doc.offers.map(({id,name,price,unit,condition})=>({id,name,price,unit,condition}))}) }
function legacyVideoSpeechSource(doc: VideoDocument): string { return JSON.stringify({brand:doc.brand.name,campaign:doc.campaign,validity:doc.validity,offers:doc.offers.map(({id,name,price,unit,condition})=>({id,name,price,unit,condition}))}) }
export function videoSpeechSourceMatches(doc: VideoDocument, source: string | null | undefined): boolean {
  if(!source)return false
  return speechSourceEquals(source,videoSpeechSource(doc))||speechSourceEquals(source,legacyVideoSpeechSource(doc))
}
export function videoAudioIdentity(doc: VideoDocument): string { return JSON.stringify({source:videoSpeechSource(doc),scripts:doc.scripts,voice:doc.voice}) }
export function videoAudioIdentityMatches(identity: unknown, doc: VideoDocument): boolean {
  if(typeof identity!=='string')return false
  try {
    const stored=JSON.parse(identity)
    if(typeof stored?.source!=='string'||!Array.isArray(stored.scripts)||!stored.voice||typeof stored.voice!=='object')return false
    return speechSourceEquals(stored.source,videoSpeechSource(doc))
      && canonicalJson(stored.scripts)===canonicalJson(doc.scripts)
      && canonicalJson(stored.voice)===canonicalJson(doc.voice)
  } catch { return false }
}
export function estimateSpeechSeconds(text: string): number { return Math.max(1.2, text.trim().split(/\s+/).filter(Boolean).length / 2.35 + .35) }
export function buildVideoTimeline(doc: VideoDocument, durations?: Record<string, number>): VideoScene[] {
  const ids = ['intro', ...doc.offers.map(o=>o.id), 'outro']
  const minimums = ids.map((id,i)=> i===0 ? 2 : i===ids.length-1 ? 4.5 : 3)
  const speech = ids.map(id=>doc.voice.enabled ? (durations ? (durations[id] ?? NaN) : estimateSpeechSeconds(doc.scripts.find(s=>s.id===id)?.text||'')) : 0)
  if (speech.some(n=>!Number.isFinite(n)||n<0)) throw new Error('A locução de uma das cenas ainda não está pronta.')
  const budget = doc.duration * VIDEO_FPS - 2 // margem para a duração do contêiner AAC/MP4
  const atRate=(rate:number)=>minimums.map((minimum,i)=>Math.ceil(Math.max(minimum,doc.voice.enabled?speech[i]!/rate+.25:minimum)*VIDEO_FPS))
  const total=(values:number[])=>values.reduce((a,b)=>a+b,0)
  let playbackRate=1
  if(total(atRate(1))>budget&&doc.voice.enabled&&doc.autoFitVoice!==false){
    if(total(atRate(2))>budget)throw new Error(`Mesmo acelerando a locução em 2×, o conteúdo ultrapassa ${doc.duration} segundos. Encurte o roteiro ou use menos produtos.`)
    let low=1,high=2
    for(let i=0;i<32;i++){const middle=(low+high)/2;if(total(atRate(middle))<=budget)high=middle;else low=middle}
    playbackRate=Math.ceil(high*1000)/1000
  }
  const frames=atRate(playbackRate)
  if(total(frames)>budget)throw new Error(`O conteúdo ultrapassa ${doc.duration} segundos. Ative o ajuste automático da locução ou use menos produtos.`)
  // Distribui tempo livre entre ofertas para leitura, sem alongar aberturas.
  if (!doc.voice.enabled) { let spare=budget-frames.reduce((a,b)=>a+b,0); for(let i=1;i<frames.length-1;i++){const add=Math.min(60,Math.floor(spare/(frames.length-1-i))); frames[i]!+=add; spare-=add} }
  let from=0
  return ids.map((id,i)=>{const result={id,from,frames:frames[i]!,playbackRate:doc.voice.enabled?playbackRate:undefined,speechFrames:durations?.[id] ? Math.ceil(durations[id]!/playbackRate*VIDEO_FPS) : undefined};from+=frames[i]!;return result})
}
export function validateVideoForGeneration(doc: VideoDocument): string[] {
  const errors: string[]=[]
  if(doc.validityMode==='single_day'&&!doc.validityRange?.start)errors.push('Informe o dia da oferta.')
  if(doc.validityMode==='date_range'&&(!doc.validityRange?.start||!doc.validityRange?.end))errors.push('Informe a data inicial e a data final das ofertas.')
  if((doc.validityMode==='single_day'||doc.validityMode==='date_range')&&!doc.validityDateFormat)errors.push('Escolha se a data aparece em números ou com o mês por extenso.')
  if(!doc.validityMode&&doc.validityRange&&(!doc.validityRange.start||!doc.validityRange.end))errors.push('Informe a data inicial e a data final das ofertas.')
  if((doc.validityMode==='date_range'||!doc.validityMode)&&doc.validityRange?.start&&doc.validityRange?.end&&doc.validityRange.end<doc.validityRange.start)errors.push('A data final deve ser igual ou posterior à inicial.')
  if(!doc.brand.name.trim())errors.push('Informe o nome da empresa.')
  if(!doc.offers.length)errors.push('Adicione pelo menos um produto.')
  for(const o of doc.offers){if(!o.name.trim()||parseOfferPrice(o.price)===null)errors.push('Confira o nome e o preço de todos os produtos.');if(!o.image)errors.push(`Adicione a imagem de ${o.name||'cada produto'}.`)}
  if(doc.voice.enabled){const ids=['intro',...doc.offers.map(o=>o.id),'outro'];if(ids.some(id=>!doc.scripts.find(s=>s.id===id)?.text.trim()))errors.push('Revise o texto da abertura, das ofertas e do encerramento.');if(doc.narrationText!==undefined&&JSON.stringify(narrationScripts(doc,doc.narrationText))!==JSON.stringify(doc.scripts))errors.push(`Mantenha ${ids.length} linhas no roteiro: abertura, uma por produto e encerramento.`)}
  try {buildVideoTimeline(doc)}catch(e){errors.push((e as Error).message)}
  return [...new Set(errors)]
}
