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
  created_at?: string | null
  updated_at?: string | null
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

export const getFlyerTemplateCategory = (templateConfig: unknown): string | null => {
  if (!templateConfig || typeof templateConfig !== 'object' || Array.isArray(templateConfig)) {
    return null
  }

  return normalizeFlyerTemplateCategory((templateConfig as Record<string, unknown>).category)
}

/** Mantém as demais opções do modelo intactas ao normalizar a categoria. */
export const normalizeFlyerTemplateConfigCategory = <T>(templateConfig: T): T => {
  if (!templateConfig || typeof templateConfig !== 'object' || Array.isArray(templateConfig)) {
    return templateConfig
  }

  const config = templateConfig as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(config, 'category')) return templateConfig

  const { category: _category, ...rest } = config
  const category = normalizeFlyerTemplateCategory(_category)
  return (category ? { ...rest, category } : rest) as T
}
