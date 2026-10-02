import { fitQuickBusinessFooterText } from './quickBusinessFooterTypography'

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const box = (o: any) => {
  const width = Math.max(0, num(o?.width, 0) * Math.abs(num(o?.scaleX, 1)))
  const height = Math.max(0, num(o?.height, 0) * Math.abs(num(o?.scaleY, 1)))
  return {
    left: num(o?.left) - (o?.originX === 'center' ? width / 2 : o?.originX === 'right' ? width : 0),
    top: num(o?.top) - (o?.originY === 'center' ? height / 2 : o?.originY === 'bottom' ? height : 0),
    width,
    height
  }
}
const set = (o: any, values: Record<string, any>) => {
  const changed = Object.entries(values).some(([key, value]) => JSON.stringify(o?.[key]) !== JSON.stringify(value))
  if (changed) {
    if (typeof o?.set === 'function') o.set(values)
    else Object.assign(o, values)
    o.dirty = true
  }
  o?.setCoords?.()
  return changed
}
const changedState = (objects: any[]) => JSON.stringify(objects.map(o => [o?.left, o?.top, o?.width, o?.height, o?.scaleX, o?.scaleY, o?.visible, o?.fontSize, o?.text]))
const activeText = (o: any) => !!o && o.visible !== false && o.quickFieldEnabled !== false && !!String(o.text || '').trim()
const populatedText = (o: any) => !!o && o.quickFieldEnabled !== false && !!String(o.text || '').trim()
const fitText = (o: any, x: number, y: number, width: number, height: number, size: number, singleLine = false) => {
  if (!o || o.__manualTransform || !activeText(o)) return false
  let changed = set(o, { originX: 'left', originY: 'top', lineHeight: 1.02 })
  changed = fitQuickBusinessFooterText(o, { width, height, maxFontSize: size, singleLine }) || changed
  changed = set(o, { left: x, top: y }) || changed
  return changed
}
const centerTextOnIcon = (field: any, icon: any): boolean => {
  if (!field || !icon || !activeText(field) || field.__manualTransform) return false
  const iconBox = box(icon)
  const textBox = box(field)
  return set(field, { top: iconBox.top + (iconBox.height - textBox.height) / 2 })
}

/** Layout dinâmico do cabeçalho social da campanha; aceita objetos Fabric e JSON. */
export const layoutCampaignSocial = (objects: any[]): boolean => {
  let changed = false
  for (const background of objects.filter(o => o?.name === 'header-social-background' && o.footerLayout === 'campaign-social')) {
    const siblings = objects.filter(o => String(o.parentFrameId || '') === String(background.parentFrameId || ''))
    const band = box(background)
    const scale = Math.max(.25, band.height / 72)
    const find = (name: string) => siblings.find(o => o.name === name)
    const fields = ['instagram', 'facebook'].map(key => find(`header-${key}`))
    const icons = ['instagram', 'facebook'].map(key => find(`header-icon-${key}`))
    const caption = find('header-social-caption')
    const divider = find('header-social-divider')
    const active = fields.map(populatedText)
    const count = active.filter(Boolean).length
    const before = changedState([background, ...fields, ...icons, caption, divider].filter(Boolean))
    set(background, { visible: count > 0 })
    fields.forEach((field, index) => { if (field) set(field, { visible: active[index] }) })
    icons.forEach((icon, index) => { if (icon) set(icon, { visible: active[index] }) })
    if (caption) set(caption, { visible: count > 0 && populatedText(caption) })
    if (divider) set(divider, { visible: count > 0 && populatedText(caption) })
    if (count) {
      const equalHandles = count === 2 && String(fields[0]?.text || '').trim().toLocaleLowerCase() === String(fields[1]?.text || '').trim().toLocaleLowerCase()
      if (background.footerSocialLayout === 'caption-below' && (count === 1 || equalHandles)) {
        const size = band.height * .34
        let left = band.left + band.width * .035
        icons.forEach((icon, index) => {
          if (!icon || !active[index] || icon.__manualTransform) return
          const factor = size / Math.max(1, num(icon.width, 1), num(icon.height, 1))
          set(icon, { visible: true, originX: 'left', originY: 'top', left, top: band.top + band.height * .07, scaleX: factor, scaleY: factor })
          left += size + band.width * .025
        })
        const field = fields.find((_, index) => active[index])
        fitText(field, left, band.top + band.height * .05, Math.max(1, band.left + band.width * .965 - left), band.height * .39, 25 * scale, true)
        centerTextOnIcon(field, icons.find((icon, index) => icon && active[index]))
        fitText(caption, band.left + band.width * .035, band.top + band.height * .50, band.width * .93, band.height * .42, 28 * scale, true)
        if (equalHandles && fields[1]) set(fields[1], { visible: false })
        if (divider) set(divider, { visible: false })
        changed = before !== changedState([background, ...fields, ...icons, caption, divider].filter(Boolean)) || changed
        continue
      }
      if (background.footerSocialLayout === 'stacked' && (count === 1 || equalHandles)) {
        const size = band.height * .39
        let left = band.left + band.width * .025
        icons.forEach((icon, index) => {
          if (!icon || !active[index] || icon.__manualTransform) return
          const factor = size / Math.max(1, num(icon.width, 1), num(icon.height, 1))
          set(icon, { visible: true, originX: 'left', originY: 'top', left, top: band.top + band.height * .07, scaleX: factor, scaleY: factor })
          left += size + band.width * .03
        })
        const field = fields.find((_, index) => active[index])
        fitText(field, left, band.top + band.height * .05, Math.max(1, band.left + band.width * .965 - left), band.height * .39, 25 * scale, true)
        centerTextOnIcon(field, icons.find((icon, index) => icon && active[index]))
        fitText(caption, band.left + band.width * .035, band.top + band.height * .50, band.width * .93, band.height * .42, 20 * scale)
        if (equalHandles && fields[1]) set(fields[1], { visible: false })
        if (divider) set(divider, { visible: false })
        changed = before !== changedState([background, ...fields, ...icons, caption, divider].filter(Boolean)) || changed
        continue
      }
      const iconSize = Math.min(band.height * .58, 38 * scale)
      const iconGap = 9 * scale
      const captionWidth = caption && populatedText(caption) ? Math.min(band.width * .27, 170 * scale) : 0
      const dividerGap = captionWidth ? 18 * scale : 0
      const socialsWidth = Math.max(1, band.width - captionWidth - dividerGap - (captionWidth ? 16 * scale : 0))
      const sameHandle = count === 2 && String(fields[0]?.text || '').trim().toLocaleLowerCase() === String(fields[1]?.text || '').trim().toLocaleLowerCase()
      const visibleFields = sameHandle ? [fields[0]] : fields.filter((_, index) => active[index])
      const slotWidth = socialsWidth / (sameHandle ? 1 : visibleFields.length)
      let left = band.left
      visibleFields.forEach((field, fieldIndex) => {
        const fieldKeyIndex = fields.indexOf(field)
        const distinctRows = count === 2 && !sameHandle
        const cellLeft = distinctRows ? band.left : band.left + fieldIndex * slotWidth
        const rowTop = distinctRows ? band.top + fieldIndex * band.height / 2 : band.top
        const rowHeight = distinctRows ? band.height / 2 : band.height
        const localIconSize = distinctRows ? Math.min(rowHeight * .58, 28 * scale) : iconSize
        const iconIndexes = sameHandle ? [0, 1] : [fieldKeyIndex]
        const iconTotal = iconIndexes.length * localIconSize + Math.max(0, iconIndexes.length - 1) * (distinctRows ? 0 : iconGap)
        const gap = (distinctRows ? 8 : 12) * scale
        const fieldWidth = distinctRows ? socialsWidth : slotWidth
        const textWidth = Math.max(1, fieldWidth - iconTotal - gap - 12 * scale)
        const contentWidth = iconTotal + gap + textWidth
        left = cellLeft + (fieldWidth - contentWidth) / 2
        iconIndexes.forEach(index => {
          const icon = icons[index]
          if (!icon || icon.__manualTransform) return
          const size = localIconSize / Math.max(1, num(icon.width, 1), num(icon.height, 1))
          set(icon, { visible: true, originX: 'left', originY: 'top', left, top: rowTop + (rowHeight - localIconSize) / 2, scaleX: size, scaleY: size })
          left += localIconSize + (distinctRows ? 0 : iconGap)
        })
        if (!field.__manualTransform) {
          fitText(field, left, rowTop + rowHeight * .12, textWidth, rowHeight * .76, 25 * scale, distinctRows)
          centerTextOnIcon(field, icons[fieldKeyIndex])
        }
      })
      if (sameHandle && fields[1]) set(fields[1], { visible: false })
      if (captionWidth && caption && !caption.__manualTransform) {
        const x = band.left + band.width - captionWidth
        fitText(caption, x + 12 * scale, band.top + band.height * .12, captionWidth - 12 * scale, band.height * .76, 18 * scale, false)
      }
      if (divider && captionWidth && !divider.__manualTransform) set(divider, { left: band.left + socialsWidth + 5 * scale, top: band.top + band.height * .18, width: 1.5 * scale, height: band.height * .64, scaleX: 1, scaleY: 1 })
    }
    changed = before !== changedState([background, ...fields, ...icons, caption, divider].filter(Boolean)) || changed
  }
  return changed
}

/** Rodapé de três blocos independentes da campanha. A geometria dos fundos é fixa. */
export const layoutCampaignRetailFooter = (objects: any[]): boolean => {
  let changed = false
  for (const background of objects.filter(o => o?.name === 'footer-premium-background' && o.footerLayout === 'campaign-retail')) {
    const siblings = objects.filter(o => String(o.parentFrameId || '') === String(background.parentFrameId || ''))
    const area = box(background)
    const scale = Math.max(.25, area.width / 1080)
    const find = (name: string) => siblings.find(o => o.name === name)
    const defs = [
      { field: 'whatsapp', name: 'footer-dynamic-whatsapp', title: 'footer-reference-whatsapp-label', caption: 'footer-whatsapp-caption', icon: 'icon-whatsapp' },
      { field: 'address', name: 'footer-dynamic-address', title: 'footer-reference-address-label', caption: 'footer-address-caption', icon: 'icon-address' },
      { field: 'footerPaymentImages', name: 'footer-payment-images', title: 'footer-payment-label', caption: '', icon: '' }
    ]
    const entries = defs.map(def => ({ ...def, body: find(def.name) || siblings.find(o => o.businessProfileField === def.field), titleObject: find(def.title), captionObject: def.caption ? find(def.caption) : undefined, iconObject: def.icon ? find(def.icon) : undefined }))
    const isPayment = (o: any) => {
      const children = o?.getObjects?.() || o?.objects || []
      const type = String(o?.type || '').toLowerCase()
      return !!o && o.visible !== false && o.quickFieldEnabled !== false &&
        (type !== 'group' || children.some((child: any) => String(child?.type || '').toLowerCase() === 'image')) &&
        Number(o.footerPaymentWidth || o.width) > 0 && Number(o.footerPaymentHeight || o.height) > 0
    }
    const enabled = entries.map((entry, i) => i === 2 ? isPayment(entry.body) : populatedText(entry.body))
    const activeEntries = entries.filter((_, i) => enabled[i])
    const dividers = [find('footer-column-divider-1'), find('footer-column-divider-2')]
    const phonePanel = find('footer-whatsapp-panel')
    const tracked = [background, ...entries.flatMap(e => [e.body, e.titleObject, e.captionObject, e.iconObject].filter(Boolean)), ...dividers.filter(Boolean), ...(phonePanel ? [phonePanel] : [])]
    const before = changedState(tracked)
    set(background, { visible: activeEntries.length > 0 })
    if (phonePanel) set(phonePanel, { visible: enabled[0] })
    const inset = 20 * scale
    const gap = 12 * scale
    const available = Math.max(1, area.width - inset * 2 - gap * Math.max(0, activeEntries.length - 1))
    const weights = entries.map((_, index) => Math.max(.01, num(background.footerColumnWeights?.[index], 1)))
    const activeWeight = activeEntries.reduce((total, entry) => total + weights[entries.indexOf(entry)]!, 0)
    let colLeft = area.left + inset
    for (const entry of entries) {
      const on = enabled[entries.indexOf(entry)]
      if (entry.body) set(entry.body, { visible: on })
      if (entry.titleObject) set(entry.titleObject, { visible: on && populatedText(entry.titleObject) })
      if (entry.captionObject) set(entry.captionObject, { visible: on && populatedText(entry.captionObject) })
      if (entry.iconObject) set(entry.iconObject, { visible: on })
    }
    for (let i = 0; i < dividers.length; i++) {
      const divider = dividers[i]
      if (divider) set(divider, { visible: i < activeEntries.length - 1 })
    }
    activeEntries.forEach((entry, index) => {
      const x = colLeft
      const width = available * weights[entries.indexOf(entry)]! / Math.max(.01, activeWeight)
      const y = area.top + area.height * .12
      const h = area.height * .76
      if (entry.field === 'whatsapp' && phonePanel && !phonePanel.__manualTransform) {
        set(phonePanel, { left: x - 6 * scale, top: area.top + area.height * .08, width: width + 12 * scale, height: area.height * .84, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top' })
      }
      const multilineTitle = String(entry.titleObject?.text || '').includes('\n')
      // Sem título nem legenda, o valor ocupa a altura toda e fica centralizado na faixa.
      const bare = !populatedText(entry.titleObject) && !populatedText(entry.captionObject)
      const titleH = bare ? 0 : h * (multilineTitle ? .32 : .20), bodyH = bare ? h : h * (multilineTitle ? .43 : .55), captionH = bare ? 0 : h * .15
      if (entry.titleObject && !entry.titleObject.__manualTransform) fitText(entry.titleObject, x, y, width, titleH, 21 * scale, !multilineTitle)
      const bodyY = y + titleH
      if (entry.body?.__manualTransform) {
        // Keep manual placement while restoring visibility after a field is reactivated.
        set(entry.body, { visible: true })
      } else if (entry.field === 'footerPaymentImages') {
        const paymentHeight = Math.max(1, h - titleH)
        set(entry.body, { visible: true, left: x, top: bodyY, width, height: paymentHeight, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', footerPaymentWidth: width, footerPaymentHeight: paymentHeight })
      } else {
        const icon = entry.iconObject
        const iconScale = Math.min(1, Math.max(.2, num(icon?.footerIconScale, 1)))
        const iconSize = icon ? Math.min(width * .22, area.height * .55, 72 * scale) * iconScale : 0
        const iconGap = icon ? 12 * scale : 0
        const contentLeft = x + iconSize + iconGap
        const textWidth = Math.max(1, width - iconSize - iconGap)
        if (icon && !icon.__manualTransform) {
          const fit = iconSize / Math.max(1, num(icon.width, 1), num(icon.height, 1))
          set(icon, { visible: true, originX: 'left', originY: 'top', left: x, top: area.top + (area.height - iconSize) / 2, scaleX: fit, scaleY: fit })
        }
        fitText(entry.titleObject, contentLeft, y, textWidth, titleH, 21 * scale, !multilineTitle)
        fitText(entry.body, contentLeft, bodyY + bodyH * .05, textWidth, bodyH * .9, entry.field === 'address' ? 22 * scale : 32 * scale, entry.field === 'whatsapp')
        if (bare && entry.body && !entry.body.__manualTransform && activeText(entry.body)) {
          const measured = box(entry.body)
          set(entry.body, { top: area.top + (area.height - measured.height) / 2 })
        }
        if (entry.captionObject && !entry.captionObject.__manualTransform) fitText(entry.captionObject, contentLeft, bodyY + bodyH + captionH * .05, textWidth, captionH * .9, 16 * scale, true)
      }
      if (index < activeEntries.length - 1 && index < dividers.length && dividers[index]) {
        const divider = dividers[index]
        if (!divider.__manualTransform) set(divider, { visible: true, left: x + width + gap / 2, top: area.top + area.height * .16, width: 1.5 * scale, height: area.height * .68, scaleX: 1, scaleY: 1 })
      }
      colLeft += width + gap
    })
    changed = before !== changedState(tracked) || changed
  }
  return changed
}
