import type { EnhancementRect } from './pageEnhancementRender'

/** Layout determinístico: conteúdo comercial nunca passa por transcrição da IA. */
export { REDESIGN_VERSION } from '../shared/pageEnhancementVersion'
export function redesignCardSlots(count: number, area: EnhancementRect): EnhancementRect[] {
  if (!Number.isInteger(count) || count < 1 || area.width <= 0 || area.height <= 0) throw new Error('Área de produtos inválida.')
  const columns = Math.min(count, Math.max(1, Math.min(5, Math.round(Math.sqrt(count * area.width / area.height)))))
  const rows = Math.ceil(count / columns)
  const firstRow = count - (rows - 1) * columns
  const gap = Math.min(area.width / columns, area.height / rows) * 0.035
  return Array.from({ length: count }, (_, index) => {
    const row = index < firstRow ? 0 : 1 + Math.floor((index - firstRow) / columns)
    const col = index < firstRow ? index : (index - firstRow) % columns
    const rowColumns = row === 0 ? firstRow : columns
    const width = (area.width - gap * (rowColumns - 1)) / rowColumns
    const height = (area.height - gap * (rows - 1)) / rows
    return { left: area.left + col * (width + gap), top: area.top + row * (height + gap), width, height }
  })
}

export function originalRedesignCardSlots(bounds: EnhancementRect[], crop: EnhancementRect, multiplier: number): EnhancementRect[] {
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('Escala de produtos inválida.')
  return bounds.map(b => ({
    left: (b.left - crop.left) * multiplier,
    top: (b.top - crop.top) * multiplier,
    width: b.width * multiplier,
    height: b.height * multiplier
  }))
}

export function fitTextLines(text: string, width: number, height: number, maxSize: number, measure: (text: string, size: number) => number) {
  // Não elimina palavras, não abrevia nomes e não converte números.
  const words = text.trim().split(/\s+/)
  for (let size = maxSize; size >= 4; size -= 0.5) {
    const lines: string[] = []; let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next, size) > width) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    if (lines.every(value => measure(value, size) <= width) && lines.length * size * 1.12 <= height) return { lines, size }
  }
  throw new Error('Texto longo demais para redesenhar sem perder legibilidade. Amplie o espaço ou reduza a quantidade de produtos.')
}

type ObjectNode = any
const visible = (o: ObjectNode) => o.visible !== false && o.excludeFromExport !== true
const children = (o: ObjectNode): ObjectNode[] => (o.getObjects?.() || []).filter(visible)
const isText = (o: ObjectNode) => ['text','itext','i-text','textbox'].includes(String(o.type).toLowerCase())
function leaves(o: ObjectNode): ObjectNode[] { const nested = children(o); return nested.length ? nested.flatMap(leaves) : [o] }
export function collectRedesignCards(objects: ObjectNode[]): ObjectNode[] {
  return objects.flatMap(o => {
    if (o.visible === false || (o.excludeFromExport && !o.isProductZone && !o.isGridZone)) return []
    if (o.isProductCard || o._productData || children(o).some(child => child.name === 'smart_title')) return [o]
    return collectRedesignCards(children(o))
  })
}
export function readRedesignCard(card: ObjectNode) {
  const nodes = leaves(card)
  const title = nodes.find(o => o.name === 'smart_title' && isText(o))
  const price = children(card).find(o => leaves(o).some(n => n.name === 'price_value_text'))
  const photos = nodes.filter(o => String(o.type).toLowerCase() === 'image' && /^(smart_image|extra_image_\d+)$/.test(o.name || ''))
  if (!title?.text || !price || !photos.length) throw new Error('Esta página precisa de produtos separados em foto, nome e preço para redesenhar com segurança. Nenhuma geração foi enviada.')
  const priceLeaves = new Set(leaves(price))
  const notes = nodes.filter(o => isText(o) && o !== title && !priceLeaves.has(o) && String(o.text || '').trim())
  const badges = nodes.filter(o => String(o.type).toLowerCase() === 'image' && !photos.includes(o) && !priceLeaves.has(o))
  return { title: String(title.text), price, photos, notes: notes.map(o => String(o.text)), badges }
}

type RgbColor = { r: number; g: number; b: number; a: number }
type PaletteCandidate = { color: RgbColor; weight: number }
export interface RedesignPalette {
  cardBase: string
  cardLight: string
  cardDark: string
  cardStroke: string
  accent: string
  accentDark: string
  titleText: string
  priceBackground: string
  priceStroke: string
  priceDepth: string
  priceCurrencyBackground: string
  priceText: string
  priceCurrencyText: string
  priceUnitText: string
}

const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value))
const namedColors: Record<string, RgbColor> = {
  black: { r: 0, g: 0, b: 0, a: 1 }, white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 }, yellow: { r: 255, g: 255, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 }, transparent: { r: 0, g: 0, b: 0, a: 0 }
}
function parseColor(value: unknown): RgbColor | null {
  if (typeof value !== 'string') return null
  const source = value.trim().toLowerCase()
  if (namedColors[source]) return namedColors[source]
  if (source.startsWith('#')) {
    const hex = source.slice(1)
    const full = hex.length === 3 || hex.length === 4 ? hex.split('').map(part => part + part).join('') : hex
    if (![6, 8].includes(full.length) || !/^[0-9a-f]+$/.test(full)) return null
    return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16), a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1 }
  }
  const match = /^rgba?\((.+)\)$/.exec(source)
  if (!match) return null
  const parts = match[1]!.split(/[,/\s]+/).filter(Boolean)
  if (parts.length < 3) return null
  const channel = (part: string) => part.endsWith('%') ? clamp(Number.parseFloat(part) * 2.55) : clamp(Number.parseFloat(part))
  const alpha = parts[3] ? (parts[3].endsWith('%') ? clamp(Number.parseFloat(parts[3]) / 100, 0, 1) : clamp(Number.parseFloat(parts[3]), 0, 1)) : 1
  const r = channel(parts[0]!), g = channel(parts[1]!), b = channel(parts[2]!)
  return [r, g, b, alpha].every(Number.isFinite) ? { r, g, b, a: alpha } : null
}
function paintColors(value: unknown): RgbColor[] {
  if (typeof value === 'string') return parseColor(value) ? [parseColor(value)!] : []
  if (!value || typeof value !== 'object') return []
  const paint = value as { colorStops?: unknown; stops?: unknown; color?: unknown }
  const stops = Array.isArray(paint.colorStops) ? paint.colorStops : Array.isArray(paint.stops) ? paint.stops : []
  if (stops.length) return stops.flatMap(stop => paintColors((stop as { color?: unknown })?.color ?? stop))
  return paintColors(paint.color)
}
function hex(color: RgbColor): string {
  return '#' + [color.r, color.g, color.b].map(value => Math.round(clamp(value)).toString(16).padStart(2, '0')).join('')
}
function rgb(value: string): RgbColor {
  return parseColor(value) || { r: 0, g: 0, b: 0, a: 1 }
}
function mix(first: string, second: string, amount: number): string {
  const a = rgb(first), b = rgb(second), t = Math.max(0, Math.min(1, amount))
  return hex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 })
}
const tint = (color: string, amount: number) => mix(color, '#ffffff', amount)
const shade = (color: string, amount: number) => mix(color, '#000000', amount)
const luminance = (color: string) => { const c = rgb(color); return (c.r * .2126 + c.g * .7152 + c.b * .0722) / 255 }
const saturation = (color: RgbColor) => { const max = Math.max(color.r, color.g, color.b), min = Math.min(color.r, color.g, color.b); return max ? (max - min) / max : 0 }
const rgba = (color: string, alpha: number) => { const c = rgb(color); return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})` }
const descendants = (object: ObjectNode): ObjectNode[] => [object, ...children(object).flatMap(descendants)]
const objectArea = (object: ObjectNode) => {
  try { const bounds = object.getBoundingRect?.(); return bounds?.width > 0 && bounds?.height > 0 ? bounds.width * bounds.height : 1 } catch { return 1 }
}
function namedPaint(object: ObjectNode, names: string[], property: 'fill' | 'stroke'): string | undefined {
  for (const node of descendants(object)) {
    if (!names.includes(String(node.name || ''))) continue
    const value = paintColors(node[property])[0]
    if (value && value.a > 0) return hex(value)
  }
  return undefined
}
function directPaint(object: ObjectNode, property: 'fill' | 'stroke'): string | undefined {
  const value = paintColors(object[property])[0]
  return value && value.a > 0 ? hex(value) : undefined
}
function weightedPaint(objects: ObjectNode[], names: string[], property: 'fill' | 'stroke', fallback: string, chromatic = false): string {
  const candidates: PaletteCandidate[] = []
  objects.flatMap(descendants).forEach(node => {
    if (!names.includes(String(node.name || ''))) return
    const weight = objectArea(node)
    paintColors(node[property]).forEach(color => { if (color.a > 0) candidates.push({ color, weight }) })
  })
  const selected = candidates.filter(candidate => !chromatic || saturation(candidate.color) >= .16)
    .sort((a, b) => (b.weight * (chromatic ? saturation(b.color) : 1)) - (a.weight * (chromatic ? saturation(a.color) : 1)))[0]
  return selected ? hex(selected.color) : fallback
}
export function extractRedesignPalette(cards: ObjectNode[]): RedesignPalette {
  const cardBase = weightedPaint(cards, ['offerBackground'], 'fill', '#f5f5f5', true)
  const cardStroke = weightedPaint(cards, ['offerBackground'], 'stroke', '#d1d5db', true)
  const accent = weightedPaint(cards, ['offerBackground'], 'stroke', cardStroke, true)
  const priceBackground = weightedPaint(cards, ['price_bg'], 'fill', '#111111')
  const priceStroke = weightedPaint(cards, ['price-rim', 'price_bg'], 'stroke', cardStroke)
  const priceDepth = weightedPaint(cards, ['price-depth'], 'fill', shade(priceBackground, .35))
  const priceCurrencyBackground = weightedPaint(cards, ['price_currency_bg', 'price-rim', 'price_currency_bg'], 'fill', accent)
  const titleText = weightedPaint(cards, ['smart_title'], 'fill', '#ffffff')
  const priceText = weightedPaint(cards, ['price_value_text'], 'fill', '#ffffff')
  const priceCurrencyText = weightedPaint(cards, ['price_currency_text'], 'fill', '#111111')
  const priceUnitText = weightedPaint(cards, ['price_unit_text'], 'fill', priceText)
  return {
    cardBase, cardLight: tint(cardBase, .14), cardDark: shade(cardBase, .42), cardStroke, accent,
    accentDark: shade(accent, .28), titleText, priceBackground, priceStroke, priceDepth,
    priceCurrencyBackground, priceText, priceCurrencyText, priceUnitText
  }
}

function round(ctx: CanvasRenderingContext2D, box: EnhancementRect, fill: string | CanvasGradient, radius: number, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(box.left, box.top, box.width, box.height, radius)
  ctx.fillStyle = fill; ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, box.width * .006); ctx.stroke() }
}
function text(ctx: CanvasRenderingContext2D, value: string, box: EnhancementRect, maxSize: number, color: string) {
  const font = (size: number) => `800 ${size}px "Barlow Condensed", Arial, sans-serif`
  const layout = fitTextLines(value, box.width, box.height, maxSize, (s, size) => { ctx.font = font(size); return ctx.measureText(s).width })
  ctx.font = font(layout.size); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  layout.lines.forEach((line, i) => ctx.fillText(line, box.left + box.width / 2, box.top + box.height / 2 + (i - (layout.lines.length - 1) / 2) * layout.size * 1.12))
}
function sprite(object: ObjectNode): HTMLCanvasElement {
  // Fabric restaura transformações após toCanvasElement. Usa o asset original,
  // incluindo crop, transparência e filtros; nunca uma embalagem regenerada.
  return object.toCanvasElement({ multiplier: 1, enableRetinaScaling: false })
}
function contain(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, box: EnhancementRect) {
  const scale = Math.min(box.width / image.width, box.height / image.height)
  ctx.drawImage(image, box.left + (box.width - image.width * scale) / 2, box.top + (box.height - image.height * scale) / 2, image.width * scale, image.height * scale)
}

/** Produz uma guia nova e uma camada comercial, sem copiar os cards antigos. */
export function drawRedesignCards(cards: ObjectNode[], overlay: CanvasRenderingContext2D, guide: CanvasRenderingContext2D, crop: EnhancementRect, multiplier: number, palette: RedesignPalette = extractRedesignPalette(cards)) {
  const bounds = cards.map(card => (children(card).find(o => o.name === 'offerBackground') || card).getBoundingRect() as EnhancementRect)
  const left = Math.max(crop.left, Math.min(...bounds.map(b => b.left)))
  const top = Math.max(crop.top, Math.min(...bounds.map(b => b.top)))
  const right = Math.min(crop.left + crop.width, Math.max(...bounds.map(b => b.left + b.width)))
  const bottom = Math.min(crop.top + crop.height, Math.max(...bounds.map(b => b.top + b.height)))
  const area = { left: (left - crop.left) * multiplier, top: (top - crop.top) * multiplier, width: (right - left) * multiplier, height: (bottom - top) * multiplier }
  // Cada produto permanece na própria célula do encarte original. O layout
  // gerado nunca cria uma célula nova, elimina um item ou troca a ordem.
  const slots = originalRedesignCardSlots(bounds, crop, multiplier)
  const ordered = cards.map((card, index) => ({ card, bounds: bounds[index]! })).sort((a,b) => Math.abs(a.bounds.top - b.bounds.top) > 8 ? a.bounds.top - b.bounds.top : a.bounds.left - b.bounds.left)
  // Guia e camada final compartilham caixas exatas. A IA cria atmosfera nos
  // corredores entre elas, sem poder deslocar molduras sob texto/foto/preço.
  guide.fillStyle = palette.cardDark; guide.fillRect(area.left, area.top, area.width, area.height)
  ordered.forEach(({ card }, i) => {
    const data = readRedesignCard(card), box = slots[cards.indexOf(card)]!
    const hero = i === 0 && box.width > box.height * 1.5
    const pad = Math.min(box.width, box.height) * (hero ? .055 : .045)
    const place = (object: ObjectNode): EnhancementRect => {
      const bounds = object.getBoundingRect() as EnhancementRect
      return { left: (bounds.left - crop.left) * multiplier, top: (bounds.top - crop.top) * multiplier, width: bounds.width * multiplier, height: bounds.height * multiplier }
    }
    const titleNode = leaves(card).find(o => o.name === 'smart_title' && isText(o))!
    const titleBox = place(titleNode)
    const photos = data.photos.map(o => ({ image: sprite(o), box: place(o) }))
    const photoBox = {
      left: Math.min(...photos.map(p => p.box.left)),
      top: Math.min(...photos.map(p => p.box.top)),
      width: Math.max(...photos.map(p => p.box.left + p.box.width)) - Math.min(...photos.map(p => p.box.left)),
      height: Math.max(...photos.map(p => p.box.top + p.box.height)) - Math.min(...photos.map(p => p.box.top))
    }
    const cardSurface = namedPaint(card, ['offerBackground'], 'fill') || palette.cardBase
    const cardOutline = namedPaint(card, ['offerBackground'], 'stroke') || palette.cardStroke
    const titleColor = namedPaint(card, ['smart_title'], 'fill') || palette.titleText
    const lightSurface = tint(cardSurface, .14)
    const darkSurface = shade(cardSurface, .42)
    const cardGradient = (ctx: CanvasRenderingContext2D) => {
      const gradient = ctx.createLinearGradient(box.left, box.top, box.left + box.width, box.top + box.height)
      gradient.addColorStop(0, lightSurface); gradient.addColorStop(.48, cardSurface); gradient.addColorStop(1, darkSurface)
      round(ctx, box, gradient, Math.max(9, pad), cardOutline)
      ctx.save()
      ctx.beginPath(); ctx.roundRect(box.left, box.top, box.width, box.height, Math.max(9, pad)); ctx.clip()
      const glow = ctx.createRadialGradient(photoBox.left + photoBox.width * .5, photoBox.top + photoBox.height * .58, 0, photoBox.left + photoBox.width * .5, photoBox.top + photoBox.height * .58, Math.max(photoBox.width, photoBox.height) * .75)
      glow.addColorStop(0, rgba(cardOutline, .38)); glow.addColorStop(.42, rgba(cardSurface, .18)); glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow; ctx.fillRect(box.left, box.top, box.width, box.height)
      ctx.restore()
      ctx.strokeStyle = cardOutline; ctx.lineWidth = Math.max(2, pad * .12)
      ctx.beginPath(); ctx.moveTo(box.left + pad, box.top + 2); ctx.lineTo(box.left + box.width - pad, box.top + 2); ctx.stroke()
    }
    cardGradient(guide)
    // A base visual gerada permanece visível. Apenas a borda geométrica é
    // reforçada aqui; cobrir o card inteiro apagaria o trabalho da IA.
    round(overlay, box, 'rgba(0,0,0,0)', Math.max(9, pad), cardOutline)
    // O modelo pode escolher um fundo claro. A faixa fixa garante contraste
    // do nome comercial sem restringir o restante do redesign gerado.
    const titlePlate = {
      left: titleBox.left - pad * .35,
      top: titleBox.top - pad * .18,
      width: titleBox.width + pad * .7,
      height: titleBox.height + pad * .28
    }
    const titleGradient = overlay.createLinearGradient(titlePlate.left, titlePlate.top, titlePlate.left, titlePlate.top + titlePlate.height)
    if (luminance(titleColor) > .55) {
      titleGradient.addColorStop(0, rgba(shade(cardSurface, .26), .96))
      titleGradient.addColorStop(1, rgba(shade(cardSurface, .52), .98))
    } else {
      titleGradient.addColorStop(0, rgba(tint(cardSurface, .04), .98))
      titleGradient.addColorStop(1, rgba(lightSurface, .98))
    }
    round(overlay, titlePlate, titleGradient, Math.max(6, pad * .35), cardOutline)
    text(overlay, data.title, titleBox, Math.min(hero ? box.width * .07 : box.width * .075, box.height * .14), titleColor)
    const priceLeaves = new Set(leaves(data.price))
    const noteNodes = leaves(card).filter(o => isText(o) && o !== titleNode && !priceLeaves.has(o) && String(o.text || '').trim())
    noteNodes.forEach(noteNode => {
      const noteBox = place(noteNode)
      const noteColor = directPaint(noteNode, 'fill') || titleColor
      const noteSurface = luminance(noteColor) > .55 ? darkSurface : lightSurface
      round(overlay, noteBox, noteSurface, pad * .3, cardOutline)
      text(overlay, String(noteNode.text), { ...noteBox, left: noteBox.left + pad / 2, width: noteBox.width - pad }, noteBox.height * .72, noteColor)
    })
    // Cada sprite permanece em suas coordenadas e dimensões originais.
    photos.forEach(p => {
      overlay.save(); overlay.shadowColor = 'rgba(0,0,0,.6)'; overlay.shadowBlur = Math.max(4, pad * .8); overlay.shadowOffsetY = pad * .35
      overlay.drawImage(p.image, p.box.left, p.box.top, p.box.width, p.box.height)
      overlay.restore()
    })
    data.badges.forEach(badge => { const target = place(badge); overlay.drawImage(sprite(badge), target.left, target.top, target.width, target.height) })
    const priceBox = place(data.price)
    const priceTexts = leaves(data.price).filter(isText)
    const main = priceTexts.find(o => o.name === 'price_value_text')
    // Renderização das etiquetas de preço (Splash de Varejo de Alto Impacto)
    if (priceTexts.every(o => ['price_value_text','price_currency_text','price_unit_text'].includes(o.name)) && main) {
      // 1. Sombra projetada e profundidade 3D do splash
      overlay.save()
      overlay.shadowColor = 'rgba(0, 0, 0, 0.45)'
      overlay.shadowBlur = Math.max(6, pad * 0.9)
      overlay.shadowOffsetY = pad * 0.45

      // Base com extrusão/profundidade
      const depthOffset = Math.max(3, pad * 0.3)
      round(overlay, { ...priceBox, top: priceBox.top + depthOffset }, palette.priceDepth, Math.max(8, pad * 0.7))

      // 2. Fundo do preço com gradiente luminoso
      const priceGrad = overlay.createLinearGradient(priceBox.left, priceBox.top, priceBox.left, priceBox.top + priceBox.height)
      const isDarkPriceBg = luminance(palette.priceBackground) < 0.35
      if (isDarkPriceBg) {
        priceGrad.addColorStop(0, tint(palette.priceBackground, 0.18))
        priceGrad.addColorStop(0.5, palette.priceBackground)
        priceGrad.addColorStop(1, shade(palette.priceBackground, 0.35))
      } else {
        priceGrad.addColorStop(0, tint(palette.priceBackground, 0.25))
        priceGrad.addColorStop(1, shade(palette.priceBackground, 0.12))
      }
      round(overlay, priceBox, priceGrad, Math.max(8, pad * 0.7), palette.priceStroke)
      overlay.restore()

      // Borda interna de realce brilhante (highlight)
      overlay.save()
      overlay.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      overlay.lineWidth = Math.max(1.5, pad * 0.08)
      overlay.beginPath()
      overlay.roundRect(priceBox.left + 1.5, priceBox.top + 1.5, priceBox.width - 3, priceBox.height - 3, Math.max(6, pad * 0.6))
      overlay.stroke()
      overlay.restore()

      const currency = priceTexts.find(o => o.name === 'price_currency_text')
      const unit = priceTexts.find(o => o.name === 'price_unit_text')
      if (currency) {
        const badge = { left: priceBox.left + priceBox.width * .04, top: priceBox.top + priceBox.height * .24, width: priceBox.width * .20, height: priceBox.height * .50 }
        const badgeGrad = overlay.createLinearGradient(badge.left, badge.top, badge.left, badge.top + badge.height)
        badgeGrad.addColorStop(0, tint(palette.priceCurrencyBackground, 0.25))
        badgeGrad.addColorStop(1, shade(palette.priceCurrencyBackground, 0.2))
        round(overlay, badge, badgeGrad, Math.min(badge.width, badge.height) / 2, 'rgba(255, 255, 255, 0.5)')
        text(overlay, String(currency.text), badge, badge.height * .58, palette.priceCurrencyText)
      }
      const valueBox = { left: priceBox.left + priceBox.width * .25, top: priceBox.top, width: priceBox.width * .71, height: priceBox.height * .80 }
      const parts = /^(\d+(?:\.\d{3})*),(\d{2})$/.exec(String(main.text))
      if (parts) {
        let size = valueBox.height * 1.35
        const measure = (value: string, fontSize: number) => { overlay.font = `900 ${fontSize}px "Barlow Condensed", Arial, sans-serif`; return overlay.measureText(value).width }
        while (measure(parts[1]!, size) + measure(',' + parts[2]!, size * .52) > valueBox.width && size > 4) size -= .5
        const largeWidth = measure(parts[1]!, size), smallWidth = measure(',' + parts[2]!, size * .52)
        const x = valueBox.left + (valueBox.width - largeWidth - smallWidth) / 2
        
        // Sombra suave no texto do valor para garantir contraste de varejo
        overlay.save()
        overlay.shadowColor = 'rgba(0,0,0,0.5)'
        overlay.shadowBlur = 3
        overlay.shadowOffsetY = 1.5
        overlay.fillStyle = palette.priceText; overlay.textAlign = 'left'; overlay.textBaseline = 'middle'
        overlay.font = `900 ${size}px "Barlow Condensed", Arial, sans-serif`
        overlay.fillText(parts[1]!, x, valueBox.top + valueBox.height * .58)
        overlay.font = `900 ${size * .52}px "Barlow Condensed", Arial, sans-serif`
        overlay.fillText(',' + parts[2]!, x + largeWidth, valueBox.top + valueBox.height * .40)
        overlay.restore()
      } else {
        overlay.save()
        overlay.shadowColor = 'rgba(0,0,0,0.5)'
        overlay.shadowBlur = 3
        overlay.shadowOffsetY = 1.5
        text(overlay, String(main.text), valueBox, priceBox.height * .78, palette.priceText)
        overlay.restore()
      }
      if (unit) {
        text(overlay, String(unit.text), { left: priceBox.left + priceBox.width * .50, top: priceBox.top + priceBox.height * .75, width: priceBox.width * .44, height: priceBox.height * .20 }, priceBox.height * .20, palette.priceUnitText)
      }
    } else {
      // Para etiquetas complexas/compostas, aplica sombra projetada e borda de destaque
      overlay.save()
      overlay.shadowColor = 'rgba(0, 0, 0, 0.45)'
      overlay.shadowBlur = Math.max(6, pad * 0.8)
      overlay.shadowOffsetY = pad * 0.35
      contain(overlay, sprite(data.price), priceBox)
      overlay.restore()
    }
  })
  return { slots, area, productCount: cards.length }
}
