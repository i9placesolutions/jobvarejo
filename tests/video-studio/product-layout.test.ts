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
  expect(productLayers(area,true,true,1.85)).toHaveLength(1)
  for(const layer of productLayers(area,true,true,.4)){
   expect(layer.box[3]).toBe(490)
   expect(layer.box[2]).toBe(196)
  }
 })
 it('preserva produtos largos como um destaque grande',()=>expect(productLayers(box,false,true,1.4)).toEqual([{box,rotation:0,motionIndex:0,front:true}]))
 it('agrupa as fotos visíveis sem vazios e centraliza o conjunto nos dois formatos',()=>{
  const area=[60,769,960,611] as const
  for(const vertical of [true,false])for(const copies of [undefined,2,3] as const){
   const layers=productLayers(area,vertical,true,.737,copies)
   for(let i=1;i<layers.length;i++){
    const previous=layers[i-1]!.box,next=layers[i]!.box
    expect(next[0]).toBeLessThan(previous[0]+previous[2])
   }
   const first=layers[0]!.box,last=layers.at(-1)!.box
   expect(first[0]-area[0]).toBeCloseTo(area[0]+area[2]-last[0]-last[2])
   for(const layer of layers)expect(layer.box[2]/layer.box[3]).toBeCloseTo(.737)
  }
  // Arroz da referência: +25% de altura, com duas embalagens inteiras.
  expect(productLayers(area,true,true,.737)[0]!.box[3]/486).toBeGreaterThan(1.25)
 })
 it('empilha produtos largos nos Reels e distribui embalagens altas lado a lado',()=>{
  const area=[80,700,650,800] as const
  const stacked=productLayers(area,true,true,1.4)
  expect(stacked).toHaveLength(2)
  expect(stacked[0]!.box[0]).toBe(stacked[1]!.box[0])
  expect(stacked[1]!.box[1]).toBeGreaterThan(stacked[0]!.box[1])
  expect(stacked[0]!.box[2]).toBe(area[2])
  expect(stacked[1]!.box[1]).toBeLessThan(stacked[0]!.box[1]+stacked[0]!.box[3])
  const side=productLayers(area,true,true,.4)
  expect(side[0]!.box[1]).toBe(side[1]!.box[1])
  expect(side[1]!.box[0]).toBeGreaterThan(side[0]!.box[0])
  for(const layers of [stacked,side])for(const {box:[x,y,w,h]} of layers){
   expect(x).toBeGreaterThanOrEqual(area[0]);expect(y).toBeGreaterThanOrEqual(area[1])
   expect(x+w).toBeLessThanOrEqual(area[0]+area[2]+.001)
   expect(y+h).toBeLessThanOrEqual(area[1]+area[3]+.001)
  }
 })
 it('preenche a largura com duas fotos largas sem diminuir a carne para separar as cópias',()=>{
  const area=[60,769,960,611] as const
  const layers=productLayers(area,true,false,2.5,2)
  for(const layer of layers){
   expect(layer.box[2]).toBe(area[2])
   expect(layer.box[3]).toBeCloseTo(area[2]/2.5)
  }
  const first=layers[0]!.box,last=layers[1]!.box
  const span=last[1]+last[3]-first[1]
  expect(span/area[3]).toBeGreaterThan(.95)
  expect(last[1]).toBeLessThan(first[1]+first[3])
  expect(first[1]-area[1]).toBeCloseTo(area[1]+area[3]-last[1]-last[3])
  for(const vertical of [true,false])for(const copies of [2,3] as const){
   for(const ratio of [1.6,2,2.5,3])for(const {box:[x,y,w,h]} of productLayers(area,vertical,false,ratio,copies)){
    expect(x).toBeGreaterThanOrEqual(area[0]);expect(y).toBeGreaterThanOrEqual(area[1])
    expect(x+w).toBeLessThanOrEqual(area[0]+area[2]+.001)
    expect(y+h).toBeLessThanOrEqual(area[1]+area[3]+.001)
    expect(w/h).toBeCloseTo(ratio)
   }
  }
 })
 it('adapta quantidade, eixo e sobreposição automaticamente à foto',()=>{
  const area=[60,769,960,611] as const
  expect(productLayers(area,true,true,.267)).toHaveLength(2)
  expect(productLayers(area,false,true,.267)).toHaveLength(3)
  expect(productLayers(area,true,true,area[2]/area[3])).toHaveLength(1)
  const broad=productLayers(area,true,true,2.4213836477987423)
  const wider=productLayers(area,true,true,3)
  for(const layers of [broad,wider]){
   expect(layers).toHaveLength(2)
   expect(layers[0]!.box[2]).toBeCloseTo(area[2])
   expect(layers[1]!.box[1]+layers[1]!.box[3]-layers[0]!.box[1]).toBeCloseTo(area[3])
  }
  const overlap=(layers:ReturnType<typeof productLayers>)=>1-(layers[1]!.box[1]-layers[0]!.box[1])/layers[0]!.box[3]
  expect(overlap(broad)).toBeGreaterThan(overlap(wider))
  expect(productLayers(area,true,false,3)).toHaveLength(1)
  expect(productLayers(area,true,true,3,1)).toHaveLength(1)
 })

})
