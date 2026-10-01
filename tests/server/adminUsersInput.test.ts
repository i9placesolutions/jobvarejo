import { describe, expect, it } from 'vitest'
import { isTechnicalAdminEmail, parseManagedUserInput } from '../../server/utils/admin-users'

const sample = { name: 'Maria Silva', email: 'MARIA@example.com', whatsapp: '(64) 99999-1234', password: 'senha-inicial-forte' }

describe('cadastro administrativo de usuários', () => {
  it('identifica apenas endereços internos sem ocultar email real', () => {
    expect(isTechnicalAdminEmail('internal-11111111-1111-4111-8111-111111111111@jobvarejo.invalid')).toBe(true)
    expect(isTechnicalAdminEmail('internal-whatsapp-556935442251@jobvarejo.invalid')).toBe(true)
    expect(isTechnicalAdminEmail('maria@example.com')).toBe(false)
  })

  it('normaliza contato e permite configurar um editor sem promover permissões desconhecidas', () => {
    expect(parseManagedUserInput({ ...sample, role: 'editor', permissions: { videos: { edit: true }, admin: { view: true } } }, 'admin')).toMatchObject({
      email: 'maria@example.com',
      whatsapp: '+5564999991234',
      role: 'editor',
      permissions: { videos: { edit: true, view: true } }
    })
  })

  it('impede que um administrador crie outro administrador ou super administrador', () => {
    expect(() => parseManagedUserInput({ ...sample, role: 'admin' }, 'admin')).toThrow()
    expect(() => parseManagedUserInput({ ...sample, role: 'super_admin' }, 'super_admin')).toThrow()
    expect(parseManagedUserInput({ ...sample, role: 'admin' }, 'super_admin').role).toBe('admin')
  })

  it('exige nome de empresa para criar conta de cliente e preserva o nome normalizado', () => {
    expect(() => parseManagedUserInput({ role: 'user' }, 'admin')).toThrow()
    expect(parseManagedUserInput({ role: 'user', companyName: '  Mercado   Central  ' }, 'admin')).toMatchObject({
      companyName: 'Mercado Central', name: 'Mercado Central', email: '', whatsapp: '', password: '', hasPlatformAccess: false
    })
    expect(parseManagedUserInput({ ...sample, role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true }, 'admin').email).toBe('maria@example.com')
    expect(parseManagedUserInput({ name: 'Maria Silva', whatsapp: '(69) 3544-2251', password: 'senha-inicial-forte', role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true }, 'admin')).toMatchObject({ email: '', whatsapp: '+556935442251', hasPlatformAccess: true })
    expect(() => parseManagedUserInput({ ...sample, email: 'inválido', role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true }, 'admin')).toThrow()
    expect(parseManagedUserInput({ ...sample, role: 'user', companyName: 'Mercado Central' }, 'admin').hasPlatformAccess).toBe(true)
    expect(() => parseManagedUserInput({ role: 'user', companyName: 'Mercado Central', hasPlatformAccess: true }, 'admin')).toThrow()
  })
})
