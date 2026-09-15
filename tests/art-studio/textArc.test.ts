import {it,expect} from 'vitest'
import {artTextArc} from '~/utils/art-studio/textArc'
import type {ArtLayer} from '~/types/art-studio'
it('preserva texto e mantém centros dentro da caixa nos dois sentidos do arco',()=>{
 for(const textArc of [10,110,-110,180]){
  const l={text:'12 de Outubro',fontSize:45,width:360,height:140,textArc} as ArtLayer
  const points=artTextArc(l,(_,size)=>size*.6)
  expect(points.map(p=>p.char).join('')).toBe(l.text)
  expect(points.every(p=>p.x>=0&&p.x<=360&&p.y>=0&&p.y<=140)).toBe(true)
  expect(points[0]!.x).toBeLessThan(points.at(-1)!.x)
  expect(Math.sign(points[0]!.y-points[6]!.y)).toBe(Math.sign(textArc))
 }
})
it('reduz tamanho para caber e mantém espaçamento de letras no arco',()=>{
 const l={text:'ABC',fontSize:80,width:120,height:60,textArc:120} as ArtLayer
 const original=artTextArc(l,(_,size)=>size*.5)
 const spaced=artTextArc({...l,letterSpacing:30},(_,size)=>size*.5)
 expect(original.every(p=>p.fontSize<80)).toBe(true)
 expect(spaced[0]!.fontSize).toBeLessThan(original[0]!.fontSize)
})
