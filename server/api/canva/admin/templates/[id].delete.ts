// Deletar template do banco (nao deleta do Canva)

import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-canva-templates-delete:${user.id}`, 30, 60_000)

  const templateId = String(getRouterParam(event, 'id') || '').trim()
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID e obrigatorio' })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.canva_templates
     WHERE id = $1::uuid
     RETURNING id`,
    [templateId]
  )

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Template nao encontrado' })
  }

  return { success: true }
})
