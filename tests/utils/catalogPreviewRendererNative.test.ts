import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import * as fabric from 'fabric/node'
import { normalizeCatalogImageSource, renderCatalogPreview, runCatalogPreviewTask } from '../../server/utils/catalog-preview-renderer'

const mocks = vi.hoisted(() => ({ s3Send: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.s3Send }) }))

describe('native catalog preview renderer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects an oversized or deeply nested Fabric tree before native enlivening', async () => {
    const tooManyObjects = { type: 'Canvas', objects: Array.from({ length: 3001 }, () => ({ type: 'Rect', width: 1, height: 1 })) }
    await expect(renderCatalogPreview({ canvasJson: tooManyObjects, width: 320, height: 160, sourceOwnerId: 'owner-a', kind: 'label' }))
      .rejects.toThrow('limite de objetos')
  })

  it('omits images beyond the decoded pixel budget before Fabric retains them', async () => {
    const largeRaster = await sharp({ create: { width: 4000, height: 4000, channels: 4, background: '#ffffff' } })
      .png({ compressionLevel: 9 }).toBuffer()
    const image = `data:image/png;base64,${largeRaster.toString('base64')}`
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(renderCatalogPreview({
      canvasJson: {
        version: '7.0',
        objects: Array.from({ length: 4 }, (_, index) => ({
          type: 'Image', left: index * 10, top: 0, width: 4000, height: 4000, src: image
        }))
      },
      width: 320,
      height: 160,
      sourceOwnerId: 'owner-a',
      kind: 'flyer'
    })).resolves.toBeInstanceOf(Buffer)
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('limite total de pixels')
    warnSpy.mockRestore()
  }, 30_000)

  it('keeps alpha and fits a valid PNG whose fast encoding would exceed the source cap', async () => {
    const width = 1689
    const height = 1850
    const raw = Buffer.allocUnsafe(width * height * 4)
    let seed = 123
    const randomByte = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed >>> 24
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4
        if (y / height < 0.55) {
          raw[offset] = randomByte()
          raw[offset + 1] = randomByte()
          raw[offset + 2] = randomByte()
          raw[offset + 3] = randomByte()
        } else {
          raw[offset] = ((x >> 3) + (y >> 2)) & 255
          raw[offset + 1] = ((x >> 2) * 13) & 255
          raw[offset + 2] = ((y >> 1) * 17) & 255
          raw[offset + 3] = x % 97 < 48 ? 255 : 128
        }
      }
    }
    const sourcePng = await sharp(raw, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 6 }).toBuffer()
    const fastPng = await sharp(sourcePng).png({ compressionLevel: 1 }).toBuffer()
    const safePng = await sharp(sourcePng).png({ compressionLevel: 6 }).toBuffer()
    expect(fastPng.length).toBeGreaterThan(8 * 1024 * 1024)
    expect(safePng.length).toBeLessThanOrEqual(8 * 1024 * 1024)

    const normalized = await normalizeCatalogImageSource(`data:image/png;base64,${sourcePng.toString('base64')}`, 'owner-a')
    expect(normalized.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    const normalizedBytes = Buffer.from(normalized.dataUrl.split(',')[1]!, 'base64')
    const normalizedMeta = await sharp(normalizedBytes).metadata()
    expect(normalized).toMatchObject({ width, height })
    expect(normalizedBytes.length).toBeLessThanOrEqual(8 * 1024 * 1024)
    expect(normalizedMeta).toMatchObject({ width, height, hasAlpha: true })
  }, 30_000)

  it('downloads and normalizes a repeated source once while preserving both image instances', async () => {
    const sourceImage = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ef4444' } }).png().toBuffer()
    mocks.s3Send.mockResolvedValue({
      ContentLength: sourceImage.length,
      Body: { transformToByteArray: async () => sourceImage }
    })
    vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket', wasabiEndpoint: 's3.wasabisys.com' }))
    vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))
    const output = await renderCatalogPreview({
      canvasJson: {
        version: '7.0',
        objects: [
          { type: 'Image', left: 0, top: 0, width: 20, height: 10, src: 'imagens/shared-source.png' },
          { type: 'Image', left: 30, top: 0, width: 20, height: 10, src: 'imagens/shared-source.png' }
        ]
      },
      width: 320,
      height: 160,
      sourceOwnerId: 'owner-a',
      kind: 'flyer'
    })
    expect(output.length).toBeGreaterThan(0)
    expect(mocks.s3Send).toHaveBeenCalledTimes(1)
  })

  it('omits remote Fabric Pattern sources without any network access', async () => {
    const fetchSpy = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket', wasabiEndpoint: 's3.wasabisys.com' }))
    vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))
    await expect(renderCatalogPreview({
      canvasJson: {
        version: '7.0',
        objects: [{
          type: 'Rect',
          width: 20,
          height: 20,
          fill: { type: 'pattern', source: 'http://169.254.169.254/latest/meta-data/' }
        }]
      },
      width: 320,
      height: 160,
      sourceOwnerId: 'owner-a',
      kind: 'flyer'
    })).resolves.toBeInstanceOf(Buffer)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('Origem externa não permitida')
    warnSpy.mockRestore()
  })

  it('runs two catalog tasks at once by default and queues the third', async () => {
    const releases: Array<() => void> = []
    let active = 0
    let peak = 0
    const task = () => new Promise<string>((resolve) => {
      active += 1
      peak = Math.max(peak, active)
      releases.push(() => { active -= 1; resolve('ok') })
    })
    const runs = [1, 2, 3].map(index => runCatalogPreviewTask(`default-concurrency:${index}:${Math.random()}`, task))
    await Promise.resolve()
    expect(active).toBe(2)
    releases.splice(0).forEach(release => release())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(active).toBe(1)
    releases.splice(0).forEach(release => release())
    await expect(Promise.all(runs)).resolves.toEqual(['ok', 'ok', 'ok'])
    expect(peak).toBe(2)
  })

  it('renders a native flyer and a transparent 320×160 label group as non-empty WebP', async () => {
    const pixel = await sharp({
      create: { width: 8, height: 8, channels: 4, background: '#ef4444' }
    }).png().toBuffer()
    const flyer = await renderCatalogPreview({
      canvasJson: {
        version: '7.0',
        objects: [
          { type: 'Rect', left: 10, top: 10, width: 180, height: 80, fill: '#2563eb', strokeWidth: 0 },
          { type: 'Image', left: 35, top: 25, width: 8, height: 8, scaleX: 4, scaleY: 4, src: `data:image/png;base64,${pixel.toString('base64')}` }
        ]
      },
      width: 1080,
      height: 1350,
      sourceOwnerId: 'owner-a',
      kind: 'flyer'
    })
    const flyerMeta = await sharp(flyer).metadata()
    expect(flyer.length).toBeGreaterThan(0)
    expect(flyerMeta.format).toBe('webp')
    expect(Math.max(flyerMeta.width || 0, flyerMeta.height || 0)).toBeLessThanOrEqual(480)

    const serializedGroup = new fabric.Group([
      new fabric.Rect({ left: 0, top: 0, width: 200, height: 90, fill: '#facc15', strokeWidth: 0 }),
      new fabric.Textbox('Oferta', { left: 12, top: 12, width: 160, height: 36, fontSize: 24, fill: '#111827' })
    ]).toObject()
    const label = await renderCatalogPreview({
      canvasJson: serializedGroup,
      width: 320,
      height: 160,
      sourceOwnerId: 'owner-a',
      kind: 'label'
    })
    const labelMeta = await sharp(label).metadata()
    expect(label.length).toBeGreaterThan(0)
    expect(labelMeta).toMatchObject({ format: 'webp', width: 320, height: 160, hasAlpha: true })
    const { data } = await sharp(label).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const alpha = Array.from({ length: data.length / 4 }, (_, index) => data[index * 4 + 3]!)
    expect(alpha.some(value => value === 0)).toBe(true)
    expect(alpha.some(value => value > 0)).toBe(true)
  }, 30_000)
})
