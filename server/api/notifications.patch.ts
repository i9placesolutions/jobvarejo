import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const parseIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const raw of value) {
    const id = String(raw || '').trim()
    if (!id) continue
    if (!isUuid(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid notification id format in ids list' })
    }
    unique.add(id)
  }
  return Array.from(unique)
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `notifications-patch:${user.id}`, 180, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = String(body?.id || '').trim()
  const ids = parseIdList(body?.ids)
  const markAll = Boolean(body?.mark_all)
  const nextRead = body?.read == null ? true : Boolean(body?.read)

  if (!id && ids.length === 0 && !markAll) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide id, ids, or mark_all to update notifications'
    })
  }

  if (id) {
    if (!isUuid(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid notification id format' })

    try {
      const row = await pgOneOrNull<any>(
        `update public.notifications
         set read = $1,
             updated_at = timezone('utc', now())
         where id = $2
           and user_id = $3
         returning *`,
        [nextRead, id, user.id]
      )
      if (!row) throw createError({ statusCode: 404, statusMessage: 'Notification not found' })

      return { success: true, notification: row }
    } catch (error: any) {
      if (error?.statusCode) throw error
      throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to update notification' })
    }
  }

  try {
    if (ids.length > 0) {
      const { rows } = await pgQuery<any>(
        `update public.notifications
         set read = $1,
             updated_at = timezone('utc', now())
         where user_id = $2
           and id = any($3::uuid[])
         returning id, read`,
        [nextRead, user.id, ids]
      )
      return { success: true, count: rows.length, notifications: rows }
    }

    const { rows } = await pgQuery<any>(
      `update public.notifications
       set read = $1,
           updated_at = timezone('utc', now())
       where user_id = $2
       returning id, read`,
      [nextRead, user.id]
    )
    return { success: true, count: rows.length, notifications: rows }
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to update notifications' })
  }
})
