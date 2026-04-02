// Cria vinculação entre dois templates companions (Feed ↔ Story)

import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery, pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-companions-create:${user.id}`, 30, 60_000)

  const body = await readBody(event)
  const templateId = String(body.template_id || '').trim()
  const companionId = String(body.companion_id || '').trim()
  const label = String(body.label || 'Story').trim()

  if (!templateId || !companionId) {
    throw createError({ statusCode: 400, statusMessage: 'template_id e companion_id são obrigatórios' })
  }

  if (templateId === companionId) {
    throw createError({ statusCode: 400, statusMessage: 'Não é possível vincular um template a si mesmo' })
  }

  // Verificar se ambos os templates existem
  const template = await pgOneOrNull('SELECT id FROM canva_templates WHERE id = $1', [templateId])
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Template de origem não encontrado' })
  }

  const companion = await pgOneOrNull('SELECT id FROM canva_templates WHERE id = $1', [companionId])
  if (!companion) {
    throw createError({ statusCode: 404, statusMessage: 'Template companion não encontrado' })
  }

  // Verificar se a vinculação já existe
  const existing = await pgOneOrNull(
    'SELECT id FROM canva_template_companions WHERE template_id = $1 AND companion_id = $2',
    [templateId, companionId]
  )
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Essa vinculação já existe' })
  }

  const result = await pgQuery(
    `INSERT INTO canva_template_companions (template_id, companion_id, label)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [templateId, companionId, label]
  )

  return { companion: result.rows[0] }
})
