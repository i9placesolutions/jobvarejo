import { beforeEach, expect, it, vi } from 'vitest'
import { createError } from 'h3'
const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: async () => ({ id: 'owner' }) }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', () => ({ summary: '1' }))
vi.stubGlobal('createError', createError)
const { default: handler } = await import('../../server/api/label-templates.get')
beforeEach(() => vi.clearAllMocks())
it('recupera etiquetas legadas quando falta template_key mesmo com nome da tabela no erro', async () => {
  mocks.query.mockRejectedValueOnce({ code: '42703', message: 'column label_templates.template_key does not exist' })
    .mockResolvedValueOnce({ rows: [{ id: 'legacy', name: 'Etiqueta' }] })
  await expect(handler({} as any)).resolves.toMatchObject({ templates: [{ id: 'legacy' }], missingCatalogScope: true })
  expect(mocks.query).toHaveBeenCalledTimes(2)
  expect(mocks.query.mock.calls[1]![1]).toEqual(['owner'])
})
it('não esconde falhas de permissão como catálogo vazio', async () => {
  mocks.query.mockRejectedValueOnce({ code: '42501', message: 'permission denied for table label_templates' })
  await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 500 })
})
it('mantém o fallback apenas para tabela ausente', async () => {
  mocks.query.mockRejectedValueOnce({ code: '42P01', message: 'relation label_templates does not exist' })
  await expect(handler({} as any)).resolves.toMatchObject({ missingTable: true, templates: [] })
})
