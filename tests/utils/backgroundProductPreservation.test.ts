import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('../../server/utils/birefnet', () => ({ removeBackgroundBiRefNet: vi.fn() }))
import { removeBackgroundBiRefNet } from '../../server/utils/birefnet'
import { restoreHorizontalPackshotInterior, segmentProductWithBiRefNet } from '../../server/utils/birefnet-product-preservation'
import { processImageWithOptions } from '../../server/utils/image-processor'

beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.unstubAllEnvs())

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
  vi.stubEnv('BIREFNET_MODEL', 'birefnet-general')
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

const makeHorizontalBox = (width: number, height: number, bounds: [number, number, number, number]) => {
  const data = Buffer.alloc(width * height * 4, 255)
  const [left, top, right, bottom] = bounds
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const offset = (y * width + x) * 4
    data.set([190, 20, 25, 255], offset)
  }
  return data
}

it('recupera o interior impresso de uma embalagem horizontal com laterais semânticas preservadas', () => {
  const width = 200, height = 100
  const source = makeHorizontalBox(width, height, [20, 20, 180, 80])
  const mask = Buffer.from(source)
  for (let y = 20; y <= 80; y++) for (let x = 53; x <= 147; x++) {
    mask[(y * width + x) * 4 + 3] = 0
  }
  const restored = restoreHorizontalPackshotInterior(source, mask, width, height, [255, 255, 255])
  expect(restored).not.toBeNull()
  expect(restored!.data[(50 * width + 100) * 4 + 3]).toBe(255)
  expect(restored!.data[3]).toBe(255)
})

it('não aplica reparo retangular a garrafa vertical nem a dois produtos separados', () => {
  const bottleWidth = 80, bottleHeight = 160
  const bottle = makeHorizontalBox(bottleWidth, bottleHeight, [25, 10, 55, 150])
  expect(restoreHorizontalPackshotInterior(bottle, bottle, bottleWidth, bottleHeight, [255, 255, 255])).toBeNull()

  const width = 200, height = 100
  const separate = Buffer.alloc(width * height * 4, 255)
  for (let y = 30; y <= 70; y++) {
    for (let x = 5; x <= 95; x++) separate.set([190, 20, 25, 255], (y * width + x) * 4)
    for (let x = 104; x <= 195; x++) separate.set([20, 25, 190, 255], (y * width + x) * 4)
  }
  expect(restoreHorizontalPackshotInterior(separate, separate, width, height, [255, 255, 255])).toBeNull()
})

it('tenta BiRefNet General apenas depois de Lite apagar embalagem e repara prato impresso', async () => {
  vi.stubEnv('BIREFNET_MODEL', 'birefnet-general-lite')
  const width = 200, height = 100
  const source = await sharp(makeHorizontalBox(width, height, [20, 20, 180, 80]), {
    raw: { width, height, channels: 4 }
  }).png().toBuffer()
  vi.mocked(removeBackgroundBiRefNet).mockImplementation(async (input, model) => {
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const margin = 24
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4
      const localX = x - margin, localY = y - margin
      const inside = localX >= 20 && localX <= 180 && localY >= 20 && localY <= 80
      const hasSideSupport = inside && (localX <= 50 || localX >= 150)
      const preserveCenter = model === 'birefnet-general-lite'
        ? (localX >= 70 && localX <= 130 && localY >= 35 && localY <= 65)
        : hasSideSupport
      data[offset + 3] = preserveCenter ? 255 : 0
    }
    return sharp(data, { raw: info }).png().toBuffer()
  })
  const output = await segmentProductWithBiRefNet(source, sharp)
  expect(vi.mocked(removeBackgroundBiRefNet).mock.calls.map(call => call[1])).toEqual(['birefnet-general-lite', 'birefnet-general'])
  const pixels = await sharp(output).raw().toBuffer()
  expect(pixels[(50 * width + 100) * 4 + 3]).toBe(255)
  expect(pixels[(50 * width + 100) * 4]).toBe(190)
  expect(pixels[3]).toBe(0)
})
