import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-footer-templates-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()
  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const item = await pgOneOrNull(
    `INSERT INTO public.builder_footer_templates
       (id, name, thumbnail, category, height, elements, container_style, is_active, sort_order)
     VALUES ($1::uuid, $2, $3, $4, $5::int, $6::jsonb, $7::jsonb, $8::boolean, $9::int)
     RETURNING *`,
    [id, name, body?.thumbnail || null, body?.category || 'geral',
     body?.height ?? 180, body?.elements ? JSON.stringify(body.elements) : '[]',
     body?.container_style ? JSON.stringify(body.container_style) : '{}',
     body?.is_active ?? true, body?.sort_order ?? 0]
  )

  return { footerTemplate: item }
})
