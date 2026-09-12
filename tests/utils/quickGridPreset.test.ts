import { expect, it } from 'vitest'
import { quickGridRows } from '../../utils/quickGridPreset'
it('restaura oito produtos em duas colunas e quatro fileiras',()=>expect(quickGridRows(8,'model')).toEqual([2,2,2,2]))
it('distribui sete produtos no padrão 2 + 2 + 3',()=>expect(quickGridRows(7,'model')).toEqual([2,2,3]))
it('permite escolher colunas sem perder ou duplicar produtos',()=>{
 for(let count=1;count<=24;count++)for(const preset of ['model','2','3'] as const)expect(quickGridRows(count,preset).reduce((a,b)=>a+b,0)).toBe(count)
 expect(quickGridRows(9,'3')).toEqual([3,3,3]);expect(quickGridRows(0,'model')).toEqual([])
})
