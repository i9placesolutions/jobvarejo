// Deletar pasta do cliente (move designs para raiz)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgOneOrNull } from '../../../utils/postgres'
import { pgTx } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const folderId = getRouterParam(event, 'id')

  if (!folderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID da pasta e obrigatorio',
    })
  }

  // Verificar se a pasta existe e pertence ao tenant
  const folder = await pgOneOrNull(
    `SELECT id FROM public.canva_folders WHERE id = $1 AND tenant_id = $2`,
    [folderId, tenant.id]
  )

  if (!folder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pasta nao encontrada',
    })
  }

  // Usar transacao para mover designs e deletar pasta
  await pgTx(async (client) => {
    // Mover designs da pasta para raiz (folder_id = null)
    await client.query(
      `UPDATE public.canva_designs
       SET folder_id = NULL, updated_at = NOW()
       WHERE folder_id = $1 AND tenant_id = $2`,
      [folderId, tenant.id]
    )

    // Mover subpastas para raiz (parent_id = null)
    await client.query(
      `UPDATE public.canva_folders
       SET parent_id = NULL, updated_at = NOW()
       WHERE parent_id = $1 AND tenant_id = $2`,
      [folderId, tenant.id]
    )

    // Deletar a pasta
    await client.query(
      `DELETE FROM public.canva_folders WHERE id = $1 AND tenant_id = $2`,
      [folderId, tenant.id]
    )
  })

  return { success: true }
})
