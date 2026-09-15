const FOOTER_FIELDS = ['instagram', 'whatsapp', 'address', 'footerPaymentImages'] as const
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

const labels: Record<FooterField, string> = {
  instagram: 'SIGA NOSSO INSTAGRAM',
  whatsapp: 'WHATSAPP DE OFERTAS',
  address: 'ENDEREÇO',
  footerPaymentImages: 'CARTÕES ACEITOS'
}

const textSize = (field: FooterField, scale: number): number => Math.max(13, (field === 'address' ? 20 : field === 'instagram' ? 24 : 25) * scale)

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

const findForFooter = (objects: any[], background: any, predicate: (object: any) => boolean): any => {
  const parent = background?.parentFrameId
  return objects.find(object => predicate(object) && (
    (parent && object?.parentFrameId === parent) || inside(object, background)
  )) || objects.find(object => predicate(object))
}

const findBox = (objects: any[], background: any, field: FooterField): any =>
  findForFooter(objects, background, object => object?.name === `footer-contact-${field === 'footerPaymentImages' ? 'payments' : field}`)

const findTitle = (objects: any[], background: any, field: FooterField): any =>
  findForFooter(objects, background, object => object?.name === `footer-title-${field}`) ||
  findForFooter(objects, background, object => String(object?.text || '').trim().toUpperCase() === labels[field])

const findFieldObject = (objects: any[], background: any, field: FooterField): any =>
  findForFooter(objects, background, object => fieldFor(object) === field)

const placeIcon = (icon: any, box: { left: number; top: number; width: number; height: number }, scale: number): boolean => {
  if (!icon) return false
  const iconWidth = objectWidth(icon)
  const iconHeight = objectHeight(icon)
  const iconSize = Math.min(34 * scale, Math.max(14 * scale, box.height - 14 * scale))
  const fit = iconSize / Math.max(iconWidth, iconHeight)
  return setObject(icon, {
    originX: 'left', originY: 'top',
    left: box.left + 8 * scale,
    top: box.top + (box.height - Math.max(iconWidth, iconHeight) * fit) / 2,
    scaleX: fit, scaleY: fit, visible: true
  })
}

/**
 * Reorganiza rodapés antigos para o mesmo layout usado nos novos modelos.
 * A operação só toca objetos identificados pelo contrato do rodapé: zona de
 * produtos, arte e demais elementos da página ficam intactos.
 */
export const compactBusinessFooter = (objects: any[]): boolean => {
  let changed = false
  for (const background of objects.filter(object => object?.name === 'footer-premium-background')) {
    const old = bounds(background)
    const scale = Math.max(.25, old.width / 1080)
    const bottom = old.top + old.height
    const targetHeight = 220 * scale
    const zone = objects.find(object => object?.isProductZone && (!background.parentFrameId || object.parentFrameId === background.parentFrameId))
    const canGrow = old.height < targetHeight && (!zone || bounds(zone).top + bounds(zone).height <= bottom - targetHeight - 8 * scale)
    const nextHeight = old.height > targetHeight + 1 || canGrow ? targetHeight : old.height
    if (Math.abs(old.height - nextHeight) > .5 || Math.abs(old.top - (bottom - nextHeight)) > .5) {
      changed = setObject(background, { top: bottom - nextHeight, height: nextHeight }) || changed
    }

    const footer = bounds(background)
    const style = footerStyle(background.fill)
    const inset = 10 * scale
    const gap = 8 * scale
    const innerWidth = footer.width - inset * 2
    const innerHeight = footer.height - inset * 2
    const leftWidth = innerWidth * .58
    const rightWidth = innerWidth - leftWidth - gap
    const rowHeight = Math.max(48 * scale, (innerHeight - gap * 2) / 3)
    const boxes: Record<FooterField, { left: number; top: number; width: number; height: number }> = {
      instagram: { left: footer.left + inset, top: footer.top + inset, width: leftWidth, height: rowHeight },
      whatsapp: { left: footer.left + inset, top: footer.top + inset + rowHeight + gap, width: leftWidth, height: rowHeight },
      address: { left: footer.left + inset, top: footer.top + inset + (rowHeight + gap) * 2, width: leftWidth, height: rowHeight },
      footerPaymentImages: { left: footer.left + inset + leftWidth + gap, top: footer.top + inset, width: rightWidth, height: innerHeight }
    }

    for (const field of FOOTER_FIELDS) {
      const box = boxes[field]
      const border = findBox(objects, background, field)
      if (border) {
        changed = setObject(border, {
          left: box.left, top: box.top, width: box.width, height: box.height,
          scaleX: 1, scaleY: 1, originX: 'left', originY: 'top',
          fill: style.panel, stroke: style.stroke,
          strokeWidth: Math.max(1, 1.5 * scale), rx: 14 * scale, ry: 14 * scale, visible: true
        }) || changed
      }

      const title = findTitle(objects, background, field)
      const item = findFieldObject(objects, background, field)
      if (field === 'footerPaymentImages') {
        const labelWidth = Math.min(box.width - 24 * scale, 170 * scale)
        const paymentWidth = Math.max(30 * scale, box.width - 24 * scale)
        if (title) changed = setObject(title, {
          left: box.left + 12 * scale, top: box.top + 12 * scale, width: labelWidth,
          originX: 'left', originY: 'top', fontSize: Math.max(8, 11 * scale),
          fontFamily: 'Barlow', fontWeight: 900, fill: style.text, visible: true
        }) || changed
        if (item) changed = setObject(item, {
          left: box.left + 12 * scale, top: box.top + 38 * scale,
          width: paymentWidth,
          height: Math.max(28 * scale, box.height - 50 * scale), scaleX: 1, scaleY: 1,
          originX: 'left', originY: 'top',
          footerPaymentWidth: paymentWidth,
          footerPaymentHeight: Math.max(28 * scale, box.height - 50 * scale), visible: true
        }) || changed
        continue
      }

      const icon = objects.find(object => object?.name === `icon-${field}` && (object.parentFrameId === background.parentFrameId || inside(object, background)))
      changed = placeIcon(icon, box, scale) || changed
      const iconSize = Math.min(34 * scale, Math.max(14 * scale, box.height - 14 * scale))
      const contentLeft = box.left + iconSize + 22 * scale
      const contentWidth = Math.max(48 * scale, box.width - iconSize - 34 * scale)
      if (title) changed = setObject(title, {
        left: contentLeft, top: box.top + 10 * scale, width: contentWidth,
        originX: 'left', originY: 'top', fontSize: Math.max(8, 11 * scale),
        fontFamily: 'Barlow', fontWeight: 900, fill: style.text, visible: true
      }) || changed
      if (item) {
        const size = textSize(field, scale)
        changed = setObject(item, {
          left: contentLeft, top: box.top + 30 * scale, width: contentWidth,
          originX: 'left', originY: 'top', scaleX: 1, scaleY: 1,
          fontFamily: 'Barlow', fontWeight: 800, fontSize: size, lineHeight: 1.02,
          dynamicFieldBaseFontSize: size, dynamicFieldAutoFitFontSize: size, fill: style.text,
          dynamicFieldAutoHeight: true, dynamicFieldHeight: 0,
          splitByGrapheme: field === 'address', visible: item.visible !== false
        }) || changed
        item.initDimensions?.()
        item.setCoords?.()
      }
    }

    for (const object of objects) {
      if (/^footer-divider-/.test(String(object?.name || '')) && object.visible !== false) {
        changed = setObject(object, { visible: false }) || changed
      }
    }
  }
  return changed
}
