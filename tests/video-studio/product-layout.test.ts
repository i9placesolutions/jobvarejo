import {describe,it,expect} from 'vitest'
import {productLayers} from '../../shared/video-studio/product-layout'
describe('Composição preenchida de produto',()=>{
 const box=[690,215,1130,735] as const
 it('usa três embalagens estreitas na TV com o destaque à frente',()=>{
  const layers=productLayers(box,false,true,.53)
  expect(layers).toHaveLength(3)
  expect(new Set(layers.map(x=>x.motionIndex)).size).toBe(3)
  expect(layers.at(-1)?.front).toBe(true)
  expect(layers.at(-1)!.box[3]).toBe(box[3])
 })
 it('mantém duas no vertical e respeita a opção sem duplicação',()=>{
  expect(productLayers(box,true,true,.53)).toHaveLength(2)
  expect(productLayers(box,false,false,.53)).toHaveLength(1)
 })
 it.each([1,2,3] as const)('respeita %i imagens explícitas mesmo em produto largo e duplicação global desligada',copies=>{
  for(const vertical of [true,false])expect(productLayers(box,vertical,false,1.4,copies)).toHaveLength(copies)
 })
 it('não duplica uma foto que já preenche a área e mantém o tamanho máximo quando duplica',()=>{
  const area=[45,660,990,490] as const
  expect(productLayers(area,true,true,1.5)).toHaveLength(1)
  for(const layer of productLayers(area,true,true,.4)){
   expect(layer.box[3]).toBe(490)
   expect(layer.box[2]).toBe(196)
  }
 })
 it('preserva produtos largos como um destaque grande',()=>expect(productLayers(box,false,true,1.4)).toEqual([{box,rotation:0,motionIndex:0,front:true}]))
 it('empilha produtos largos nos Reels e distribui embalagens altas lado a lado',()=>{
  const area=[80,700,650,800] as const
  const stacked=productLayers(area,true,true,1.4)
  expect(stacked).toHaveLength(2)
  expect(stacked[0]!.box[0]).toBe(stacked[1]!.box[0])
  expect(stacked[1]!.box[1]).toBeGreaterThan(stacked[0]!.box[1])
  expect(stacked[1]!.box[1]-stacked[0]!.box[1]).toBeCloseTo(area[3]-stacked[0]!.box[3])
  const side=productLayers(area,true,true,.4)
  expect(side[0]!.box[1]).toBe(side[1]!.box[1])
  expect(side[1]!.box[0]).toBeGreaterThan(side[0]!.box[0])
  for(const layers of [stacked,side])for(const {box:[x,y,w,h]} of layers){
   expect(x).toBeGreaterThanOrEqual(area[0]);expect(y).toBeGreaterThanOrEqual(area[1])
   expect(x+w).toBeLessThanOrEqual(area[0]+area[2]+.001)
   expect(y+h).toBeLessThanOrEqual(area[1]+area[3]+.001)
  }
 })

})
