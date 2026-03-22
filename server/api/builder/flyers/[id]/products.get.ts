import { requireBuilderTenant, isBuilderAdmin } from '../../../../utils/builder-auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyer-products:${tenant.id}`, 120, 60_000)

  const admin = isBuilderAdmin(event)
  const flyerId = String(getRouterParam(event, 'id') || '').trim()
  if (!flyerId) {
    throw createError({ statusCode: 400, statusMessage: 'Flyer ID is required' })
  }

  // Verify flyer exists (admin can access any, tenant only their own)
  const flyer = admin
    ? await pgOneOrNull(
        `SELECT id FROM public.builder_flyers WHERE id = $1 LIMIT 1`,
        [flyerId]
      )
    : await pgOneOrNull(
        `SELECT id FROM public.builder_flyers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [flyerId, tenant.id]
      )
  if (!flyer) {
    throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
  }

  const result = await pgQuery(
    `SELECT * FROM public.builder_flyer_products
     WHERE flyer_id = $1
     ORDER BY position ASC`,
    [flyerId]
  )

  return { products: result.rows }
})
