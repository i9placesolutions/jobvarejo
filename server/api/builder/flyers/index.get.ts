import { requireBuilderTenant, isBuilderAdmin } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-list:${tenant.id}`, 120, 60_000)

  const admin = isBuilderAdmin(event)
  const query = getQuery(event)
  const status = String(query.status || '').trim().toUpperCase()
  const allowedStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

  if (admin) {
    // Admin sees all flyers across all tenants
    const params: any[] = []
    let where = ''
    if (status && allowedStatuses.includes(status)) {
      where = 'WHERE status = $1'
      params.push(status)
    }

    const result = await pgQuery(
      `SELECT f.id, f.title, f.status, f.start_date, f.end_date, f.category, f.snapshot_url,
              f.theme_id, f.model_id, f.layout_id, f.tenant_id, f.created_at, f.updated_at,
              t.name as tenant_name
       FROM public.builder_flyers f
       LEFT JOIN public.builder_tenants t ON t.id = f.tenant_id
       ${where}
       ORDER BY f.updated_at DESC
       LIMIT 200`,
      params
    )
    return { flyers: result.rows }
  }

  // Regular tenant sees only their own flyers
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
