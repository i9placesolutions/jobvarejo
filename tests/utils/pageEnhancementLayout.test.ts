import { describe, it, expect } from 'vitest'
import { redesignCardSlots, originalRedesignCardSlots, fitTextLines, readRedesignCard } from '../../utils/pageEnhancementLayout'

describe('commercial redesign invariants', () => {
  it('keeps every original product in its exact grid cell and order', () => {
    const source = [
      {left:10,top:20,width:100,height:120},
      {left:120,top:20,width:100,height:120},
      {left:10,top:150,width:100,height:120}
    ]
    expect(originalRedesignCardSlots(source,{left:10,top:20,width:220,height:250},.5)).toEqual([
      {left:0,top:0,width:50,height:60},
      {left:55,top:0,width:50,height:60},
      {left:0,top:65,width:50,height:60}
    ])
  })
  it.each([1,2,3,5,8,11,20,40])('lays out %i products without overlaps or leaving the page', count => {
    for (const area of [{left:20,top:600,width:1040,height:1180},{left:0,top:400,width:1080,height:600},{left:0,top:300,width:1920,height:700}]) {
      const slots = redesignCardSlots(count, area)
      expect(slots).toHaveLength(count)
      slots.forEach((a,i) => {
        expect(a.left).toBeGreaterThanOrEqual(area.left)
        expect(a.top).toBeGreaterThanOrEqual(area.top)
        expect(a.left+a.width).toBeLessThanOrEqual(area.left+area.width+1e-8)
        expect(a.top+a.height).toBeLessThanOrEqual(area.top+area.height+1e-8)
        slots.slice(i+1).forEach(b => expect(a.left+a.width<=b.left+1e-8 || b.left+b.width<=a.left+1e-8 || a.top+a.height<=b.top+1e-8 || b.top+b.height<=a.top+1e-8).toBe(true))
      })
    }
  })
  it('fits long names without truncation or changing quantities', () => {
    const value = 'ACHOCOLATADO EM PÓ ORIGINAL 370G PACOTE COM 12 UNIDADES'
    const result = fitTextLines(value, 200, 80, 30, (s,n) => s.length*n*.5)
    expect(result.lines.join(' ')).toBe(value)
    expect(result.lines.length*result.size*1.12).toBeLessThanOrEqual(80)
  })
  it('retains all commercial notes, actual photos, badges and complex price groups', () => {
    const node = (name: string, text: string) => ({name,text,type:'textbox'})
    const priceNodes = [node('price_value_text','1.299,99'),node('club','SÓ NO CLUBE'),node('price_unit_text','CX 12 UN')]
    const price = {getObjects:()=>priceNodes}
    const photo = {name:'smart_image',type:'image'}
    const badge = {name:'smart_alcohol_badge_image',type:'image'}
    const cardNodes = [node('smart_title','Arroz 5kg'),photo,price,node('smart_limit','LIMITE 3 UN POR CLIENTE'),badge,{...node('hidden','oculto'),visible:false}]
    const card = {getObjects:()=>cardNodes}
    const result = readRedesignCard(card)
    expect(result).toEqual({title:'Arroz 5kg',photos:[photo],price,notes:['LIMITE 3 UN POR CLIENTE'],badges:[badge]})
    expect(result.price).toBe(price)
    expect(result.photos[0]).toBe(photo)
  })
  it('rejects unstructured cards instead of losing content', () => {
    expect(()=>readRedesignCard({getObjects:()=>[]})).toThrow('foto, nome e preço')
  })
})
