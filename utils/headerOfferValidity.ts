import { splitFooterValidityText } from './splitFooterValidity'

/** Usa somente a área de validade já reservada acima da zona de produtos. */
export const layoutHeaderOfferValidity = (text: any, children: any[]): boolean | null => {
  if (text.quickOfferScope?.mode && text.quickOfferScope.mode !== 'all') return null
  if (!text.quickValidityStartDate && !text.quickValidityEndDate) return null
  const box = text.getBoundingRect()
  const zone = children.find(o => o.isProductZone && o.getBoundingRect().top >= box.top)
  if (!zone) return null
  const band = children.find(o => o.name === 'validity-backdrop')
  const icon = children.find(o => o.quickDynamicIconFor === 'validity')
  const area = band?.getBoundingRect() || box
  const scale = Math.abs(text.scaleX || 1)
  const availableHeight = zone.getBoundingRect().top - Math.min(area.top, box.top) - 6
  if (availableHeight < 60 * scale || area.width < 260 * scale) return null
  const copy = splitFooterValidityText({ startDate: text.quickValidityStartDate, endDate: text.quickValidityEndDate,
    mode: text.quickValidityMode, whileStocks: text.quickValidityWhileStocks })
  if (!copy.period) return null
  const original = Object.fromEntries(['text', '__rawText', 'textAlign', 'styles', 'width', 'lineHeight', 'backgroundColor', 'fill', 'fontSize'].map(key => [key, text[key]]))
  const before = JSON.stringify([text.text, text.left, text.top, text.width, text.styles, text.textAlign])
  const background = String(text.fill || '')
  const rgb = /^#([0-9a-f]{6})$/i.exec(background)?.[1]
  const luminance = rgb ? (.299 * parseInt(rgb.slice(0, 2), 16) + .587 * parseInt(rgb.slice(2, 4), 16) + .114 * parseInt(rgb.slice(4, 6), 16)) : 255
  const ink = String(text.dynamicFieldTextColor || text.fill || '#ffffff')
  const accent = text.dynamicFieldTextColor || (rgb && luminance < 145 ? '#7d1d0c' : '#ffe11f')
  const fontSize = Math.min(Number(text.dynamicFieldBaseFontSize || text.fontSize || 20), (availableHeight - 12 * scale) / (2.8 * scale))
  const lines = [copy.heading, copy.period, copy.stock].filter(Boolean)
  const styles: Record<number, Record<number, any>> = {}
  lines.forEach((line, row) => {
    styles[row] = {}
    for (let col = 0; col < line.length; col++) styles[row]![col] = {
      fontSize: row === 1 ? fontSize : fontSize * .65,
      fontWeight: row === 1 ? 'bold' : 'normal', fill: row === 1 ? accent : ink
    }
  })
  const iconSize = fontSize * 2.6 * scale
  const left = area.left + 10 * scale + (icon ? iconSize + 14 * scale : 0)
  const top = Math.min(area.top, box.top)
  const value = lines.join('\n')
  text.set({ text: value, __rawText: value, textAlign: 'left', styles, fontSize,
    width: (area.left + area.width - left - 10 * scale) / scale, lineHeight: 1.12, backgroundColor: '', fill: ink })
  text.initDimensions?.()
  // Do not consume the product area when a long period needs extra lines.
  if (text.getBoundingRect().height + 12 * scale > availableHeight) {
    text.set(original)
    text.initDimensions?.()
    text.setCoords?.()
    return null
  }
  const current = text.getBoundingRect()
  text.set({ left: text.left + left - current.left, top: text.top + top - current.top })
  text.setCoords?.()
  if (band) {
    band.set({ visible: false })
    band.setCoords?.()
  }
  if (icon) {
    const recolor = (object: any) => {
      if (object.getObjects) object.getObjects().forEach(recolor)
      else object.set({ ...(object.stroke && object.stroke !== 'none' ? { stroke: accent } : {}), ...(object.fill && !['none', 'transparent'].includes(object.fill) ? { fill: accent } : { fill: null }) })
      object.dirty = true
    }
    recolor(icon)
    const ib = icon.getBoundingRect()
    icon.set({ scaleX: icon.scaleX * iconSize / ib.width, scaleY: icon.scaleY * iconSize / ib.height })
    const resized = icon.getBoundingRect()
    icon.set({ left: icon.left + area.left + 10 * scale - resized.left,
      top: icon.top + top + (text.getBoundingRect().height - iconSize) / 2 - resized.top })
    icon.setCoords?.()
  }
  return before !== JSON.stringify([text.text, text.left, text.top, text.width, text.styles, text.textAlign])
}
