// Lista todas as vinculações de templates companions para o admin

import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-companions-list:${user.id}`, 120, 60_000)

  const result = await pgQuery(
    `SELECT c.*, t1.title as template_title, t2.title as companion_title
     FROM canva_template_companions c
     JOIN canva_templates t1 ON t1.id = c.template_id
     JOIN canva_templates t2 ON t2.id = c.companion_id
     ORDER BY c.created_at DESC`
  )

  return { companions: result.rows }
})
