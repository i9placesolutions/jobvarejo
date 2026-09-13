export const WHOLESALE_REFERENCE_TEMPLATE_ID = 'tpl_wholesale_reference_v1'
export const WHOLESALE_REFERENCE_MARKER = 'wholesale_reference_packaging'

const updateNode = (node: any, props: Record<string, any>) => {
  if (!node) return
  if (typeof node.set === 'function') node.set(props)
  else Object.assign(node, props)
  node.setCoords?.()
  node.dirty = true
}

/**
 * A referência lateral pode ter somente uma das faixas de preço. Nesse caso
 * a faixa remanescente sobe para junto da embalagem, sem deixar o vão da
 * faixa oculta. As coordenadas canônicas também são restauradas quando o
 * produto voltar a ter os dois preços.
 */
export const reflowWholesaleReferencePriceLabel = (label: any): boolean => {
  const objects = label?.getObjects?.() || []
  const byName = (name: string) => objects.find((node: any) => node?.name === name)
  if (!byName(WHOLESALE_REFERENCE_MARKER)) return false

  const positions: Record<string, number> = {
    [WHOLESALE_REFERENCE_MARKER]: -130,
    atac_retail_bg: -55,
    reference_retail_heading: -78,
    retail_currency_text: -54,
    retail_price_text: -54,
    retail_pack_line_text: -27,
    atac_wholesale_bg: 53,
    reference_special_heading: 12,
    wholesale_currency_text: 54,
    wholesale_price_text: 54,
    wholesale_pack_line_text: 93,
    atac_banner_bg: 139,
    wholesale_banner_text: 139
  }

  const retailVisible = byName('atac_retail_bg')?.visible !== false
  const specialVisible = byName('atac_wholesale_bg')?.visible !== false

  if (!retailVisible && specialVisible) {
    // Faz a faixa especial ocupar o lugar da avulsa. A descrição da
    // embalagem desce levemente para não ficar por trás do título do card.
    Object.assign(positions, {
      [WHOLESALE_REFERENCE_MARKER]: -127,
      atac_wholesale_bg: -33,
      reference_special_heading: -74,
      wholesale_currency_text: -32,
      wholesale_price_text: -32,
      wholesale_pack_line_text: 7,
      atac_banner_bg: 53,
      wholesale_banner_text: 53
    })
  } else if (retailVisible && !specialVisible) {
    Object.assign(positions, {
      [WHOLESALE_REFERENCE_MARKER]: -127,
      atac_retail_bg: -46,
      reference_retail_heading: -69,
      retail_currency_text: -45,
      retail_price_text: -45,
      retail_pack_line_text: -18,
      atac_banner_bg: 57,
      wholesale_banner_text: 57
    })
  }

  Object.entries(positions).forEach(([name, top]) => updateNode(byName(name), { top }))
  label.setCoords?.()
  label.dirty = true
  return true
}

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
  reflowWholesaleReferencePriceLabel(label)
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
  // Ajustes explícitos da etiqueta prevalecem sobre o encaixe automático do card.
  // __manualTransform também marca textos internos; somente esta flag indica o grupo inteiro.
  if (label.__manualPricePosition !== true) {
    const scale=Math.min(w*.49/Math.max(1,label.width),h*.80/Math.max(1,label.height))
    set(label,{left:w*.235,top:h*.085,originX:'center',originY:'center',scaleX:scale,scaleY:scale})
  }
  card.dirty=true
  return true
}
