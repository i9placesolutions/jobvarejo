import { randomUUID } from 'node:crypto'
import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-models-create:${user.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  const model = await pgOneOrNull(
    `INSERT INTO public.builder_models
       (id, name, type, width, height, aspect_ratio, is_active, sort_order)
     VALUES
       ($1::uuid, $2, $3, $4::int, $5::int, $6, $7::boolean, $8::int)
     RETURNING *`,
    [
      id,
      name,
      body?.type || null,
      body?.width ?? null,
      body?.height ?? null,
      body?.aspect_ratio || null,
      body?.is_active ?? true,
      body?.sort_order ?? 0
    ]
  )

  return { model }
})
