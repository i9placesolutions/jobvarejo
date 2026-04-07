import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-segments-create:${user.id}`, 30, 60_000)

  const body = await readBody(event)
  const { name, slug, icon, description, is_active, sort_order } = body

  if (!name?.trim()) {
    throw createError({ statusCode: 400, message: 'Nome e obrigatorio' })
  }

  const result = await pgQuery(
    `INSERT INTO public.builder_segments (name, slug, icon, description, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, slug, icon, description, is_active, sort_order`,
    [name, slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), icon || '📦', description || '', is_active !== false, sort_order || 0],
  )

  return result.rows[0]
})
