import {describe,it,expect} from 'vitest'
import {readVideoJsonParts} from '../../shared/video-studio/read-json-parts'
describe('Leitura limitada de dados de vídeo',()=>{
 it('preserva JSON grande, acentos e caracteres fora do BMP entre partes',async()=>{
  const expected={name:'Promoção',text:'🔥'.repeat(1005)+'á'.repeat(2100)}
  const chars=Array.from(JSON.stringify(expected))
  const actual=await readVideoJsonParts(async(_sql,values)=>({rows:[{part:chars.slice(values.at(-1)-1,values.at(-1)-1+1000).join('')}]}),'SELECT data',[])
  expect(actual).toEqual(expected)
 })
 it('não devolve dados parciais quando a linha não existe',async()=>{
  expect(await readVideoJsonParts(async()=>({rows:[]}),'SELECT data',[])).toBeNull()
 })
})
