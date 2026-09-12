import { expect, it } from 'vitest'
import { splitFooterValidityText, isSplitFooterValidity } from '../../utils/splitFooterValidity'
it('mantém título, período e estoque separados', () => {
 expect(splitFooterValidityText({startDate:'2026-09-14',endDate:'2026-09-19',mode:'date_range'})).toEqual({heading:'OFERTA VÁLIDA DE',period:'14 A 19 DE SETEMBRO',stock:'OU ENQUANTO DURAREM OS ESTOQUES'})
 expect(splitFooterValidityText({startDate:'2026-09-30',endDate:'2026-10-02',mode:'date_range',whileStocks:false}).period).toBe('30 DE SETEMBRO A 2 DE OUTUBRO')
 expect(splitFooterValidityText({mode:'while_stocks'}).stock).toBe('')
 expect(splitFooterValidityText({startDate:'2026-02-31'}).period).toBe('')
 expect(isSplitFooterValidity({quickDataField:'validity'})).toBe(false)
})
