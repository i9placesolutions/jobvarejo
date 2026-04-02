// Remove vinculação entre templates companions

import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgQuery } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-companions-delete:${user.id}`, 30, 60_000)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID da vinculação é obrigatório' })
  }

  const result = await pgQuery(
    'DELETE FROM canva_template_companions WHERE id = $1 RETURNING id',
    [id]
  )

  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Vinculação não encontrada' })
  }

  return { deleted: true }
})
