import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const toBool = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `profiles-get:${user.id}`, 180, 60_000)

  const query = getQuery(event)
  const limitRaw = Number.parseInt(String(query.limit || ''), 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20
  const excludeSelf = toBool(query.exclude_self)
  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  try {
    if (isAdmin && excludeSelf) {
      const { rows } = await pgQuery<any>(
        `select id, name, email, avatar_url
         from public.profiles
         where id <> $1
         order by created_at desc nulls last
         limit $2`,
        [user.id, limit]
      )
      return rows || []
    }

    if (isAdmin) {
      const { rows } = await pgQuery<any>(
        `select id, name, email, avatar_url
         from public.profiles
         order by created_at desc nulls last
         limit $1`,
        [limit]
      )
      return rows || []
    }

    const { rows } = await pgQuery<any>(
      `select id, name, email, avatar_url
       from public.profiles
       where id = $1
       limit 1`,
      [user.id]
    )
    if (excludeSelf) return []
    return rows || []
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list profiles' })
  }
})
