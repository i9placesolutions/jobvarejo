import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-products-update:${tenant.id}`, 60, 60_000)

  const productId = String(getRouterParam(event, 'id') || '').trim()
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'Product ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys = ['name', 'image', 'barcode', 'brand', 'category', 'is_active'] as const
  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const key of allowedKeys) {
    if (key in body) {
      if (key === 'is_active') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
      } else {
        setClauses.push(`${key} = $${paramIndex}`)
      }
      values.push(body[key])
      paramIndex++
    }
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(productId, tenant.id)

  const product = await pgOneOrNull(
    `UPDATE public.builder_products
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
     RETURNING *`,
    values
  )

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  return { product }
})
