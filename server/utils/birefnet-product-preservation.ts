import { removeBackgroundBiRefNet } from './birefnet'

/** Só reconhece fundo claro uniforme para proteger packshots, sem remover por cor. */
const getLightExterior = (data: Buffer, width: number, height: number): number[] | null => {
  const corners = [0, width - 1, (height - 1) * width, width * height - 1]
  const color = [0, 1, 2].map(c => corners.reduce((sum, p) => sum + data[p * 4 + c]!, 0) / 4)
  if (color.some(c => c < 225) || corners.some(p =>
    [0, 1, 2].some(c => Math.abs(data[p * 4 + c]! - color[c]!) > 12))) return null
  const matches = (p: number) => [0, 1, 2].every(c => Math.abs(data[p * 4 + c]! - color[c]!) <= 18)
  let vertical = 0, horizontal = 0
  for (let y = 0; y < height; y++) {
    if (matches(y * width)) vertical++
    if (matches(y * width + width - 1)) vertical++
  }
  for (let x = 0; x < width; x++) {
    if (matches(x)) horizontal++
    if (matches((height - 1) * width + x)) horizontal++
  }
  return Math.max(vertical / (2 * height), horizontal / (2 * width)) >= 0.98 ? color : null
}

type ProductBounds = { left: number; right: number; top: number; bottom: number; rows: Map<number, [number, number]> }

/**
 * Recover holes inside a strong, horizontal packshot only when both printed
 * side panels survive the semantic mask on nearly every product row. Source
 * color is used to estimate the rectangular silhouette; it never removes pixels.
 */
export const restoreHorizontalPackshotInterior = (
  sourceData: Buffer,
  maskData: Buffer,
  width: number,
  height: number,
  background: number[]
): { data: Buffer; bounds: ProductBounds } | null => {
  let left = width, right = -1, top = height, bottom = -1, foreground = 0
  const rowBounds = new Map<number, [number, number]>()
  for (let y = 0; y < height; y++) {
    let rowLeft = width, rowRight = -1
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const differsFromBackground = [0, 1, 2].some(channel => Math.abs(sourceData[offset + channel]! - background[channel]!) > 60)
      if (!differsFromBackground) continue
      rowLeft = Math.min(rowLeft, x)
      rowRight = x
      foreground++
    }
    if (rowRight < rowLeft) continue
    rowBounds.set(y, [rowLeft, rowRight])
    left = Math.min(left, rowLeft)
    right = Math.max(right, rowRight)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }

  const boxWidth = right - left + 1, boxHeight = bottom - top + 1
  if (boxWidth < 2 || boxHeight < 2 || boxWidth / boxHeight < 1.5) return null
  if (foreground / (boxWidth * boxHeight) < 0.78) return null

  let supportedRows = 0, broadRows = 0
  const weakColumns = new Uint8Array(boxWidth)
  for (let x = left; x <= right; x++) {
    let activeRows = 0
    for (let y = top; y <= bottom; y++) {
      const offset = (y * width + x) * 4
      if ([0, 1, 2].some(channel => Math.abs(sourceData[offset + channel]! - background[channel]!) > 60)) activeRows++
    }
    if (activeRows / boxHeight < 0.35) weakColumns[x - left] = 1
  }
  // Disconnected packs leave a vertical background corridor even when the
  // total bounding-box fill remains high. Never bridge that gap.
  if (weakColumns.reduce((sum, value) => sum + value, 0) / boxWidth > 0.02) return null

  const bounds = { left, right, top, bottom, rows: rowBounds }
  for (let y = top; y <= bottom; y++) {
    const row = rowBounds.get(y)
    if (!row || (row[1] - row[0] + 1) / boxWidth < 0.5) continue
    broadRows++
    const margin = Math.max(1, Math.ceil(boxWidth * 0.07))
    let leftSupported = false, rightSupported = false
    for (let x = left; x < Math.min(right + 1, left + margin) && !leftSupported; x++) {
      leftSupported = maskData[(y * width + x) * 4 + 3]! >= 200
    }
    for (let x = Math.max(left, right - margin + 1); x <= right && !rightSupported; x++) {
      rightSupported = maskData[(y * width + x) * 4 + 3]! >= 200
    }
    if (leftSupported && rightSupported) supportedRows++
  }
  if (!broadRows || supportedRows / broadRows < 0.9) return null

  const restored = Buffer.from(maskData)
  for (let y = top; y <= bottom; y++) {
    const row = rowBounds.get(y)
    if (!row) continue
    for (let x = row[0]; x <= row[1]; x++) {
      const alphaOffset = (y * width + x) * 4 + 3
      if (restored[alphaOffset]! < 200) restored[alphaOffset] = 255
    }
  }
  return { data: restored, bounds }
}

/**
 * Sombra projetada sobre fundo claro também difere do fundo, mas não é produto.
 * Marca como sombra o pixel removido pelo modelo que é neutro (sem cor) e que se
 * liga ao fundo removido por um caminho de pixels removidos também neutros.
 */
export const markRemovedShadowPixels = (
  sourceData: Buffer,
  lost: Uint8Array,
  removedBackground: Uint8Array,
  width: number,
  height: number
): Uint8Array => {
  const neutral = (p: number): boolean => {
    const offset = p * 4
    const r = sourceData[offset]!, g = sourceData[offset + 1]!, b = sourceData[offset + 2]!
    return Math.max(r, g, b) - Math.min(r, g, b) <= 28
  }
  const shadow = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const neighbors = (p: number): number[] => {
    const list: number[] = []
    if (p % width) list.push(p - 1)
    if (p % width < width - 1) list.push(p + 1)
    if (p >= width) list.push(p - width)
    if (p < width * (height - 1)) list.push(p + width)
    return list
  }
  for (let p = 0; p < width * height; p++) {
    if (!lost[p] || !neutral(p) || !neighbors(p).some(n => removedBackground[n])) continue
    shadow[p] = 1
    queue[tail++] = p
  }
  while (head < tail) {
    for (const n of neighbors(queue[head++]!)) {
      if (shadow[n] || !lost[n] || !neutral(n)) continue
      shadow[n] = 1
      queue[tail++] = n
    }
  }
  return shadow
}

export const segmentProductWithBiRefNet = async (source: Buffer, sharp: any): Promise<Buffer> => {
  const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = original.info
  const background = getLightExterior(original.data, width, height)
  // O modelo pode confundir a embalagem com fundo quando ela toca as bordas.
  // A margem só existe durante a inferência e é retirada nas mesmas coordenadas.
  const margin = background ? Math.max(24, Math.ceil(Math.max(width, height) * 0.1)) : 0
  const input = margin ? await sharp(source).extend({
    top: margin, bottom: margin, left: margin, right: margin,
    background: { r: Math.round(background![0]!), g: Math.round(background![1]!), b: Math.round(background![2]!), alpha: 1 }
  }).png().toBuffer() : source
  let productPixels = 0
  for (let p = 0; p < width * height; p++) {
    const offset = p * 4
    if (background && [0, 1, 2].some(c => Math.abs(original.data[offset + c]! - background[c]!) > 60)) {
      productPixels++
    }
  }

  const configuredModel = process.env.BIREFNET_MODEL || 'birefnet-general-lite'
  const models: Array<'birefnet-general-lite' | 'birefnet-general'> = configuredModel === 'birefnet-general-lite'
    ? ['birefnet-general-lite', 'birefnet-general']
    : [configuredModel as 'birefnet-general-lite' | 'birefnet-general']
  const isProductPixel = (p: number): boolean => Boolean(background) &&
    [0, 1, 2].some(c => Math.abs(original.data[p * 4 + c]! - background![c]!) > 60)
  let best: { result: Buffer; lost: Uint8Array; shadow: Uint8Array; lostPixels: number } | null = null
  for (const model of models) {
    const prediction = await removeBackgroundBiRefNet(input, model)
    const meta = await sharp(prediction).metadata()
    if (meta.width !== width + margin * 2 || meta.height !== height + margin * 2) {
      throw new Error('O BiRefNet retornou dimensões incompatíveis com a imagem original')
    }
    const mask = await (margin ? sharp(prediction).extract({ left: margin, top: margin, width, height }) : sharp(prediction))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const repaired = background
      ? restoreHorizontalPackshotInterior(original.data, mask.data, width, height, background)?.data
      : null
    const alphaMask: Buffer = repaired || mask.data
    const lost = new Uint8Array(width * height)
    const removedBackground = new Uint8Array(width * height)
    const result = Buffer.from(original.data)
    for (let p = 0; p < width * height; p++) {
      const offset = p * 4
      const removed = alphaMask[offset + 3]! < 128
      if (removed && isProductPixel(p)) lost[p] = 1
      else if (removed) removedBackground[p] = 1
      // RGB sempre vem do original; apenas o alpha vem da máscara semântica.
      result[offset + 3] = Math.min(original.data[offset + 3]!, alphaMask[offset + 3]!)
    }
    const shadow = markRemovedShadowPixels(original.data, lost, removedBackground, width, height)
    let lostPixels = 0
    for (let p = 0; p < width * height; p++) if (lost[p] && !shadow[p]) lostPixels++
    if (lostPixels <= 32 || lostPixels / Math.max(1, productPixels) <= 0.04) {
      return sharp(result, { raw: original.info }).png().toBuffer()
    }
    if (!best || lostPixels < best.lostPixels) best = { result, lost, shadow, lostPixels }
    if (model !== models[models.length - 1]) {
      console.warn(`⚠️ [BiRefNet] ${model} apagou ${(lostPixels / Math.max(1, productPixels) * 100).toFixed(1)}% do packshot; tentando modelo General`)
    }
  }
  // Nenhum modelo preservou o produto inteiro: em vez de recusar o recorte,
  // devolve ao melhor resultado os pixels de produto apagados (sombras continuam fora).
  const repaired = best!
  for (let p = 0; p < width * height; p++) {
    if (repaired.lost[p] && !repaired.shadow[p]) repaired.result[p * 4 + 3] = original.data[p * 4 + 3]!
  }
  console.warn(`⚠️ [BiRefNet] ${(repaired.lostPixels / Math.max(1, productPixels) * 100).toFixed(1)}% do packshot restaurado a partir do original`)
  return sharp(repaired.result, { raw: original.info }).png().toBuffer()
}
