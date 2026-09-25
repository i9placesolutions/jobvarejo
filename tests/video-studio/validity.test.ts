import {describe,it,expect} from 'vitest'
import {videoValidityText} from '../../shared/video-studio/validity'
import {newVideoDocument,suggestVideoScripts,validateVideoForGeneration} from '../../shared/video-studio/model'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {videoFooterLayout} from '../../shared/video-studio/personalization'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
describe('validade no rodapé do vídeo',()=>{
 it('mostra um único dia e oculta totalmente a validade quando sem data',()=>{
  const doc=newVideoDocument()
  doc.validityMode='single_day';doc.validityRange={start:'2026-09-24',end:'2026-09-24'}
  expect(videoValidityText(doc)).toBe('')
  expect(validateVideoForGeneration(doc)).toContain('Escolha se a data aparece em números ou com o mês por extenso.')
  doc.validityDateFormat='long'
  expect(videoValidityText(doc)).toBe('Ofertas válidas em 24 de setembro')
  doc.validityDateFormat='numeric'
  expect(videoValidityText(doc)).toBe('Ofertas válidas em 24/09/2026')
  doc.validityMode='date_range';doc.validityRange.end='2026-09-25'
  expect(videoValidityText(doc)).toBe('Ofertas válidas de 24/09/2026 a 25/09/2026')
  doc.validityDateFormat='long'
  expect(videoValidityText(doc)).toBe('Ofertas válidas de 24 a 25 de setembro')
  doc.validityMode='none';doc.validity='DE 24/09/2026 A 24/09/2026'
  expect(videoValidityText(doc)).toBe('')
  expect(suggestVideoScripts(doc).at(-1)?.text).not.toContain('24/09/2026')
  expect(validateVideoForGeneration(doc)).not.toContain('Informe o dia da oferta.')
 })
 it('preserva modo e formato ao salvar e reabrir um vídeo',()=>{
  const doc=newVideoDocument()
  doc.validityMode='date_range';doc.validityDateFormat='long';doc.validityRange={start:'2026-09-24',end:'2026-09-25'}
  const saved=videoDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))
  expect(saved.validityMode).toBe('date_range')
  expect(saved.validityDateFormat).toBe('long')
  expect(videoValidityText(saved)).toBe('Ofertas válidas de 24 a 25 de setembro')
 })
 it('mostra o intervalo por extenso sem depender do fuso',()=>expect(videoValidityText({validity:'',validityRange:{start:'2026-09-22',end:'2026-09-23'}})).toBe('Ofertas válidas 22 a 23 de setembro de 2026'))
 it('mantém meses distintos e um único dia',()=>{
  expect(videoValidityText({validity:'',validityRange:{start:'2026-09-30',end:'2026-10-01'}})).toBe('Ofertas válidas 30 de setembro a 1 de outubro de 2026')
  expect(videoValidityText({validity:'',validityRange:{start:'2026-09-22',end:'2026-09-22'}})).toBe('Ofertas válidas em 22 de setembro de 2026')
 })
 it('preserva texto manual e não inventa ano nem normaliza datas impossíveis',()=>{
  expect(videoValidityText({validity:'Até 23/09, enquanto durar o estoque'})).toBe('Até 23 de setembro, enquanto durar o estoque')
  expect(videoValidityText({validity:'Até 31/02/2026'})).toBe('Até 31/02/2026')
 })
 it('compacta intervalos de modelos antigos e preserva ressalvas',()=>{
  expect(videoValidityText({validity:'OFERTAS VÁLIDAS DE  29/09/2026 A 30/09/2026, enquanto durarem os estoques'})).toBe('Ofertas válidas 29 a 30 de setembro de 2026, enquanto durarem os estoques')
  expect(videoValidityText({validity:'Ofertas válidas de 29 de setembro de 2026 a 30 de setembro de 2026'})).toBe('Ofertas válidas 29 a 30 de setembro de 2026')
  expect(videoValidityText({validity:'',validityRange:{start:'2026-12-31',end:'2027-01-02'}})).toBe('Ofertas válidas 31 de dezembro de 2026 a 2 de janeiro de 2027')
 })
 it('mantém validade abaixo da logo e dentro da margem nos dois formatos, sem alterar receitas',()=>{
  for(const recipe of Object.values(FLYER_RECIPES))for(const vertical of [true,false]){
   const original=vertical?recipe.vertical:recipe.horizontal,snapshot=JSON.stringify(original),layout=videoFooterLayout(original,vertical)
   expect(layout.validity[1]).toBeGreaterThan(layout.logo[1]+layout.logo[3])
   expect(layout.validity[1]+layout.validity[3]).toBeLessThanOrEqual(vertical?1860:1020)
   expect(JSON.stringify(original)).toBe(snapshot)
  }
 })
})
