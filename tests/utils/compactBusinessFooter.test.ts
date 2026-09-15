import { expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
const object = (values: any) => ({ ...values, set(patch: any) { Object.assign(this, patch) } })
it('reduz para o novo layout preservando a base e não compacta novamente', () => {
 const bg = object({name:'footer-premium-background',type:'rect',top:1170,left:0,width:1080,height:180})
 const text = object({name:'dynamic-instagram',type:'textbox',businessProfileField:'instagram',top:1207,left:86,fontSize:25})
 const objects = [bg,text]
 expect(compactBusinessFooter(objects)).toBe(true)
 expect(bg.top+bg.height).toBe(1350)
 expect(bg.height).toBe(220)
 expect(text.fontFamily).toBe('Barlow')
 expect(text.fontWeight).toBe(800)
 expect(compactBusinessFooter(objects)).toBe(false)
})

it('empilha os contatos e reserva um painel próprio para cartões', () => {
 const bg = object({name:'footer-premium-background',parentFrameId:'frame',left:0,top:1230,width:1080,height:120,fill:'#a30e14'})
 const fields = ['instagram','whatsapp','address']
 const boxes = fields.map(field => object({name:`footer-contact-${field}`,parentFrameId:'frame',left:0,top:1230,width:200,height:50,fill:'#f3d8d8'}))
 const titles = fields.map(field => object({name:`footer-title-${field}`,parentFrameId:'frame',text:field,left:0,top:1230,width:200,height:12,fill:'#07196a'}))
 const dynamic = fields.map(field => object({name:`footer-dynamic-${field}`,parentFrameId:'frame',businessProfileField:field,left:0,top:1230,width:200,height:20,fill:'#07196a'}))
 const paymentBox = object({name:'footer-contact-payments',parentFrameId:'frame',left:0,top:1230,width:200,height:30})
 const paymentTitle = object({name:'footer-title-footerPaymentImages',parentFrameId:'frame',text:'CARTÕES ACEITOS',left:0,top:1230,width:200,height:12})
 const payment = object({name:'footer-payment-images',parentFrameId:'frame',businessProfileField:'footerPaymentImages',left:0,top:1230,width:200,height:20})
 const objects = [bg,...boxes,...titles,...dynamic,paymentBox,paymentTitle,payment]
 expect(compactBusinessFooter(objects)).toBe(true)
 expect(boxes[1].top).toBeGreaterThan(boxes[0].top)
 expect(boxes[1].left).toBe(boxes[0].left)
 expect(boxes[2].left).toBe(boxes[0].left)
 expect(boxes[2].top).toBeGreaterThan(boxes[1].top)
 expect(paymentBox.left).toBeGreaterThan(boxes[0].left)
 expect(payment.left).toBe(paymentTitle.left)
 expect(payment.footerPaymentWidth).toBe(payment.width)
 expect(boxes[0].fill).toBe('rgba(255,255,255,0.12)')
 expect(titles[0].fill).toBe('#ffffff')
 expect(dynamic[0].fill).toBe('#ffffff')
})
