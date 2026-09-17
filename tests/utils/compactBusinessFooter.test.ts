import { expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
const fixture = () => {
 const bg = {name:'footer-premium-background',parentFrameId:'frame',left:0,top:1170,width:1080,height:180,fill:'#a30e14'}
 const field = (businessProfileField: string, text: string) => ({businessProfileField,text,type:'textbox',parentFrameId:'frame',visible:true, left:0,top:1200,width:200,height:20})
 const logo = {businessProfileField:'logo',type:'image',parentFrameId:'frame',width:300,height:100,visible:true}
 const instagram=field('instagram','@mercado')
 const phone=field('whatsapp','(85) 3030-3030 · (85) 3939-3939')
 const address=field('address','Rua Um, 25 · Rua Dois, 30')
 return {bg,logo,instagram,phone,address,objects:[bg,logo,instagram,phone,address] as any[]}
}
it('organiza marca, telefones e endereços em três colunas e preserva o fundo', () => {
 const f=fixture(); compactBusinessFooter(f.objects)
 expect(f.phone.left).toBeGreaterThan(f.instagram.left)
 expect(f.address.left).toBeGreaterThan(f.phone.left)
 expect(f.phone.text.split('\n')).toHaveLength(2)
 expect(f.bg.top+f.bg.height).toBe(1350)
 expect((f.logo as any).scaleX).toBe((f.logo as any).scaleY)
 const snapshot=JSON.stringify(f.objects)
 compactBusinessFooter(f.objects)
 expect(JSON.stringify(f.objects)).toBe(snapshot)
})
it('centraliza um único telefone sem reservar a segunda linha', () => {
 const f=fixture();compactBusinessFooter(f.objects);const previous=f.phone.top
 f.phone.text='(85) 3030-3030';compactBusinessFooter(f.objects)
 expect(f.phone.top).toBeGreaterThan(previous)
 expect(f.phone.text).not.toContain('\n')
})
it('reaproveita a coluna de endereço vazio e não altera outro frame', () => {
 const f=fixture();const other={...f.phone,parentFrameId:'other'};f.objects.push(other)
 compactBusinessFooter(f.objects);const before=f.phone.width
 f.address.visible=false;compactBusinessFooter(f.objects)
 expect(f.phone.width).toBeGreaterThan(before)
 expect(other.left).toBe(0)
})
it('oculta decoração antiga e ícone sem dados', () => {
 const f=fixture();f.phone.visible=false
 const icon={name:'icon-whatsapp',parentFrameId:'frame',visible:true}
 const panel={name:'footer-contact-whatsapp',parentFrameId:'frame',visible:true}
 f.objects.push(icon,panel);compactBusinessFooter(f.objects)
 expect(icon.visible).toBe(false);expect(panel.visible).toBe(false)
})
it('recolhe a divisória da coluna que desaparece', () => {
 const f=fixture()
 const first={name:'footer-column-divider-1',parentFrameId:'frame',visible:true,left:0,top:0,width:1,height:20}
 const second={...first,name:'footer-column-divider-2'}
 f.objects.push(first,second)
 compactBusinessFooter(f.objects)
 expect(first.visible).toBe(true)
 expect(second.visible).toBe(true)
 expect(first.left).toBeLessThan(f.phone.left)
 expect(second.left).toBeLessThan(f.address.left)
 f.address.visible=false
 compactBusinessFooter(f.objects)
 expect(first.visible).toBe(true)
 expect(second.visible).toBe(false)
})
it('isola logo ampliada e agrupa Instagram abaixo do WhatsApp', () => {
 const f=fixture()
 compactBusinessFooter(f.objects)
 const previousHeight=(f.logo as any).quickLogoMaxHeight
 Object.assign(f.bg,{footerLayout:'logo-contacts-address'})
 compactBusinessFooter(f.objects)
 expect(f.instagram.left).toBe(f.phone.left)
 expect(f.instagram.top).toBeGreaterThan(f.phone.top)
 expect((f.logo as any).quickLogoMaxHeight).toBeGreaterThan(previousHeight)
 expect(f.address.left).toBeGreaterThan(f.instagram.left)
})
