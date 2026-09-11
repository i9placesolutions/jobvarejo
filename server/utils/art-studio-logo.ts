import sharp from 'sharp'
import { artStickerCoverage } from './art-studio-outline'
export type ArtLogoOptions = {
  width: number
  height: number
  trim: boolean
  backdrop: string
  padding: number
  outline: boolean
  outlineColor: string
  outlineWidth: number
}
export const trimArtTransparency = async (input: Buffer) => {
  const { data, info } = await sharp(input, { limitInputPixels: 24_000_000 })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let minX = info.width,
    minY = info.height,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3]! > 8) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
  const image = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
  if (maxX >= minX && maxY >= minY)
    return image
      .extract({
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      })
      .png()
      .toBuffer()
  return image.png().toBuffer()
}
export const prepareArtLogo = async (
  input: Buffer,
  options: ArtLogoOptions
) => {
  // Mesma política das ofertas: alpha <= 8 é margem; preto/branco opacos são conteúdo.
  const trimmed = options.trim
    ? await trimArtTransparency(input)
    : await sharp(input, { limitInputPixels: 24_000_000 })
        .rotate()
        .png()
        .toBuffer()
  const factor = Math.min(1, 2048 / Math.max(options.width, options.height)),
    width = Math.max(1, Math.round(options.width * factor)),
    height = Math.max(1, Math.round(options.height * factor))
  const padding = Math.min(
    options.padding * factor,
    Math.min(width, height) / 4
  )
  const usableWidth = Math.max(1, Math.floor(width - 2 * padding)),
    usableHeight = Math.max(1, Math.floor(height - 2 * padding))
  const { data: logo, info } = await sharp(trimmed)
    .resize(usableWidth, usableHeight, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true })
  const left = Math.floor((width - info.width) / 2),
    top = Math.floor((height - info.height) / 2)
  let geometry = ''
  const bx = left - padding,
    by = top - padding,
    bw = info.width + 2 * padding,
    bh = info.height + 2 * padding
  if (options.backdrop === 'square')
    geometry = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.min(16 * factor, bw / 2, bh / 2)}"/>`
  if (options.backdrop === 'oval')
    geometry = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${bw / 2}" ry="${bh / 2}"/>`
  if (options.backdrop === 'round') {
    const radius = Math.min(width, height) / 2
    geometry = `<circle cx="${width / 2}" cy="${height / 2}" r="${radius}"/>`
  }
  const base = sharp({
    create: { width, height, channels: 4, background: '#00000000' }
  })
  const layers: Array<{ input: Buffer; left?: number; top?: number }> = []
  if (geometry)
    layers.push({
      input: Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="white" fill-opacity="0.94" stroke="white" stroke-opacity="0.98" stroke-width="1">${geometry}</g></svg>`
      )
    })
  if (options.outline) {
    const scale = width * height * 4 <= 16_000_000 ? 2 : 1
    const cw = width * scale, ch = height * scale
    const rgba = await sharp(logo).resize(info.width * scale, info.height * scale)
      .extend({ top: top * scale, left: left * scale,
        bottom: (height-top-info.height)*scale, right: (width-left-info.width)*scale,
        background: '#00000000' }).ensureAlpha().raw().toBuffer()
    const inside = new Uint8Array(cw * ch)
    for(let i=0;i<inside.length;i++) inside[i]=rgba[i*4+3]! >= 16 ? 1 : 0
    const coverage = artStickerCoverage(inside,cw,ch,options.outlineWidth*factor*scale,scale)
    const pixels=Buffer.alloc(cw*ch*4)
    const color=options.outlineColor.slice(1)
    const red=parseInt(color.slice(0,2),16), green=parseInt(color.slice(2,4),16), blue=parseInt(color.slice(4,6),16)
    for(let i=0;i<coverage.length;i++) {
      pixels[i*4]=red;pixels[i*4+1]=green;pixels[i*4+2]=blue;pixels[i*4+3]=Math.round(coverage[i]!*255)
    }
    const outline = await sharp(pixels,{raw:{width:cw,height:ch,channels:4}})
      .resize(width,height,{kernel:'linear'}).png().toBuffer()
    layers.push({ input: outline })
  }
  layers.push({ input: logo, left, top })
  return base.composite(layers).png().toBuffer()
}
