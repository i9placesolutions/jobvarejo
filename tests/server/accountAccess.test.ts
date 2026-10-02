import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ tx: vi.fn(), query: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgTx: mocks.tx }))
const { manageAccountAccess } = await import('../../server/utils/account-access')
const actorId = '11111111-1111-4111-8111-111111111111'
const targetId = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.mockImplementation(async run => run({ query: mocks.query }))
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) return { rows: [{ id: targetId, email: ' cliente@example.com ', role: 'user', has_active: false, business_profile: { companyName: 'Mercado' } }] }
    if (sql.includes('RETURNING id')) return { rows: [{ id: targetId }] }
    if (sql.includes('to_regclass')) return { rows: [{ relation: 'builder_tenants' }] }
    return { rows: [] }
  })
})

describe('gestão de acesso de contas', () => {
  it.each(['block', 'unblock', 'remove'] as const)('protege a própria identidade em %s', async action => {
    await expect(manageAccountAccess(targetId, targetId, action)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.query).toHaveBeenCalledTimes(1)
  })

  it('protege qualquer super admin', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: targetId, role: 'super_admin' }] })
    await expect(manageAccountAccess(actorId, targetId, 'remove')).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.query).toHaveBeenCalledTimes(1)
  })

  it('não permite desbloquear uma conta removida', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: targetId, role: 'user', business_profile: { adminAccess: { removedAt: '2026-10-02' } } }] })
    await expect(manageAccountAccess(actorId, targetId, 'unblock')).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.query).toHaveBeenCalledTimes(1)
  })

  it('bloqueia no banco legado preservando perfil e materiais e sincroniza Builder', async () => {
    const result = await manageAccountAccess(actorId, targetId, 'block')
    const update = mocks.query.mock.calls[1]!
    expect(update[0]).not.toContain('is_active =')
    expect(update[0]).toContain('jsonb_set(COALESCE(business_profile')
    expect(JSON.parse(update[1][1])).toMatchObject({ blocked: true, changedBy: actorId })
    expect(update[1]).toHaveLength(2)
    expect(mocks.query.mock.calls[3]![1]).toEqual([targetId, 'cliente@example.com', false])
    expect(result).toEqual({ id: targetId, is_active: false, removed: false })
    expect(mocks.query.mock.calls.some(([sql]) => /DELETE FROM/i.test(sql))).toBe(false)
  })

  it('desbloqueia também a coluna de status quando existe', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: targetId, email: 'cliente@example.com', role: 'admin', has_active: true }] })
    await manageAccountAccess(actorId, targetId, 'unblock')
    const update = mocks.query.mock.calls[1]!
    expect(update[0]).toContain('is_active = $3')
    expect(update[1][2]).toBe(true)
    expect(JSON.parse(update[1][1]).blocked).toBe(false)
    expect(mocks.query.mock.calls[3]![1]).toEqual([targetId, 'cliente@example.com', true])
  })

  it('sincroniza tenant Builder legado pelo e-mail normalizado quando os IDs diferem', async () => {
    await manageAccountAccess(actorId, targetId, 'block')
    const sync = mocks.query.mock.calls[3]!
    expect(sync[0]).toContain("lower(btrim(email)) = $2")
    expect(sync[1]).toEqual([targetId, 'cliente@example.com', false])
  })

  it('não associa tenants por e-mail vazio', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: targetId, email: '  ', role: 'user', has_active: false, business_profile: {} }] }
      if (sql.includes('RETURNING id')) return { rows: [{ id: targetId }] }
      if (sql.includes('to_regclass')) return { rows: [{ relation: 'builder_tenants' }] }
      return { rows: [] }
    })
    await manageAccountAccess(actorId, targetId, 'block')
    expect(mocks.query.mock.calls[3]![1]).toEqual([targetId, '', false])
    expect(mocks.query.mock.calls[3]![0]).toContain("($2 <> '' AND lower(btrim(email)) = $2)")
  })

  it('remove logicamente e revoga senha e recuperação sem apagar materiais', async () => {
    await manageAccountAccess(actorId, targetId, 'remove')
    const update = mocks.query.mock.calls[1]!
    expect(JSON.parse(update[1][1])).toMatchObject({ blocked: true, removedBy: actorId, removedAt: expect.any(String) })
    expect(update[0]).toContain('password_hash = NULL, reset_token_hash = NULL, reset_token_expires_at = NULL')
    expect(mocks.query.mock.calls.some(([sql]) => /DELETE FROM/i.test(sql))).toBe(false)
  })
})
