import { describe, expect, it } from 'vitest'
import { fitQuickBusinessFooterText, normalizeQuickBusinessFooter } from '../../utils/quickBusinessFooterTypography'

// Measurement test double follows Textbox behavior: wrapping spaces, expanding
// the width for unbreakable words, and preserving styled character dimensions.
const textbox = (values: Record<string, any> = {}) => {
  const object: any = {
    type:'textbox', businessProfileField:'instagram',text:'@loja',fontSize:28,
    width:280,height:32,scaleX:1,scaleY:1,lineHeight:1.04,styles:{},...values
  }
  object.set=(patch: Record<string, any>)=>Object.assign(object,patch)
  object.initDimensions=()=>{
    object._textLines=[]
    for (const paragraph of object.text.split('\n')) {
      let line=''
      for (const word of paragraph.split(' ')) {
        const next=line?`${line} ${word}`:word
        if (line && next.length*object.fontSize*.6>object.width) {object._textLines.push(line);line=word}
        else line=next
      }
      object._textLines.push(line)
    }
    object.textLines=object._textLines
    object.width=Math.max(object.width,...object._textLines.map((line:string)=>line.length*object.fontSize*.6))
    object.height=object.calcTextHeight()
  }
  object.getLineWidth=(index:number)=>object._textLines[index].length*object.fontSize*.6
  object.calcTextHeight=()=>object._textLines.length*object.fontSize*1.18*object.lineHeight
  return object
}

describe('fitQuickBusinessFooterText',()=>{
 it('mantém @ longo completo em uma linha usando dimensões medidas',()=>{
  const text='@SUPERMERCADORODRIGUES_SRV'
  const object=textbox({text})
  fitQuickBusinessFooterText(object,{width:245,height:40,singleLine:true})
  expect(object.text).toBe(text)
  expect(object.textLines).toHaveLength(1)
  expect(object.getLineWidth(0)*object.scaleX).toBeLessThanOrEqual(245.02)
  expect(object.height*object.scaleY).toBeLessThanOrEqual(40.02)
  expect(object.scaleX).toBe(object.scaleY)
  expect(object.fontSize).toBe(28)
 })
 it('usa múltiplas linhas para caber endereço completo na largura e altura',()=>{
  const text='Rua Garibaldi Leão, 275, Bairro Martins, Rio Verde, Goiás, ao lado da praça central'
  const object=textbox({text,businessProfileField:'address',fontSize:30})
  fitQuickBusinessFooterText(object,{width:420,height:94})
  expect(object.text).toBe(text)
  expect(object.textLines.length).toBeGreaterThan(1)
  expect(object.width*object.scaleX).toBeCloseTo(420,4)
  expect(object.height*object.scaleY).toBeLessThanOrEqual(94.02)
 })
 it('recupera o tamanho do modelo quando o dado fica curto e não reduz cumulativamente',()=>{
  const object=textbox({text:'@supermercadorodrigues_filial_um'})
  fitQuickBusinessFooterText(object,{width:200,height:40,singleLine:true})
  const first=JSON.stringify(object)
  expect(fitQuickBusinessFooterText(object,{width:200,height:40,singleLine:true})).toBe(false)
  expect(JSON.stringify(object)).toBe(first)
  object.text='@loja'
  fitQuickBusinessFooterText(object,{width:200,height:40,singleLine:true})
  expect(object.scaleX).toBe(1)
  expect(object.fontSize).toBe(28)
 })
 it('preserva estilo e vínculos após serialização de página inativa',()=>{
  const object:any={type:'textbox',businessProfileField:'instagram',text:'@supermercadorodrigues_srv',width:210,
   fontSize:28,fontFamily:'Barlow Condensed',fontWeight:900,fill:'#ffee44',styles:{0:{0:{fill:'#ffcc00'}}},
   dynamicUserText:'@supermercadorodrigues_srv',dynamicUserTextSource:'quick-user',__rawText:'@supermercadorodrigues_srv'}
  fitQuickBusinessFooterText(object,{width:210,height:35,singleLine:true})
  const reloaded=JSON.parse(JSON.stringify(object))
  fitQuickBusinessFooterText(reloaded,{width:210,height:35,singleLine:true})
  expect(reloaded).toEqual(object)
  expect(reloaded).toMatchObject({businessProfileField:'instagram',fontFamily:'Barlow Condensed',fontWeight:900,
   fill:'#ffee44',styles:{0:{0:{fill:'#ffcc00'}}},dynamicUserText:'@supermercadorodrigues_srv'})
 })
 it('normaliza quebra antiga do Instagram e preserva âncora',()=>{
  const object=textbox({text:'@supermercadorodrigues\n_srv'})
  const anchor={x:120,y:700}
  object.getPointByOrigin=()=>anchor
  object.setPositionByOrigin=(point:any,x:string,y:string)=>{object.restoredAnchor={point,x,y}}
  normalizeQuickBusinessFooter(object)
  expect(object.text).toBe('@supermercadorodrigues_srv')
  expect(object.textLines).toHaveLength(1)
  expect(object.restoredAnchor).toEqual({point:anchor,x:'left',y:'top'})
 })
 it('mantém um único WhatsApp completo em uma linha',()=>{
  const object=textbox({businessProfileField:'whatsapp',text:'(64) 9 9260-5501',width:180})
  normalizeQuickBusinessFooter(object)
  expect(object.text).toBe('(64) 9 9260-5501')
  expect(object.textLines).toHaveLength(1)
  expect(object.width*object.scaleX).toBeCloseTo(180,4)
 })
 it('preserva transformações manuais explícitas',()=>{
  const object=textbox({__manualTransform:true,scaleX:1.3,scaleY:1.3})
  const before=JSON.stringify(object)
  expect(normalizeQuickBusinessFooter(object)).toBe(false)
  expect(JSON.stringify(object)).toBe(before)
 })
})
