import {VIDEO_FPS,type VideoDocument,type VideoScene} from './model'
export interface FullVideoVoice { assetId:string; duration:number; boundaries:number[] }
export function fullVoiceTimeline(doc:VideoDocument,voice:FullVideoVoice):VideoScene[]{
 const ids=['intro',...doc.offers.map(o=>o.id),'outro'],budget=doc.duration*VIDEO_FPS-2
 if(!Number.isFinite(voice.duration)||voice.duration<=0)throw Error('Duração da locução inválida.')
 const rate=doc.autoFitVoice!==false?Math.max(1,Math.ceil(voice.duration*VIDEO_FPS/budget*1000)/1000):1
 if(rate>2||Math.ceil(voice.duration/rate*VIDEO_FPS)>budget)throw Error('A locução completa ultrapassa o limite. Encurte o texto; o áudio gerado está salvo.')
 const total=Math.ceil(voice.duration/rate*VIDEO_FPS)
 const boundaries=voice.boundaries
 if(boundaries.length!==ids.length+1||boundaries[0]!==0||Math.abs(boundaries.at(-1)!-voice.duration)>.01||boundaries.some((n,i)=>!Number.isFinite(n)||(i>0&&n<=boundaries[i-1]!)))throw Error('Sincronização da locução inválida.')
 let from=0
 return ids.map((id,i)=>{const end=i===ids.length-1?total:Math.max(from+1,Math.min(total-(ids.length-1-i),Math.round(boundaries[i+1]!/voice.duration*total)));const scene={id,from,frames:end-from,speechFrames:end-from,playbackRate:rate};from=end;return scene})
}
