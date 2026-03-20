import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-themes-list:${tenant.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, slug, thumbnail, background_image, is_premium,
            category_name, tags, css_config, header_config, body_config,
            footer_config, sort_order
     FROM public.builder_themes
     WHERE is_active = true AND is_public = true
     ORDER BY sort_order ASC`
  )

  return { themes: result.rows }
})
