import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { ensureLabelCatalogPreview } from '../../../utils/label-catalog-preview'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `label-template-preview:${user.id}`, 120, 60_000)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const templateId = String(getRouterParam(event, 'id') || '').trim()
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(templateId)) {
    throw createError({ statusCode: 400, statusMessage: 'ID de etiqueta inválido.' })
  }

  const cropAlpha = String(getQuery(event).crop || '') === '1'
  return ensureLabelCatalogPreview(user.id, templateId, cropAlpha)
})
