import { layoutReferenceFooter, layoutHeaderInstagram } from './referenceFlyerLayout'
import { fitQuickBusinessFooterText } from './quickBusinessFooterTypography'

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
const objectWidth = (object: any): number => Math.max(1, numberValue(object?.width, 1))
const objectHeight = (object: any): number => Math.max(1, numberValue(object?.height, 1))
const bounds = (object: any) => {
  const width = objectWidth(object) * Math.abs(numberValue(object?.scaleX, 1) || 1)
  const height = objectHeight(object) * Math.abs(numberValue(object?.scaleY, 1) || 1)
  return {
    left: numberValue(object?.left) - (object?.originX === 'center' ? width / 2 : object?.originX === 'right' ? width : 0),
    top: numberValue(object?.top) - (object?.originY === 'center' ? height / 2 : object?.originY === 'bottom' ? height : 0),
    width, height
  }
}
const inside = (object: any, background: any): boolean => {
  const item = bounds(object)
  const footer = bounds(background)
  // A text field may already overflow vertically due to the bug being repaired.
  // Its top-left anchor still identifies the footer, unlike header contacts.
  return item.left >= footer.left - 3 && item.left < footer.left + footer.width &&
    item.top >= footer.top - 8 && item.top < footer.top + footer.height
}
const footerTextColor = (fill: unknown): string => {
  const match = String(fill || '').match(/^#([0-9a-f]{6})$/i)
  if (!match) return '#ffffff'
  const [red = 0, green = 0, blue = 0] = [0, 2, 4].map(offset => parseInt(match[1]!.slice(offset, offset + 2), 16))
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > .56 ? '#172033' : '#ffffff'
}
const fieldFor = (object: any): FooterField | null => {
  const field = String(object?.businessProfileField || '')
  if (FOOTER_FIELDS.includes(field as FooterField)) return field as FooterField
  const name = String(object?.name || '')
  for (const candidate of FOOTER_FIELDS) if (name === `dynamic-${candidate}` || name === `footer-dynamic-${candidate}`) return candidate
  return null
}
const active = (object: any): boolean => !!object && object.visible !== false && object.quickFieldEnabled !== false &&
  (!['text', 'textbox', 'i-text'].includes(String(object.type).toLowerCase()) || !!String(object.text || '').trim())

/**
 * Rodapés antigos mantêm sua organização. O modelo contacts-address deixa a
 * marca no cabeçalho e usa duas colunas com endereço amplo. Campos vazios
 * recolhem a coluna; cada texto ocupa somente o orçamento do próprio bloco.
 * Aceita instâncias Fabric e JSON das páginas inativas.
 */
export const compactBusinessFooter = (objects: any[]): boolean => {
  let changed = layoutHeaderInstagram(objects)
  const patch = (object: any, values: Record<string, any>) => { changed = setObject(object, values) || changed }
  for (const background of objects.filter(object => object?.name === 'footer-premium-background')) {
    if (background.footerLayout === 'reference-contacts') { changed = layoutReferenceFooter(background, objects) || changed; continue }
    const footer = bounds(background)
    const scale = Math.max(.25, footer.width / 1080)
    const inset = Math.min(24 * scale, footer.height * .08)
    const gap = 28 * scale
    const height = Math.max(1, footer.height - inset * 2)
    const local = objects.filter(object => object !== background &&
      String(object.parentFrameId || '') === String(background.parentFrameId || '') &&
      !/^header-/.test(String(object.name || '')) &&
      (String(object.name || '').startsWith('footer-') || inside(object, background)))
    const fields = Object.fromEntries(FOOTER_FIELDS.map(field => [field,
      local.find(object => object.name === `footer-dynamic-${field}`) || local.find(object => fieldFor(object) === field)
    ]))
    const contactsOnly = background.footerLayout === 'contacts-address'
    const isolatedLogo = background.footerLayout === 'logo-contacts-address'
    const logo = contactsOnly ? undefined : local.find(object => object.name === 'footer-logo-slot') ||
      local.find(object => object.businessProfileField === 'logo' || object.quickLogoSlot)
    const groups = (contactsOnly ? [
      { weight: .45, items: [fields.whatsapp, fields.instagram].filter(active) },
      { weight: .55, items: [fields.address].filter(active) }
    ] : isolatedLogo ? [
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
    const color = footerTextColor(background.fill)
    for (const object of local) {
      if (/^footer-(contact|title|divider|column-divider)-/.test(String(object.name || '')) || object.name === 'footer-social-divider') patch(object, { visible: false })
    }
    for (const field of ['instagram', 'facebook', 'whatsapp', 'phone', 'address']) {
      const icon = local.find(object => object.name === `icon-${field}`)
      if (icon) patch(icon, { visible: active(fields[field]) })
    }
    for (const [groupIndex, group] of groups.entries()) {
      const width = available * group.weight / total
      const divider = local.find(object => object.name === `footer-column-divider-${groupIndex}`)
      if (divider) patch(divider, { visible: groupIndex > 0, left: left - gap / 2,
        top: footer.top + footer.height * .18, width: 1.5 * scale, height: footer.height * .64,
        scaleX: 1, scaleY: 1, originX: 'left', originY: 'top', fill: divider.fill || color, opacity: .42 })
      const sharedSocial = group.items.includes(logo) && active(fields.instagram) && active(fields.facebook)
      const rows = group.items.filter(object => !(sharedSocial && object === fields.facebook)).map(object => ({
        object, field: object === logo ? 'logo' : fieldFor(object) || ''
      }))
      const rowGap = Math.min((isolatedLogo || contactsOnly ? 16 : 9) * scale, height * .16)
      const rowArea = Math.max(1, height - rowGap * Math.max(0, rows.length - 1))
      const hasLogo = rows.some(row => row.field === 'logo')
      let top = footer.top + inset
      for (const row of rows) {
        const rowHeight = hasLogo && rows.length > 1
          ? row.field === 'logo' ? Math.max(rowArea * .55, rowArea - 38 * scale) : Math.min(rowArea * .45, 38 * scale)
          : rowArea / rows.length
        if (row.field === 'logo') {
          if (!row.object.__manualTransform) {
            const image = String(row.object.type).toLowerCase() === 'image'
            const imageFit = Math.min(width / objectWidth(row.object), rowHeight / objectHeight(row.object))
            patch(row.object, { left: left + width / 2, top: top + rowHeight / 2,
              originX: 'center', originY: 'center', quickLogoCenterX: left + width / 2,
              quickLogoCenterY: top + rowHeight / 2, quickLogoMaxWidth: width, quickLogoMaxHeight: rowHeight,
              ...(image ? { scaleX: imageFit, scaleY: imageFit } : { width, height: rowHeight, scaleX: 1, scaleY: 1 }) })
          }
        } else if (row.field === 'footerPaymentImages') {
          if (!row.object.__manualTransform) patch(row.object, { left, top, width, height: rowHeight, scaleX: 1, scaleY: 1,
            originX: 'left', originY: 'top', footerPaymentWidth: width, footerPaymentHeight: rowHeight })
        } else {
          const socialFields = sharedSocial && row.field === 'instagram' ? ['instagram', 'facebook'] : [row.field]
          const socialGap = socialFields.length > 1 ? 16 * scale : 0
          const cellWidth = (width - socialGap) / socialFields.length
          for (const [index, field] of socialFields.entries()) {
            const object = fields[field]
            if (!object || object.__manualTransform) continue
            const cellLeft = left + index * (cellWidth + socialGap)
            const icon = local.find(candidate => candidate.name === `icon-${field}`)
            const desiredIconSize = numberValue(icon?.footerIconSize, field === 'address' ? 44 : 32) * scale
            const iconSize = icon ? Math.min(desiredIconSize, rowHeight) : 0
            const iconGap = icon ? 12 * scale : 0
            const contentWidth = Math.max(1, cellWidth - iconSize - iconGap)
            const defaultSize = (['whatsapp', 'phone'].includes(field) ? 36 : field === 'address' ? 30 : socialFields.length > 1 ? 20 : 27) * scale
            const fontSize = object.__manualTypography
              ? numberValue(object.dynamicFieldBaseFontSize, numberValue(object.fontSize, defaultSize))
              : Math.max(numberValue(object.dynamicFieldBaseFontSize, numberValue(object.fontSize, defaultSize)), defaultSize)
            const text = String(object.text || '').replace(/\s*·\s*/g, field === 'instagram' || field === 'facebook' ? ' · ' : '\n')
            patch(object, { text, originX: 'left', originY: 'top',
              fontFamily: object.fontFamily || 'Barlow', fontWeight: object.fontWeight || 800,
              lineHeight: object.lineHeight || 1.04, fill: object.dynamicFieldTextColor || object.fill || color })
            changed = fitQuickBusinessFooterText(object, { width: contentWidth, height: rowHeight,
              maxFontSize: fontSize, singleLine: field === 'instagram' || field === 'facebook' ||
                (['whatsapp', 'phone'].includes(field) && !text.includes('\n')) }) || changed
            patch(object, { left: cellLeft + iconSize + iconGap,
              top: top + (rowHeight - objectHeight(object) * numberValue(object.scaleY, 1)) / 2 })
            if (icon && !icon.__manualTransform) {
              const iconFit = iconSize / Math.max(objectWidth(icon), objectHeight(icon))
              patch(icon, { left: cellLeft + (iconSize - objectWidth(icon) * iconFit) / 2,
                top: top + (rowHeight - objectHeight(icon) * iconFit) / 2, originX: 'left', originY: 'top',
                scaleX: iconFit, scaleY: iconFit, visible: true })
            }
          }
          if (socialFields.length > 1) {
            const socialDivider = local.find(object => object.name === 'footer-social-divider')
            if (socialDivider) patch(socialDivider, { left: left + width / 2, top: top + rowHeight * .15,
              width: scale, height: rowHeight * .7, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1,
              fill: socialDivider.fill || color, opacity: .42, visible: true })
          }
        }
        top += rowHeight + rowGap
      }
      left += width + gap
    }
  }
  return changed
}
