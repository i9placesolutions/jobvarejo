import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-header-templates-list:${tenant.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, thumbnail, category, height, elements, container_style, sort_order
     FROM public.builder_header_templates
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`
  )

  return { headerTemplates: result.rows }
})
