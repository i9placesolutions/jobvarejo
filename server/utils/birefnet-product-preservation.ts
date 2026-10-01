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
  let lastLostPercent = 0
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
    let lostPixels = 0
    const result = Buffer.from(original.data)
    for (let p = 0; p < width * height; p++) {
      const offset = p * 4
      if (background && [0, 1, 2].some(c => Math.abs(original.data[offset + c]! - background[c]!) > 60) && alphaMask[offset + 3]! < 128) {
        lostPixels++
      }
      // RGB sempre vem do original; apenas o alpha vem da máscara semântica.
      result[offset + 3] = Math.min(original.data[offset + 3]!, alphaMask[offset + 3]!)
    }
    lastLostPercent = lostPixels / Math.max(1, productPixels) * 100
    if (lostPixels > 32 && lostPixels / Math.max(1, productPixels) > 0.04) {
      if (model !== models[models.length - 1]) {
        console.warn(`⚠️ [BiRefNet] ${model} apagou ${lastLostPercent.toFixed(1)}% do packshot; tentando modelo General`)
        continue
      }
      throw new Error(`O recorte apagaria partes da embalagem (${lastLostPercent.toFixed(1)}%); imagem original preservada`)
    }
    return sharp(result, { raw: original.info }).png().toBuffer()
  }
  throw new Error(`O recorte apagaria partes da embalagem (${lastLostPercent.toFixed(1)}%); imagem original preservada`)
}
