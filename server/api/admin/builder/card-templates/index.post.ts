import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeModelIds = (value: unknown): string[] => {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'model_ids must be an array' })
  }

  const ids = Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)))
  if (ids.some(id => !UUID_PATTERN.test(id))) {
    throw createError({ statusCode: 400, statusMessage: 'model_ids contains an invalid model id' })
  }
  return ids
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-card-templates-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const modelIds = normalizeModelIds(body?.model_ids)

  const cardTemplate = await pgOneOrNull(
    `INSERT INTO public.builder_card_templates
       (id, name, thumbnail, category, elements, card_style, model_ids, is_active, sort_order)
     VALUES
       ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::uuid[], $8::boolean, $9::int)
     RETURNING *`,
    [
      id,
      name,
      body?.thumbnail || null,
      body?.category || 'geral',
      body?.elements ? JSON.stringify(body.elements) : '[]',
      body?.card_style ? JSON.stringify(body.card_style) : '{}',
      modelIds,
      body?.is_active ?? true,
      body?.sort_order ?? 0,
    ]
  )

  return { cardTemplate }
})
