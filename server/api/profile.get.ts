import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `profile-get:${user.id}`, 240, 60_000)

  try {
    const row = await pgOneOrNull<any>(
      `select *
       from public.profiles
       where id = $1
       limit 1`,
      [user.id]
    )
    if (row) return row

    const metadata = (user.user_metadata && typeof user.user_metadata === 'object')
      ? user.user_metadata as Record<string, any>
      : {}
    const fallbackNameSource = String(metadata.name || metadata.full_name || user.email || 'Usuário')
    const fallbackName = (fallbackNameSource.split('@')[0] || fallbackNameSource).trim() || 'Usuário'

    return {
      id: user.id,
      email: user.email || null,
      name: fallbackName,
      avatar_url: metadata.avatar_url || metadata.picture || null,
      role: 'user'
    }
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to load profile' })
  }
})
