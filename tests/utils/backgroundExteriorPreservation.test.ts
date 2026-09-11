import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('../../server/utils/birefnet', () => ({ removeBackgroundBiRefNet: vi.fn() }))
import { removeBackgroundBiRefNet } from '../../server/utils/birefnet'
import { processImageWithOptions, removeUniformExteriorBackground } from '../../server/utils/image-processor'

beforeEach(() => vi.resetAllMocks())

it('preserva embalagem escura, amarela e impressão branca após o recorte do BiRefNet', async () => {
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
  // O recorte simulado representa a resposta do modelo obrigatório.
  vi.mocked(removeBackgroundBiRefNet).mockResolvedValueOnce(exterior!)
  const output = await processImageWithOptions(source, { outputFormat: 'png', strict: true })
  expect(removeBackgroundBiRefNet).toHaveBeenCalledTimes(1)
  const { data: result, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  expect([info.width, info.height]).toEqual([70, 70])
  for (let y = 0; y < 70; y++) for (let x = 0; x < 70; x++) {
    const originalOffset = ((y + 15) * width + x + 15) * 4
    const resultOffset = (y * info.width + x) * 4
    expect(result.subarray(resultOffset, resultOffset + 4)).toEqual(raw.subarray(originalOffset, originalOffset + 4))
  }
})

it('não usa remoção por cor quando o fundo é escuro', async () => {
  const source = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#111111' } }).png().toBuffer()
  expect(await removeUniformExteriorBackground(source, sharp)).toBeNull()
})

it('encaminha bordas claras misturadas com o fundo para o modelo sem apagar o produto', async () => {
  const width = 40, height = 40
  const raw = Buffer.alloc(width * height * 4, 255)
  for (let y = 8; y < 32; y++) for (let x = 8; x < 32; x++) {
    const edge = x === 8 || x === 31 || y === 8 || y === 31
    raw.set(edge ? [238, 240, 239, 255] : [30, 130, 110, 255], (y * width + x) * 4)
  }
  const source = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
  expect(await removeUniformExteriorBackground(source, sharp)).toBeNull()
})
