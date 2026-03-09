import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  enforceRateLimit(event, `projects-revision:${user.id}`, 240, 60_000)

  const query = getQuery(event)
  const id = String(query.id || '').trim()

  if (!id || !isUuid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid project id format' })
  }

  try {
    const row = await pgOneOrNull<{ id: string; updated_at: string | null }>(
      `select id, updated_at
       from public.projects
       where id = $1
         and user_id = $2
       limit 1`,
      [id, user.id]
    )

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    return row
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to fetch project revision' })
  }
})
