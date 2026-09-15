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
