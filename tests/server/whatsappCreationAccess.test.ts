import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))

const { authenticateWhatsAppService, resolveWhatsAppAccount } = await import('../../server/utils/whatsapp-creation/access')

const profileId = '11111111-1111-4111-8111-111111111111'
const serviceKey = 'a'.repeat(40)
const eventWithKey = (key?: string) => ({
  node: { req: { headers: key ? { 'x-jobvarejo-service-key': key } : {} } }
}) as any

const profile = (overrides: Record<string, unknown> = {}) => ({
  id: profileId,
  email: 'loja@example.com',
  name: 'Mercado Central',
  role: 'user',
  login_whatsapp: '+5511999999999',
  login_whatsapp_verified_at: '2026-10-03T12:00:00.000Z',
  is_active: true,
  editor_permissions: { encartes: { create: true } },
  business_profile: { companyName: 'Mercado Central' },
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('JOBVAREJO_WHATSAPP_SERVICE_KEY', serviceKey)
})

afterEach(() => vi.unstubAllEnvs())

describe('acesso de criação pelo WhatsApp', () => {
  it('autentica o serviço com comparação segura e rejeita segredo incorreto ou ausente', () => {
    expect(authenticateWhatsAppService(eventWithKey(serviceKey))).toBeUndefined()
    expect(() => authenticateWhatsAppService(eventWithKey('b'.repeat(40)))).toThrow(expect.objectContaining({ statusCode: 401 }))
    expect(() => authenticateWhatsAppService(eventWithKey())).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it('indisponibiliza a autenticação se o segredo de serviço não estiver configurado com tamanho mínimo', () => {
    vi.stubEnv('JOBVAREJO_WHATSAPP_SERVICE_KEY', 'too-short')
    expect(() => authenticateWhatsAppService(eventWithKey('too-short'))).toThrow(expect.objectContaining({ statusCode: 503 }))
  })

  it('resolve a conta pelo WhatsApp verificado e mantém a identidade real do perfil', async () => {
    mocks.query.mockResolvedValue({ rows: [profile()] })

    const result = await resolveWhatsAppAccount('(11) 99999-9999')

    expect(result).toMatchObject({
      ok: true,
      senderPhone: '+5511999999999',
      user: {
        id: profileId,
        actorId: profileId,
        accountId: profileId,
        role: 'user',
        editorPermissions: { encartes: { create: true, view: true } },
        user_metadata: { name: 'Mercado Central', avatar_url: null }
      },
      businessProfile: { companyName: 'Mercado Central' }
    })
    expect(mocks.query.mock.calls[0]?.[0]).toContain('login_whatsapp_verified_at')
    expect(mocks.query.mock.calls[0]?.[0]).toContain("business_profile->'adminAccess'->>'removedAt'")
    expect(mocks.query.mock.calls[0]?.[0]).toContain('business_profile')
    expect(mocks.query.mock.calls[0]?.[0]).toContain('login_whatsapp = any($1::text[])')
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([['+5511999999999', '+551199999999']])
  })

  it.each([
    ['+556496185163', '+5564996185163'],
    ['+5564996185163', '+556496185163']
  ])('resolve a variante móvel brasileira sem alterar o telefone remetente (%s)', async (senderPhone, storedPhone) => {
    mocks.query.mockResolvedValue({ rows: [profile({ login_whatsapp: storedPhone })] })

    const result = await resolveWhatsAppAccount(senderPhone)

    expect(result).toMatchObject({ ok: true, senderPhone, user: { id: profileId, actorId: profileId, accountId: profileId } })
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([[senderPhone, storedPhone]])
  })

  it('não cria variante de nono dígito para telefone fixo', async () => {
    mocks.query.mockResolvedValue({ rows: [profile({ login_whatsapp: '+556231900131' })] })

    const result = await resolveWhatsAppAccount('+556231900131')

    expect(result).toMatchObject({ ok: true, senderPhone: '+556231900131' })
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([['+556231900131']])
  })

  it('retorna vínculo ausente para número sem perfil verificado e para identificadores de grupo ou lid', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [profile({ login_whatsapp_verified_at: null })] })

    await expect(resolveWhatsAppAccount('+5511999999999')).resolves.toEqual({ ok: false, error: 'unlinked_number' })
    await expect(resolveWhatsAppAccount('120363000000000000@g.us')).resolves.toEqual({ ok: false, error: 'unlinked_number' })
    await expect(resolveWhatsAppAccount('123456789012345@lid')).resolves.toEqual({ ok: false, error: 'unlinked_number' })
    expect(mocks.query).toHaveBeenCalledTimes(1)
  })

  it.each(['admin', 'super_admin'])('permite que %s use somente a própria conta verificada', async role => {
    mocks.query.mockResolvedValue({ rows: [profile({ role })] })
    await expect(resolveWhatsAppAccount('+5511999999999')).resolves.toMatchObject({
      ok: true,
      user: { id: profileId, actorId: profileId, accountId: profileId, role }
    })
  })

  it('mantém editor sem permissão para criação pelo WhatsApp', async () => {
    mocks.query.mockResolvedValue({ rows: [profile({ role: 'editor' })] })
    await expect(resolveWhatsAppAccount('+5511999999999')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('nega perfil bloqueado ou removido, rejeita duplicidade e ignora IDs fornecidos fora do telefone', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [profile({ is_active: false })] })
    await expect(resolveWhatsAppAccount('+5511999999999')).rejects.toMatchObject({ statusCode: 403 })

    mocks.query.mockResolvedValueOnce({ rows: [profile(), profile({ id: '22222222-2222-4222-8222-222222222222' })] })
    await expect(resolveWhatsAppAccount('+5511999999999')).rejects.toMatchObject({ statusCode: 409 })

    // An exact match does not take precedence over a second profile matching
    // the 9-digit mobile variant.
    mocks.query.mockResolvedValueOnce({ rows: [
      profile({ login_whatsapp: '+556496185163' }),
      profile({ id: '22222222-2222-4222-8222-222222222222', login_whatsapp: '+5564996185163' })
    ] })
    await expect(resolveWhatsAppAccount('+556496185163')).rejects.toMatchObject({ statusCode: 409 })

    mocks.query.mockResolvedValueOnce({ rows: [] })
    await expect(resolveWhatsAppAccount({ phone: '+5511999999999', accountId: profileId })).resolves.toEqual({ ok: false, error: 'unlinked_number' })
    expect(mocks.query).toHaveBeenCalledTimes(3)
  })
})
