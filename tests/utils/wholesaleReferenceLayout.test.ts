import { expect,it } from 'vitest'
import {createWholesaleReferenceTemplateJson,applyWholesaleReferenceCardLayout} from '~/utils/wholesaleReferenceLayout'
import {isProductLabelTemplateCompatible} from '~/utils/productLabelCompatibility'
it('mantem condicao abaixo das duas faixas e suporta os quatro precos',()=>{
 const group=createWholesaleReferenceTemplateJson()
 expect(group.objects.filter(o => 'fontFamily' in o).every(o => o.fontFamily === 'Barlow')).toBe(true)
 const find=(name:string):any=>group.objects.find(o=>o.name===name)!
 expect(find('atac_banner_bg').top).toBeGreaterThan(find('atac_wholesale_bg').top)
 expect(find('atac_wholesale_bg').top).toBeGreaterThan(find('atac_retail_bg').top)
 expect(find('wholesale_price_text').fontSize).toBeGreaterThan(find('retail_price_text').fontSize)
 expect(isProductLabelTemplateCompatible({offerFormat:'wholesale-pack-v1',packageLabel:'SIXPACK',packQuantity:6,pricePack:'33,78',priceUnit:'5,63',priceSpecial:'31,74',priceSpecialUnit:'5,29'},{group})).toBe(true)
})
it('aplica imagem esquerda e etiqueta direita somente ao novo modelo',()=>{
 const obj=(p:any)=>({...p,set(v:any){Object.assign(this,v)}})
 const image=obj({name:'smart_image',width:100,height:250})
 const label=obj({name:'priceGroup',width:240,height:320,getObjects:()=>createWholesaleReferenceTemplateJson().objects})
 const title=obj({name:'smart_title'})
 const card={getObjects:()=>[image,label,title]}
 expect(applyWholesaleReferenceCardLayout(card,500,400)).toBe(true)
 expect(image.left).toBeLessThan(0)
 expect(label.left).toBeGreaterThan(0)
 expect(title.top).toBeLessThan(image.top)
 expect(applyWholesaleReferenceCardLayout({getObjects:()=>[image,obj({name:'priceGroup',getObjects:()=>[]})]},500,400)).toBe(false)
})
