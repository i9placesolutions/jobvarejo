const FOOTER_FIELDS = ['instagram', 'facebook', 'whatsapp', 'phone', 'address', 'footerPaymentImages'] as const
type FooterField = typeof FOOTER_FIELDS[number]

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const setObject = (object: any, patch: Record<string, any>): boolean => {
  if (!object) return false
  const changed = Object.entries(patch).some(([key, value]) => JSON.stringify(object[key]) !== JSON.stringify(value))
  if (changed) {
    if (typeof object.set === 'function') object.set(patch)
    else Object.assign(object, patch)
    object.dirty = true
  }
  object.setCoords?.()
  return changed
}

const bounds = (object: any) => ({
  left: numberValue(object?.left),
  top: numberValue(object?.top),
  width: Math.max(0, numberValue(object?.width) * Math.abs(numberValue(object?.scaleX, 1) || 1)),
  height: Math.max(0, numberValue(object?.height) * Math.abs(numberValue(object?.scaleY, 1) || 1))
})

const inside = (object: any, background: any): boolean => {
  const item = bounds(object)
  const footer = bounds(background)
  return item.left >= footer.left - 3 && item.top >= footer.top - 8 &&
    item.left + item.width <= footer.left + footer.width + 3 &&
    item.top + item.height <= footer.top + footer.height + 8
}

const objectWidth = (object: any): number => Math.max(1, numberValue(object?.width, object?.getScaledWidth?.() || 1))
const objectHeight = (object: any): number => Math.max(1, numberValue(object?.height, object?.getScaledHeight?.() || 1))

const footerStyle = (fill: unknown) => {
  const match = String(fill || '').match(/^#([0-9a-f]{6})$/i)
  if (!match) return { text: '#ffffff', panel: 'rgba(255,255,255,0.12)', stroke: 'rgba(255,255,255,0.42)' }
  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map(offset => parseInt(match[1]!.slice(offset, offset + 2), 16))
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > .56
    ? { text: '#172033', panel: 'rgba(0,0,0,0.10)', stroke: 'rgba(0,0,0,0.28)' }
    : { text: '#ffffff', panel: 'rgba(255,255,255,0.12)', stroke: 'rgba(255,255,255,0.42)' }
}

const fieldFor = (object: any): FooterField | null => {
  const field = String(object?.businessProfileField || '')
  if (FOOTER_FIELDS.includes(field as FooterField)) return field as FooterField
  const name = String(object?.name || '')
  for (const candidate of FOOTER_FIELDS) if (name === `dynamic-${candidate}` || name === `footer-dynamic-${candidate}`) return candidate
  return null
}

/** Layout de referência: marca/redes, telefones/cartões e endereços.
 * Campos vazios não reservam coluna; cada bloco é centralizado verticalmente.
 * Funciona tanto com objetos Fabric quanto com o JSON de páginas inativas.
 */
export const compactBusinessFooter = (objects: any[]): boolean => {
  let changed = false
  const patch = (object: any, values: Record<string, any>) => { changed = setObject(object, values) || changed }
  for (const background of objects.filter(object => object?.name === 'footer-premium-background')) {
    const footer = bounds(background)
    const scale = Math.max(.25, footer.width / 1080)
    const inset = Math.min(24 * scale, footer.height * .08)
    const gap = 28 * scale
    const height = Math.max(1, footer.height - inset * 2)
    const local = objects.filter(object => background.parentFrameId
      ? object.parentFrameId === background.parentFrameId
      : !object.parentFrameId && inside(object, background))
    const fields = Object.fromEntries(FOOTER_FIELDS.map(field => [field, local.find(object => fieldFor(object) === field)]))
    const logo = local.find(object => object.name === 'footer-logo-slot') || local.find(object => object.businessProfileField === 'logo' || object.quickLogoSlot)
    const active = (object: any) => object && object.visible !== false && object.quickFieldEnabled !== false &&
      (!['text', 'textbox', 'i-text'].includes(String(object.type).toLowerCase()) || !!String(object.text || '').trim())
    const isolatedLogo = background.footerLayout === 'logo-contacts-address'
    const groups = (isolatedLogo ? [
      { weight: .25, items: [logo].filter(active) },
      { weight: .34, items: [fields.whatsapp, fields.instagram].filter(active) },
      { weight: .41, items: [fields.address].filter(active) }
    ] : [
      { weight: .29, items: [logo, fields.instagram, fields.facebook].filter(active) },
      { weight: .37, items: [fields.whatsapp, fields.phone, fields.footerPaymentImages].filter(active) },
      { weight: .34, items: [fields.address].filter(active) }
    ]).filter(group => group.items.length)
    const total = groups.reduce((sum, group) => sum + group.weight, 0)
    const available = footer.width - inset * 2 - gap * Math.max(0, groups.length - 1)
    let left = footer.left + inset
    const color = footerStyle(background.fill).text
    for (const object of local) {
      if (/^footer-(contact|title|divider|column-divider)-/.test(String(object.name || '')) || object.name === 'footer-social-divider') patch(object, { visible: false })
    }
    for (const field of ['instagram', 'facebook', 'whatsapp', 'phone', 'address']) {
      const icon = local.find(object => object.name === `icon-${field}`)
      if (icon) patch(icon, { visible: !!active(fields[field]) })
    }
    for (const [groupIndex, group] of groups.entries()) {
      const divider = local.find(object => object.name === `footer-column-divider-${groupIndex}`)
      if (divider) patch(divider, { visible: groupIndex > 0, left: left - gap / 2, top: footer.top + footer.height * .18, width: 1.5 * scale, height: footer.height * .64, scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', fill: '#FFC400', opacity: .5 })
      const width = available * group.weight / total
      const sharedSocial = group.items.includes(logo) && active(fields.instagram) && active(fields.facebook)
      const rows: { object: any; height: number; field: string; icon?: any }[] = []
      for (const object of group.items) {
        if (sharedSocial && object === fields.facebook) continue
        const field = object === logo ? 'logo' : fieldFor(object) || ''
        const icon = local.find(candidate => candidate.name === `icon-${field}`)
        if (field === 'logo') {
          rows.push({ object, field, height: Math.max(1, height - (!isolatedLogo && (active(fields.instagram) || active(fields.facebook)) ? 41 * scale : 0)) })
        } else if (field === 'footerPaymentImages') {
          rows.push({ object, field, height: Math.min(28 * scale, height * .24) })
        } else {
          const size = (['whatsapp', 'phone'].includes(field) ? 36 : field === 'address' ? 17 : sharedSocial ? 16 : 22) * scale
          const text = String(object.text || '').replace(/\s*·\s*/g, '\n')
          patch(object, { text, width: Math.max(1, (sharedSocial && field === 'instagram' ? width / 2 : width) - (icon ? (numberValue(icon.footerIconSize, 25) + 9) * scale : 0)),
            scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', fontFamily: 'Barlow',
            fontWeight: 800, fontSize: size, lineHeight: 1.04, fill: color,
            dynamicFieldBaseFontSize: size, dynamicFieldAutoFitFontSize: size,
            dynamicFieldAutoHeight: true, dynamicFieldHeight: 0, splitByGrapheme: false })
          object.initDimensions?.()
          const measured = typeof object.initDimensions === 'function' ? numberValue(object.height) :
            text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length * size * .53 / object.width)), 0) * size * 1.18
          rows.push({ object, field, icon, height: isolatedLogo && icon ? Math.max(measured, numberValue(icon.footerIconSize, 40) * scale) : sharedSocial && field === 'instagram' ? Math.max(measured, 32 * scale) : measured })
        }
      }
      const rowGap = (isolatedLogo && group.items.includes(fields.whatsapp) && group.items.includes(fields.instagram) ? 16 : 9) * scale
      const naturalHeight = rows.reduce((sum, row) => sum + row.height, 0) + rowGap * (rows.length - 1)
      const fit = Math.min(1, height / Math.max(1, naturalHeight))
      let top = footer.top + inset + (height - naturalHeight * fit) / 2
      for (const row of rows) {
        const rowHeight = row.height * fit
        if (row.field === 'logo') {
          const image = String(row.object.type).toLowerCase() === 'image'
          const imageFit = Math.min(width / objectWidth(row.object), rowHeight / objectHeight(row.object))
          patch(row.object, { left: left + width / 2, top: top + rowHeight / 2,
            originX: 'center', originY: 'center', quickLogoCenterX: left + width / 2,
            quickLogoCenterY: top + rowHeight / 2, quickLogoMaxWidth: width, quickLogoMaxHeight: rowHeight,
            ...(image ? { scaleX: imageFit, scaleY: imageFit } : { width, height: rowHeight, scaleX: 1, scaleY: 1 }) })
        } else if (row.field === 'footerPaymentImages') {
          patch(row.object, { left, top, width, height: rowHeight, scaleX: 1, scaleY: 1,
            originX: 'left', originY: 'top', footerPaymentWidth: width, footerPaymentHeight: rowHeight })
        } else {
          patch(row.object, { left: left + (row.icon ? (numberValue(row.icon.footerIconSize, 25) + 9) * scale : 0), top: isolatedLogo && row.icon ? top + (rowHeight - objectHeight(row.object) * fit) / 2 : top, scaleX: fit, scaleY: fit })
          if (sharedSocial && row.field === 'instagram') {
            const socialGap = 16 * scale
            const cellWidth = (width - socialGap) / 2
            const centerY = top + rowHeight / 2
            for (const [index, field] of ['instagram', 'facebook'].entries()) {
              const social = fields[field]
              const icon = local.find(object => object.name === `icon-${field}`)
              const cellLeft = left + index * (cellWidth + socialGap)
              const iconSize = 32 * scale
              const contentLeft = cellLeft + (icon ? iconSize + 8 * scale : 0)
              const contentWidth = Math.max(1, cellWidth - (contentLeft - cellLeft))
              patch(social, { width: contentWidth, fontSize: 15 * scale, fontFamily: 'Barlow',
                fontWeight: 800, originX: 'left', originY: 'top', fill: color,
                dynamicFieldBaseFontSize: 15 * scale, dynamicFieldAutoFitFontSize: 15 * scale })
              social.initDimensions?.()
              const textFit = Math.min(1, contentWidth / objectWidth(social))
              patch(social, { left: contentLeft, top: centerY - objectHeight(social) * textFit / 2,
                scaleX: textFit, scaleY: textFit })
              if (icon) {
                const iconFit = iconSize / Math.max(objectWidth(icon), objectHeight(icon))
                patch(icon, { left: cellLeft + (iconSize - objectWidth(icon) * iconFit) / 2,
                  top: centerY - objectHeight(icon) * iconFit / 2, originX: 'left', originY: 'top',
                  scaleX: iconFit, scaleY: iconFit, visible: true })
              }
            }
            const divider = local.find(object => object.name === 'footer-social-divider')
            if (divider) patch(divider, { left: left + width / 2, top: centerY - 13 * scale,
              width: scale, height: 26 * scale, originX: 'left', originY: 'top',
              scaleX: 1, scaleY: 1, fill: '#FFC400', opacity: .55, visible: true })
          }
          if (row.icon && !(sharedSocial && row.field === 'instagram')) {
            const iconFit = numberValue(row.icon.footerIconSize, 25) * scale / Math.max(objectWidth(row.icon), objectHeight(row.icon))
            patch(row.icon, { left, top: top + (rowHeight - objectHeight(row.icon) * iconFit) / 2,
              originX: 'left', originY: 'top', scaleX: iconFit, scaleY: iconFit, visible: true })
          }
        }
        top += rowHeight + rowGap * fit
      }
      left += width + gap
    }
  }
  return changed
}
