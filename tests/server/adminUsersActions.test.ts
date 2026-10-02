import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), body: vi.fn(), manage: vi.fn(), limit: vi.fn(), invalidate: vi.fn(), param: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireSuperAdminUser: mocks.auth }))
vi.mock('../../server/utils/account-access', () => ({ manageAccountAccess: mocks.manage }))
vi.mock('../../server/utils/auth-db', () => ({ normalizeEmail: (v: unknown) => String(v || '') }))
vi.mock('../../server/utils/builder-auth', () => ({ invalidateBuilderTenantCache: mocks.invalidate }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRouterParam', mocks.param)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', createError)

const id = '22222222-2222-4222-8222-222222222222'
const actorId = '11111111-1111-4111-8111-111111111111'
const { default: status } = await import('../../server/api/admin/users/[id]/status.patch')
const { default: remove } = await import('../../server/api/admin/users/[id].delete')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ actorId })
  mocks.param.mockReturnValue(id)
  mocks.manage.mockResolvedValue({ id, is_active: false })
})

describe('ações exclusivas do super admin', () => {
  it.each([status, remove])('recusa ator não autorizado antes de operar', async handler => {
    mocks.auth.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.manage).not.toHaveBeenCalled()
    expect(mocks.body).not.toHaveBeenCalled()
  })
  it.each([true, false])('altera status %s com ator real e invalida cache', async is_active => {
    mocks.body.mockResolvedValue({ is_active })
    await status({} as any)
    expect(mocks.manage).toHaveBeenCalledWith(actorId, id, is_active ? 'unblock' : 'block')
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), `admin-users-status:${actorId}`, 30, 60_000)
    expect(mocks.invalidate).toHaveBeenCalledWith(id)
  })
  it('recusa status não booleano', async () => {
    mocks.body.mockResolvedValue({ is_active: 'false' })
    await expect(status({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.manage).not.toHaveBeenCalled()
  })
  it('exige confirmação do alvo exato para remover', async () => {
    mocks.body.mockResolvedValue({ confirmId: actorId })
    await expect(remove({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.manage).not.toHaveBeenCalled()
  })
  it('remove o alvo confirmado e limpa cache', async () => {
    mocks.body.mockResolvedValue({ confirmId: id })
    await remove({} as any)
    expect(mocks.manage).toHaveBeenCalledWith(actorId, id, 'remove')
    expect(mocks.invalidate).toHaveBeenCalledWith(id)
  })
  it.each([status, remove])('recusa UUID inválido', async handler => {
    mocks.param.mockReturnValue('invalid')
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.manage).not.toHaveBeenCalled()
  })
})
