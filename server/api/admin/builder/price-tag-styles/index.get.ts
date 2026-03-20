import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-price-tag-styles-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, css_config, is_global, is_active, sort_order
     FROM public.builder_price_tag_styles
     ORDER BY sort_order ASC, name ASC`
  )

  return { priceTagStyles: result.rows }
})
