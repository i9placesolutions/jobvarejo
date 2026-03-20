import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-badge-styles-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, type, css_config, is_global, is_active, sort_order
     FROM public.builder_badge_styles
     ORDER BY sort_order ASC, name ASC`
  )

  return { badgeStyles: result.rows }
})
