import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/video-studio/service', async original => ({ ...(await original() as object), videoBucket: () => 'test-bucket' }))

const { externalizeInlineCanvasImages } = await import('../../server/utils/whatsapp-creation/render')

const bigPng = `data:image/png;base64,${Buffer.alloc(4096, 7).toString('base64')}`
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('imagens do projeto gerado pelo WhatsApp', () => {
  beforeEach(() => { mocks.send.mockReset(); mocks.send.mockResolvedValue({}) })

  it('salva as imagens embutidas na pasta do projeto e referencia pelo storage', async () => {
    const canvas = {
      objects: [
        { type: 'Image', name: 'fundo', src: bigPng },
        { type: 'Group', objects: [{ type: 'Image', name: 'smart_image', src: bigPng, __originalSrc: bigPng }] },
        { type: 'Image', name: 'logo', src: '/api/storage/p?key=logo%2Frodrigues.png' },
        { type: 'Image', name: 'pixel', src: tinyPng }
      ]
    }
    await externalizeInlineCanvasImages(canvas, 'user-1', 'project-1')

    const puts = mocks.send.mock.calls.map(call => call[0]).filter(command => command instanceof PutObjectCommand)
    expect(puts).toHaveLength(1)
    expect(puts[0].input.Key).toMatch(/^projects\/user-1\/project-1\/assets\/[0-9a-f]{32}\.png$/)
    const ref = `/api/storage/p?key=${encodeURIComponent(puts[0].input.Key)}`
    expect(canvas.objects[0]!.src).toBe(ref)
    expect((canvas.objects[1] as any).objects[0].src).toBe(ref)
    expect((canvas.objects[1] as any).objects[0].__originalSrc).toBe(ref)
    expect(canvas.objects[2]!.src).toBe('/api/storage/p?key=logo%2Frodrigues.png')
    expect(canvas.objects[3]!.src).toBe(tinyPng)
  })
})
