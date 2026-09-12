import { expect, it } from 'vitest'
import { manualPriceTierFits, fitAuthoredPriceTier } from '~/utils/manualPriceFitPolicy'
const bg={left:0,top:0,width:200,height:100,originX:'center',originY:'center'}
it('mantem posicao deslocada e escala nao uniforme que cabem na arte',()=>{
 const text={left:-60,top:-10,width:40,height:20,scaleX:1.5,scaleY:0.8,text:'12,99'}
 expect(manualPriceTierFits(bg,[text])).toBe(true)
})
it('continua ajustando valores que ultrapassam a etiqueta',()=>{
 expect(manualPriceTierFits(bg,[{left:50,top:0,width:90,height:20,text:'1.299,99'}])).toBe(false)
})
it('ignora campos vazios e ocultos',()=>{
 expect(manualPriceTierFits(bg,[{text:'',width:500},{text:'UN',visible:false,width:500}])).toBe(true)
})
it('nao considera medidas invalidas como um layout seguro',()=>{
 expect(manualPriceTierFits(bg,[{text:'12,99',width:NaN,height:20}])).toBe(false)
})

it('reduz o conjunto proporcionalmente sem alterar fontes ou espacamento relativo',()=>{
 const make=(v:any)=>({...v,set(p:any){Object.assign(this,p)}})
 const price=make({left:-100,top:0,width:300,height:40,scaleX:1,scaleY:1,text:'1.299,99',fontSize:48})
 const currency=make({left:-140,top:5,width:20,height:20,scaleX:1,scaleY:1,text:'R$',fontSize:18})
 fitAuthoredPriceTier(bg,[price,currency])
 expect(price.fontSize).toBe(48)
 expect(currency.fontSize).toBe(18)
 expect(price.scaleX).toBeCloseTo(currency.scaleX)
 expect(price.left-currency.left).toBeCloseTo(40*price.scaleX)
 expect(manualPriceTierFits(bg,[price,currency])).toBe(true)
 const before=JSON.stringify([price,currency])
 fitAuthoredPriceTier(bg,[price,currency])
 expect(JSON.stringify([price,currency])).toBe(before)
})
