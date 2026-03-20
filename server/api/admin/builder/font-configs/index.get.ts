import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-font-configs-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, family, weight, style, google_url, is_active, sort_order
     FROM public.builder_font_configs
     ORDER BY sort_order ASC, name ASC`
  )

  return { fontConfigs: result.rows }
})
