import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-models-delete:${user.id}`, 30, 60_000)

  const modelId = String(getRouterParam(event, 'id') || '').trim()
  if (!modelId) {
    throw createError({ statusCode: 400, statusMessage: 'Model ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_models
     WHERE id = $1::uuid
     RETURNING id`,
    [modelId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' })
  }

  return { success: true }
})
