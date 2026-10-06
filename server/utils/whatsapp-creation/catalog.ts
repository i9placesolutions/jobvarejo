import { pgQuery } from '../postgres'
import { createError } from 'h3'
import { normalizeStoragePath } from '../storage-scope'
import { VIDEO_THEMES } from '~/shared/video-studio/model'
import { newVideoFromTemplate } from '~/shared/video-studio/templates'
import flyerRecipes from '~/shared/video-studio/generated-flyer-recipes.json'
import { ART_FORMATS } from '~/types/art-studio'
import { CARTAZISTA_FORMATS, CARTAZISTA_MODEL_KEYS, CARTAZISTA_THEMES } from '~/types/cartazista'
import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'
import { getPublicUrl } from '../s3'
import catalogManifest from '~/shared/video-studio/catalog-assets.json'
import { resolveVideoCatalogAsset, type VideoCatalogManifest } from '../video-studio/catalog-assets'

export type CreationHeader = {
  id: string
  revision: number
  theme: string
  formats: string[]
  name: string
  headerKey?: string
  previewUrl?: string
  sourceOwnerId?: string
  sourceUpdatedAt?: string
  nativeThemeId?: string
  sourceThumbnailKey?: string
  sourceCanvasKey?: string
  sourcePageHeight?: number
  /** Modelo de tema parecido, oferecido porque não há modelo com o tema exato pedido. */
  related?: boolean
}

export type CreationHeaderPage = {
  headers: CreationHeader[]
  hasMore: boolean
  missingTheme: boolean
  /** Temas parecidos oferecidos no lugar do tema pedido. */
  relatedThemes?: string[]
  /** Temas existentes para sugerir quando nada parecido foi encontrado. */
  suggestedThemes?: string[]
}

type ProjectTemplateRow = {
  id: string
  name: string
  owner_id: string
  updated_at: string | Date | null
  preview_url: string | null
  template_config: unknown
  page_metadata: unknown
}

type ArtTemplateRow = {
  id: string
  owner_id: string
  name: string
  category: string
  tags: unknown
  composition: unknown
  revision: number
  updated_at: string | Date | null
}

const PAGE_SIZE = 4
const MAX_CATALOG_ROWS = 2000
const THEME_ALIASES: Record<string, string> = {
  fechames: 'fecha mes',
  fimsemana: 'fim de semana',
  'fim de semana': 'fim de semana'
}

export const normalizeCreationTheme = (value: unknown): string => {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  const compact = normalized.replace(/\s/g, '')
  return THEME_ALIASES[normalized] || THEME_ALIASES[compact] || normalized
}

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}

const text = (value: unknown): string => String(value ?? '').trim()

const uniqueStrings = (values: unknown[]): string[] => [...new Set(values.map(text).filter(Boolean))]

const sourceRevision = (value: string | Date | null): { revision: number; sourceUpdatedAt?: string } => {
  const sourceUpdatedAt = value instanceof Date ? value.toISOString() : text(value)
  const milliseconds = sourceUpdatedAt ? Date.parse(sourceUpdatedAt) : Number.NaN
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0
    ? { revision: milliseconds, sourceUpdatedAt }
    : { revision: 0 }
}

const extractStorageKey = (value: unknown): string | undefined => {
  const raw = typeof value === 'string'
    ? value
    : text(asRecord(value).key || asRecord(value).storageKey || asRecord(value).s3_key)
  const key = normalizeStoragePath(raw)
  return key && !/^https?:\/\//i.test(key) && !key.includes('@') ? key : undefined
}

const isPublicPreview = (value: unknown): string | undefined => {
  const candidate = text(value)
  if (!candidate) return undefined
  if (/^\/video-studio\/templates\/[a-zA-Z0-9_./-]+$/.test(candidate)) return candidate
  const key = extractStorageKey(candidate)
  return key?.startsWith('imagens/') ? getPublicUrl(key) : undefined
}

const requestedFormatsMatch = (requested: string[], available: string[]): boolean =>
  requested.length === 0 || requested.every(format => available.some(item => normalizeCreationTheme(item) === normalizeCreationTheme(format)))

const requestedResultFormats = (requested: string[], available: string[]): string[] => requested.length
  ? requested.filter(format => available.some(item => normalizeCreationTheme(item) === normalizeCreationTheme(format)))
  : available

const themeMatches = (requested: string, values: unknown[]): boolean => {
  const target = normalizeCreationTheme(requested)
  return Boolean(target) && values.some(value => normalizeCreationTheme(value) === target)
}

const ENCARTE_THEME_STOPWORDS = new Set(['e', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'em', 'para'])

const encarteThemeMatches = (requested: string, values: unknown[]): boolean => {
  const target = normalizeCreationTheme(requested)
  if (!target) return false

  const normalizedValues = values.map(normalizeCreationTheme)
  if (normalizedValues.includes(target)) return true

  const significantTerms = target.split(' ').filter(term => !ENCARTE_THEME_STOPWORDS.has(term))
  if (significantTerms.length < 2) return false
  return normalizedValues.some(value => value.startsWith(`${target} `))
}

// Palavras genéricas que não distinguem um tema de outro.
const THEME_GENERIC_WORDS = new Set(['oferta', 'ofertas', 'encarte', 'encartes', 'promocao', 'promocoes', 'tabloide', 'panfleto', 'super', 'mega', 'loja'])
const WEEKDAY_WORDS = new Set(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'])
// Sinônimos de seção/campanha usados pelos clientes, levados aos nomes do catálogo.
const THEME_SYNONYMS: Array<[RegExp, string[]]> = [
  [/^(?:carne|carnes|churrasco|bovina|bovino|boi|frango|frangos|suina|suino|porco|linguica|linguicas|picanha|costela|acougue|acougues|frios)$/, ['acougue', 'carne']],
  [/^(?:fruta|frutas|verdura|verduras|legume|legumes|feira|hortifruti|hortifrutti|hortfruti|horti|verde|verdes)$/, ['hortifruti', 'verde', 'feira']],
  [/^(?:pao|paes|padaria|bolo|bolos|confeitaria)$/, ['padaria']],
  [/^(?:cerveja|cervejas|bebida|bebidas|refrigerante|refrigerantes|refri|vinho|vinhos)$/, ['bebidas']],
  [/^(?:limpeza|higiene)$/, ['limpeza']],
  [/^(?:fds|finde|sabado|domingo)$/, ['fim', 'semana']],
  [/^(?:black|blackfriday)$/, ['black', 'friday']],
  [/^(?:aniversario|niver)$/, ['aniversario']]
]
const themeTokens = (value: unknown): string[] => normalizeCreationTheme(value).split(' ')
  .filter(term => term && !ENCARTE_THEME_STOPWORDS.has(term) && !THEME_GENERIC_WORDS.has(term))
const expandThemeTokens = (terms: string[]): Set<string> => {
  const expanded = new Set(terms)
  for (const term of terms) for (const [pattern, extra] of THEME_SYNONYMS) if (pattern.test(term)) extra.forEach(item => expanded.add(item))
  return expanded
}
/** Afinidade entre o tema pedido e o tema de um modelo (0 = nada em comum). Dia da semana pesa pouco. */
export const encarteThemeAffinity = (requested: string, category: unknown, subcategory: unknown): number => {
  const wanted = expandThemeTokens(themeTokens(requested))
  if (!wanted.size) return 0
  const score = (value: unknown, weight: number) => [...expandThemeTokens(themeTokens(value))]
    .reduce((sum, term) => sum + (wanted.has(term) ? (WEEKDAY_WORDS.has(term) ? 0.5 : weight) : 0), 0)
  return score(subcategory, 2) + score(category, 1)
}

const projectPages = (value: unknown): Record<string, any>[] => {
  const root = asRecord(value)
  const pages = Array.isArray(value) ? value : Array.isArray(root.pages) ? root.pages : []
  return pages.filter(page => page && typeof page === 'object' && !Array.isArray(page)) as Record<string, any>[]
}

const encarteHeaders = async (
  accountId: string,
  requestedTheme: string,
  requestedFormats: string[]
): Promise<{ headers: CreationHeader[]; themeExists: boolean; relatedThemes?: string[]; suggestedThemes?: string[] }> => {
  const { rows } = await pgQuery<ProjectTemplateRow>(
    `select project.id, project.name, project.user_id as owner_id, project.updated_at,
            project.preview_url, project.template_config,
            case
              when jsonb_typeof(project.canvas_data) = 'array' then (
                select coalesce(jsonb_agg(case when jsonb_typeof(page.value) = 'object'
                  then page.value - 'canvasData' - 'canvas_data' else page.value end order by page.ordinality), '[]'::jsonb)
                  from jsonb_array_elements(project.canvas_data) with ordinality as page(value, ordinality)
              )
              when jsonb_typeof(project.canvas_data -> 'pages') = 'array' then (
                select coalesce(jsonb_agg(case when jsonb_typeof(page.value) = 'object'
                  then page.value - 'canvasData' - 'canvas_data' else page.value end order by page.ordinality), '[]'::jsonb)
                  from jsonb_array_elements(project.canvas_data -> 'pages') with ordinality as page(value, ordinality)
              )
              else '[]'::jsonb
            end as page_metadata
       from public.projects project
       join public.profiles owner on owner.id = project.user_id
      where coalesce(project.is_template, false) = true
        and (project.user_id = $1::uuid or owner.role in ('admin', 'super_admin'))
      order by project.updated_at desc
      limit ${MAX_CATALOG_ROWS}`,
    [accountId]
  )

  const matches: CreationHeader[] = []
  const related: Array<{ header: CreationHeader; score: number; label: string; category: string }> = []
  const suggestions = new Map<string, number>()
  let themeExists = false
  for (const row of rows || []) {
    const config = asRecord(row.template_config)
    const pages = projectPages(row.page_metadata)
    const themeValues = [config.category, config.subcategory, config.theme, config.themeName,
      ...pages.flatMap(page => [page.templateThemeId, page.templateThemeName])]
    const label = text(config.subcategory || config.category || config.theme)
    if (label) suggestions.set(label, (suggestions.get(label) || 0) + 1)
    const exact = encarteThemeMatches(requestedTheme, themeValues)
    const affinity = exact ? 0 : encarteThemeAffinity(requestedTheme, config.category, config.subcategory || config.theme)
    if (!exact && affinity < 1) continue
    if (exact) themeExists = true
    const availableFormats = uniqueStrings([
      ...(Array.isArray(config.formatIds) ? config.formatIds : []),
      ...pages.flatMap(page => [page.templateFormatId, page.templateFormatLabel,
        Number(page.width) > 0 && Number(page.height) > 0 ? `${Number(page.width)}x${Number(page.height)}` : ''])
    ])
    if (!requestedFormatsMatch(requestedFormats, availableFormats)) continue

    const headerKey = extractStorageKey(asRecord(config.assets).header)
    const revision = sourceRevision(row.updated_at)
    if (!revision.sourceUpdatedAt) continue
    const publicPreview = isPublicPreview(row.preview_url) || pages
      .map(page => isPublicPreview(page.thumbnailUrl || page.thumbnail_url))
      .find(Boolean)
    const previewPage = pages.find(page => page.templateFormatId === (requestedFormats[0] || 'stories')) ||
      pages.find(page => page.templateFormatId === 'stories') || pages[0]
    const sourceThumbnailKey = extractStorageKey(previewPage?.thumbnailPath || previewPage?.thumbnailUrl)
    const sourceCanvasKey = extractStorageKey(previewPage?.canvasDataPath)
    const header: CreationHeader = {
      id: row.id,
      revision: revision.revision,
      theme: text(config.category || config.subcategory || config.theme || requestedTheme),
      formats: requestedResultFormats(requestedFormats, availableFormats),
      name: text(row.name),
      ...(headerKey ? { headerKey } : {}),
      ...(publicPreview ? { previewUrl: publicPreview } : {}),
      sourceOwnerId: row.owner_id,
      ...(previewPage && sourceThumbnailKey && sourceCanvasKey && Number(previewPage.height) > 0 ? {
        sourceThumbnailKey, sourceCanvasKey, sourcePageHeight: Number(previewPage.height)
      } : {}),
      ...(revision.sourceUpdatedAt ? { sourceUpdatedAt: revision.sourceUpdatedAt } : {})
    }
    if (exact) matches.push(header)
    else related.push({ header: { ...header, theme: label || header.theme, related: true }, score: affinity, label, category: text(config.category) || label })
  }
  if (matches.length || themeExists) return { headers: matches, themeExists }
  // Sem modelo do tema exato: oferece os de tema mais parecido em vez de travar a conversa.
  related.sort((a, b) => b.score - a.score)
  const topScore = related[0]?.score || 0
  // Mantém a seção inteira (ex.: todos os modelos de Açougue), com os mais parecidos primeiro.
  const closest = related.filter(item => item.score >= Math.max(1, topScore / 3))
  const suggestedThemes = [...suggestions.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 8)
  return { headers: closest.map(item => item.header), themeExists: false, relatedThemes: [...new Set(closest.map(item => item.category).filter(Boolean))].slice(0, 3), suggestedThemes }
}

const videoHeaders = (requestedTheme: string, requestedFormats: string[]): { headers: CreationHeader[]; themeExists: boolean } => {
  const matchingThemes = VIDEO_THEMES.filter(theme => themeMatches(requestedTheme, [theme.id, theme.name, theme.title]))
  const nativeFormat = (format: string): string | undefined =>
    format === 'stories' ? 'vertical' : format === 'tv' ? 'horizontal' : undefined
  const supportedRequestFormats = requestedFormats.map(nativeFormat)
  const headers = matchingThemes
    .filter(theme => {
      try { return newVideoFromTemplate(theme.id).theme === theme.id } catch { return false }
    })
    .filter(() => requestedFormats.length === 0 || supportedRequestFormats.every(format => format && ['vertical', 'horizontal'].includes(format)))
    .map(theme => {
      const recipe = flyerRecipes.find(item => item.id === theme.id)
      const sealPath = recipe?.seal || (theme.id === 'impact' ? 'fecha-mes-badge-v1.png' : undefined)
      const seal = sealPath ? resolveVideoCatalogAsset(catalogManifest as VideoCatalogManifest, `templates/${sealPath}`) : null
      const availableFormats = requestedFormats.length ? requestedFormats : ['stories', 'tv']
      return {
        id: theme.id,
        revision: Number.isSafeInteger(Number(recipe?.revision)) ? Number(recipe?.revision || 1) : 1,
        theme: text(theme.title || theme.name),
        formats: requestedResultFormats(requestedFormats, availableFormats),
        name: text(theme.name),
        ...(seal ? {
          headerKey: seal.key,
          previewUrl: `/video-studio/templates/${sealPath}`
        } : {})
      }
    })
  return { headers, themeExists: matchingThemes.length > 0 }
}

const cartazHeaders = async (requestedTheme: string, requestedFormats: string[]): Promise<{ headers: CreationHeader[]; themeExists: boolean }> => {
  const requested = normalizeCreationTheme(requestedTheme)
  const requestedTokens = requested.split(' ').filter(token => token.length > 2 &&
    !['cartaz', 'modelo', 'tema', 'oferta', 'ofertas', 'campanha', 'promocao', 'especial'].includes(token))
  const palette = CARTAZISTA_THEMES.find(item => themeMatches(requested, [item.id, item.name])) ||
    CARTAZISTA_THEMES.find(item => requestedTokens.length > 0 &&
      requestedTokens.every(token => `${normalizeCreationTheme(item.id)} ${normalizeCreationTheme(item.name)}`.split(' ').includes(token))) ||
    CARTAZISTA_THEMES.find(item => item.id === 'classic-yellow')
  const availableFormats = CARTAZISTA_FORMATS.map(format => format.id)
  if (!requested || !palette) {
    return Promise.resolve({ themeExists: false, headers: [] })
  }
  if (!requestedFormatsMatch(requestedFormats, availableFormats)) return { themeExists: true, headers: [] }

  const meaningfulTokens = requested.split(' ').filter(token => token.length >= 4 &&
    !['cartaz', 'modelo', 'tema', 'oferta', 'ofertas', 'campanha', 'promocao', 'especial'].includes(token))
  const starterRows = CARTAZISTA_STARTER_MODELS.map(model => ({ ...model, owner_id: undefined, composition: undefined }))
  const matchingModels = starterRows.filter(model => {
    const values = [model.id, model.name, model.category, model.description, ...model.tags].map(normalizeCreationTheme)
    return values.some(value => themeMatches(requested, [value])) ||
      meaningfulTokens.some(token => values.some(value => value.split(' ').includes(token)))
  })

  const loadPublishedModels = async () => {
    try {
      const { rows } = await pgQuery<{
        id: string
        owner_id: string
        model_key: string | null
        name: string
        category: string
        description: string
        tags: unknown
        composition: unknown
        published: boolean
        revision: number
      }>(
        `select id, owner_id, model_key, name, category, description, tags, composition, published, revision
           from public.cartazista_templates
          where published = true
          order by updated_at desc
          limit 200`,
        []
      )
      return rows || []
    } catch (error: any) {
      if (error?.code === '42P01') return []
      throw error
    }
  }

  // The Cartazista renderer accepts its published model keys and palette IDs only.
  // Keep campaign wording in `theme`; provide the real palette separately for rendering.
  const rows = await loadPublishedModels()
    const byId = new Map<string, any>(matchingModels.map(model => [model.id, model]))
    for (const row of rows) {
      const id = text(row.model_key || row.id)
      if (!CARTAZISTA_MODEL_KEYS.includes(id as typeof CARTAZISTA_MODEL_KEYS[number])) continue
      const tags = Array.isArray(row.tags) ? row.tags.map(text) : []
      const candidate = { ...row, id, tags }
      const values = [candidate.id, candidate.name, candidate.category, candidate.description, ...tags].map(normalizeCreationTheme)
      const matches = values.some(value => themeMatches(requested, [value])) ||
        meaningfulTokens.some(token => values.some(value => value.split(' ').includes(token)))
      if (matches) byId.set(id, candidate)
    }
    // A native palette is a valid requested theme, but an unknown campaign must not
    // silently receive an unrelated standard header.
    if (!byId.size && CARTAZISTA_THEMES.some(item => themeMatches(requested, [item.id, item.name]))) {
      const fallback = CARTAZISTA_STARTER_MODELS.find(model => model.id === 'standard')!
      byId.set(fallback.id, { ...fallback, owner_id: undefined, composition: undefined })
    }
    if (!byId.size) return { themeExists: false, headers: [] }
    const formats = requestedResultFormats(requestedFormats, availableFormats)
    const headers = [...byId.values()].map(model => {
      const preview = isPublicPreview(asRecord(model.composition).previewUrl || asRecord(model.composition).preview_url)
      const revision = Number(model.revision)
      return {
        id: model.id,
        revision: Number.isSafeInteger(revision) && revision > 0 ? revision : 1,
        theme: requestedTheme,
        nativeThemeId: palette.id,
        formats,
        name: text(model.name),
        ...(preview ? { previewUrl: preview } : {}),
        ...(model.owner_id ? { sourceOwnerId: String(model.owner_id) } : {})
      }
    })
  return { themeExists: true, headers }
}

const artFormatIds = (composition: unknown): string[] => {
  const root = asRecord(composition)
  const pages = [root, ...(Array.isArray(root.alternates) ? root.alternates.map(asRecord) : [])]
  return uniqueStrings(pages.flatMap(page => {
    const width = Number(page.width)
    const height = Number(page.height)
    return ART_FORMATS.filter(format => format.width === width && format.height === height).map(format => format.id)
  }))
}

const studioHeaders = async (
  requestedTheme: string,
  requestedFormats: string[]
): Promise<{ headers: CreationHeader[]; themeExists: boolean }> => {
  const { rows } = await pgQuery<ArtTemplateRow>(
    `select id, owner_id, name, category, tags, composition, revision, updated_at
       from public.art_studio_templates
      where published = true
      order by updated_at desc
      limit 500`,
    []
  )
  let themeExists = false
  const headers = (rows || []).flatMap(row => {
    const tags = Array.isArray(row.tags) ? row.tags : []
    const composition = asRecord(row.composition)
    if (!themeMatches(requestedTheme, [row.category, ...tags, ...(Array.isArray(composition.tags) ? composition.tags : [])])) return []
    themeExists = true
    const availableFormats = artFormatIds(row.composition)
    if (!requestedFormatsMatch(requestedFormats, availableFormats)) return []
    const revision = Number(row.revision)
    const updated = sourceRevision(row.updated_at)
    const actualPreview = isPublicPreview(composition.previewUrl || composition.preview_url)
    return [{
      id: row.id,
      revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : updated.revision,
      theme: text(row.category || requestedTheme),
      formats: requestedResultFormats(requestedFormats, availableFormats),
      name: text(row.name),
      ...(actualPreview ? { previewUrl: actualPreview } : {}),
      sourceOwnerId: row.owner_id,
      ...(updated.sourceUpdatedAt ? { sourceUpdatedAt: updated.sourceUpdatedAt } : {})
    }]
  })
  return { headers, themeExists }
}

export async function listCreationHeaders(
  accountId: string,
  kind: 'encarte' | 'video' | 'cartaz' | 'studio',
  theme: string,
  formats: string[],
  offset = 0,
  preferredHeaderId?: string
): Promise<CreationHeaderPage> {
  const normalizedAccountId = text(accountId)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedAccountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Conta inválida.' })
  }
  const normalizedTheme = text(theme)
  const requestedFormats = uniqueStrings(Array.isArray(formats) ? formats : [])
  const safeOffset = Number.isSafeInteger(offset) && offset > 0 ? offset : 0

  const catalog = kind === 'encarte'
    ? await encarteHeaders(normalizedAccountId, normalizedTheme, requestedFormats)
    : kind === 'video'
      ? videoHeaders(normalizedTheme, requestedFormats)
      : kind === 'cartaz'
        ? await cartazHeaders(normalizedTheme, requestedFormats)
        : await studioHeaders(normalizedTheme, requestedFormats)
  const orderedHeaders = [...catalog.headers]
  const preferredIndex = preferredHeaderId ? orderedHeaders.findIndex(header => header.id === text(preferredHeaderId)) : -1
  if (safeOffset === 0 && preferredIndex > 0) orderedHeaders.unshift(...orderedHeaders.splice(preferredIndex, 1))
  const headers = orderedHeaders.slice(safeOffset, safeOffset + PAGE_SIZE)
  const extra = catalog as { relatedThemes?: string[]; suggestedThemes?: string[] }
  return { headers, hasMore: catalog.headers.length > safeOffset + PAGE_SIZE, missingTheme: !catalog.themeExists,
    ...(extra.relatedThemes?.length ? { relatedThemes: extra.relatedThemes } : {}),
    ...(extra.suggestedThemes?.length ? { suggestedThemes: extra.suggestedThemes } : {}) }
}

type ProductImageRow = {
  id: string | number
  search_term: string | null
  product_name: string | null
  brand: string | null
  flavor: string | null
  weight: string | null
  image_url: string | null
  s3_key: string | null
  usage_count: number | null
}

export type ProductCandidateInput = { name: string; brand?: string; variant?: string; weight?: string }
export type ProductCandidate = { id: string; name: string; brand: string; variant: string; weight: string; key: string; previewUrl: string }

const normalizeProductText = (value: unknown): string => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  .replace(/(\d)[,](\d)/g, '$1.$2').replace(/[^a-z0-9.]+/g, ' ').trim().replace(/\s+/g, ' ')

const normalizeWeight = (value: unknown): string => normalizeProductText(value).replace(/\s+/g, '')
const PRODUCT_NAME_UNIT_TOKENS = new Set(['kg', 'g', 'mg', 'ml', 'l', 'un', 'pct', 'cx', 'fardo', 'fd'])

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&')

export async function listProductCandidates(
  accountId: string,
  product: ProductCandidateInput
): Promise<ProductCandidate[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(accountId))) {
    throw createError({ statusCode: 400, statusMessage: 'Conta inválida.' })
  }
  const requestedName = normalizeProductText(product?.name)
  if (!requestedName) return []
  const { rows } = await pgQuery<ProductImageRow>(
    `select id, search_term, product_name, brand, flavor, weight, image_url, s3_key, usage_count
       from public.product_image_cache
      where image_url is not null
        and s3_key like 'imagens/%'
        and (product_name ilike $1 escape '\\' or search_term ilike $1 escape '\\')
      order by (lower(btrim(product_name)) = lower(btrim($2))) desc,
               (lower(btrim(brand)) = lower(btrim($3))) desc,
               (lower(btrim(flavor)) = lower(btrim($4))) desc,
               (lower(btrim(weight)) = lower(btrim($5))) desc,
               usage_count desc nulls last, id desc
      limit 250`,
    [`%${escapeLike(text(product.name))}%`, text(product.name), text(product.brand), text(product.variant), text(product.weight)]
  )
  const requestedBrand = normalizeProductText(product.brand)
  const requestedVariant = normalizeProductText(product.variant)
  const requestedWeight = normalizeWeight(product.weight)
  const nameTokens = requestedName.split(' ').filter(token => token.length > 1 &&
    !PRODUCT_NAME_UNIT_TOKENS.has(token) && !/^\d+(?:\.\d+)?$/.test(token))
  return (rows || [])
    .map(row => {
      const name = text(row.product_name || row.search_term)
      const productName = normalizeProductText(row.product_name || row.search_term)
      const productNameTokens = productName.split(' ').filter(Boolean)
      const variant = text(row.flavor)
      const key = normalizeStoragePath(row.s3_key)
      const searchable = normalizeProductText([name, row.search_term, row.brand, row.flavor, row.weight].join(' '))
      // A search term can be an ingredient/flavor ("cenoura") even when the
      // catalog item is another product ("massa para bolo sabor cenoura").
      // For a one-word request, require that word to identify the product name
      // itself. Keep multi-word matching across searchable metadata so brand and
      // package details stored in separate columns continue to match.
      const simpleNameIsProductIdentity = nameTokens.length !== 1 || productNameTokens[0] === nameTokens[0]
      if (!key.startsWith('imagens/') || !simpleNameIsProductIdentity ||
        nameTokens.some(token => !searchable.includes(token))) return null
      const brand = text(row.brand)
      const weight = text(row.weight)
      if (requestedBrand && normalizeProductText(brand) !== requestedBrand) return null
      if (requestedVariant && normalizeProductText(variant) !== requestedVariant && !searchable.includes(requestedVariant)) return null
      if (requestedWeight && normalizeWeight(weight) !== requestedWeight && !normalizeWeight(searchable).includes(requestedWeight)) return null
      const exactName = normalizeProductText(name) === requestedName ? 1 : 0
      const exactVariant = requestedVariant && normalizeProductText(variant) === requestedVariant ? 1 : 0
      const exactWeight = requestedWeight && normalizeWeight(weight) === requestedWeight ? 1 : 0
      return {
        candidate: {
          id: String(row.id), name, brand, variant, weight, key,
          previewUrl: getPublicUrl(key)
        },
        score: exactName * 100 + Number(Boolean(exactVariant)) * 10 + Number(Boolean(exactWeight)) * 5,
        popularity: Number(row.usage_count || 0)
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => right.score - left.score || right.popularity - left.popularity)
    .slice(0, 3)
    .map(value => value.candidate)
}
