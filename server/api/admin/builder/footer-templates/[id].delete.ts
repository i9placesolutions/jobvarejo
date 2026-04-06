import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-footer-templates-delete:${user.id}`, 30, 60_000)

  const itemId = String(getRouterParam(event, 'id') || '').trim()
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'ID is required' })

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_footer_templates WHERE id = $1::uuid RETURNING id`, [itemId]
  )
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { success: true }
})
