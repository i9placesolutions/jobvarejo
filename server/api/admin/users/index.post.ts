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
      if (data.role === 'editor') {
        const access = await client.query<{ supported: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.profiles'::regclass
               AND attname = 'editor_permissions' AND NOT attisdropped
          ) AS supported
        `)
        if (!access.rows[0]?.supported) throw createError({ statusCode: 503, statusMessage: 'O cadastro de editores requer a atualização do banco de acessos.' })
      }
      const created = await createProfileWithPassword({
        name: data.name,
        email: accountEmail,
        whatsapp: data.hasPlatformAccess ? data.whatsapp : null,
        passwordHash,
        role: data.role
      }, client)
      const params: unknown[] = [created.id, data.companyName, !data.hasPlatformAccess]
      const permissionsUpdate = data.role === 'editor' ? ', editor_permissions = $4::jsonb' : ''
      if (data.role === 'editor') params.push(JSON.stringify(data.permissions))
      const result = await client.query<any>(`
      UPDATE public.profiles
         SET business_profile = CASE WHEN $2::text <> ''
               THEN COALESCE(business_profile, '{}'::jsonb) || jsonb_build_object('companyName', $2::text, 'internalOnly', $3::boolean)
               ELSE business_profile END
             ${permissionsUpdate},
             updated_at = now()
       WHERE id = $1
       RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
                 COALESCE((to_jsonb(profiles)->>'is_active')::boolean, true) AS is_active,
                 COALESCE(to_jsonb(profiles)->'editor_permissions', '{}'::jsonb) AS permissions,
                 business_profile->>'companyName' AS company_name,
                 COALESCE((business_profile->>'internalOnly')::boolean, false) AS internal_only,
                 created_at, last_login_at
      `, params)
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
