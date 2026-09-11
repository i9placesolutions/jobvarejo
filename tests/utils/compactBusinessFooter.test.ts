import { expect, it } from 'vitest'
import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
const object = (values: any) => ({ ...values, set(patch: any) { Object.assign(this, patch) } })
it('reduz para 120 preservando a base e não compacta novamente', () => {
 const bg = object({name:'footer-premium-background',type:'rect',top:1170,left:0,width:1080,height:180})
 const text = object({name:'dynamic-instagram',type:'textbox',top:1207,left:86,fontSize:25})
 const objects = [bg,text]
 expect(compactBusinessFooter(objects)).toBe(true)
 expect(bg.top+bg.height).toBe(1350)
 expect(bg.height).toBe(120)
 expect(text.fontFamily).toBe('Barlow')
 expect(text.fontWeight).toBe(900)
 expect(compactBusinessFooter(objects)).toBe(false)
})
