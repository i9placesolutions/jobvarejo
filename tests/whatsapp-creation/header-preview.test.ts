import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/video-studio/service', () => ({ videoBucket: () => 'test-bucket' }))
vi.mock('../../server/utils/whatsapp-creation/render', () => ({
  renderCreationHeaderPreview: vi.fn(), hydrateFlyerBusinessFields: vi.fn((canvas: unknown) => canvas)
}))

const { prepareCreationHeader } = await import('../../server/utils/whatsapp-creation/header-preview')
const templateId = '22222222-2222-4222-8222-222222222222'
const ownerId = '11111111-1111-4111-8111-111111111111'
const prefix = `projects/${ownerId}/${templateId}/`

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket', wasabiEndpoint: 's3.wasabisys.com' }))
})

describe('prévia de cabeçalho de encarte', () => {
  it('recorta o cabeçalho e gera uma imagem distinta com a logo da conta solicitante', async () => {
    const thumbnail = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#efefef' } }).png().toBuffer()
    const redLogo = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#cc0000' } }).png().toBuffer()
    const blueLogo = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#0000cc' } }).png().toBuffer()
    const canvas = gzipSync(Buffer.from(JSON.stringify({ width: 800, height: 1000, objects: [
      { name: 'product-section-surface', originY: 'top', top: 400 },
      { name: 'header-logo-slot', quickLogoSlot: true, left: 500, top: 100, width: 200, height: 100, scaleX: 1, scaleY: 1 }
    ] })))
    const assets = new Map([
      [`${prefix}story.webp`, thumbnail], [`${prefix}story.json.gz`, canvas],
      ['logo/cliente-a.png', redLogo], ['logo/cliente-b.png', blueLogo]
    ])
    const saved: Buffer[] = []
    mocks.send.mockImplementation(async (command: GetObjectCommand | PutObjectCommand) => {
      if (command instanceof PutObjectCommand) { saved.push(command.input.Body as Buffer); return {} }
      const bytes = assets.get(String(command.input.Key))
      if (!bytes) throw new Error('asset inesperado')
      return { ContentLength: bytes.length, Body: { transformToByteArray: async () => bytes } }
    })
    const header = { id: templateId, revision: 1, theme: 'Hortifruti', formats: ['stories'], name: 'Verde',
      sourceOwnerId: ownerId, sourceThumbnailKey: `${prefix}story.webp`, sourceCanvasKey: `${prefix}story.json.gz`, sourcePageHeight: 1000 }
    const account = (id: string, logo: string) => ({ user: { id }, businessProfile: { logo } }) as any

    const first = await prepareCreationHeader(header, 'encarte', account(ownerId, 'logo/cliente-a.png'))
    const second = await prepareCreationHeader(header, 'encarte', account('33333333-3333-4333-8333-333333333333', 'logo/cliente-b.png'))

    expect(first.headerKey).toMatch(new RegExp(`^whatsapp-creation/${ownerId}/headers/`))
    expect(second.headerKey).not.toBe(first.headerKey)
    expect(saved).toHaveLength(2)
    expect((await sharp(saved[0]).metadata()).height).toBe(400)
    expect((await sharp(saved[1]).metadata()).height).toBe(400)
    const pixelA = await sharp(saved[0]).extract({ left: 600, top: 150, width: 1, height: 1 }).raw().toBuffer()
    const pixelB = await sharp(saved[1]).extract({ left: 600, top: 150, width: 1, height: 1 }).raw().toBuffer()
    expect(pixelA[0]!).toBeGreaterThan(pixelA[2]!)
    expect(pixelB[2]!).toBeGreaterThan(pixelB[0]!)
  }, 30_000)

  it('mantém o fundo do modelo e o contorno sticker de uma logo transparente', async () => {
    const logo = await sharp({ create: { width: 500, height: 500, channels: 4, background: '#00000000' } })
      .composite([{ input: Buffer.from('<svg width="500" height="500"><rect x="100" y="150" width="300" height="200" fill="#cc0000"/></svg>') }])
      .png().toBuffer()
    const canvas = gzipSync(Buffer.from(JSON.stringify({ width: 800, height: 1000, objects: [
      { type: 'Rect', originX: 'left', originY: 'top', left: 0, top: 0, width: 800, height: 1000, fill: '#228833' },
      { name: 'header-logo-slot', quickLogoSlot: true, type: 'Image', left: 500, top: 100, width: 200, height: 150, scaleX: 1, scaleY: 1 },
      { name: 'product-section-surface', originY: 'top', top: 400 }
    ] })))
    const assets = new Map([[`${prefix}story.json.gz`, canvas], ['logo/sticker.png', logo]])
    let saved: Buffer | undefined
    mocks.send.mockImplementation(async (command: GetObjectCommand | PutObjectCommand) => {
      if (command instanceof PutObjectCommand) { saved = command.input.Body as Buffer; return {} }
      const bytes = assets.get(String(command.input.Key))
      if (!bytes) throw new Error('asset inesperado')
      return { ContentLength: bytes.length, Body: { transformToByteArray: async () => bytes } }
    })
    await prepareCreationHeader({ id: templateId, revision: 1, theme: 'Hortifruti', formats: ['stories'], name: 'Verde',
      sourceOwnerId: ownerId, sourceThumbnailKey: `${prefix}story.webp`, sourceCanvasKey: `${prefix}story.json.gz`, sourcePageHeight: 1000 },
    'encarte', { user: { id: ownerId }, businessProfile: { logo: 'logo/sticker.png', logoPreference: {
      outline: true, outlineMode: 'outside', outlineColor: '#FFFFFF', outlineWidth: 4, backdrop: 'none'
    } } } as any)
    expect(saved).toBeDefined()
    const background = await sharp(saved!).extract({ left: 450, top: 175, width: 1, height: 1 }).raw().toBuffer()
    expect([...background.subarray(0, 3)]).toEqual([34, 136, 51])
    const { data, info } = await sharp(saved!).extract({ left: 490, top: 90, width: 230, height: 190 }).raw().toBuffer({ resolveWithObject: true })
    let whitePixels = 0
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index]! > 240 && data[index + 1]! > 240 && data[index + 2]! > 240) whitePixels++
    }
    expect(whitePixels).toBeGreaterThan(0)
  })
})
