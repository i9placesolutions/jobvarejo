import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-layouts-list:${tenant.id}`, 120, 60_000)

  const query = getQuery(event)
  const modelId = String(query.model_id || '').trim()

  const params: any[] = []
  let modelFilter = ''

  if (modelId) {
    modelFilter = ' AND model_id = $1'
    params.push(modelId)
  }

  const result = await pgQuery(
    `SELECT id, name, products_per_page, columns, rows, grid_config,
            highlight_positions, sort_order, model_id
     FROM public.builder_layouts
     WHERE is_active = true${modelFilter}
     ORDER BY sort_order ASC`,
    params
  )

  return { layouts: result.rows }
})
