import { requireAdminUser } from '../../../utils/auth'
import { getProfileById } from '../../../utils/auth-db'
import { MANAGED_ROLES, UUID_PATTERN } from '../../../utils/admin-users'
import { hashPassword } from '../../../utils/password'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'
import { normalizeEditorPermissions } from '../../../../shared/access-control'
import type { UserRole } from '~/types/auth'

export default defineEventHandler(async (event) => {
  const { user, role: actorRole } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-users-update:${user.actorId}`, 60, 60_000)
  const id = String(getRouterParam(event, 'id') || '')
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Usuário inválido.' })
  const current = await getProfileById(id)
  if (!current || current.role === 'super_admin') throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado.' })
  if (current.role === 'admin' && actorRole !== 'super_admin') throw createError({ statusCode: 403, statusMessage: 'Somente o super administrador gerencia administradores.' })
  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Status inválido.' })
  const role = String(body.role ?? current.role) as UserRole
  if (!MANAGED_ROLES.includes(role) || (role === 'admin' && actorRole !== 'super_admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Nível de acesso não permitido.' })
  }
  if (id === user.actorId && (body.is_active === false || role !== current.role)) {
    throw createError({ statusCode: 409, statusMessage: 'Você não pode desativar ou alterar seu próprio nível.' })
  }
  const name = body.name === undefined ? current.name : String(body.name || '').trim().replace(/\s+/g, ' ')
  if (!name || name.length < 2 || name.length > 120) throw createError({ statusCode: 400, statusMessage: 'Nome inválido.' })
  const password = body.password === undefined ? null : String(body.password || '')
  if (password !== null && (password.length < 8 || password.length > 256)) {
    throw createError({ statusCode: 400, statusMessage: 'Nova senha inválida (8 a 256 caracteres).' })
  }
  const active = body.is_active === undefined ? current.is_active !== false : body.is_active === true
  const permissions = role === 'editor'
    ? normalizeEditorPermissions(body.permissions === undefined ? current.editor_permissions : body.permissions)
    : {}
  const passwordHash = password === null ? null : await hashPassword(password)
  const updated = await pgOneOrNull<any>(`
    UPDATE public.profiles
       SET name = $2, role = $3::user_role, is_active = $4,
           editor_permissions = $5::jsonb,
           password_hash = COALESCE($6, password_hash),
           reset_token_hash = CASE WHEN $6 IS NULL THEN reset_token_hash ELSE NULL END,
           reset_token_expires_at = CASE WHEN $6 IS NULL THEN reset_token_expires_at ELSE NULL END,
           updated_at = now()
     WHERE id = $1
     RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
               is_active, editor_permissions AS permissions, created_at, last_login_at
  `, [id, name, role, active, JSON.stringify(permissions), passwordHash])
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado.' })
  return { user: updated }
})
