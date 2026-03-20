import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-models-update:${user.id}`, 60, 60_000)

  const modelId = String(getRouterParam(event, 'id') || '').trim()
  if (!modelId) {
    throw createError({ statusCode: 400, statusMessage: 'Model ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    type: 'text',
    width: 'int',
    height: 'int',
    aspect_ratio: 'text',
    is_active: 'boolean',
    sort_order: 'int'
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
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  values.push(modelId)

  const model = await pgOneOrNull(
    `UPDATE public.builder_models
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!model) {
    throw createError({ statusCode: 404, statusMessage: 'Model not found' })
  }

  return { model }
})
