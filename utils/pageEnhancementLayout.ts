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
export function drawRedesignCards(cards: ObjectNode[], overlay: CanvasRenderingContext2D, guide: CanvasRenderingContext2D, crop: EnhancementRect, multiplier: number) {
  const bounds = cards.map(card => (children(card).find(o => o.name === 'offerBackground') || card).getBoundingRect() as EnhancementRect)
  const left = Math.max(crop.left, Math.min(...bounds.map(b => b.left)))
  const top = Math.max(crop.top, Math.min(...bounds.map(b => b.top)))
  const right = Math.min(crop.left + crop.width, Math.max(...bounds.map(b => b.left + b.width)))
  const bottom = Math.min(crop.top + crop.height, Math.max(...bounds.map(b => b.top + b.height)))
  const area = { left: (left - crop.left) * multiplier, top: (top - crop.top) * multiplier, width: (right - left) * multiplier, height: (bottom - top) * multiplier }
  // Cada produto permanece na própria célula do encarte original. O layout
  // gerado nunca cria uma célula nova, elimina um item ou troca a ordem.
  const slots = originalRedesignCardSlots(bounds, crop, multiplier)
  const nodes = cards.flatMap(leaves)
  const color = (name: string, fallback: string) => {
    const value = nodes.find(o => o.name === name && typeof o.fill === 'string' && /^#[0-9a-f]{6}$/i.test(o.fill))?.fill
    return typeof value === 'string' ? value : fallback
  }
  const primary = color('price_bg', '#d5091d'), accent = color('price-rim', '#ffcc32')
  const dark = '#' + primary.slice(1).match(/../g)!.map(part => Math.max(8, Math.round(parseInt(part, 16) * .3)).toString(16).padStart(2, '0')).join('')
  const ordered = cards.map((card, index) => ({ card, bounds: bounds[index]! })).sort((a,b) => Math.abs(a.bounds.top - b.bounds.top) > 8 ? a.bounds.top - b.bounds.top : a.bounds.left - b.bounds.left)
  // Guia e camada final compartilham caixas exatas. A IA cria atmosfera nos
  // corredores entre elas, sem poder deslocar molduras sob texto/foto/preço.
  guide.fillStyle = dark; guide.fillRect(area.left, area.top, area.width, area.height)
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
    const cardGradient = (ctx: CanvasRenderingContext2D) => {
      const gradient = ctx.createLinearGradient(box.left, box.top, box.left + box.width, box.top + box.height)
      gradient.addColorStop(0, '#38150d'); gradient.addColorStop(.48, '#170d0b'); gradient.addColorStop(1, '#4f160b')
      round(ctx, box, gradient, Math.max(9, pad), accent)
      ctx.save()
      ctx.beginPath(); ctx.roundRect(box.left, box.top, box.width, box.height, Math.max(9, pad)); ctx.clip()
      const glow = ctx.createRadialGradient(photoBox.left + photoBox.width * .5, photoBox.top + photoBox.height * .58, 0, photoBox.left + photoBox.width * .5, photoBox.top + photoBox.height * .58, Math.max(photoBox.width, photoBox.height) * .75)
      glow.addColorStop(0, 'rgba(255,194,57,.38)'); glow.addColorStop(.42, 'rgba(213,61,16,.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow; ctx.fillRect(box.left, box.top, box.width, box.height)
      ctx.restore()
      ctx.strokeStyle = '#ffad32'; ctx.lineWidth = Math.max(2, pad * .12)
      ctx.beginPath(); ctx.moveTo(box.left + pad, box.top + 2); ctx.lineTo(box.left + box.width - pad, box.top + 2); ctx.stroke()
    }
    cardGradient(guide)
    // A base visual gerada permanece visível. Apenas a borda geométrica é
    // reforçada aqui; cobrir o card inteiro apagaria o trabalho da IA.
    round(overlay, box, 'rgba(0,0,0,0)', Math.max(9, pad), accent)
    // O modelo pode escolher um fundo claro. A faixa fixa garante contraste
    // do nome comercial sem restringir o restante do redesign gerado.
    const titlePlate = {
      left: titleBox.left - pad * .35,
      top: titleBox.top - pad * .18,
      width: titleBox.width + pad * .7,
      height: titleBox.height + pad * .28
    }
    const titleGradient = overlay.createLinearGradient(titlePlate.left, titlePlate.top, titlePlate.left, titlePlate.top + titlePlate.height)
    titleGradient.addColorStop(0, 'rgba(71,10,8,.95)')
    titleGradient.addColorStop(1, 'rgba(27,8,8,.96)')
    round(overlay, titlePlate, titleGradient, Math.max(6, pad * .35), accent)
    text(overlay, data.title, titleBox, Math.min(hero ? box.width * .07 : box.width * .075, box.height * .14), '#ffffff')
    const priceLeaves = new Set(leaves(data.price))
    const noteNodes = leaves(card).filter(o => isText(o) && o !== titleNode && !priceLeaves.has(o) && String(o.text || '').trim())
    noteNodes.forEach(noteNode => {
      const noteBox = place(noteNode)
      round(overlay, noteBox, primary, pad * .3)
      text(overlay, String(noteNode.text), { ...noteBox, left: noteBox.left + pad / 2, width: noteBox.width - pad }, noteBox.height * .72, '#fff')
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
    // Etiquetas com condições extras continuam inteiras; nunca descartar preço
    // de clube, atacado, unidade ou texto customizado.
    if (priceTexts.every(o => ['price_value_text','price_currency_text','price_unit_text'].includes(o.name)) && main) {
      round(overlay, { ...priceBox, top: priceBox.top + pad * .35 }, '#180905', pad)
      round(overlay, priceBox, primary, pad, accent)
      const currency = priceTexts.find(o => o.name === 'price_currency_text')
      const unit = priceTexts.find(o => o.name === 'price_unit_text')
      if (currency) {
        const badge = { left: priceBox.left + priceBox.width * .045, top: priceBox.top + priceBox.height * .31, width: priceBox.width * .18, height: priceBox.height * .4 }
        round(overlay, badge, '#ffda38', Math.min(badge.width, badge.height) / 2)
        text(overlay, String(currency.text), badge, badge.height * .58, '#160c05')
      }
      const valueBox = { left: priceBox.left + priceBox.width * .24, top: priceBox.top, width: priceBox.width * .7, height: priceBox.height * .78 }
      const parts = /^(\d+(?:\.\d{3})*),(\d{2})$/.exec(String(main.text))
      if (parts) {
        let size = valueBox.height * 1.32
        const measure = (value: string, fontSize: number) => { overlay.font = `800 ${fontSize}px "Barlow Condensed", Arial, sans-serif`; return overlay.measureText(value).width }
        while (measure(parts[1]!, size) + measure(',' + parts[2]!, size * .5) > valueBox.width && size > 4) size -= .5
        const largeWidth = measure(parts[1]!, size), smallWidth = measure(',' + parts[2]!, size * .5)
        const x = valueBox.left + (valueBox.width - largeWidth - smallWidth) / 2
        overlay.fillStyle = '#fff'; overlay.textAlign = 'left'; overlay.textBaseline = 'middle'
        overlay.font = `800 ${size}px "Barlow Condensed", Arial, sans-serif`
        overlay.fillText(parts[1]!, x, valueBox.top + valueBox.height * .58)
        overlay.font = `800 ${size * .5}px "Barlow Condensed", Arial, sans-serif`
        overlay.fillText(',' + parts[2]!, x + largeWidth, valueBox.top + valueBox.height * .4)
      } else text(overlay, String(main.text), valueBox, priceBox.height * .78, '#fff')
      if (unit) text(overlay, String(unit.text), { left: priceBox.left + priceBox.width * .55, top: priceBox.top + priceBox.height * .76, width: priceBox.width * .37, height: priceBox.height * .18 }, priceBox.height * .18, '#fff')
    } else contain(overlay, sprite(data.price), priceBox)
  })
  return { slots, area, productCount: cards.length }
}
