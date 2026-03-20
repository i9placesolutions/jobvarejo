import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-font-configs-delete:${user.id}`, 30, 60_000)

  const configId = String(getRouterParam(event, 'id') || '').trim()
  if (!configId) {
    throw createError({ statusCode: 400, statusMessage: 'Font config ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_font_configs
     WHERE id = $1::uuid
     RETURNING id`,
    [configId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Font config not found' })
  }

  return { success: true }
})
