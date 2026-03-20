import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-badge-list:${tenant.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, type, css_config, sort_order
     FROM public.builder_badge_styles
     WHERE is_active = true AND is_global = true
     ORDER BY sort_order ASC`
  )

  return { badgeStyles: result.rows }
})
