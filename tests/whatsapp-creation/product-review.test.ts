import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { createHash } from 'node:crypto'

const mocks = vi.hoisted(() => ({ send: vi.fn(), readBytes: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/video-studio/service', () => ({ videoBucket: () => 'test-bucket' }))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: mocks.readBytes }))

const { createProductReviewBoards } = await import('../../server/utils/whatsapp-creation/product-review')

const accountId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const products = Array.from({ length: 4 }, (_, index) => ({
  id: `product-${index + 1}`,
  name: `Produto ${index + 1}`,
  brand: '',
  variant: '',
  weight: '',
  price: `R$ ${index + 1},90`
}))
let imageBytes: Buffer

beforeEach(async () => {
  vi.resetAllMocks()
  imageBytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#cc2200' } }).png().toBuffer()
  mocks.readBytes.mockResolvedValue(imageBytes)
  mocks.send.mockResolvedValue({})
})

describe('pranchas de revisão de produtos WhatsApp', () => {
  it('gera uma prancha para quatro produtos, incluindo placeholder quando não há foto', async () => {
    const keys = await createProductReviewBoards({
      accountId,
      orderId,
      revision: 3,
      validity: 'Até 10/10',
      products,
      candidates: [{ itemId: products[0]!.id, key: `whatsapp-creation/${accountId}/inbound/product.png`, hash: createHash('sha256').update(imageBytes).digest('hex') }]
    })

    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(new RegExp(`^whatsapp-creation/${accountId}/${orderId}/r3/review-.+\\.png$`))
    expect(mocks.readBytes).toHaveBeenCalledTimes(1)
    expect(mocks.readBytes).toHaveBeenCalledWith(`whatsapp-creation/${accountId}/inbound/product.png`, accountId)
    expect(mocks.send).toHaveBeenCalledTimes(1)

    const command = mocks.send.mock.calls[0]![0] as PutObjectCommand
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({ Bucket: 'test-bucket', Key: keys[0], ContentType: 'image/png' })
    const png = command.input.Body as Buffer
    const metadata = await sharp(png).metadata()
    expect(metadata.format).toBe('png')
    expect(metadata.width).toBe(1080)
    expect(metadata.height).toBe(1070)

    const placeholderPixel = await sharp(png).extract({ left: 600, top: 300, width: 1, height: 1 }).removeAlpha().raw().toBuffer()
    expect([...placeholderPixel]).toEqual([242, 244, 247])
  })

  it('divide produtos em pranchas de no máximo doze, em ordem', async () => {
    const manyProducts = Array.from({ length: 13 }, (_, index) => ({ ...products[0]!, id: `product-${index + 1}`, name: `Produto ${index + 1}` }))
    const keys = await createProductReviewBoards({ accountId, orderId, revision: 4, validity: 'Até 10/10', products: manyProducts, candidates: [] })

    expect(keys).toHaveLength(2)
    expect(mocks.send).toHaveBeenCalledTimes(2)
    const first = mocks.send.mock.calls[0]![0] as PutObjectCommand
    const second = mocks.send.mock.calls[1]![0] as PutObjectCommand
    expect((await sharp(first.input.Body as Buffer).metadata()).height).toBe(1938)
    expect((await sharp(second.input.Body as Buffer).metadata()).width).toBe(1080)
    expect((await sharp(second.input.Body as Buffer).metadata()).height).toBe(636)
  })

  it('recusa foto alterada depois da seleção antes de mostrar a prancha', async () => {
    await expect(createProductReviewBoards({ accountId, orderId, revision: 3, validity: '05/10/2026', products,
      candidates: [{ itemId: products[0]!.id, key: `whatsapp-creation/${accountId}/inbound/product.png`, hash: '0'.repeat(64) }] }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
