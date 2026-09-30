import {fullVoiceTimeline,type FullVideoVoice} from './full-voice'
import {narrationScripts,videoAudioIdentity,videoSpeechSource,type VideoDocument} from './model'

export interface ReusableVoiceResult {
  provider?: unknown
  audioIdentity?: unknown
  fullVoice?: unknown
}

export interface VoiceReusePlan {
  document:VideoDocument
  scriptSource:string
  audioIdentity:string
  fullVoice:FullVideoVoice
  scenes:ReturnType<typeof fullVoiceTimeline>
}

function isVoiceSettings(value:unknown):value is VideoDocument['voice']{
  if(!value||typeof value!=='object')return false
  const voice=value as Record<string,unknown>
  return voice.enabled===true&&typeof voice.id==='string'&&voice.id.trim().length>0&&Array.isArray(voice.pronunciations)&&voice.pronunciations.every(item=>!!item&&typeof item==='object'&&typeof (item as any).from==='string'&&typeof (item as any).to==='string')
}

function isFullVoice(value:unknown):value is FullVideoVoice{
  if(!value||typeof value!=='object')return false
  const voice=value as Record<string,unknown>
  return typeof voice.assetId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(voice.assetId)&&typeof voice.duration==='number'&&Number.isFinite(voice.duration)&&voice.duration>0&&Array.isArray(voice.boundaries)
}

export function prepareVoiceReuse(document:VideoDocument,audioIdentity:unknown,result:ReusableVoiceResult):VoiceReusePlan{
  if(result?.provider!=='elevenlabs')throw Error('O áudio selecionado não é uma locução ElevenLabs.')
  if(typeof audioIdentity!=='string')throw Error('O roteiro original da locução não está disponível.')
  let original:unknown
  try{original=JSON.parse(audioIdentity)}catch{throw Error('O roteiro original da locução não está disponível.')}
  if(!original||typeof original!=='object')throw Error('O roteiro original da locução não está disponível.')
  const stored=original as Record<string,unknown>
  if(typeof stored.source!=='string'||!Array.isArray(stored.scripts)||!isVoiceSettings(stored.voice))throw Error('O roteiro original da locução está inválido.')
  const expectedIds=['intro',...document.offers.map(offer=>offer.id),'outro']
  const scripts=stored.scripts
  if(scripts.length!==expectedIds.length||scripts.some((script,index)=>!script||typeof script!=='object'||(script as any).id!==expectedIds[index]||typeof (script as any).text!=='string'||!(script as any).text.trim()))throw Error('A ordem dos produtos mudou desde que esta locução foi gravada. Não é possível aplicá-la a este vídeo.')
  if(!isFullVoice(result.fullVoice))throw Error('Esta gravação não tem uma locução completa válida para aplicar.')

  const updated=structuredClone(document)
  updated.scripts=scripts.map(script=>({id:(script as any).id,text:(script as any).text}))
  const joinedNarration=updated.scripts.map(script=>script.text).join('\n')
  if(JSON.stringify(narrationScripts(updated,joinedNarration))===JSON.stringify(updated.scripts))updated.narrationText=joinedNarration
  else delete updated.narrationText
  updated.voice={enabled:stored.voice.enabled,id:stored.voice.id,pronunciations:structuredClone(stored.voice.pronunciations)}
  const scenes=fullVoiceTimeline(updated,result.fullVoice)
  const scriptSource=videoSpeechSource(updated)
  return {document:updated,scriptSource,audioIdentity:videoAudioIdentity(updated),fullVoice:result.fullVoice,scenes}
}

export interface VoiceReuseMerge {
  document:VideoDocument
  voiceApplied:boolean
  scriptSource:string
}

function narrationState(document:VideoDocument):string{
  return JSON.stringify({voice:document.voice,scripts:document.scripts,narrationText:document.narrationText})
}

export function mergeVoiceReuseDocument(before:VideoDocument,current:VideoDocument,restored:VideoDocument):VoiceReuseMerge{
  const merged=structuredClone(current)
  const voiceApplied=narrationState(before)===narrationState(current)
  if(voiceApplied){
    merged.voice=structuredClone(restored.voice)
    merged.scripts=structuredClone(restored.scripts)
    if(restored.narrationText===undefined)delete merged.narrationText
    else merged.narrationText=restored.narrationText
  }
  const scriptSource=voiceApplied&&videoSpeechSource(merged)===videoSpeechSource(restored)?videoSpeechSource(restored):''
  return {document:merged,voiceApplied,scriptSource}
}
