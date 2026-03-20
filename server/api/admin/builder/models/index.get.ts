import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-models-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, type, width, height, aspect_ratio, is_active, sort_order
     FROM public.builder_models
     ORDER BY sort_order ASC, name ASC`
  )

  return { models: result.rows }
})
