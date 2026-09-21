import { expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
const fixture = () => {
 const bg = {name:'footer-premium-background',parentFrameId:'frame',left:0,top:1170,width:1080,height:180,fill:'#a30e14'}
 const field = (businessProfileField: string, text: string) => ({businessProfileField,text,type:'textbox',parentFrameId:'frame',visible:true, left:0,top:1200,width:200,height:20})
 const logo = {name:'footer-logo-slot',businessProfileField:'logo',type:'image',parentFrameId:'frame',left:0,top:1200,width:300,height:100,visible:true}
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
 const icon={name:'icon-whatsapp',parentFrameId:'frame',left:0,top:1200,visible:true}
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

it('deixa a marca e o WhatsApp no cabeçalho ao organizar o rodapé de duas colunas', () => {
 const f=fixture()
 Object.assign(f.bg,{footerLayout:'contacts-address'})
 Object.assign(f.logo,{name:'header-logo-slot',top:90,left:640})
 const headerPhone={...f.phone,name:'header-whatsapp',top:260,left:640}
 const headerIcon={name:'header-icon-whatsapp',parentFrameId:'frame',top:260,left:590,width:40,height:40}
 const unnamedHeaderPhone={...headerPhone,name:'dynamic-whatsapp'}
 f.objects.unshift(headerPhone,headerIcon,unnamedHeaderPhone)
 const headerSnapshot=JSON.stringify([f.logo,headerPhone,headerIcon,unnamedHeaderPhone])
 compactBusinessFooter(f.objects)
 expect(JSON.stringify([f.logo,headerPhone,headerIcon,unnamedHeaderPhone])).toBe(headerSnapshot)
 expect(f.phone.left).toBeLessThan(50)
 expect(f.phone.left).toBe(f.instagram.left)
 expect(f.address.width * (f.address as any).scaleX).toBeGreaterThan(f.phone.width * (f.phone as any).scaleX)
})

it('mantém o Instagram inteiro em uma linha e o endereço dentro do seu bloco', () => {
 const f=fixture()
 Object.assign(f.bg,{footerLayout:'contacts-address',height:120,top:1230})
 f.phone.top=f.instagram.top=f.address.top=1240
 f.instagram.text='@SUPERMERCADORODRIGUES_SRV'
 f.address.text='RUA GARIBALDI LEÃO, 275, BAIRRO MARTINS, RIO VERDE, GOIÁS, AO LADO DA PRAÇA CENTRAL'
 const addressText=f.address.text
 compactBusinessFooter(f.objects)
 expect(f.instagram.text).toBe('@SUPERMERCADORODRIGUES_SRV')
 expect(f.instagram.text).not.toContain('\n')
 expect(f.address.text).toBe(addressText)
 for (const field of [f.phone,f.instagram,f.address] as any[]) {
   expect(field.left+field.width*field.scaleX).toBeLessThanOrEqual(1080)
   expect(field.top+field.height*field.scaleY).toBeLessThanOrEqual(1350)
   expect(field.scaleX).toBe(field.scaleY)
 }
 const snapshot=JSON.stringify(f.objects)
 compactBusinessFooter(f.objects)
 expect(JSON.stringify(f.objects)).toBe(snapshot)
})

it('preserva fonte, cor, estilos e valores manuais ao ajustar o bloco', () => {
 const f=fixture()
 Object.assign(f.bg,{footerLayout:'contacts-address'})
 const styles={0:{0:{fontWeight:400,fill:'#00ff00'}}}
 Object.assign(f.instagram,{fontFamily:'Arial',fontWeight:500,fontSize:28,dynamicFieldBaseFontSize:28,
   dynamicFieldTextColor:'#f0baff',styles,__manualTypography:true,dynamicUserText:'@MINHALOJA',dynamicUserTextSource:'quick-user'})
 compactBusinessFooter(f.objects)
 expect(f.instagram).toMatchObject({fontFamily:'Arial',fontWeight:500,fontSize:28,fill:'#f0baff',styles,
   dynamicUserText:'@MINHALOJA',dynamicUserTextSource:'quick-user'})
 const address={...f.address,__manualTransform:true,left:701,top:1202,fontSize:22,scaleX:.7,scaleY:.7}
 const saved=JSON.stringify(address)
 f.objects.splice(f.objects.indexOf(f.address),1,address)
 compactBusinessFooter(f.objects)
 expect(JSON.stringify(address)).toBe(saved)
})

it('expande o endereço na ausência de contatos e recolhe seus ícones e divisória', () => {
 const f=fixture()
 Object.assign(f.bg,{footerLayout:'contacts-address'})
 f.phone.visible=false;f.instagram.visible=false
 const divider={name:'footer-column-divider-1',parentFrameId:'frame',visible:true}
 const icon={name:'icon-instagram',parentFrameId:'frame',left:10,top:1210,width:40,height:40,visible:true}
 f.objects.push(divider,icon)
 compactBusinessFooter(f.objects)
 expect(divider.visible).toBe(false)
 expect(icon.visible).toBe(false)
 expect(f.address.left).toBeLessThan(20)
 expect(f.address.width * (f.address as any).scaleX).toBeGreaterThan(1000)
})
