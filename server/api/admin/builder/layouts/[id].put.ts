import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-layouts-update:${user.id}`, 60, 60_000)

  const layoutId = String(getRouterParam(event, 'id') || '').trim()
  if (!layoutId) {
    throw createError({ statusCode: 400, statusMessage: 'Layout ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    products_per_page: 'int',
    columns: 'int',
    rows: 'int',
    grid_config: 'jsonb',
    highlight_positions: 'int[]',
    is_active: 'boolean',
    sort_order: 'int',
    model_id: 'uuid'
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
      } else if (castType === 'int[]') {
        setClauses.push(`${key} = $${paramIndex}::int[]`)
        values.push(value)
      } else if (castType === 'uuid') {
        setClauses.push(`${key} = $${paramIndex}::uuid`)
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

  values.push(layoutId)

  const layout = await pgOneOrNull(
    `UPDATE public.builder_layouts
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!layout) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' })
  }

  return { layout }
})
