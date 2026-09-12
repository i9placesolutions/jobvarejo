import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), list: vi.fn(), db: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: async () => ({ id: 'user-1' }) }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.db }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({}), getPublicUrl: (key: string) => `https://storage.test/${key}` }))
vi.mock('../../server/utils/s3-object-cache', () => ({ getCachedS3Objects: mocks.list }))
vi.mock('../../server/utils/project-storage-refs', () => ({ resolveStorageReadUrl: async (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}` }))
vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('getQuery', mocks.query)
vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'test', wasabiEndpoint: 'storage.test' }))
vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
const { default: handler } = await import('../../server/api/assets.get')

const originalKeys = [
  'imagens/cerveja-original-269ml-lt-vWcHjBAU.png',
  'imagens/manual-300ml-antarctica-cerveja-gf-original-d0e5222ce708-v2.webp',
  'imagens/manual-600-antarctica-cerveja-garrafa-ml-original-0ae0d8ab2c4f-v2.webp'
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.mockResolvedValue({ rows: [] })
  mocks.query.mockReturnValue({ q: 'CERVEJA ORIGINAL', limit: 120, ai: '0', expand: '0', includeCache: '0' })
  mocks.list.mockResolvedValue(originalKeys.map(key => ({ key })))
})

describe('busca manual de imagens salvas', () => {
  it('encontra os arquivos reais com hífens e palavras intercaladas', async () => {
    const results: any = await handler({} as any)
    expect(results.map((asset: any) => asset.key)).toEqual(expect.arrayContaining(originalKeys))
    expect(results).toHaveLength(3)
    expect(results[0].key).toBe(originalKeys[0])
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: false }))
    expect(results.every((asset: any) => asset.source === 's3')).toBe(true)
  })

  it('mantém atualização explícita disponível sem forçá-la em toda busca', async () => {
    mocks.query.mockReturnValue({ q: 'CERVEJA ORIGINAL', ai: '0', includeCache: '0', fresh: '1' })
    await handler({} as any)
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }))
  })
})
