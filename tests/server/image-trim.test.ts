import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { trimRasterImageBuffer } from '../../server/utils/image-trim'

const rgbaPng = async (
  width: number,
  height: number,
  paint: (pixels: Buffer, x: number, y: number) => void
): Promise<Buffer> => {
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) paint(pixels, x, y)
  }
  return await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

const setPixel = (pixels: Buffer, width: number, x: number, y: number, rgba: [number, number, number, number]) => {
  const offset = (y * width + x) * 4
  pixels[offset] = rgba[0]
  pixels[offset + 1] = rgba[1]
  pixels[offset + 2] = rgba[2]
  pixels[offset + 3] = rgba[3]
}

describe('trimRasterImageBuffer', () => {
  it('preserva bordas pretas opacas que fazem parte da arte enviada', async () => {
    const width = 64
    const height = 64
    const input = await rgbaPng(width, height, (pixels, x, y) => {
      setPixel(pixels, width, x, y, [8, 8, 8, 255])
      if (x >= 20 && x < 44 && y >= 20 && y < 44) {
        setPixel(pixels, width, x, y, [240, 240, 240, 255])
      }
    })

    const output = await trimRasterImageBuffer(input)
    const metadata = await sharp(output).metadata()

    expect(metadata.width).toBe(width)
    expect(metadata.height).toBe(height)
  })

  it('continua removendo somente a margem transparente', async () => {
    const width = 64
    const height = 64
    const input = await rgbaPng(width, height, (pixels, x, y) => {
      if (x >= 20 && x < 44 && y >= 20 && y < 44) {
        setPixel(pixels, width, x, y, [210, 35, 35, 255])
      }
    })

    const output = await trimRasterImageBuffer(input)
    const metadata = await sharp(output).metadata()

    expect(metadata.width).toBe(24)
    expect(metadata.height).toBe(24)
  })
})
