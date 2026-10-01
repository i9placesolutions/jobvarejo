import { requireAdminUser } from '../../../utils/auth'
import { getProfileById } from '../../../utils/auth-db'
import { isTechnicalAdminEmail, MANAGED_ROLES, UUID_PATTERN, parseManagedUserInput } from '../../../utils/admin-users'
import { hashPassword } from '../../../utils/password'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull, pgTx } from '../../../utils/postgres'
import { normalizeEditorPermissions } from '../../../../shared/access-control'
import type { UserRole } from '~/types/auth'

export default defineEventHandler(async (event) => {
  const { user, role: actorRole } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-users-update:${user.actorId}`, 60, 60_000)
  const id = String(getRouterParam(event, 'id') || '')
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Usuário inválido.' })
  const current = await getProfileById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado.' })
  if (current.role === 'super_admin' && actorRole !== 'super_admin') throw createError({ statusCode: 403, statusMessage: 'Somente o super administrador edita super administradores.' })
  if (current.role === 'admin' && actorRole !== 'super_admin') throw createError({ statusCode: 403, statusMessage: 'Somente o super administrador gerencia administradores.' })
  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Status inválido.' })
  const role = String(body.role ?? current.role) as UserRole
  if (current.role === 'super_admin' && (role !== 'super_admin' || body.is_active === false)) {
    throw createError({ statusCode: 409, statusMessage: 'O super administrador deve manter seu nível e permanecer ativo.' })
  }
  const preservingSuperAdmin = current.role === 'super_admin' && role === 'super_admin' && actorRole === 'super_admin'
  if ((!MANAGED_ROLES.includes(role) && !preservingSuperAdmin) || (role === 'admin' && actorRole !== 'super_admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Nível de acesso não permitido.' })
  }
  const internalOnly = current.business_profile?.internalOnly === true
  if (internalOnly && role !== 'user') {
    throw createError({ statusCode: 400, statusMessage: 'Empresa interna deve permanecer como conta de cliente.' })
  }
  if (!internalOnly && body.hasPlatformAccess === false) {
    throw createError({ statusCode: 400, statusMessage: 'A revogação de acesso deve ser feita pela desativação da conta.' })
  }
  if (id === user.actorId && (body.is_active === false || role !== current.role)) {
    throw createError({ statusCode: 409, statusMessage: 'Você não pode desativar ou alterar seu próprio nível.' })
  }
  const name = body.name === undefined ? current.name : String(body.name || '').trim().replace(/\s+/g, ' ')
  if ((!internalOnly || body.hasPlatformAccess === true) && (!name || name.length < 2 || name.length > 120)) {
    throw createError({ statusCode: 400, statusMessage: 'Nome inválido.' })
  }
  const password = body.password === undefined ? null : String(body.password || '')
  if (password !== null && (password.length < 8 || password.length > 256)) {
    throw createError({ statusCode: 400, statusMessage: 'Nova senha inválida (8 a 256 caracteres).' })
  }
  const active = body.is_active === undefined ? current.is_active !== false : body.is_active === true
  const companyName = role === 'user' || role === 'super_admin'
    ? String(body.companyName ?? current.business_profile?.companyName ?? '').trim().replace(/\s+/g, ' ')
    : ''
  const updateCompanyName = role === 'user' || (role === 'super_admin' && body.companyName !== undefined)
  if (updateCompanyName && (role === 'user' || companyName.length > 0) && (companyName.length < 2 || companyName.length > 160)) {
    throw createError({ statusCode: 400, statusMessage: 'Nome da empresa inválido (2 a 160 caracteres).' })
  }
  if (internalOnly && body.hasPlatformAccess === true) {
    const access = parseManagedUserInput({ ...body, role: 'user', companyName, hasPlatformAccess: true }, actorRole)
    // A identidade interna já tem um email técnico único; promovê-la não deve
    // exigir nem substituir esse valor por um email inexistente.
    const accountEmail = access.email || current.email
    const passwordHash = await hashPassword(access.password)
    try {
      const promoted = await pgTx(async (client) => {
        const relation = await client.query<{ relation: string | null }>("SELECT to_regclass('auth.users')::text AS relation")
        if (relation.rows[0]?.relation) {
          await client.query(`UPDATE auth.users SET email = $2, raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', $3::text, 'email', $2::text), updated_at = now() WHERE id = $1`, [id, accountEmail, access.name])
        }
        const result = await client.query<any>(`
          UPDATE public.profiles
             SET name = $2, email = $3, login_whatsapp = $4,
                 login_whatsapp_verified_at = now(), password_hash = $5, is_active = $7,
                 business_profile = COALESCE(business_profile, '{}'::jsonb) || jsonb_build_object('companyName', $6::text, 'internalOnly', false),
                 updated_at = now()
           WHERE id = $1
           RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
                     is_active, editor_permissions AS permissions,
                     business_profile->>'companyName' AS company_name,
                     false AS internal_only, created_at, last_login_at
        `, [id, access.name, accountEmail, access.whatsapp, passwordHash, companyName, active])
        if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: 'Empresa não encontrada.' })
        const builder = await client.query<{ relation: string | null }>("SELECT to_regclass('public.builder_tenants')::text AS relation")
        if (builder.rows[0]?.relation) {
          // O Builder usa a sessão principal; não duplicar o hash evita senha antiga após reset.
          await client.query(`UPDATE public.builder_tenants SET email = $2, name = $3, is_active = $4, updated_at = now() WHERE id = $1`, [id, accountEmail, companyName, active])
        }
        return result.rows[0]
      })
      return { user: { ...promoted, email: isTechnicalAdminEmail(promoted.email) ? '' : promoted.email } }
    } catch (error: any) {
      if (String(error?.code || '') === '23505') throw createError({ statusCode: 409, statusMessage: 'E-mail ou WhatsApp já cadastrado.' })
      throw error
    }
  }
  if (internalOnly && body.password !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Empresa interna não possui senha de acesso.' })
  }
  const permissions = role === 'editor'
    ? normalizeEditorPermissions(body.permissions === undefined ? current.editor_permissions : body.permissions)
    : {}
  const passwordHash = password === null ? null : await hashPassword(password)
  // O super admin conserva nível/status/permissões. Seu cadastro também deve
  // funcionar nos bancos legados sem as colunas da migração de acessos.
  const params: unknown[] = [id, internalOnly ? companyName : name, passwordHash, updateCompanyName ? companyName : null]
  const accessUpdate = preservingSuperAdmin ? '' : ', role = $5::public.user_role, is_active = $6, editor_permissions = $7::jsonb'
  if (!preservingSuperAdmin) params.push(role, active, JSON.stringify(permissions))
  const updated = await pgOneOrNull<any>(`
    UPDATE public.profiles
       SET name = $2,
           business_profile = CASE WHEN $4::text IS NOT NULL
             THEN COALESCE(business_profile, '{}'::jsonb) || jsonb_build_object('companyName', $4::text)
             ELSE business_profile END,
           password_hash = COALESCE($3::text, password_hash),
           reset_token_hash = CASE WHEN $3::text IS NULL THEN reset_token_hash ELSE NULL END,
           reset_token_expires_at = CASE WHEN $3::text IS NULL THEN reset_token_expires_at ELSE NULL END
           ${accessUpdate},
           updated_at = now()
     WHERE id = $1
     RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
               COALESCE((to_jsonb(profiles)->>'is_active')::boolean, true) AS is_active,
               COALESCE(to_jsonb(profiles)->'editor_permissions', '{}'::jsonb) AS permissions,
               business_profile->>'companyName' AS company_name,
               COALESCE((business_profile->>'internalOnly')::boolean, false) AS internal_only,
               created_at, last_login_at
  `, params)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Usuário não encontrado.' })
  return { user: { ...updated, email: internalOnly ? '' : updated.email } }
})
