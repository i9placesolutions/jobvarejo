import { randomUUID } from 'node:crypto'
import { requireBuilderTenant } from '../../../../utils/builder-auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { pgOneOrNull, pgTx } from '../../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-flyer-products:${tenant.id}`, 60, 60_000)

  const flyerId = String(getRouterParam(event, 'id') || '').trim()
  if (!flyerId) {
    throw createError({ statusCode: 400, statusMessage: 'Flyer ID is required' })
  }

  const body = await readBody<Record<string, any>>(event)
  const products = Array.isArray(body?.products) ? body.products : []

  // Verify flyer belongs to tenant
  const flyer = await pgOneOrNull(
    `SELECT id FROM public.builder_flyers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [flyerId, tenant.id]
  )
  if (!flyer) {
    throw createError({ statusCode: 404, statusMessage: 'Flyer not found' })
  }

  const rows = await pgTx(async (client) => {
    // Delete existing products
    await client.query(
      `DELETE FROM public.builder_flyer_products WHERE flyer_id = $1`,
      [flyerId]
    )

    if (products.length === 0) return []

    const inserted: any[] = []
    for (const p of products) {
      const id = p.id || randomUUID()
      const result = await client.query(
        `INSERT INTO public.builder_flyer_products
           (id, flyer_id, product_id, position, custom_name, custom_image,
            offer_price, original_price, unit, observation, purchase_limit,
            price_mode, take_quantity, pay_quantity,
            installment_count, installment_price, no_interest,
            club_name, anticipation_text, show_discount, quantity_unit,
            is_highlight, is_adult,
            is_pinned, is_price_pinned, bg_opacity, custom_lines,
            price_tag_style_id, badge_style_id)
         VALUES
           ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17::boolean,
            $18, $19, $20::boolean, $21,
            $22::boolean, $23::boolean,
            $24::boolean, $25::boolean, $26, $27::jsonb,
            $28::uuid, $29::uuid)
         RETURNING *`,
        [
          id, flyerId, p.product_id || null, p.position ?? 0,
          p.custom_name || null, p.custom_image || null,
          p.offer_price ?? null, p.original_price ?? null,
          p.unit || null, p.observation || null, p.purchase_limit ?? null,
          p.price_mode || null, p.take_quantity ?? null, p.pay_quantity ?? null,
          p.installment_count ?? null, p.installment_price ?? null, p.no_interest ?? true,
          p.club_name || null, p.anticipation_text || null, p.show_discount ?? false, p.quantity_unit || null,
          p.is_highlight ?? false, p.is_adult ?? false,
          p.is_pinned ?? false, p.is_price_pinned ?? false,
          p.bg_opacity ?? null, p.custom_lines ? JSON.stringify(p.custom_lines) : null,
          p.price_tag_style_id || null, p.badge_style_id || null
        ]
      )
      if (result.rows[0]) inserted.push(result.rows[0])
    }

    // Touch flyer updated_at
    await client.query(
      `UPDATE public.builder_flyers SET updated_at = timezone('utc', now()) WHERE id = $1`,
      [flyerId]
    )

    return inserted
  })

  return { products: rows }
})
