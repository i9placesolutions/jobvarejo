import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-segments-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, slug, icon, description, is_active, sort_order
     FROM public.builder_segments
     ORDER BY sort_order ASC, name ASC`
  )

  return result.rows
})
