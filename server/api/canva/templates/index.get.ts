// Lista templates ativos do Canva
// Query param: category (opcional, filtra por categoria)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  await requireBuilderTenant(event)
  const query = getQuery(event)

  const category = query.category ? String(query.category).trim() : null
  const params: any[] = []
  let categoryFilter = ''

  if (category) {
    categoryFilter = ' AND category = $1'
    params.push(category)
  }

  const result = await pgQuery(
    `SELECT id, title, category, canva_design_id, thumbnail_url,
            description, created_at, updated_at
     FROM public.canva_templates
     WHERE is_active = true${categoryFilter}
     ORDER BY title ASC`,
    params
  )

  return { templates: result.rows }
})
