// Lista designs do cliente logado
// Query params: folder_id (null = raiz), status, q (busca por titulo)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const query = getQuery(event)

  const params: any[] = [tenant.id]
  const conditions: string[] = ['d.tenant_id = $1']
  let paramIndex = 2

  // Filtro por pasta (null = raiz)
  const folderId = query.folder_id ? String(query.folder_id) : null
  if (folderId) {
    conditions.push(`d.folder_id = $${paramIndex}`)
    params.push(folderId)
    paramIndex++
  } else {
    // Se nao informou folder_id, mostra apenas designs na raiz
    conditions.push('d.folder_id IS NULL')
  }

  // Filtro por status
  const status = query.status ? String(query.status).trim().toUpperCase() : null
  if (status) {
    conditions.push(`d.status = $${paramIndex}`)
    params.push(status)
    paramIndex++
  }

  // Busca por titulo
  const searchQuery = query.q ? String(query.q).trim() : null
  if (searchQuery) {
    conditions.push(`d.title ILIKE $${paramIndex}`)
    params.push(`%${searchQuery}%`)
    paramIndex++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pgQuery(
    `SELECT d.id, d.title, d.canva_design_id, d.canva_edit_url, d.canva_view_url,
            d.folder_id, d.template_id, d.status, d.thumbnail_url,
            d.created_at, d.updated_at
     FROM public.canva_designs d
     ${where}
     ORDER BY d.updated_at DESC
     LIMIT 100`,
    params
  )

  return { designs: result.rows }
})
