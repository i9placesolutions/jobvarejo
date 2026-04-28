// Lista designs Canva para o editor.
// Diferente de /api/canva/my-designs (que e tenant-scoped via builder-auth),
// aqui usamos o token global do Canva e qualquer usuario autenticado pode
// listar os designs disponiveis na conta conectada.
import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { canvaListDesigns } from '../../../utils/canva-client'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `editor-canva-designs:${user.id}`, 60, 60_000)

  const query = getQuery(event)
  const search = String(query.query || '').trim()
  const continuation = String(query.continuation || '').trim()

  const response = await canvaListDesigns({
    query: search || undefined,
    continuation: continuation || undefined,
    sort_by: 'modified_descending',
    ownership: 'owned',
  })

  const designs = (response.items || []).map((d) => ({
    id: d.id,
    title: d.title || 'Sem titulo',
    thumbnail: d.thumbnail?.url || null,
    edit_url: d.urls?.edit_url || null,
    view_url: d.urls?.view_url || null,
    page_count: Number(d.page_count) || 0,
    created_at: d.created_at || null,
    updated_at: d.updated_at || null,
  }))

  return {
    designs,
    continuation: response.continuation || null,
  }
})
