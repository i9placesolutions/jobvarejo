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
 it('altera somente a cor dos glifos sem mutar a etiqueta',()=>{const before=JSON.stringify(label);const svg=renderToStaticMarkup(createElement(VideoPriceLabel,{label,price:'25,99',unit:'UN',colors:{priceColor:'#123456'}}));expect(svg).toContain('#123456');expect(JSON.stringify(label)).toBe(before)})
 it('renderiza o oval Fabric com raios preservados e mantém o preço dinâmico',()=>{const oval=adaptVideoLabel({id:'oval',name:'Fim de Semana Maluco — Oval preta e amarela',group:{width:179,height:96,objects:[{type:'Ellipse',name:'price_bg',left:0,top:0,width:178,height:95,rx:89,ry:47.5,originX:'center',originY:'center',fill:'#050505',stroke:'#fff',strokeWidth:1},{type:'IText',name:'price_value_text',left:-21.1003,top:0,width:82.1171,height:97.18,originX:'left',originY:'center',fill:'#ffed00',fontSize:86},{type:'IText',name:'price_unit_text',left:53.4,top:18.05,width:2,height:13.56,originX:'center',originY:'center',fill:'#ffed00',fontSize:12}]}})!;expect(oval).not.toBeNull();const svg=renderToStaticMarkup(createElement(VideoPriceLabel,{label:oval,price:'25,99',unit:'UN'}));expect(svg).toContain('<ellipse');expect(svg).toContain('cx="0"');expect(svg).toContain('cy="0"');expect(svg).toContain('rx="89"');expect(svg).toContain('ry="47.5"');expect(svg).toContain('fill="#050505"');expect(svg).toContain('#ffed00');expect(svg).toContain('aria-label="25"');expect(svg).toContain('aria-label=",99"')})
 it('não cria preço em uma arte sem campos dinâmicos',()=>expect(priceLayout({...label,nodes:[]},'25')).toBeUndefined())
})
