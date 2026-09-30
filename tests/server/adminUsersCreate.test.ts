import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), body: vi.fn(), ensure: vi.fn(), email: vi.fn(), whatsapp: vi.fn(), create: vi.fn(), tx: vi.fn(), query: vi.fn(), hash: vi.fn(), limit: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAdminUser: mocks.auth }))
vi.mock('../../server/utils/auth-db', () => ({ createProfileWithPassword: mocks.create, ensureAuthColumns: mocks.ensure, getProfileByEmail: mocks.email, getProfileByWhatsApp: mocks.whatsapp, normalizeEmail: (value: unknown) => String(value || '').trim().toLowerCase() }))
vi.mock('../../server/utils/postgres', () => ({ pgTx: mocks.tx }))
vi.mock('../../server/utils/password', () => ({ hashPassword: mocks.hash }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('createError', createError)
const { default: handler } = await import('../../server/api/admin/users/index.post')

const id = '11111111-1111-4111-8111-111111111111'
const login = { name: 'Maria Silva', email: 'maria@example.com', whatsapp: '(64) 99999-1234', password: 'senha-inicial-forte' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { actorId: id }, role: 'super_admin' })
  mocks.body.mockResolvedValue({ role: 'user', companyName: 'Mercado Central', hasPlatformAccess: false })
  mocks.email.mockResolvedValue(null)
  mocks.whatsapp.mockResolvedValue(null)
  mocks.create.mockResolvedValue({ id })
  mocks.hash.mockResolvedValue('hash-de-teste')
  mocks.query.mockResolvedValue({ rows: [{ id, name: 'Mercado Central', email: 'internal@jobvarejo.invalid', role: 'user', company_name: 'Mercado Central', internal_only: true, is_active: true, permissions: {} }] })
  mocks.tx.mockImplementation(async (run: any) => run({ query: mocks.query }))
})

describe('POST /api/admin/users — cadastro de empresa', () => {
  it('cria empresa interna sem login e sem exigir colunas da migração de acessos', async () => {
    const result = await handler({} as any)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mercado Central', email: expect.stringMatching(/^internal-.+@jobvarejo\.invalid$/), whatsapp: null, passwordHash: null, role: 'user' }), expect.anything())
    expect(mocks.query.mock.calls[0]![1]).toEqual([id, 'Mercado Central', true])
    expect(mocks.query.mock.calls[0]![0]).not.toMatch(/\beditor_permissions\s*=/)
    expect(result.user).toMatchObject({ email: '', company_name: 'Mercado Central', internal_only: true, is_active: true, permissions: {} })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.email).not.toHaveBeenCalled()
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), `admin-users-create:${id}`, 15, 60_000)
  })

  it('permite empresa com login e passa somente o hash da senha ao cadastro', async () => {
    mocks.body.mockResolvedValue({ ...login, role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true })
    mocks.query.mockResolvedValue({ rows: [{ id, email: login.email, internal_only: false }] })
    const result = await handler({} as any)
    expect(mocks.hash).toHaveBeenCalledWith(login.password)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ email: login.email, whatsapp: '+5564999991234', passwordHash: 'hash-de-teste', role: 'user' }), expect.anything())
    expect(mocks.query.mock.calls[0]![1]).toEqual([id, 'Mercado Central', false])
    expect(result.user.email).toBe(login.email)
  })

  it('recusa editor sem suporte no banco antes de criar a identidade', async () => {
    mocks.body.mockResolvedValue({ ...login, role: 'editor', permissions: { videos: { edit: true } } })
    mocks.query.mockResolvedValue({ rows: [{ supported: false }] })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 503 })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('persiste permissões normalizadas quando o banco suporta editores', async () => {
    mocks.body.mockResolvedValue({ ...login, role: 'editor', permissions: { videos: { edit: true }, admin: { view: true } } })
    mocks.query.mockResolvedValueOnce({ rows: [{ supported: true }] }).mockResolvedValueOnce({ rows: [{ id, email: login.email, role: 'editor' }] })
    await handler({} as any)
    expect(mocks.query.mock.calls[1]![1]).toEqual([id, '', false, JSON.stringify({ videos: { edit: true, view: true } })])
    expect(mocks.query.mock.calls[1]![0]).toContain('editor_permissions = $4::jsonb')
  })

  it('recusa e-mail já cadastrado antes da transação', async () => {
    mocks.body.mockResolvedValue({ ...login, role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true })
    mocks.email.mockResolvedValue({ id: 'existente' })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.tx).not.toHaveBeenCalled()
  })

  it('mantém a mensagem de conflito para duplicidade detectada pelo banco', async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }))
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa cadastro sem autenticação', async () => {
    mocks.auth.mockRejectedValue(createError({ statusCode: 401, statusMessage: 'Não autenticado.' }))
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 401 })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.tx).not.toHaveBeenCalled()
  })

  it('mantém proibida a criação de super admin', async () => {
    mocks.body.mockResolvedValue({ ...login, role: 'super_admin' })
    await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
