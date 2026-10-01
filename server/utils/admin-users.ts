import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'
import { normalizeEditorPermissions, type EditorPermissions } from '../../shared/access-control'
import { normalizeEmail } from './auth-db'
import type { UserRole } from '~/types/auth'
import { createError } from 'h3'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MANAGED_ROLES: UserRole[] = ['admin', 'editor', 'user']
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isTechnicalAdminEmail = (value: unknown): boolean =>
  /^internal-(?:[0-9a-f-]+|whatsapp-\d+)@jobvarejo\.invalid$/i.test(String(value || '').trim())

export function parseManagedUserInput(body: Record<string, unknown> | null, actorRole: UserRole): {
  name: string
  email: string
  whatsapp: string
  password: string
  role: UserRole
  companyName: string
  hasPlatformAccess: boolean
  permissions: EditorPermissions
} {
  const input = body || {}
  const name = String(input.name || '').trim().replace(/\s+/g, ' ')
  const email = normalizeEmail(input.email)
  const whatsapp = normalizeBrazilWhatsApp(input.whatsapp)
  const password = String(input.password || '')
  const role = String(input.role || 'user') as UserRole
  const companyName = String(input.companyName || '').trim().replace(/\s+/g, ' ')
  const hasPlatformAccess = role !== 'user' || input.hasPlatformAccess === true ||
    (input.hasPlatformAccess === undefined && Boolean(input.email || input.whatsapp || input.password))
  if (!MANAGED_ROLES.includes(role) || (role === 'admin' && actorRole !== 'super_admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Nível de acesso não permitido.' })
  }
  if (role === 'user' && (companyName.length < 2 || companyName.length > 160)) {
    throw createError({ statusCode: 400, statusMessage: 'Nome da empresa inválido (2 a 160 caracteres).' })
  }
  if (hasPlatformAccess) {
    if (name.length < 2 || name.length > 120) throw createError({ statusCode: 400, statusMessage: 'Nome inválido (2 a 120 caracteres).' })
    if (role !== 'user' && (!EMAIL_PATTERN.test(email) || email.length > 255)) throw createError({ statusCode: 400, statusMessage: 'E-mail inválido.' })
    if (role === 'user' && email && (!EMAIL_PATTERN.test(email) || email.length > 255)) throw createError({ statusCode: 400, statusMessage: 'E-mail inválido.' })
    if (!whatsapp) throw createError({ statusCode: 400, statusMessage: 'WhatsApp de login inválido.' })
    if (password.length < 8 || password.length > 256) throw createError({ statusCode: 400, statusMessage: 'Senha inicial inválida (8 a 256 caracteres).' })
  }
  return { name: hasPlatformAccess ? name : companyName, email: hasPlatformAccess ? email : '', whatsapp: hasPlatformAccess ? whatsapp : '', password: hasPlatformAccess ? password : '', role, companyName, hasPlatformAccess, permissions: role === 'editor' ? normalizeEditorPermissions(input.permissions) : {} }
}
