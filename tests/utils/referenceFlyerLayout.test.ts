import { describe, it, expect } from 'vitest'
import { splitFooterValidityText } from '../../utils/splitFooterValidity'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
import { layoutOfferValidityBanner } from '../../utils/offerValidityBanner'

const object=(values:any):any=>({type:'rect',left:0,top:0,width:100,height:20,scaleX:1,scaleY:1,visible:true,parentFrameId:'f',...values,
 set(p:any){Object.assign(this,p)},setCoords(){},getBoundingRect(){return{left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY}}})
const text=(values:any):any=>object({type:'textbox',text:'',fontSize:30,...values,calcTextWidth(){return this.text.length*this.fontSize*.53},
 initDimensions(){this.textLines=Array(Math.max(1,Math.ceil(this.calcTextWidth()/this.width))).fill(this.text);this.height=this.fontSize*1.13*this.textLines.length},
 calcTextHeight(){return this.height},getLineWidth(){return this.calcTextWidth()}})

describe('layout fiel à referência de varejo',()=>{
 it('compõe quinta-feira com data numérica e estoques na segunda linha',()=>{
  expect(splitFooterValidityText({layout:'reference-ribbon',mode:'single_day',startDate:'2026-09-17',whileStocks:true})).toEqual({heading:'OFERTA VÁLIDA SOMENTE NESTA QUINTA',period:'17/09/2026 OU ENQUANTO DURAREM OS ESTOQUES',stock:''})
  expect(splitFooterValidityText({layout:'reference-ribbon',mode:'single_day',startDate:'2026-09-19',whileStocks:false}).heading).toBe('OFERTA VÁLIDA SOMENTE NESTE SÁBADO')
  expect(splitFooterValidityText({layout:'reference-ribbon',mode:'while_stocks'}).period).toBe('ENQUANTO DURAREM OS ESTOQUES')
  expect(splitFooterValidityText({layout:'reference-ribbon',mode:'date_range',startDate:'2026-09-24',endDate:'2026-09-25',dateFormat:'long'}).period).toBe('VINTE E QUATRO A VINTE E CINCO DE SETEMBRO OU ENQUANTO DURAREM OS ESTOQUES')
  expect(splitFooterValidityText({layout:'reference-ribbon',mode:'period',startDate:'2026-02-30'}).period).toBe('')
 })
 it('mantém ambas as linhas dentro da parte segura, fora da ponta inclinada',()=>{
  const band=object({name:'standard-validity-background',type:'path',left:20,top:346,width:636,height:80})
  const heading=text({name:'validity-heading',text:'OFERTA VÁLIDA SOMENTE NESTA QUINTA'})
  const date=text({quickValidityLayout:'reference-ribbon',text:'17/09/2026 OU ENQUANTO DURAREM OS ESTOQUES'})
  const stock=text({name:'stock-validity',text:''})
  const nodes=[band,heading,date,stock]
  layoutOfferValidityBanner(nodes)
  for(const o of [heading,date]){const b=o.getBoundingRect();expect(b.left).toBeGreaterThan(20);expect(b.left+b.width).toBeLessThan(630);expect(b.top+b.height).toBeLessThan(426)}
  expect(heading.top+heading.height*heading.scaleY).toBeLessThan(date.top)
  expect(stock.visible).toBe(false)
  expect(layoutOfferValidityBanner(nodes)).toBe(false)
  date.visible=false;layoutOfferValidityBanner(nodes);expect(band.visible).toBe(false)
 })
 it('acomoda endereço longo e recolhe chamada/ícone sem WhatsApp',()=>{
  const bg=object({name:'footer-premium-background',footerLayout:'reference-contacts',left:0,top:1228,width:1080,height:122})
  const phone=text({name:'footer-dynamic-whatsapp',text:'(64) 99618-5163',businessProfileField:'whatsapp'})
  const address=text({name:'footer-dynamic-address',text:'RUA GARIBALDI LEÃO Nº 277, BAIRRO MARTINS, RIO VERDE - GO',businessProfileField:'address'})
  const instagram=text({name:'footer-dynamic-instagram',text:'@supermercadorodriguesrv',businessProfileField:'instagram'})
  const label=text({name:'footer-reference-whatsapp-label',text:'PEÇA PELO NOSSO WHATSAPP'})
  const divider=object({name:'footer-column-divider-1'})
  const icon=object({name:'icon-whatsapp'})
  const addressLabel=text({name:'footer-reference-address-label',text:'ENDEREÇO',fill:'#ffe535'})
  const pin=object({name:'icon-address',width:16,height:22})
  const nodes=[bg,phone,address,instagram,label,divider,icon,addressLabel,pin]
  compactBusinessFooter(nodes)
  for(const o of [phone,address,instagram]){const b=o.getBoundingRect();expect(b.left+b.width).toBeLessThan(1080);expect(b.top+b.height).toBeLessThan(1350)}
  expect(addressLabel.fill).toBe('#ffe535')
  expect(pin.height*pin.scaleY).toBeCloseTo(72)
  expect(address.top).toBeGreaterThan(addressLabel.top)
  expect(compactBusinessFooter(nodes)).toBe(false)
  phone.visible=false;compactBusinessFooter(nodes)
  expect(label.visible).toBe(false);expect(icon.visible).toBe(false);expect(divider.visible).toBe(false)
  expect(address.left).toBe(112)
 })
})

it('reduz Instagram longo na faixa e restaura tamanho para um nome curto',()=>{
 const band=object({name:'header-instagram-background',left:567,top:364,width:484,height:52})
 const field=text({name:'header-instagram',businessProfileField:'instagram',text:'@'+ 'supermercado'.repeat(12),fontSize:28,__manualTransform:true})
 const icon=object({name:'header-icon-instagram',width:22,height:22})
 const nodes=[band,field,icon]
 compactBusinessFooter(nodes)
 expect(field.scaleX).toBeLessThan(1)
 const b=field.getBoundingRect()
 expect(b.left+b.width).toBeLessThan(1051)
 expect(b.top+b.height).toBeLessThan(416)
 expect(field.text).toBe('@'+'supermercado'.repeat(12))
 expect(field.__manualTransform).toBe(true)
 const longWidth=band.width, center=band.left+band.width/2
 field.text='@loja';compactBusinessFooter(nodes)
 expect(band.width).toBeLessThan(longWidth)
 expect(band.left+band.width/2).toBeCloseTo(center)
 field.text='@supermercado_da_cidade';compactBusinessFooter(nodes)
 expect(band.width).toBeGreaterThan(100)
 expect(band.left+band.width/2).toBeCloseTo(center)
 field.text='@loja';compactBusinessFooter(nodes)
 expect(field.scaleX).toBe(1)
 expect(compactBusinessFooter(nodes)).toBe(false)
 field.text='';compactBusinessFooter(nodes)
 expect(band.visible).toBe(false);expect(icon.visible).toBe(false)
})

it('mantém contatos e ícones dentro do rodapé com altura reduzida',()=>{
 const bg=object({name:'footer-premium-background',footerLayout:'reference-contacts',top:972,width:1080,height:108})
 const phone=text({name:'footer-dynamic-whatsapp',text:'(11) 99999-9999'})
 const address=text({name:'footer-dynamic-address',text:'AVENIDA MUITO LONGA, 12345, BLOCO B, BAIRRO CENTRO, CIDADE - UF'})
 const label=text({name:'footer-reference-address-label',text:'ENDEREÇO'})
 const pin=object({name:'icon-address',width:16,height:22})
 const nodes=[bg,phone,address,label,pin]
 compactBusinessFooter(nodes)
 for(const o of [phone,address,pin]){const b=o.getBoundingRect();expect(b.top).toBeGreaterThan(972);expect(b.top+b.height).toBeLessThan(1080)}
 expect(address.text).toContain('CIDADE - UF')
 expect(compactBusinessFooter(nodes)).toBe(false)
})

it('preserva a posição manual dos elementos do rodapé de referência ao reabrir',()=>{
 const bg=object({name:'footer-premium-background',footerLayout:'reference-contacts',top:1228,width:1080,height:122})
 const phone=text({name:'footer-dynamic-whatsapp',text:'(64) 99618-5163'})
 const address=text({name:'footer-dynamic-address',text:'OFERTAS VÁLIDAS SOMENTE NAS LOJAS DE RIO VERDE - GO',__manualTransform:true,left:701,top:1268,width:420,height:48,scaleX:.82,scaleY:.82})
 const label=text({name:'footer-reference-address-label',text:'ENDEREÇO',__manualTransform:true,left:701,top:1240,width:420,height:24})
 const pin=object({name:'icon-address',width:16,height:22,__manualTransform:true,left:612,top:1243,scaleX:3,scaleY:3})
 const divider=object({name:'footer-column-divider-1',__manualTransform:true,left:580,top:1236,width:2,height:98})
 const nodes=[bg,phone,address,label,pin,divider]
 const snapshot=JSON.stringify({address:[address.left,address.top,address.width,address.height,address.scaleX,address.scaleY],label:[label.left,label.top,label.width],pin:[pin.left,pin.top,pin.scaleX,pin.scaleY],divider:[divider.left,divider.top,divider.width,divider.height]})
 compactBusinessFooter(nodes)
 expect(JSON.stringify({address:[address.left,address.top,address.width,address.height,address.scaleX,address.scaleY],label:[label.left,label.top,label.width],pin:[pin.left,pin.top,pin.scaleX,pin.scaleY],divider:[divider.left,divider.top,divider.width,divider.height]})).toBe(snapshot)
 expect(compactBusinessFooter(nodes)).toBe(false)
})
