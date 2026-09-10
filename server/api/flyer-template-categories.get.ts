import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgQuery } from '~/server/utils/postgres'
import { syncLegacyFlyerTemplateCategories } from '~/server/utils/flyer-template-categories'

type CategoryRow = {
  id: string
  name: string
  normalized_name: string
  parent_id: string | null
  parent_name: string | null
  created_at: string | null
  updated_at: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `flyer-template-categories:get:${user.id}`, 180, 60_000)

  try {
    await syncLegacyFlyerTemplateCategories(user.id)
    const { rows } = await pgQuery<CategoryRow>(`
      select
        category.id,
        category.name,
        category.normalized_name,
        category.parent_id,
        parent.name as parent_name,
        category.created_at,
        category.updated_at
      from public.flyer_template_categories category
      left join public.flyer_template_categories parent
        on parent.id = category.parent_id
       and parent.user_id = category.user_id
      where category.user_id = $1
      order by parent.name asc nulls first, category.name asc, category.created_at asc
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
