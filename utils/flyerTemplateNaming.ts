const PAGE_NAME_SEPARATOR = ' · '

const text = (value: unknown): string => String(value || '').trim()

const splitPageName = (value: unknown): { modelName: string; formatLabel: string } => {
  const raw = text(value)
  const separatorIndex = raw.lastIndexOf(PAGE_NAME_SEPARATOR)
  if (separatorIndex <= 0) return { modelName: raw, formatLabel: '' }
  return {
    modelName: raw.slice(0, separatorIndex).trim(),
    formatLabel: raw.slice(separatorIndex + PAGE_NAME_SEPARATOR.length).trim()
  }
}

const modelIdentity = (value: any, fallbackIndex = 0): string => {
  const id = text(value?.templateModelId ?? value?.id)
  if (id) return `id:${id}`
  const name = text(value?.templateModelName ?? value?.name) || splitPageName(value?.name).modelName
  return name ? `name:${name.toLocaleLowerCase('pt-BR')}` : `page:${fallbackIndex}`
}

export const isFlyerTemplatePageName = (page: any): boolean => {
  if (!page || typeof page !== 'object') return false
  return Boolean(
    text(page.templateModelId) ||
    text(page.templateModelName) ||
    text(page.templateFormatId) ||
    text(page.templateFormatLabel) ||
    splitPageName(page.name).formatLabel
  )
}

export const getFlyerTemplatePageFormatLabel = (page: any): string => (
  text(page?.templateFormatLabel) || splitPageName(page?.name).formatLabel
)

export const getFlyerTemplatePageModelName = (page: any): string => (
  text(page?.templateModelName) || splitPageName(page?.name).modelName
)

export const hasSingleFlyerTemplateModel = (pages: any[]): boolean => {
  if (!Array.isArray(pages) || pages.length === 0) return false
  const models = new Set<string>()
  pages.forEach((page, index) => {
    if (!isFlyerTemplatePageName(page)) return
    models.add(modelIdentity(page, index))
  })
  return models.size === 1
}

const getRequestedModelName = (value: unknown, currentFormatLabel: string): string => {
  const raw = text(value)
  if (!raw) return ''
  const suffix = currentFormatLabel ? `${PAGE_NAME_SEPARATOR}${currentFormatLabel}` : ''
  return suffix && raw.endsWith(suffix)
    ? raw.slice(0, -suffix.length).trim()
    : raw
}

/**
 * Mantém o nome exibido do modelo e os nomes das páginas do mesmo modelo em
 * sincronia. Os IDs e a composição do canvas não são alterados.
 */
export const renameFlyerTemplateModelInPlace = (
  pages: any[],
  sourcePage: any,
  requestedName: unknown,
  templateConfig?: any
): boolean => {
  if (!Array.isArray(pages) || !sourcePage || !isFlyerTemplatePageName(sourcePage)) return false

  const sourceIdentity = modelIdentity(sourcePage)
  const sourceFormatLabel = getFlyerTemplatePageFormatLabel(sourcePage)
  const nextModelName = getRequestedModelName(requestedName, sourceFormatLabel)
  if (!nextModelName) return false

  const sourceModelName = getFlyerTemplatePageModelName(sourcePage)
  let changed = false
  const matchesSourceModel = (candidate: any, index = 0): boolean => {
    if (!candidate || typeof candidate !== 'object') return false
    const candidateIdentity = modelIdentity(candidate, index)
    if (candidateIdentity === sourceIdentity) return true
    return sourceIdentity.startsWith('name:') &&
      candidateIdentity === `name:${sourceModelName.toLocaleLowerCase('pt-BR')}`
  }

  pages.forEach((page, index) => {
    if (!isFlyerTemplatePageName(page) || !matchesSourceModel(page, index)) return
    const formatLabel = getFlyerTemplatePageFormatLabel(page)
    const nextPageName = formatLabel
      ? `${nextModelName}${PAGE_NAME_SEPARATOR}${formatLabel}`
      : nextModelName
    if (page.templateModelName !== nextModelName || page.name !== nextPageName) {
      page.templateModelName = nextModelName
      page.name = nextPageName
      changed = true
    }
  })

  if (!templateConfig || typeof templateConfig !== 'object') return changed

  if (Array.isArray(templateConfig.models)) {
    templateConfig.models.forEach((model: any, index: number) => {
      const shouldRename = matchesSourceModel(model, index) || (
        templateConfig.models.length === 1 && hasSingleFlyerTemplateModel(pages)
      )
      if (shouldRename && model?.name !== nextModelName) {
        model.name = nextModelName
        changed = true
      }
    })
  }

  if (Array.isArray(templateConfig.pageBlueprints)) {
    templateConfig.pageBlueprints.forEach((blueprint: any, index: number) => {
      if (!matchesSourceModel(blueprint, index)) return
      const formatLabel = getFlyerTemplatePageFormatLabel(blueprint)
      const nextPageName = formatLabel
        ? `${nextModelName}${PAGE_NAME_SEPARATOR}${formatLabel}`
        : nextModelName
      if (blueprint.templateModelName !== nextModelName || blueprint.name !== nextPageName) {
        blueprint.templateModelName = nextModelName
        blueprint.name = nextPageName
        changed = true
      }
    })
  }

  return changed
}
