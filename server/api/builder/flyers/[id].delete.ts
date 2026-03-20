import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-delete:${tenant.id}`, 30, 60_000)

  const flyerId = String(getRouterParam(event, 'id') || '').trim()
  if (!flyerId) {
    throw createError({ statusCode: 400, statusMessage: 'Flyer ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_flyers
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [flyerId, tenant.id]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
  }

  return { success: true }
})
