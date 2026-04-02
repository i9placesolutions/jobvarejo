// Lista TODOS os templates do Canva (ativos e inativos) para o admin gerenciar

import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-canva-templates-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT *
     FROM public.canva_templates
     ORDER BY sort_order ASC, created_at DESC`
  )

  return { templates: result.rows }
})
