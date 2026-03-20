import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-themes-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, slug, thumbnail, background_image, is_premium, is_public,
            is_active, sort_order, category_name, tags, css_config, header_config,
            body_config, footer_config, created_at, updated_at
     FROM public.builder_themes
     ORDER BY sort_order ASC, name ASC`
  )

  return { themes: result.rows }
})
