import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `admin-footer-templates-update:${user.id}`, 60, 60_000)

  const itemId = String(getRouterParam(event, 'id') || '').trim()
  if (!itemId) throw createError({ statusCode: 400, statusMessage: 'ID is required' })

  const body = await readBody<Record<string, any>>(event)
  const allowedKeys: Record<string, string> = {
    name: 'text', thumbnail: 'text', category: 'text', height: 'int',
    elements: 'jsonb', container_style: 'jsonb', is_active: 'boolean', sort_order: 'int',
  }

  const setClauses: string[] = []
  const values: any[] = []
  let pi = 1

  for (const [key, cast] of Object.entries(allowedKeys)) {
    if (key in body) {
      const v = body[key]
      if (cast === 'jsonb') { setClauses.push(`${key} = $${pi}::jsonb`); values.push(v != null ? JSON.stringify(v) : null) }
      else if (cast === 'boolean') { setClauses.push(`${key} = $${pi}::boolean`); values.push(v) }
      else if (cast === 'int') { setClauses.push(`${key} = $${pi}::int`); values.push(v) }
      else { setClauses.push(`${key} = $${pi}`); values.push(v) }
      pi++
    }
  }

  if (!setClauses.length) throw createError({ statusCode: 400, statusMessage: 'No valid fields' })
  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(itemId)

  const item = await pgOneOrNull(
    `UPDATE public.builder_footer_templates SET ${setClauses.join(', ')} WHERE id = $${pi}::uuid RETURNING *`,
    values
  )

  if (!item) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { footerTemplate: item }
})
