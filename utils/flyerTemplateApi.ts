import { getQuickEditorSeedKey, QUICK_EDITOR_SEED_VERSION, type QuickEditorSeed } from '~/utils/quick-editor-seed'
import { isFlyerTemplatePresetId, type FlyerTemplatePresetId } from '~/utils/mesDoConsumidorPreset'

export const FLYER_TEMPLATE_FORMATS = [
  { id: 'feed', label: 'Feed 4:5', hint: 'Instagram e Facebook', width: 1080, height: 1350 },
  { id: 'square', label: 'Post 1:1', hint: 'Post quadrado', width: 1080, height: 1080 },
  { id: 'stories', label: 'Story 9:16', hint: 'Instagram vertical', width: 1080, height: 1920 },
  { id: 'print', label: 'A4', hint: 'Impressão 210:297', width: 794, height: 1123 },
  { id: 'tv', label: 'Banner 16:9', hint: 'Horizontal', width: 1920, height: 1080 }
] as const

export type FlyerTemplateFormatId = typeof FLYER_TEMPLATE_FORMATS[number]['id']

export type FlyerTemplateModelDraft = {
  id: string
  name: string
}

/**
 * Referência para uma composição real salva no projeto-modelo.
 *
 * Isso fica dentro de template_config e não vira uma página visível no
 * projeto do cliente. A página só é materializada quando ele escolhe criar
 * aquele formato na edição rápida.
 */
export type FlyerTemplatePageBlueprint = {
  sourcePageId: string
  name: string
  width: number
  height: number
  type: 'RETAIL_OFFER' | 'FREE_DESIGN'
  canvasDataPath?: string
  thumbnailUrl?: string
  templateModelId: string
  templateModelName: string
  templateFormatId: FlyerTemplateFormatId
  templateFormatLabel: string
  templateThemeId?: string
  templateThemeName?: string
}

/**
 * Configuração reutilizável do tema. Modelos e formatos são uma biblioteca de
 * composição; páginas são instâncias concretas criadas no editor rápido.
 */
export type FlyerTemplateConfig = {
  version: 1
  formatIds: FlyerTemplateFormatId[]
  models: FlyerTemplateModelDraft[]
  defaultModelId: string
  defaultFormatId: FlyerTemplateFormatId
  /** ID do modelo de origem quando esta configuração está numa cópia de uso. */
  sourceTemplateId?: string
  /** Receita nativa usada no primeiro materialize do modelo. */
  templatePresetId?: FlyerTemplatePresetId
  /** Composições salvas por modelo/formato; não são páginas da instância. */
  pageBlueprints?: FlyerTemplatePageBlueprint[]
}

export type FlyerTemplateSummary = {
  id: string
  name: string
  preview_url: string | null
  preview_width: number | null
  preview_height: number | null
  updated_at: string | null
  created_at: string | null
  is_template?: boolean
  template_page_count?: number
  template_model_count?: number
  template_format_count?: number
}

const createPageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `page_${Date.now()}`
}

const createModelId = (index: number): string => `model-${index + 1}-${createPageId()}`

const normalizeModelDrafts = (names: string[] | undefined): FlyerTemplateModelDraft[] => {
  const seen = new Set<string>()
  const normalized = (Array.isArray(names) ? names : [])
    .map((name, index) => {
      const cleanName = String(name || '').trim().slice(0, 60)
      return cleanName || `Modelo ${index + 1}`
    })
    .filter((name) => {
      const key = name.toLocaleLowerCase('pt-BR')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((name, index) => ({ id: createModelId(index), name }))

  return normalized.length ? normalized : [{ id: createModelId(0), name: 'Modelo 1' }]
}

const getStoredProjectPages = (canvasData: any): any[] => {
  if (Array.isArray(canvasData)) return canvasData
  if (canvasData && typeof canvasData === 'object' && Array.isArray(canvasData.pages)) {
    return canvasData.pages
  }
  return []
}

const inferFormatIdFromPage = (page: any): FlyerTemplateFormatId => {
  const width = Number(page?.width || 0)
  const height = Number(page?.height || 0)
  // O tamanho salvo da página é a fonte de verdade para a biblioteca do
  // modelo. Versões antigas alteravam width/height para 1:1, mas mantinham
  // templateFormatId="feed"; confiar primeiro no id fazia a edição rápida
  // buscar o canvas de outro formato.
  const exactFormat = FLYER_TEMPLATE_FORMATS.find(format => (
    format.width === Math.round(width) && format.height === Math.round(height)
  ))
  if (exactFormat) return exactFormat.id

  const explicitId = String(page?.templateFormatId || '').trim()
  if (FLYER_TEMPLATE_FORMATS.some(format => format.id === explicitId)) {
    return explicitId as FlyerTemplateFormatId
  }

  if (!(width > 0 && height > 0)) return 'feed'
  const ratio = width / height
  return FLYER_TEMPLATE_FORMATS.reduce((best, format) => {
    const bestDistance = Math.abs((best.width / best.height) - ratio)
    const distance = Math.abs((format.width / format.height) - ratio)
    return distance < bestDistance ? format : best
  }, FLYER_TEMPLATE_FORMATS[0]).id
}

const normalizePageBlueprint = (value: any, index: number): FlyerTemplatePageBlueprint | null => {
  if (!value || typeof value !== 'object') return null
  const formatId = getFlyerTemplateFormat(inferFormatIdFromPage(value)).id
  const format = getFlyerTemplateFormat(formatId)
  const width = Math.max(320, Math.round(Number(value.width || format.width)))
  const height = Math.max(320, Math.round(Number(value.height || format.height)))
  const modelId = String(value.templateModelId || value.modelId || '').trim() || 'model-1'
  const modelName = String(value.templateModelName || value.modelName || '').trim() || `Modelo ${index + 1}`
  const sourcePageId = String(value.sourcePageId || value.id || '').trim()
  const canvasDataPath = String(value.canvasDataPath || '').trim()

  return {
    sourcePageId: sourcePageId || `source-page-${index + 1}`,
    name: String(value.name || `${modelName} · ${format.label}`).trim() || `${modelName} · ${format.label}`,
    width,
    height,
    type: value.type === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER',
    ...(canvasDataPath ? { canvasDataPath } : {}),
    ...(String(value.thumbnailUrl || '').trim() ? { thumbnailUrl: String(value.thumbnailUrl).trim() } : {}),
    templateModelId: modelId,
    templateModelName: modelName,
    templateFormatId: format.id,
    templateFormatLabel: format.label,
    ...(String(value.templateThemeId || '').trim() ? { templateThemeId: String(value.templateThemeId).trim() } : {}),
    ...(String(value.templateThemeName || '').trim() ? { templateThemeName: String(value.templateThemeName).trim() } : {})
  }
}

export const buildFlyerTemplatePageBlueprints = (pages: any[]): FlyerTemplatePageBlueprint[] => {
  if (!Array.isArray(pages)) return []
  return pages
    .map((page, index) => normalizePageBlueprint(page, index))
    .filter((page): page is FlyerTemplatePageBlueprint => !!page)
}

/**
 * Mantém a biblioteca do tema previsível: modelos ficam agrupados e seus
 * formatos seguem a ordem visual padrão. O índice original é usado como
 * desempate para páginas antigas que ainda não têm metadados completos.
 */
export const orderFlyerTemplatePages = (
  pages: any[],
  templateConfig: Pick<FlyerTemplateConfig, 'models'>
): any[] => {
  if (!Array.isArray(pages)) return []

  const modelOrder = new Map(
    (Array.isArray(templateConfig?.models) ? templateConfig.models : [])
      .map((model, index) => [String(model?.id || '').trim(), index] as const)
      .filter(([id]) => !!id)
  )
  const formatOrder = new Map(FLYER_TEMPLATE_FORMATS.map((format, index) => [format.id, index] as const))

  return pages
    .map((page, index) => ({ page, index }))
    .sort((left, right) => {
      const leftModelId = String(left.page?.templateModelId || '').trim()
      const rightModelId = String(right.page?.templateModelId || '').trim()
      const leftModelOrder = modelOrder.get(leftModelId) ?? Number.MAX_SAFE_INTEGER
      const rightModelOrder = modelOrder.get(rightModelId) ?? Number.MAX_SAFE_INTEGER
      if (leftModelOrder !== rightModelOrder) return leftModelOrder - rightModelOrder

      const leftFormatId = inferFormatIdFromPage(left.page)
      const rightFormatId = inferFormatIdFromPage(right.page)
      const leftFormatOrder = formatOrder.get(leftFormatId) ?? Number.MAX_SAFE_INTEGER
      const rightFormatOrder = formatOrder.get(rightFormatId) ?? Number.MAX_SAFE_INTEGER
      if (leftFormatOrder !== rightFormatOrder) return leftFormatOrder - rightFormatOrder

      return left.index - right.index
    })
    .map(({ page }) => page)
}

const normalizeTemplateConfig = (value: any, pages: any[] = []): FlyerTemplateConfig => {
  const rawFormats = Array.isArray(value?.formatIds)
    ? value.formatIds
    : pages.map(page => String(page?.templateFormatId || '').trim()).filter(Boolean)
  const formatIds = [...new Set(rawFormats
    .map((id: unknown) => String(id || '').trim())
    .map((id: string) => getFlyerTemplateFormat(id).id))] as FlyerTemplateFormatId[]
  const safeFormatIds = formatIds.length ? formatIds : [getFlyerTemplateFormat('feed').id]

  const rawModels = Array.isArray(value?.models)
    ? value.models
    : pages.map((page, index) => ({
        id: String(page?.templateModelId || '').trim() || `model-${index + 1}`,
        name: String(page?.templateModelName || '').trim() || `Modelo ${index + 1}`
      }))
  const seenModels = new Set<string>()
  const models = rawModels
    .map((model: any, index: number) => {
      const name = String(model?.name || '').trim() || `Modelo ${index + 1}`
      const id = String(model?.id || '').trim() || `model-${index + 1}`
      return { id, name }
    })
    .filter((model: FlyerTemplateModelDraft) => {
      const key = model.id || model.name.toLocaleLowerCase('pt-BR')
      if (seenModels.has(key)) return false
      seenModels.add(key)
      return true
    })
  const safeModels = models.length ? models : [{ id: 'model-1', name: 'Modelo 1' }]
  const defaultModelId = String(value?.defaultModelId || '').trim() || safeModels[0]?.id || 'model-1'
  const defaultFormatId = getFlyerTemplateFormat(
    String(value?.defaultFormatId || '').trim() || safeFormatIds[0] || 'feed'
  ).id

  return {
    version: 1,
    formatIds: safeFormatIds,
    models: safeModels,
    defaultModelId,
    defaultFormatId,
    ...(String(value?.sourceTemplateId || '').trim()
      ? { sourceTemplateId: String(value.sourceTemplateId).trim() }
      : {}),
    ...(isFlyerTemplatePresetId(value?.templatePresetId)
      ? { templatePresetId: value.templatePresetId }
      : {}),
    pageBlueprints: Array.isArray(value?.pageBlueprints)
      ? buildFlyerTemplatePageBlueprints(value.pageBlueprints)
      : undefined
  }
}

/**
 * Normaliza a biblioteca de um tema a partir das páginas realmente salvas.
 * É usado tanto na criação da cópia do cliente quanto na recuperação de
 * projetos antigos que ainda não tinham `pageBlueprints` persistidos.
 */
export const buildFlyerTemplateConfigFromPages = (
  value: any,
  pages: any[],
  sourceTemplateId?: string
): FlyerTemplateConfig => {
  const normalized = normalizeTemplateConfig(value, pages)
  const orderedPages = orderFlyerTemplatePages(pages, normalized)
  const normalizedSourceTemplateId = String(sourceTemplateId || normalized.sourceTemplateId || '').trim()

  return {
    ...normalized,
    ...(normalizedSourceTemplateId ? { sourceTemplateId: normalizedSourceTemplateId } : {}),
    pageBlueprints: buildFlyerTemplatePageBlueprints(orderedPages)
  }
}

export const getFlyerTemplateFormat = (id: string) => {
  return FLYER_TEMPLATE_FORMATS.find(item => item.id === id) || FLYER_TEMPLATE_FORMATS[0]
}

export const listFlyerTemplates = async (headers: Record<string, string>): Promise<FlyerTemplateSummary[]> => {
  const rows = await $fetch<any>('/api/projects', {
    headers,
    query: { templates: '1' }
  })
  return Array.isArray(rows) ? rows : []
}

export const createFlyerTemplate = async (opts: {
  headers: Record<string, string>
  name: string
  formatIds?: FlyerTemplateFormatId[]
  modelNames?: string[]
  templatePresetId?: FlyerTemplatePresetId
  width?: number
  height?: number
}): Promise<string> => {
  const rawName = String(opts.name || '').trim().toLocaleLowerCase('pt-BR') || 'modelo de encarte'
  const name = rawName.charAt(0).toLocaleUpperCase('pt-BR') + rawName.slice(1)
  const requestedFormatIds = Array.isArray(opts.formatIds)
    ? [...new Set(opts.formatIds.map(id => String(id).trim() as FlyerTemplateFormatId))]
    : []
  const selectedFormats = requestedFormatIds
    .map(id => getFlyerTemplateFormat(id))
    .filter((format, index, formats) => formats.findIndex(item => item.id === format.id) === index)
  const formats = selectedFormats.length
    ? selectedFormats
    : [{
        ...getFlyerTemplateFormat('feed'),
        width: Math.max(320, Math.round(Number(opts.width || 1080))),
        height: Math.max(320, Math.round(Number(opts.height || 1350)))
      }]
  const firstFormat = formats[0] || getFlyerTemplateFormat('feed')
  const formatIds = formats.map(format => format.id)
  const models = normalizeModelDrafts(opts.modelNames)
  const firstModel = models[0] || { id: 'model-1', name: 'Modelo 1' }
  const templateConfig: FlyerTemplateConfig = {
    version: 1,
    formatIds,
    models,
    defaultModelId: firstModel.id,
    defaultFormatId: firstFormat.id,
    ...(isFlyerTemplatePresetId(opts.templatePresetId)
      ? { templatePresetId: opts.templatePresetId }
      : {})
  }
  const response = await $fetch<any>('/api/projects', {
    method: 'POST',
    headers: opts.headers,
    body: {
      name,
      is_template: true,
      last_viewed: new Date().toISOString(),
      // Cada formato escolhido ganha sua própria página de criação.
      canvas_data: models.flatMap(model => formats.map(format => ({
        id: createPageId(),
        name: `${model.name} · ${format.label}`,
        width: Math.max(320, Math.round(format.width)),
        height: Math.max(320, Math.round(format.height)),
        type: 'RETAIL_OFFER',
        templateModelId: model.id,
        templateModelName: model.name,
        templateFormatId: format.id,
        templateFormatLabel: format.label,
        templateThemeId: 'market-red',
        templateThemeName: 'Oferta vermelha'
      }))),
      template_config: templateConfig
    }
  })
  const projectId = String(response?.project?.id || '').trim()
  if (!projectId) throw new Error('O servidor não criou o modelo.')
  writeFlyerTemplateStarterSeed(projectId, {
    title: name,
    width: Math.max(320, Math.round(firstFormat.width)),
    height: Math.max(320, Math.round(firstFormat.height)),
    formatIds,
    models,
    templatePresetId: isFlyerTemplatePresetId(opts.templatePresetId)
      ? opts.templatePresetId
      : undefined
  })
  return projectId
}

export const writeFlyerTemplateStarterSeed = (projectId: string, opts: {
  title: string
  width: number
  height: number
  formatIds?: FlyerTemplateFormatId[]
  models?: FlyerTemplateModelDraft[]
  templatePresetId?: FlyerTemplatePresetId
  businessProfile?: Record<string, any>
}) => {
  if (typeof window === 'undefined') return
  const id = String(projectId || '').trim()
  if (!id) return
  const seed: QuickEditorSeed = {
    version: QUICK_EDITOR_SEED_VERSION,
    id: `template-${id}-${Date.now()}`,
    title: String(opts.title || 'Ofertas da semana'),
    startDate: null,
    endDate: null,
    validityMode: 'while_stocks',
    validityWhileStocks: true,
    formatId: String(opts.formatIds?.[0] || 'feed'),
    formatIds: Array.isArray(opts.formatIds) && opts.formatIds.length
      ? [...new Set(opts.formatIds.map(id => String(id).trim()))]
      : ['feed'],
    models: Array.isArray(opts.models) && opts.models.length
      ? opts.models.map((model, index) => ({
          id: String(model?.id || '').trim() || createModelId(index),
          name: String(model?.name || '').trim() || `Modelo ${index + 1}`
        }))
      : [{ id: createModelId(0), name: 'Modelo 1' }],
    ...(isFlyerTemplatePresetId(opts.templatePresetId)
      ? { templatePresetId: opts.templatePresetId }
      : {}),
    width: opts.width,
    height: opts.height,
    theme: {
      id: 'market-red',
      name: 'Oferta vermelha',
      backgroundColor: '#fff7ed',
      cardColor: '#ffffff',
      textColor: '#172033',
      accentColor: '#f97316',
      priceColor: '#e11d48',
      mutedColor: '#64748b'
    },
    products: [],
    businessProfile: opts.businessProfile && typeof opts.businessProfile === 'object'
      ? opts.businessProfile
      : {},
    createdAt: new Date().toISOString()
  }
  const serialized = JSON.stringify(seed)
  const storageKey = getQuickEditorSeedKey(id)
  window.sessionStorage.setItem(storageKey, serialized)
  window.localStorage.setItem(storageKey, serialized)
}

export const instantiateFlyerTemplate = async (opts: {
  headers: Record<string, string>
  templateId: string
  name?: string
}): Promise<string> => {
  const templateId = String(opts.templateId || '').trim()
  if (!templateId) throw new Error('Modelo inválido.')

  const fullProject = await $fetch<any>('/api/projects', {
    headers: opts.headers,
    query: { id: templateId }
  })
  const sourcePages = getStoredProjectPages(fullProject?.canvas_data)
  if (!sourcePages.length) {
    throw new Error('Este modelo ainda não tem um encarte salvo.')
  }

  const templateConfig = buildFlyerTemplateConfigFromPages(
    fullProject?.template_config,
    sourcePages,
    templateId
  )
  const orderedSourcePages = orderFlyerTemplatePages(sourcePages, templateConfig)
  const basePage = orderedSourcePages.find((page: any) => (
    String(page?.templateModelId || '').trim() === templateConfig.defaultModelId &&
    inferFormatIdFromPage(page) === templateConfig.defaultFormatId
  )) || sourcePages[0]
  const instancePage = {
    ...basePage,
    id: createPageId(),
    name: String(basePage?.name || `${templateConfig.models[0]?.name || 'Modelo 1'} · ${templateConfig.defaultFormatId}`).trim(),
    // A página criada para o cliente já nasce como uma instância protegida da
    // composição do tema. Isso evita que o primeiro boot da edição rápida
    // aplique a biblioteca global antes do primeiro salvamento.
    templateCompositionManaged: true,
    templateSourcePageId: String(basePage?.id || '').trim() || undefined
  }

  const response = await $fetch<any>('/api/projects', {
    method: 'POST',
    headers: opts.headers,
    body: {
      name: String(opts.name || fullProject?.name || 'Ofertas da semana').trim() || 'Ofertas da semana',
      canvas_data: [instancePage],
      template_config: templateConfig,
      last_viewed: new Date().toISOString(),
      is_template: false
    }
  })
  const projectId = String(response?.project?.id || '').trim()
  if (!projectId) throw new Error('Não foi possível criar o encarte a partir do modelo.')
  return projectId
}

export const duplicateFlyerTemplate = async (opts: {
  headers: Record<string, string>
  templateId: string
}): Promise<string> => {
  const templateId = String(opts.templateId || '').trim()
  if (!templateId) throw new Error('Modelo inválido.')

  const fullProject = await $fetch<any>('/api/projects', {
    headers: opts.headers,
    query: { id: templateId }
  })
  const sourcePages = getStoredProjectPages(fullProject?.canvas_data)
  const normalizedTemplateConfig = normalizeTemplateConfig(fullProject?.template_config, sourcePages)
  const orderedSourcePages = orderFlyerTemplatePages(sourcePages, normalizedTemplateConfig)
  const duplicatedPages = orderedSourcePages.map((page: any) => ({ ...page, id: createPageId() }))
  const templateConfig = {
    ...normalizedTemplateConfig,
    // A referência deve apontar para a página correspondente da cópia, e não
    // para o id antigo do tema original.
    pageBlueprints: buildFlyerTemplatePageBlueprints(duplicatedPages)
  }
  const basePage = orderedSourcePages.find((page: any) => (
    String(page?.templateModelId || '').trim() === templateConfig.defaultModelId &&
    inferFormatIdFromPage(page) === templateConfig.defaultFormatId
  )) || sourcePages[0]
  const width = Number(basePage?.width || 1080)
  const height = Number(basePage?.height || 1350)
  const baseName = String(fullProject?.name || 'Modelo').trim() || 'Modelo'
  const response = await $fetch<any>('/api/projects', {
    method: 'POST',
    headers: opts.headers,
    body: {
      name: `${baseName} (cópia)`.slice(0, 120),
      is_template: true,
      last_viewed: new Date().toISOString(),
      // Duplicar um tema precisa levar todas as composições já criadas, e não
      // somente o formato padrão. A ordem original mantém a biblioteca
      // organizada por modelo/formato no editor avançado.
      canvas_data: duplicatedPages.length
        ? duplicatedPages
        : [{
            id: createPageId(),
            name: 'Encarte',
            width,
            height,
            type: 'RETAIL_OFFER'
          }],
      template_config: templateConfig
    }
  })
  const projectId = String(response?.project?.id || '').trim()
  if (!projectId) throw new Error('Não foi possível duplicar o modelo.')
  return projectId
}

export const saveProjectAsFlyerTemplate = async (opts: {
  headers: Record<string, string>
  projectId: string
}): Promise<string> => {
  const projectId = String(opts.projectId || '').trim()
  if (!projectId) throw new Error('Projeto inválido.')

  const fullProject = await $fetch<any>('/api/projects', {
    headers: opts.headers,
    query: { id: projectId }
  })
  const canvasData = Array.isArray(fullProject?.canvas_data) ? fullProject.canvas_data : null
  if (!canvasData?.length) {
    throw new Error('Este projeto ainda não tem páginas para virar modelo.')
  }

  const baseName = String(fullProject?.name || 'Encarte').trim() || 'Encarte'
  const response = await $fetch<any>('/api/projects', {
    method: 'POST',
    headers: opts.headers,
    body: {
      name: `${baseName} (modelo)`.slice(0, 120),
      canvas_data: canvasData,
      template_config: {
        ...normalizeTemplateConfig(fullProject?.template_config, canvasData),
        pageBlueprints: buildFlyerTemplatePageBlueprints(canvasData)
      },
      is_template: true,
      last_viewed: new Date().toISOString()
    }
  })
  const createdId = String(response?.project?.id || '').trim()
  if (!createdId) throw new Error('Não foi possível salvar o modelo.')
  return createdId
}
