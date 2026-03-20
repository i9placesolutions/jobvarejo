import { randomUUID } from 'node:crypto'
import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-products-create:${tenant.id}`, 60, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const name = String(body?.name || '').trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Product name is required' })
  }

  const id = randomUUID()
  const product = await pgOneOrNull(
    `INSERT INTO public.builder_products
       (id, tenant_id, name, image, barcode, brand, category)
     VALUES
       ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id, tenant.id, name,
      body?.image || null,
      body?.barcode || null,
      body?.brand || null,
      body?.category || null
    ]
  )

  return { product }
})
