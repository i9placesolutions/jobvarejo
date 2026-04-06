import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-card-templates-delete:${user.id}`, 30, 60_000)

  const templateId = String(getRouterParam(event, 'id') || '').trim()
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.builder_card_templates
     WHERE id = $1::uuid
     RETURNING id`,
    [templateId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Card template not found' })
  }

  return { success: true }
})
