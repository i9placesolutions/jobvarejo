// Criar pasta para o cliente logado
// Body: { name, parent_id? }

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const body = await readBody(event)

  const name = String(body?.name || '').trim()
  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nome da pasta e obrigatorio',
    })
  }

  const parentId = body?.parent_id ? String(body.parent_id) : null

  // Se informou parent_id, verificar se pertence ao tenant
  if (parentId) {
    const parentFolder = await pgOneOrNull(
      `SELECT id FROM public.canva_folders WHERE id = $1 AND tenant_id = $2`,
      [parentId, tenant.id]
    )
    if (!parentFolder) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pasta pai nao encontrada',
      })
    }
  }

  const folder = await pgOneOrNull(
    `INSERT INTO public.canva_folders (tenant_id, name, parent_id)
     VALUES ($1, $2, $3)
     RETURNING id, name, parent_id, created_at, updated_at`,
    [tenant.id, name, parentId]
  )

  return { folder }
})
