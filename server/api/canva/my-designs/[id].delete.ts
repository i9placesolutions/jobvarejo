// Deletar design do cliente (apenas do banco, nao deleta do Canva)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  const designId = getRouterParam(event, 'id')

  if (!designId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID do design e obrigatorio',
    })
  }

  const deleted = await pgOneOrNull(
    `DELETE FROM public.canva_designs
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [designId, tenant.id]
  )

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Design nao encontrado',
    })
  }

  return { success: true }
})
