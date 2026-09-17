import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), body: vi.fn(), limit: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.query }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.mock('../../server/utils/business-profile', () => ({ ensureBusinessProfileColumn: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))
const { default: handler } = await import('../../server/api/profile/logo-preference.put')

describe('logo preference persistence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'account-a' })
    mocks.query.mockImplementation(async (_sql, params) => ({ business_profile: { logoPreference: JSON.parse(params[0]) } }))
  })
  it('persists only the authenticated account, ignoring an injected owner', async () => {
    mocks.body.mockResolvedValue({ userId: 'account-b', backdrop: 'round', outline: true, outlineWidth: 8 })
    const result: any = await handler({} as any)
    const [sql, params] = mocks.query.mock.calls[0]!
    expect(sql).toContain("jsonb_build_object('logoPreference'")
    expect(sql).toContain('WHERE id = $2')
    expect(params[1]).toBe('account-a')
    expect(result.id).toBe('account-a')
    expect(result.business_profile.logoPreference).toMatchObject({ backdrop: 'round', outline: true, outlineWidth: 8 })
  })
  it('rejects invalid preferences without writing', async () => {
    mocks.body.mockResolvedValue(null)
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.query).not.toHaveBeenCalled()
  })
  it('never writes if authentication fails', async () => {
    mocks.auth.mockRejectedValue(new Error('unauthenticated'))
    await expect(handler({} as any)).rejects.toThrow('unauthenticated')
    expect(mocks.query).not.toHaveBeenCalled()
  })
})
