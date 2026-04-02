// Renomear pasta do cliente
// Body: { name }

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const folderId = getRouterParam(event, 'id')

  if (!folderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID da pasta e obrigatorio',
    })
  }

  const body = await readBody(event)
  const name = String(body?.name || '').trim()

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nome da pasta e obrigatorio',
    })
  }

  const folder = await pgOneOrNull(
    `UPDATE public.canva_folders
     SET name = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, name, parent_id, created_at, updated_at`,
    [name, folderId, tenant.id]
  )

  if (!folder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pasta nao encontrada',
    })
  }

  return { folder }
})
