export const WHOLESALE_REFERENCE_TEMPLATE_ID = 'tpl_wholesale_reference_v1'
export const WHOLESALE_REFERENCE_MARKER = 'wholesale_reference_packaging'
export const CENSORED_PROMOTIONAL_HEADING_MARKER = 'censored_promotional_heading'
export const CENSORED_STAMP_MARKER = 'censored_stamp'

const RETAIL_NODES = [
  'atac_retail_bg',
  'reference_retail_heading',
  'retail_currency_text',
  'retail_price_text',
  'retail_pack_line_text'
]

const SPECIAL_NODES = [
  'atac_wholesale_bg',
  'reference_special_heading',
  'wholesale_currency_text',
  'wholesale_price_text',
  'wholesale_pack_line_text'
]

const BANNER_NODES = ['atac_banner_bg', 'wholesale_banner_text']
const LABEL_VERTICAL_GAP = 10
const TIER_CONTENT_GAP = 5
const TIER_CONTENT_PADDING = 6
const CARD_LABEL_VERTICAL_INSET = 0.03

const updateNode = (node: any, props: Record<string, any>) => {
  if (!node) return
  if (typeof node.set === 'function') node.set(props)
  else Object.assign(node, props)
  node.setCoords?.()
  node.dirty = true
}

const nodeTop = (node: any) => {
  const value = Number(node?.top)
  return Number.isFinite(value) ? value : 0
}

const nodeHeight = (node: any, fallback: number) => {
  const height = Number(node?.height)
  const scale = Math.abs(Number(node?.scaleY ?? 1)) || 1
  return Number.isFinite(height) && height > 0 ? height * scale : fallback
}

const isVisible = (node: any) => node?.visible !== false
const hasText = (node: any) => String(node?.text || '').trim().length > 0

const nodeVerticalBounds = (node: any, fallbackHeight = 0) => {
  const height = nodeHeight(node, fallbackHeight)
  const top = nodeTop(node)
  if (node?.originY === 'top') return { top, bottom: top + height }
  if (node?.originY === 'bottom') return { top: top - height, bottom: top }
  return { top: top - (height / 2), bottom: top + (height / 2) }
}

const layoutPriceTier = (args: {
  background: any
  heading: any
  currency: any
  price: any
  packLine: any
  minimumHeight: number
  priceFallbackHeight: number
}) => {
  const {
    background,
    heading,
    currency,
    price,
    packLine,
    minimumHeight,
    priceFallbackHeight
  } = args
  if (!background) return

  const rows: Array<{ nodes: any[], height: number }> = []
  if (isVisible(heading) && hasText(heading)) {
    rows.push({ nodes: [heading], height: nodeHeight(heading, 20) })
  }
  if ((price && isVisible(price)) || (currency && isVisible(currency))) {
    rows.push({
      nodes: [price, currency].filter(Boolean),
      height: Math.max(nodeHeight(price, priceFallbackHeight), nodeHeight(currency, 30))
    })
  }
  if (isVisible(packLine) && hasText(packLine)) {
    rows.push({ nodes: [packLine], height: nodeHeight(packLine, 24) })
  }

  const contentHeight = rows.reduce((total, row) => total + row.height, 0) +
    Math.max(0, rows.length - 1) * TIER_CONTENT_GAP
  const height = Math.max(minimumHeight, Math.ceil(contentHeight + (TIER_CONTENT_PADDING * 2)))
  updateNode(background, { height })

  let cursor = nodeTop(background) - (height / 2) + TIER_CONTENT_PADDING
  rows.forEach((row, index) => {
    const top = cursor + (row.height / 2)
    row.nodes.forEach((node) => updateNode(node, { top }))
    cursor += row.height + (index < rows.length - 1 ? TIER_CONTENT_GAP : 0)
  })
}

const getVisibleLabelVerticalBounds = (label: any) => {
  const objects = label?.getObjects?.() || []
  const bounds = objects
    .filter((node: any) => isVisible(node))
    .map((node: any) => nodeVerticalBounds(node))
  if (bounds.length === 0) {
    const height = Number(label?.height) || 0
    return { top: -(height / 2), bottom: height / 2 }
  }
  return {
    top: Math.min(...bounds.map((bound: any) => bound.top)),
    bottom: Math.max(...bounds.map((bound: any) => bound.bottom))
  }
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

  const moveStack = (names: string[], top: number) => {
    const anchorName = names[0]
    if (!anchorName) return
    const anchor = byName(anchorName)
    if (!anchor) return
    const delta = top - nodeTop(anchor)
    names.forEach((name) => {
      const node = byName(name)
      if (node) updateNode(node, { top: nodeTop(node) + delta })
    })
  }

  const retailBg = byName('atac_retail_bg')
  const specialBg = byName('atac_wholesale_bg')
  const bannerBg = byName('atac_banner_bg')
  const packaging = byName(WHOLESALE_REFERENCE_MARKER)
  const censoredStamp = byName(CENSORED_STAMP_MARKER)
  const censoredHeading = byName(CENSORED_PROMOTIONAL_HEADING_MARKER)
  const retailVisible = Boolean(retailBg) && isVisible(retailBg)
  const specialVisible = Boolean(specialBg) && isVisible(specialBg)

  // Título, valor e unitário são posicionados como três linhas internas da
  // faixa. Sem isso, um valor grande invade o título "Preço avulso".
  layoutPriceTier({
    background: retailBg,
    heading: byName('reference_retail_heading'),
    currency: byName('retail_currency_text'),
    price: byName('retail_price_text'),
    packLine: byName('retail_pack_line_text'),
    minimumHeight: 104,
    priceFallbackHeight: 56
  })
  layoutPriceTier({
    background: specialBg,
    heading: byName('reference_special_heading'),
    currency: byName('wholesale_currency_text'),
    price: byName('wholesale_price_text'),
    packLine: byName('wholesale_pack_line_text'),
    minimumHeight: 126,
    priceFallbackHeight: 70
  })

  // O selo de preço censurado substitui, de propósito, a faixa especial e a
  // condição. Mantemos uma área exclusiva para ele, com folga acima e abaixo,
  // em vez de deixá-lo cobrir a faixa vermelha que estava no grupo original.
  if (censoredStamp && censoredHeading) {
    updateNode(packaging, { visible: false })
    const nodesToHide = [...SPECIAL_NODES, ...BANNER_NODES]
    nodesToHide.forEach((name) => updateNode(byName(name), { visible: false }))

    if (retailVisible) moveStack(RETAIL_NODES, -110)

    const headingTop = retailVisible ? -18 : -70
    updateNode(censoredHeading, { top: headingTop, visible: true })

    const labelWidth = Number(label?.width) || 240
    const stampWidth = Number(censoredStamp.width) || labelWidth
    const scale = Math.min(0.8, (labelWidth * 0.96) / Math.max(1, stampWidth))
    const stampHeight = nodeHeight(censoredStamp, 196) * scale / Math.max(0.0001, Math.abs(Number(censoredStamp.scaleY ?? 1)))
    const headingHeight = nodeHeight(censoredHeading, 23)
    const stampTop = headingTop + (headingHeight / 2) + 18 + (stampHeight / 2)
    updateNode(censoredStamp, { top: stampTop, scaleX: scale, scaleY: scale, visible: true })

    label.setCoords?.()
    label.dirty = true
    return true
  }

  // Um selo pode ter sido removido manualmente depois de ter ocultado a
  // embalagem. Sem ele, volta-se ao fluxo normal da etiqueta.
  updateNode(packaging, { visible: true })

  const packagingHeight = nodeHeight(packaging, 48)
  const retailHeight = nodeHeight(retailBg, 82)
  const specialHeight = nodeHeight(specialBg, 118)
  const bannerHeight = nodeHeight(bannerBg, 42)

  if (retailVisible && specialVisible) {
    const retailTop = -55
    const specialTop = retailTop + (retailHeight / 2) + LABEL_VERTICAL_GAP + (specialHeight / 2)
    const bannerTop = specialTop + (specialHeight / 2) + LABEL_VERTICAL_GAP + (bannerHeight / 2)
    updateNode(packaging, { top: retailTop - (retailHeight / 2) - LABEL_VERTICAL_GAP - (packagingHeight / 2) })
    moveStack(RETAIL_NODES, retailTop)
    moveStack(SPECIAL_NODES, specialTop)
    moveStack(BANNER_NODES, bannerTop)
  } else if (!retailVisible && specialVisible) {
    // Sem preço avulso, a faixa especial sobe, mas mantém a mesma folga em
    // relação à embalagem e à condição.
    const specialTop = -35
    const bannerTop = specialTop + (specialHeight / 2) + LABEL_VERTICAL_GAP + (bannerHeight / 2)
    updateNode(packaging, { top: specialTop - (specialHeight / 2) - LABEL_VERTICAL_GAP - (packagingHeight / 2) })
    moveStack(SPECIAL_NODES, specialTop)
    moveStack(BANNER_NODES, bannerTop)
  } else if (retailVisible) {
    const retailTop = -45
    const bannerTop = retailTop + (retailHeight / 2) + LABEL_VERTICAL_GAP + (bannerHeight / 2)
    updateNode(packaging, { top: retailTop - (retailHeight / 2) - LABEL_VERTICAL_GAP - (packagingHeight / 2) })
    moveStack(RETAIL_NODES, retailTop)
    moveStack(BANNER_NODES, bannerTop)
  }

  label.setCoords?.()
  label.dirty = true
  return true
}

export const createWholesaleReferenceTemplateJson = () => {
  const text = (name:string,value:string,left:number,top:number,size:number,fill='#111111',width=220) => ({type:'Textbox',name,text:value,left,top,width,fontSize:size,fontFamily:'Barlow',fontWeight:400,fill,originX:'center',originY:'center',textAlign:'center',scaleX:1,scaleY:1})
  const price = (name:string,value:string,top:number,fill:string,size=36) => ({...text(name,value,16,top,size,fill,168),fontWeight:700,__priceRichText:true,__priceRichIntegerStyle:{fontSize:size,fill,fontFamily:'Barlow',fontWeight:700},__priceRichDecimalStyle:{fontSize:size,fill,fontFamily:'Barlow',fontWeight:700}})
  const box = (name:string,top:number,height:number,fill:string) => ({type:'Rect',name,left:0,top,width:240,height,rx:8,ry:8,fill,strokeWidth:0,originX:'center',originY:'center'})
  return {type:'Group',name:'priceGroup',width:240,height:320,__preserveManualLayout:true,__isCustomTemplate:true,__forceAtacarejoCanonical:false,__atacarejoLabelVariant:'fardo-special-v1',objects:[
    text(WHOLESALE_REFERENCE_MARKER,'SIXPACK\nC/ 6 UNIDADES',0,-132,21),
    box('atac_retail_bg',-55,82,'#0752BE'),
    text('reference_retail_heading','CAIXA AVULSA',0,-78,18,'#FFFFFF'),
    text('retail_currency_text','R$',-90,-54,28,'#FFEB00',40),
    price('retail_price_text','34,38',-54,'#FFEB00'),
    text('retail_pack_line_text','UNID R$ 5,73',0,-27,20,'#FFFFFF'),
    box('atac_wholesale_bg',57,118,'#F00000'),
    text('reference_special_heading','PREÇO ESPECIAL',0,16,18,'#FFFFFF'),
    text('wholesale_currency_text','R$',-95,58,28,'#FFFFFF',40),
    price('wholesale_price_text','32,76',58,'#FFFFFF',46),
    text('wholesale_pack_line_text','UNID R$ 5,46',0,97,20,'#FFFFFF'),
    box('atac_banner_bg',149,42,'#FFE500'),
    {...text('wholesale_banner_text','ACIMA DE 4 PACKS',0,149,20),fontWeight:700}
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
    const contentBounds = getVisibleLabelVerticalBounds(label)
    const preferredTop = -h * 0.025
    const safeTop = -h * 0.5 + h * CARD_LABEL_VERTICAL_INSET
    const safeBottom = h * 0.5 - h * CARD_LABEL_VERTICAL_INSET
    const maxScaleByTop = contentBounds.top < 0
      ? (preferredTop - safeTop) / Math.abs(contentBounds.top)
      : Number.POSITIVE_INFINITY
    const maxScaleByBottom = contentBounds.bottom > 0
      ? (safeBottom - preferredTop) / contentBounds.bottom
      : Number.POSITIVE_INFINITY
    const scale=Math.min(
      w*.49/Math.max(1,label.width),
      h*.80/Math.max(1,label.height),
      maxScaleByTop,
      maxScaleByBottom
    )
    const minTop = safeTop - (contentBounds.top * scale)
    const maxTop = safeBottom - (contentBounds.bottom * scale)
    const top = Math.min(Math.max(preferredTop, minTop), maxTop)
    set(label,{left:w*.235,top,originX:'center',originY:'center',scaleX:scale,scaleY:scale})
  }
  card.dirty=true
  return true
}
