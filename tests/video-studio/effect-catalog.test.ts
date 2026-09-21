import {describe,expect,it} from 'vitest'
import {existsSync,readFileSync} from 'node:fs'
import {PRODUCT_ENTRANCES,CAMERA_MOVEMENTS,SCENE_TRANSITIONS,SOUND_EFFECTS,MOTION_PRESETS,DEFAULT_MOTION,PRODUCT_FINISHES,identifyMotionPreset} from '../../shared/video-studio/effect-catalog'
import {elementMotion,cameraMotion,transitionMotion} from '../../shared/video-studio/catalog-motion'
import {productEffects} from '../../shared/video-studio/native-effects'
import {newVideoDocument,videoAudioIdentity} from '../../shared/video-studio/model'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'

describe('biblioteca reutilizável de efeitos',()=>{
 it('reconhece a combinação depois de o JSONB reordenar os campos',()=>{
  for(const p of MOTION_PRESETS){const saved=Object.fromEntries(Object.entries(p.motion).sort(([a],[b])=>a.localeCompare(b))) as typeof p.motion;expect(identifyMotionPreset(saved,p.transition)).toBe(p.id)}
 })
 it('preserva as configurações no contrato da API e mantém a locução reutilizável',()=>{
  const d=newVideoDocument(),identity=videoAudioIdentity(d)
  for(const preset of MOTION_PRESETS){const next={...d,motion:preset.motion,transition:preset.transition};expect(videoDocumentSchema.parse(next).motion).toEqual(preset.motion);expect(videoAudioIdentity(next)).toBe(identity)}
  expect(videoDocumentSchema.safeParse({...d,motion:{...DEFAULT_MOTION,product:'unknown'}}).success).toBe(false)
  expect(videoDocumentSchema.parse(d).motion).toBeUndefined()
 })
 it('finaliza as entradas e mantém cada embalagem com entrada independente',()=>{
  for(const {id} of PRODUCT_ENTRANCES)for(const speed of ['fast','balanced'] as const){
   expect(elementMotion(-3,id,0,speed).opacity).toBe(0)
   const settled=elementMotion(40,id,1,speed);for(const key of ['x','y','rotation'] as const)expect(settled[key]).toBeCloseTo(0);expect(settled.scale).toBe(1);expect(settled.opacity).toBe(1)
   expect(elementMotion(3,id,0,speed)).not.toEqual(elementMotion(3,id,1,speed))
   for(let f=0;f<40;f++){const m=elementMotion(f,id,0,speed);expect(m.scale).toBeGreaterThan(.3);expect(m.scale).toBeLessThan(1.5);expect(Math.abs(m.x)).toBeLessThan(200);expect(Math.abs(m.y)).toBeLessThan(200)}
  }
 })
 it('as transições estabilizam e a câmera nunca produz valores inválidos',()=>{
  for(const {id} of SCENE_TRANSITIONS){expect(transitionMotion(-10,id).energy).toBe(0);expect(transitionMotion(20,id).blur).toBe(0);expect(transitionMotion(20,id).zoom).toBe(0)}
  for(const {id} of CAMERA_MOVEMENTS)for(let f=0;f<100;f++)for(const n of Object.values(cameraMotion(f,f,id,.85)))expect(Number.isFinite(n)).toBe(true)
  expect(cameraMotion(100,100,'none',1)).toEqual({x:0,y:0,rotation:0,zoom:0})
 })
 it('todos os acabamentos criam descritores válidos dos efeitos nativos',()=>{
  for(const {id} of PRODUCT_FINISHES)for(const frame of [0,3,12,40])expect(()=>productEffects(frame,id,.85)).not.toThrow()
  expect(productEffects(20,'clean',1)).toEqual([])
 })
 it('todos os sons selecionáveis existem como WAV estéreo, com proveniência e conteúdo distinto',()=>{
  const manifest=JSON.parse(readFileSync('public/video-studio/audio/catalog-provenance.json','utf8'))
  const hashes=new Set()
  for(const item of SOUND_EFFECTS){const path=`public/video-studio/audio/sfx/${item.id}.wav`;expect(existsSync(path)).toBe(true);const wav=readFileSync(path);expect(wav.toString('ascii',0,4)).toBe('RIFF');expect(wav.readUInt16LE(22)).toBe(2);expect(wav.readUInt32LE(24)).toBe(44100);const asset=manifest.assets.find((a:any)=>a.id===item.id);expect(asset.origin).toBe('original-procedural-synthesis');hashes.add(asset.sha256)}
  expect(hashes.size).toBe(SOUND_EFFECTS.length)
 })
})
