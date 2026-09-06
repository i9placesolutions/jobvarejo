import { expect, it } from 'vitest'
import sharp from 'sharp'
import { processImageWithOptions } from '../../server/utils/image-processor'
it('upload forçado preserva o branco e alpha de imagem já recortada', async () => {
  const raw = Buffer.alloc(100 * 100 * 4, 255)
  // Margem transparente de apenas 2%, menor que o antigo limite de 25%.
  for (let pixel = 0; pixel < 200; pixel++) raw[pixel * 4 + 3] = 0
  const original = await sharp(raw, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer()
  const result = await processImageWithOptions(original, { forceBgRemoval: true, strict: true, outputFormat: 'png' })
  expect(await sharp(result).raw().toBuffer()).toEqual(raw)
})
