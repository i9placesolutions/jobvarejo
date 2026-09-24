import { expect, it } from 'vitest'
import { syncPriceTemplateStyle } from '../../utils/priceTemplateStyleSync'

it('reaplica o estilo sem substituir valores, visibilidade ou posição do produto', () => {
  const text:any = {name:'retail_price_text',text:'17,99',fontFamily:'Arial',fontSize:8,scaleX:.08,scaleY:.08,visible:false,left:16,top:40,set(p:any){Object.assign(this,p)}}
  const group:any = {left:300,scaleX:2,getObjects:()=>[text]}
  const template = {objects:[{name:'retail_price_text',text:'99,99',fontFamily:'Barlow',fontSize:46,fill:'#fff',scaleX:1,scaleY:1}]}
  for(let i=0;i<5;i++) syncPriceTemplateStyle(group,template)
  expect(text).toMatchObject({text:'17,99',fontFamily:'Barlow',fontSize:46,scaleX:.08,scaleY:.08,__visibleScaleX:1,__visibleScaleY:1,visible:false,left:16,top:40})
  expect(group).toMatchObject({left:300,scaleX:2})
})

it('restaura gradientes pelo runtime sem compartilhar o JSON do modelo', () => {
  const gradient={type:'linear',colorStops:[]}
  const livePaint={toLive:()=> 'gradient'}
  const background:any={name:'atac_retail_bg',set(p:any){Object.assign(this,p)}}
  syncPriceTemplateStyle({getObjects:()=>[background]}, {objects:[{name:'atac_retail_bg',fill:gradient}]}, () => livePaint)
  expect(background.fill).toBe(livePaint)
})

it('restaura posições e escalas juntas após duplicar uma etiqueta manual normalizada', () => {
  const template:any = {__preserveManualLayout:true, objects:[
    {name:'price_bg',width:340,height:130,left:-6,top:0,originX:'center',originY:'center',scaleX:1,scaleY:1},
    {name:'price_currency_text',text:'R$',left:-120,top:4,width:45,originX:'center',originY:'center',scaleX:1,scaleY:1},
    {name:'price_value_text',text:'99,99',left:-80,top:4,width:140,originX:'left',originY:'center',scaleX:1,scaleY:1}
  ]}
  let nodes:any[] = template.objects.map((o:any)=>({...o,left:o.left+48,scaleX:1.25,scaleY:1.25}))
  nodes[2].text='8,99'
  for(let copy=0;copy<5;copy++) {
    nodes=JSON.parse(JSON.stringify(nodes)).map((o:any)=>({...o,set(p:any){Object.assign(this,p)}}))
    const group:any={__preserveManualLayout:true,left:200,top:500,scaleX:.35,scaleY:.35,getObjects:()=>nodes}
    syncPriceTemplateStyle(group,template)
    for(let i=0;i<nodes.length;i++) {
      for(const key of ['left','top','originX','originY','scaleX','scaleY']) expect(nodes[i][key]).toBe(template.objects[i][key])
    }
    expect(nodes[2].text).toBe('8,99')
    expect(group).toMatchObject({left:200,top:500,scaleX:.35,scaleY:.35})
  }
})

it('restaura a caixa junto com os filhos sem deslocar o grupo após salvar e duplicar', () => {
  const template = { __preserveManualLayout: true, width: 340, height: 130, objects: [
    { name: 'price_bg', width: 340, height: 130, left: 0, top: 0, originX: 'center', originY: 'center' }
  ] }
  let saved: any = { width: 580, height: 670, left: 200, top: 500, scaleX: 0.8, scaleY: 0.8 }
  for (let copy = 0; copy < 5; copy++) {
    const background: any = { ...template.objects[0], set(p: any) { Object.assign(this, p) } }
    const group: any = { ...saved, getObjects: () => [background], set(p: any) { Object.assign(this, p) } }
    syncPriceTemplateStyle(group, template)
    expect(group).toMatchObject({ width: 340, height: 130, left: 200, top: 500, scaleX: 0.8, scaleY: 0.8 })
    saved = JSON.parse(JSON.stringify(group))
  }
})

it('preço curto mantém o centro autorado do conjunto R$ e valor em relayouts repetidos', () => {
  const source = { name: 'price_value_text', text: '39,99', left: -70, top: 5, width: 180, height: 70, originX: 'left', originY: 'center', scaleX: 1, scaleY: 1 }
  const currency = { name: 'price_currency_text', text: 'R$', left: -100, top: 5, width: 20, height: 20, originX: 'left', scaleX: 1, scaleY: 1 }
  const template = { __preserveManualLayout: true, width: 320, height: 210, objects: [currency, source] }
  const nodes: any[] = [currency, source].map(node => ({ ...node, set(p: any) { Object.assign(this, p) }, initDimensions() { if (this.name === source.name) this.width = this.text === '1,98' ? 100 : 180 } }))
  nodes[1].text = '1,98'
  const group: any = { __preserveManualLayout: true, __manualTemplateBaseW: 900, getObjects: () => nodes }
  for (let i = 0; i < 5; i++) {
    syncPriceTemplateStyle(group, template)
    expect((nodes[0].left + nodes[1].left + nodes[1].width) / 2).toBe(5)
    expect(nodes[1].left - (nodes[0].left + nodes[0].width)).toBe(10)
    expect(nodes[1].text).toBe('1,98')
    expect(group.__manualTemplateBaseW).toBe(320)
  }
})
it('restaura deslocamentos dos centavos definidos na etiqueta', () => {
  const source = { name: 'price_value_text', text: '39,99', fontSize: 40, __priceRichText: true,
    __priceRichIntegerStyle: { fontSize: 70 }, __priceRichDecimalStyle: { fontSize: 40 },
    __priceRichIntegerOffsetX: 3, __priceRichIntegerOffsetY: 0, __priceRichDecimalOffsetX: 7, __priceRichDecimalOffsetY: -19 }
  const node: any = { ...source, text: '1,98', __priceRichDecimalOffsetX: -50, __priceRichDecimalOffsetY: 0, set(p: any) { Object.assign(this, p) } }
  syncPriceTemplateStyle({ getObjects: () => [node] }, { objects: [source] })
  expect(node.__priceRichDecimalOffsetX).toBe(7)
  expect(node.__priceRichDecimalOffsetY).toBe(-19)
  expect(node.text).toBe('1,98')
})

it('centraliza varejo e atacado independentemente e conserva os dois preços', () => {
  const objects: any[] = []
  for (const [prefix, y] of [['retail', -60], ['wholesale', 60]] as const) {
    objects.push(
      { name: `atac_${prefix}_bg`, width: 300, height: 100, left: 0, top: y, originX: 'center', originY: 'center' },
      { name: `${prefix}_currency_text`, text: 'R$', width: 20, height: 20, left: -100, top: y, originX: 'left', originY: 'center' },
      { name: `${prefix}_price_text`, text: '39,99', width: 180, height: 60, left: -70, top: y, originX: 'left', originY: 'center' }
    )
  }
  const nodes: any[] = objects.map(source => ({ ...source, scaleX: 1, scaleY: 1, set(p: any) { Object.assign(this, p) }, initDimensions() { if (this.name.endsWith('_price_text')) this.width = this.text === '1,98' ? 100 : 150 } }))
  nodes[2].text = '1,98'; nodes[5].text = '12,99'
  const group: any = { __preserveManualLayout: true, left: 270, top: 480, getObjects: () => nodes }
  for (let i = 0; i < 5; i++) {
    syncPriceTemplateStyle(group, { __preserveManualLayout: true, objects })
    for (const offset of [0, 3]) expect((nodes[offset + 1].left + nodes[offset + 2].left + nodes[offset + 2].width) / 2).toBe(5)
    expect(nodes[2].text).toBe('1,98'); expect(nodes[5].text).toBe('12,99')
    expect(group.left).toBe(270); expect(group.top).toBe(480)
  }
  nodes[5].visible = false
  syncPriceTemplateStyle(group, { __preserveManualLayout: true, objects })
  expect(nodes[5].visible).toBe(false)
})

it('valor com origem central cresce sem sobrepor o R$ no atacado', () => {
  const currency: any = { name: 'retail_currency_text', text: 'R$', left: -100, top: 0, width: 20, height: 20, originX: 'left' }
  const price: any = { name: 'retail_price_text', text: '9,99', left: 0, top: 0, width: 140, height: 50, originX: 'center' }
  const nodes: any[] = [currency, price].map(node => ({ ...node, scaleX: 1, scaleY: 1, set(p: any) { Object.assign(this, p) }, initDimensions() { if (this.name === price.name) this.width = 200 } }))
  nodes[1].text = '1.299,99'
  syncPriceTemplateStyle({ __preserveManualLayout: true, getObjects: () => nodes }, { objects: [currency, price, { name: 'atac_retail_bg' }] })
  expect(nodes[1].left - nodes[1].width / 2 - (nodes[0].left + nodes[0].width)).toBe(10)
})

it('o fundo do R$ acompanha o símbolo ao reduzir um preço comprido', () => {
  const objects = [
    { name: 'price_bg', width: 200, height: 100, left: 0, top: 0, originX: 'center', originY: 'center' },
    { name: 'price_currency_bg', width: 30, height: 30, left: -80, top: 0, originX: 'center', originY: 'center' },
    { name: 'price_currency_text', text: 'R$', width: 20, height: 20, left: -80, top: 0, originX: 'center', originY: 'center' },
    { name: 'price_value_text', text: '9,99', width: 100, height: 60, left: -60, top: 0, originX: 'left', originY: 'center' }
  ]
  const nodes: any[] = objects.map(node => ({ ...node, scaleX: 1, scaleY: 1, set(p: any) { Object.assign(this, p) }, initDimensions() { if (this.name === 'price_value_text') this.width = 300 } }))
  nodes[3].text = '1.299,99'
  const group = { __preserveManualLayout: true, getObjects: () => nodes }
  for (let i = 0; i < 5; i++) {
    syncPriceTemplateStyle(group, { objects })
    expect(nodes[1].left).toBeCloseTo(nodes[2].left)
    expect(nodes[1].scaleX).toBeCloseTo(nodes[2].scaleX)
    expect(nodes[1].scaleX).toBeLessThan(1)
  }
})

it('Torra Tudo mantém R$ no badge e unidade junto aos centavos em preços curtos e longos',()=>{
 const objects=[
  {name:'price_bg',width:260,height:127,left:0,top:-3,originX:'center',originY:'center'},
  {name:'label-badge',width:42,height:42,left:-104,top:-2,originX:'center',originY:'center'},
  {name:'price_currency_text',text:'R$',width:30,height:29,left:-105,top:0,originX:'center',originY:'center'},
  {name:'price_value_text',text:'22,99',width:195,height:112,left:-73,top:-1,originX:'left',originY:'center'},
  {name:'price_unit_text',text:'UN',width:31,height:28,left:65,top:34,originX:'center',originY:'center'}
 ]
 const template={__preserveManualLayout:true,width:276,height:150,objects}
 for(const width of [140,195,300]){
  const nodes:any[]=objects.map(o=>({...o,scaleX:1,scaleY:1,set(p:any){Object.assign(this,p)},initDimensions(){if(this.name==='price_value_text')this.width=width}}))
  nodes[3].text=width===140?'0,99':width===195?'22,99':'1.299,99'
  const group={__preserveManualLayout:true,getObjects:()=>nodes}
  for(let i=0;i<3;i++){
   syncPriceTemplateStyle(group,template)
   const [,badge,currency,value,unit]=nodes
   expect((currency.left-badge.left)/currency.scaleX).toBeCloseTo(-1)
   expect((unit.left-value.left)/value.scaleX).toBeCloseTo(138+width-195)
   expect(value.text).toBe(width===140?'0,99':width===195?'22,99':'1.299,99')
  }
 }
})
