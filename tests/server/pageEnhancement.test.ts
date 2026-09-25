import sharp from 'sharp'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/s3', () => ({ getS3Client: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: vi.fn(), pgTx: vi.fn() }))

import { compositeCommercialOverlay, compositeProtectedPixels, finalizeEnhancementImage, decodePagePng, assertEnhancementProject, startEnhancement, ENHANCEMENT_MODELS, enhancementAspectRatio } from '../../server/utils/page-enhancement'
import { pgOneOrNull, pgTx } from '../../server/utils/postgres'
import { getS3Client } from '../../server/utils/s3'

const png = (width: number, height: number, pixels: number[]) =>
  sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } }).png().toBuffer()
const maskPng = (width: number, height: number, values: number[]) =>
  png(width, height, values.flatMap(value => [value, value, value, 255]))
const raw = (buffer: Buffer) => sharp(buffer).ensureAlpha().raw().toBuffer()

it('sends the original page proportion to the image API', () => {
  expect(enhancementAspectRatio(1080, 1920)).toBe('9:16')
  expect(enhancementAspectRatio(1080, 1350)).toBe('auto')
  expect(enhancementAspectRatio(1920, 1080)).toBe('16:9')
})

it('keeps the complete edited image in redesign without duplicating commercial overlays', async () => {
  const original = await png(2, 1, [255, 0, 0, 255, 255, 0, 0, 255])
  const generated = await png(2, 1, [0, 200, 0, 255, 0, 0, 200, 255])
  const mask = await maskPng(2, 1, [255, 255])
  expect(await raw(await finalizeEnhancementImage('redesign', original, generated, mask, 2, 1))).toEqual(await raw(generated))
})

beforeEach(() => {
  vi.stubGlobal('createError', (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options))
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected provider/network call') }))
})
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('startEnhancement admission (mock storage/database, no paid calls)', () => {
  const projectId = '11111111-2222-4333-8444-555555555555'
  const userId = 'user-a'
  const ledgerKey = `projects/${userId}/enhancement-ledger.json`
  let objects: Map<string, string | Buffer>
  let send: ReturnType<typeof vi.fn>
  let query: ReturnType<typeof vi.fn>
  const dataUrl = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`
  const bodyFor = async (values = [255, 0]) => ({
    projectId, pageId: 'page-a', model: ENHANCEMENT_MODELS[0], quality: 'medium',
    original: dataUrl(await png(2, 1, [10, 20, 30, 40, 50, 60, 70, 255])),
    mask: dataUrl(await maskPng(2, 1, values))
  })

  beforeEach(() => {
    objects = new Map()
    vi.stubEnv('OPENROUTER_API_KEY', 'test-only-never-sent')
    vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket' }))
    vi.mocked(pgOneOrNull).mockImplementation(async (_sql, params) =>
      params?.[1] === userId ? { canvas_data: [{ id: 'page-a' }] } as never : null)
    query = vi.fn().mockResolvedValue({ rows: [] })
    // Exercises callback logic, not real PostgreSQL lock/concurrency semantics.
    vi.mocked(pgTx).mockImplementation(async callback => callback({ query } as never))
    send = vi.fn(async (command: GetObjectCommand | PutObjectCommand) => {
      const key = command.input.Key!
      if (command instanceof GetObjectCommand) {
        if (!objects.has(key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
        return { Body: { transformToString: async () => objects.get(key)!.toString() } }
      }
      if (command instanceof PutObjectCommand) {
        objects.set(key, command.input.Body as string | Buffer)
        return {}
      }
      throw new Error('Unexpected S3 operation')
    })
    vi.mocked(getS3Client).mockReturnValue({ send } as never)
  })

  it('persists one receipt/attempt and returns no run for an identical submission', async () => {
    const body = await bodyFor()
    const first = await startEnhancement(userId, body)
    expect(first.run).toBeTypeOf('function') // Intentionally never execute a provider job.
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [`${userId}:enhancement`])
    const snapshot = new Map(objects)
    send.mockClear()
    const duplicate = await startEnhancement(userId, body)
    expect(duplicate.run).toBeNull()
    expect(duplicate.receipt).toEqual(first.receipt)
    expect(objects).toEqual(snapshot)
    expect(send.mock.calls.every(([command]) => command instanceof GetObjectCommand)).toBe(true)
    expect(JSON.parse(objects.get(ledgerKey)!.toString()).attempts).toEqual([{ projectId, id: first.receipt.id }])
  })

  it.each([
    ['completed', 0.1, false], ['processing', null, true], ['uncertain', null, true],
    ['failed', 0, false], ['failed', null, true], ['failed', 0.1, true]
  ] as const)('does not rerun existing %s / cost %s / retry %s', async (status, costUsd, retryFailed) => {
    const body = await bodyFor()
    const first = await startEnhancement(userId, body)
    const key = `projects/${userId}/${projectId}/enhancements/${first.receipt.id}/receipt.json`
    const saved = { ...first.receipt, status, costUsd }
    objects.set(key, JSON.stringify(saved))
    const snapshot = new Map(objects)
    expect(await startEnhancement(userId, { ...body, retryFailed })).toEqual({ receipt: saved, run: null })
    expect(objects).toEqual(snapshot)
  })

  it('admits an explicit retry only for a recorded failed zero-cost receipt and counts it', async () => {
    const body = await bodyFor()
    const first = await startEnhancement(userId, body)
    objects.set(`projects/${userId}/${projectId}/enhancements/${first.receipt.id}/receipt.json`,
      JSON.stringify({ ...first.receipt, status: 'failed', costUsd: 0 }))
    const retry = await startEnhancement(userId, { ...body, retryFailed: true })
    expect(retry.run).toBeTypeOf('function')
    expect(retry.receipt).toMatchObject({ id: first.receipt.id, status: 'processing', costUsd: null })
    expect(JSON.parse(objects.get(ledgerKey)!.toString()).attempts).toHaveLength(2)
  })

  it('rejects another user before reading the owner receipt or entering the transaction', async () => {
    const body = await bodyFor()
    await startEnhancement(userId, body)
    const snapshot = new Map(objects)
    send.mockClear()
    vi.mocked(pgTx).mockClear()
    await expect(startEnhancement('user-b', body)).rejects.toMatchObject({ statusCode: 404 })
    expect(pgOneOrNull).toHaveBeenLastCalledWith(expect.any(String), [projectId, 'user-b'])
    expect(pgTx).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(objects).toEqual(snapshot)
  })

  it.each([[255, 255], [0, 0]])('rejects unsafe mask %j before storage, quota reservation or provider dispatch', async (a, b) => {
    await expect(startEnhancement(userId, await bodyFor([a, b]))).rejects.toMatchObject({ statusCode: 422 })
    expect(pgTx).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(objects.size).toBe(0)
  })

  it('rejects a distinct request while an attempt is active without consuming quota', async () => {
    const body = await bodyFor()
    await startEnhancement(userId, body)
    const snapshot = new Map(objects)
    await expect(startEnhancement(userId, { ...body, quality: 'high' })).rejects.toMatchObject({ statusCode: 409 })
    expect(objects).toEqual(snapshot)
  })

  it('rejects stale clients before storage or a paid job', async () => {
    await expect(startEnhancement(userId, {...await bodyFor(), mode: 'redesign'})).rejects.toMatchObject({statusCode:409})
    expect(objects.size).toBe(0)
  })
  it('rejects a mismatched layout guide before any storage write', async () => {
    const guide = dataUrl(await png(1, 1, [10,20,30,255]))
    const overlay = dataUrl(await png(2, 1, [10,20,30,255,0,0,0,0]))
    await expect(startEnhancement(userId, {...await bodyFor(), mode:'redesign',pipelineVersion:'retail-layout-v11',guide,overlay,redesignArea:{left:0,top:0,width:2,height:1}})).rejects.toMatchObject({statusCode:400})
    expect(objects.size).toBe(0)
  })

  it('requires a transparent commercial layer before admitting redesign', async () => {
    const body = {...await bodyFor(), mode: 'redesign', pipelineVersion: 'retail-layout-v11', guide: (await bodyFor()).original, redesignArea: {left:0,top:0,width:2,height:1}}
    await expect(startEnhancement(userId, body)).rejects.toMatchObject({statusCode:400})
    expect(objects.size).toBe(0)
    const overlay = dataUrl(await png(2, 1, [10,20,30,255,0,0,0,0]))
    const first = await startEnhancement(userId, {...body, overlay})
    expect(first.receipt.mode).toBe('redesign')
    expect([...objects.keys()].some(key => key.endsWith('/overlay.png'))).toBe(true)
    const duplicate = await startEnhancement(userId, {...body, overlay})
    expect(duplicate.run).toBeNull()
    expect(duplicate.receipt.id).toBe(first.receipt.id)
  })

  it('admits redesign when its unused mask protects the whole page', async () => {
    const body = await bodyFor([255, 255])
    const overlay = dataUrl(await png(2, 1, [10, 20, 30, 255, 0, 0, 0, 0]))
    const result = await startEnhancement(userId, {
      ...body, mode: 'redesign', pipelineVersion: 'retail-layout-v11',
      guide: body.original, overlay, redesignArea: { left: 0, top: 0, width: 2, height: 1 }
    })
    expect(result.receipt.mode).toBe('redesign')
    expect(result.run).toBeTypeOf('function')
  })

  it('rejects attempt 21 without writing a receipt or changing the ledger', async () => {
    objects.set(ledgerKey, JSON.stringify({ day: new Date().toISOString().slice(0, 10),
      attempts: Array.from({ length: 20 }, () => ({ projectId, id: 'a'.repeat(32) })) }))
    const snapshot = new Map(objects)
    await expect(startEnhancement(userId, await bodyFor())).rejects.toMatchObject({ statusCode: 429 })
    expect(objects).toEqual(snapshot)
  })
})

describe('compositeProtectedPixels (real sharp, no provider)', () => {
  it('preserves exact RGBA at protected coordinates including transparent RGB and partial alpha', async () => {
    const sourcePixels = [19, 71, 133, 0, 201, 9, 85, 1, 31, 211, 97, 127,
      45, 66, 87, 255, 99, 22, 181, 254, 13, 24, 35, 64]
    const generatedPixels = [231, 8, 16, 255, 52, 79, 106, 255, 117, 144, 171, 255,
      182, 209, 236, 255, 247, 18, 45, 255, 56, 83, 110, 255]
    // Both threshold boundaries and coordinates on different rows are deliberate.
    const values = [255, 128, 254, 0, 127, 255]
    const result = await compositeProtectedPixels(await png(3, 2, sourcePixels),
      await png(3, 2, generatedPixels), await maskPng(3, 2, values))
    expect(result).toMatchObject({ width: 3, height: 2, protectedPixels: 4 })
    const decoded = await raw(result.buffer)
    for (let p = 0; p < values.length; p++) {
      const expected = values[p]! >= 128 ? sourcePixels : generatedPixels
      expect([...decoded.subarray(p * 4, p * 4 + 4)], `pixel ${p}`).toEqual(expected.slice(p * 4, p * 4 + 4))
    }
    expect((await sharp(result.buffer).metadata()).format).toBe('png')
  })

  it.each([[1, 1], [8, 6]])('resizes generated %ix%i image to original dimensions before restoring protection', async (width, height) => {
    const source = [11, 22, 33, 17, 44, 55, 66, 0, 77, 88, 99, 128, 100, 111, 122, 255, 133, 144, 155, 254, 166, 177, 188, 1]
    const color = [210, 120, 30, 255]
    const result = await compositeProtectedPixels(await png(3, 2, source),
      await png(width, height, Array.from({ length: width * height }, () => color).flat()),
      await maskPng(3, 2, [0, 255, 0, 0, 0, 255]))
    expect(result).toMatchObject({ width: 3, height: 2, protectedPixels: 2 })
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 3, height: 2, channels: 4 })
    expect([...await raw(result.buffer)]).toEqual([...color, ...source.slice(4, 8), ...color, ...color, ...color, ...source.slice(20, 24)])
  })

  it.each([[2, 3], [3, 1], [1, 2]])('rejects a %ix%i mask for a 3x2 source (including equal pixel counts)', async (width, height) => {
    const original = await png(3, 2, Array(24).fill(255))
    await expect(compositeProtectedPixels(original, original,
      await maskPng(width, height, Array(width * height).fill(255)))).rejects.toThrow('mask_dimension_mismatch')
  })

  it.each(['original', 'generated', 'mask'])('rejects undecodable %s image bytes', async position => {
    const valid = await png(1, 1, [1, 2, 3, 255])
    const invalid = Buffer.from('not an image')
    await expect(compositeProtectedPixels(position === 'original' ? invalid : valid,
      position === 'generated' ? invalid : valid, position === 'mask' ? invalid : valid)).rejects.toThrow()
  })
})

describe('decodePagePng data URL schema', () => {
  it('decodes a real PNG without changing its bytes', async () => {
    const original = await png(1, 1, [12, 34, 56, 78])
    expect(decodePagePng(`data:image/png;base64,${original.toString('base64')}`)).toEqual(original)
  })
  it.each([undefined, null, 12, {}, '', 'data:image/png;base64,', 'data:image/jpeg;base64,YWJj',
    'data:image/png,YWJj', 'data:image/png;base64,@@@', 'data:image/png;base64,YW Jj', 'YWJj'])('rejects malformed schema %# with HTTP 400', value => {
    expect(() => decodePagePng(value)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
  it('rejects input exceeding the encoded size cap', () => {
    expect(() => decodePagePng('data:image/png;base64,' + 'A'.repeat(24_000_000)))
      .toThrow(expect.objectContaining({ statusCode: 400 }))
  })
  it('rejects non-PNG content disguised as a PNG data URL', () => {
    expect(() => decodePagePng(`data:image/png;base64,${Buffer.from('not PNG').toString('base64')}`)).toThrow()
  })
})

describe('project ownership guard', () => {
  const projectId = '11111111-2222-4333-8444-555555555555'
  it('scopes lookup to the authenticated user and hides missing or foreign projects', async () => {
    vi.mocked(pgOneOrNull).mockResolvedValue(null)
    await expect(assertEnhancementProject('user-a', projectId, 'page-a')).rejects.toMatchObject({ statusCode: 404 })
    expect(pgOneOrNull).toHaveBeenCalledWith('SELECT canvas_data FROM projects WHERE id=$1 AND user_id=$2', [projectId, 'user-a'])
  })
  it('rejects a page outside the saved project', async () => {
    vi.mocked(pgOneOrNull).mockResolvedValue({ canvas_data: [{ id: 'page-a' }] })
    await expect(assertEnhancementProject('user-a', projectId, 'page-b')).rejects.toMatchObject({ statusCode: 400 })
  })
})


describe('redesign commercial overlay', () => {
  it('preserves opaque product pixels and replaces transparent card backgrounds', async () => {
    const overlay = await png(2, 1, [10,20,30,255, 200,100,50,0])
    const generated = await png(2, 1, [90,80,70,255, 60,50,40,255])
    expect([...await raw(await compositeCommercialOverlay(generated, overlay, 2, 1))]).toEqual([10,20,30,255,60,50,40,255])
  })
  it('rejects an overlay with different dimensions', async () => {
    const image = await png(1, 1, [10,20,30,255])
    await expect(compositeCommercialOverlay(image, image, 2, 1)).rejects.toThrow('inválida')
  })
  it('uses the generated design throughout the page while preserving commercial pixels', async () => {
    const original = await png(1, 3, [10,20,30,255, 20,30,40,255, 30,40,50,255])
    const generated = await png(1, 3, [90,90,90,255, 80,80,80,255, 70,70,70,255])
    const overlay = await png(1, 3, [0,0,0,0, 200,100,50,255, 0,0,0,0])
    const result = await compositeCommercialOverlay(generated, overlay, 1, 3, original, {left:0,top:1,width:1,height:1})
    expect([...await raw(result)]).toEqual([90,90,90,255, 200,100,50,255, 70,70,70,255])
  })
  it('does not stretch one small strip over every product cell', async () => {
    const original = await png(2, 5, Array.from({length:10},()=>[10,10,10,255]).flat())
    const generated = await png(2, 5, [
      ...Array.from({length:2},()=>[180,20,10,255]).flat(),
      ...Array.from({length:8},()=>[20,20,180,255]).flat()
    ])
    const overlay = await png(2, 5, Array.from({length:10},()=>[0,0,0,0]).flat())
    const result = await compositeCommercialOverlay(generated, overlay, 2, 5, original, {left:0,top:1,width:2,height:4})
    const pixels = [...await raw(result)]
    expect(pixels.slice(0,8)).toEqual([180,20,10,255,180,20,10,255])
    expect(pixels.slice(8,16)).toEqual([20,20,180,255,20,20,180,255])
  })
})
