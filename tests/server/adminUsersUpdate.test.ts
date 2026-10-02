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
  it('edita cadastro em banco legado sem colunas de status e permissões', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Cliente', role: 'user', is_active: false, has_active_column: false, has_permissions_column: false, business_profile: { companyName: 'Mercado', adminAccess: { blocked: true } } })
    mocks.body.mockResolvedValue({ name: 'Cliente atualizado' })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![1]).toEqual([targetId, 'Cliente atualizado', null, 'Mercado', 'user'])
    expect(mocks.update.mock.calls[0]![0]).not.toMatch(/\b(is_active|editor_permissions)\s*=/)
    expect(mocks.update.mock.calls[0]![0]).toContain("COALESCE(business_profile->'adminAccess'->>'removedAt', '') = ''")
  })

  it('recusa conta removida antes de trocar senha', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, role: 'user', business_profile: { adminAccess: { removedAt: '2026-10-02' } } })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('informa conflito se remoção vencer edição concorrente', async () => {
    mocks.update.mockResolvedValue(null)
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 409 })
  })

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

  it('preserva o email atual ao editar uma empresa sem enviar email', async () => {
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Responsável', email: 'atual@example.com', role: 'user', is_active: true, business_profile: { companyName: 'Mercado Central' } })
    mocks.body.mockResolvedValue({ name: 'Responsável atualizado' })
    await handler({} as any)
    expect(mocks.update.mock.calls[0]![0]).not.toMatch(/\bemail\s*=/i)
    expect(mocks.update.mock.calls[0]![1]).toEqual([targetId, 'Responsável atualizado', null, 'Mercado Central', 'user', true, '{}'])
  })

  it('habilita acesso de empresa interna sem email e preserva a identidade técnica', async () => {
    const accountEmail = `internal-${targetId}@jobvarejo.invalid`
    mocks.profile.mockResolvedValue({ id: targetId, name: 'Mercado Central', email: accountEmail, role: 'user', is_active: true, business_profile: { companyName: 'Mercado Central', internalOnly: true } })
    mocks.body.mockResolvedValue({ name: 'Maria Silva', whatsapp: '(69) 99999-1234', password: 'senha-inicial-forte', role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true })
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ relation: 'auth.users' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: targetId, email: accountEmail, internal_only: false }] })
      .mockResolvedValueOnce({ rows: [{ relation: 'public.builder_tenants' }] })
      .mockResolvedValueOnce({ rows: [] })
    mocks.tx.mockImplementation(async (run: any) => run({ query }))

    const result = await handler({} as any)

    expect(query.mock.calls[1]![1]).toEqual([targetId, accountEmail, 'Maria Silva'])
    expect(query.mock.calls[2]![1]).toEqual([targetId, 'Maria Silva', accountEmail, '+5569999991234', 'hash-de-teste', 'Mercado Central', true])
    expect(query.mock.calls[4]![1]).toEqual([targetId, accountEmail, 'Mercado Central', true])
    expect(result.user.email).toBe('')
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
