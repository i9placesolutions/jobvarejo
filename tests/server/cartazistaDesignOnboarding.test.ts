import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), guard: vi.fn(), query: vi.fn(), body: vi.fn(),
}))
vi.mock('~/server/utils/cartazista', () => ({
  cartazistaUser: mocks.user,
  cartazistaDatabaseError: vi.fn(),
}))
vi.mock('~/server/utils/cartazista-schema', () => ({
  cartazistaDesignSchema: {},
  parseCartazistaInput: vi.fn(),
}))
vi.mock('~/server/utils/postgres', () => ({ pgOneOrNull: mocks.query }))
vi.mock('~/server/utils/business-profile-onboarding', () => ({
  requireBusinessProfileForOfferCreation: mocks.guard,
}))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { default: handler } = await import('../../server/api/cartazista/designs/index.post')

describe('POST /api/cartazista/designs onboarding guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({
      id: 'account-a', actorId: 'account-a', accountId: 'account-a', role: 'user',
    })
    mocks.guard.mockRejectedValue(Object.assign(
      new Error('Complete o cadastro da empresa antes de criar ofertas.'),
      { statusCode: 403 },
    ))
  })

  it('returns 403 for an incomplete account before attempting the design insert', async () => {
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.guard).toHaveBeenCalledWith(expect.objectContaining({ id: 'account-a' }))
    expect(mocks.query).not.toHaveBeenCalled()
    expect(mocks.body).not.toHaveBeenCalled()
  })
})
