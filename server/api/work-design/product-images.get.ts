import { z } from 'zod'
import { requireWorkPilot } from '../../utils/work-design/access'
import { pgQuery } from '../../utils/postgres'
export default defineEventHandler(async event => {
  await requireWorkPilot(event)
  const query = z.string().trim().min(2).max(120).safeParse(getQuery(event).q)
  if (!query.success) throw createError({ statusCode: 400, statusMessage: 'Informe o nome do produto.' })
  const term = '%' + query.data.replace(/[%_\\]/g, '') + '%'
  const result = await pgQuery<{ key: string; name: string }>(`select distinct s3_key as key, coalesce(product_name,search_term) as name
    from public.product_image_cache where s3_key like 'imagens/%' and s3_key ~ '\\.(png|webp|jpe?g)$'
    and (product_name ilike $1 or search_term ilike $1) limit 24`, [term])
  return { images: result.rows }
})
