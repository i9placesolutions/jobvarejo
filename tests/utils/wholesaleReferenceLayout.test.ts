import { expect,it } from 'vitest'
import {createWholesaleReferenceTemplateJson,applyWholesaleReferenceCardLayout,reflowWholesaleReferencePriceLabel} from '~/utils/wholesaleReferenceLayout'
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

it('preserva tamanho e posição manual da etiqueta em renderizações seguintes',()=>{
 const label:any={name:'priceGroup',width:240,height:320,left:120,top:14,scaleX:1.2,scaleY:1.1,__manualPricePosition:true,getObjects:()=>createWholesaleReferenceTemplateJson().objects,set(v:any){Object.assign(this,v)}}
 const card={getObjects:()=>[label]}
 for(let i=0;i<3;i++) applyWholesaleReferenceCardLayout(card,500,400)
 expect([label.left,label.top,label.scaleX,label.scaleY]).toEqual([120,14,1.2,1.1])
 label.__manualPricePosition=false
 label.__manualTransform=true
 applyWholesaleReferenceCardLayout(card,500,400)
 expect(label.scaleX).not.toBe(1.2)
})

it('recolhe a faixa avulsa ausente sem cortar a embalagem da referência',()=>{
 const label:any={...createWholesaleReferenceTemplateJson(),getObjects(){return this.objects}}
 const find=(name:string)=>label.objects.find((node:any)=>node.name===name)
 find('atac_retail_bg').visible=false
 find('reference_retail_heading').visible=false
 find('retail_currency_text').visible=false
 find('retail_price_text').visible=false
 find('retail_pack_line_text').visible=false
 expect(reflowWholesaleReferencePriceLabel(label)).toBe(true)
 expect(find('atac_wholesale_bg').top).toBeLessThan(53)
 expect(find('wholesale_banner_text').top).toBeLessThan(139)
 expect(find('wholesale_pack_line_text').top).toBeLessThan(93)
 expect(find('wholesale_pack_line_text').top).toBeGreaterThan(find('atac_wholesale_bg').top)
 expect(find('wholesale_banner_text').top).toBeGreaterThan(find('wholesale_pack_line_text').top)
})

it('restaura o empilhamento completo quando os dois preços voltam',()=>{
 const label:any={...createWholesaleReferenceTemplateJson(),getObjects(){return this.objects}}
 const find=(name:string)=>label.objects.find((node:any)=>node.name===name)
 find('atac_retail_bg').visible=false
 reflowWholesaleReferencePriceLabel(label)
 find('atac_retail_bg').visible=true
 reflowWholesaleReferencePriceLabel(label)
 expect(find('atac_retail_bg').top).toBe(-55)
 expect(find('atac_wholesale_bg').top).toBe(53)
 expect(find('wholesale_banner_text').top).toBe(139)
})
