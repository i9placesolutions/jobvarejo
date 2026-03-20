import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-badge-styles-delete:${user.id}`, 30, 60_000)

  const styleId = String(getRouterParam(event, 'id') || '').trim()
  if (!styleId) {
    throw createError({ statusCode: 400, statusMessage: 'Badge style ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_badge_styles
     WHERE id = $1::uuid
     RETURNING id`,
    [styleId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Badge style not found' })
  }

  return { success: true }
})
