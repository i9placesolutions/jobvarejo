import type {
  ProductZone,
  ProductZonePreviewFormat,
  ProductZoneStructure,
  ProductZoneStructureFormat,
  ProductZoneStructureMap,
  ProductZoneStructureMapByPreviewFormat,
  ProductZoneStructureVariant,
  ProductZoneStructureVariantMap,
  ProductZoneStructureVariantMapByPreviewFormat
} from '~/types/product-zone'

export const PRODUCT_ZONE_STRUCTURE_COUNTS = Array.from({ length: 24 }, (_, index) => index + 1)

export const PRODUCT_ZONE_PREVIEW_FORMATS: ReadonlyArray<{
  value: ProductZonePreviewFormat
  label: string
  ratio: number
}> = [
  { value: 'story', label: 'Story', ratio: 1080 / 1920 },
  { value: 'feed', label: 'Feed', ratio: 1080 / 1350 },
  { value: 'post', label: 'Post', ratio: 1 },
  { value: 'banner', label: 'Banner', ratio: 1920 / 1080 },
  { value: 'a4', label: 'A4', ratio: 2480 / 3508 }
]

export const PRODUCT_ZONE_PREVIEW_FORMAT_VALUES = PRODUCT_ZONE_PREVIEW_FORMATS.map((item) => item.value)
export const DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT: ProductZonePreviewFormat = 'feed'

// A linha/coluna incompleta sempre usa o espaco disponivel. Valores antigos
// como "center" continuam sendo aceitos na leitura, mas sao normalizados para
// o comportamento atual para que nenhuma receita reabra buracos no encarte.
export const PRODUCT_ZONE_FULL_FILL_BEHAVIOR = 'fill' as const

export const PRODUCT_ZONE_STRUCTURE_FORMATS: ReadonlyArray<{
  value: ProductZoneStructureFormat
  label: string
  hint: string
}> = [
  { value: 'auto', label: 'Automático', hint: 'O motor decide a grade.' },
  { value: 'hero', label: 'Destaque', hint: 'Cards maiores para chamar atenção.' },
  { value: 'grid', label: 'Grade', hint: 'Distribuição regular.' },
  { value: 'horizontal', label: 'Lado a lado', hint: 'Fluxo em linhas.' },
  { value: 'vertical', label: 'Coluna', hint: 'Fluxo de cima para baixo.' },
  { value: 'showcase', label: 'Vitrine', hint: 'Área de destaque maior + grade de apoio.' }
]

const VALID_FORMATS = new Set<ProductZoneStructureFormat>(PRODUCT_ZONE_STRUCTURE_FORMATS.map((item) => item.value))
const VALID_ROLES = new Set<NonNullable<ProductZone['role']>>(['grid', 'hero', 'sidebar', 'showcase'])
const VALID_DIRECTIONS = new Set<NonNullable<ProductZone['layoutDirection']>>(['horizontal', 'vertical'])
const VALID_ASPECTS = new Set<NonNullable<ProductZone['cardAspectRatio']>>([
  'auto',
  'square',
  '3:4',
  '4:5',
  '4:3',
  '16:9',
  '9:16',
  'fill'
])
const VALID_LAST_ROW_BEHAVIORS = new Set<NonNullable<ProductZone['lastRowBehavior']>>([
  'fill',
  'center',
  'stretch',
  'left'
])
const VALID_VERTICAL_ALIGNS = new Set<NonNullable<ProductZone['verticalAlign']>>([
  'top',
  'center',
  'bottom',
  'stretch'
])
const VALID_HIGHLIGHT_POSITIONS = new Set<NonNullable<ProductZone['highlightPos']>>([
  'first',
  'last',
  'random',
  'center',
  'top',
  'bottom'
])
const VALID_HIGHLIGHT_SELECTIONS = new Set<NonNullable<ProductZone['highlightSelection']>>([
  'first',
  'last',
  'random',
  'center',
  'manual'
])

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const integer = (value: unknown, fallback: number, min: number, max: number) =>
  clamp(Math.round(finite(value, fallback)), min, max)

const normalizeHighlightIndexes = (value: unknown, count: number, fallback: number[]) => {
  const source = Array.isArray(value) ? value : fallback
  const unique = new Set<number>()
  for (const item of source) {
    const index = Math.round(finite(item, 0))
    if (index >= 1 && index <= count) unique.add(index)
  }
  return Array.from(unique).sort((a, b) => a - b)
}

const createDefaultCardAspectRatios = (
  count: number,
  fallback: NonNullable<ProductZone['cardAspectRatio']>
) => Object.fromEntries(
  Array.from({ length: count }, (_, index) => [String(index + 1), fallback])
) as Record<string, NonNullable<ProductZone['cardAspectRatio']>>

const normalizeCardAspectRatios = (
  value: unknown,
  count: number,
  fallback: NonNullable<ProductZone['cardAspectRatio']>
) => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const key = String(index + 1)
      const candidate = source[key]
      const ratio = VALID_ASPECTS.has(candidate as NonNullable<ProductZone['cardAspectRatio']>)
        ? candidate as NonNullable<ProductZone['cardAspectRatio']>
        : fallback
      return [key, ratio]
    })
  ) as Record<string, NonNullable<ProductZone['cardAspectRatio']>>
}

export const normalizeProductZoneStructureCount = (value: unknown, fallback = 1) =>
  integer(value, fallback, 1, 24)

const getDefaultColumns = (count: number) => {
  if (count <= 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  if (count === 4) return 2
  if (count <= 8) return 3
  if (count <= 12) return 4
  if (count <= 16) return 4
  if (count <= 20) return 5
  return 6
}

const getDefaultFormat = (count: number): ProductZoneStructureFormat => {
  if (count === 1) return 'hero'
  if (count === 2) return 'horizontal'
  return 'grid'
}

const getDefaultRole = (format: ProductZoneStructureFormat, baseZone?: Partial<ProductZone>): NonNullable<ProductZone['role']> => {
  if (format === 'hero') return 'hero'
  if (format === 'showcase') return 'showcase'
  if (format === 'auto') return baseZone?.role && VALID_ROLES.has(baseZone.role) ? baseZone.role : 'grid'
  return 'grid'
}

export const createDefaultProductZoneStructure = (
  countInput: number,
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructure => {
  const count = normalizeProductZoneStructureCount(countInput)
  const format = getDefaultFormat(count)
  const columns = getDefaultColumns(count)
  const rows = Math.max(1, Math.ceil(count / columns))
  const fallbackPadding = Math.max(0, Math.round(finite(baseZone.padding, 15)))
  const fallbackGapH = Math.max(0, Math.round(finite(baseZone.gapHorizontal, fallbackPadding)))
  const fallbackGapV = Math.max(0, Math.round(finite(baseZone.gapVertical, fallbackPadding)))

  return {
    count,
    format,
    role: getDefaultRole(format, baseZone),
    columns,
    rows,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: PRODUCT_ZONE_FULL_FILL_BEHAVIOR,
    verticalAlign: 'stretch',
    padding: fallbackPadding,
    gapHorizontal: fallbackGapH,
    gapVertical: fallbackGapV,
    highlightPadding: fallbackPadding,
    highlightGapHorizontal: fallbackGapH,
    highlightGapVertical: fallbackGapV,
    cardAspectRatios: createDefaultCardAspectRatios(count, 'fill'),
    highlightCount: 0,
    highlightPos: 'first',
    highlightSelection: 'first',
    highlightIndexes: [1],
    highlightHeight: 1.5
  }
}

export const normalizeProductZoneStructure = (
  input: Partial<ProductZoneStructure> | null | undefined,
  countInput: number,
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructure => {
  const count = normalizeProductZoneStructureCount(countInput)
  const defaults = createDefaultProductZoneStructure(count, baseZone)
  const source = input && typeof input === 'object' ? input : {}
  const format = VALID_FORMATS.has(source.format as ProductZoneStructureFormat)
    ? source.format as ProductZoneStructureFormat
    : defaults.format
  const role = VALID_ROLES.has(source.role as NonNullable<ProductZone['role']>)
    ? source.role as NonNullable<ProductZone['role']>
    : defaults.role
  const layoutDirection = VALID_DIRECTIONS.has(source.layoutDirection as NonNullable<ProductZone['layoutDirection']>)
    ? source.layoutDirection as NonNullable<ProductZone['layoutDirection']>
    : defaults.layoutDirection
  const cardAspectRatio = VALID_ASPECTS.has(source.cardAspectRatio as NonNullable<ProductZone['cardAspectRatio']>)
    ? source.cardAspectRatio as NonNullable<ProductZone['cardAspectRatio']>
    : defaults.cardAspectRatio
  const hasLegacyLastRowBehavior = VALID_LAST_ROW_BEHAVIORS.has(
    source.lastRowBehavior as NonNullable<ProductZone['lastRowBehavior']>
  )
  // The structure editor now guarantees full occupancy. Keep accepting the
  // legacy value for backwards-compatible parsing, but never persist it back.
  const lastRowBehavior = hasLegacyLastRowBehavior
    ? PRODUCT_ZONE_FULL_FILL_BEHAVIOR
    : defaults.lastRowBehavior
  const verticalAlign = VALID_VERTICAL_ALIGNS.has(source.verticalAlign as NonNullable<ProductZone['verticalAlign']>)
    ? source.verticalAlign as NonNullable<ProductZone['verticalAlign']>
    : defaults.verticalAlign
  const highlightPos = VALID_HIGHLIGHT_POSITIONS.has(source.highlightPos as NonNullable<ProductZone['highlightPos']>)
    ? source.highlightPos as NonNullable<ProductZone['highlightPos']>
    : defaults.highlightPos
  const highlightSelection = VALID_HIGHLIGHT_SELECTIONS.has(source.highlightSelection as NonNullable<ProductZone['highlightSelection']>)
    ? source.highlightSelection as NonNullable<ProductZone['highlightSelection']>
    : defaults.highlightSelection
  const highlightIndexes = normalizeHighlightIndexes(
    source.highlightIndexes,
    count,
    defaults.highlightIndexes
  )
  const cardAspectRatios = normalizeCardAspectRatios(
    source.cardAspectRatios,
    count,
    cardAspectRatio
  )
  const padding = integer(source.padding, defaults.padding, 0, 200)
  const gapHorizontal = integer(source.gapHorizontal, defaults.gapHorizontal, 0, 200)
  const gapVertical = integer(source.gapVertical, defaults.gapVertical, 0, 200)

  return {
    count,
    format,
    role,
    columns: integer(source.columns, defaults.columns, 0, 24),
    rows: integer(source.rows, defaults.rows, 0, 24),
    layoutDirection,
    cardAspectRatio,
    lastRowBehavior,
    verticalAlign,
    padding,
    gapHorizontal,
    gapVertical,
    highlightPadding: integer(source.highlightPadding, padding, 0, 200),
    highlightGapHorizontal: integer(source.highlightGapHorizontal, gapHorizontal, 0, 200),
    highlightGapVertical: integer(source.highlightGapVertical, gapVertical, 0, 200),
    cardAspectRatios,
    highlightCount: integer(source.highlightCount, defaults.highlightCount, 0, count),
    highlightPos,
    highlightSelection,
    highlightIndexes,
    highlightHeight: clamp(finite(source.highlightHeight, defaults.highlightHeight), 1, 3)
  }
}

export const createDefaultProductZoneStructureMap = (
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructureMap => {
  return Object.fromEntries(
    PRODUCT_ZONE_STRUCTURE_COUNTS.map((count) => [
      String(count),
      createDefaultProductZoneStructure(count, baseZone)
    ])
  ) as ProductZoneStructureMap
}

export const normalizeProductZoneStructureMap = (
  input: unknown,
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructureMap => {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return Object.fromEntries(
    PRODUCT_ZONE_STRUCTURE_COUNTS.map((count) => [
      String(count),
      normalizeProductZoneStructure(source[String(count)] as Partial<ProductZoneStructure>, count, baseZone)
    ])
  ) as ProductZoneStructureMap
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasPreviewFormatKeys = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false
  return PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.some((format) =>
    Object.prototype.hasOwnProperty.call(value, format)
  )
}

/**
 * Cria uma biblioteca independente para cada formato de arte. Os mapas sao
 * intencionalmente novos em cada chave: editar o Feed nunca deve mutar o
 * Story por compartilhamento acidental de referencias.
 */
export const createDefaultProductZoneStructureMapByPreviewFormat = (
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructureMapByPreviewFormat => Object.fromEntries(
  PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.map((format) => [
    format,
    createDefaultProductZoneStructureMap(baseZone)
  ])
) as ProductZoneStructureMapByPreviewFormat

/**
 * Le a biblioteca nova e tambem migra o mapa legado (plano) sem descartar a
 * receita existente. Formatos ausentes recebem uma copia da receita legada;
 * depois que um formato for salvo, ele passa a ser independente.
 */
export const normalizeProductZoneStructureMapByPreviewFormat = (
  input: unknown,
  baseZone: Partial<ProductZone> = {},
  fallbackInput?: unknown
): ProductZoneStructureMapByPreviewFormat => {
  const source = hasPreviewFormatKeys(input) ? input : null
  const fallbackSource = hasPreviewFormatKeys(fallbackInput) ? fallbackInput : null
  const legacyInput = source ? undefined : input
  const legacyFallback = fallbackSource ? undefined : fallbackInput
  const legacyMap = legacyInput ?? legacyFallback

  return Object.fromEntries(
    PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.map((format) => {
      const explicit = source?.[format]
      const fallbackForFormat = fallbackSource?.[format]
      const candidate = isRecord(explicit)
        ? explicit
        : isRecord(fallbackForFormat)
          ? fallbackForFormat
          : legacyMap
      return [format, normalizeProductZoneStructureMap(candidate, baseZone)]
    })
  ) as ProductZoneStructureMapByPreviewFormat
}

const getVariantId = (value: unknown, count: number, index: number, used: Set<string>) => {
  const base = String(value ?? '').trim() || `count-${count}-variant-${index + 1}`
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

const getVariantName = (value: unknown, index: number) => {
  const name = String(value ?? '').trim()
  return name || (index === 0 ? 'Padrão' : `Variação ${index + 1}`)
}

export const createDefaultProductZoneStructureVariantMap = (
  baseZone: Partial<ProductZone> = {},
  structureMap: ProductZoneStructureMap = createDefaultProductZoneStructureMap(baseZone)
): ProductZoneStructureVariantMap => Object.fromEntries(
  PRODUCT_ZONE_STRUCTURE_COUNTS.map((count) => {
    const structure = normalizeProductZoneStructure(structureMap[String(count)], count, baseZone)
    return [String(count), [{
      ...structure,
      id: `count-${count}-default`,
      name: 'Padrão'
    } satisfies ProductZoneStructureVariant]]
  })
) as ProductZoneStructureVariantMap

/**
 * Normaliza a biblioteca de variacoes sem quebrar contas que ainda so salvam
 * o mapa principal. O formato aceito e uma lista por quantidade, mas tambem
 * le um objeto unico para facilitar a migracao de dados intermediarios.
 */
export const normalizeProductZoneStructureVariantMap = (
  input: unknown,
  baseZone: Partial<ProductZone> = {},
  fallbackMap: ProductZoneStructureMap = createDefaultProductZoneStructureMap(baseZone)
): ProductZoneStructureVariantMap => {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}

  return Object.fromEntries(
    PRODUCT_ZONE_STRUCTURE_COUNTS.map((count) => {
      const key = String(count)
      const rawValue = source[key]
      const rawEntries = Array.isArray(rawValue)
        ? rawValue
        : rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).variants)
          ? (rawValue as any).variants
          : rawValue && typeof rawValue === 'object'
            ? [rawValue]
            : []
      const entries = rawEntries.length > 0
        ? rawEntries
        : [{
            ...(fallbackMap[key] || createDefaultProductZoneStructure(count, baseZone)),
            id: `count-${count}-default`,
            name: 'Padrão'
          }]
      const usedIds = new Set<string>()
      const variants = entries.map((entry: any, index: number) => {
        const structureSource = entry?.structure && typeof entry.structure === 'object'
          ? entry.structure
          : entry
        const structure = normalizeProductZoneStructure(structureSource, count, baseZone)
        return {
          ...structure,
          id: getVariantId(entry?.id, count, index, usedIds),
          name: getVariantName(entry?.name, index)
        } satisfies ProductZoneStructureVariant
      })
      return [key, variants]
    })
  ) as ProductZoneStructureVariantMap
}

export const createDefaultProductZoneStructureVariantMapByPreviewFormat = (
  baseZone: Partial<ProductZone> = {},
  structureMaps: ProductZoneStructureMapByPreviewFormat = createDefaultProductZoneStructureMapByPreviewFormat(baseZone)
): ProductZoneStructureVariantMapByPreviewFormat => Object.fromEntries(
  PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.map((format) => [
    format,
    createDefaultProductZoneStructureVariantMap(baseZone, structureMaps[format])
  ])
) as ProductZoneStructureVariantMapByPreviewFormat

/**
 * Normaliza variacoes por formato, aceitando tanto o envelope novo quanto a
 * lista legada plana. O quarto argumento e usado pela API para migrar uma
 * biblioteca de variacoes antiga quando o envelope ainda nao existe.
 */
export const normalizeProductZoneStructureVariantMapByPreviewFormat = (
  input: unknown,
  baseZone: Partial<ProductZone> = {},
  structureMapsInput?: unknown,
  fallbackInput?: unknown
): ProductZoneStructureVariantMapByPreviewFormat => {
  const structureMaps = hasPreviewFormatKeys(structureMapsInput)
    ? normalizeProductZoneStructureMapByPreviewFormat(structureMapsInput, baseZone)
    : normalizeProductZoneStructureMapByPreviewFormat(undefined, baseZone, structureMapsInput)
  const source = hasPreviewFormatKeys(input) ? input : null
  const fallbackSource = hasPreviewFormatKeys(fallbackInput) ? fallbackInput : null
  const legacyInput = source ? undefined : input
  const legacyFallback = fallbackSource ? undefined : fallbackInput

  return Object.fromEntries(
    PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.map((format) => {
      const explicit = source?.[format]
      const fallbackForFormat = fallbackSource?.[format]
      const candidate = isRecord(explicit)
        ? explicit
        : isRecord(fallbackForFormat)
          ? fallbackForFormat
          : legacyInput ?? legacyFallback
      return [
        format,
        normalizeProductZoneStructureVariantMap(candidate, baseZone, structureMaps[format])
      ]
    })
  ) as ProductZoneStructureVariantMapByPreviewFormat
}

export const applyProductZoneStructureFormat = (
  input: Partial<ProductZoneStructure> | null | undefined,
  countInput: number,
  format: ProductZoneStructureFormat,
  baseZone: Partial<ProductZone> = {}
): ProductZoneStructure => {
  const count = normalizeProductZoneStructureCount(countInput)
  const current = normalizeProductZoneStructure(input, count, baseZone)
  const next: Partial<ProductZoneStructure> = { ...current, format }

  if (format === 'auto') {
    next.role = getDefaultRole(format, baseZone)
    next.columns = 0
    next.rows = 0
    next.layoutDirection = 'horizontal'
    next.highlightCount = 0
  } else if (format === 'hero') {
    next.role = 'hero'
    next.columns = Math.max(1, count)
    next.rows = 1
    next.layoutDirection = 'horizontal'
    next.highlightCount = 0
  } else if (format === 'horizontal') {
    next.role = 'grid'
    next.columns = Math.max(1, count)
    next.rows = 1
    next.layoutDirection = 'horizontal'
    next.highlightCount = 0
  } else if (format === 'vertical') {
    next.role = 'grid'
    next.columns = 1
    next.rows = Math.max(1, count)
    next.layoutDirection = 'vertical'
    next.highlightCount = 0
  } else if (format === 'showcase') {
    next.role = 'showcase'
    next.layoutDirection = 'horizontal'
    next.highlightCount = Math.min(Math.max(1, current.highlightCount), count)
  } else {
    next.role = 'grid'
    next.layoutDirection = 'horizontal'
    next.highlightCount = 0
  }

  return normalizeProductZoneStructure(next, count, baseZone)
}

export const resolveProductZoneStructure = (
  zone: Partial<ProductZone> | null | undefined,
  productCount: number,
  previewFormat: ProductZonePreviewFormat = DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT
): ProductZoneStructure | null => {
  if (!zone) return null
  const count = normalizeProductZoneStructureCount(productCount, 1)
  const key = String(count)
  const formatVariants = zone.structureVariantsByProductCountByPreviewFormat?.[previewFormat]?.[key]
  const variants = Array.isArray(formatVariants)
    ? formatVariants
    : zone.structureVariantsByProductCount?.[key]
  if (Array.isArray(variants) && variants.length > 0) {
    const selectedId = String(
      zone.structureVariantByProductCountByPreviewFormat?.[previewFormat]?.[key]
        ?? zone.structureVariantByProductCount?.[key]
        ?? ''
    ).trim()
    const selected = variants.find((variant) => String(variant?.id ?? '').trim() === selectedId)
      || variants[0]
    if (selected && typeof selected === 'object') {
      return normalizeProductZoneStructure(selected, count, zone)
    }
  }
  const formatMap = zone.structureByProductCountByPreviewFormat?.[previewFormat]
  const map = formatMap && typeof formatMap === 'object'
    ? formatMap
    : zone.structureByProductCount
  if (!map || typeof map !== 'object') return null
  const entry = map[key]
  if (!entry || typeof entry !== 'object') return null
  return normalizeProductZoneStructure(entry, count, zone)
}

/**
 * Resolve o formato de receita usado por uma pagina do editor a partir do
 * tamanho real da arte. A comparacao por proporcao tambem cobre dimensoes
 * personalizadas sem exigir que a pagina tenha exatamente o preset original.
 */
export const getProductZonePreviewFormatForDimensions = (
  width: unknown,
  height: unknown
): ProductZonePreviewFormat => {
  const parsedWidth = Number(width)
  const parsedHeight = Number(height)
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight) || parsedWidth <= 0 || parsedHeight <= 0) {
    return DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT
  }

  const ratio = parsedWidth / parsedHeight
  return PRODUCT_ZONE_PREVIEW_FORMATS.reduce<ProductZonePreviewFormat>((closest, candidate) => {
    const currentDistance = Math.abs(Math.log(ratio / candidate.ratio))
    const closestRatio = PRODUCT_ZONE_PREVIEW_FORMATS.find((item) => item.value === closest)?.ratio
      || PRODUCT_ZONE_PREVIEW_FORMATS.find((item) => item.value === DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT)?.ratio
      || 1
    const closestDistance = Math.abs(Math.log(ratio / closestRatio))
    return currentDistance < closestDistance ? candidate.value : closest
  }, DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT)
}

export const getProductZoneStructureFormatLabel = (format: unknown): string => {
  return PRODUCT_ZONE_STRUCTURE_FORMATS.find((item) => item.value === format)?.label ?? 'Automático'
}
