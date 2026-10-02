import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), profileEmail: vi.fn(), profileId: vi.fn(), password: vi.fn(), token: vi.fn(), cookies: vi.fn(), lastLogin: vi.fn() }))
vi.mock('../../server/utils/builder-auth-db', () => ({ getTenantByEmail: mocks.tenant, normalizeBuilderEmail: (v: string) => v, updateTenantLastLogin: mocks.lastLogin }))
vi.mock('../../server/utils/auth-db', () => ({ getProfileByEmail: mocks.profileEmail, getProfileById: mocks.profileId }))
vi.mock('../../server/utils/password', () => ({ verifyPassword: mocks.password }))
vi.mock('../../server/utils/builder-session-token', () => ({ createBuilderSessionToken: mocks.token }))
vi.mock('../../server/utils/builder-cookie', () => ({ setBuilderAuthCookies: mocks.cookies }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRequestIP', () => '127.0.0.1')
vi.stubGlobal('readBody', async () => ({ email: 'cliente@example.com', password: 'senha-valida' }))
vi.stubGlobal('createError', createError)
const { default: login } = await import('../../server/api/builder/auth/login.post')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant.mockResolvedValue({ id: 'cliente', email: 'cliente@example.com', is_active: true })
  mocks.password.mockResolvedValue(true)
  mocks.profileEmail.mockResolvedValue(null)
  mocks.token.mockReturnValue({ token: 'teste', expiresIn: 60 })
})

describe('login antigo do Builder e contas bloqueadas', () => {
  it('não emite sessão para tenant inativo mesmo com senha correta', async () => {
    mocks.tenant.mockResolvedValue({ id: 'cliente', email: 'cliente@example.com', is_active: false })
    await expect(login({} as any)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.cookies).not.toHaveBeenCalled()
  })
  it('não emite sessão se identidade principal de mesmo email está bloqueada', async () => {
    mocks.profileEmail.mockResolvedValue({ id: 'principal' })
    mocks.profileId.mockResolvedValue({ id: 'principal', is_active: false })
    await expect(login({} as any)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.cookies).not.toHaveBeenCalled()
  })
  it('permite sessão de tenant ativo', async () => {
    await expect(login({} as any)).resolves.toMatchObject({ tenant: { id: 'cliente' } })
    expect(mocks.cookies).toHaveBeenCalledOnce()
  })
})
