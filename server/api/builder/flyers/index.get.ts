import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-list:${tenant.id}`, 120, 60_000)

  const query = getQuery(event)
  const status = String(query.status || '').trim().toUpperCase()

  const allowedStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
  const params: any[] = [tenant.id]
  let statusFilter = ''

  if (status && allowedStatuses.includes(status)) {
    statusFilter = ' AND status = $2'
    params.push(status)
  }

  const result = await pgQuery(
    `SELECT id, title, status, start_date, end_date, category, snapshot_url,
            theme_id, model_id, layout_id, created_at, updated_at
     FROM public.builder_flyers
     WHERE tenant_id = $1${statusFilter}
     ORDER BY updated_at DESC
     LIMIT 50`,
    params
  )

  return { flyers: result.rows }
})
