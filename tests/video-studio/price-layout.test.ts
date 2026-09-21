import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {VideoPriceLabel} from '../../shared/video-studio/label-renderer'
import {describe,it,expect} from 'vitest'
import {adaptVideoLabel} from '../../shared/video-studio/labels'
import {priceLayout} from '../../shared/video-studio/price-layout'
const label=adaptVideoLabel({id:'price',name:'Etiqueta cadastrada',group:{width:300,height:160,objects:[
 {type:'IText',name:'price_integer_text',text:'8',left:-95,top:10,width:85,height:150,fontSize:133,originX:'left',originY:'center',fill:'#fff'},
 {type:'IText',name:'price_decimal_text',text:',99',left:25,top:0,width:95,height:80,fontSize:70,originX:'left',originY:'center',fill:'#fff'}
]}})!
describe('Preço dinâmico em etiqueta cadastrada',()=>{
 it.each(['1','25','129','1299'])('mantém %s e centavos unidos dentro da área original',integer=>{
  const snapshot=JSON.stringify(label),p=priceLayout(label,integer)!
  expect(p.x).toBeGreaterThanOrEqual(-95)
  expect(p.decimalX+p.decimalWidth).toBeLessThanOrEqual(120.001)
  expect(p.decimalX-p.x-p.wholeWidth).toBeLessThan(p.size*.03)
  expect(p.size).toBeGreaterThan(0)
  expect(JSON.stringify(label)).toBe(snapshot)
 })
 it('exporta os números como curvas, sem métricas de texto que variam na entrada animada',()=>{const svg=renderToStaticMarkup(createElement(VideoPriceLabel,{label,price:'25,99',unit:'UN'}));expect(svg).toContain('<path');expect(svg).not.toContain('<text');expect(svg).toContain('aria-label="25"');expect(svg).toContain('aria-label=",99"')})
 it('não cria preço em uma arte sem campos dinâmicos',()=>expect(priceLayout({...label,nodes:[]},'25')).toBeUndefined())
})
