import {describe,it,expect} from 'vitest'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {defaultTransform,elementTransform,setElementTransform} from '../../shared/video-studio/layout-editing'
import {videoListIssue,videoOfferFromList} from '../../shared/video-studio/list-import'
import {parseProductsAuto} from '../../server/utils/product-text-parser'
import {productLayers} from '../../shared/video-studio/product-layout'
import {validateVideoForGeneration} from '../../shared/video-studio/model'
describe('Edição de vídeos e importação comercial',()=>{
 it('persiste posições por formato e cena sem alterar outro modelo',()=>{
  const doc=newVideoFromTemplate('alerta');setElementTransform(doc,'horizontal','intro','logo',{x:100,y:-40,scale:1.3,rotation:4})
  const saved=videoDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))
  expect(elementTransform(saved,'horizontal','intro','logo').x).toBe(100)
  expect(elementTransform(saved,'vertical','intro','logo')).toEqual(defaultTransform())
  expect(newVideoFromTemplate('alerta').layoutEdits).toBeUndefined()
 })
 it('rejeita campos de posição inválidos e escala perigosa',()=>{
  const doc=newVideoFromTemplate('alerta');doc.layoutEdits={vertical:{intro:{logo:{x:0,y:0,scale:999,rotation:0}}}}
  expect(videoDocumentSchema.safeParse(doc).success).toBe(false)
 })
 it('usa o parser do encarte e conserva preço, gramatura e limite',()=>{
  const raw=parseProductsAuto('Arroz Cristal 5kg 25,99 limite 3 por cliente')[0]!
  expect(videoListIssue(raw)).toBe('')
  const offer=videoOfferFromList(raw,'a')
  expect(offer.price).toBe('25,99');expect(offer.condition).toMatch(/3/)
 })
 it('não transforma vários preços em uma oferta simples silenciosamente',()=>expect(videoListIssue({name:'Arroz',price:'25,99',pricePack:'120,00'})).toMatch(/múltiplas/))
 it('reorganiza duas imagens na TV sem deixar ambas no mesmo lugar',()=>{
  const layers=productLayers([690,215,1130,735],false,true,.5,2)
  expect(layers).toHaveLength(2);expect(layers[1]!.box[0]-layers[0]!.box[0]).toBeGreaterThan(400)
 })
 it('não exporta a validade anterior quando falta uma das novas datas',()=>{const doc=newVideoFromTemplate('alerta');doc.validity='20 A 27/09';doc.validityRange={start:'2026-10-01',end:''};expect(validateVideoForGeneration(doc).join(' ')).toMatch(/data inicial e a data final/)})
 it('recusa exportar validade invertida',()=>{const doc=newVideoFromTemplate('alerta');doc.validityRange={start:'2026-09-25',end:'2026-09-20'};expect(validateVideoForGeneration(doc).join(' ')).toMatch(/data final/)})
})
