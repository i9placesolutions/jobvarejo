import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-font-configs-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const family = String(body?.family || '').trim()
  if (!family) {
    throw createError({ statusCode: 400, statusMessage: 'family is required' })
  }

  const fontConfig = await pgOneOrNull(
    `INSERT INTO public.builder_font_configs
       (id, name, family, weight, style, google_url, is_active, sort_order)
     VALUES
       ($1::uuid, $2, $3, $4, $5, $6, $7::boolean, $8::int)
     RETURNING *`,
    [
      id,
      name,
      family,
      body?.weight || null,
      body?.style || null,
      body?.google_url || null,
      body?.is_active ?? true,
      body?.sort_order ?? 0
    ]
  )

  return { fontConfig }
})
