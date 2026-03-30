import { requireBuilderTenant, isBuilderAdmin } from '../../../utils/builder-auth'
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
    // Toggles de exibicao
    show_dates: 'boolean',
    show_stock_warning: 'boolean',
    show_illustrative_note: 'boolean',
    show_medicine_warning: 'boolean',
    show_promo_phrase: 'boolean',
    promo_phrase: 'text',
    publish_to_portal: 'boolean',
    show_cover: 'boolean',
    // Toggles de campos da empresa
    show_phone: 'boolean',
    show_whatsapp: 'boolean',
    show_phone_label: 'boolean',
    show_company_name: 'boolean',
    show_slogan: 'boolean',
    show_payment_methods: 'boolean',
    show_payment_notes: 'boolean',
    show_address: 'boolean',
    show_instagram: 'boolean',
    show_facebook: 'boolean',
    show_website: 'boolean',
    // Visual config
    text_size_mode: 'text',
    product_box_style: 'text',
    color_mode: 'text',
    footer_style: 'text',
    ink_economy: 'int',
    // JSON configs (font_config armazena TODAS as customizacoes visuais)
    font_config: 'jsonb',
    logo_position: 'jsonb',
    color_palette: 'jsonb',
    // FK references
    theme_id: 'uuid',
    model_id: 'uuid',
    layout_id: 'uuid',
    price_tag_style_id: 'uuid',
    badge_style_id: 'uuid',
    snapshot_url: 'text',
  }

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const [key, castType] of Object.entries(allowedKeys)) {
    if (key in body) {
      let value = body[key]
      // UUID: string vazia → null (evita erro de cast)
      if (castType === 'uuid' && (value === '' || value === undefined)) {
        value = null
      }
      // Date: string vazia, undefined, ou data invalida → null
      if (castType === 'date') {
        if (!value || value === '' || value === undefined) {
          value = null
        } else {
          // Validar que a data e parseable e razoavel (ano entre 1900 e 2100)
          const parsed = new Date(String(value))
          const year = parsed.getFullYear()
          if (isNaN(parsed.getTime()) || year < 1900 || year > 2100) {
            value = null
          }
        }
      }
      // Int: garantir numero ou null
      if (castType === 'int' && (value === '' || value === undefined || value === null)) {
        value = null
      }
      if (castType === 'jsonb') {
        setClauses.push(`${key} = $${paramIndex}::jsonb`)
        values.push(typeof value === 'string' ? value : JSON.stringify(value ?? {}))
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

  const admin = isBuilderAdmin(event)
  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(flyerId)

  try {
    const flyer = admin
      ? await pgOneOrNull(
          `UPDATE public.builder_flyers
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          values
        )
      : await pgOneOrNull(
          `UPDATE public.builder_flyers
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
           RETURNING *`,
          [...values, tenant.id]
        )

    if (!flyer) {
      throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
    }

    return { flyer }
  } catch (err: any) {
    // Log detalhado para debug
    if (err.statusCode) throw err // re-throw createError
    console.error('[flyer.put] SQL error:', err?.message || err)
    console.error('[flyer.put] SET clauses:', setClauses.join(', '))
    console.error('[flyer.put] Values types:', values.map((v, i) => `$${i + 1}: ${typeof v} = ${typeof v === 'object' ? JSON.stringify(v)?.slice(0, 100) : String(v)?.slice(0, 50)}`))
    throw createError({ statusCode: 500, statusMessage: `Erro ao salvar encarte: ${err?.message || 'erro desconhecido'}` })
  }
})
