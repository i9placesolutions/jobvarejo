import { describe, expect, it } from 'vitest'
import { parseManagedUserInput } from '../../server/utils/admin-users'

const sample = { name: 'Maria Silva', email: 'MARIA@example.com', whatsapp: '(64) 99999-1234', password: 'senha-inicial-forte' }

describe('cadastro administrativo de usuários', () => {
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
})
