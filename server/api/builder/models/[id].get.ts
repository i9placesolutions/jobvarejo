import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-model-get:${tenant.id}`, 120, 60_000)

  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Model ID is required' })
  }

  const model = await pgOneOrNull(
    `SELECT id, name, type, width, height, aspect_ratio, sort_order
     FROM public.builder_models
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [id]
  )

  if (!model) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' })
  }

  return model
})
