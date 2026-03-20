import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-pricetag-list:${tenant.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, css_config, sort_order
     FROM public.builder_price_tag_styles
     WHERE is_active = true AND is_global = true
     ORDER BY sort_order ASC`
  )

  return { priceTagStyles: result.rows }
})
