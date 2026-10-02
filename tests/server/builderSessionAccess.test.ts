import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), profileId: vi.fn(), profileEmail: vi.fn(), verify: vi.fn(), policy: vi.fn(), mainAuth: vi.fn() }))
vi.mock('../../server/utils/builder-auth-db', () => ({ getTenantById: mocks.tenant }))
vi.mock('../../server/utils/auth-db', () => ({ getProfileById: mocks.profileId, getProfileByEmail: mocks.profileEmail }))
vi.mock('../../server/utils/builder-session-token', () => ({ verifyBuilderSessionToken: mocks.verify }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.mainAuth }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: vi.fn() }))
vi.mock('../../server/utils/access-policy', () => ({ assertRoleApiAccess: mocks.policy }))
vi.stubGlobal('getHeader', () => undefined)
vi.stubGlobal('getCookie', (event: any, name: string) => name === 'builder-access-token' ? 'valid-builder-cookie' : undefined)
vi.stubGlobal('createError', createError)
const { requireBuilderTenant } = await import('../../server/utils/builder-auth')

const tenantId = '33333333-3333-4333-8333-333333333333'
const profileId = '44444444-4444-4444-8444-444444444444'
const event = () => ({ context: {}, node: { req: { headers: {} } } }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant.mockResolvedValue({
    id: tenantId,
    email: ' Cliente@Example.com ',
    name: 'Mercado',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  })
  mocks.verify.mockReturnValue({ sub: tenantId, email: 'cliente@example.com', name: 'Mercado', scope: 'builder' })
  mocks.profileEmail.mockResolvedValue({ id: profileId, email: 'cliente@example.com' })
  mocks.profileId.mockImplementation(async (id: string) => id === profileId
    ? { id: profileId, email: 'cliente@example.com', role: 'user', is_active: true, editor_permissions: {} }
    : null)
})

describe('sessão Builder ligada a perfil por e-mail', () => {
  it('barra cookie já emitido ao bloquear e volta a permitir após desbloquear, com cache aquecido e IDs distintos', async () => {
    await expect(requireBuilderTenant(event())).resolves.toMatchObject({ id: tenantId })
    expect(mocks.profileEmail).toHaveBeenCalledWith('cliente@example.com')

    mocks.profileId.mockImplementation(async (id: string) => id === profileId
      ? { id: profileId, email: 'cliente@example.com', role: 'user', is_active: false, editor_permissions: {} }
      : null)
    await expect(requireBuilderTenant(event())).rejects.toMatchObject({ statusCode: 403 })

    mocks.profileId.mockImplementation(async (id: string) => id === profileId
      ? { id: profileId, email: 'cliente@example.com', role: 'user', is_active: true, editor_permissions: {} }
      : null)
    await expect(requireBuilderTenant(event())).resolves.toMatchObject({ id: tenantId })
    expect(mocks.tenant).toHaveBeenCalledTimes(3)
  })

  it('barra cookie já emitido quando o perfil vinculado por e-mail foi removido', async () => {
    await expect(requireBuilderTenant(event())).resolves.toMatchObject({ id: tenantId })
    mocks.profileId.mockImplementation(async (id: string) => id === profileId
      ? { id: profileId, email: 'cliente@example.com', role: 'user', is_active: false, editor_permissions: {} }
      : null)

    await expect(requireBuilderTenant(event())).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.profileId).toHaveBeenCalledTimes(4)
    expect(mocks.profileId).toHaveBeenLastCalledWith(profileId)
  })

  it('não procura vínculo por e-mail vazio', async () => {
    mocks.tenant.mockResolvedValue({ id: tenantId, email: '  ', is_active: true })
    await expect(requireBuilderTenant(event())).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.profileEmail).not.toHaveBeenCalled()
  })
})
