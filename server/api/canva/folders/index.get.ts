// Lista pastas do cliente logado
// Query param: parent_id (opcional, null = raiz)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const query = getQuery(event)

  const parentId = query.parent_id ? String(query.parent_id) : null

  let result
  if (parentId) {
    // Buscar subpastas de uma pasta especifica
    result = await pgQuery(
      `SELECT id, name, parent_id, created_at
       FROM public.canva_folders
       WHERE tenant_id = $1 AND parent_id = $2
       ORDER BY name ASC`,
      [tenant.id, parentId]
    )
  } else {
    // Buscar pastas raiz (sem parent_id)
    result = await pgQuery(
      `SELECT id, name, parent_id, created_at
       FROM public.canva_folders
       WHERE tenant_id = $1 AND parent_id IS NULL
       ORDER BY name ASC`,
      [tenant.id]
    )
  }

  return { folders: result.rows }
})
