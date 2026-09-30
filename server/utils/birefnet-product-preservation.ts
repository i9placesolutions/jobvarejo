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
  const prediction = await removeBackgroundBiRefNet(input)
  const meta = await sharp(prediction).metadata()
  if (meta.width !== width + margin * 2 || meta.height !== height + margin * 2) {
    throw new Error('O BiRefNet retornou dimensões incompatíveis com a imagem original')
  }
  const mask = await (margin ? sharp(prediction).extract({ left: margin, top: margin, width, height }) : sharp(prediction))
    .ensureAlpha().raw().toBuffer()
  let productPixels = 0, lostPixels = 0
  for (let p = 0; p < width * height; p++) {
    const offset = p * 4
    if (background && [0, 1, 2].some(c => Math.abs(original.data[offset + c]! - background[c]!) > 60)) {
      productPixels++
      if (mask[offset + 3]! < 128) lostPixels++
    }
    // RGB sempre vem do original; apenas o alpha é estimado pelo modelo.
    original.data[offset + 3] = Math.min(original.data[offset + 3]!, mask[offset + 3]!)
  }
  if (lostPixels > 32 && lostPixels / Math.max(1, productPixels) > 0.04) {
    throw new Error(`O recorte apagaria partes da embalagem (${(lostPixels / productPixels * 100).toFixed(1)}%); imagem original preservada`)
  }
  return sharp(original.data, { raw: original.info }).png().toBuffer()
}
