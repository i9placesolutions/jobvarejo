import { fitQuickBusinessFooterText } from './quickBusinessFooterTypography'


const assign = (object: any, values: Record<string, any>) => {
  if (typeof object.set === 'function') object.set(values)
  else Object.assign(object, values)
  object.setCoords?.()
  object.dirty = true
}
const bounds = (object: any) => {
  if (object.getBoundingRect) return object.getBoundingRect()
  const width = object.width * (object.scaleX || 1), height = object.height * (object.scaleY || 1)
  return { left: object.left - (object.originX === 'center' ? width / 2 : 0), top: object.top - (object.originY === 'center' ? height / 2 : 0), width, height }
}
const state = (objects: any[]) => JSON.stringify(objects.map(o => [o.left,o.top,o.width,o.height,o.scaleX,o.scaleY,o.visible,o.fontSize,o.text]))

export const layoutReferenceValidity = (date: any, siblings: any[]): boolean => {
  const band = siblings.find(o => o.name === 'standard-validity-background')
  const heading = siblings.find(o => o.name === 'validity-heading')
  const stock = siblings.find(o => o.name === 'stock-validity')
  if (!band || !heading || !stock) return false
  const tracked = [band,heading,date,stock], before = state(tracked)
  const area = bounds(band), visible = date.visible !== false && !!String(date.text || '').trim()
  assign(band, { visible }); assign(heading, { visible }); assign(stock, { visible: false })
  if (visible) {
    const s = area.height / 80
    const width = area.width - 70 * s
    for (const [field, top, height, size] of [[heading,12,31,30],[date,46,24,23]] as const) {
      assign(field, { originX:'left',originY:'top',textAlign:'center',lineHeight:1, charSpacing:0 })
      fitQuickBusinessFooterText(field, { width, height:height*s,maxFontSize:size*s,singleLine:true })
      assign(field, { left:area.left+25*s,top:area.top+top*s+(height*s-bounds(field).height)/2 })
    }
  }
  return before !== state(tracked)
}

/** Rodapé de duas colunas: chamada/WhatsApp à esquerda; endereço/Instagram à direita. */
export const layoutReferenceFooter = (background: any, objects: any[]): boolean => {
  const local=objects.filter(o=>o.parentFrameId===background.parentFrameId)
  const area=bounds(background), s=area.width/1080, before=state(local)
  const verticalScale = Math.min(s, area.height / 122)
  const byName=(name:string)=>local.find(o=>o.name===name)
  const phone=byName('footer-dynamic-whatsapp'),address=byName('footer-dynamic-address'),instagram=byName('footer-dynamic-instagram')
  const active=(o:any)=>!!o&&o.visible!==false&&o.quickFieldEnabled!==false&&!!String(o.text||'').trim()
  const phoneActive=active(phone), addressActive=active(address), instagramActive=active(instagram)
  const rightActive=addressActive||instagramActive
  const label=byName('footer-reference-whatsapp-label'),addressLabel=byName('footer-reference-address-label'),divider=byName('footer-column-divider-1')
  if(label)assign(label,{visible:phoneActive})
  if(addressLabel)assign(addressLabel,{visible:addressActive})
  if(divider)assign(divider,{visible:phoneActive&&rightActive})
  const fit=(o:any,x:number,y:number,w:number,h:number,size:number,single=false)=>{
    if(!active(o))return
    // A posição/escala de um campo movido no editor pertence ao encarte, não
    // à receita automática do rodapé. O texto já foi atualizado pela
    // hidratação do campo; não reencaixe esse objeto ao reabrir o projeto.
    if (o.__manualTransform) return
    assign(o,{originX:'left',originY:'top',lineHeight:1.03})
    fitQuickBusinessFooterText(o,{width:w*s,height:h*verticalScale,maxFontSize:size*verticalScale,singleLine:single})
    assign(o,{left:area.left+x*s,top:area.top+y*verticalScale+(h*verticalScale-bounds(o).height)/2})
  }
  const icon=(field:string,x:number,y:number,size:number,visible:boolean)=>{
    const o=byName('icon-'+field);if(!o)return
    if (o.__manualTransform) {
      assign(o,{visible})
      return
    }
    const scale=size*verticalScale/Math.max(o.width,o.height)
    assign(o,{visible,originX:'left',originY:'top',left:area.left+x*s,top:area.top+y*verticalScale,scaleX:scale,scaleY:scale})
  }
  const rightX=phoneActive?(addressLabel?550:528):112, rightWidth=phoneActive?(addressLabel?498:520):900
  fit(phone,112,54,rightActive?304:900,48,42,true)
  if(label && !label.__manualTransform){assign(label,{left:area.left+112*s,top:area.top+26*verticalScale,width:(rightActive?308:900)*s,fontSize:22*verticalScale,scaleX:1,scaleY:1})}
  if(addressLabel && !addressLabel.__manualTransform)assign(addressLabel,{originX:'left',originY:'top',left:area.left+rightX*s,top:area.top+26*verticalScale,width:rightWidth*s,fontSize:22*verticalScale,scaleX:1,scaleY:1})
  fit(address,rightX,addressLabel?55:22,rightWidth,addressLabel?(instagramActive?32:54):(instagramActive?54:94),29)
  fit(instagram,rightX+29,91,rightWidth-29,25,22,true)
  icon('whatsapp',30,37,68,phoneActive)
  icon('address',rightX-(addressLabel?88:57),addressLabel?34:34,addressLabel?72:43,addressActive)
  icon('instagram',rightX,92,22,instagramActive)
  return before!==state(local)
}

/** O Instagram do cabeçalho nunca expande a faixa: reduz proporcionalmente. */
export const layoutHeaderInstagram = (objects: any[]): boolean => {
  let changed = false
  for (const band of objects.filter(o => o.name === 'header-instagram-background')) {
    const siblings = objects.filter(o => o.parentFrameId === band.parentFrameId)
    const field = siblings.find(o => o.name === 'header-instagram' && o.businessProfileField === 'instagram')
    const icon = siblings.find(o => o.name === 'header-icon-instagram')
    if (!field) continue
    const tracked = [band, field, ...(icon ? [icon] : [])], before = state(tracked)
    const visible = field.visible !== false && field.quickFieldEnabled !== false && !!String(field.text || '').trim()
    assign(band, { visible }); if (icon) assign(icon, { visible })
    if (visible) {
      const b = bounds(band), s = b.height / 52
      const inset = 16 * s, iconSize = icon ? 32 * s : 0, gap = icon ? 12 * s : 0
      const maxWidth = Number(band.headerInstagramMaxWidth) || b.width
      const centerX = Number.isFinite(band.headerInstagramCenterX) ? band.headerInstagramCenterX : b.left + b.width / 2
      assign(band, { headerInstagramMaxWidth: maxWidth, headerInstagramCenterX: centerX })
      const width = Math.max(1, maxWidth - inset * 2 - iconSize - gap - 2), height = Math.max(1, b.height - 14 * s)
      assign(field, { originX: 'left', originY: 'top', lineHeight: 1, textAlign: 'left' })
      const manual = field.__manualTransform
      field.__manualTransform = false
      fitQuickBusinessFooterText(field, { width, height, maxFontSize: 28 * s, singleLine: true })
      field.__manualTransform = manual
      const measured = typeof field.calcTextWidth === 'function' ? field.calcTextWidth() : String(field.text || '').length * field.fontSize * .6
      const textWidth = Math.min(width, measured * field.scaleX)
      const bandWidth = Math.min(maxWidth, textWidth + inset * 2 + iconSize + gap)
      const left = centerX - bandWidth / 2
      assign(band, { originX: 'left', left, width: bandWidth, scaleX: 1 })
      assign(field, { width: textWidth / field.scaleX, left: left + inset + iconSize + gap, top: b.top + (b.height - bounds(field).height) / 2 })
      if (icon) {
        const scale = iconSize / Math.max(icon.width, icon.height)
        assign(icon, { originX: 'left', originY: 'top', left: left + inset, top: b.top + (b.height - icon.height * scale) / 2, scaleX: scale, scaleY: scale })
      }
    }
    changed = before !== state(tracked) || changed
  }
  return changed
}
