import { expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('../../server/utils/birefnet', () => ({ removeBackgroundBiRefNet: vi.fn() }))
import { removeBackgroundBiRefNet } from '../../server/utils/birefnet'
import { processImageWithOptions } from '../../server/utils/image-processor'

it('fundo branco também usa BiRefNet e falha sem trocar de mecanismo', async () => {
  vi.mocked(removeBackgroundBiRefNet).mockRejectedValueOnce(new Error('BiRefNet indisponível'))
  const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'white' } })
    .composite([{ input: await sharp({ create: { width: 50, height: 50, channels: 3, background: 'red' } }).png().toBuffer(), left: 25, top: 25 }])
    .png().toBuffer()
  await expect(processImageWithOptions(image, { strict: true })).rejects.toThrow()
  expect(removeBackgroundBiRefNet).toHaveBeenCalledTimes(1)
})
