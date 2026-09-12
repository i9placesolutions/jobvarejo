import { describe, expect, it, vi } from 'vitest'
import { createPriceGroupLayout } from '~/utils/priceGroupLayout'

describe('layout de etiquetas manuais', () => {
  it.each(['fardo-special-v1', undefined])('preserva o modelo manual da variante %s em cards de tamanhos diferentes', variant => {
    const objects = [{name:'atac_retail_bg',left:12,top:-80,width:280,height:70,fill:'#123456'}, {name:'retail_price_text',left:-47,top:-71,fontSize:32,text:'33,78'}]
    const group = { __atacarejoLabelVariant:variant, __preserveManualLayout:true, __forceAtacarejoCanonical:false, getObjects:()=>objects }
    const before = JSON.stringify(objects)
    const manual = vi.fn(()=>({width:280,height:240}))
    const snapshot = vi.fn()
    const layout=createPriceGroupLayout({getFabric:()=>({}),shouldPreserveManualTemplateVisual:()=>true,collectObjectsDeep:()=>objects,findByName:(all:any[],name:string)=>all.find(o=>o.name===name),fitManualAtacarejoValuesIntoTemplate:vi.fn(),layoutManualTemplateGroup:manual,rememberPriceLayoutSnapshot:snapshot} as any)
    layout.layoutPriceGroup(group,320,480)
    layout.layoutPriceGroup(group,540,900)
    expect(manual).toHaveBeenCalledTimes(2)
    expect(snapshot).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(objects)).toBe(before)
  })
})
