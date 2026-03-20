import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-layouts-delete:${user.id}`, 30, 60_000)

  const layoutId = String(getRouterParam(event, 'id') || '').trim()
  if (!layoutId) {
    throw createError({ statusCode: 400, statusMessage: 'Layout ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_layouts
     WHERE id = $1::uuid
     RETURNING id`,
    [layoutId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' })
  }

  return { success: true }
})
