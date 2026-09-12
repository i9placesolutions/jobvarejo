export const WHOLESALE_REFERENCE_TEMPLATE_ID = 'tpl_wholesale_reference_v1'
export const WHOLESALE_REFERENCE_MARKER = 'wholesale_reference_packaging'

export const createWholesaleReferenceTemplateJson = () => {
  const text = (name:string,value:string,left:number,top:number,size:number,fill='#111111',width=220) => ({type:'Textbox',name,text:value,left,top,width,fontSize:size,fontFamily:'Barlow',fontWeight:400,fill,originX:'center',originY:'center',textAlign:'center',scaleX:1,scaleY:1})
  const price = (name:string,value:string,top:number,fill:string,size=36) => ({...text(name,value,16,top,size,fill,168),fontWeight:700,__priceRichText:true,__priceRichIntegerStyle:{fontSize:size,fill,fontFamily:'Barlow',fontWeight:700},__priceRichDecimalStyle:{fontSize:size,fill,fontFamily:'Barlow',fontWeight:700}})
  const box = (name:string,top:number,height:number,fill:string) => ({type:'Rect',name,left:0,top,width:240,height,rx:8,ry:8,fill,strokeWidth:0,originX:'center',originY:'center'})
  return {type:'Group',name:'priceGroup',width:240,height:320,__preserveManualLayout:true,__isCustomTemplate:true,__forceAtacarejoCanonical:false,__atacarejoLabelVariant:'fardo-special-v1',objects:[
    text(WHOLESALE_REFERENCE_MARKER,'SIXPACK\nC/ 6 UNIDADES',0,-130,21),
    box('atac_retail_bg',-55,82,'#0752BE'),
    text('reference_retail_heading','CAIXA AVULSA',0,-78,18,'#FFFFFF'),
    text('retail_currency_text','R$',-90,-54,28,'#FFEB00',40),
    price('retail_price_text','34,38',-54,'#FFEB00'),
    text('retail_pack_line_text','UNID R$ 5,73',0,-27,20,'#FFFFFF'),
    box('atac_wholesale_bg',53,118,'#F00000'),
    text('reference_special_heading','PREÇO ESPECIAL',0,12,18,'#FFFFFF'),
    text('wholesale_currency_text','R$',-95,54,28,'#FFFFFF',40),
    price('wholesale_price_text','32,76',54,'#FFFFFF',46),
    text('wholesale_pack_line_text','UNID R$ 5,46',0,93,20,'#FFFFFF'),
    box('atac_banner_bg',139,42,'#FFE500'),
    {...text('wholesale_banner_text','ACIMA DE 4 PACKS',0,139,20),fontWeight:700}
  ]}
}

export const applyWholesaleReferenceCardLayout = (card:any,w:number,h:number): boolean => {
  const nodes=card?.getObjects?.() || []
  const label=nodes.find((o:any)=>o.name==='priceGroup')
  if (!label?.getObjects?.().some((o:any)=>o.name===WHOLESALE_REFERENCE_MARKER)) return false
  const set=(o:any,p:any)=>{o?.set?.(p);o?.setCoords?.();if(o)o.dirty=true}
  const bg=nodes.find((o:any)=>o.name==='offerBackground')
  set(bg,{fill:'#FFFFFF',rx:w*.035,ry:w*.035})
  const title=nodes.find((o:any)=>o.name==='smart_title')
  set(title,{left:0,top:-h*.43,originX:'center',originY:'center',width:w*.93,fontFamily:'Barlow',fontWeight:700,fontSize:Math.min(w*.061,h*.075),fill:'#111111',textAlign:'left',scaleX:1,scaleY:1})
  title?.initDimensions?.()
  for (let i=0; title && title.height > h*.15 && i<20; i++) {
    title.set?.({fontSize:title.fontSize*.94})
    title.initDimensions?.()
  }
  const image=nodes.find((o:any)=>o.name==='smart_image')
  if(image){const scale=Math.min(w*.43/Math.max(1,image.width),h*.79/Math.max(1,image.height));set(image,{left:-w*.245,top:h*.08,originX:'center',originY:'center',scaleX:scale,scaleY:scale})}
  const scale=Math.min(w*.49/Math.max(1,label.width),h*.80/Math.max(1,label.height))
  set(label,{left:w*.235,top:h*.085,originX:'center',originY:'center',scaleX:scale,scaleY:scale})
  card.dirty=true
  return true
}
