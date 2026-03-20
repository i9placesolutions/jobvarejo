import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-tenants-get:${user.id}`, 120, 60_000)

  const tenantId = String(getRouterParam(event, 'id') || '').trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant ID is required' })
  }

  const tenant = await pgOneOrNull(
    `SELECT t.id, t.email, t.name, t.slug, t.logo, t.phone, t.whatsapp,
            t.plan, t.is_active, t.show_on_portal, t.created_at, t.updated_at,
            t.last_login_at,
            (SELECT COUNT(*)::int FROM public.builder_flyers f WHERE f.tenant_id = t.id) AS flyer_count
     FROM public.builder_tenants t
     WHERE t.id = $1::uuid`,
    [tenantId]
  )

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  return { tenant }
})
