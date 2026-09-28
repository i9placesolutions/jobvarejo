import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-tenants-list:${user.id}`, 120, 60_000)

  const query = getQuery(event)
  const search = String(query?.q || '').trim()

  const values: any[] = []
  let whereClause = ''

  if (search) {
    whereClause = `WHERE t.name ILIKE $1 OR t.email ILIKE $1`
    values.push(`%${search}%`)
  }

  const result = await pgQuery(
    `SELECT t.id,
            CASE WHEN COALESCE((p.business_profile->>'internalOnly')::boolean, false) THEN '' ELSE t.email END AS email,
            t.name, t.slug, t.logo, t.phone, t.whatsapp,
            t.plan, t.is_active, t.show_on_portal, t.created_at, t.updated_at,
            t.last_login_at
     FROM public.builder_tenants t
     LEFT JOIN public.profiles p ON p.id = t.id
     ${whereClause}
     ORDER BY t.created_at DESC`,
    values
  )

  return { tenants: result.rows }
})
