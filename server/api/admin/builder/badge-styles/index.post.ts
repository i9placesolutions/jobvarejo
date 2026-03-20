import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-badge-styles-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const style = await pgOneOrNull(
    `INSERT INTO public.builder_badge_styles
       (id, name, thumbnail, type, css_config, is_global, is_active, sort_order)
     VALUES
       ($1::uuid, $2, $3, $4, $5::jsonb, $6::boolean, $7::boolean, $8::int)
     RETURNING *`,
    [
      id,
      name,
      body?.thumbnail || null,
      body?.type || null,
      body?.css_config ? JSON.stringify(body.css_config) : null,
      body?.is_global ?? true,
      body?.is_active ?? true,
      body?.sort_order ?? 0
    ]
  )

  return { badgeStyle: style }
})
