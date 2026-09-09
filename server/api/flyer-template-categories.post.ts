import { requireAuthenticatedUser } from '~/server/utils/auth'
import { enforceRateLimit } from '~/server/utils/rate-limit'
import { pgOneOrNull, pgQuery } from '~/server/utils/postgres'
import { ensureFlyerTemplateCategoriesTable } from '~/server/utils/flyer-template-categories'
import {
  getFlyerTemplateCategoryKey,
  normalizeFlyerTemplateCategory
} from '~/utils/flyerTemplateCategory'

type CategoryRow = {
  id: string
  name: string
  normalized_name: string
  created_at: string | null
  updated_at: string | null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `flyer-template-categories:post:${user.id}`, 60, 60_000)

  const body = await readBody<Record<string, unknown>>(event)
  const name = normalizeFlyerTemplateCategory(body?.name)
  const normalizedName = getFlyerTemplateCategoryKey(name)
  if (!name || !normalizedName) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da categoria.' })
  }

  try {
    await ensureFlyerTemplateCategoriesTable()
    await pgQuery(`
      insert into public.flyer_template_categories (user_id, name, normalized_name)
      values ($1, $2, $3)
      on conflict (user_id, normalized_name) do nothing
    `, [user.id, name, normalizedName])

    const category = await pgOneOrNull<CategoryRow>(`
      select id, name, normalized_name, created_at, updated_at
      from public.flyer_template_categories
      where user_id = $1
        and normalized_name = $2
      limit 1
    `, [user.id, normalizedName])

    if (!category) {
      throw createError({ statusCode: 500, statusMessage: 'Não foi possível salvar a categoria.' })
    }
    return { category }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Não foi possível salvar a categoria.'
    })
  }
})
