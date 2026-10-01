import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ download: vi.fn(), strict: vi.fn(), saveCache: vi.fn(), publicUrl: vi.fn() }))
vi.mock('../../server/utils/image-processor', () => ({
  downloadImage: mocks.download,
  processImageStrict: mocks.strict
}))
vi.mock('../../server/utils/product-image-cache', () => ({ saveProductImageCache: mocks.saveCache }))
vi.mock('../../server/utils/s3', () => ({ getPublicUrl: mocks.publicUrl }))
vi.mock('../../server/utils/url-safety', () => ({ assertSafeExternalHttpUrl: (url: string) => url }))

const { runExternalPipelineOnce } = await import('../../server/utils/product-image-pipeline')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.download.mockResolvedValue(Buffer.from('image'))
  mocks.strict.mockRejectedValue(new Error('package preservation check failed'))
  mocks.publicUrl.mockImplementation((key: string) => `https://storage.example/${key}`)
})

it('não grava nem aceita candidata quando a remoção estrita falha', async () => {
  const s3 = { send: vi.fn().mockRejectedValue(new Error('not found')) }
  await expect(runExternalPipelineOnce({
    s3,
    bucketName: 'bucket',
    deterministicKey: 'imagens/smart-product-v3.webp',
    normalizedTerm: 'product',
    term: 'Product',
    selectedImageUrl: 'https://images.example/product.png',
    bgPolicy: 'always'
  })).rejects.toThrow('package preservation check failed')
  expect(mocks.strict).toHaveBeenCalledOnce()
  expect(s3.send).toHaveBeenCalledTimes(2)
  expect(mocks.saveCache).not.toHaveBeenCalled()
})
