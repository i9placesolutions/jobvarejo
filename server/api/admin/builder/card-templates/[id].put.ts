import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeModelIds = (value: unknown): string[] => {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'model_ids must be an array' })
  }

  const ids = Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)))
  if (ids.some(id => !UUID_PATTERN.test(id))) {
    throw createError({ statusCode: 400, statusMessage: 'model_ids contains an invalid model id' })
  }
  return ids
}

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-card-templates-update:${user.id}`, 60, 60_000)

  const templateId = String(getRouterParam(event, 'id') || '').trim()
  if (!templateId) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    thumbnail: 'text',
    category: 'text',
    elements: 'jsonb',
    card_style: 'jsonb',
    model_ids: 'uuid[]',
    is_active: 'boolean',
    sort_order: 'int',
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, castType] of Object.entries(allowedKeys)) {
    if (key in body) {
      const value = body[key]
      if (castType === 'jsonb') {
        setClauses.push(`${key} = $${paramIndex}::jsonb`)
        values.push(value != null ? JSON.stringify(value) : null)
      } else if (castType === 'boolean') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
        values.push(value)
      } else if (castType === 'int') {
        setClauses.push(`${key} = $${paramIndex}::int`)
        values.push(value)
      } else if (castType === 'uuid[]') {
        setClauses.push(`${key} = $${paramIndex}::uuid[]`)
        values.push(normalizeModelIds(value))
      } else {
        setClauses.push(`${key} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }
  }

  if (setClauses.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(templateId)

  const cardTemplate = await pgOneOrNull(
    `UPDATE public.builder_card_templates
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!cardTemplate) {
    throw createError({ statusCode: 404, statusMessage: 'Card template not found' })
  }

  return { cardTemplate }
})
