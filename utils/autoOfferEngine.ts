import type { Product, ProductZone } from '~/types/product-zone'
import { DEFAULT_PRODUCT_ZONE } from '~/types/product-zone'
import {
  calculateGridLayout,
  calculateProductPosition,
  migrateProduct,
  parsePrice
} from '~/utils/product-zone-helpers'
import { resolveProductImageRef } from '~/utils/productImageRef'

export type AutoOfferDensity = 'compact' | 'balanced' | 'premium'
export type AutoOfferStrategy = 'single-zone' | 'review-overflow' | 'paginate'
export type AutoOfferPriority = 'primary' | 'advanced'

export type AutoOfferProductDecision = {
  id: string
  inputIndex: number
  score: number
  priority: AutoOfferPriority
  reasons: string[]
}

export type AutoOfferZoneLayout = {
  cols: number
  rows: number
  itemWidth: number
  itemHeight: number
  capacity: number
}

export type AutoOfferZonePlan = {
  zone: ProductZone
  products: Product[]
  decisions: AutoOfferProductDecision[]
  layout: AutoOfferZoneLayout
  overflowCount: number
  warnings: string[]
}

export type AutoOfferLayoutPlan = {
  strategy: AutoOfferStrategy
  density: AutoOfferDensity
  totalProducts: number
  zones: AutoOfferZonePlan[]
  warnings: string[]
}

export type AutoOfferPlanOptions = {
  zone?: Partial<ProductZone> | null
  density?: AutoOfferDensity
  sourceMode?: ProductZone['contentSource']
  overflowPolicy?: ProductZone['overflowPolicy']
  promoteHighlights?: boolean
  maxProductsPerZone?: number
}

const DENSITY_PRESETS: Record<AutoOfferDensity, {
  minCardWidth: number
  minCardHeight: number
  paddingRatio: number
  gapRatio: number
  maxColumns: number
  highlightHeight: number
}> = {
  compact: {
    minCardWidth: 92,
    minCardHeight: 124,
    paddingRatio: 0.025,
    gapRatio: 0.014,
    maxColumns: 6,
    highlightHeight: 1.25
  },
  balanced: {
    minCardWidth: 116,
    minCardHeight: 154,
    paddingRatio: 0.032,
    gapRatio: 0.018,
    maxColumns: 5,
    highlightHeight: 1.5
  },
  premium: {
    minCardWidth: 150,
    minCardHeight: 198,
    paddingRatio: 0.04,
    gapRatio: 0.022,
    maxColumns: 4,
    highlightHeight: 1.75
  }
}

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const hasText = (value: unknown): boolean => String(value || '').trim().length > 0

const hasPositivePrice = (value: unknown): boolean => parsePrice(value as string | number | null | undefined) > 0

export const resolveAutoOfferImageRef = (product: Partial<Product> | any): string | null => {
  return resolveProductImageRef(product)
}

export const normalizeAutoOfferProducts = (products: ReadonlyArray<Partial<Product> | any>): Product[] => {
  if (!Array.isArray(products)) return []
  return products.map((product) => {
    const source = product || {}
    const migrated = migrateProduct(source)
    const imageRef = resolveAutoOfferImageRef(source) || resolveAutoOfferImageRef(migrated)
    const next = {
      ...source,
      ...migrated
    } as Product & Record<string, any>

    if (imageRef) {
      next.imageUrl = next.imageUrl || imageRef
      next.image = next.image || imageRef
      if (!Array.isArray(next.images) || next.images.length === 0) {
        next.images = [{ id: `img_${next.id}_0`, src: imageRef, x: 0, y: 0, scale: 1 }]
      }
    }

    return next
  })
}

export const scoreAutoOfferProduct = (
  product: Partial<Product> | any,
  inputIndex = 0
): AutoOfferProductDecision => {
  const id = String(product?.productInstanceId || product?.id || `product-${inputIndex + 1}`)
  const reasons: string[] = []
  let score = 0

  if (product?.uiPriority === 'primary') {
    score += 80
    reasons.push('priority')
  }
  if (hasPositivePrice(product?.priceSpecialUnit) || hasPositivePrice(product?.priceSpecial)) {
    score += 35
    reasons.push('special-price')
  }
  if (hasPositivePrice(product?.priceWholesale) || hasText(product?.specialCondition)) {
    score += 26
    reasons.push('wholesale')
  }
  if (hasPositivePrice(product?.pricePack) || product?.priceMode === 'pack') {
    score += 18
    reasons.push('pack')
  }
  if (hasText(product?.limitText) || hasText(product?.limit)) {
    score += 8
    reasons.push('limit')
  }

  if (resolveAutoOfferImageRef(product)) {
    score += 10
    reasons.push('image')
  }

  const nameLength = String(product?.name || '').trim().length
  if (nameLength > 0 && nameLength <= 42) {
    score += 4
  } else if (nameLength > 72) {
    score -= 6
    reasons.push('long-name')
  }

  score += Math.max(0, 6 - inputIndex) * 0.5

  return {
    id,
    inputIndex,
    score,
    priority: score >= 32 ? 'primary' : 'advanced',
    reasons
  }
}

export const estimateAutoOfferCapacity = (
  zone: Pick<ProductZone, 'width' | 'height' | 'padding'> & Partial<Pick<ProductZone, 'gapHorizontal' | 'gapVertical'>>,
  density: AutoOfferDensity
): number => {
  const preset = DENSITY_PRESETS[density]
  const padding = Math.max(0, toFiniteNumber(zone.padding, 0))
  const gapH = Math.max(0, toFiniteNumber(zone.gapHorizontal, padding))
  const gapV = Math.max(0, toFiniteNumber(zone.gapVertical, padding))
  const availableWidth = Math.max(1, toFiniteNumber(zone.width, DEFAULT_PRODUCT_ZONE.width) - padding * 2)
  const availableHeight = Math.max(1, toFiniteNumber(zone.height, DEFAULT_PRODUCT_ZONE.height) - padding * 2)
  const cols = Math.max(1, Math.floor((availableWidth + gapH) / (preset.minCardWidth + gapH)))
  const rows = Math.max(1, Math.floor((availableHeight + gapV) / (preset.minCardHeight + gapV)))
  return cols * rows
}

const getBaseZone = (zone: Partial<ProductZone> | null | undefined, density: AutoOfferDensity): ProductZone => {
  const preset = DENSITY_PRESETS[density]
  const width = Math.max(120, toFiniteNumber(zone?.width, DEFAULT_PRODUCT_ZONE.width))
  const height = Math.max(120, toFiniteNumber(zone?.height, DEFAULT_PRODUCT_ZONE.height))
  const shortSide = Math.min(width, height)
  const defaultPadding = clampNumber(Math.round(shortSide * preset.paddingRatio), 10, 36)
  const padding = Math.max(0, Math.round(toFiniteNumber(zone?.padding, defaultPadding)))
  const gap = clampNumber(Math.round(shortSide * preset.gapRatio), 8, 28)

  return {
    ...DEFAULT_PRODUCT_ZONE,
    ...(zone || {}),
    x: toFiniteNumber(zone?.x, DEFAULT_PRODUCT_ZONE.x),
    y: toFiniteNumber(zone?.y, DEFAULT_PRODUCT_ZONE.y),
    width,
    height,
    padding,
    gapHorizontal: Math.max(0, Math.round(toFiniteNumber(zone?.gapHorizontal, gap))),
    gapVertical: Math.max(0, Math.round(toFiniteNumber(zone?.gapVertical, gap))),
    layoutDirection: zone?.layoutDirection === 'vertical' ? 'vertical' : 'horizontal',
    lastRowBehavior: zone?.lastRowBehavior || 'fill',
    verticalAlign: zone?.verticalAlign || 'stretch',
    cardAspectRatio: zone?.cardAspectRatio || 'fill'
  }
}

const chooseColumnCount = (
  baseZone: ProductZone,
  productCount: number,
  density: AutoOfferDensity
): number => {
  if (productCount <= 0) return 0

  const preset = DENSITY_PRESETS[density]
  const upper = Math.max(1, Math.min(productCount, preset.maxColumns))
  let bestCols = 1
  let bestScore = -Infinity

  for (let cols = 1; cols <= upper; cols += 1) {
    const candidateZone: ProductZone = {
      ...baseZone,
      columns: cols,
      rows: 0,
      cardAspectRatio: 'fill'
    }
    const layout = calculateGridLayout(candidateZone, productCount)
    const readability = Math.min(layout.itemWidth / preset.minCardWidth, layout.itemHeight / preset.minCardHeight)
    const rows = Math.max(1, Math.ceil(productCount / cols))
    const emptySlots = rows * cols - productCount
    const area = layout.itemWidth * layout.itemHeight
    const balance = Math.abs(cols - rows) / Math.max(cols, rows)
    let score = readability * 4 + Math.log(Math.max(1, area)) * 0.25
    score -= emptySlots * 0.35
    score -= balance * 0.45
    if (readability < 1) score -= (1 - readability) * 6
    if (productCount >= 5 && cols === 1) score -= 3

    if (score > bestScore) {
      bestScore = score
      bestCols = cols
    }
  }

  return bestCols
}

const getHighlightCount = (productCount: number, decisions: AutoOfferProductDecision[], density: AutoOfferDensity): number => {
  if (productCount <= 2) return 0
  const primaryCount = decisions.filter((decision) => decision.priority === 'primary').length
  const maxByDensity = density === 'premium' ? 2 : 3
  if (primaryCount > 0) return clampNumber(primaryCount, 1, Math.min(maxByDensity, productCount - 1))
  if (productCount <= 6 && density !== 'compact') return 1
  if (productCount >= 14 && density === 'compact') return 0
  return productCount >= 8 ? 1 : 0
}

const getRoleForPlan = (productCount: number, highlightCount: number): ProductZone['role'] => {
  if (productCount <= 2) return 'hero'
  if (highlightCount > 0 && productCount <= 8) return 'showcase'
  if (highlightCount > 1) return 'sidebar'
  return 'grid'
}

const assignProductPositions = (
  products: Product[],
  zone: ProductZone,
  decisionsById: Map<string, AutoOfferProductDecision>
): Product[] => {
  const layout = calculateGridLayout(zone, products.length)
  return products.map((product, index) => {
    const position = calculateProductPosition(
      zone,
      index,
      layout.cols,
      layout.itemWidth,
      layout.itemHeight,
      products.length
    )
    const decision = decisionsById.get(String(product.id))
    return {
      ...product,
      x: position.x,
      y: position.y,
      width: layout.itemWidth,
      height: layout.itemHeight,
      colIndex: zone.layoutDirection === 'vertical'
        ? Math.floor(index / Math.max(1, layout.rows))
        : index % Math.max(1, layout.cols),
      rowIndex: zone.layoutDirection === 'vertical'
        ? index % Math.max(1, layout.rows)
        : Math.floor(index / Math.max(1, layout.cols)),
      uiPriority: decision?.priority || product.uiPriority || 'advanced'
    }
  })
}

const buildSingleZonePlan = (
  inputProducts: Product[],
  opts: Required<Pick<AutoOfferPlanOptions, 'density' | 'sourceMode' | 'overflowPolicy' | 'promoteHighlights'>> & AutoOfferPlanOptions
): AutoOfferZonePlan => {
  const baseZone = getBaseZone(opts.zone, opts.density)
  const decisions = inputProducts.map((product, index) => scoreAutoOfferProduct(product, index))
  const rankedIds = new Set(
    decisions
      .filter((decision) => decision.priority === 'primary')
      .sort((a, b) => b.score - a.score || a.inputIndex - b.inputIndex)
      .map((decision) => decision.id)
  )
  const orderedProducts = opts.promoteHighlights
    ? inputProducts.slice().sort((a, b) => {
      const aRanked = rankedIds.has(String(a.id)) ? 0 : 1
      const bRanked = rankedIds.has(String(b.id)) ? 0 : 1
      if (aRanked !== bRanked) return aRanked - bRanked
      const aDecision = decisions.find((decision) => decision.id === String(a.id))
      const bDecision = decisions.find((decision) => decision.id === String(b.id))
      return (aDecision?.inputIndex ?? 0) - (bDecision?.inputIndex ?? 0)
    })
    : inputProducts

  const columns = chooseColumnCount(baseZone, orderedProducts.length, opts.density)
  const highlightCount = getHighlightCount(orderedProducts.length, decisions, opts.density)
  const zone: ProductZone = {
    ...baseZone,
    enabled: true,
    contentSource: opts.sourceMode,
    overflowPolicy: opts.overflowPolicy,
    role: getRoleForPlan(orderedProducts.length, highlightCount),
    contentStatus: orderedProducts.length > 0 ? 'filled' : 'empty',
    columns,
    rows: 0,
    cardAspectRatio: 'fill',
    lastRowBehavior: orderedProducts.length <= 3 && opts.density === 'premium' ? 'center' : 'fill',
    verticalAlign: 'stretch',
    highlightCount,
    highlightPos: 'first',
    highlightHeight: DENSITY_PRESETS[opts.density].highlightHeight
  }
  const capacity = estimateAutoOfferCapacity(zone, opts.density)
  const overflowCount = Math.max(0, orderedProducts.length - capacity)
  const warnings: string[] = []
  if (overflowCount > 0) {
    zone.contentStatus = 'overflow'
    warnings.push(`overflow:${overflowCount}`)
  }

  const layout = calculateGridLayout(zone, orderedProducts.length)
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]))
  return {
    zone,
    products: assignProductPositions(orderedProducts, zone, decisionsById),
    decisions,
    layout: {
      ...layout,
      capacity
    },
    overflowCount,
    warnings
  }
}

export const buildAutoOfferLayoutPlan = (
  products: ReadonlyArray<Partial<Product> | any>,
  options: AutoOfferPlanOptions = {}
): AutoOfferLayoutPlan => {
  const density = options.density || 'balanced'
  const sourceMode = options.sourceMode || 'manual'
  const overflowPolicy = options.overflowPolicy || 'warn'
  const promoteHighlights = options.promoteHighlights !== false
  const normalizedProducts = normalizeAutoOfferProducts(products)
  const maxProductsPerZone = Math.max(1, Math.round(toFiniteNumber(options.maxProductsPerZone, normalizedProducts.length || 1)))

  if (normalizedProducts.length === 0) {
    const emptyPlan = buildSingleZonePlan([], {
      ...options,
      density,
      sourceMode,
      overflowPolicy,
      promoteHighlights
    })
    emptyPlan.zone.contentStatus = 'empty'
    return {
      strategy: 'single-zone',
      density,
      totalProducts: 0,
      zones: [emptyPlan],
      warnings: []
    }
  }

  if (overflowPolicy === 'paginate' && normalizedProducts.length > maxProductsPerZone) {
    const zones: AutoOfferZonePlan[] = []
    for (let cursor = 0; cursor < normalizedProducts.length; cursor += maxProductsPerZone) {
      const slice = normalizedProducts.slice(cursor, cursor + maxProductsPerZone)
      zones.push(buildSingleZonePlan(slice, {
        ...options,
        density,
        sourceMode,
        overflowPolicy,
        promoteHighlights
      }))
    }
    return {
      strategy: 'paginate',
      density,
      totalProducts: normalizedProducts.length,
      zones,
      warnings: zones.flatMap((zone) => zone.warnings)
    }
  }

  const zone = buildSingleZonePlan(normalizedProducts, {
    ...options,
    density,
    sourceMode,
    overflowPolicy,
    promoteHighlights
  })

  return {
    strategy: zone.overflowCount > 0 ? 'review-overflow' : 'single-zone',
    density,
    totalProducts: normalizedProducts.length,
    zones: [zone],
    warnings: zone.warnings
  }
}

export const buildAutoOfferZoneUpdate = (
  products: ReadonlyArray<Partial<Product> | any>,
  options: AutoOfferPlanOptions = {}
): Partial<ProductZone> => {
  const plan = buildAutoOfferLayoutPlan(products, options)
  const zone = plan.zones[0]?.zone
  if (!zone) return {}
  return {
    enabled: true,
    role: zone.role,
    contentSource: zone.contentSource,
    contentStatus: zone.contentStatus,
    overflowPolicy: zone.overflowPolicy,
    padding: zone.padding,
    gapHorizontal: zone.gapHorizontal,
    gapVertical: zone.gapVertical,
    columns: zone.columns,
    rows: zone.rows,
    layoutDirection: zone.layoutDirection,
    cardAspectRatio: zone.cardAspectRatio,
    lastRowBehavior: zone.lastRowBehavior,
    verticalAlign: zone.verticalAlign,
    highlightCount: zone.highlightCount,
    highlightPos: zone.highlightPos,
    highlightHeight: zone.highlightHeight,
    highlightStyle: zone.highlightStyle
  }
}
