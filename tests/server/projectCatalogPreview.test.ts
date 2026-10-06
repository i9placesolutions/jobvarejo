import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  s3Send: vi.fn(),
  readUrl: vi.fn(),
  render: vi.fn()
}))

vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.query }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.s3Send }) }))
vi.mock('../../server/utils/project-storage-refs', () => ({ resolveStorageReadUrl: mocks.readUrl }))
vi.mock('../../server/utils/catalog-preview-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/catalog-preview-renderer')>()
  return { ...actual, renderCatalogPreview: mocks.render }
})
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))
vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test-bucket', wasabiEndpoint: 's3.wasabisys.com' }))
// Estes cenários verificam a fila com uma vaga só; o padrão (2) é coberto no teste do renderer.
process.env.CATALOG_PREVIEW_CONCURRENCY = '1'

const { getProjectCatalogPreview } = await import('../../server/utils/project-catalog-preview')
const { getCatalogPreviewRendererPolicy, runCatalogPreviewTask, resolveCatalogStorageKey } = await import('../../server/utils/catalog-preview-renderer')

const id = () => `10000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
const projectRow = (projectId: string): any => ({
  id: projectId,
  user_id: '20000000-0000-4000-8000-000000000001',
  name: 'Modelo compartilhado',
  is_template: true,
  updated_at: new Date('2026-10-05T10:00:00.000Z'),
  canvas_data: { pages: [] },
  template_config: {},
  owner_role: 'admin'
})
const sourceRevisionHash = (row: ReturnType<typeof projectRow>) => createHash('sha256')
  .update(`${new Date(row.updated_at).toISOString()}\ncatalog-preview-v1`)
  .digest('hex')
const cacheHeadFor = (row: ReturnType<typeof projectRow>) => ({
  ContentLength: 12,
  ContentType: 'image/webp',
  Metadata: {
    'renderer-policy': getCatalogPreviewRendererPolicy(),
    'source-revision': sourceRevisionHash(row),
    sha256: 'a'.repeat(64)
  }
})

describe('project catalog preview server renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query.mockImplementation(async () => projectRow(id()))
    mocks.readUrl.mockImplementation(async (key: string) => `/api/storage/proxy?key=${encodeURIComponent(key)}`)
    mocks.render.mockResolvedValue(Buffer.from('rendered'))
  })

  it('returns a validated cache hit while the single native renderer slot is blocked', async () => {
    const projectId = id()
    const row = projectRow(projectId)
    mocks.query.mockResolvedValue(row)
    mocks.s3Send.mockResolvedValue(cacheHeadFor(row))
    let release!: () => void
    const blocker = runCatalogPreviewTask(`blocked:${projectId}`, () => new Promise<void>((resolve) => { release = resolve }))
    try {
      const result = await getProjectCatalogPreview(projectId, { id: 'viewer-1' })
      expect(result).toMatchObject({ revision: '2026-10-05T10:00:00.000Z' })
      expect(result.url).toContain('/api/storage/proxy?key=')
      expect(mocks.render).not.toHaveBeenCalled()
      expect(mocks.s3Send).toHaveBeenCalledTimes(1)
    } finally {
      release()
      await blocker
    }
  })

  it('keeps project image reads within owner/public storage policy', () => {
    expect(resolveCatalogStorageKey('projects/owner-a/project/pages/file.png', 'owner-a', 'flyer'))
      .toBe('projects/owner-a/project/pages/file.png')
    expect(resolveCatalogStorageKey('imagens/shared.png', 'owner-a', 'flyer')).toBe('imagens/shared.png')
    expect(resolveCatalogStorageKey('owner-a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pages/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/asset.png', 'owner-a', 'flyer'))
      .toBe('owner-a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pages/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/asset.png')
    expect(resolveCatalogStorageKey(
      '/api/storage/p?key=eb847e8e-7c19-4bee-8042-376528ce6192%2F3332dded-8ac7-4ade-b4df-2369caaa378c%2Fassets%2Fart.png&bucket=jobvarejo',
      'eb847e8e-7c19-4bee-8042-376528ce6192',
      'flyer'
    )).toBe('eb847e8e-7c19-4bee-8042-376528ce6192/3332dded-8ac7-4ade-b4df-2369caaa378c/assets/art.png')
    expect(() => resolveCatalogStorageKey('projects/owner-b/project/pages/file.png', 'owner-a', 'flyer'))
      .toThrow('fora do escopo')
    expect(() => resolveCatalogStorageKey('templates/unique-campaigns/image.png', 'owner-a', 'flyer'))
      .toThrow('fora do escopo')
    expect(resolveCatalogStorageKey('templates/unique-campaigns/image.png', 'admin-owner', 'flyer', true))
      .toBe('templates/unique-campaigns/image.png')
    expect(resolveCatalogStorageKey('/api/storage/?key=templates%2Funique-campaigns%2Fimage.png', 'admin-owner', 'flyer', true))
      .toBe('templates/unique-campaigns/image.png')
    expect(resolveCatalogStorageKey(
      '/api/storage/p?key=video-studio%2Fcatalog%2F07c35cb1e133e9892ca1430f196449c92ec0c656b39d1f31e894af48188c6814%2Ftemplates%2Fcatalog%2Freference-20261004-33.png&bucket=jobvarejo',
      'admin-owner',
      'flyer',
      true
    )).toBe('video-studio/catalog/07c35cb1e133e9892ca1430f196449c92ec0c656b39d1f31e894af48188c6814/templates/catalog/reference-20261004-33.png')
    expect(() => resolveCatalogStorageKey('templates/unique-campaigns/image.png', 'owner-a', 'label', false))
      .toThrow('fora do escopo')
  })

  it('rejects a non-owner before reading cache or storage', async () => {
    mocks.query.mockResolvedValue(null)
    await expect(getProjectCatalogPreview(id(), { id: 'requester-not-owner' }))
      .rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.s3Send).not.toHaveBeenCalled()
    expect(mocks.render).not.toHaveBeenCalled()
  })

  it('keeps personalized previews private and keyed to the authenticated profile', async () => {
    const projectId = id()
    const row = projectRow(projectId)
    mocks.query.mockImplementation(async (sql: string, params: any[]) => (
      sql.includes('business_profile')
        ? { id: params[0], updated_at: new Date('2026-10-05T09:00:00.000Z'), business_profile: { logoPreference: { outline: true } } }
        : row
    ))
    mocks.s3Send.mockResolvedValue(cacheHeadFor(row))

    await getProjectCatalogPreview(projectId, { id: 'requester-a' }, true)
    await getProjectCatalogPreview(projectId, { id: 'requester-b' }, true)

    const keys = mocks.readUrl.mock.calls.map(([key, , options]) => {
      expect(options).toEqual({ direct: true })
      return String(key)
    })
    expect(keys).toHaveLength(2)
    expect(keys[0]).toContain('projects/requester-a/catalog-previews/flyers/')
    expect(keys[1]).toContain('projects/requester-b/catalog-previews/flyers/')
    expect(keys[0]).not.toBe(keys[1])
    expect(mocks.render).not.toHaveBeenCalled()
  })

  it('coalesces concurrent requests for the same shared template artifact across viewers', async () => {
    const projectId = id()
    const row = {
      ...projectRow(projectId),
      canvas_data: [{ id: 'page-1', width: 320, height: 240, canvasData: { version: '7.0', objects: [] } }]
    }
    mocks.query.mockResolvedValue(row)
    let objectReady = false
    const rendered = Buffer.from('rendered')
    const renderedHash = createHash('sha256').update(rendered).digest('hex')
    mocks.s3Send.mockImplementation(async (command: any) => {
      const name = command?.constructor?.name
      if (name === 'HeadObjectCommand') {
        if (!objectReady) throw { name: 'NotFound', $metadata: { httpStatusCode: 404 } }
        return {
          ContentLength: rendered.length,
          ContentType: 'image/webp',
          Metadata: {
            'renderer-policy': getCatalogPreviewRendererPolicy(),
            'source-revision': sourceRevisionHash(row),
            sha256: renderedHash
          }
        }
      }
      if (name === 'PutObjectCommand') {
        objectReady = true
        return {}
      }
      if (name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => rendered } }
      throw new Error(`Unexpected S3 command ${name}`)
    })

    const results = await Promise.all([
      getProjectCatalogPreview(projectId, { id: 'viewer-a' }),
      getProjectCatalogPreview(projectId, { id: 'viewer-b' })
    ])
    expect(results[0]?.url).toBe(results[1]?.url)
    expect(mocks.render).toHaveBeenCalledTimes(1)
    expect(mocks.readUrl).toHaveBeenCalledTimes(1)
    expect(String(mocks.readUrl.mock.calls[0]?.[0])).toContain(`imagens/catalogo-encartes/runtime-v1/${projectId}/`)
  })

  it('coalesces duplicate catalog work and enforces concurrency one', async () => {
    let release!: () => void
    let active = 0
    let peak = 0
    let runs = 0
    const task = async () => {
      runs += 1
      active += 1
      peak = Math.max(peak, active)
      await new Promise<void>((resolve) => { release = resolve })
      active -= 1
      return 'ready'
    }
    const sameKey = `singleflight:${id()}`
    const first = runCatalogPreviewTask(sameKey, task)
    const duplicate = runCatalogPreviewTask(sameKey, task)
    // Distinct work waits behind the first native task.
    const waitingKey = `queued:${id()}`
    const waiting = runCatalogPreviewTask(waitingKey, async () => {
      runs += 1
      active += 1
      peak = Math.max(peak, active)
      active -= 1
      return 'queued'
    })
    await Promise.resolve()
    expect(active).toBe(1)
    release()
    const [firstResult, duplicateResult, waitingResult] = await Promise.all([first, duplicate, waiting])
    expect(firstResult).toBe('ready')
    expect(duplicateResult).toBe('ready')
    expect(waitingResult).toBe('queued')
    expect(runs).toBe(2)
    expect(peak).toBe(1)
  })

  it('revalidates revision after waiting for the single native slot', async () => {
    const projectId = id()
    const original = projectRow(projectId)
    mocks.query.mockResolvedValueOnce(original).mockResolvedValueOnce({
      ...original,
      updated_at: new Date('2026-10-05T10:01:00.000Z')
    })
    mocks.s3Send.mockRejectedValue({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })
    let release!: () => void
    const blocker = runCatalogPreviewTask(`revision-blocker:${projectId}`, () => new Promise<void>((resolve) => { release = resolve }))
    const preview = getProjectCatalogPreview(projectId, { id: 'viewer-a' })
    await vi.waitFor(() => expect(mocks.s3Send).toHaveBeenCalled())
    release()
    await expect(preview).rejects.toMatchObject({ statusCode: 409 })
    await blocker
    expect(mocks.render).not.toHaveBeenCalled()
  })

})
