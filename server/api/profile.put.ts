import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'
import {
  ensureBusinessProfileColumn,
  mergeBusinessProfile
} from '../utils/business-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `profile-put:${user.id}`, 60, 60_000)
  await ensureBusinessProfileColumn()

  const body = await readBody<Record<string, any>>(event)
  const current = await pgOneOrNull<{ business_profile: unknown }>(
    `select business_profile from public.profiles where id = $1 limit 1`,
    [user.id]
  )
  const incoming = body?.business_profile ?? body ?? {}
  const businessProfile = mergeBusinessProfile(current?.business_profile, incoming)

  const row = await pgOneOrNull<any>(
    `update public.profiles
        set business_profile = $1::jsonb,
            updated_at = timezone('utc', now())
      where id = $2
      returning id, email, name, avatar_url, role, created_at, updated_at, business_profile`,
    [JSON.stringify(businessProfile), user.id]
  )

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado' })
  }

  return row
})
