import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-card-templates-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const cardTemplate = await pgOneOrNull(
    `INSERT INTO public.builder_card_templates
       (id, name, thumbnail, category, elements, card_style, is_active, sort_order)
     VALUES
       ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::boolean, $8::int)
     RETURNING *`,
    [
      id,
      name,
      body?.thumbnail || null,
      body?.category || 'geral',
      body?.elements ? JSON.stringify(body.elements) : '[]',
      body?.card_style ? JSON.stringify(body.card_style) : '{}',
      body?.is_active ?? true,
      body?.sort_order ?? 0,
    ]
  )

  return { cardTemplate }
})
