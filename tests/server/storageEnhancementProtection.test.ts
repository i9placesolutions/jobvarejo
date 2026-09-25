import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { isServerManagedStorageKey, assertClientStorageReadAllowed } from '../../server/utils/storage-scope'

const mocks = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn(), body: vi.fn(), query: vi.fn(), project: vi.fn() }))
vi.mock('@aws-sdk/client-s3', async importOriginal => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>()
  return { ...actual, S3Client: class { send = mocks.send } }
})
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.sign }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: async () => ({ id: 'owner' }), requireAdminUser: async () => ({ user: { id: 'owner' } }) }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: mocks.send }), resetS3Client: vi.fn() }))
vi.mock('../../server/utils/s3-object-cache', () => ({ recordUploadedS3Object: vi.fn() }))
vi.mock('../../server/utils/project-repository', () => ({ getOwnedProjectStorageRow: mocks.project, updateOwnedProjectCanvasData: vi.fn() }))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
const { default: presign } = await import('../../server/api/storage/presigned.post')
const { default: upload } = await import('../../server/api/storage/upload.post')
const { default: removeAsset } = await import('../../server/api/assets/delete.post')
const { default: removePrefix } = await import('../../server/api/storage/delete.post')
const { default: restore } = await import('../../server/api/storage/restore.post')
const { default: recover } = await import('../../server/api/storage/recover-latest-non-empty.post')
const { default: cleanup } = await import('../../server/api/storage/versions-cleanup.post')

const ledger = 'projects/owner/enhancement-ledger.json'
const receipt = 'projects/owner/project/enhancements/abc/receipt.json'
const result = 'projects/owner/project/enhancements/abc/result.png'
const canvas = 'projects/owner/project/page_page.json'
const event = {} as any

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
  vi.stubGlobal('readBody', mocks.body)
  vi.stubGlobal('getQuery', mocks.query)
  vi.stubGlobal('getHeader', () => undefined)
  vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test', wasabiEndpoint: 'test.invalid', wasabiAccessKey: 'test', wasabiSecretKey: 'test' }))
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden') }))
  vi.stubEnv('WASABI_BUCKET', 'test')
  vi.stubEnv('WASABI_ACCESS_KEY', 'test')
  vi.stubEnv('WASABI_SECRET_KEY', 'test')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  mocks.sign.mockResolvedValue('https://test.invalid/read')
  mocks.project.mockResolvedValue({ user_id: 'owner', canvas_data: [{ id: 'page', canvasDataPath: receipt }] })
})
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('server-managed enhancement storage boundaries', () => {
  it('allows owner-scoped previews of corrected results while keeping intermediate files private', () => {
    expect(() => assertClientStorageReadAllowed(result.replace('result.png', 'result-v4.png'))).not.toThrow()
    expect(() => assertClientStorageReadAllowed(result.replace('result.png', 'generated.png'))).toThrow()
  })
  it.each([ledger, receipt, result])('blocks upload, presigned PUT and asset deletion of %s', async key => {
    mocks.body.mockResolvedValue({ key, operation: 'put' })
    mocks.query.mockReturnValue({ key })
    for (const handler of [presign, upload, removeAsset]) {
      await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
    }
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it('preserves owner-authenticated GET for results while refusing another owner', async () => {
    mocks.body.mockResolvedValue({ key: result, operation: 'get' })
    await presign(event)
    expect(mocks.sign.mock.calls[0]![1]).toBeInstanceOf(GetObjectCommand)
    expect(mocks.sign.mock.calls[0]![1].input.Key).toBe(result)
    mocks.sign.mockClear()
    mocks.body.mockResolvedValue({ key: result.replace('/owner/', '/other/'), operation: 'get' })
    await expect(presign(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it('still permits normal canvas PUT signing', async () => {
    mocks.body.mockResolvedValue({ key: canvas, operation: 'put' })
    await presign(event)
    expect(mocks.sign.mock.calls[0]![1].input.Key).toBe(canvas)
  })

  it.each(['projects/owner/', 'projects/owner/project/', 'projects/owner/enhancement-ledger', 'projects/owner/project/enhance'])('preserves protected objects in bulk delete through prefix %s', async prefix => {
    mocks.body.mockResolvedValue({ prefix })
    const keys = [ledger, receipt, result, canvas].filter(key => key.startsWith(prefix))
    mocks.send.mockImplementation(async command => {
      if (command instanceof ListObjectsV2Command) return { Contents: keys.map(Key => ({ Key })) }
      if (command instanceof DeleteObjectsCommand) return { Deleted: command.input.Delete?.Objects }
      throw new Error('Unexpected command')
    })
    await removePrefix(event)
    const deleted = mocks.send.mock.calls.filter(([cmd]) => cmd instanceof DeleteObjectsCommand)
      .flatMap(([cmd]) => cmd.input.Delete.Objects.map((object: any) => object.Key))
    expect(deleted).toEqual(keys.filter(key => key === canvas))
  })

  it('blocks direct deletion of the protected prefix', async () => {
    mocks.body.mockResolvedValue({ prefix: 'projects/owner/project/enhancements/' })
    await expect(removePrefix(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('blocks restore into a protected canvasDataPath supplied through project metadata', async () => {
    mocks.body.mockResolvedValue({ projectId: 'project', pageId: 'page', source: { kind: 'current', key: canvas } })
    await expect(restore(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it.each([ledger, receipt])('blocks recovery into %s', async preferredKey => {
    mocks.body.mockResolvedValue({ projectId: 'project', pageId: 'page', preferredKey })
    await expect(recover(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('excludes protected versions from destructive admin cleanup', async () => {
    mocks.body.mockResolvedValue({ prefix: 'projects/', dryRun: false, keepLatestN: 1, olderThanDays: 1 })
    mocks.send.mockResolvedValue({ Versions: [ledger, receipt, result].flatMap(Key =>
      [1, 2, 3].map(n => ({ Key, VersionId: String(n), LastModified: new Date('2020-01-01'), Size: 50, IsLatest: n === 1 }))) })
    await cleanup(event)
    expect(mocks.send.mock.calls.some(([cmd]) => cmd instanceof DeleteObjectsCommand)).toBe(false)
  })

  it('does not reserve ordinary canvas, history, thumbnails or public assets', () => {
    for (const key of [canvas, 'projects/owner/project/history/page_page/v1.json',
      'projects/owner/project/thumb_page.png', 'imagens/enhancements.png', 'projects/owner/project/enhancements-draft.json']) {
      expect(isServerManagedStorageKey(key)).toBe(false)
    }
  })
})
