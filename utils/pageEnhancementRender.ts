import type { StaticCanvas } from 'fabric'
import { collectRedesignCards, readRedesignCard, drawRedesignCards, REDESIGN_VERSION } from './pageEnhancementLayout'

export interface EnhancementRect { left: number; top: number; width: number; height: number }
export interface EnhancementObject {
  type?: string
  name?: string
  isProductCard?: boolean
  _productData?: unknown
  isLogo?: boolean
  businessProfileField?: unknown
  [key: string]: unknown
  getObjects?: () => EnhancementObject[]
  getBoundingRect?: () => EnhancementRect
}

const backgrounds = new Set(['background', 'background-image', 'theme-background', 'product-area-background'])
const textTypes = new Set(['text', 'itext', 'i-text', 'textbox'])
const isImage = (object: EnhancementObject) => String(object.type).toLowerCase() === 'image'
const isExported = (object: EnhancementObject) => object.visible !== false && object.excludeFromExport !== true

/** Fundo legado verificado no canvas Torra: nome + chave do asset, nunca só o nome. */
function isNamedBackground(object: EnhancementObject): boolean {
  if (!/^Fundo /.test(String(object.name || ''))) return false
  if (object.isBackground === true || backgrounds.has(String(object.layerName || ''))) return true
  try {
    const source = new URL(String(object.__originalSrc || ''), 'https://canvas.invalid')
    return source.pathname === '/api/storage/p'
      && /^projects\/[^/]+\/[^/]+\/assets\/background\.png$/.test(source.searchParams.get('key') || '')
  } catch {
    return false
  }
}

const isText = (object: EnhancementObject) => textTypes.has(String(object.type).toLowerCase())

/** Lista fechada: cabeçalhos e fundos com vínculos podem conter informação comercial. */
export function classifyEnhancementProtection(object: EnhancementObject): 'text' | 'card' | 'image' | 'identity' | null {
  if (!isExported(object)) return null
  const name = String(object.name || '')
  if (object.isLogo || object.businessProfileField || /logo/i.test(name)) return 'identity'
  const children = object.getObjects?.() || []
  if (object.isProductCard || object._productData || children.some(child => isExported(child) && child.name === 'smart_title')) return 'card'
  if (isText(object)) return 'text'
  if (isImage(object)) {
    if (/^Selo 3D(?:\s|$)/i.test(name)) return 'image'
    const bound = Object.entries(object).some(([key, value]) =>
      /binding|businessProfileField|productData|smartType|quickDataField|quickDynamicIconFor/i.test(key) && value != null && value !== false && value !== '')
      || Boolean(object.data)
    return (backgrounds.has(name) || isNamedBackground(object)) && !bound ? null : 'image'
  }
  return null
}

/** Bounds Fabric 7 já estão no plano absoluto, incluindo todos os grupos ancestrais. */
export function clipEnhancementBounds(bounds: EnhancementRect, crop: EnhancementRect, multiplier = 1, padding = 0): EnhancementRect | null {
  if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new Error('Objeto protegido com limites inválidos.')
  }
  const left = Math.max(0, Math.floor((bounds.left - padding - crop.left) * multiplier))
  const top = Math.max(0, Math.floor((bounds.top - padding - crop.top) * multiplier))
  const right = Math.min(Math.floor(crop.width * multiplier), Math.ceil((bounds.left + bounds.width + padding - crop.left) * multiplier))
  const bottom = Math.min(Math.floor(crop.height * multiplier), Math.ceil((bounds.top + bounds.height + padding - crop.top) * multiplier))
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null
}

export function collectEnhancementProtection(objects: EnhancementObject[], crop: EnhancementRect, multiplier = 1): EnhancementRect[] {
  const rectangles: EnhancementRect[] = []
  const visit = (object: EnhancementObject) => {
    // Visibilidade oculta a subárvore inteira. Zonas legadas excluídas podem
    // conter cards exportáveis; só a caixa-guia deixa de ser protegida.
    if (object.visible === false) return
    if (object.excludeFromExport === true && !(object.isProductZone === true || object.isGridZone === true)) return
    const kind = classifyEnhancementProtection(object)
    if (kind) {
      if (!object.getBoundingRect) throw new Error('Objeto protegido sem limites absolutos.')
      const rect = clipEnhancementBounds(object.getBoundingRect(), crop, multiplier, isText(object) || (kind === 'identity' && isImage(object)) ? 4 : 0)
      if (rect) rectangles.push(rect)
    }
    // Mesmo dentro de cards, protege filhos que ultrapassam a caixa do grupo.
    object.getObjects?.().forEach(visit)
  }
  objects.forEach(visit)
  return rectangles
}

/** Área da união, sem contar duas vezes caixas sobrepostas. */
export function enhancementProtectedArea(rectangles: EnhancementRect[]): number {
  const xs = [...new Set(rectangles.flatMap(r => [r.left, r.left + r.width]))].sort((a, b) => a - b)
  let area = 0
  for (let i = 1; i < xs.length; i++) {
    const left = xs[i - 1]!, right = xs[i]!
    const intervals = rectangles.filter(r => r.left < right && r.left + r.width > left)
      .map(r => [r.top, r.top + r.height] as const).sort((a, b) => a[0] - b[0])
    let bottom = -Infinity, height = 0
    for (const [start, end] of intervals) {
      height += Math.max(0, end - Math.max(start, bottom))
      bottom = Math.max(bottom, end)
    }
    area += (right - left) * height
  }
  return area
}

export interface EnhancedPageInputOptions {
  /** Canvas offscreen pronto para exportar, com viewport identidade. */
  canvas: StaticCanvas
  fabric: { util: { createCanvasElement: () => HTMLCanvasElement } }
  width: number
  height: number
  crop?: EnhancementRect
  /** Limite adicional; nunca amplia e nunca excede 2048 px. */
  maxSide?: number
  allowFullProtection?: boolean
}

/** Cliente apenas. Branco = preservar; preto = permitir melhoria (não é máscara alpha). */
export async function prepareEnhancedPageInput({ canvas, fabric, width, height, crop = { left: 0, top: 0, width, height }, maxSide = 2048, allowFullProtection = false }: EnhancedPageInputOptions) {
  if (typeof document === 'undefined') throw new Error('A preparação da página requer o navegador.')
  if (![width, height, crop.width, crop.height, maxSide].every(n => Number.isFinite(n) && n >= 1)
    || ![crop.left, crop.top].every(Number.isFinite)) throw new Error('Dimensões de página inválidas.')
  if (canvas.viewportTransform.some((n, i) => n !== [1, 0, 0, 1, 0, 0][i])) {
    throw new Error('Use um canvas offscreen com viewport identidade.')
  }
  const multiplier = Math.min(1, Math.min(maxSide, 2048) / Math.max(crop.width, crop.height))
  const outputWidth = Math.floor(crop.width * multiplier), outputHeight = Math.floor(crop.height * multiplier)
  if (!outputWidth || !outputHeight) throw new Error('Recorte pequeno demais para exportar.')
  const objects = [...canvas.getObjects(), canvas.backgroundImage, canvas.overlayImage].filter(Boolean) as unknown as EnhancementObject[]
  const rectangles = collectEnhancementProtection(objects, crop, multiplier)
  const area = enhancementProtectedArea(rectangles)
  if (!area) throw new Error('A página não contém proteção dentro do recorte.')
  const protectedFraction = area / (outputWidth * outputHeight)
  if (protectedFraction >= 1 && !allowFullProtection) throw new Error('A proteção cobre toda a página; não há área para melhorar.')
  const maskCanvas = fabric.util.createCanvasElement()
  maskCanvas.width = outputWidth
  maskCanvas.height = outputHeight
  const context = maskCanvas.getContext('2d')
  if (!context) throw new Error('Não foi possível criar a máscara de proteção.')
  context.fillStyle = '#000000'
  context.fillRect(0, 0, outputWidth, outputHeight)
  context.fillStyle = '#ffffff'
  for (const rect of rectangles) context.fillRect(rect.left, rect.top, rect.width, rect.height)
  const mask = maskCanvas.toDataURL('image/png')

  // Fabric altera temporariamente estas propriedades durante a exportação. Restaura
  // também em erro (ex.: imagem sem CORS), sem mudar objetos, seleção ou histórico.
  const state = {
    width: canvas.width, height: canvas.height, viewportTransform: canvas.viewportTransform,
    enableRetinaScaling: canvas.enableRetinaScaling, skipControlsDrawing: (canvas as unknown as { skipControlsDrawing: boolean }).skipControlsDrawing,
    vptCoords: canvas.vptCoords
  }
  let original: string
  try {
    original = canvas.toDataURL({ ...crop, multiplier, format: 'png', enableRetinaScaling: false })
  } finally {
    Object.assign(canvas, state)
  }
  return { original, mask, width: outputWidth, height: outputHeight, protectedCount: rectangles.length,
    protectedFraction, nearlyAllProtected: protectedFraction >= 0.95 }
}

/** Camada comercial transparente: não congela o fundo inteiro dos cards. */
export async function prepareRedesignPageInput(options: EnhancedPageInputOptions) {
  const { canvas, fabric, width, height, crop = { left: 0, top: 0, width, height }, maxSide = 2048 } = options
  const original = await prepareEnhancedPageInput({ ...options, allowFullProtection: true })
  const multiplier = Math.min(1, Math.min(maxSide, 2048) / Math.max(crop.width, crop.height))
  const restored: Array<() => void> = []
  let protectedCount = 0
  const cards = collectRedesignCards(canvas.getObjects())
  if (!cards.length) throw new Error('O redesign requer um encarte com produtos editáveis separados. Use Acabamento leve para uma imagem achatada.')
  cards.forEach(readRedesignCard)
  const cardSet = new Set(cards)
  const visit = (object: any): boolean => {
    if (object.visible === false || (object.excludeFromExport === true && !object.isProductZone && !object.isGridZone)) return false
    if (cardSet.has(object)) {
      const state = { visible: object.visible }
      restored.push(() => Object.assign(object, state))
      object.visible = false
      protectedCount++
      return false
    }
    const kind = classifyEnhancementProtection(object)
    const priceParts = object.getObjects?.() || []
    if (priceParts.some((child: any) => child.name === 'price_value_text')) {
      // A placa precisa continuar na frente da foto. Redesenho vetorial local
      // conserva preço/unidade e evita que a IA tente reconstruí-los.
      for (const part of priceParts) {
        if (String(part.type).toLowerCase() !== 'rect') continue
        const state = { fill: part.fill, rx: part.rx, ry: part.ry, opacity: part.opacity, dirty: part.dirty }
        restored.push(() => Object.assign(part, state))
        if (['price-bevel', 'bottom-highlight'].includes(part.name)) part.opacity = 0
        else if (part.name === 'price_bg') { part.fill = '#cf1020'; part.rx = part.ry = 12 }
        else if (['price-rim', 'price_currency_bg'].includes(part.name)) { part.fill = '#ffcc45'; part.rx = part.ry = 14 }
        else if (part.name === 'price-depth') { part.fill = '#571014'; part.rx = part.ry = 16 }
        part.dirty = true
      }
      const cacheState = { objectCaching: object.objectCaching, dirty: object.dirty }
      restored.push(() => Object.assign(object, cacheState))
      object.objectCaching = false; object.dirty = true
      protectedCount++
      return true
    }
    // Selo, fotos, textos e logotipos nunca são recriados pelo modelo.
    const keep = kind === 'identity' || kind === 'text' || kind === 'image'
    const state = { visible: object.visible, objectCaching: object.objectCaching, dirty: object.dirty }
    restored.push(() => Object.assign(object, state))
    object.objectCaching = false
    object.dirty = true
    if (keep) { protectedCount++; return true }
    const children = object.getObjects?.() || []
    if (children.length) {
      const retained = children.map(visit).some(Boolean)
      object.visible = retained
      return retained
    }
    object.visible = false
    return false
  }
  const background = { backgroundColor: canvas.backgroundColor, backgroundImage: canvas.backgroundImage, overlayColor: canvas.overlayColor, overlayImage: canvas.overlayImage }
  try {
    canvas.getObjects().forEach(visit)
    canvas.backgroundColor = ''; canvas.backgroundImage = undefined
    canvas.overlayColor = ''; canvas.overlayImage = undefined
    if (!protectedCount) throw new Error('Não foi possível separar os produtos e dados desta página.')
    const shell = canvas.toDataURL({ ...crop, multiplier, format: 'png', enableRetinaScaling: false })
    // Restaura visibilidade antes de capturar sprites individuais dos cards.
    cards.forEach(card => { card.visible = true })
    const layer = fabric.util.createCanvasElement()
    const guideCanvas = fabric.util.createCanvasElement()
    layer.width = guideCanvas.width = original.width
    layer.height = guideCanvas.height = original.height
    const layerContext = layer.getContext('2d')
    const guideContext = guideCanvas.getContext('2d')
    if (!layerContext || !guideContext) throw new Error('Não foi possível montar o novo layout.')
    const shellImage = new Image(); shellImage.src = shell; await shellImage.decode()
    const logos: EnhancementRect[] = []
    const findLogos = (object: EnhancementObject) => {
      if (object.visible === false) return
      if (isImage(object) && (object.isLogo || /logo/i.test(String(object.name || ''))) && object.getBoundingRect) {
        const bounds = clipEnhancementBounds(object.getBoundingRect(), crop, multiplier)
        if (bounds && bounds.width > original.width * .2 && bounds.top < original.height * .38) logos.push(bounds)
      }
      object.getObjects?.().forEach(findLogos)
    }
    ;(canvas.getObjects() as unknown as EnhancementObject[]).forEach(findLogos)
    logos.forEach(bounds => {
      const pad = Math.max(10, Math.min(bounds.width, bounds.height) * .06)
      layerContext.save()
      layerContext.shadowColor = 'rgba(0,0,0,.45)'; layerContext.shadowBlur = pad * 1.3; layerContext.shadowOffsetY = pad * .35
      layerContext.beginPath()
      layerContext.roundRect(bounds.left - pad, bounds.top - pad, bounds.width + pad * 2, bounds.height + pad * 2, pad)
      layerContext.fillStyle = 'rgba(255,252,242,.96)'; layerContext.fill()
      layerContext.shadowColor = 'transparent'; layerContext.strokeStyle = '#f8c538'; layerContext.lineWidth = Math.max(2, pad * .1); layerContext.stroke()
      layerContext.restore()
    })
    layerContext.drawImage(shellImage, 0, 0)
    // A referência enviada ao modelo mostra somente a geometria do grid.
    // Produtos/textos da montagem ficam exclusivamente na camada comercial.
    guideContext.fillStyle = '#170d0b'
    guideContext.fillRect(0, 0, original.width, original.height)
    const layout = drawRedesignCards(cards, layerContext, guideContext, crop, multiplier)
    const overlay = layer.toDataURL('image/png')
    const guide = guideCanvas.toDataURL('image/png')
    // A máscara usa o alpha real, liberando espaços vazios entre fotos e letras.
    const bitmap = new Image()
    bitmap.src = overlay
    await bitmap.decode()
    const maskCanvas = fabric.util.createCanvasElement()
    maskCanvas.width = original.width; maskCanvas.height = original.height
    const context = maskCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Não foi possível preparar a proteção do redesign.')
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, original.width, original.height)
    let protectedPixels = 0
    for (let i = 0; i < pixels.data.length; i += 4) {
      const alpha = pixels.data[i + 3]!
      if (alpha) protectedPixels++
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = alpha
      pixels.data[i + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    const redesignArea = {
      left: Math.max(0, Math.floor(layout.area.left)),
      top: Math.max(0, Math.floor(layout.area.top)),
      width: Math.min(original.width, Math.ceil(layout.area.left + layout.area.width)) - Math.max(0, Math.floor(layout.area.left)),
      height: Math.min(original.height, Math.ceil(layout.area.top + layout.area.height)) - Math.max(0, Math.floor(layout.area.top))
    }
    return { ...original, overlay, guide, redesignArea, pipelineVersion: REDESIGN_VERSION, productCount: layout.productCount, mask: maskCanvas.toDataURL('image/png'), protectedCount,
      protectedFraction: protectedPixels / (original.width * original.height), nearlyAllProtected: false }
  } finally {
    Object.assign(canvas, background)
    restored.reverse().forEach(restore => restore())
  }
}
