import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getProjectCatalogPreview } from '../../../utils/project-catalog-preview'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `project-catalog-preview:${user.id}`, 120, 60_000)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'Cookie, Authorization')

  const projectId = String(getRouterParam(event, 'id') || '').trim()
  if (!UUID_RE.test(projectId)) {
    throw createError({ statusCode: 400, statusMessage: 'ID de modelo inválido.' })
  }
  const query = getQuery(event)
  const personalize = String(query.personalize || '').trim() === '1'
  return await getProjectCatalogPreview(projectId, user, personalize)
})
