import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-products-list:${tenant.id}`, 120, 60_000)

  const query = getQuery(event)
  const q = String(query.q || '').trim()

  const params: any[] = [tenant.id]
  let searchFilter = ''

  if (q) {
    searchFilter = ' AND name ILIKE $2'
    params.push(`%${q}%`)
  }

  const result = await pgQuery(
    `SELECT id, name, image, barcode, brand, category, is_active, created_at, updated_at
     FROM public.builder_products
     WHERE tenant_id = $1${searchFilter}
     ORDER BY name ASC
     LIMIT 100`,
    params
  )

  return { products: result.rows }
})
