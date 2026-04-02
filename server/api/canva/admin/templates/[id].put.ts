// Atualizar template do Canva (campos permitidos: title, description, category, is_active, sort_order, thumbnail_url)

import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-canva-templates-update:${user.id}`, 60, 60_000)

  const templateId = String(getRouterParam(event, 'id') || '').trim()
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID e obrigatorio' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    title: 'text',
    description: 'text',
    category: 'text',
    is_active: 'boolean',
    sort_order: 'int',
    thumbnail_url: 'text',
    design_type: 'text',
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, castType] of Object.entries(allowedKeys)) {
    if (key in body) {
      const value = body[key]
      if (castType === 'boolean') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
        values.push(value)
      } else if (castType === 'int') {
        setClauses.push(`${key} = $${paramIndex}::int`)
        values.push(value)
      } else {
        setClauses.push(`${key} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum campo valido para atualizar' })
  }

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(templateId)

  const template = await pgOneOrNull(
    `UPDATE public.canva_templates
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Template nao encontrado' })
  }

  return { template }
})
