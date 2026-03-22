import { randomUUID } from 'node:crypto'
import { requireBuilderTenant, isBuilderAdmin } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyers-create:${tenant.id}`, 30, 60_000)

  const admin = isBuilderAdmin(event)
  const body = await readBody<Record<string, any>>(event)
  const id = randomUUID()
  const title = String(body?.title || '').trim() || 'Novo Encarte'
  const themeId = body?.theme_id || null
  const modelId = body?.model_id || null
  const layoutId = body?.layout_id || null

  // Admin can create flyers for a specific tenant via body.tenant_id
  const targetTenantId = admin && body?.tenant_id
    ? String(body.tenant_id).trim()
    : tenant.id

  // Merge tenant flyer_defaults into new flyer
  const defaults = (tenant as any).flyer_defaults || {}
  const defaultColumns: string[] = []
  const defaultPlaceholders: string[] = []
  const values: any[] = [id, targetTenantId, title, themeId, modelId, layoutId]
  let paramIdx = 7

  const booleanKeys = [
    'show_logo', 'show_company_name', 'show_slogan', 'show_phone',
    'show_whatsapp', 'show_phone_label', 'show_payment_methods',
    'show_payment_notes', 'show_address', 'show_instagram',
    'show_facebook', 'show_website'
  ]
  const numericKeys = ['logo_size', 'logo_x', 'logo_y']
  const stringKeys = ['footer_layout', 'footer_bg', 'footer_text_color', 'footer_primary', 'footer_secondary']
  const jsonKeys = ['payment_methods']

  for (const key of booleanKeys) {
    if (defaults[key] !== undefined) {
      defaultColumns.push(key)
      defaultPlaceholders.push(`$${paramIdx}::boolean`)
      values.push(!!defaults[key])
      paramIdx++
    }
  }
  for (const key of numericKeys) {
    if (defaults[key] !== undefined && defaults[key] !== null) {
      defaultColumns.push(key)
      defaultPlaceholders.push(`$${paramIdx}::int`)
      values.push(Number(defaults[key]))
      paramIdx++
    }
  }
  for (const key of stringKeys) {
    if (defaults[key] !== undefined) {
      defaultColumns.push(key)
      defaultPlaceholders.push(`$${paramIdx}`)
      values.push(defaults[key])
      paramIdx++
    }
  }
  for (const key of jsonKeys) {
    if (defaults[key] !== undefined) {
      defaultColumns.push(key)
      defaultPlaceholders.push(`$${paramIdx}::jsonb`)
      values.push(JSON.stringify(defaults[key]))
      paramIdx++
    }
  }

  const extraCols = defaultColumns.length > 0
    ? `, ${defaultColumns.join(', ')}`
    : ''
  const extraVals = defaultPlaceholders.length > 0
    ? `, ${defaultPlaceholders.join(', ')}`
    : ''

  const flyer = await pgOneOrNull(
    `INSERT INTO public.builder_flyers
       (id, tenant_id, title, theme_id, model_id, layout_id${extraCols})
     VALUES
       ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid${extraVals})
     RETURNING *`,
    values
  )

  return { flyer }
})
