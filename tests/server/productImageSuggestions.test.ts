import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ search: vi.fn(), auth: vi.fn(), limit: vi.fn(), body: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.mock('../../server/utils/product-image-chromium', () => ({ searchChromiumImageCandidates: mocks.search }))
vi.stubGlobal('defineEventHandler', (handler: any) => handler)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
const { default: handler } = await import('../../server/api/product-image-suggestions.post')

beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'user-1' })
    mocks.body.mockResolvedValue({ term: 'ALCATRA KG' })
    mocks.search.mockResolvedValue({ candidates: [] })
})
describe('busca explícita de mais opções pelo worker', () => {
    it('aciona Chromium/Python com o produto e devolve candidatas sem selecionar imagem', async () => {
        mocks.search.mockResolvedValue({ candidates: [
            { url: 'https://example.com/alcatra.png', title: 'Alcatra kg' },
            { url: 'https://example.com/alcatra.png' },
            { url: 'javascript:alert(1)' }
        ] })
        const result = await handler({} as any)
        expect(mocks.search).toHaveBeenCalledWith('ALCATRA KG')
        expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), 'product-image-suggestions:user-1', 8, 60000)
        expect(result.candidates).toHaveLength(1)
        expect(result.candidates[0]).toMatchObject({ source: 'external', provider: 'chromium-search', title: 'Alcatra kg' })
        expect(result).not.toHaveProperty('url')
    })
    it('rejeita busca vazia antes de iniciar o worker', async () => {
        mocks.body.mockResolvedValue({ term: '' })
        await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })
        expect(mocks.search).not.toHaveBeenCalled()
    })
    it('retorna falha legível quando o worker falha', async () => {
        mocks.search.mockResolvedValue({ candidates: [], error: { message: 'internal error' } })
        await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 502 })
    })
    it('exige autenticação antes da busca', async () => {
        mocks.auth.mockRejectedValueOnce(new Error('unauthorized'))
        await expect(handler({} as any)).rejects.toThrow('unauthorized')
        expect(mocks.search).not.toHaveBeenCalled()
    })
})
