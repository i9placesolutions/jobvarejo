import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), verify: vi.fn(), policy: vi.fn() }))
vi.mock('../../server/utils/auth-db', () => ({ getProfileById: mocks.profile }))
vi.mock('../../server/utils/session-token', () => ({ verifySessionToken: mocks.verify }))
vi.mock('../../server/utils/access-policy', () => ({ assertRoleApiAccess: mocks.policy }))
vi.stubGlobal('getHeader', () => 'Bearer token-valido')
vi.stubGlobal('getCookie', () => undefined)
vi.stubGlobal('getQuery', () => ({}))
vi.stubGlobal('createError', createError)
const { requireAuthenticatedUser } = await import('../../server/utils/auth')
const id = '22222222-2222-4222-8222-222222222222'
const event = () => ({ path: '/api/auth/session', context: {}, node: { req: { url: '/api/auth/session', headers: { host: 'localhost' } } } }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verify.mockReturnValue({ sub: id, role: 'user' })
  mocks.profile.mockResolvedValue({ id, email: 'cliente@example.com', role: 'user', is_active: true })
})

describe('revogação de acesso em sessão já emitida', () => {
  it('relê status e barra o mesmo token depois do bloqueio', async () => {
    await expect(requireAuthenticatedUser(event())).resolves.toMatchObject({ actorId: id })
    mocks.profile.mockResolvedValue({ id, email: 'cliente@example.com', role: 'user', is_active: false })
    await expect(requireAuthenticatedUser(event())).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.profile).toHaveBeenCalledTimes(2)
  })
  it('token com claim administrativo não supera status bloqueado persistido', async () => {
    mocks.verify.mockReturnValue({ sub: id, role: 'super_admin' })
    mocks.profile.mockResolvedValue({ id, email: 'cliente@example.com', role: 'admin', is_active: false })
    await expect(requireAuthenticatedUser(event())).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.policy).not.toHaveBeenCalled()
  })
})
