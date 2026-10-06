import {describe,it,expect} from 'vitest'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
import {newVideoDocument,buildVideoTimeline} from '../../shared/video-studio/model'
import {sceneStyle} from '../../shared/video-studio/scene-variation'
import {snapScenesToBeats,musicTempo} from '../../shared/video-studio/music-tempo'
import {SCENE_TRANSITIONS,PRICE_ACCENTS} from '../../shared/video-studio/effect-catalog'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {parseLoudnormJson} from '../../workers/video-studio/loudness.mjs'

const withOffers=(n:number)=>{const d=newVideoFromTemplate('alerta');d.offers=Array.from({length:n},(_,i)=>({id:'o'+i,name:'Produto '+i,price:'9,99',unit:'UN',image:'',condition:''}));return d}

describe('variação entre ofertas',()=>{
 it('documentos novos nascem variados, com destaque e cortes no ritmo, e passam no schema',()=>{
  const d=newVideoDocument()
  expect(d.motionVariation).toBe('varied');expect(d.priceAccent).toBe('shine');expect(d.beatSync).toBe(true)
  expect(typeof d.variationSeed).toBe('number')
  expect(videoDocumentSchema.safeParse(d).success).toBe(true)
 })
 it('modo fixo (projetos antigos) mantém o mesmo estilo em todas as ofertas',()=>{
  const d=withOffers(5);delete d.motionVariation
  const styles=d.offers.map((_,i)=>sceneStyle(d,i))
  for(const s of styles){expect(s.transition).toBe(d.transition);expect(s).toEqual(styles[0])}
 })
 it('modo variado: primeira oferta usa o estilo do modelo, as seguintes variam sem repetir em sequência',()=>{
  const d=withOffers(6);d.motionVariation='varied';d.variationSeed=123
  const styles=d.offers.map((_,i)=>sceneStyle(d,i))
  expect(styles[0]!.transition).toBe(d.transition)
  for(let i=1;i<styles.length;i++){
   expect(styles[i]!.transition).not.toBe(styles[i-1]!.transition)
   expect(SCENE_TRANSITIONS.map(t=>t.id)).toContain(styles[i]!.transition)
   expect(PRICE_ACCENTS.map(a=>a.id)).toContain(styles[i]!.priceAccent)
   expect(styles[i]!.priceAccent).not.toBe('none')
  }
  expect(new Set(styles.map(s=>s.transition)).size).toBeGreaterThanOrEqual(4)
 })
 it('é determinístico pela semente (prévia = exportação) e muda ao sortear',()=>{
  const a=withOffers(5);a.motionVariation='varied';a.variationSeed=7
  const b=structuredClone(a)
  expect(a.offers.map((_,i)=>sceneStyle(a,i))).toEqual(b.offers.map((_,i)=>sceneStyle(b,i)))
  b.variationSeed=99
  expect(a.offers.map((_,i)=>sceneStyle(a,i).transition)).not.toEqual(b.offers.map((_,i)=>sceneStyle(b,i).transition))
 })
})

describe('cortes no ritmo da música',()=>{
 it('as trocas de cena caem sobre as batidas e o total respeita o orçamento',()=>{
  const bpm=128,beat=30*60/bpm,frames=[60,150,150,150,135]
  const out=snapScenesToBeats(frames,bpm,898,30,false,[Infinity,150,150,150,Infinity])
  let acc=0
  for(const f of out){acc+=f;expect(Math.abs(acc/beat-Math.round(acc/beat))*beat).toBeLessThanOrEqual(.51)}
  expect(out.reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(898)
  expect(Math.max(...out.slice(1,-1))).toBeLessThanOrEqual(150)
 })
 it('com locução só empurra cortes para depois (nunca encurta a fala)',()=>{
  const frames=[70,121,133,140],out=snapScenesToBeats(frames,140,898,30,true)
  let a=0,b=0
  for(let i=0;i<frames.length;i++){a+=frames[i]!;b+=out[i]!;expect(b).toBeGreaterThanOrEqual(a)}
 })
 it('linha do tempo usa o BPM da música escolhida quando beatSync está ligado',()=>{
  const d=withOffers(4);d.voice.enabled=false;d.audio.music='retail-bounce';d.beatSync=true
  expect(musicTempo('retail-bounce')?.bpm).toBe(128)
  const t=buildVideoTimeline(d),beat=30*60/128
  for(const s of t.slice(1))expect(Math.abs(s.from/beat-Math.round(s.from/beat))*beat).toBeLessThanOrEqual(.51)
  expect(t.at(-1)!.from+t.at(-1)!.frames).toBeLessThanOrEqual(d.duration*30-2)
 })
})

describe('volume padronizado',()=>{
 it('lê a medição do loudnorm no stderr do ffmpeg',()=>{
  const stderr='[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-35.52",\n\t"input_tp" : "-14.10",\n\t"input_lra" : "6.20",\n\t"input_thresh" : "-46.00",\n\t"target_offset" : "0.30"\n}\n'
  expect(parseLoudnormJson(stderr)).toMatchObject({input_i:'-35.52',target_offset:'0.30'})
  expect(parseLoudnormJson('sem json')).toBeNull()
 })
})
