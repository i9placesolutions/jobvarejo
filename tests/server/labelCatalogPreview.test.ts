import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  send: vi.fn(),
  render: vi.fn(),
  signed: vi.fn(),
  runTask: vi.fn(),
  legacyError: false,
  sourceOverrides: new Map<string, any>(),
  objects: new Map<string, any>(),
  queueBlocked: false,
  taskPromises: new Map<string, Promise<any>>()
}))

vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.query }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }) }))
vi.mock('../../server/utils/catalog-preview-renderer', () => ({
  getCatalogPreviewRendererPolicy: () => 'catalog-preview-test-policy',
  renderCatalogPreview: mocks.render,
  runCatalogPreviewTask: mocks.runTask
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.signed }))
vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'private-assets' }))
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const {
  ensureLabelCatalogPreview,
  getAuthorizedLabelPreviewSource,
  getLabelPreviewRevision
} = await import('../../server/utils/label-catalog-preview')

const row = (owner: string | null, groupValue: string = 'one') => ({
  id: owner ? `db-${owner}-label` : 'global-label',
  public_id: 'same-label-id',
  user_id: owner,
  kind: 'priceGroup-v1',
  group: { type: 'group', objects: [{ type: 'text', text: groupValue }] }
})

describe('server label catalog previews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.legacyError = false
    mocks.sourceOverrides.clear()
    mocks.objects.clear()
    mocks.queueBlocked = false
    mocks.taskPromises.clear()

    mocks.query.mockImplementation(async (sql: string, params: any[]) => {
      if (mocks.legacyError && sql.includes('coalesce(template_key, id)')) {
        mocks.legacyError = false
        throw Object.assign(new Error('column template_key does not exist'), { code: '42703' })
      }
      const [requesterId, templateId] = params
      return mocks.sourceOverrides.get(`${requesterId}:${templateId}`) ?? null
    })
    mocks.send.mockImplementation(async (command: any) => {
      const key = command.input.Key
      if (command instanceof HeadObjectCommand) {
        const stored = mocks.objects.get(key)
        if (!stored) throw Object.assign(new Error('missing'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } })
        return { ContentLength: stored.body.length, Metadata: stored.metadata }
      }
      if (command instanceof PutObjectCommand) {
        mocks.objects.set(key, { body: Buffer.from(command.input.Body as Buffer), metadata: command.input.Metadata })
        return {}
      }
      throw new Error(`Unexpected S3 command: ${command.constructor.name}`)
    })
    mocks.render.mockResolvedValue(Buffer.from('server-webp-preview'))
    mocks.signed.mockImplementation(async (_client: unknown, command: any) =>
      `https://signed.example/${command.input.Key}?expires=600`
    )
    mocks.runTask.mockImplementation((key: string, task: () => Promise<any>) => {
      if (mocks.queueBlocked) return new Promise(() => {})
      const existing = mocks.taskPromises.get(key)
      if (existing) return existing
      const pending = Promise.resolve().then(task).finally(() => mocks.taskPromises.delete(key))
      mocks.taskPromises.set(key, pending)
      return pending
    })
  })

  it('nega uma etiqueta de outra conta antes de acessar S3', async () => {
    mocks.sourceOverrides.set('requester-a:foreign-label', null)

    await expect(ensureLabelCatalogPreview('requester-a', 'foreign-label')).rejects.toMatchObject({ statusCode: 404 })

    const [sql, params] = mocks.query.mock.calls[0]!
    expect(sql).toContain('coalesce(template_key, id) = $2')
    expect(sql).toContain('(user_id = $1 or user_id is null)')
    expect(params).toEqual(['requester-a', 'foreign-label'])
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.render).not.toHaveBeenCalled()
  })

  it('isola a mesma etiqueta por requester e permite fonte global autorizada', async () => {
    mocks.sourceOverrides.set('requester-a:same-label-id', row('requester-a'))
    mocks.sourceOverrides.set('requester-b:same-label-id', row('requester-b'))
    mocks.sourceOverrides.set('requester-c:same-label-id', row(null))

    const [personalA, personalB, global] = await Promise.all([
      ensureLabelCatalogPreview('requester-a', 'same-label-id'),
      ensureLabelCatalogPreview('requester-b', 'same-label-id'),
      ensureLabelCatalogPreview('requester-c', 'same-label-id')
    ])

    expect(personalA.revision).not.toBe(personalB.revision)
    expect(personalA.url).not.toBe(personalB.url)
    expect(mocks.signed).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 600 })
    expect(global.revision).not.toBe(personalA.revision)
    expect([...mocks.objects.keys()]).toEqual(expect.arrayContaining([
      expect.stringMatching(/^projects\/requester-a\/catalog-previews\/labels\//),
      expect.stringMatching(/^projects\/requester-b\/catalog-previews\/labels\//),
      expect.stringMatching(/^projects\/requester-c\/catalog-previews\/labels\//)
    ]))
    expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ kind: 'label', sourceOwnerId: null }))
  })

  it('coalesces one revision, changes key on edit and serves HEAD hits outside a blocked render queue', async () => {
    const initial = row('requester-a', 'initial-coalesced-preview')
    mocks.sourceOverrides.set('requester-a:same-label-id', initial)

    const concurrent = await Promise.all([
      ensureLabelCatalogPreview('requester-a', 'same-label-id'),
      ensureLabelCatalogPreview('requester-a', 'same-label-id')
    ])
    expect(concurrent[0]).toEqual(concurrent[1])
    expect(mocks.render).toHaveBeenCalledTimes(1)

    mocks.queueBlocked = true
    await expect(ensureLabelCatalogPreview('requester-a', 'same-label-id'))
      .resolves.toMatchObject({ revision: concurrent[0]!.revision })
    expect(mocks.render).toHaveBeenCalledTimes(1)
    mocks.queueBlocked = false

    mocks.sourceOverrides.set('requester-a:same-label-id', row('requester-a', 'two'))
    const edited = await ensureLabelCatalogPreview('requester-a', 'same-label-id')
    expect(edited.revision).not.toBe(concurrent[0]!.revision)
    expect(mocks.render).toHaveBeenCalledTimes(2)
  })

  it('supports deployments without template_key while retaining owner scoping', async () => {
    const legacy = { ...row('requester-a'), id: 'legacy-label', public_id: 'legacy-label' }
    mocks.legacyError = true
    mocks.query.mockImplementationOnce(async () => {
      throw Object.assign(new Error('column template_key does not exist'), { code: '42703' })
    }).mockResolvedValueOnce(legacy)

    await expect(getAuthorizedLabelPreviewSource('requester-a', 'legacy-label')).resolves.toMatchObject({
      public_id: 'legacy-label',
      user_id: 'requester-a'
    })
    const [legacySql, params] = mocks.query.mock.calls[1]!
    expect(legacySql).toContain('where id = $2')
    expect(legacySql).toContain('(user_id = $1 or user_id is null)')
    expect(params).toEqual(['requester-a', 'legacy-label'])
  })

  it('returns 409 on stale queued revisions rather than waiting on its own queue slot', async () => {
    const original = row('requester-a', 'before')
    mocks.sourceOverrides.set('requester-a:same-label-id', original)
    let calls = 0
    mocks.query.mockImplementation(async () => {
      calls += 1
      return calls === 1 ? original : row('requester-a', 'after')
    })

    await expect(ensureLabelCatalogPreview('requester-a', 'same-label-id')).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.render).not.toHaveBeenCalled()
  })

  it('uses a deterministic revision hash for the complete rendered source', () => {
    expect(getLabelPreviewRevision(row('requester-a'))).toBe(getLabelPreviewRevision(row('requester-a')))
    expect(getLabelPreviewRevision(row('requester-a'))).not.toBe(getLabelPreviewRevision(row('requester-a', 'changed')))
  })

  it('stores a separately keyed alpha-cropped variant with the artwork bounds ratio', async () => {
    const sharp = (await import('sharp')).default
    const width = 320
    const height = 160
    const pixels = Buffer.alloc(width * height * 4)
    for (let y = 20; y < 140; y += 1) {
      for (let x = 40; x < 280; x += 1) {
        const index = (y * width + x) * 4
        pixels[index] = 230
        pixels[index + 1] = 29
        pixels[index + 2] = 72
        pixels[index + 3] = 255
      }
    }
    const sourceImage = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer()
    const source = row('requester-crop', 'cropped-artwork')
    mocks.sourceOverrides.set('requester-crop:same-label-id', source)
    mocks.render.mockResolvedValue(sourceImage)

    const cropped = await ensureLabelCatalogPreview('requester-crop', 'same-label-id', true)
    const full = await ensureLabelCatalogPreview('requester-crop', 'same-label-id', false)
    const [croppedObject] = [...mocks.objects.entries()].filter(([key]) => key.includes(cropped.revision))
    const [fullObject] = [...mocks.objects.entries()].filter(([key]) => key.includes(full.revision))
    const croppedMetadata = await sharp(croppedObject![1].body).metadata()
    const fullMetadata = await sharp(fullObject![1].body).metadata()

    expect(cropped.revision).not.toBe(full.revision)
    expect(cropped.url).not.toBe(full.url)
    expect(croppedMetadata).toMatchObject({ width: 240, height: 120 })
    expect(fullMetadata).toMatchObject({ width, height, hasAlpha: true })
    expect(croppedMetadata.width! / croppedMetadata.height!).toBe(2)
  })
})
