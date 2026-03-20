import { randomUUID } from 'node:crypto'
import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-create:${tenant.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()
  const title = String(body?.title || '').trim() || 'Novo Encarte'
  const themeId = body?.theme_id || null
  const modelId = body?.model_id || null
  const layoutId = body?.layout_id || null

  const flyer = await pgOneOrNull(
    `INSERT INTO public.builder_flyers
       (id, tenant_id, title, theme_id, model_id, layout_id)
     VALUES
       ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid)
     RETURNING *`,
    [id, tenant.id, title, themeId, modelId, layoutId]
  )

  return { flyer }
})
