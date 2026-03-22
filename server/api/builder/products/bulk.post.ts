import { randomUUID } from 'node:crypto'
import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-products-bulk:${tenant.id}`, 10, 60_000)

  const body = await readBody<{ products: Array<{ name: string; brand?: string; category?: string }> }>(event)

  if (!body?.products || !Array.isArray(body.products) || body.products.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Products array is required' })
  }

  if (body.products.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum 200 products per batch' })
  }

  // Filter valid products (must have name)
  const validProducts = body.products
    .map(p => ({
      name: String(p.name || '').trim(),
      brand: String(p.brand || '').trim() || null,
      category: String(p.category || '').trim() || null,
    }))
    .filter(p => p.name.length > 0)

  if (validProducts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid products found' })
  }

  // Build multi-row INSERT
  const values: any[] = []
  const placeholders: string[] = []
  let paramIdx = 1

  for (const p of validProducts) {
    const id = randomUUID()
    placeholders.push(`($${paramIdx}::uuid, $${paramIdx + 1}::uuid, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`)
    values.push(id, tenant.id, p.name, p.brand, p.category)
    paramIdx += 5
  }

  const result = await pgQuery(
    `INSERT INTO public.builder_products (id, tenant_id, name, brand, category)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  )

  return { products: result.rows, count: result.rows.length }
})
