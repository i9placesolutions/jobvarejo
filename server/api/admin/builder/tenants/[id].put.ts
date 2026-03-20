import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-tenants-update:${user.id}`, 60, 60_000)

  const tenantId = String(getRouterParam(event, 'id') || '').trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, statusMessage: 'Tenant ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    slug: 'text',
    logo: 'text',
    phone: 'text',
    whatsapp: 'text',
    plan: 'text',
    is_active: 'boolean',
    show_on_portal: 'boolean'
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, castType] of Object.entries(allowedKeys)) {
    if (key in body) {
      const value = body[key]
      if (castType === 'boolean') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
        values.push(value)
      } else {
        setClauses.push(`${key} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(tenantId)

  const tenant = await pgOneOrNull(
    `UPDATE public.builder_tenants
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!tenant) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  return { tenant }
})
