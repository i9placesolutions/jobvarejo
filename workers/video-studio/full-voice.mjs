import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
export function fullVoiceText(scripts){return scripts.map(s=>s.text.trim().replace(/[.!?…]*$/u,'.')).join(' ')}
export function voiceUsage(text){const words=text.split(/\s+/).filter(Boolean).length;return {words,billingUnits:Math.ceil(words/100),requests:1}}
// Audio remains continuous: these boundaries only control the visual scene changes.
export function voiceBoundaries(scripts,duration,pauses=[]){
 const weights=scripts.map(s=>Math.max(1,s.text.trim().split(/\s+/).length)),sum=weights.reduce((a,b)=>a+b,0)
 let consumed=0;const result=[0]
 for(let i=0;i<scripts.length-1;i++){
  consumed+=weights[i];const target=duration*consumed/sum,min=result.at(-1)+.1,max=duration-(scripts.length-i-1)*.1
  const nearby=pauses.filter(t=>t>min&&t<max&&Math.abs(t-target)<Math.min(1,duration/sum*1.5)).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))
  result.push(Math.max(min,Math.min(max,nearby[0]??target)))
 }
 return [...result,duration]
}
export async function analyzeVoiceBoundaries(file,scripts,duration){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.VIDEO_STUDIO_PYTHON||'python3',[fileURLToPath(new URL('./align_voice.py',import.meta.url))]);let out='';let settled=false
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value)}
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(Error('A sincronização demorou além do esperado. A locução está salva; tente novamente sem gerar outra voz.'))},300000)
  child.stdout.on('data',chunk=>{out+=chunk;if(out.length>2_000_000){child.kill();finish(Error('Resposta de sincronização inválida.'))}})
  child.stderr.resume()
  child.on('error',()=>finish(Error('O sincronizador de voz está indisponível. O áudio está salvo.')))
  child.on('close',code=>{if(code)return finish(Error('Não foi possível sincronizar todas as ofertas com a fala. O áudio está salvo para nova tentativa.'));try{const result=JSON.parse(out);if(result.version!=='words-v1'||!Array.isArray(result.boundaries))throw Error();finish(null,result)}catch{finish(Error('Resposta de sincronização inválida.'))}})
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({file,scripts,duration}))
 })
}
