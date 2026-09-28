import { requireAdminUser } from '../../../utils/auth'
import { createProfileWithPassword, ensureAuthColumns, getProfileByEmail, getProfileByWhatsApp } from '../../../utils/auth-db'
import { parseManagedUserInput } from '../../../utils/admin-users'
import { hashPassword } from '../../../utils/password'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgTx } from '../../../utils/postgres'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { user, role: actorRole } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-users-create:${user.actorId}`, 15, 60_000)
  const data = parseManagedUserInput(await readBody<Record<string, unknown>>(event), actorRole)
  await ensureAuthColumns()
  if (data.hasPlatformAccess) {
    const [existingEmail, existingWhatsApp] = await Promise.all([
      getProfileByEmail(data.email), getProfileByWhatsApp(data.whatsapp)
    ])
    if (existingEmail || existingWhatsApp) throw createError({ statusCode: 409, statusMessage: 'E-mail ou WhatsApp já cadastrado.' })
  }

  try {
    const passwordHash = data.hasPlatformAccess ? await hashPassword(data.password) : null
    // A identidade técnica mantém as FKs de conteúdo sem oferecer login.
    const accountEmail = data.hasPlatformAccess ? data.email : `internal-${randomUUID()}@jobvarejo.invalid`
    const updated = await pgTx(async (client) => {
      const created = await createProfileWithPassword({
        name: data.name,
        email: accountEmail,
        whatsapp: data.hasPlatformAccess ? data.whatsapp : null,
        passwordHash,
        role: data.role
      }, client)
      const result = await client.query<any>(`
      UPDATE public.profiles
         SET editor_permissions = $2::jsonb,
             business_profile = CASE WHEN $3 <> ''
               THEN COALESCE(business_profile, '{}'::jsonb) || jsonb_build_object('companyName', $3::text, 'internalOnly', $4::boolean)
               ELSE business_profile END,
             updated_at = now()
       WHERE id = $1
       RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
                 is_active, editor_permissions AS permissions,
                 business_profile->>'companyName' AS company_name,
                 COALESCE((business_profile->>'internalOnly')::boolean, false) AS internal_only,
                 created_at, last_login_at
      `, [created.id, JSON.stringify(data.permissions), data.companyName, !data.hasPlatformAccess])
      const saved = result.rows[0]
      if (!saved) throw createError({ statusCode: 500, statusMessage: 'Não foi possível concluir o cadastro.' })
      return saved
    })
    return { user: { ...updated, email: data.hasPlatformAccess ? updated.email : '' } }
  } catch (error: any) {
    if (String(error?.code || '') === '23505') throw createError({ statusCode: 409, statusMessage: 'E-mail ou WhatsApp já cadastrado.' })
    throw error
  }
})
