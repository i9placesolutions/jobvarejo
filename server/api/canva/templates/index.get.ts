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
            description, page_count, products_per_page, pattern,
            design_type, is_active, sort_order, created_at, updated_at
     FROM public.canva_templates
     WHERE is_active = true${categoryFilter}
     ORDER BY sort_order ASC, title ASC`,
    params
  )

  return { templates: result.rows }
})
