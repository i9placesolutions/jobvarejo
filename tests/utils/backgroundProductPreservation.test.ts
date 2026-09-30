import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('../../server/utils/birefnet', () => ({ removeBackgroundBiRefNet: vi.fn() }))
import { removeBackgroundBiRefNet } from '../../server/utils/birefnet'
import { segmentProductWithBiRefNet } from '../../server/utils/birefnet-product-preservation'
import { processImageWithOptions } from '../../server/utils/image-processor'

beforeEach(() => vi.resetAllMocks())

const makePackshot = async () => sharp({
  create: { width: 100, height: 70, channels: 4, background: 'white' }
}).composite([{ input: await sharp({
  create: { width: 96, height: 40, channels: 4, background: '#ce1515' }
}).png().toBuffer(), left: 2, top: 15 }]).png().toBuffer()

const mockMask = (damage = false, changeRgb = false) => {
  vi.mocked(removeBackgroundBiRefNet).mockImplementationOnce(async input => {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * 4
      if (data[p]! > 240 || (damage && y < 50)) data[p + 3] = 0
      if (changeRgb) data.set([0, 0, 255], p)
    }
    return sharp(data, { raw: info }).png().toBuffer()
  })
}

it('dá margem à embalagem perto da borda e retira apenas a margem temporária', async () => {
  const source = await makePackshot()
  mockMask()
  const output = await segmentProductWithBiRefNet(source, sharp)
  const modelInput = vi.mocked(removeBackgroundBiRefNet).mock.calls[0]![0]
  const inputMeta = await sharp(modelInput).metadata()
  expect([inputMeta.width, inputMeta.height]).toEqual([148, 118])
  const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true })
  expect([info.width, info.height]).toEqual([100, 70])
  expect(data[3]).toBe(0)
  for (let y = 15; y < 55; y++) for (let x = 2; x < 98; x++) {
    expect(data[(y * 100 + x) * 4 + 3]).toBe(255)
  }
})

it('rejeita perda conectada ao exterior mesmo se restar bastante conteúdo no recorte', async () => {
  mockMask(true)
  await expect(processImageWithOptions(await makePackshot(), { strict: true, outputFormat: 'png' }))
    .rejects.toThrow('apagaria partes da embalagem')
})

it('preserva RGB do original mesmo quando a resposta do modelo muda suas cores', async () => {
  const source = await makePackshot()
  mockMask(false, true)
  const output = await segmentProductWithBiRefNet(source, sharp)
  const original = await sharp(source).raw().toBuffer()
  const pixels = await sharp(output).raw().toBuffer()
  const offset = (30 * 100 + 30) * 4
  expect(pixels.subarray(offset, offset + 4)).toEqual(original.subarray(offset, offset + 4))
})

it('mantém o input de fundo não uniforme sem inventar uma margem branca', async () => {
  const source = await sharp({ create: { width: 40, height: 40, channels: 4, background: '#151515' } }).png().toBuffer()
  vi.mocked(removeBackgroundBiRefNet).mockResolvedValueOnce(source)
  await segmentProductWithBiRefNet(source, sharp)
  expect(vi.mocked(removeBackgroundBiRefNet).mock.calls[0]![0]).toEqual(source)
})

it('rejeita resposta do modelo com tamanho incompatível', async () => {
  vi.mocked(removeBackgroundBiRefNet).mockResolvedValueOnce(await sharp({
    create: { width: 10, height: 10, channels: 4, background: 'red' }
  }).png().toBuffer())
  await expect(segmentProductWithBiRefNet(await makePackshot(), sharp)).rejects.toThrow('dimensões incompatíveis')
})
