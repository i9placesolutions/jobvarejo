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
  parent_id: string | null
  parent_name: string | null
  created_at: string | null
  updated_at: string | null
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const selectCategoryByNormalizedName = async (
  userId: string,
  normalizedName: string,
  parentId: string | null
): Promise<CategoryRow | null> => {
  return await pgOneOrNull<CategoryRow>(`
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
      and category.normalized_name = $2
      and category.parent_id is not distinct from $3::uuid
    limit 1
  `, [userId, normalizedName, parentId])
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
  const parentId = body?.parent_id == null || body?.parent_id === ''
    ? null
    : String(body.parent_id).trim()
  if (parentId && !isUuid(parentId)) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria principal inválida.' })
  }

  try {
    await ensureFlyerTemplateCategoriesTable()
    if (parentId) {
      const parent = await pgOneOrNull<{ id: string; parent_id: string | null }>(`
        select id, parent_id
        from public.flyer_template_categories
        where id = $1
          and user_id = $2
        limit 1
      `, [parentId, user.id])
      if (!parent) {
        throw createError({ statusCode: 404, statusMessage: 'Categoria principal não encontrada.' })
      }
      if (parent.parent_id) {
        throw createError({ statusCode: 400, statusMessage: 'Uma subcategoria deve pertencer a uma categoria principal.' })
      }
    }
    await pgQuery(`
      insert into public.flyer_template_categories (user_id, name, normalized_name, parent_id)
      values ($1, $2, $3, $4::uuid)
      on conflict do nothing
    `, [user.id, name, normalizedName, parentId])

    const category = await selectCategoryByNormalizedName(user.id, normalizedName, parentId)

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
