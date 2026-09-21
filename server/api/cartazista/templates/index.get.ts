import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'
import { cartazistaUser, cartazistaDatabaseError } from '~/server/utils/cartazista'
import { pgQuery } from '~/server/utils/postgres'

export default defineEventHandler(async (event) => {
  await cartazistaUser(event)
  try {
    const result = await pgQuery(
      `select id, name, category, description, tags, model_key, published, revision
         from public.cartazista_templates
        where published = true
        order by updated_at desc
        limit 200`,
      []
    )
    const databaseModels = result.rows.map((row: any) => ({
      id: String(row.model_key || row.id),
      name: String(row.name || ''),
      category: String(row.category || 'Preço'),
      description: String(row.description || ''),
      tags: Array.isArray(row.tags) ? row.tags : [],
      example: '',
      published: row.published !== false,
      revision: Number(row.revision || 1)
    }))
    return { templates: [...CARTAZISTA_STARTER_MODELS, ...databaseModels], databaseReady: true }
  } catch (error: any) {
    if (error?.code === '42P01') return { templates: CARTAZISTA_STARTER_MODELS, databaseReady: false }
    return cartazistaDatabaseError(error)
  }
})
