import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-themes-delete:${user.id}`, 30, 60_000)

  const themeId = String(getRouterParam(event, 'id') || '').trim()
  if (!themeId) {
    throw createError({ statusCode: 400, statusMessage: 'Theme ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_themes
     WHERE id = $1::uuid
     RETURNING id`,
    [themeId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Theme not found' })
  }

  return { success: true }
})
