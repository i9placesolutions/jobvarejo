/** Compacta apenas os elementos conhecidos do rodapé, mantendo sua base fixa. */
export const compactBusinessFooter = (objects: any[]): boolean => {
 let changed = false
 for (const background of objects.filter(o => o.name === 'footer-premium-background')) {
  const oldHeight = Number(background.height), target = Number(background.width) * 120 / 1080
  if (!(oldHeight > target + 1)) continue
  const top = Number(background.top), bottom = top + oldHeight, ratio = target / oldHeight
  const members = objects.filter(o => o === background || (Number(o.top) >= top && Number(o.top) < bottom &&
   Number(o.left) >= Number(background.left) && Number(o.left) < Number(background.left) + Number(background.width) &&
   (/^(footer-|icon-|dynamic-)/.test(o.name || '') || o.businessProfileField)))
  for (const o of members) {
   o.set({ top: bottom - target + (Number(o.top) - top) * ratio })
   if (['text','textbox','i-text'].includes(String(o.type).toLowerCase())) {
    const size = Number(o.fontSize) * ratio
    o.set({fontFamily:'Barlow',fontWeight:900,fontSize:size,lineHeight:1,dynamicFieldBaseFontSize:size,dynamicFieldAutoFitFontSize:size,dynamicFieldHeight:0,dynamicFieldAutoHeight:true})
    o.initDimensions?.()
   } else if (String(o.type).toLowerCase() === 'rect') o.set({height:Number(o.height)*ratio,ry:Math.min(Number(o.ry||0),8)})
   else if (o.businessProfileField === 'footerPaymentImages') {
    o.set({scaleX:Number(o.scaleX||1)*ratio,scaleY:Number(o.scaleY||1)*ratio})
   } else o.set({scaleX:Number(o.scaleX||1)*ratio,scaleY:Number(o.scaleY||1)*ratio})
   o.setCoords?.(); o.dirty=true
  }
  changed = true
 }
 // Reorganiza também rodapés já compactados pela versão anterior.
 for (const bg of objects.filter(o => o.name === 'footer-premium-background')) {
  const s = Number(bg.width) / 1080
  const inside = (o: any) => Number(o.top) >= Number(bg.top) && Number(o.top) < Number(bg.top) + Number(bg.height)
  for (const box of objects.filter(o => /^footer-contact-/.test(o.name || '') && inside(o))) {
   const field = box.name.replace('footer-contact-', '')
   const set = (o: any, patch: any) => {
    if (Object.entries(patch).some(([k,v]) => o[k] !== v)) { o.set(patch); o.dirty=true; changed=true }
    o.setCoords?.()
   }
   const title = objects.find(o => o.name === 'footer-title' && inside(o) && Number(o.left) >= box.left && Number(o.left) < box.left + box.width && Number(o.top) >= box.top && Number(o.top) < box.top + box.height)
   if (title) set(title, { top: box.top + 4*s, fontSize:8*s, fontFamily:'Barlow', fontWeight:900 })
   if (field === 'payments') {
    const row = objects.find(o => o.businessProfileField === 'footerPaymentImages' && inside(o))
    if (row) set(row, { left:box.left+12*s, top:box.top+17*s, originX:'left',originY:'top', scaleX:1,scaleY:1,
      footerPaymentWidth:box.width-24*s, footerPaymentHeight:Math.max(12*s,box.height-23*s), width:box.width-24*s,height:Math.max(12*s,box.height-23*s) })
    continue
   }
   const text = objects.find(o => o.businessProfileField === field && inside(o))
   if (!text) continue
   const size = (field === 'whatsapp' ? 29 : field === 'instagram' ? 23 : 20)*s
   set(text, {top:box.top+18*s,fontSize:size,fontFamily:'Barlow',fontWeight:900,lineHeight:1, dynamicFieldBaseFontSize:size,dynamicFieldAutoFitFontSize:size,dynamicFieldAutoHeight:true,dynamicFieldHeight:0})
   text.initDimensions?.()
  }
 }
 return changed
}
