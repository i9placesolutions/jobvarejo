import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), ensure: vi.fn(), param: vi.fn(), query: vi.fn(), header: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.mock('../../server/utils/label-catalog-preview', () => ({ ensureLabelCatalogPreview: mocks.ensure }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRouterParam', mocks.param)
vi.stubGlobal('getQuery', mocks.query)
vi.stubGlobal('setResponseHeader', mocks.header)
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { default: handler } = await import('../../server/api/label-templates/[id]/preview.get')

describe('GET /api/label-templates/:id/preview metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'account-a' })
    mocks.limit.mockResolvedValue(undefined)
    mocks.param.mockReturnValue('built-in-label')
    mocks.query.mockReturnValue({})
    mocks.ensure.mockResolvedValue({ url: 'https://signed.example/private.webp', revision: 'rev-a' })
  })

  it('autentica antes de rate limit, source lookup ou acesso ao preview', async () => {
    mocks.auth.mockRejectedValue(new Error('unauthenticated'))

    await expect(handler({} as any)).rejects.toThrow('unauthenticated')

    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('valida o ID e devolve URL privada assinada com a revisão da arte', async () => {
    const result = await handler({} as any)

    expect(result).toEqual({ url: 'https://signed.example/private.webp', revision: 'rev-a' })
    expect(mocks.limit).toHaveBeenCalledWith({}, 'label-template-preview:account-a', 120, 60_000)
    expect(mocks.ensure).toHaveBeenCalledWith('account-a', 'built-in-label', false)
    expect(mocks.header).toHaveBeenCalledWith({}, 'Cache-Control', 'private, no-store')
  })

  it('propaga a variante recortada solicitada pelo cliente sem mudar o padrão dos demais consumidores', async () => {
    mocks.query.mockReturnValue({ crop: '1' })

    await handler({} as any)

    expect(mocks.ensure).toHaveBeenCalledWith('account-a', 'built-in-label', true)
  })

  it('rejeita IDs inválidos antes de consultar catálogo ou armazenamento', async () => {
    mocks.param.mockReturnValue('../foreign-label')

    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })

    expect(mocks.ensure).not.toHaveBeenCalled()
  })
})
