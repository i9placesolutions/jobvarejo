import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-badge-styles-update:${user.id}`, 60, 60_000)

  const styleId = String(getRouterParam(event, 'id') || '').trim()
  if (!styleId) {
    throw createError({ statusCode: 400, statusMessage: 'Badge style ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    thumbnail: 'text',
    type: 'text',
    css_config: 'jsonb',
    is_global: 'boolean',
    is_active: 'boolean',
    sort_order: 'int'
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

  values.push(styleId)

  const style = await pgOneOrNull(
    `UPDATE public.builder_badge_styles
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!style) {
    throw createError({ statusCode: 404, statusMessage: 'Badge style not found' })
  }

  return { badgeStyle: style }
})
