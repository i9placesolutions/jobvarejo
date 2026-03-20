import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-update:${tenant.id}`, 60, 60_000)

  const flyerId = String(getRouterParam(event, 'id') || '').trim()
  if (!flyerId) {
    throw createError({ statusCode: 400, statusMessage: 'Flyer ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys: Record<string, string> = {
    title: 'text',
    status: 'text',
    start_date: 'date',
    end_date: 'date',
    category: 'text',
    observations: 'text',
    custom_message: 'text',
    show_dates: 'boolean',
    show_stock_warning: 'boolean',
    show_cover: 'boolean',
    text_size_mode: 'text',
    product_box_style: 'text',
    color_mode: 'text',
    footer_style: 'text',
    ink_economy: 'int',
    font_config: 'jsonb',
    logo_position: 'jsonb',
    color_palette: 'jsonb',
    theme_id: 'uuid',
    model_id: 'uuid',
    layout_id: 'uuid',
    price_tag_style_id: 'uuid',
    badge_style_id: 'uuid',
    snapshot_url: 'text'
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, castType] of Object.entries(allowedKeys)) {
    if (key in body) {
      const value = body[key]
      if (castType === 'jsonb') {
        setClauses.push(`${key} = $${paramIndex}::jsonb`)
        values.push(JSON.stringify(value))
      } else if (castType === 'boolean') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
        values.push(value)
      } else if (castType === 'uuid') {
        setClauses.push(`${key} = $${paramIndex}::uuid`)
        values.push(value)
      } else if (castType === 'int') {
        setClauses.push(`${key} = $${paramIndex}::int`)
        values.push(value)
      } else if (castType === 'date') {
        setClauses.push(`${key} = $${paramIndex}::date`)
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
  values.push(flyerId, tenant.id)

  const flyer = await pgOneOrNull(
    `UPDATE public.builder_flyers
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
     RETURNING *`,
    values
  )

  if (!flyer) {
    throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
  }

  return { flyer }
})
