import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

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

  const theme = await pgOneOrNull(
    `INSERT INTO public.builder_themes
       (id, name, slug, thumbnail, background_image, is_premium, is_public,
        is_active, sort_order, category_name, tags, css_config, header_config,
        body_config, footer_config)
     VALUES
       ($1::uuid, $2, $3, $4, $5, $6::boolean, $7::boolean,
        $8::boolean, $9::int, $10, $11::text[], $12::jsonb, $13::jsonb,
        $14::jsonb, $15::jsonb)
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
      body?.css_config ? JSON.stringify(body.css_config) : null,
      body?.header_config ? JSON.stringify(body.header_config) : null,
      body?.body_config ? JSON.stringify(body.body_config) : null,
      body?.footer_config ? JSON.stringify(body.footer_config) : null
    ]
  )

  return { theme }
})
