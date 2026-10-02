import {describe,expect,it,vi} from 'vitest'
import {newVideoDocument,buildVideoTimeline} from '../../shared/video-studio/model'
import {DEFAULT_MOTION,MOTION_PRESETS} from '../../shared/video-studio/effect-catalog'
import {SPECTACLE_EFFECT_IDS,SpectacleAtmosphere} from '../../shared/video-studio/spectacle-effects'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {CatalogAtmosphere} from '../../shared/video-studio/catalog-effects'
import {BroadcastComposition} from '../../shared/video-studio/broadcast'
import {VideoComposition} from '../../shared/video-studio/composition'
import type {VideoRenderProps} from '../../shared/video-studio/model'

vi.mock('remotion',async importOriginal=>{
 const actual=await importOriginal<typeof import('remotion')>()
 return {...actual,useCurrentFrame:()=>18,useVideoConfig:()=>({width:1080,height:1920,fps:30,durationInFrames:900})}
})
const contains=(node:unknown,type:unknown):boolean=>{
 if(Array.isArray(node))return node.some(n=>contains(n,type))
 if(!node||typeof node!=='object')return false
 const el=node as {type:unknown;props:{children?:unknown}}
 return el.type===type||contains(el.props?.children,type)
}
const props=():VideoRenderProps=>{
 const document=newVideoDocument();document.voice.enabled=false
 document.motion={...DEFAULT_MOTION,atmosphere:['explosion-fireball']}
 return {document,format:'vertical',scenes:buildVideoTimeline(document),media:{}}
}
describe('integração de espetáculos no editor e exportação',()=>{
 it('todas as opções sobrevivem ao save e reload pelo schema real',()=>{
  for(const id of SPECTACLE_EFFECT_IDS){
   const p=props();p.document.motion!.atmosphere=[id]
   const saved=videoDocumentSchema.parse(JSON.parse(JSON.stringify(p.document)))
   expect(saved.motion?.atmosphere).toEqual([id])
  }
  const p=props();p.document.motion!.atmosphere=['unregistered-effect' as never]
  expect(videoDocumentSchema.safeParse(p.document).success).toBe(false)
 })
 it('combinações novas são persistíveis e respeitam o limite de oito efeitos',()=>{
  const presets=MOTION_PRESETS.filter(p=>p.motion.atmosphere.some(id=>SPECTACLE_EFFECT_IDS.includes(id as never)))
  expect(presets).toHaveLength(6)
  for(const preset of presets){
   const p=props();p.document.motion=preset.motion;p.document.transition=preset.transition
   expect(videoDocumentSchema.safeParse(p.document).success).toBe(true)
  }
  const p=props();p.document.motion!.atmosphere=SPECTACLE_EFFECT_IDS.slice(0,9)
  expect(videoDocumentSchema.safeParse(p.document).success).toBe(false)
 })
 it('camada nova chega aos modelos de encarte/showcase, broadcast e clássicos',()=>{
  const p=props()
  expect(contains(CatalogAtmosphere({props:p}),SpectacleAtmosphere)).toBe(true)
  expect(contains(BroadcastComposition(p),SpectacleAtmosphere)).toBe(true)
  p.document.theme='fresh'
  const root=VideoComposition(p) as unknown as {props:{children:{type:(p:VideoRenderProps)=>unknown;props:VideoRenderProps}[]}}
  const classic=root.props.children[0]!
  expect(contains(classic.type(classic.props),SpectacleAtmosphere)).toBe(true)
 })
})
