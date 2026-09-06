import type {
  ProductCardConfiguration,
  ProductCardConfigurationProfile,
  ProductCardConfigurationProfileKey,
  ProductCardElementKey,
  ProductCardElementLayout
} from '~/types/product-zone'

const ELEMENT_KEYS: ProductCardElementKey[] = ['name', 'image', 'price', 'alcoholBadge', 'limit']

export const PRODUCT_ALCOHOL_BADGE_ASSET_URL = '/assets/alcohol-under-18-badge.png'

export const PRODUCT_CARD_CONFIGURATION_PROFILE_KEYS: ProductCardConfigurationProfileKey[] = [
  'compact',
  'standard',
  'wide',
  'featured'
]

const DEFAULT_ELEMENTS: Record<ProductCardElementKey, ProductCardElementLayout> = {
  name: { visible: true, x: 50, y: 11, width: 84, height: 16, rotation: 0 },
  image: { visible: true, x: 50, y: 50, width: 84, height: 48, rotation: 0 },
  price: { visible: true, x: 50, y: 84, width: 64, height: 26, rotation: 0 },
  alcoholBadge: { visible: true, x: 88, y: 9, width: 18, height: 14, rotation: 0 },
  limit: { visible: true, x: 50, y: 25, width: 78, height: 12, rotation: 0 }
}

const PROFILE_OVERRIDES: Record<
  ProductCardConfigurationProfileKey,
  Partial<Record<ProductCardElementKey, Partial<ProductCardElementLayout>>>
> = {
  compact: {
    name: { y: 13, width: 92, height: 14 },
    image: { y: 51, width: 80, height: 46 },
    price: { y: 84, width: 82, height: 24 },
    alcoholBadge: { x: 86, y: 10, width: 20, height: 18 },
    limit: { y: 27, width: 88, height: 11 }
  },
  standard: {},
  wide: {
    name: { y: 12, width: 88, height: 15 },
    image: { y: 51, width: 86, height: 52 },
    price: { y: 84, width: 58, height: 24 },
    alcoholBadge: { x: 88, y: 10, width: 16, height: 15 },
    limit: { y: 27, width: 66, height: 11 }
  },
  featured: {
    name: { y: 10, width: 82, height: 14 },
    image: { y: 48, width: 72, height: 54 },
    price: { y: 84, width: 54, height: 24 },
    alcoholBadge: { x: 87, y: 9, width: 14, height: 13 },
    limit: { y: 25, width: 58, height: 10 }
  }
}

// O preview de configuracao usa um card de referencia de aproximadamente
// 420 x 525 px. A etiqueta deve acompanhar cards com area maior, sem fazer os
// modelos compactos crescerem nem ultrapassar o card quando a receita ja usa
// 100% da largura/altura disponivel.
const PRICE_REFERENCE_CARD_AREA = 420 * 525
const MAX_ADAPTIVE_PRICE_SCALE = 1.4

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toFinite = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const cloneElement = (element: ProductCardElementLayout): ProductCardElementLayout => ({ ...element })

const buildElements = (
  overrides: Partial<Record<ProductCardElementKey, Partial<ProductCardElementLayout>>> = {}
) => Object.fromEntries(
  ELEMENT_KEYS.map((key) => [
    key,
    { ...cloneElement(DEFAULT_ELEMENTS[key]), ...(overrides[key] || {}) }
  ])
) as Record<ProductCardElementKey, ProductCardElementLayout>

const cloneElements = (elements: Record<ProductCardElementKey, ProductCardElementLayout>) =>
  Object.fromEntries(ELEMENT_KEYS.map((key) => [key, cloneElement(elements[key])])) as Record<
    ProductCardElementKey,
    ProductCardElementLayout
  >

export const createDefaultProductCardConfiguration = (): ProductCardConfiguration => ({
  version: 1,
  enabled: true,
  alcoholBadgeEnabled: true,
  alcoholBadgeText: '+18',
  elements: buildElements(),
  profiles: Object.fromEntries(
    PRODUCT_CARD_CONFIGURATION_PROFILE_KEYS.map((key) => [
      key,
      { elements: buildElements(PROFILE_OVERRIDES[key]) }
    ])
  ) as Record<ProductCardConfigurationProfileKey, ProductCardConfigurationProfile>
})

export const normalizeProductCardElementLayout = (
  input: Partial<ProductCardElementLayout> | null | undefined,
  fallback: ProductCardElementLayout
): ProductCardElementLayout => ({
  visible: input?.visible !== false,
  x: clamp(toFinite(input?.x, fallback.x), 0, 100),
  y: clamp(toFinite(input?.y, fallback.y), 0, 100),
  width: clamp(toFinite(input?.width, fallback.width), 5, 100),
  height: clamp(toFinite(input?.height, fallback.height), 5, 100),
  // Mantem compatibilidade com configuracoes antigas sem rotacao e evita
  // valores extremos que tornam o handle dificil de usar no preview.
  rotation: clamp(toFinite(input?.rotation, fallback.rotation), -360, 360)
})

export const normalizeProductCardConfiguration = (
  input: Partial<ProductCardConfiguration> | null | undefined
): ProductCardConfiguration => {
  const defaults = createDefaultProductCardConfiguration()
  const source = input && typeof input === 'object' ? input : {}
  const sourceElements = source.elements && typeof source.elements === 'object'
    ? source.elements as Partial<Record<ProductCardElementKey, Partial<ProductCardElementLayout>>>
    : {}

  const normalizedElements = Object.fromEntries(
    ELEMENT_KEYS.map((key) => [
      key,
      normalizeProductCardElementLayout(sourceElements[key], defaults.elements[key])
    ])
  ) as Record<ProductCardElementKey, ProductCardElementLayout>
  const sourceProfiles = source.profiles && typeof source.profiles === 'object'
    ? source.profiles as Partial<Record<ProductCardConfigurationProfileKey, Partial<ProductCardConfigurationProfile>>>
    : {}
  const profiles = Object.fromEntries(
    PRODUCT_CARD_CONFIGURATION_PROFILE_KEYS.map((profileKey) => {
      const sourceProfile = sourceProfiles[profileKey]
      const sourceProfileElements = sourceProfile?.elements && typeof sourceProfile.elements === 'object'
        ? sourceProfile.elements as Partial<Record<ProductCardElementKey, Partial<ProductCardElementLayout>>>
        : profileKey === 'standard' && !source.profiles
          ? sourceElements
          : {}
      const fallbackElements = defaults.profiles?.[profileKey]?.elements || defaults.elements
      return [
        profileKey,
        {
          elements: Object.fromEntries(
            ELEMENT_KEYS.map((key) => [
              key,
              normalizeProductCardElementLayout(sourceProfileElements[key], fallbackElements[key])
            ])
          ) as Record<ProductCardElementKey, ProductCardElementLayout>
        }
      ]
    })
  ) as Record<ProductCardConfigurationProfileKey, ProductCardConfigurationProfile>

  return {
    version: 1,
    enabled: source.enabled !== false,
    alcoholBadgeEnabled: source.alcoholBadgeEnabled !== false,
    alcoholBadgeText: String(source.alcoholBadgeText ?? defaults.alcoholBadgeText).trim().slice(0, 12) || '+18',
    elements: normalizedElements,
    profiles
  }
}

export const resolveProductCardConfigurationProfileKey = (
  cardWidth: number,
  cardHeight: number,
  context: { role?: string; isHighlighted?: boolean } = {}
): ProductCardConfigurationProfileKey => {
  const width = Math.abs(Number(cardWidth))
  const height = Math.abs(Number(cardHeight))
  const shortSide = Math.min(width, height)
  const longSide = Math.max(width, height)
  // "Largo" representa o card horizontal (como na prévia de configurações),
  // não qualquer card alongado. Usar longSide/shortSide fazia um card
  // vertical de 479x757 ser identificado como largo e aplicava a composição
  // lateral, empurrando a imagem e a etiqueta para fora do próprio card.
  const isLandscape = width > height
  const landscapeRatio = height > 0 ? width / height : 0
  const role = String(context.role || '').toLowerCase()

  if (context.isHighlighted || role === 'showcase' || role === 'hero') return 'featured'
  if (shortSide > 0 && (shortSide <= 170 || longSide <= 220)) return 'compact'
  if (isLandscape && landscapeRatio >= 1.45) return 'wide'
  if (shortSide >= 420 || longSide >= 700) return 'featured'
  return 'standard'
}

/**
 * Escala responsiva da etiqueta de preco para cards que possuem mais area.
 * A receita do perfil continua sendo a fonte de verdade; este fator apenas
 * evita que a mesma etiqueta pareca pequena em um card de destaque maior.
 */
export const resolveProductCardPriceScale = (cardWidth: number, cardHeight: number): number => {
  const width = Math.abs(Number(cardWidth))
  const height = Math.abs(Number(cardHeight))
  if (!(width > 0) || !(height > 0)) return 1

  const areaScale = Math.sqrt((width * height) / PRICE_REFERENCE_CARD_AREA)
  if (!Number.isFinite(areaScale)) return 1
  return clamp(areaScale, 1, MAX_ADAPTIVE_PRICE_SCALE)
}

export const resolveProductCardConfigurationProfile = (
  configuration: Partial<ProductCardConfiguration> | null | undefined,
  cardWidth: number,
  cardHeight: number,
  context: { role?: string; isHighlighted?: boolean } = {}
): ProductCardConfigurationProfile => {
  const normalized = normalizeProductCardConfiguration(configuration)
  const key = resolveProductCardConfigurationProfileKey(cardWidth, cardHeight, context)
  return normalized.profiles?.[key] || { elements: cloneElements(normalized.elements) }
}

export const getProductCardElementLayout = (
  configuration: Partial<ProductCardConfiguration> | null | undefined,
  key: ProductCardElementKey
): ProductCardElementLayout => {
  const normalized = normalizeProductCardConfiguration(configuration)
  return normalized.elements[key]
}

export const setProductCardElementLayout = (
  configuration: Partial<ProductCardConfiguration> | null | undefined,
  key: ProductCardElementKey,
  patch: Partial<ProductCardElementLayout>
): ProductCardConfiguration => {
  const normalized = normalizeProductCardConfiguration(configuration)
  normalized.elements[key] = normalizeProductCardElementLayout(
    { ...normalized.elements[key], ...patch },
    normalized.elements[key]
  )
  return normalized
}

const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const explicitAlcoholFlags = ['isAlcoholic', 'alcoholic', 'containsAlcohol', 'hasAlcohol', 'is_alcoholic']

/**
 * Resolve o selo +18 sem depender de um unico formato de importacao.
 * Flags booleanas explicitas vencem; depois usamos os campos comerciais mais
 * comuns como fallback. "Sem alcool" sempre bloqueia o selo heuristico.
 */
export const isAlcoholicProduct = (product: any): boolean => {
  if (!product || typeof product !== 'object') return false

  for (const key of explicitAlcoholFlags) {
    if (typeof product[key] === 'boolean') return product[key]
  }

  const candidateValues = [
    product.name,
    product.category,
    product.categoryName,
    product.department,
    product.departmentName,
    product.segment,
    product.segmentName,
    product.group,
    product.groupName,
    product.section,
    product.raw?.category,
    product.raw?.department,
    product.raw?.segment
  ]
  const searchText = normalizeSearchText(candidateValues.filter(Boolean).join(' '))
  if (!searchText || /sem\s+alcool|nao\s+alcool|zero\s+alcool|0\s*alcool/.test(searchText)) return false

  return /bebida\s+alcool|cerveja|chopp|vinho|espumante|sidra|vodka|whisky|uisque|cachaca|rum|gin|tequila|licor|destilado|sake/.test(searchText)
}

export const PRODUCT_CARD_ELEMENT_KEYS = ELEMENT_KEYS as ReadonlyArray<ProductCardElementKey>
