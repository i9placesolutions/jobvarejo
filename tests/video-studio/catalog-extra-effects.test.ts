import {describe,expect,it,vi} from 'vitest'
import {ATMOSPHERE_EFFECTS,SCENE_TRANSITIONS} from '../../shared/video-studio/effect-catalog'
import {transitionMotion} from '../../shared/video-studio/catalog-motion'
import {catalogSpriteParticles,CatalogAtmosphere} from '../../shared/video-studio/catalog-effects'
import {DEFAULT_MOTION} from '../../shared/video-studio/effect-catalog'
import type {VideoRenderProps} from '../../shared/video-studio/model'

vi.mock('remotion',async importOriginal=>{
 const actual=await importOriginal<typeof import('remotion')>()
 return {...actual,useCurrentFrame:()=>137,useVideoConfig:()=>({width:1080,height:1920,fps:30})}
})

const collectSources=(node:unknown):string[]=>{
 if(Array.isArray(node))return node.flatMap(collectSources)
 if(!node||typeof node!=='object')return []
 const props=(node as {props?:{src?:unknown;children?:unknown}}).props
 return [...(typeof props?.src==='string'?[props.src]:[]),...collectSources(props?.children)]
}

describe('efeitos adicionais do catálogo de vídeo',()=>{
 it('as transições extras aparecem durante a janela e zeram fora dela',()=>{
  const ids=['flash-wipe','split-screen','diamond-wipe','radial-burst','bar-wipe','pixel-dissolve','chevron-wipe','ring-wipe'] as const
  for(const id of ids){
   expect(SCENE_TRANSITIONS.some(item=>item.id===id)).toBe(true)
   expect(transitionMotion(-6,id)).toEqual({energy:0,flash:0,zoom:0,x:0,y:0,rotation:0,blur:0,cover:0,chromatic:0})
   expect(transitionMotion(11,id)).toEqual({energy:0,flash:0,zoom:0,x:0,y:0,rotation:0,blur:0,cover:0,chromatic:0})
   for(const frame of [-3,0]){
    const motion=transitionMotion(frame,id)
    expect(motion.energy+motion.cover+motion.flash+Math.abs(motion.x)+motion.zoom).toBeGreaterThan(0)
   }
  }
 })

 it('cada atmosfera sprite tem seu arquivo, layout determinístico e limites próprios',()=>{
  const files={
   'sprite-sparks':'kenney-spark.png','sprite-smoke':'kenney-smoke.png','sprite-flare':'kenney-flare.png',
   'sprite-stars':'kenney-star.png','sprite-rings':'kenney-ring.png','sprite-lightning':'kenney-lightning.png',
   'sprite-fire':'kenney-fire.png','sprite-dust':'kenney-dust.png','sprite-vortex':'kenney-vortex.png',
  } as const
  for(const effect of Object.keys(files) as (keyof typeof files)[]){
   expect(ATMOSPHERE_EFFECTS.some(item=>item.id===effect)).toBe(true)
   const particles=catalogSpriteParticles(effect,137,1080,1920),again=catalogSpriteParticles(effect,137,1080,1920)
   expect(particles.length).toBeGreaterThan(0)
   expect(particles).toEqual(again)
   expect(particles.every(p=>p.src===files[effect])).toBe(true)
   expect(new Set(particles.map(p=>p.key)).size).toBe(particles.length)
   for(const p of particles){
    expect(p.left).toBeGreaterThanOrEqual(0);expect(p.top).toBeGreaterThanOrEqual(0)
    expect(p.left+p.width*p.scale).toBeLessThanOrEqual(1080);expect(p.top+p.height*p.scale).toBeLessThanOrEqual(1920)
    expect(p.opacity).toBeGreaterThan(0);expect(p.opacity).toBeLessThanOrEqual(1)
   }
   expect(catalogSpriteParticles(effect,137,1080,1920,true).length).toBeLessThan(particles.length)
  }
 })

 it('CatalogAtmosphere cria imagens para cada uma das nove atmosferas selecionáveis',()=>{
  const files={
   'sprite-sparks':'kenney-spark.png','sprite-smoke':'kenney-smoke.png','sprite-flare':'kenney-flare.png',
   'sprite-stars':'kenney-star.png','sprite-rings':'kenney-ring.png','sprite-lightning':'kenney-lightning.png',
   'sprite-fire':'kenney-fire.png','sprite-dust':'kenney-dust.png','sprite-vortex':'kenney-vortex.png',
  } as const
  const templateBase='/templates-test'
  for(const [effect,file] of Object.entries(files) as [keyof typeof files,typeof files[keyof typeof files]][]){
   const document={theme:'impact',intensity:1,motion:{...DEFAULT_MOTION,atmosphere:[effect]}}
   const props={document,scenes:[],media:{},format:'vertical',templateBase} as unknown as VideoRenderProps
   const sources=collectSources(CatalogAtmosphere({props})).filter(src=>src.includes('/effects/'))
   expect(sources.length).toBeGreaterThan(0)
   expect(sources.every(src=>src===`${templateBase}/effects/${file}`)).toBe(true)
  }
 })
})
