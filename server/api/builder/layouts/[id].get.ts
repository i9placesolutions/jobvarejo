import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-layout-get:${tenant.id}`, 120, 60_000)

  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Layout ID is required' })
  }

  const layout = await pgOneOrNull(
    `SELECT id, name, products_per_page, columns, rows, grid_config,
            highlight_positions, sort_order, model_id
     FROM public.builder_layouts
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [id]
  )

  if (!layout) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' })
  }

  return layout
})
