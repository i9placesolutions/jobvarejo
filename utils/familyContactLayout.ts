/** Organização solicitada para a composição Família: telefone no topo, validade no rodapé. */
export const layoutFamilyContacts = (objects: any[]): boolean => {
 let changed = false
 const set = (o: any, values: any) => {
  if (!o?.set) return
  if (Object.entries(values).some(([k,v]) => JSON.stringify(o[k]) !== JSON.stringify(v))) {
   o.set(values); o.initDimensions?.(); o.setCoords?.(); o.dirty = true; changed = true
  }
 }
 for (const frame of objects.filter(o => o.isFrame && String(o.name || '').includes('fim-semana-familia') && Number(o.height) > Number(o.width))) {
  const a = objects.filter(o => o.parentFrameId === frame._customId)
  const zone = a.find(o => o.isProductZone), date = a.find(o => o.quickDataField === 'validity'), phone = a.find(o => o.businessProfileField === 'whatsapp')
  if (!zone || !date || !phone) continue
  const s = frame.width / 1080, zb = zone.getBoundingRect(), fb = frame.getBoundingRect(), x = fb.left
  const text = (o: any, left: number, top: number, width: number, size: number, fill: string) => set(o, {
   left, top, width, originX:'left', originY:'top', scaleX:1, scaleY:1, fontSize:size,
   dynamicFieldBaseFontSize:size, dynamicFieldAutoFitFontSize:size, dynamicFieldHeight:0,
   dynamicFieldAutoHeight:true, textAlign:'left', lineHeight:1.02, backgroundColor:'', fill, clipPath:undefined
  })
  text(phone,x+350*s,zb.top-69*s,540*s,50*s,'#6b170c')
  set(phone,{name:'header-whatsapp'})
  const title = a.find(o => o.text === 'WHATSAPP DE OFERTAS')
  text(title,x+350*s,zb.top-89*s,540*s,16*s,'#6b170c')
  const moveIcon = (name: string, left: number, top: number, size: number, color: string, field: string) => {
   const icon = a.find(o => o.name === name)
   if (!icon) return
   set(icon,{left,top,originX:'left',originY:'top',scaleX:size/icon.width,scaleY:size/icon.height,quickDynamicIconFor:field,clipPath:undefined})
   const paint = (o: any) => {
    if (o.getObjects) o.getObjects().forEach(paint)
    else set(o,{...(o.fill && !['none','transparent'].includes(o.fill) ? {fill:color} : {}),...(o.stroke && o.stroke !== 'none' ? {stroke:color} : {})})
   }
   paint(icon)
  }
  moveIcon('icon-whatsapp',x+280*s,zb.top-65*s,54*s,'#197337','whatsapp')
  const foot = zb.top + zb.height
  text(date,x+125*s,foot+8*s,900*s,22*s,'#ffffff')
  const styles: Record<number, Record<number, any>> = {}
  String(date.text || '').split('\n').forEach((line,row) => {
   styles[row]={};for(let i=0;i<line.length;i++)styles[row]![i]={fontSize:(row===1?22:14)*s,fontWeight:row===1?700:400,fill:row===1?'#ffe11f':'#ffffff'}
  })
  set(date,{quickValidityLayout:'split-footer',styles})
  moveIcon('icon-validity',x+60*s,foot+10*s,48*s,'#ffe11f','validity')
  for(const name of ['validity-backdrop','footer-contact-whatsapp'])set(a.find(o=>o.name===name),{visible:false})
  // O contato que permaneceu no rodapé ocupa a linha liberada pelo telefone.
  const bottom=fb.top+fb.height
  text(a.find(o=>o.businessProfileField==='instagram'),x+86*s,bottom-93*s,950*s,23*s,'#17232d')
  text(a.find(o=>o.text==='SIGA NOSSO INSTAGRAM'),x+86*s,bottom-108*s,950*s,10*s,'#ef6500')
  set(a.find(o=>o.name==='icon-instagram'),{top:bottom-97*s,clipPath:undefined})
  set(a.find(o=>o.name==='footer-contact-instagram'),{width:1048*s,clipPath:undefined})
 }
 return changed
}
