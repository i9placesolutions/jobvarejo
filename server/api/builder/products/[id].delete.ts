import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-products-delete:${tenant.id}`, 30, 60_000)

  const productId = String(getRouterParam(event, 'id') || '').trim()
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'Product ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_products
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [productId, tenant.id]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  return { success: true }
})
