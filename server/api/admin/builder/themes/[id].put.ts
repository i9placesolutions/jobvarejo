import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-themes-update:${user.id}`, 60, 60_000)

  const themeId = String(getRouterParam(event, 'id') || '').trim()
  if (!themeId) {
    throw createError({ statusCode: 400, statusMessage: 'Theme ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    name: 'text',
    slug: 'text',
    thumbnail: 'text',
    background_image: 'text',
    is_premium: 'boolean',
    is_public: 'boolean',
    is_active: 'boolean',
    sort_order: 'int',
    category_name: 'text',
    tags: 'text[]',
    css_config: 'jsonb',
    header_config: 'jsonb',
    body_config: 'jsonb',
    footer_config: 'jsonb'
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
      } else if (castType === 'text[]') {
        setClauses.push(`${key} = $${paramIndex}::text[]`)
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

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(themeId)

  const theme = await pgOneOrNull(
    `UPDATE public.builder_themes
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}::uuid
     RETURNING *`,
    values
  )

  if (!theme) {
    throw createError({ statusCode: 404, statusMessage: 'Theme not found' })
  }

  return { theme }
})
