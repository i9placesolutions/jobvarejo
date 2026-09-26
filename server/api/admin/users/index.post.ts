import { requireAdminUser } from '../../../utils/auth'
import { createProfileWithPassword, ensureAuthColumns, getProfileByEmail, getProfileByWhatsApp } from '../../../utils/auth-db'
import { parseManagedUserInput } from '../../../utils/admin-users'
import { hashPassword } from '../../../utils/password'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user, role: actorRole } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-users-create:${user.actorId}`, 15, 60_000)
  const data = parseManagedUserInput(await readBody<Record<string, unknown>>(event), actorRole)
  await ensureAuthColumns()
  const [existingEmail, existingWhatsApp] = await Promise.all([
    getProfileByEmail(data.email), getProfileByWhatsApp(data.whatsapp)
  ])
  if (existingEmail || existingWhatsApp) throw createError({ statusCode: 409, statusMessage: 'E-mail ou WhatsApp já cadastrado.' })

  try {
    const created = await createProfileWithPassword({
      name: data.name,
      email: data.email,
      whatsapp: data.whatsapp,
      passwordHash: await hashPassword(data.password),
      role: data.role
    })
    const updated = await pgOneOrNull<any>(`
      UPDATE public.profiles
         SET editor_permissions = $2::jsonb, updated_at = now()
       WHERE id = $1
       RETURNING id, name, email, login_whatsapp AS whatsapp, role::text AS role,
                 is_active, editor_permissions AS permissions, created_at, last_login_at
    `, [created.id, JSON.stringify(data.permissions)])
    if (!updated) throw createError({ statusCode: 500, statusMessage: 'Não foi possível concluir o cadastro.' })
    return { user: updated }
  } catch (error: any) {
    if (String(error?.code || '') === '23505') throw createError({ statusCode: 409, statusMessage: 'E-mail ou WhatsApp já cadastrado.' })
    throw error
  }
})
