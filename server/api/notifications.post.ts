import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgQuery } from '../utils/postgres'

const VALID_TYPES = new Set(['info', 'success', 'warning', 'error', 'share', 'project'])

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `notifications-post:${user.id}`, 90, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const title = String(body?.title || '').trim()
  const message = String(body?.message || '').trim()
  const typeRaw = String(body?.type || 'info').trim().toLowerCase()
  const type = VALID_TYPES.has(typeRaw) ? typeRaw : 'info'

  if (!title) throw createError({ statusCode: 400, statusMessage: 'title is required' })
  if (!message) throw createError({ statusCode: 400, statusMessage: 'message is required' })
  if (title.length > 200) throw createError({ statusCode: 400, statusMessage: 'title too long (max 200 chars)' })
  if (message.length > 2000) throw createError({ statusCode: 400, statusMessage: 'message too long (max 2000 chars)' })

  const metadata =
    body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {}

  try {
    const { rows } = await pgQuery<any>(
      `insert into public.notifications
         (user_id, title, message, type, metadata)
       values
         ($1, $2, $3, $4, $5::jsonb)
       returning *`,
      [user.id, title, message, type, metadata]
    )

    return { success: true, notification: rows[0] || null }
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to create notification' })
  }
})
