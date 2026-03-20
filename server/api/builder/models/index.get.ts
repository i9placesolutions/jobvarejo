import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-models-list:${tenant.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, type, width, height, aspect_ratio, sort_order
     FROM public.builder_models
     WHERE is_active = true
     ORDER BY sort_order ASC`
  )

  return { models: result.rows }
})
