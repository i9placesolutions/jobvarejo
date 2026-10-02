import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), one: vi.fn(), query: vi.fn(), guard: vi.fn(),
  ensureTemplate: vi.fn(), publish: vi.fn(), body: vi.fn(), header: vi.fn(),
}))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.one, pgQuery: mocks.query }))
vi.mock('../../server/utils/business-profile-onboarding', () => ({ requireBusinessProfileForOfferCreation: mocks.guard }))
vi.mock('../../server/utils/project-templates', () => ({ ensureProjectTemplateColumn: mocks.ensureTemplate }))
vi.mock('../../server/utils/project-realtime', () => ({ publishProjectChange: mocks.publish }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('getHeader', mocks.header)
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { default: handler } = await import('../../server/api/projects.post')

describe('POST /api/projects onboarding boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'account-a', actorId: 'account-a', accountId: 'account-a', role: 'user' })
    mocks.limit.mockResolvedValue(undefined)
    mocks.ensureTemplate.mockResolvedValue(undefined)
    mocks.guard.mockResolvedValue(undefined)
    mocks.header.mockReturnValue(null)
    mocks.query.mockResolvedValue({ rows: [{ id: '00000000-0000-4000-8000-000000000001', user_id: 'account-a' }] })
    mocks.body.mockResolvedValue({ name: 'Oferta', canvas_data: [{ id: 'page-1', objects: [] }] })
  })

  it('requires the persisted profile guard before creating a project', async () => {
    await handler({} as any)
    expect(mocks.guard).toHaveBeenCalledWith(expect.objectContaining({ id: 'account-a' }))
    expect(mocks.query).toHaveBeenCalled()
  })

  it('does not require onboarding again to update an existing project', async () => {
    const canvas = [{ id: 'page-1', objects: [] }]
    mocks.body.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002', name: 'Oferta', canvas_data: canvas })
    mocks.one.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Oferta',
      preview_url: null,
      canvas_data: canvas,
      template_config: null,
    })
    await handler({} as any)
    expect(mocks.guard).not.toHaveBeenCalled()
  })
})
