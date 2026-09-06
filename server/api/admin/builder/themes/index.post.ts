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
  enforceRateLimit(event, `admin-themes-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const slug = String(body?.slug || '').trim()
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug is required' })
  }

  const modelIds = normalizeModelIds(body?.model_ids)

  const theme = await pgOneOrNull(
    `INSERT INTO public.builder_themes
       (id, name, slug, thumbnail, background_image, is_premium, is_public,
       is_active, sort_order, category_name, tags, model_ids, composition, css_config,
        header_config, body_config, footer_config)
     VALUES
       ($1::uuid, $2, $3, $4, $5, $6::boolean, $7::boolean,
       $8::boolean, $9::int, $10, $11::text[], $12::uuid[], $13::jsonb, $14::jsonb,
       $15::jsonb, $16::jsonb, $17::jsonb)
     RETURNING *`,
    [
      id,
      name,
      slug,
      body?.thumbnail || null,
      body?.background_image || null,
      body?.is_premium ?? false,
      body?.is_public ?? true,
      body?.is_active ?? true,
      body?.sort_order ?? 0,
      body?.category_name || null,
      body?.tags || null,
      modelIds,
      body?.composition ? JSON.stringify(body.composition) : '{}',
      body?.css_config ? JSON.stringify(body.css_config) : null,
      body?.header_config ? JSON.stringify(body.header_config) : null,
      body?.body_config ? JSON.stringify(body.body_config) : null,
      body?.footer_config ? JSON.stringify(body.footer_config) : null
    ]
  )

  return { theme }
})
