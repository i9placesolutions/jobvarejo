// Lista paginas (com thumbnails) de um design Canva, para o editor.
// Permite que o usuario escolha quais paginas trazer antes do import.
import { requireAuthenticatedUser } from '../../../../../utils/auth'
import { enforceRateLimit } from '../../../../../utils/rate-limit'
import { canvaGetDesignPages } from '../../../../../utils/canva-client'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `editor-canva-pages:${user.id}`, 90, 60_000)

  const designId = String(getRouterParam(event, 'id') || '').trim()
  if (!designId) {
    throw createError({ statusCode: 400, statusMessage: 'ID do design e obrigatorio' })
  }

  const query = getQuery(event)
  const offset = Math.max(1, Number(query.offset) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))

  const response = await canvaGetDesignPages(designId, { offset, limit })

  return {
    pages: (response.items || []).map((item) => ({
      index: Number(item.index) || 0,
      thumbnail: item.thumbnail?.url || null,
    })),
  }
})
