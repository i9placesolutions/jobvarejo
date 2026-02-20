import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const toBool = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `notifications-get:${user.id}`, 240, 60_000)

  const query = getQuery(event)
  const limitRaw = Number.parseInt(String(query.limit || ''), 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50
  const unreadOnly = toBool(query.unread)

  try {
    const params: any[] = [user.id]
    const whereParts = ['user_id = $1']
    if (unreadOnly) whereParts.push('read = false')

    params.push(limit)
    const sql = `
      select *
      from public.notifications
      where ${whereParts.join(' and ')}
      order by created_at desc
      limit $${params.length}
    `

    const { rows } = await pgQuery<any>(sql, params)
    return rows || []
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to list notifications' })
  }
})
