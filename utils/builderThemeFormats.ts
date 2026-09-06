import type { BuilderModel, BuilderTheme } from '~/types/builder'

/**
 * Retorna os modelos explicitamente associados a um tema.
 *
 * Temas criados antes da matriz de formatos (ou com "todos os formatos")
 * ficam com a lista vazia e continuam compatíveis com qualquer modelo.
 */
export const normalizeBuilderThemeModelIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(
    value
      .map(item => String(item || '').trim())
      .filter(Boolean)
  ))
}

export const builderThemeSupportsModel = (
  theme: Pick<BuilderTheme, 'model_ids'> | { model_ids?: unknown } | null | undefined,
  modelId: string | null | undefined
): boolean => {
  const modelIds = normalizeBuilderThemeModelIds(theme?.model_ids)

  // Lista vazia é o contrato de "todos os formatos". Isso também preserva
  // temas legados, que ainda não tinham model_ids salvo.
  if (modelIds.length === 0 || !modelId) return true
  return modelIds.includes(String(modelId).trim())
}

export const builderThemeFormatSummary = (
  theme: Pick<BuilderTheme, 'model_ids'> | { model_ids?: unknown } | null | undefined,
  models: ReadonlyArray<Pick<BuilderModel, 'id' | 'name'>>
): string => {
  const modelIds = normalizeBuilderThemeModelIds(theme?.model_ids)
  if (modelIds.length === 0) return 'Todos os formatos'

  const names = modelIds
    .map(id => models.find(model => String(model.id) === id)?.name)
    .filter((name): name is string => !!name)

  if (names.length === 0) return `${modelIds.length} formato(s)`
  if (names.length <= 2) return names.join(' · ')
  return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
}
