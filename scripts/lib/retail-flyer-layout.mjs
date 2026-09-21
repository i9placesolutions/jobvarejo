import { randomUUID } from 'node:crypto'
import { objectBounds } from '../standardize-flyer-template-dynamics.mjs'

export const RETAIL_LAYOUT_VERSION = 14
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback
const box = (o, b) => Object.assign(o, { originX: 'left', originY: 'top', left: b.left, top: b.top, width: b.width, height: b.height, scaleX: 1, scaleY: 1, angle: 0, strokeWidth: 0 })
const fit = (o, b) => {
  const scale = Math.min(b.width / Math.max(1, o.width), b.height / Math.max(1, o.height))
  Object.assign(o, { originX: 'center', originY: 'center', left: b.left + b.width / 2, top: b.top + b.height / 2, scaleX: scale, scaleY: scale, angle: 0, visible: true, objectCaching: false })
}

/** A composição é recalculada em coordenadas absolutas, nunca por deltas cumulativos. */
export function composeRetailFlyer(source, page, palette) {
  const canvas = structuredClone(source)
  const objects = canvas.objects || []
  const frame = objects.find(o => o.isFrame)
  const zone = objects.find(o => o.isProductZone)
  if (!frame || !zone) throw new Error('Modelo sem frame/zona nativa')
  const populated = objects.some(o => o.isProductCard || o.isSmartObject && o.parentZoneId)
  const zones = objects.filter(o => o.isProductZone)
  const f = objectBounds(frame), s = f.width / 1080, tv = f.width / f.height > 1.5
  const footerH = tv ? 62 * s : 142 * s
  const margin = 22 * s
  const footerTop = f.bottom - footerH
  const zoneBounds = zones.map(objectBounds)
  const previousZone = { left: Math.min(...zoneBounds.map(b => b.left)), top: Math.min(...zoneBounds.map(b => b.top)), right: Math.max(...zoneBounds.map(b => b.right)), bottom: Math.max(...zoneBounds.map(b => b.bottom)) }
  previousZone.width = previousZone.right - previousZone.left
  previousZone.height = previousZone.bottom - previousZone.top
  const main = palette.main, ink = palette.ink, surface = palette.surface
  const metadata = Object.fromEntries(Object.entries(page).filter(([k]) => /^template(Model|Format|Theme)/.test(k)))
  const upsert = (name, type, props) => {
    let o = objects.find(item => item.name === name)
    if (!o) { o = { type, version: '7.1.0', _customId: randomUUID(), name }; objects.push(o) }
    Object.assign(o, { parentFrameId: frame._customId, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1,
      visible: true, opacity: 1, angle: 0, strokeWidth: 0, objectCaching: false, ...metadata, ...props })
    delete o.clipPath
    return o
  }
  const rect = (name, b, fill, extra = {}) => upsert(name, 'Rect', { ...b, fill, ...extra })
  const text = (name, value, b, size, fill, extra = {}) => upsert(name, 'Textbox', {
    ...b, text: value, __rawText: value, fontFamily: 'Barlow', fontWeight: 700, fontSize: size,
    lineHeight: 1.04, textAlign: 'left', splitByGrapheme: false, styles: {}, fill,
    dynamicFieldResizeMode: 'reflow', dynamicFieldBaseFontSize: size, dynamicFieldAutoFitFontSize: size,
    dynamicFieldHeight: b.height, dynamicFieldAutoHeight: false, ...extra
  })
  const existingField = field => objects.find(o => o.businessProfileField === field && o.visible !== false)
  const values = Object.fromEntries(['whatsapp', 'instagram', 'address'].map(key => [key, structuredClone(existingField(key))]))
  let logo = existingField('logo') || objects.find(o => o.quickLogoSlot)
  const seals = objects.filter(o => /selo|seal/i.test(o.name || '') && String(o.type).toLowerCase() === 'image' && o.visible !== false)
  const validity = structuredClone(objects.find(o => o.quickDataField === 'validity'))
  // Substitui só os elementos comerciais. Os fundos e a identidade do tema ficam intactos.
  for (const o of objects) {
    if (o === logo || seals.includes(o) || o === zone || o === frame) continue
    if (/^(footer-|icon-(whatsapp|instagram|address)|header-whatsapp|header-icon-whatsapp|header-contact-|header-validity|reference-validity|validity-|stock-validity|standard-validity)/.test(o.name || '')
      || o.name === 'icon-validity' || o.name === 'payment-validity-decoration' || o.quickDataField === 'validity' || o.businessProfileField || o.quickLogoBackdrop) {
      o.visible = false
      delete o.businessProfileField; delete o.quickDataField; delete o.quickDynamicIconFor
    }
  }
  const headerBottom = tv ? previousZone.top : Math.max(f.top + 250 * s, Math.min(previousZone.top, f.top + f.height * .34))
  const bannerH = 96 * s
  const bannerTop = headerBottom - bannerH - 12 * s
  const sealArea = tv
    ? { left: f.left + margin, top: f.top + margin, width: Math.max(120 * s, previousZone.left - f.left - margin * 2), height: f.height * .46 }
    : { left: f.left + margin, top: f.top + 14 * s, width: f.width * .56 - margin, height: bannerTop - f.top - 28 * s }
  // Se o selo estiver no bitmap do fundo, não redimensionar a arte inteira.
  if (seals.length === 1) fit(seals[0], sealArea)
  const logoArea = tv
    ? { left: sealArea.left, top: f.top + f.height * .50, width: sealArea.width, height: Math.min(f.height * .29, footerTop - f.top - f.height * .52) }
    : { left: f.left + f.width * .60, top: f.top + 22 * s, width: f.width * .36, height: Math.max(80 * s, bannerTop - f.top - 94 * s) }
  if (!logo) logo = upsert('header-logo-slot', 'Rect', { fill: 'transparent', businessProfileField: 'logo', quickLogoSlot: true })
  logo.name = 'header-logo-slot'
  if (String(logo.type).toLowerCase() === 'image') fit(logo, logoArea)
  else { box(logo, logoArea); logo.visible = true }
  Object.assign(logo, { quickFieldEnabled: true, quickLogoSlot: true, quickLogoMaxWidth: logoArea.width, quickLogoMaxHeight: logoArea.height,
    quickLogoCenterX: logoArea.left + logoArea.width / 2, quickLogoCenterY: logoArea.top + logoArea.height / 2, objectCaching: false })
  delete logo.clipPath

  const setField = (name, field, b, fontSize, fill) => {
    const original = values[field]
    const value = String(original?.__rawText || original?.text || '').replace(/[\r\n]+/g, ' ').trim()
    const node = text(name, value, b, fontSize, fill, { businessProfileField: field, businessProfileEntryIndex: 0,
      quickFieldEnabled: true, dynamicFieldKey: field, dynamicFieldTextColor: fill, visible: !!value })
    // Campos de exemplo não viram override de usuário no modelo reutilizável.
    delete node.dynamicUserTextSource; delete node.dynamicUserText
    return node
  }
  const icon = (field, name, target, color) => {
    const sourceIcon = objects.find(o => o.name === `icon-${field}` || o.quickDynamicIconFor === field)
    if (!sourceIcon) return
    const copy = structuredClone(sourceIcon)
    copy._customId = randomUUID(); copy.name = name; copy.quickDynamicIconFor = field
    const paint = o => { if (o.objects) o.objects.forEach(paint); else { if (o.fill && o.fill !== 'transparent' && o.fill !== 'none') o.fill = color; if (o.stroke && o.stroke !== 'none') o.stroke = color } }
    paint(copy); fit(copy, target); copy.footerIconSize = target.width / s
    delete copy.clipPath
    const index = objects.findIndex(o => o.name === name)
    if (index >= 0) objects.splice(index, 1, copy); else objects.push(copy)
  }

  if (!tv) {
    const phoneY = bannerTop - 58 * s
    rect('header-contact-background', { left: logoArea.left - 8 * s, top: phoneY, width: logoArea.width + 16 * s, height: 44 * s }, ink, { rx: 22 * s, ry: 22 * s })
    setField('header-whatsapp', 'whatsapp', { left: logoArea.left + 40 * s, top: phoneY + 7 * s, width: logoArea.width - 48 * s, height: 32 * s }, 29 * s, '#ffffff')
    icon('whatsapp', 'header-icon-whatsapp', { left: logoArea.left + 3 * s, top: phoneY + 7 * s, width: 30 * s, height: 30 * s }, '#ffffff')
    const band = { left: f.left + margin, top: bannerTop, width: f.width - margin * 2, height: bannerH }
    rect('standard-validity-background', band, ink, { rx: 18 * s, ry: 18 * s, stroke: surface, strokeWidth: 2 * s })
    text('validity-heading', 'OFERTAS VÁLIDAS', { left: band.left + 20 * s, top: band.top + 8 * s, width: band.width - 40 * s, height: 22 * s }, 20 * s, '#ffffff')
    text('header-validity', String(validity?.text || 'DEFINA O PERÍODO DAS OFERTAS').replace(/\n/g, ' '),
      { left: band.left + 20 * s, top: band.top + 30 * s, width: band.width - 40 * s, height: 36 * s }, 34 * s, surface,
      { quickDataField: 'validity', quickValidityLayout: 'offer-banner', quickFieldEnabled: true,
        quickValidityStartDate: validity?.quickValidityStartDate || '', quickValidityEndDate: validity?.quickValidityEndDate || '',
        quickValidityMode: validity?.quickValidityMode || 'period', quickValidityWhileStocks: validity?.quickValidityWhileStocks !== false })
    text('stock-validity', 'OU ENQUANTO DURAREM OS ESTOQUES', { left: band.left + 20 * s, top: band.top + 71 * s, width: band.width - 40 * s, height: 18 * s }, 16 * s, '#ffffff')
    rect('footer-premium-background', { left: f.left, top: footerTop, width: f.width, height: footerH }, main, { footerLayout: 'contacts-address' })
    rect('footer-top-accent', { left: f.left, top: footerTop, width: f.width, height: 6 * s }, surface)
    rect('footer-bottom-shade', { left: f.left, top: f.bottom - 5 * s, width: f.width, height: 5 * s }, ink)
    rect('footer-column-divider-1', { left: f.left + f.width * .45, top: footerTop + 20 * s, width: 2 * s, height: footerH - 40 * s }, surface, { opacity: .6 })
    const left = f.left + 30 * s
    setField('footer-dynamic-whatsapp', 'whatsapp', { left: left + 52 * s, top: footerTop + 25 * s, width: f.width * .41 - 52 * s, height: 40 * s }, 35 * s, '#ffffff')
    setField('footer-dynamic-instagram', 'instagram', { left: left + 52 * s, top: footerTop + 81 * s, width: f.width * .41 - 52 * s, height: 30 * s }, 26 * s, '#ffffff')
    setField('footer-dynamic-address', 'address', { left: f.left + f.width * .49 + 60 * s, top: footerTop + 22 * s, width: f.width * .48 - 75 * s, height: 100 * s }, 29 * s, '#ffffff')
    icon('whatsapp', 'icon-whatsapp', { left, top: footerTop + 25 * s, width: 40 * s, height: 40 * s }, surface)
    icon('instagram', 'icon-instagram', { left, top: footerTop + 81 * s, width: 36 * s, height: 36 * s }, surface)
    icon('address', 'icon-address', { left: f.left + f.width * .49, top: footerTop + 45 * s, width: 50 * s, height: 50 * s }, surface)
  } else {
    const band = { left: f.left + margin, top: footerTop + 6 * s, width: f.width - margin * 2, height: footerH - 12 * s }
    rect('standard-validity-background', band, ink, { rx: 8 * s, ry: 8 * s })
    text('header-validity', String(validity?.text || 'OFERTAS VÁLIDAS ENQUANTO DURAREM OS ESTOQUES').replace(/\s+/g, ' '),
      { left: band.left + 18 * s, top: band.top + 9 * s, width: band.width - 36 * s, height: band.height - 18 * s }, 23 * s, '#ffffff',
      { quickDataField: 'validity', quickValidityLayout: 'inline-footer', quickFieldEnabled: true,
        quickValidityStartDate: validity?.quickValidityStartDate || '', quickValidityEndDate: validity?.quickValidityEndDate || '',
        quickValidityMode: validity?.quickValidityMode || 'period', quickValidityWhileStocks: validity?.quickValidityWhileStocks !== false })
  }
  // Preserva receitas e IDs. Altera somente a área livre; nenhum produto real é remanejado.
  const zoneBox = populated ? previousZone : { left: previousZone.left, top: tv ? previousZone.top : headerBottom,
    width: previousZone.width, height: footerTop - (tv ? previousZone.top : headerBottom) - 8 * s }
  if (zoneBox.height <= 100 * s) throw new Error('Área de produtos insuficiente')
  if (!populated) for (const item of zones) {
    const old = objectBounds(item)
    const next = { left: old.left, top: zoneBox.top + (old.top - previousZone.top) * zoneBox.height / previousZone.height,
      width: old.width, height: old.height * zoneBox.height / previousZone.height }
    box(item, next)
    Object.assign(item, { _zoneWidth: next.width, _zoneHeight: next.height })
    for (const child of item.objects || []) if (/rect/i.test(child.type || '')) box(child, { left: -next.width / 2, top: -next.height / 2, width: next.width, height: next.height })
    if (item._zoneStateSnapshot?.zone) item._zoneStateSnapshot.zone.geometry = { ...item._zoneStateSnapshot.zone.geometry, ...next, scaleX: 1, scaleY: 1 }
  }
  const panel = objects.find(o => o.name === 'product-area-background')
  if (panel) box(panel, { left: zoneBox.left - 3 * s, top: zoneBox.top - 3 * s, width: zoneBox.width + 6 * s, height: zoneBox.height + 6 * s })
  // Recoloca os campos sobre o fundo, sem alterar a pilha de decoração do tema.
  const foreground = objects.filter(o => o.visible !== false && (o === logo || /^(header-contact|header-whatsapp|header-icon|standard-validity|validity-heading|header-validity|stock-validity|footer-|icon-)/.test(o.name || '')))
  canvas.objects = [...objects.filter(o => !foreground.includes(o)), ...foreground]
  return { canvas, warnings: seals.length === 0 ? ['Selo integrado ao fundo: arte preservada'] : [], format: page.templateFormatId }
}
