import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), ensure: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.query }))
vi.mock('../../server/utils/business-profile', async importOriginal => {
  const actual = await importOriginal<typeof import('../../server/utils/business-profile')>()
  return { ...actual, ensureBusinessProfileColumn: mocks.ensure }
})
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { requireBusinessProfileForOfferCreation } = await import('../../server/utils/business-profile-onboarding')

const completeProfile = {
  companyName: 'Mercado Central',
  logo: 'logos/mercado.png',
  instagram: '@mercadocentral',
  whatsapp: '(11) 99999-0000',
  address: 'Rua A, 10',
}

describe('server offer creation onboarding guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ensure.mockResolvedValue(undefined)
  })

  it('blocks an incomplete account even when its completion flag is true', async () => {
    mocks.query.mockResolvedValue({ business_profile: {}, onboarding_completed: true })
    await expect(requireBusinessProfileForOfferCreation({
      id: 'user-1', actorId: 'user-1', accountId: 'user-1', role: 'user',
    } as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('where id = $1'), ['user-1'])
  })

  it('allows complete legacy account data even when its completion flag is false', async () => {
    mocks.query.mockResolvedValue({ business_profile: completeProfile, onboarding_completed: false })
    await expect(requireBusinessProfileForOfferCreation({
      id: 'user-1', actorId: 'user-1', accountId: 'user-1', role: 'user',
    } as any)).resolves.toBeUndefined()
  })

  it('keeps staff creation access in their own account', async () => {
    await expect(requireBusinessProfileForOfferCreation({
      id: 'admin-1', actorId: 'admin-1', accountId: 'admin-1', role: 'admin',
    } as any)).resolves.toBeUndefined()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('checks the effective selected customer account for staff', async () => {
    mocks.query.mockResolvedValue({ business_profile: { onboarding_completed: true } })
    await expect(requireBusinessProfileForOfferCreation({
      id: 'customer-1', actorId: 'editor-1', accountId: 'customer-1', role: 'editor',
    } as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('where id = $1'), ['customer-1'])
  })

  it('fails closed when the persisted profile cannot be read', async () => {
    mocks.query.mockRejectedValue(new Error('database unavailable'))
    await expect(requireBusinessProfileForOfferCreation({
      id: 'user-1', actorId: 'user-1', accountId: 'user-1', role: 'user',
    } as any)).rejects.toThrow('database unavailable')
  })
})
