import { expect, it } from 'vitest'
import { getExplicitFlavorQueries } from '../../utils/productFlavorQueries'
it('separa uva e morango sem perder produto, marca e embalagem',()=>{
 const queries=getExplicitFlavorQueries('SUCO MARCA UVA E MORANGO 1 LT')
 expect(queries).toHaveLength(2)
 expect(queries.find(x=>x.flavor==='uva')?.query).toBe('suco marca 1 lt uva')
 expect(queries.find(x=>x.flavor==='morango')?.query).toBe('suco marca 1 lt morango')
})
it('não inventa sabores genéricos nem usa partes de palavras',()=>{
 expect(getExplicitFlavorQueries('SUCO SABORES 1 LT')).toEqual([])
 expect(getExplicitFlavorQueries('MACARRÃO COM COCO')).toEqual([])
 expect(getExplicitFlavorQueries('SUCO UVA')).toEqual([])
})
