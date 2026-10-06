import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), preview: vi.fn(), params: vi.fn(), query: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.mock('../../server/utils/project-catalog-preview', () => ({ getProjectCatalogPreview: mocks.preview }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRouterParam', mocks.params)
vi.stubGlobal('getQuery', mocks.query)
vi.stubGlobal('setResponseHeader', (event: any, name: string, value: string) => {
  event.responseHeaders ||= {}
  event.responseHeaders[name] = value
})
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { default: handler } = await import('../../server/api/projects/[id]/preview.get')

describe('GET /api/projects/:id/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'requester-a' })
    mocks.limit.mockResolvedValue(undefined)
    mocks.params.mockReturnValue('10000000-0000-4000-8000-000000000001')
    mocks.query.mockReturnValue({})
    mocks.preview.mockResolvedValue({ url: '/signed-preview', revision: 'rev-1' })
  })

  it('authenticates before rate limiting or access to any catalog source', async () => {
    mocks.auth.mockRejectedValue(new Error('unauthorized'))
    await expect(handler({} as any)).rejects.toThrow('unauthorized')
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.preview).not.toHaveBeenCalled()
  })

  it('returns the shared JSON contract and disables intermediary caching', async () => {
    const event: any = {}
    const result = await handler(event)
    expect(result).toEqual({ url: '/signed-preview', revision: 'rev-1' })
    expect(mocks.preview).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', { id: 'requester-a' }, false)
    expect(event.responseHeaders).toEqual({
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Authorization'
    })
  })

  it('accepts personalization only as a server-side session option', async () => {
    mocks.query.mockReturnValue({ personalize: '1' })
    await handler({} as any)
    expect(mocks.preview).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', { id: 'requester-a' }, true)
  })
})
