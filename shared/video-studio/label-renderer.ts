import {vectorText} from './vector-text'
import { createElement as h } from 'react'
import { displayPrice } from './model'
import type { VideoLabel } from './labels'
import { priceLayout } from './price-layout'
export function VideoPriceLabel({label,price,unit}:{label:VideoLabel;price:string;unit:string}){
 const [integer='0',cents='00']=displayPrice(price).split(',');
 const run=priceLayout(label,integer);
 return h('svg',{viewBox:`${-label.width/2-5} ${-label.height/2-5} ${label.width+10} ${label.height+10}`,style:{width:'100%',height:'100%',overflow:'visible'}},...label.nodes.map((n,i)=>{
  if(run && ['price_integer_text','price_decimal_text','price_value_text','price_unit_text'].includes(n.name))return null
  const x=n.originX==='center'?-n.width/2:n.originX==='right'?-n.width:0,y=n.originY==='center'?-n.height/2:n.originY==='bottom'?-n.height:0
  const common={fill:n.fill,stroke:n.stroke,strokeWidth:n.strokeWidth,opacity:n.opacity};let child
  if(n.type==='rect')child=h('rect',{...common,x,y,width:n.width,height:n.height,rx:n.rx})
  else if(n.type==='circle')child=h('circle',{...common,cx:x+n.radius,cy:y+n.radius,r:n.radius})
  else if(n.type==='image')child=h('image',{href:n.src,x,y,width:n.width,height:n.height})
  else{let text=n.text;if(n.name==='price_integer_text')text=integer||'';if(n.name==='price_decimal_text')text=','+cents;if(n.name==='price_value_text')text=displayPrice(price);if(/price_.*unit_text/.test(n.name))text=unit
   const anchor=n.originX==='center'?'middle':n.originX==='right'?'end':'start';const font=n.fontFamily.includes('Condensed')?'VideoCondensed':'VideoBarlow';const shrink=n.name==='price_integer_text'?Math.min(1,Math.max(n.text.length,1)/Math.max(text.length,1)):1
   child=vectorText(text,{...common,x:0,y:y+n.height*.79,size:n.fontSize,width:shrink<1?n.width:undefined,anchor,condensed:font==='VideoCondensed'})
  }
  return h('g',{key:i,transform:`translate(${n.x} ${n.y}) rotate(${n.angle}) scale(${n.sx} ${n.sy})`},child)
 }),run?h('g',null,
 vectorText(integer,{x:run.x,y:run.baseline,size:run.size,width:run.wholeWidth,fill:run.fill,stroke:run.fill,strokeWidth:run.size*.013}),
 vectorText(','+cents,{x:run.decimalX,y:run.baseline-run.size*.32,size:run.size*.58,width:run.decimalWidth,fill:run.fill,stroke:run.fill,strokeWidth:run.size*.013}),
 run.unit?vectorText(unit,{x:run.decimalX+run.decimalWidth/2,y:run.baseline,size:run.size*.23,anchor:'middle',fill:run.fill}):null):null)
}
