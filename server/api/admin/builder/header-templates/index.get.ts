import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-header-templates-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, category, height, elements, container_style,
            is_active, sort_order, created_at, updated_at
     FROM public.builder_header_templates
     ORDER BY sort_order ASC, name ASC`
  )

  return { headerTemplates: result.rows }
})
