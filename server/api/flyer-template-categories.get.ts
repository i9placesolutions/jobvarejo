import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgQuery } from '~/server/utils/postgres'
import { syncLegacyFlyerTemplateCategories } from '~/server/utils/flyer-template-categories'

type CategoryRow = {
  id: string
  name: string
  normalized_name: string
  created_at: string | null
  updated_at: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `flyer-template-categories:get:${user.id}`, 180, 60_000)

  try {
    await syncLegacyFlyerTemplateCategories(user.id)
    const { rows } = await pgQuery<CategoryRow>(`
      select id, name, normalized_name, created_at, updated_at
      from public.flyer_template_categories
      where user_id = $1
      order by name asc, created_at asc
      limit 500
    `, [user.id])

    return { categories: rows || [] }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Não foi possível carregar as categorias de modelos.'
    })
  }
})
