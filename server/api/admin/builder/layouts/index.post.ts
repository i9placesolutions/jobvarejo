import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-layouts-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const layout = await pgOneOrNull(
    `INSERT INTO public.builder_layouts
       (id, name, products_per_page, columns, rows, grid_config,
        highlight_positions, is_active, sort_order, model_id)
     VALUES
       ($1::uuid, $2, $3::int, $4::int, $5::int, $6::jsonb,
        $7::int[], $8::boolean, $9::int, $10::uuid)
     RETURNING *`,
    [
      id,
      name,
      body?.products_per_page ?? null,
      body?.columns ?? null,
      body?.rows ?? null,
      body?.grid_config ? JSON.stringify(body.grid_config) : null,
      body?.highlight_positions || null,
      body?.is_active ?? true,
      body?.sort_order ?? 0,
      body?.model_id || null
    ]
  )

  return { layout }
})
