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
