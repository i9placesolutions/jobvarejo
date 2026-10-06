import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ one: vi.fn(), ensure: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgOneOrNull: mocks.one }))
vi.mock('../../server/utils/business-profile', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/utils/business-profile')>(),
  ensureBusinessProfileColumn: mocks.ensure
}))

const { updateBusinessContact } = await import('../../server/utils/whatsapp-creation/business-profile-update')
const userId = '11111111-1111-4111-8111-111111111111'

beforeEach(() => { vi.resetAllMocks() })

describe('atualização do contato do cadastro pelo WhatsApp', () => {
  it('mescla só WhatsApp/endereço no perfil do dono e preserva o restante', async () => {
    mocks.one.mockResolvedValueOnce({ business_profile: { companyName: 'Mercado', whatsapp: '(11) 90000-0000', address: 'Rua A', instagram: '@m' } }).mockResolvedValueOnce({ id: userId })
    await updateBusinessContact(userId, { whatsapp: ' (11) 98888-7777 ' })
    expect(mocks.ensure).toHaveBeenCalled()
    const [sql, params] = mocks.one.mock.calls[1] as [string, [string, string]]
    expect(sql).toContain('update public.profiles')
    expect(params[1]).toBe(userId)
    const saved = JSON.parse(params[0])
    expect(saved).toMatchObject({ companyName: 'Mercado', address: 'Rua A', instagram: '@m', whatsapp: '(11) 98888-7777' })
    expect(saved.whatsappNumbers).toEqual([expect.objectContaining({ value: '(11) 98888-7777' })])
  })

  it('não consulta o banco sem valor e falha quando o perfil não existe', async () => {
    await updateBusinessContact(userId, {})
    expect(mocks.one).not.toHaveBeenCalled()
    mocks.one.mockResolvedValueOnce(null)
    await expect(updateBusinessContact(userId, { address: 'Av. Nova, 200' })).rejects.toThrow(/Perfil não encontrado/)
  })
})
