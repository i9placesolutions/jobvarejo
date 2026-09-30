export interface ReadyVoiceAudio {
  assetId?: unknown
  duration?: unknown
}

export interface VoicePlaybackJob {
  id?: string
  kind?: string
  status?: string
  result?: {
    provider?: string
    fullVoice?: ReadyVoiceAudio | null
    clips?: Record<string,ReadyVoiceAudio> | null
  } | null
}

export interface PlayableVoiceAudio {
  fullVoice?: {assetId:string;duration:number}
  clips: {id:string;assetId:string;duration:number}[]
}

function isPlayableAudio(audio:ReadyVoiceAudio|undefined|null):audio is {assetId:string;duration:number}{
  return typeof audio?.assetId==='string'&&audio.assetId.trim().length>0&&typeof audio.duration==='number'&&Number.isFinite(audio.duration)&&audio.duration>0
}

export function getPlayableVoiceAudio(job:VoicePlaybackJob|undefined|null):PlayableVoiceAudio|undefined{
  if(job?.kind!=='voice'||job.status!=='ready'||job.result?.provider!=='elevenlabs')return undefined
  const fullVoice=job.result.fullVoice
  if(isPlayableAudio(fullVoice))return {fullVoice:{assetId:fullVoice.assetId,duration:fullVoice.duration},clips:[]}
  const clips:{id:string;assetId:string;duration:number}[]=[]
  for(const [id,audio] of Object.entries(job.result.clips||{})){
    if(!isPlayableAudio(audio))return undefined
    clips.push({id,assetId:audio.assetId,duration:audio.duration})
  }
  return clips.length?{clips}:undefined
}

export function hasPlayableVoiceAudio(job:VoicePlaybackJob|undefined|null):boolean{
  return getPlayableVoiceAudio(job)!==undefined
}

/** Keeps listening available while composition continues to use only the exact current job. */
export function selectVoicePlaybackJob<T extends VoicePlaybackJob>(jobs:readonly T[],exactJob:T|undefined):T|undefined{
  if(hasPlayableVoiceAudio(exactJob))return exactJob
  return jobs.find(job=>hasPlayableVoiceAudio(job))
}
