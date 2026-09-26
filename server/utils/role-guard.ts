import { createError } from 'h3'

export function assertSuperAdminRole(role: unknown): asserts role is 'super_admin' {
  if (role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'Acesso exclusivo para super administrador.' })
  }
}
