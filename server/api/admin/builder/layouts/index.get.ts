import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-layouts-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT id, name, products_per_page, columns, rows, grid_config,
            highlight_positions, is_active, sort_order, model_id
     FROM public.builder_layouts
     ORDER BY sort_order ASC, name ASC`
  )

  return { layouts: result.rows }
})
