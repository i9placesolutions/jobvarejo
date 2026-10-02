import {describe,expect,it} from 'vitest'
import {ATMOSPHERE_EFFECTS,SPECTACLE_EFFECTS} from '../../shared/video-studio/effect-catalog'
import {SPECTACLE_EFFECT_IDS,spectacleLayers} from '../../shared/video-studio/spectacle-effects'

function childElements(node:unknown):number{
 if(Array.isArray(node))return node.reduce((sum,item)=>sum+childElements(item),0)
 if(!node||typeof node!=='object'||!('props' in node))return 0
 return 1+childElements((node as {props?:{children?:unknown}}).props?.children)
}
function numericValues(node:unknown):number[]{
 if(typeof node==='number')return [node]
 if(Array.isArray(node))return node.flatMap(numericValues)
 if(!node||typeof node!=='object')return []
 const value=node as {props?:unknown}
 return numericValues('props' in value?value.props:Object.values(node))
}
const sampleLocal=(id:string)=>id.startsWith('explosion-')?18:id.startsWith('fireworks-')?32:36
function reactProps(node:unknown):Record<string,unknown>[]{
 if(Array.isArray(node))return node.flatMap(reactProps)
 if(!node||typeof node!=='object'||!('props' in node))return []
 const props=(node as {props:Record<string,unknown>}).props
 const type=(node as unknown as {type:unknown}).type
 return [{...props,__nodeType:type},...reactProps(props.children)]
}

describe('espetáculos procedurais do Video Studio',()=>{
 it('expõe e desenha cada um dos 24 IDs no quadro de revisão',()=>{
  expect(SPECTACLE_EFFECT_IDS).toHaveLength(24)
  expect(SPECTACLE_EFFECTS.map(effect=>effect.id)).toEqual(SPECTACLE_EFFECT_IDS)
  for(const id of SPECTACLE_EFFECT_IDS){
   expect(ATMOSPHERE_EFFECTS.some(effect=>effect.id===id)).toBe(true)
   const local=sampleLocal(id),layers=spectacleLayers(id,local,local,1080,1920)
   expect(childElements(layers),id).toBeGreaterThan(0)
   expect(childElements(layers),id).toBeLessThanOrEqual(100)
  }
 })

 it('é determinístico, varia por tempo e formato e mantém estilos finitos',()=>{
  for(const id of SPECTACLE_EFFECT_IDS){
   const local=sampleLocal(id),frame=local
   const a=spectacleLayers(id,frame,local,1080,1920),b=spectacleLayers(id,frame,local,1080,1920)
   expect(a).toEqual(b)
   const later=spectacleLayers(id,frame+7,local+7,1080,1920)
   expect(JSON.stringify(a)).not.toBe(JSON.stringify(later))
   const horizontal=spectacleLayers(id,frame,local,1920,1080)
   expect(JSON.stringify(a)).not.toBe(JSON.stringify(horizontal))
   for(const n of numericValues(a))expect(Number.isFinite(n),`${id}: ${n}`).toBe(true)
  }
 })

 it('mantém a silhueta em fastPreview com menos elementos',()=>{
  for(const id of SPECTACLE_EFFECT_IDS){
   const local=sampleLocal(id),full=spectacleLayers(id,local,local,1080,1920,false),fast=spectacleLayers(id,local,local,1080,1920,true)
   expect(childElements(fast),id).toBeLessThan(childElements(full))
   expect(childElements(fast),id).toBeGreaterThan(0)
  }
 })

 it('desativa explosões depois da janela de entrada',()=>{
  for(const id of SPECTACLE_EFFECT_IDS.filter(effect=>effect.startsWith('explosion-'))){
   expect(spectacleLayers(id,92,92,1080,1920)).toEqual([])
   expect(spectacleLayers(id,18,18,1080,1920).length).toBeGreaterThan(0)
  }
 })

 it('usa fills SVG válidos e coordenadas numéricas nas linhas',()=>{
  const fillPattern=/^(#[\da-f]{3,8}|none|transparent|url\(#[-\w]+\))$/i
  for(const id of SPECTACLE_EFFECT_IDS){
   const local=sampleLocal(id),props=reactProps(spectacleLayers(id,local,local,1080,1920))
   for(const p of props){
    for(const key of ['fill','stroke'] as const)if(typeof p[key]==='string')expect(p[key],`${id}.${key}`).toMatch(fillPattern)
    if(p.__nodeType==='line')for(const key of ['x1','y1','x2','y2'] as const)expect(Number.isFinite(p[key]),`${id}.${key}`).toBe(true)
   }
  }
 })
})
