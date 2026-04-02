// Busca templates companions de um template (rota pública para o cliente)

import { requireBuilderTenant } from '../../../utils/builder-auth'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  await requireBuilderTenant(event)

  const templateId = getRouterParam(event, 'templateId')
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'templateId é obrigatório' })
  }

  const result = await pgQuery(
    `SELECT t.id, t.title, t.canva_design_id, t.thumbnail_url, t.page_count, t.products_per_page, c.label
     FROM canva_template_companions c
     JOIN canva_templates t ON t.id = c.companion_id
     WHERE c.template_id = $1 AND t.is_active = true`,
    [templateId]
  )

  return { companions: result.rows }
})
