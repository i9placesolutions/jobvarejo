import {describe,it,expect} from 'vitest'
import {productLayers} from '../../shared/video-studio/product-layout'
describe('Composição preenchida de produto',()=>{
 const box=[690,215,1130,735] as const
 it('usa três embalagens estreitas na TV com o destaque à frente',()=>{
  const layers=productLayers(box,false,true,.53)
  expect(layers).toHaveLength(3)
  expect(new Set(layers.map(x=>x.motionIndex)).size).toBe(3)
  expect(layers.at(-1)?.front).toBe(true)
  expect(layers.at(-1)!.box[3]).toBeGreaterThan(layers[0]!.box[3])
 })
 it('mantém duas no vertical e respeita a opção sem duplicação',()=>{
  expect(productLayers(box,true,true,.53)).toHaveLength(2)
  expect(productLayers(box,false,false,.53)).toHaveLength(1)
 })
 it('preserva produtos largos como um destaque grande',()=>expect(productLayers(box,false,true,1.4)).toEqual([{box,rotation:0,motionIndex:0,front:true}]))
})
