import { expect, it } from 'vitest'
import { layoutFamilyContacts } from '../../utils/familyContactLayout'
const obj=(p:any):any=>({width:100,height:30,scaleX:1,scaleY:1,left:0,top:0,set(v:any){Object.assign(this,v)},getBoundingRect(){return{left:this.left,top:this.top,width:this.width,height:this.height}},...p})
it('troca telefone e validade sem mover produtos e mantém a organização ao reaplicar',()=>{
 const frame=obj({isFrame:true,_customId:'f',name:'template-frame-fim-semana-familia-stories',width:1080,height:1920})
 const zone=obj({parentFrameId:'f',isProductZone:true,left:40,top:535,width:1000,height:1190})
 const date=obj({parentFrameId:'f',quickDataField:'validity',text:'OFERTA VÁLIDA DE\n12 A 13 DE SETEMBRO\nOU ENQUANTO DURAREM OS ESTOQUES'})
 const phone=obj({parentFrameId:'f',businessProfileField:'whatsapp',text:'(64) 99999-9999',top:1870})
 const cal=obj({parentFrameId:'f',name:'icon-validity'}),wa=obj({parentFrameId:'f',name:'icon-whatsapp'})
 const a=[frame,zone,date,phone,cal,wa],before=JSON.stringify(zone)
 expect(layoutFamilyContacts(a)).toBe(true)
 expect(phone.top).toBeLessThan(zone.top);expect(date.top).toBeGreaterThan(zone.top+zone.height)
 expect(cal.top).toBeCloseTo(date.top+2);expect(phone.fontSize).toBe(50)
 expect(JSON.stringify(zone)).toBe(before);expect(layoutFamilyContacts(a)).toBe(false)
 frame.name='outro-modelo';phone.top=100;expect(layoutFamilyContacts(a)).toBe(false);expect(phone.top).toBe(100)
})
