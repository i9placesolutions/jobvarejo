import { requireBuilderTenant, isBuilderAdmin } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-get:${tenant.id}`, 120, 60_000)

  const admin = isBuilderAdmin(event)
  const flyerId = String(getRouterParam(event, 'id') || '').trim()
  if (!flyerId) {
    throw createError({ statusCode: 400, statusMessage: 'Flyer ID is required' })
  }

  const flyer = admin
    ? await pgOneOrNull(
        `SELECT * FROM public.builder_flyers WHERE id = $1 LIMIT 1`,
        [flyerId]
      )
    : await pgOneOrNull(
        `SELECT * FROM public.builder_flyers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [flyerId, tenant.id]
      )

  if (!flyer) {
    throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
  }

  const productsResult = await pgQuery(
    `SELECT fp.*, bp.name AS product_name, bp.image AS product_image,
            bp.barcode AS product_barcode, bp.brand AS product_brand
     FROM public.builder_flyer_products fp
     LEFT JOIN public.builder_products bp ON bp.id = fp.product_id
     WHERE fp.flyer_id = $1
     ORDER BY fp.position ASC`,
    [flyerId]
  )

  return { flyer, products: productsResult.rows }
})
