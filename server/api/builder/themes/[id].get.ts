import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-theme-get:${tenant.id}`, 120, 60_000)

  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Theme ID is required' })
  }

  const theme = await pgOneOrNull(
    `SELECT id, name, slug, thumbnail, background_image, is_premium,
            category_name, tags, css_config, header_config, body_config,
            footer_config, sort_order
     FROM public.builder_themes
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [id]
  )

  if (!theme) {
    throw createError({ statusCode: 404, statusMessage: 'Theme not found' })
  }

  return theme
})
