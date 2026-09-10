import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('../../server/utils/birefnet', () => ({ removeBackgroundBiRefNet: vi.fn() }))
import { removeBackgroundBiRefNet } from '../../server/utils/birefnet'
import { processImageWithOptions, removeUniformExteriorBackground } from '../../server/utils/image-processor'

beforeEach(() => vi.clearAllMocks())

it('preserva embalagem escura, amarela e impressão branca sem segmentação semântica', async () => {
  const width = 100, height = 100
  const raw = Buffer.alloc(width * height * 4, 255)
  for (let y = 15; y < 85; y++) for (let x = 15; x < 85; x++) {
    const color = x < 40 ? [190, 20, 25] : x < 65 ? [245, 180, 35] : [12, 12, 12]
    const p = (y * width + x) * 4
    raw.set(color, p)
    if (y > 35 && y < 55 && x > 30 && x < 50) raw.set([255, 255, 255], p)
  }
  const source = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  const exterior = await removeUniformExteriorBackground(source, sharp)
  expect(exterior).not.toBeNull()
  const pixels = await sharp(exterior!).raw().toBuffer()
  for (let y = 15; y < 85; y++) for (let x = 15; x < 85; x++) {
    const p = (y * width + x) * 4
    expect(pixels.subarray(p, p + 4)).toEqual(raw.subarray(p, p + 4))
  }
  expect(pixels[3]).toBe(0)
  await processImageWithOptions(source, { outputFormat: 'png', strict: true })
  expect(removeBackgroundBiRefNet).not.toHaveBeenCalled()
})

it('não usa remoção por cor quando o fundo é escuro', async () => {
  const source = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#111111' } }).png().toBuffer()
  expect(await removeUniformExteriorBackground(source, sharp)).toBeNull()
})
