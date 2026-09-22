import {describe,it,expect} from 'vitest'
import {readVideoJsonParts} from '../../shared/video-studio/read-json-parts'
describe('Leitura limitada de dados de vídeo',()=>{
 it('preserva JSON grande, acentos e caracteres fora do BMP entre partes',async()=>{
  const expected={name:'Promoção',text:'🔥'.repeat(1005)+'á'.repeat(2100)}
  const chars=Array.from(JSON.stringify(expected))
  const actual=await readVideoJsonParts(async()=>({rows:Array.from({length:Math.ceil(chars.length/1000)},(_,index)=>({part:chars.slice(index*1000,index*1000+1000).join(''),total_chars:chars.length}))}),'SELECT data',[])
  expect(actual).toEqual(expected)
 })
 it('não devolve dados parciais quando a linha não existe',async()=>{
  expect(await readVideoJsonParts(async()=>({rows:[]}),'SELECT data',[])).toBeNull()
 })
})
