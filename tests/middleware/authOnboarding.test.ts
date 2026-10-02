import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), auth: vi.fn(), navigate: vi.fn() }))
vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
vi.stubGlobal('$fetch', mocks.fetch)
vi.stubGlobal('useAuth', mocks.auth)
vi.stubGlobal('navigateTo', mocks.navigate)

const middleware = (await import('../../middleware/auth')).default

const runMiddleware = (to: any) => middleware(to, {} as any)

const route = (path: string, fullPath = path) => ({ path, fullPath, query: {} })

describe('auth middleware business profile onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { role: 'user' } },
      getSession: vi.fn(),
      can: vi.fn(() => true),
    })
    mocks.navigate.mockImplementation(target => ({ target }))
    mocks.fetch.mockResolvedValue({ business_profile: {}, onboarding_completed: true })
  })

  it('redirects a regular account with missing data to the onboarding form', async () => {
    const result = await runMiddleware(route('/', '/'))
    expect(mocks.fetch).toHaveBeenCalledWith('/api/profile?self=1')
    expect(result).toEqual({ target: {
      path: '/business-profile',
      query: { onboarding: '1', returnTo: '/' },
    } })
  })

  it('lets a complete legacy profile proceed even when onboarding_completed is false', async () => {
    mocks.fetch.mockResolvedValue({ onboarding_completed: false, business_profile: {
      companyName: 'Mercado Central', logoUrl: 'logos/mercado.png',
      instagram: '@mercadocentral', whatsapp: '(11) 99999-0000',
      address: 'Rua A, 10',
    } })
    await expect(runMiddleware(route('/quick-editor'))).resolves.toBeUndefined()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('keeps the onboarding page reachable while the profile is incomplete', async () => {
    await expect(runMiddleware(route('/business-profile', '/business-profile?onboarding=1'))).resolves.toBeUndefined()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('fails closed to onboarding when the persisted profile request fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('network unavailable'))
    const result = await runMiddleware(route('/quick-editor'))
    expect(result).toEqual({ target: expect.objectContaining({ path: '/business-profile' }) })
  })

  it('preserves the existing staff route policy without checking staff profile data', async () => {
    mocks.auth.mockReturnValue({
      isAuthenticated: { value: true },
      user: { value: { role: 'admin' } },
      getSession: vi.fn(),
      can: vi.fn(() => true),
    })
    await expect(runMiddleware(route('/admin/users'))).resolves.toBeUndefined()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
