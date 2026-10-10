import { beforeEach, expect, it, vi } from 'vitest'
import { createError } from 'h3'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), limit: vi.fn(), header: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAdminUser: mocks.auth }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('setResponseHeader', mocks.header)
const { default: handler } = await import('../../server/api/admin/builder/counts.get')
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: '11111111-1111-4111-8111-111111111111' } }) })
it('recusa acesso antes de consultar dados', async () => {
  mocks.auth.mockRejectedValue(createError({ statusCode: 403 }))
  await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
  expect(mocks.query).not.toHaveBeenCalled()
})
it('consulta apenas totais com usuário autenticado e sem cache compartilhado', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [{ name: 'radio_voice_profiles', available: true }] }).mockResolvedValueOnce({ rows: [{ radioVoices: 3 }] })
  await expect(handler({} as any)).resolves.toEqual({ counts: { radioVoices: 3 } })
  expect(mocks.query).toHaveBeenCalledTimes(2)
  expect(mocks.query.mock.calls[1]?.[1]).toEqual(['11111111-1111-4111-8111-111111111111'])
  expect(mocks.header).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'private, no-store')
})
it('interrompe a consulta quando o limite de requisições é atingido', async () => {
  mocks.limit.mockRejectedValueOnce(createError({ statusCode: 429 }))
  await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 429 })
  expect(mocks.query).not.toHaveBeenCalled()
})
