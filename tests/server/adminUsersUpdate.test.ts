import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), body: vi.fn(), update: vi.fn(), tx: vi.fn(), hash: vi.fn(), limit: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAdminUser: mocks.auth }))
vi.mock('../../server/utils/auth-db', () => ({ getProfileById: mocks.profile, normalizeEmail: (value: unknown) => String(value || '').trim().toLowerCase() }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.update, pgTx: mocks.tx }))
vi.mock('../../server/utils/password', () => ({ hashPassword: mocks.hash }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getRouterParam', () => targetId)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', createError)

const targetId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const { default: handler } = await import('../../server/api/admin/users/[id].patch')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { actorId: targetId }, role: 'super_admin' })
  mocks.profile.mockResolvedValue({ id: targetId, name: 'Admin atual', role: 'super_admin', is_active: true })
  mocks.body.mockResolvedValue({ name: 'Admin atualizado', role: 'super_admin', is_active: true })
  mocks.update.mockResolvedValue({ id: targetId, name: 'Admin atualizado', role: 'super_admin', is_active: true })
  mocks.hash.mockResolvedValue('hash-de-teste')
})

describe('PATCH /api/admin/users/:id — edição do super admin', () => {
  it('permite editar o próprio nome preservando senha, nível e status', async () => {
    const result = await handler({} as any)
    expect(result.user).toMatchObject({ name: 'Admin atualizado', role: 'super_admin', is_active: true })
    expect(mocks.update.mock.calls[0]![1]).toEqual([targetId, 'Admin atualizado', null, null])
    expect(mocks.update.mock.calls[0]![0]).not.toMatch(/\b(role|is_active|editor_permissions)\s*=/)
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), `admin-users-update:${targetId}`, 60, 60_000)
  })

  it('permite nova senha válida com hash e invalidação dos tokens de recuperação', async () => {
    mocks.body.mockResolvedValue({ password: 'nova-senha-valida' })
    await handler({} as any)
    expect(mocks.hash).toHaveBeenCalledWith('nova-senha-valida')
    expect(mocks.update.mock.calls[0]![1][2]).toBe('hash-de-teste')
    expect(mocks.update.mock.calls[0]![0]).toContain('reset_token_hash = CASE WHEN $3::text IS NULL THEN reset_token_hash ELSE NULL END')
    expect(mocks.update.mock.calls[0]![0]).toContain('reset_token_expires_at = CASE WHEN $3::text IS NULL THEN reset_token_expires_at ELSE NULL END')
  })

  it('permite um super admin editar outro super admin', async () => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: 'super_admin' })
    await handler({} as any)
    expect(mocks.update).toHaveBeenCalledOnce()
  })

  it('altera o nome da empresa do super admin sem sobrescrever outros dados do perfil', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Rafael', role: 'super_admin', is_active: true, business_profile: { companyName: 'Supermercado Rodrigues' } })
    mocks.body.mockResolvedValue({ companyName: '  Mercado   Central  ' })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![1]).toEqual([targetId, 'Rafael', null, 'Mercado Central'])
    expect(mocks.update.mock.calls[0]![0]).toContain("COALESCE(business_profile, '{}'::jsonb) || jsonb_build_object('companyName', $4::text)")
  })

  it('preserva nome da empresa existente quando não enviado', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Rafael', role: 'super_admin', is_active: true, business_profile: { companyName: 'Supermercado Rodrigues' } })
    mocks.body.mockResolvedValue({ name: 'Rafael atualizado' })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![1][3]).toBeNull()
  })

  it('permite limpar o nome opcional da empresa do super admin', async () => {
    mocks.body.mockResolvedValue({ companyName: '' })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![1][3]).toBe('')
  })

  it.each(['A', 'A'.repeat(161)])('recusa nome da empresa fora dos limites', async (companyName) => {
    mocks.body.mockResolvedValue({ companyName })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('recusa administrador comum antes de ler dados ou gravar o super admin', async () => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: 'admin' })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.body).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.hash).not.toHaveBeenCalled()
  })

  it.each(['super_admin', 'admin'])('recusa desativar o super admin pelo ator %s', async (actorRole) => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: actorRole })
    mocks.body.mockResolvedValue({ is_active: false })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: actorRole === 'super_admin' ? 409 : 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each(['admin', 'editor', 'user'])('recusa rebaixar um super admin para %s', async (role) => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: 'super_admin' })
    mocks.body.mockResolvedValue({ role })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('recusa promover outro usuário para super admin', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Editor', role: 'editor', is_active: true })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([{ name: 'A' }, { password: 'curta' }, { is_active: 'true' }])('recusa dados inválidos %j', async (body) => {
    mocks.body.mockResolvedValue(body)
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.hash).not.toHaveBeenCalled()
  })

  it('mantém a edição de editor pelo administrador comum', async () => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: 'admin' })
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Editor', role: 'editor', is_active: true })
    mocks.body.mockResolvedValue({ name: 'Editor atualizado', permissions: { videos: { edit: true } } })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![1][4]).toBe('editor')
    expect(JSON.parse(mocks.update.mock.calls[0]![1][6])).toEqual({ videos: { edit: true, view: true } })
  })

  it('mantém o bloqueio para administrador comum editar outro administrador', async () => {
    mocks.auth.mockResolvedValue({ user: { actorId: otherId }, role: 'admin' })
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Administrador', role: 'admin', is_active: true })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
