import {
  getFlyerTemplateCategoryKey,
  normalizeFlyerTemplateCategory,
  type FlyerTemplateCategory
} from '~/utils/flyerTemplateCategory'

const normalizeCategory = (value: unknown): FlyerTemplateCategory | null => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const id = String(raw.id || '').trim()
  const name = normalizeFlyerTemplateCategory(raw.name)
  if (!id || !name) return null

  return {
    id,
    name,
    normalized_name: getFlyerTemplateCategoryKey(raw.normalized_name || name) || undefined,
    created_at: raw.created_at == null ? null : String(raw.created_at),
    updated_at: raw.updated_at == null ? null : String(raw.updated_at)
  }
}

const normalizeCategoryList = (value: unknown): FlyerTemplateCategory[] => {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray((value as Record<string, unknown> | null)?.categories)
      ? (value as Record<string, unknown>).categories as unknown[]
      : []
  const seen = new Set<string>()

  return rows
    .map(normalizeCategory)
    .filter((category): category is FlyerTemplateCategory => {
      if (!category) return false
      const key = getFlyerTemplateCategoryKey(category.name)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
}

/** Lista o catálogo privado de categorias e inclui categorias de modelos antigos. */
export const listFlyerTemplateCategories = async (
  headers: Record<string, string>
): Promise<FlyerTemplateCategory[]> => {
  const response = await $fetch<unknown>('/api/flyer-template-categories', { headers })
  return normalizeCategoryList(response)
}

/** Cria (ou recupera) uma categoria do usuário pelo nome normalizado. */
export const createFlyerTemplateCategory = async (opts: {
  headers: Record<string, string>
  name: string
}): Promise<FlyerTemplateCategory> => {
  const name = normalizeFlyerTemplateCategory(opts.name)
  if (!name) throw new Error('Informe o nome da categoria.')

  const response = await $fetch<unknown>('/api/flyer-template-categories', {
    method: 'POST',
    headers: opts.headers,
    body: { name }
  })
  const category = normalizeCategory(
    response && typeof response === 'object'
      ? (response as Record<string, unknown>).category
      : null
  )
  if (!category) throw new Error('O servidor não retornou a categoria criada.')
  return category
}
