import { expect, it } from 'vitest'
import { splitFooterValidityText, isSplitFooterValidity } from '../../utils/splitFooterValidity'
it('mantém título, período e estoque separados', () => {
 expect(splitFooterValidityText({startDate:'2026-09-14',endDate:'2026-09-19',mode:'date_range'})).toEqual({heading:'OFERTA VÁLIDA DE',period:'14 A 19 DE SETEMBRO',stock:'OU ENQUANTO DURAREM OS ESTOQUES'})
 expect(splitFooterValidityText({startDate:'2026-09-30',endDate:'2026-10-02',mode:'date_range',whileStocks:false}).period).toBe('30 DE SETEMBRO A 2 DE OUTUBRO')
 expect(splitFooterValidityText({mode:'while_stocks'}).stock).toBe('')
 expect(splitFooterValidityText({startDate:'2026-02-31'}).period).toBe('')
 expect(isSplitFooterValidity({quickDataField:'validity'})).toBe(false)
})

import { hasSplitFooterValidityCompanions, resolveSplitFooterValidityText } from '../../utils/splitFooterValidity'
it('mantém chamada, período e estoque quando o modelo tem somente o campo da data', () => {
  const field = { parentFrameId: 'frame-a', name: 'dynamic-validity', quickDataField: 'validity' }
  expect(resolveSplitFooterValidityText(field, [field], { startDate: '2026-09-12', endDate: '2026-09-13', mode: 'date_range', whileStocks: true }))
    .toBe('OFERTA VÁLIDA DE\n12 A 13 DE SETEMBRO\nOU ENQUANTO DURAREM OS ESTOQUES')
  expect(hasSplitFooterValidityCompanions(field, [{ name: 'validity-heading', parentFrameId: 'frame-b' }, { name: 'stock-validity', parentFrameId: 'frame-b' }])).toBe(false)
})
it('mantém só o período quando os dois textos complementares existem no mesmo frame', () => {
  const field = { parentFrameId: 'frame-a' }
  const siblings = ['validity-heading', 'stock-validity'].map(name => ({ name, parentFrameId: 'frame-a' }))
  expect(resolveSplitFooterValidityText(field, siblings, { startDate: '2026-09-12', endDate: '2026-09-13' })).toBe('12 A 13 DE SETEMBRO')
})
it('respeita estoque desativado e datas ausentes no campo completo', () => {
  expect(resolveSplitFooterValidityText({}, [], { startDate: '2026-09-12', whileStocks: false })).toBe('OFERTA VÁLIDA DE\n12 DE SETEMBRO')
  expect(resolveSplitFooterValidityText({}, [], {})).toBe('')
})

it('mantém o quadro de calendário da referência ao trocar datas', () => {
 const field = { quickValidityLayout: 'calendar-card', parentFrameId: 'frame-a' }
 const siblings = ['validity-heading', 'stock-validity'].map(name => ({name, parentFrameId: 'frame-a'}))
 expect(isSplitFooterValidity(field)).toBe(true)
 expect(resolveSplitFooterValidityText(field, siblings, {startDate:'2026-09-13',endDate:'2026-09-14'})).toBe('13 E 14 DE\nSETEMBRO')
 expect(splitFooterValidityText({startDate:'2026-09-13',endDate:'2026-09-16',layout:'calendar-card'})).toEqual({heading:'OFERTAS VÁLIDAS DIAS',period:'13 A 16 DE\nSETEMBRO',stock:'ENQUANTO DURAREM OS ESTOQUES'})
 expect(splitFooterValidityText({startDate:'2026-09-30',endDate:'2026-10-01',layout:'calendar-card',whileStocks:false}).period).toBe('30 DE SETEMBRO A 1 DE OUTUBRO')
 expect(splitFooterValidityText({mode:'while_stocks',layout:'calendar-card'}).stock).toBe('')
})
