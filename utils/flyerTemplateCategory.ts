/**
 * Categoria principal usada para organizar modelos de encarte.
 *
 * A categoria fica dentro de `template_config` para acompanhar a cópia do
 * modelo sem criar uma dependência nova para os encartes já existentes.
 */
export const FLYER_TEMPLATE_CATEGORY_MAX_LENGTH = 60

/** Registro selecionável na biblioteca de modelos de um usuário. */
export type FlyerTemplateCategory = {
  id: string
  name: string
  normalized_name?: string
  /** Nulo identifica uma categoria principal; preenchido, uma subcategoria. */
  parent_id?: string | null
  parent_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** Classificação em dois níveis usada dentro de `template_config`. */
export type FlyerTemplateCategorySelection = {
  category: string | null
  subcategory: string | null
}

export const normalizeFlyerTemplateCategory = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FLYER_TEMPLATE_CATEGORY_MAX_LENGTH)

  return normalized || null
}

/** Chave estável para comparar categorias sem depender de maiúsculas/espaços. */
export const getFlyerTemplateCategoryKey = (value: unknown): string | null =>
  normalizeFlyerTemplateCategory(value)?.toLocaleLowerCase('pt-BR') || null

/**
 * `category` continua sendo a categoria principal para manter os modelos
 * antigos compatíveis. A subcategoria só é válida quando há uma principal.
 */
export const getFlyerTemplateCategorySelection = (
  templateConfig: unknown
): FlyerTemplateCategorySelection => {
  if (!templateConfig || typeof templateConfig !== 'object' || Array.isArray(templateConfig)) {
    return { category: null, subcategory: null }
  }

  const config = templateConfig as Record<string, unknown>
  const category = normalizeFlyerTemplateCategory(config.category)
  return {
    category,
    subcategory: category ? normalizeFlyerTemplateCategory(config.subcategory) : null
  }
}

/** Categoria principal de um modelo. Mantém o contrato anterior. */
export const getFlyerTemplateCategory = (templateConfig: unknown): string | null => {
  return getFlyerTemplateCategorySelection(templateConfig).category
}

export const getFlyerTemplateSubcategory = (templateConfig: unknown): string | null =>
  getFlyerTemplateCategorySelection(templateConfig).subcategory

/** Rótulo de leitura para cards, buscas e filtros visuais. */
export const getFlyerTemplateCategoryLabel = (templateConfig: unknown): string | null => {
  const { category, subcategory } = getFlyerTemplateCategorySelection(templateConfig)
  if (!category) return null
  return subcategory ? `${category} · ${subcategory}` : category
}

/** Mantém as demais opções do modelo intactas ao normalizar a classificação. */
export const normalizeFlyerTemplateConfigCategory = <T>(templateConfig: T): T => {
  if (!templateConfig || typeof templateConfig !== 'object' || Array.isArray(templateConfig)) {
    return templateConfig
  }

  const config = templateConfig as Record<string, unknown>
  const hasCategory = Object.prototype.hasOwnProperty.call(config, 'category')
  const hasSubcategory = Object.prototype.hasOwnProperty.call(config, 'subcategory')
  if (!hasCategory && !hasSubcategory) return templateConfig

  const { category: _category, subcategory: _subcategory, ...rest } = config
  const category = normalizeFlyerTemplateCategory(_category)
  const subcategory = category ? normalizeFlyerTemplateCategory(_subcategory) : null
  return ({
    ...rest,
    ...(category ? { category } : {}),
    ...(subcategory ? { subcategory } : {})
  }) as T
}
