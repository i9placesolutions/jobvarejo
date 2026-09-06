<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  Columns3,
  Copy,
  FileText,
  Instagram,
  LayoutGrid,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Square,
  Trash2
} from 'lucide-vue-next'
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
import {
  applyProductZoneStructureFormat,
  createDefaultProductZoneStructureMapByPreviewFormat,
  createDefaultProductZoneStructureVariantMapByPreviewFormat,
  getProductZoneStructureFormatLabel,
  normalizeProductZoneStructure,
  normalizeProductZoneStructureMap,
  normalizeProductZoneStructureMapByPreviewFormat,
  normalizeProductZoneStructureVariantMap,
  normalizeProductZoneStructureVariantMapByPreviewFormat,
  PRODUCT_ZONE_PREVIEW_FORMAT_VALUES,
  PRODUCT_ZONE_STRUCTURE_COUNTS,
  PRODUCT_ZONE_STRUCTURE_FORMATS
} from '~/utils/product-zone-structure'
import { getAspectRatioValue } from '~/utils/product-zone-helpers'

const {
  structureMap: savedStructureMap,
  structureVariants: savedStructureVariants,
  structureMapsByPreviewFormat: savedStructureMapsByPreviewFormat,
  structureVariantsByPreviewFormat: savedStructureVariantsByPreviewFormat,
  isLoading,
  isLoaded,
  lastError,
  load,
  save,
  publishLive
} = useProductZoneStructures()

const cloneMap = (value: ProductZoneStructureMap): ProductZoneStructureMap => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureMap
  } catch {
    return normalizeProductZoneStructureMap(value)
  }
}

const cloneVariantMap = (value: ProductZoneStructureVariantMap): ProductZoneStructureVariantMap => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureVariantMap
  } catch {
    return normalizeProductZoneStructureVariantMap(value)
  }
}

const cloneMapsByPreviewFormat = (
  value: ProductZoneStructureMapByPreviewFormat
): ProductZoneStructureMapByPreviewFormat => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureMapByPreviewFormat
  } catch {
    return normalizeProductZoneStructureMapByPreviewFormat(value)
  }
}

const cloneVariantMapsByPreviewFormat = (
  value: ProductZoneStructureVariantMapByPreviewFormat
): ProductZoneStructureVariantMapByPreviewFormat => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureVariantMapByPreviewFormat
  } catch {
    return normalizeProductZoneStructureVariantMapByPreviewFormat(value)
  }
}

const cloneStructure = (value: ProductZoneStructure): ProductZoneStructure => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructure
  } catch {
    return normalizeProductZoneStructure(value, value.count)
  }
}

const initialDraftByPreviewFormat = createDefaultProductZoneStructureMapByPreviewFormat()
const initialDraftVariantsByPreviewFormat = createDefaultProductZoneStructureVariantMapByPreviewFormat(
  {},
  initialDraftByPreviewFormat
)
const draftByPreviewFormat = ref<ProductZoneStructureMapByPreviewFormat>(initialDraftByPreviewFormat)
const draftVariantsByPreviewFormat = ref<ProductZoneStructureVariantMapByPreviewFormat>(initialDraftVariantsByPreviewFormat)
const draft = ref<ProductZoneStructureMap>(cloneMap(initialDraftByPreviewFormat.feed))
const draftVariants = ref<ProductZoneStructureVariantMap>(
  cloneVariantMap(initialDraftVariantsByPreviewFormat.feed)
)
const selectedCount = ref(1)
const selectedVariantId = ref('')
// A seleção da variação precisa ser lembrada por quantidade. Um único id
// global fazia a troca 1 → 2 → 1 parecer que a receita tinha sido perdida.
const selectedVariantIdByCount = ref<Record<string, string>>({})
const selectedVariantIdByPreviewFormat = ref<Partial<Record<ProductZonePreviewFormat, Record<string, string>>>>({})
const selectedCardIndex = ref(1)
const isSaving = ref(false)
const isEditorReady = ref(false)
const saveMessage = ref('')
const saveMessageTone = ref<'success' | 'error'>('success')

type PreviewCell = {
  index: number
  highlighted: boolean
}

type PreviewLine = {
  id: string
  cells: PreviewCell[]
  partial: boolean
}

type PreviewProduct = {
  name: string
  priceWhole: string
  priceCents: string
  unit: string
  accent: string
  image: string
}

const previewProduct: PreviewProduct = {
  name: 'Leite em pó Italac 400g',
  priceWhole: '12',
  priceCents: '99',
  unit: 'UN',
  accent: '#1558a6',
  image: '/coins/LEITE%20PO%20INTEGRAL%20ITALAC%20400G.png'
}

const getPreviewProduct = (_index: number): PreviewProduct => previewProduct

const flyerPreviewFormats = [
  { id: 'story', label: 'Story', ratioLabel: '9:16', width: 1080, height: 1920, icon: Smartphone },
  { id: 'feed', label: 'Feed', ratioLabel: '4:5', width: 1080, height: 1350, icon: Instagram },
  { id: 'post', label: 'Post', ratioLabel: '1:1', width: 1080, height: 1080, icon: Square },
  { id: 'banner', label: 'Banner', ratioLabel: '16:9', width: 1920, height: 1080, icon: Monitor },
  { id: 'a4', label: 'A4', ratioLabel: '210:297', width: 2480, height: 3508, icon: FileText }
] as const

const selectedFlyerPreviewFormatId = ref<ProductZonePreviewFormat>('feed')
const selectedFlyerPreviewFormat = computed(() =>
  flyerPreviewFormats.find((format) => format.id === selectedFlyerPreviewFormatId.value)
  || flyerPreviewFormats[0]
)

const isPreviewFormat = (value: unknown): value is ProductZonePreviewFormat =>
  PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.includes(value as ProductZonePreviewFormat)

const commitDraftForPreviewFormat = (
  format: ProductZonePreviewFormat = selectedFlyerPreviewFormatId.value
) => {
  const normalizedMap = normalizeProductZoneStructureMap(draft.value)
  const normalizedVariants = normalizeProductZoneStructureVariantMap(
    draftVariants.value,
    {},
    normalizedMap
  )
  draftByPreviewFormat.value = {
    ...draftByPreviewFormat.value,
    [format]: cloneMap(normalizedMap)
  }
  draftVariantsByPreviewFormat.value = {
    ...draftVariantsByPreviewFormat.value,
    [format]: cloneVariantMap(normalizedVariants)
  }
}

const loadDraftForPreviewFormat = (
  format: ProductZonePreviewFormat = selectedFlyerPreviewFormatId.value
) => {
  const nextMap = normalizeProductZoneStructureMap(
    draftByPreviewFormat.value[format]
  )
  const nextVariants = normalizeProductZoneStructureVariantMap(
    draftVariantsByPreviewFormat.value[format],
    {},
    nextMap
  )
  draft.value = cloneMap(nextMap)
  draftVariants.value = cloneVariantMap(nextVariants)
  selectedVariantIdByCount.value = {
    ...(selectedVariantIdByPreviewFormat.value[format] || {})
  }
  const countKey = String(selectedCount.value)
  const rememberedId = selectedVariantIdByCount.value[countKey]
  selectedVariantId.value = rememberedId && nextVariants[countKey]?.some((variant) => variant.id === rememberedId)
    ? rememberedId
    : nextVariants[countKey]?.[0]?.id || ''
}

const buildVariantSelectionByPreviewFormat = (
  maps: ProductZoneStructureMapByPreviewFormat,
  variantsByFormat: ProductZoneStructureVariantMapByPreviewFormat,
  previousSelections: Partial<Record<ProductZonePreviewFormat, Record<string, string>>> = {},
  currentFormat: ProductZonePreviewFormat = selectedFlyerPreviewFormatId.value,
  currentVariantId = selectedVariantId.value
): Partial<Record<ProductZonePreviewFormat, Record<string, string>>> => {
  return Object.fromEntries(
    PRODUCT_ZONE_PREVIEW_FORMAT_VALUES.map((format) => {
      const existing = previousSelections[format] || {}
      const next = Object.fromEntries(
        PRODUCT_ZONE_STRUCTURE_COUNTS.map((count) => {
          const key = String(count)
          const variants = variantsByFormat[format]?.[key] || []
          const remembered = format === currentFormat && currentVariantId
            ? currentVariantId
            : existing[key]
          const validId = variants.some((variant) => variant.id === remembered)
            ? remembered
            : variants[0]?.id || ''
          return [key, validId]
        })
      ) as Record<string, string>
      return [format, next]
    })
  ) as Partial<Record<ProductZonePreviewFormat, Record<string, string>>>
}

const selectPreviewFormat = (rawValue: unknown) => {
  if (!isPreviewFormat(rawValue)) return
  const nextFormat = rawValue
  if (nextFormat === selectedFlyerPreviewFormatId.value) return

  // Fecha a receita em edição antes de trocar a página de referência.
  commitDraftForPreviewFormat(selectedFlyerPreviewFormatId.value)
  selectedFlyerPreviewFormatId.value = nextFormat
  loadDraftForPreviewFormat(nextFormat)
  selectedCardIndex.value = Math.min(Math.max(1, selectedCardIndex.value), selectedCount.value)
  saveMessage.value = ''
}

const previewZoomOptions = [
  { value: 0, label: 'Caber no painel' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100% · tamanho real' }
] as const

// Fit is the safest default for a zone editor: the complete artboard stays
// visible while the user changes the recipe. Fixed scales remain available for
// inspecting details without changing the editing model.
const previewZoom = ref<number>(0)
const previewZoomLabel = computed(() =>
  previewZoomOptions.find((option) => option.value === previewZoom.value)?.label || '100% · tamanho real'
)

const flyerPreviewPageStyle = computed<Record<string, string>>(() => {
  const format = selectedFlyerPreviewFormat.value
  const ratio = format.width / format.height

  if (previewZoom.value > 0) {
    return {
      aspectRatio: `${format.width} / ${format.height}`,
      width: `${Math.round(format.width * previewZoom.value)}px`,
      maxHeight: 'none'
    }
  }

  // Fit mode: fill the viewport on both axes. The viewport is a size
  // container, so cqh tracks its real height and tall formats stay fully
  // visible without manual scrolling.
  return {
    aspectRatio: `${format.width} / ${format.height}`,
    width: `min(100%, calc(100cqh * ${ratio.toFixed(5)}))`,
    maxHeight: '100cqh'
  }
})

const layoutDirectionOptions = [
  { value: 'horizontal' as const, label: 'Lado a lado' },
  { value: 'vertical' as const, label: 'Coluna' }
] as const

const lastRowBehaviorOptions = [
  { value: 'fill' as const, label: 'Sempre preencher' }
] as const

const verticalAlignOptions = [
  { value: 'top' as const, label: 'Topo' },
  { value: 'center' as const, label: 'Centro' },
  { value: 'bottom' as const, label: 'Base' },
  { value: 'stretch' as const, label: 'Preencher' }
] as const

const highlightPositionOptions = [
  { value: 'first' as const, label: 'Esquerda' },
  { value: 'last' as const, label: 'Direita' },
  { value: 'center' as const, label: 'Centro' },
  { value: 'top' as const, label: 'Topo' },
  { value: 'bottom' as const, label: 'Base' }
] as const

const highlightSelectionOptions = [
  { value: 'first' as const, label: 'Primeiros da lista' },
  { value: 'last' as const, label: 'Últimos da lista' },
  { value: 'center' as const, label: 'Do centro' },
  { value: 'random' as const, label: 'Aleatórios estáveis' },
  { value: 'manual' as const, label: 'Escolher pela posição' }
] as const

const selectedVariantOptions = computed<ProductZoneStructureVariant[]>(() =>
  draftVariants.value[String(selectedCount.value)] || []
)

const selectedVariant = computed<ProductZoneStructureVariant | null>(() => {
  const selected = selectedVariantOptions.value.find((variant) => variant.id === selectedVariantId.value)
  return selected || selectedVariantOptions.value[0] || null
})

const selectedStructure = computed<ProductZoneStructure>(() => {
  const count = selectedCount.value
  return normalizeProductZoneStructure(
    selectedVariant.value || draft.value[String(count)],
    count,
    {}
  )
})

const getCardAspectRatio = (index: number) =>
  selectedStructure.value.cardAspectRatios[String(index)]
  || selectedStructure.value.cardAspectRatio
  || 'fill'

watch([selectedCount, selectedVariantOptions], ([count, variants]) => {
  selectedCardIndex.value = Math.min(Math.max(1, selectedCardIndex.value), count)
  const countKey = String(count)
  const rememberedId = selectedVariantIdByCount.value[countKey]
  const nextId = variants.find((variant) => variant.id === rememberedId)?.id
    || variants[0]?.id
    || ''
  if (selectedVariantId.value !== nextId) {
    selectedVariantId.value = nextId
  }
  if (selectedVariantIdByCount.value[countKey] !== nextId) {
    selectedVariantIdByCount.value = {
      ...selectedVariantIdByCount.value,
      [countKey]: nextId
    }
  }
  const currentFormatSelections = selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {}
  if (currentFormatSelections[countKey] !== nextId) {
    selectedVariantIdByPreviewFormat.value = {
      ...selectedVariantIdByPreviewFormat.value,
      [selectedFlyerPreviewFormatId.value]: {
        ...currentFormatSelections,
        [countKey]: nextId
      }
    }
  }
}, { immediate: true })

const selectedVariantPosition = computed(() => {
  const index = selectedVariantOptions.value.findIndex((variant) => variant.id === selectedVariant.value?.id)
  return index >= 0 ? index + 1 : 1
})

const selectedVariantIsDefault = computed(() => selectedVariantPosition.value === 1)

const variantCountLabel = (count: number) => {
  const total = draftVariants.value[String(count)]?.length || 1
  return total > 1 ? `${total} variações` : '1 variação'
}

const variantButtonLabel = (variant: ProductZoneStructureVariant, index: number) =>
  index === 0 ? 'Padrão' : (variant.name || `Variação ${index + 1}`)

const variantButtonSummary = (variant: ProductZoneStructureVariant) =>
  `${getProductZoneStructureFormatLabel(variant.format)} · ${variant.columns || 'auto'}×${variant.rows || 'auto'}`

const createVariantId = (count: number) => {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `count-${count}-variant-${Date.now()}-${suffix}`
}

const selectedFormatLabel = computed(() =>
  getProductZoneStructureFormatLabel(selectedStructure.value.format)
)

const previewDimensions = computed(() => {
  const count = selectedCount.value
  const explicitColumns = Number(selectedStructure.value.columns)
  const explicitRows = Number(selectedStructure.value.rows)
  let columns = explicitColumns > 0
    ? Math.min(8, Math.max(1, Math.round(explicitColumns)))
    : 0
  let rows = explicitRows > 0
    ? Math.min(24, Math.max(1, Math.round(explicitRows)))
    : 0

  if (columns <= 0 && rows <= 0) {
    columns = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(count))))
  }
  if (columns <= 0) columns = Math.max(1, Math.ceil(count / rows))
  if (rows <= 0) rows = Math.max(1, Math.ceil(count / columns))

  // Never hide cards from the preview when a deliberately small fixed grid
  // cannot hold the selected quantity.
  if (columns * rows < count) {
    if (selectedStructure.value.layoutDirection === 'vertical') {
      columns = Math.max(columns, Math.ceil(count / rows))
    } else {
      rows = Math.max(rows, Math.ceil(count / columns))
    }
  }

  return { columns, rows }
})

const previewColumns = computed(() => previewDimensions.value.columns)
const previewRows = computed(() => previewDimensions.value.rows)

const previewPadding = computed(() => Math.min(40, Math.max(0, Number(selectedStructure.value.padding) || 0)))
const previewGapHorizontal = computed(() => Math.min(28, Math.max(0, Number(selectedStructure.value.gapHorizontal) || 0)))
const previewGapVertical = computed(() => Math.min(28, Math.max(0, Number(selectedStructure.value.gapVertical) || 0)))
const previewHighlightPadding = computed(() => Math.min(28, Math.max(0, Number(selectedStructure.value.highlightPadding) || 0)))
const previewHighlightGapHorizontal = computed(() => Math.min(28, Math.max(0, Number(selectedStructure.value.highlightGapHorizontal) || 0)))
const previewHighlightGapVertical = computed(() => Math.min(28, Math.max(0, Number(selectedStructure.value.highlightGapVertical) || 0)))

const previewCanvasStyle = computed<Record<string, string>>(() => ({
  padding: `${previewPadding.value}px`
}))

const highlightedPreviewIndexes = computed(() => {
  const count = selectedCount.value
  const amount = Math.min(count, Math.max(0, Math.round(Number(selectedStructure.value.highlightCount) || 0)))
  if (amount <= 0) return new Set<number>()

  const position = selectedStructure.value.highlightSelection
  if (position === 'manual') {
    return new Set(
      selectedStructure.value.highlightIndexes
        .slice(0, amount)
        .map((index) => index - 1)
        .filter((index) => index >= 0 && index < count)
    )
  }
  if (position === 'last') {
    return new Set(Array.from({ length: amount }, (_, index) => count - amount + index))
  }
  if (position === 'center') {
    const start = Math.max(0, Math.floor((count - amount) / 2))
    return new Set(Array.from({ length: amount }, (_, index) => start + index))
  }
  if (position === 'random') {
    // Stable pseudo-random order keeps the preview from jumping on every keystroke.
    const order: number[] = []
    for (let index = 0; index < count && order.length < amount; index += 1) {
      order.push(index % 2 === 0 ? index / 2 : count - 1 - Math.floor(index / 2))
    }
    return new Set(order.slice(0, amount))
  }
  return new Set(Array.from({ length: amount }, (_, index) => index))
})

const previewCells = computed(() => Array.from({ length: selectedCount.value }, (_, index) => ({
  index: index + 1,
  highlighted: highlightedPreviewIndexes.value.has(index)
})))

// 1-based version of highlightedPreviewIndexes, valid regardless of the
// current selection mode. Powers the highlight toggle on each card row.
const effectiveHighlightIndexes = computed(() =>
  new Set(Array.from(highlightedPreviewIndexes.value).map((zeroBased) => zeroBased + 1))
)

const previewLines = computed<PreviewLine[]>(() => {
  const direction = selectedStructure.value.layoutDirection
  const lineCapacity = direction === 'vertical' ? previewRows.value : previewColumns.value
  const lineCount = direction === 'vertical' ? previewColumns.value : previewRows.value
  const items = previewCells.value

  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const start = lineIndex * lineCapacity
    const cells = items.slice(start, start + lineCapacity)
    return {
      id: `line-${lineIndex + 1}`,
      cells,
      partial: cells.length < lineCapacity
    }
  }).filter((line) => line.cells.length > 0)
})

const previewGridStyle = computed<Record<string, string>>(() => {
  const structure = selectedStructure.value
  const highlightCount = Math.max(0, Math.round(Number(structure.highlightCount) || 0))
  const isShowcaseSide = structure.format === 'showcase'
    && highlightCount > 0
    && highlightCount < selectedCount.value
    && (Number(structure.highlightHeight) || 1) > 1
    && (structure.highlightPos === 'first' || structure.highlightPos === 'last')

  return {
    flexDirection: isShowcaseSide
      ? 'row'
      : structure.layoutDirection === 'vertical' ? 'row' : 'column',
    gap: isShowcaseSide || structure.layoutDirection === 'vertical'
      ? `${previewGapHorizontal.value}px`
      : `${previewGapVertical.value}px`
  }
})

const previewLineStyle = (line: PreviewLine): Record<string, string> => {
  const isVertical = selectedStructure.value.layoutDirection === 'vertical'
  const verticalAlign = selectedStructure.value.verticalAlign
  const lastRowBehavior = selectedStructure.value.lastRowBehavior
  const alignMap: Record<string, string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
    stretch: 'stretch'
  }
  const lastRowMap: Record<string, string> = {
    center: 'center',
    left: 'flex-start',
    fill: 'stretch',
    stretch: 'space-between'
  }

  return {
    flexDirection: isVertical ? 'column' : 'row',
    gap: isVertical ? `${previewGapVertical.value}px` : `${previewGapHorizontal.value}px`,
    alignItems: isVertical ? 'stretch' : alignMap[verticalAlign] || 'stretch',
    justifyContent: line.partial
      ? (lastRowMap[lastRowBehavior] || 'flex-start')
      : (isVertical ? (alignMap[verticalAlign] || 'stretch') : 'flex-start')
  }
}

const previewCellStyle = (cell: PreviewCell, line: PreviewLine): Record<string, string> => {
  const isVertical = selectedStructure.value.layoutDirection === 'vertical'
  const capacity = isVertical ? previewRows.value : previewColumns.value
  const gap = isVertical ? previewGapVertical.value : previewGapHorizontal.value
  const behavior = selectedStructure.value.lastRowBehavior
  const isExpandingPartialLine = line.partial && (behavior === 'fill' || behavior === 'stretch')
  const trackCount = isExpandingPartialLine ? line.cells.length : capacity
  const trackGap = Math.max(0, trackCount - 1) * gap
  const trackSize = `calc((100% - ${trackGap}px) / ${Math.max(1, trackCount)})`
  const ratio = getCardAspectRatio(cell.index)
  const hasExplicitRatio = ratio !== 'fill' && ratio !== 'auto'
  const cssAspectRatio = ratio === 'square'
    ? '1 / 1'
    : ratio && ratio.includes(':')
      ? ratio.replace(':', ' / ')
      : 'auto'
  const aspectRatioValue = hasExplicitRatio ? getAspectRatioValue(ratio) : null
  const shouldFillTrack = ratio === 'fill' || ratio === 'auto'

  return {
    ...(hasExplicitRatio && aspectRatioValue
      ? {
          // cqw/cqh fit both sides against the real line dimensions, keeping
          // wide and tall cards from being stretched by the grid.
          width: `min(100%, calc(100cqh * ${aspectRatioValue}))`,
          height: `min(100%, calc(100cqw / ${aspectRatioValue}))`,
          flex: '0 1 auto'
        }
      : isVertical
      ? {
          width: '100%',
          flex: shouldFillTrack ? '1 1 0' : '0 1 auto'
        }
      : {
          width: trackSize,
          flex: `0 0 ${trackSize}`
    }),
    aspectRatio: cssAspectRatio,
    height: hasExplicitRatio && !aspectRatioValue ? '100%' : shouldFillTrack ? '100%' : 'auto',
    ...(hasExplicitRatio
      ? {
          alignSelf: selectedStructure.value.verticalAlign === 'bottom'
            ? 'flex-end'
            : selectedStructure.value.verticalAlign === 'top'
              ? 'flex-start'
              : 'center'
        }
      : {}),
    zIndex: cell.highlighted ? '2' : '1'
  }
}

const isFeaturedShowcase = computed(() => {
  const structure = selectedStructure.value
  const count = Math.max(0, Math.round(Number(structure.highlightCount) || 0))
  return structure.format === 'showcase'
    && count > 0
    && count < selectedCount.value
    && (Number(structure.highlightHeight) || 1) > 1
})

const showcaseHighlightedCells = computed(() =>
  previewCells.value.filter((cell) => cell.highlighted)
)

const showcaseRegularCells = computed(() =>
  previewCells.value.filter((cell) => !cell.highlighted)
)

const showcaseIsSideBySide = computed(() =>
  selectedStructure.value.highlightPos === 'first' || selectedStructure.value.highlightPos === 'last'
)

const showcaseRegularColumns = computed(() => {
  if (!showcaseIsSideBySide.value) return previewColumns.value
  return Math.max(1, previewColumns.value - 1)
})

const showcaseRegularRows = computed(() =>
  Math.max(1, Math.ceil(showcaseRegularCells.value.length / showcaseRegularColumns.value))
)

const showcaseFeaturedColumns = computed(() =>
  showcaseIsSideBySide.value
    ? 1
    : Math.max(1, Math.min(previewColumns.value, showcaseHighlightedCells.value.length))
)

const showcaseFeaturedRows = computed(() =>
  showcaseIsSideBySide.value
    ? Math.max(1, showcaseHighlightedCells.value.length)
    : Math.max(1, Math.ceil(showcaseHighlightedCells.value.length / showcaseFeaturedColumns.value))
)

const showcaseFeaturedShare = computed(() => {
  const multiplier = Math.max(1, Number(selectedStructure.value.highlightHeight) || 1)
  const normalUnits = showcaseIsSideBySide.value
    ? showcaseRegularColumns.value
    : showcaseRegularRows.value
  return `${Math.min(72, Math.max(24, (multiplier / (normalUnits + multiplier)) * 100))}%`
})

const showcaseAreaStyle = computed<Record<string, string>>(() => ({
  flex: `0 0 ${showcaseFeaturedShare.value}`
}))

const showcaseRegularAreaStyle = computed<Record<string, string>>(() => ({
  flex: '1 1 0'
}))

const showcaseFeaturedGridStyle = computed<Record<string, string>>(() => ({
  gridTemplateColumns: `repeat(${showcaseFeaturedColumns.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${showcaseFeaturedRows.value}, minmax(0, 1fr))`,
  gap: `${previewHighlightGapVertical.value}px ${previewHighlightGapHorizontal.value}px`,
  padding: `${previewHighlightPadding.value}px`
}))

const showcaseRegularGridStyle = computed<Record<string, string>>(() => ({
  gridTemplateColumns: `repeat(${showcaseRegularColumns.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${showcaseRegularRows.value}, minmax(0, 1fr))`,
  gap: `${previewGapVertical.value}px ${previewGapHorizontal.value}px`
}))

const previewCardStyle = (cell: PreviewCell): Record<string, string> => {
  const ratio = getCardAspectRatio(cell.index)
  const hasExplicitRatio = ratio !== 'fill' && ratio !== 'auto'
  const cssAspectRatio = ratio === 'square'
    ? '1 / 1'
    : ratio && ratio.includes(':')
      ? ratio.replace(':', ' / ')
      : 'auto'
  const aspectRatioValue = hasExplicitRatio ? getAspectRatioValue(ratio) : null

  return {
    aspectRatio: cssAspectRatio,
    ...(hasExplicitRatio && aspectRatioValue
      ? {
          width: `min(100%, calc(100cqh * ${aspectRatioValue}))`,
          height: `min(100%, calc(100cqw / ${aspectRatioValue}))`
        }
      : {
          width: '100%',
          height: ratio === 'fill' || ratio === 'auto' ? '100%' : 'auto'
      }),
    justifySelf: hasExplicitRatio ? 'center' : 'stretch',
    ...(hasExplicitRatio ? { alignSelf: 'center' } : {}),
    zIndex: cell.highlighted ? '2' : '1'
  }
}

const highlightPositionLabel = computed(() => {
  const labels: Record<string, string> = {
    first: 'Esquerda',
    last: 'Direita',
    center: 'Centro',
    top: 'Topo',
    bottom: 'Base',
    random: 'Aleatório'
  }
  return labels[selectedStructure.value.highlightPos] || 'Esquerda'
})

const highlightPositionHint = computed(() => {
  const position = selectedStructure.value.highlightPos
  if (position === 'top' || position === 'bottom') {
    return `${highlightPositionLabel.value} + ${previewColumns.value} colunas = faixa de destaque e grade de apoio.`
  }
  return `${highlightPositionLabel.value} + ${previewColumns.value} colunas = área grande e ${Math.max(1, previewColumns.value - 1)} colunas de apoio.`
})

const highlightSelectionLabel = computed(() =>
  selectedStructure.value.highlightSelection === 'manual'
    ? (selectedStructure.value.highlightIndexes.length > 0
        ? `Cards ${selectedStructure.value.highlightIndexes.slice(0, selectedStructure.value.highlightCount).join(', ')}`
        : 'Escolha manual')
    : highlightSelectionOptions.find((option) => option.value === selectedStructure.value.highlightSelection)?.label
      || 'Primeiros da lista'
)

const getBaseZone = (): Partial<ProductZone> => ({
  padding: selectedStructure.value.padding,
  gapHorizontal: selectedStructure.value.gapHorizontal,
  gapVertical: selectedStructure.value.gapVertical
})

const normalizeVariantsForCount = (
  count: number,
  variants: Array<Partial<ProductZoneStructureVariant>>
) : ProductZoneStructureVariant[] => normalizeProductZoneStructureVariantMap(
  { [String(count)]: variants },
  {},
  draft.value
  )[String(count)] ?? []

const commitVariantList = (
  count: number,
  variants: Array<Partial<ProductZoneStructureVariant>>
) => {
  const normalizedVariants = normalizeVariantsForCount(count, variants)
  const nextVariants: ProductZoneStructureVariantMap = {
    ...draftVariants.value,
    [String(count)]: normalizedVariants
  }
  const nextPrimary = normalizeProductZoneStructure(
    normalizedVariants[0] || draft.value[String(count)],
    count,
    {}
  )
  const nextDraft = {
    ...draft.value,
    [String(count)]: nextPrimary
  }
  draftVariants.value = nextVariants
  draft.value = nextDraft
  commitDraftForPreviewFormat()
  publishLive(draftByPreviewFormat.value, draftVariantsByPreviewFormat.value)
}

const updateSelected = (patch: Partial<ProductZoneStructure>) => {
  const count = selectedCount.value
  const current = selectedStructure.value
  const nextPatch: Partial<ProductZoneStructure> = { ...patch }

  // Keep the highlight spacing linked to the zone until the user changes a
  // highlight value explicitly. This preserves a useful default without
  // taking control away from the per-highlight settings.
  if (patch.padding !== undefined && patch.highlightPadding === undefined && current.highlightPadding === current.padding) {
    nextPatch.highlightPadding = patch.padding
  }
  if (patch.gapHorizontal !== undefined && patch.highlightGapHorizontal === undefined && current.highlightGapHorizontal === current.gapHorizontal) {
    nextPatch.highlightGapHorizontal = patch.gapHorizontal
  }
  if (patch.gapVertical !== undefined && patch.highlightGapVertical === undefined && current.highlightGapVertical === current.gapVertical) {
    nextPatch.highlightGapVertical = patch.gapVertical
  }

  const nextStructure = normalizeProductZoneStructure(
    { ...current, ...nextPatch },
    count,
    getBaseZone()
  )
  const currentVariant = selectedVariant.value || {
    ...current,
    id: `count-${count}-default`,
    name: 'Padrão'
  }
  const nextVariants = selectedVariantOptions.value.length > 0
    ? selectedVariantOptions.value.map((variant) =>
        variant.id === currentVariant.id
          ? { ...variant, ...nextStructure }
          : variant
      )
    : [{ ...currentVariant, ...nextStructure }]
  commitVariantList(count, nextVariants)
  saveMessage.value = ''
}

const selectCardForFormat = (index: number) => {
  if (index < 1 || index > selectedCount.value) return
  selectedCardIndex.value = index
}

const selectVariant = (rawValue: unknown) => {
  const nextId = String(rawValue || '').trim()
  if (!selectedVariantOptions.value.some((variant) => variant.id === nextId)) return
  selectedVariantId.value = nextId
  selectedVariantIdByCount.value = {
    ...selectedVariantIdByCount.value,
    [String(selectedCount.value)]: nextId
  }
  selectedVariantIdByPreviewFormat.value = {
    ...selectedVariantIdByPreviewFormat.value,
    [selectedFlyerPreviewFormatId.value]: {
      ...(selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {}),
      [String(selectedCount.value)]: nextId
    }
  }
  selectedCardIndex.value = Math.min(Math.max(1, selectedCardIndex.value), selectedCount.value)
}

const updateSelectedVariantName = (rawValue: unknown) => {
  const current = selectedVariant.value
  if (!current) return
  const count = selectedCount.value
  const fallback = selectedVariantPosition.value === 1 ? 'Padrão' : `Variação ${selectedVariantPosition.value}`
  const name = String(rawValue ?? '').trim() || fallback
  commitVariantList(
    count,
    selectedVariantOptions.value.map((variant) =>
      variant.id === current.id ? { ...variant, name } : variant
    )
  )
}

const duplicateSelectedVariant = () => {
  const count = selectedCount.value
  // Cada variação recebe cópias próprias dos arrays/objetos internos. Assim,
  // mudar proporção de card, destaques ou espaçamento em uma não altera outra.
  const current = cloneStructure(selectedStructure.value)
  const nextIndex = selectedVariantOptions.value.length + 1
  const id = createVariantId(count)
  commitVariantList(count, [
    ...selectedVariantOptions.value,
    { ...current, id, name: `Variação ${nextIndex}` }
  ])
  selectedVariantId.value = id
  selectedVariantIdByCount.value = {
    ...selectedVariantIdByCount.value,
    [String(count)]: id
  }
  selectedVariantIdByPreviewFormat.value = {
    ...selectedVariantIdByPreviewFormat.value,
    [selectedFlyerPreviewFormatId.value]: {
      ...(selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {}),
      [String(count)]: id
    }
  }
}

const removeSelectedVariant = () => {
  if (selectedVariantOptions.value.length <= 1 || !selectedVariant.value) return
  const currentId = selectedVariant.value.id
  const nextVariants = selectedVariantOptions.value.filter((variant) => variant.id !== currentId)
  commitVariantList(selectedCount.value, nextVariants)
  const nextId = nextVariants[0]?.id || ''
  selectedVariantId.value = nextId
  selectedVariantIdByCount.value = {
    ...selectedVariantIdByCount.value,
    [String(selectedCount.value)]: nextId
  }
  selectedVariantIdByPreviewFormat.value = {
    ...selectedVariantIdByPreviewFormat.value,
    [selectedFlyerPreviewFormatId.value]: {
      ...(selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {}),
      [String(selectedCount.value)]: nextId
    }
  }
}

const selectPreviewCard = (index: number) => {
  selectCardForFormat(index)
}

const updateSelectedNumber = (
  prop: 'columns' | 'rows' | 'padding' | 'gapHorizontal' | 'gapVertical' | 'highlightPadding' | 'highlightGapHorizontal' | 'highlightGapVertical' | 'highlightCount' | 'highlightHeight',
  rawValue: unknown,
  min: number,
  max: number
) => {
  const current = Number(selectedStructure.value[prop] || 0)
  const parsed = Number(rawValue)
  const value = Number.isFinite(parsed) ? parsed : current
  const precision = prop === 'highlightHeight' ? 10 : 1
  const normalized = Math.round(value * precision) / precision
  const nextValue = Math.min(max, Math.max(min, normalized))
  if (prop === 'highlightCount' && selectedStructure.value.highlightSelection === 'manual') {
    const nextCount = Math.round(nextValue)
    const selected = new Set(selectedStructure.value.highlightIndexes.slice(0, nextCount))
    for (let index = 1; selected.size < nextCount && index <= selectedCount.value; index += 1) {
      selected.add(index)
    }
    updateSelected({
      highlightCount: nextCount,
      highlightIndexes: Array.from(selected).sort((a, b) => a - b)
    })
    return
  }
  updateSelected({ [prop]: nextValue })
}

const changeHighlightSelection = (rawValue: unknown) => {
  const selection = String(rawValue || 'first') as NonNullable<ProductZoneStructure['highlightSelection']>
  if (!highlightSelectionOptions.some((option) => option.value === selection)) return

  if (selection !== 'manual') {
    updateSelected({ highlightSelection: selection })
    return
  }

  const amount = Math.max(1, Math.min(selectedCount.value, Math.round(Number(selectedStructure.value.highlightCount) || 0)))
  const indexes = selectedStructure.value.highlightIndexes.length > 0
    ? selectedStructure.value.highlightIndexes.slice(0, amount)
    : Array.from({ length: amount }, (_, index) => index + 1)
  updateSelected({
    highlightSelection: selection,
    highlightCount: amount,
    highlightIndexes: indexes
  })
}

// Toggling a card's highlight directly always switches the recipe to manual
// selection, seeded with whatever was effectively highlighted a moment ago
// (even if that came from an automatic mode like "first"/"random"), so the
// card the user just clicked is the only thing that visibly changes.
const toggleCardHighlight = (index: number) => {
  if (index < 1 || index > selectedCount.value) return
  if (selectedStructure.value.format !== 'showcase') return

  const baseIndexes = selectedStructure.value.highlightSelection === 'manual'
    ? selectedStructure.value.highlightIndexes
    : Array.from(effectiveHighlightIndexes.value)

  const indexes = new Set(baseIndexes)
  if (indexes.has(index)) indexes.delete(index)
  else indexes.add(index)

  const nextIndexes = Array.from(indexes).sort((a, b) => a - b)
  updateSelected({
    highlightSelection: 'manual',
    highlightIndexes: nextIndexes,
    highlightCount: nextIndexes.length
  })
}

const changeFormat = (rawValue: unknown) => {
  const format = String(rawValue || 'auto') as ProductZoneStructureFormat
  if (!PRODUCT_ZONE_STRUCTURE_FORMATS.some((item) => item.value === format)) return
  updateSelected(
    applyProductZoneStructureFormat(
      selectedStructure.value,
      selectedCount.value,
      format,
      getBaseZone()
    )
  )
}

const restoreDefaults = () => {
  if (!isEditorReady.value || !isLoaded.value) return
  const defaults = createDefaultProductZoneStructureMapByPreviewFormat()
  const defaultVariants = createDefaultProductZoneStructureVariantMapByPreviewFormat({}, defaults)
  draftByPreviewFormat.value = defaults
  draftVariantsByPreviewFormat.value = defaultVariants
  selectedCount.value = 1
  selectedVariantIdByPreviewFormat.value = buildVariantSelectionByPreviewFormat(
    defaults,
    defaultVariants,
    {},
    selectedFlyerPreviewFormatId.value,
    ''
  )
  selectedVariantIdByCount.value = {
    ...(selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {})
  }
  loadDraftForPreviewFormat()
  selectedVariantId.value = selectedVariantIdByCount.value['1'] || ''
  saveMessage.value = ''
  publishLive(draftByPreviewFormat.value, draftVariantsByPreviewFormat.value)
}

const persist = async () => {
  if (!isEditorReady.value || !isLoaded.value) {
    saveMessageTone.value = 'error'
    saveMessage.value = 'Aguarde o carregamento das estruturas antes de salvar.'
    return
  }
  isSaving.value = true
  saveMessage.value = ''
  try {
    // O formato atual fica registrado no mapa completo antes da requisicao.
    commitDraftForPreviewFormat()
    const previousVariantId = selectedVariantId.value
    const normalized = normalizeProductZoneStructureMapByPreviewFormat(
      draftByPreviewFormat.value
    )
    const normalizedVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
      draftVariantsByPreviewFormat.value,
      {},
      normalized
    )
    const result = await save(normalized, normalizedVariants)
    const committedMaps = cloneMapsByPreviewFormat(result)
    const committedVariants = cloneVariantMapsByPreviewFormat(savedStructureVariantsByPreviewFormat.value)
    draftByPreviewFormat.value = committedMaps
    draftVariantsByPreviewFormat.value = committedVariants
    selectedVariantIdByPreviewFormat.value = buildVariantSelectionByPreviewFormat(
      committedMaps,
      committedVariants,
      selectedVariantIdByPreviewFormat.value,
      selectedFlyerPreviewFormatId.value,
      previousVariantId
    )
    selectedVariantIdByCount.value = {
      ...(selectedVariantIdByPreviewFormat.value[selectedFlyerPreviewFormatId.value] || {})
    }
    loadDraftForPreviewFormat()
    selectedVariantId.value = selectedVariantIdByCount.value[String(selectedCount.value)] || ''
    saveMessageTone.value = 'success'
    saveMessage.value = 'Estruturas salvas. O editor já está sincronizado com a receita.'
  } catch (error: any) {
    saveMessageTone.value = 'error'
    saveMessage.value = String(
      error?.data?.statusMessage || error?.message || 'Não foi possível salvar as estruturas.'
    )
  } finally {
    isSaving.value = false
  }
}

const initializeEditor = async () => {
  isEditorReady.value = false
  try {
    // A tela pode ser reaberta dentro do mesmo app depois de outra superfície
    // ter alterado a biblioteca. Sempre confirme a versão atual no servidor.
    const loaded = await load(true)
    if (!isLoaded.value) return

    const loadedMaps = normalizeProductZoneStructureMapByPreviewFormat(
      loaded || savedStructureMapsByPreviewFormat.value,
      {},
      savedStructureMap.value
    )
    const loadedVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
      savedStructureVariantsByPreviewFormat.value,
      {},
      loadedMaps,
      savedStructureVariants.value
    )
    draftByPreviewFormat.value = cloneMapsByPreviewFormat(loadedMaps)
    draftVariantsByPreviewFormat.value = cloneVariantMapsByPreviewFormat(loadedVariants)
    selectedVariantIdByPreviewFormat.value = buildVariantSelectionByPreviewFormat(
      draftByPreviewFormat.value,
      draftVariantsByPreviewFormat.value
    )
    loadDraftForPreviewFormat()
    selectedVariantId.value = selectedVariantIdByCount.value[String(selectedCount.value)] || ''
  } finally {
    isEditorReady.value = true
  }
}

onMounted(() => {
  void initializeEditor()
})
</script>

<template>
  <div class="structure-manager">
    <header class="structure-manager__topbar">
      <div class="structure-manager__topbar-inner">
        <NuxtLink to="/" class="structure-manager__back" aria-label="Voltar para o dashboard">
          <ArrowLeft class="h-4 w-4" />
          <span>Dashboard</span>
        </NuxtLink>
        <div class="structure-manager__brand">
          <div class="structure-manager__brand-mark"><LayoutGrid class="h-4 w-4" /></div>
          <span>Estruturas de zonas</span>
        </div>
        <div class="structure-manager__topbar-spacer" />
        <NuxtLink to="/card-configurations" class="structure-manager__secondary-link">Configuração dos cards</NuxtLink>
        <div class="structure-manager__actions">
          <button type="button" class="button button--secondary" :disabled="!isEditorReady || !isLoaded" @click="restoreDefaults">
            <RotateCcw class="h-4 w-4" />
            Restaurar
          </button>
          <button type="button" class="button button--primary" :disabled="isSaving || !isEditorReady || !isLoaded" @click="persist">
            <Save class="h-4 w-4" />
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </header>

    <main
      class="structure-manager__main"
      :class="{ 'structure-manager__main--blocked': !isEditorReady || !isLoaded }"
      :aria-busy="!isEditorReady || isLoading"
    >
      <div v-if="!isEditorReady || !isLoaded" class="structure-manager__loading" role="status" aria-live="polite">
        <div class="structure-manager__loading-card">
          <span class="structure-manager__loading-spinner" aria-hidden="true"></span>
          <strong>{{ isLoading ? 'Carregando suas estruturas…' : 'Não foi possível carregar as estruturas.' }}</strong>
          <small v-if="isLoading">Aguarde para editar e salvar sem sobrescrever seus dados.</small>
          <small v-else>{{ lastError || 'Verifique a conexão e tente novamente.' }}</small>
          <button v-if="isEditorReady && !isLoading" type="button" class="button button--secondary" @click="initializeEditor">
            Tentar novamente
          </button>
        </div>
      </div>

      <p
        v-if="saveMessage || lastError"
        class="feedback"
        :class="(saveMessageTone === 'error' || lastError) ? 'feedback--error' : 'feedback--success'"
      >
        <Check v-if="!(saveMessageTone === 'error' || lastError)" class="h-4 w-4" />
        {{ saveMessage || lastError }}
      </p>

      <div class="structure-manager__workspace">
        <aside class="count-panel">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">Receitas</span>
              <h2>Quantidade da lista</h2>
            </div>
            <Columns3 class="h-4 w-4 text-cyan-600" />
          </div>
          <div class="count-list">
            <button
              v-for="count in PRODUCT_ZONE_STRUCTURE_COUNTS"
              :key="count"
              type="button"
              class="count-item"
              :class="{ 'count-item--active': selectedCount === count }"
              @click="selectedCount = count"
            >
              <span class="count-item__number">{{ count }}</span>
              <span class="count-item__copy">
                <strong>{{ count === 1 ? 'produto' : 'produtos' }}</strong>
                <small>{{ getProductZoneStructureFormatLabel(draft[String(count)]?.format) }} · {{ variantCountLabel(count) }}</small>
              </span>
              <Check v-if="selectedCount === count" class="count-item__check h-3.5 w-3.5" />
            </button>
          </div>
        </aside>

        <section class="editor-panel">
          <div class="flyer-preview">
            <div class="flyer-preview__heading">
              <div class="flyer-preview__identity">
                <strong>{{ selectedCount }} {{ selectedCount === 1 ? 'produto' : 'produtos' }}</strong>
                <span>{{ selectedFormatLabel }} · {{ selectedFlyerPreviewFormat.label }} {{ selectedFlyerPreviewFormat.ratioLabel }}</span>
              </div>
              <div class="flyer-preview__tools">
                <div class="flyer-preview__format-picker" aria-label="Formato do encarte">
                  <button
                    v-for="format in flyerPreviewFormats"
                    :key="format.id"
                    type="button"
                    class="flyer-preview__format-button"
                    :class="{ 'flyer-preview__format-button--active': selectedFlyerPreviewFormatId === format.id }"
                    :aria-pressed="selectedFlyerPreviewFormatId === format.id"
                    :title="`${format.label} ${format.ratioLabel} (${format.width}×${format.height})`"
                    @click="selectPreviewFormat(format.id)"
                  >
                    <component :is="format.icon" class="h-4 w-4" />
                    <span>{{ format.label }}</span>
                    <small>{{ format.ratioLabel }}</small>
                  </button>
                </div>
                <small class="flyer-preview__format-note">Receita independente por formato</small>
                <label class="flyer-preview__zoom-picker">
                  <span>Escala</span>
                  <select :value="previewZoom" aria-label="Escala da prévia" @change="previewZoom = Number(($event.target as HTMLSelectElement).value)">
                    <option v-for="option in previewZoomOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <div
              class="flyer-preview__viewport"
              :class="{
                'flyer-preview__viewport--real': previewZoom > 0,
                'flyer-preview__viewport--fit': previewZoom === 0
              }"
            >
              <div class="flyer-preview__page" :style="flyerPreviewPageStyle">
                <div class="flyer-preview__safe-area">
                  <div class="preview-stage">
            <div class="preview-canvas" :style="previewCanvasStyle">
              <div
                v-if="isFeaturedShowcase"
                class="preview-featured"
                :class="[
                  showcaseIsSideBySide ? 'preview-featured--side' : 'preview-featured--stacked',
                  selectedStructure.highlightPos === 'last' || selectedStructure.highlightPos === 'bottom'
                    ? 'preview-featured--reverse'
                    : ''
                ]"
                :style="previewGridStyle"
              >
                <div class="preview-featured__area preview-featured__area--featured" :style="showcaseAreaStyle">
                  <div class="preview-featured__grid" :style="showcaseFeaturedGridStyle">
                    <button
                      v-for="cell in showcaseHighlightedCells"
                      :key="`featured-${cell.index}`"
                      type="button"
                      class="preview-cell preview-cell--highlight"
                      :class="{
                        'preview-cell--selectable': selectedStructure.highlightSelection === 'manual',
                        'preview-cell--editing': selectedCardIndex === cell.index
                      }"
                      :style="previewCardStyle(cell)"
                      :aria-pressed="effectiveHighlightIndexes.has(cell.index)"
                      :aria-label="`Card ${cell.index}`"
                      @click="selectPreviewCard(cell.index)"
                    >
                      <span
                        class="preview-product-card"
                        :class="{ 'preview-product-card--highlight': cell.highlighted }"
                        :style="{ '--preview-accent': getPreviewProduct(cell.index).accent }"
                      >
                        <span class="preview-product-card__index">{{ cell.index }}</span>
                        <span class="preview-product-card__name">{{ getPreviewProduct(cell.index).name }}</span>
                        <span class="preview-product-card__image">
                          <img :src="getPreviewProduct(cell.index).image" :alt="getPreviewProduct(cell.index).name" />
                        </span>
                        <span class="preview-product-card__offer">
                          <span class="preview-product-card__currency">R$</span>
                          <strong>{{ getPreviewProduct(cell.index).priceWhole }}</strong>
                          <sup>,{{ getPreviewProduct(cell.index).priceCents }}</sup>
                          <small>{{ getPreviewProduct(cell.index).unit }}</small>
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                <div class="preview-featured__area preview-featured__area--regular" :style="showcaseRegularAreaStyle">
                  <div class="preview-featured__grid" :style="showcaseRegularGridStyle">
                    <button
                      v-for="cell in showcaseRegularCells"
                      :key="`regular-${cell.index}`"
                      type="button"
                      class="preview-cell"
                      :class="{
                        'preview-cell--selectable': selectedStructure.highlightSelection === 'manual',
                        'preview-cell--editing': selectedCardIndex === cell.index
                      }"
                      :style="previewCardStyle(cell)"
                      :aria-pressed="effectiveHighlightIndexes.has(cell.index)"
                      :aria-label="`Card ${cell.index}`"
                      @click="selectPreviewCard(cell.index)"
                    >
                      <span
                        class="preview-product-card"
                        :class="{ 'preview-product-card--highlight': cell.highlighted }"
                        :style="{ '--preview-accent': getPreviewProduct(cell.index).accent }"
                      >
                        <span class="preview-product-card__index">{{ cell.index }}</span>
                        <span class="preview-product-card__name">{{ getPreviewProduct(cell.index).name }}</span>
                        <span class="preview-product-card__image">
                          <img :src="getPreviewProduct(cell.index).image" :alt="getPreviewProduct(cell.index).name" />
                        </span>
                        <span class="preview-product-card__offer">
                          <span class="preview-product-card__currency">R$</span>
                          <strong>{{ getPreviewProduct(cell.index).priceWhole }}</strong>
                          <sup>,{{ getPreviewProduct(cell.index).priceCents }}</sup>
                          <small>{{ getPreviewProduct(cell.index).unit }}</small>
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="preview-grid" :style="previewGridStyle">
                <div
                  v-for="line in previewLines"
                  :key="line.id"
                  class="preview-line"
                  :style="previewLineStyle(line)"
                >
                  <button
                    v-for="cell in line.cells"
                    :key="cell.index"
                    type="button"
                    class="preview-cell"
                    :class="{
                      'preview-cell--highlight': cell.highlighted,
                      'preview-cell--selectable': selectedStructure.highlightSelection === 'manual',
                      'preview-cell--editing': selectedCardIndex === cell.index
                    }"
                    :style="previewCellStyle(cell, line)"
                    :aria-pressed="effectiveHighlightIndexes.has(cell.index)"
                    :aria-label="`Card ${cell.index}`"
                    @click="selectPreviewCard(cell.index)"
                  >
                    <span
                      class="preview-product-card"
                      :class="{ 'preview-product-card--highlight': cell.highlighted }"
                      :style="{ '--preview-accent': getPreviewProduct(cell.index).accent }"
                    >
                      <span class="preview-product-card__index">{{ cell.index }}</span>
                      <span class="preview-product-card__name">{{ getPreviewProduct(cell.index).name }}</span>
                      <span class="preview-product-card__image">
                        <img :src="getPreviewProduct(cell.index).image" :alt="getPreviewProduct(cell.index).name" />
                      </span>
                      <span class="preview-product-card__offer">
                        <span class="preview-product-card__currency">R$</span>
                        <strong>{{ getPreviewProduct(cell.index).priceWhole }}</strong>
                        <sup>,{{ getPreviewProduct(cell.index).priceCents }}</sup>
                        <small>{{ getPreviewProduct(cell.index).unit }}</small>
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div class="preview-summary" aria-hidden="true">
              <span>{{ selectedFormatLabel }}</span>
              <span>{{ previewColumns }} × {{ previewRows }}</span>
            </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="editor-panel__inspector">
          <section class="settings-section" aria-labelledby="zone-settings-title">
            <div class="settings-section__heading">
              <h3 id="zone-settings-title">Editor da zona</h3>
            </div>

            <div class="field-grid">
            <label class="field">
              <span>Formato da zona</span>
              <select :value="selectedStructure.format" @change="changeFormat(($event.target as HTMLSelectElement).value)">
                <option v-for="option in PRODUCT_ZONE_STRUCTURE_FORMATS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <small>{{ PRODUCT_ZONE_STRUCTURE_FORMATS.find((item) => item.value === selectedStructure.format)?.hint }}</small>
            </label>

            <div class="variant-toolbar variant-toolbar--inline">
              <div class="variant-toolbar__copy">
                <span class="field-label">Variações da zona para {{ selectedCount }} {{ selectedCount === 1 ? 'produto' : 'produtos' }}</span>
                <small>Cada número é uma receita completa: ao trocar, você edita formato, grade, fluxo, espaçamento e destaques daquela variação.</small>
              </div>
              <div class="variant-toolbar__body">
                <div class="variant-toolbar__switcher" role="list" aria-label="Variações independentes da zona">
                  <button
                    v-for="(variant, index) in selectedVariantOptions"
                    :key="variant.id"
                    type="button"
                    class="variant-chip"
                    :class="{ 'variant-chip--active': selectedVariant?.id === variant.id }"
                    :aria-pressed="selectedVariant?.id === variant.id"
                    :aria-label="`Editar variação ${index + 1}: ${variantButtonLabel(variant, index)}`"
                    @click="selectVariant(variant.id)"
                  >
                    <strong>{{ index + 1 }}</strong>
                    <span>{{ variantButtonLabel(variant, index) }}</span>
                    <small>{{ variantButtonSummary(variant) }}</small>
                  </button>
                </div>
                <div class="variant-toolbar__controls">
                  <input
                    class="variant-toolbar__name"
                    type="text"
                    :value="selectedVariant?.name || ''"
                    aria-label="Nome da variação"
                    @change="updateSelectedVariantName(($event.target as HTMLInputElement).value)"
                  />
                  <button type="button" class="icon-button" title="Duplicar variação" aria-label="Duplicar variação" @click="duplicateSelectedVariant">
                    <Copy class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    class="icon-button icon-button--danger"
                    title="Excluir variação"
                    aria-label="Excluir variação"
                    :disabled="selectedVariantOptions.length <= 1"
                    @click="removeSelectedVariant"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="selectedStructure.format === 'showcase'" class="card-format-picker">
              <span class="field-label">Cards em destaque</span>
              <div class="card-format-picker__grid">
                <div
                  v-for="index in selectedCount"
                  :key="`showcase-card-${index}`"
                  class="card-format-picker__item"
                  :class="{ 'card-format-picker__item--active': selectedCardIndex === index }"
                >
                  <button
                    type="button"
                    class="card-format-picker__number"
                    :aria-pressed="selectedCardIndex === index"
                    :aria-label="`Selecionar card ${index}`"
                    @click="selectPreviewCard(index)"
                  >
                    {{ index }}
                  </button>
                  <button
                    type="button"
                    class="card-format-picker__highlight"
                    :class="{ 'card-format-picker__highlight--on': effectiveHighlightIndexes.has(index) }"
                    :aria-pressed="effectiveHighlightIndexes.has(index)"
                    :aria-label="effectiveHighlightIndexes.has(index) ? `Remover destaque do card ${index}` : `Marcar card ${index} como destaque`"
                    @click="toggleCardHighlight(index)"
                  >
                    <Sparkles class="h-3 w-3" />
                    {{ effectiveHighlightIndexes.has(index) ? `${selectedStructure.highlightHeight}×` : 'Destaque' }}
                  </button>
                </div>
              </div>
              <small>
                {{ selectedStructure.highlightCount }} card{{ selectedStructure.highlightCount === 1 ? '' : 's' }} em destaque. Toque em "Destaque" para alterar a seleção manual.
              </small>
            </div>

            <label class="field field--number">
              <span>Colunas</span>
              <input type="number" min="0" max="24" :value="selectedStructure.columns" @input="updateSelectedNumber('columns', ($event.target as HTMLInputElement).valueAsNumber, 0, 24)" />
              <small>0 = automático</small>
            </label>

            <label class="field field--number">
              <span>Linhas</span>
              <input type="number" min="0" max="24" :value="selectedStructure.rows" @input="updateSelectedNumber('rows', ($event.target as HTMLInputElement).valueAsNumber, 0, 24)" />
              <small>0 = automático</small>
            </label>

            <label class="field">
              <span>Fluxo</span>
              <select :value="selectedStructure.layoutDirection" @change="updateSelected({ layoutDirection: ($event.target as HTMLSelectElement).value as any })">
                <option v-for="option in layoutDirectionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>

            <label class="field">
              <span>Preenchimento</span>
              <select value="fill" disabled aria-label="Preenchimento automático">
                <option v-for="option in lastRowBehaviorOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <small>Todos os cards ocupam a linha ou coluna disponível, sem espaços vazios.</small>
            </label>

            <label class="field">
              <span>Alinhamento vertical</span>
              <select :value="selectedStructure.verticalAlign" @change="updateSelected({ verticalAlign: ($event.target as HTMLSelectElement).value as any })">
                <option v-for="option in verticalAlignOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>

            <label class="field field--number">
              <span>Padding</span>
              <input type="number" min="0" max="200" :value="selectedStructure.padding" @input="updateSelectedNumber('padding', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
              <small>Espaço interno</small>
            </label>

            <label class="field field--number">
              <span>Gap horizontal</span>
              <input type="number" min="0" max="200" :value="selectedStructure.gapHorizontal" @input="updateSelectedNumber('gapHorizontal', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
            </label>

            <label class="field field--number">
              <span>Gap vertical</span>
              <input type="number" min="0" max="200" :value="selectedStructure.gapVertical" @input="updateSelectedNumber('gapVertical', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
            </label>
            </div>
          </section>

          <div v-if="selectedStructure.format === 'showcase'" class="showcase-settings">
            <div>
              <span class="field-label">Área de destaque</span>
              <p>Defina quantos cards ficam maiores e em qual lado ou faixa.</p>
            </div>
            <input type="range" min="0" :max="selectedCount" :value="selectedStructure.highlightCount" @input="updateSelectedNumber('highlightCount', ($event.target as HTMLInputElement).valueAsNumber, 0, selectedCount)" />
            <strong>{{ selectedStructure.highlightCount }}</strong>
            <label v-if="selectedStructure.highlightCount > 0 || selectedStructure.highlightSelection === 'manual'" class="field">
              <span>Posição dos destaques</span>
              <select :value="selectedStructure.highlightPos" @change="updateSelected({ highlightPos: ($event.target as HTMLSelectElement).value as any })">
                <option v-for="option in highlightPositionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <small>{{ highlightPositionHint }}</small>
            </label>
            <label v-if="selectedStructure.highlightCount > 0 || selectedStructure.highlightSelection === 'manual'" class="field">
              <span>Produtos escolhidos</span>
              <select :value="selectedStructure.highlightSelection" @change="changeHighlightSelection(($event.target as HTMLSelectElement).value)">
                <option v-for="option in highlightSelectionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <small v-if="selectedStructure.highlightSelection === 'manual'">Os cards destacados são escolhidos ao lado de cada número, no bloco "Card que está sendo configurado".</small>
              <small v-else>Define quais itens da lista recebem o tamanho maior.</small>
            </label>
            <label v-if="selectedStructure.highlightCount > 0" class="field field--number">
              <span>Tamanho do destaque</span>
              <input type="number" min="1" max="3" step="0.1" :value="selectedStructure.highlightHeight" @input="updateSelectedNumber('highlightHeight', ($event.target as HTMLInputElement).valueAsNumber, 1, 3)" />
              <small>1× normal · 1,5× maior · 2× muito maior</small>
            </label>
            <div class="showcase-spacing">
              <span class="field-label">Espaçamento dos destaques</span>
              <div class="showcase-spacing__fields">
                <label class="field field--number">
                  <span>Padding do destaque</span>
                  <input type="number" min="0" max="200" :value="selectedStructure.highlightPadding" @input="updateSelectedNumber('highlightPadding', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
                </label>
                <label class="field field--number">
                  <span>Gap horizontal</span>
                  <input type="number" min="0" max="200" :value="selectedStructure.highlightGapHorizontal" @input="updateSelectedNumber('highlightGapHorizontal', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
                </label>
                <label class="field field--number">
                  <span>Gap vertical</span>
                  <input type="number" min="0" max="200" :value="selectedStructure.highlightGapVertical" @input="updateSelectedNumber('highlightGapVertical', ($event.target as HTMLInputElement).valueAsNumber, 0, 200)" />
                </label>
              </div>
              <small>Esses valores valem somente para a área destacada e aparecem imediatamente na prévia.</small>
            </div>
          </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.structure-manager {
  --zone-ink: #172033;
  --zone-heading: #1e293b;
  --zone-muted: #64748b;
  --zone-subtle: #94a3b8;
  --zone-border: #e5e7eb;
  --zone-border-strong: #dbe3ed;
  --zone-primary: #7c3aed;
  --zone-primary-strong: #6d28d9;
  --zone-primary-ink: #5b21b6;
  --zone-primary-soft: #f5f3ff;
  --zone-primary-surface: #faf5ff;
  --zone-primary-border: #ddd6fe;
  min-height: 100vh;
  color: var(--zone-ink);
  background: #f8f9fb;
}
.structure-manager__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 64px;
  border-bottom: 1px solid rgba(226, 232, 240, .9);
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 1px 0 rgba(15, 23, 42, .02);
  backdrop-filter: blur(16px);
}
.structure-manager__topbar-inner,
.structure-manager__main {
  width: min(1380px, calc(100% - 40px));
  margin: 0 auto;
}
.structure-manager__topbar-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 24px;
}
.structure-manager__back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--zone-muted);
  font-size: 13px;
  text-decoration: none;
  transition: color .16s ease;
}
.structure-manager__back:hover { color: var(--zone-primary-ink); }
.structure-manager__secondary-link { color: var(--zone-muted); font-size: 13px; text-decoration: none; transition: color .16s ease; }
.structure-manager__secondary-link:hover { color: var(--zone-primary-ink); }
.structure-manager__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--zone-heading);
  font-size: 14px;
  font-weight: 700;
}
.structure-manager__brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--zone-primary-border);
  border-radius: 9px;
  color: var(--zone-primary);
  background: var(--zone-primary-soft);
}
.structure-manager__topbar-spacer { flex: 1; }
.structure-manager__main { position: relative; padding: 32px 0 60px; }
.structure-manager__main--blocked { min-height: calc(100vh - 64px); }
.structure-manager__loading {
  position: fixed;
  z-index: 10;
  top: 64px;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  border-radius: 14px;
  background: rgba(248, 249, 251, .78);
  backdrop-filter: blur(8px);
}
.structure-manager__loading-card {
  display: grid;
  justify-items: center;
  gap: 10px;
  width: min(100%, 390px);
  padding: 26px;
  border: 1px solid var(--zone-primary-border);
  border-radius: 14px;
  color: var(--zone-heading);
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 18px 40px rgba(76, 29, 149, .12);
  text-align: center;
}
.structure-manager__loading-card strong { font-size: 14px; }
.structure-manager__loading-card small { color: var(--zone-muted); font-size: 12px; line-height: 1.45; }
.structure-manager__loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--zone-primary-border);
  border-top-color: var(--zone-primary);
  border-radius: 50%;
  animation: structure-manager-spin .8s linear infinite;
}
@keyframes structure-manager-spin { to { transform: rotate(360deg); } }
.structure-manager__intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
  padding: 24px 26px;
  border: 1px solid var(--zone-primary-border);
  border-radius: 16px;
  background: linear-gradient(135deg, #fff 0%, var(--zone-primary-surface) 100%);
  box-shadow: 0 12px 28px rgba(76, 29, 149, .06);
}
.eyebrow,
.panel-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: var(--zone-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.structure-manager h1 { margin: 0; color: var(--zone-ink); font-size: clamp(26px, 3vw, 38px); line-height: 1.08; letter-spacing: -.02em; }
.intro-copy { max-width: 680px; margin: 12px 0 0; color: var(--zone-muted); font-size: 14px; line-height: 1.6; }
.structure-manager__actions { display: flex; gap: 10px; flex-shrink: 0; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 15px; border-radius: 9px; border: 1px solid transparent; font-size: 13px; font-weight: 800; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, color .16s ease, transform .16s ease; }
.button:disabled { opacity: .6; cursor: wait; }
.button--primary { color: #fff; background: var(--zone-primary); box-shadow: 0 8px 18px rgba(124, 58, 237, .18); }
.button--primary:hover:not(:disabled) { background: var(--zone-primary-strong); box-shadow: 0 10px 22px rgba(124, 58, 237, .24); transform: translateY(-1px); }
.button--secondary { color: #475569; border-color: var(--zone-border-strong); background: #fff; }
.button--secondary:hover { border-color: #a78bfa; color: var(--zone-primary-ink); background: var(--zone-primary-soft); }
.feedback { display: flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 11px 13px; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; background: #f0fdf4; font-size: 13px; }
.feedback--error { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.structure-manager__workspace { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 20px; align-items: start; }
.count-panel,
.editor-panel { border: 1px solid var(--zone-border); border-radius: 16px; background: #fff; box-shadow: 0 16px 36px rgba(15, 23, 42, .06); }
.count-panel { position: sticky; top: 84px; padding: 16px 12px; }
.panel-heading,
.editor-panel__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.panel-heading { padding: 2px 6px 14px; border-bottom: 1px solid #eef0f4; }
.panel-heading h2,
.editor-panel__heading h2 { margin: 0; color: var(--zone-heading); font-size: 17px; letter-spacing: -.01em; }
.panel-heading > svg { color: var(--zone-primary); }
.count-list { display: grid; gap: 4px; margin-top: 12px; max-height: 680px; overflow: auto; }
.count-item { display: flex; align-items: center; gap: 10px; min-height: 43px; padding: 6px 8px; border: 1px solid transparent; border-radius: 9px; color: var(--zone-muted); background: transparent; text-align: left; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, color .16s ease; }
.count-item:hover { border-color: #ede9fe; background: #faf5ff; }
.count-item--active { border-color: var(--zone-primary-border); color: var(--zone-primary-ink); background: var(--zone-primary-soft); box-shadow: inset 3px 0 0 var(--zone-primary); }
.count-item__number { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 6px; color: #475569; background: #f1f5f9; font-size: 12px; font-weight: 800; }
.count-item--active .count-item__number { color: #fff; background: var(--zone-primary); }
.count-item__copy { display: grid; gap: 2px; min-width: 0; }
.count-item__copy strong { color: inherit; font-size: 12px; line-height: 1; }
.count-item__copy small { overflow: hidden; color: var(--zone-subtle); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.count-item__check { margin-left: auto; color: var(--zone-primary); }
.editor-panel { min-width: 0; padding: 22px; }
.editor-panel__heading { padding-bottom: 18px; border-bottom: 1px solid #eef0f4; }
.editor-panel__heading p { margin: 6px 0 0; color: var(--zone-subtle); font-size: 12px; }
.automatic-badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid var(--zone-primary-border); border-radius: 999px; color: var(--zone-primary-ink); background: var(--zone-primary-soft); font-size: 11px; font-weight: 800; white-space: nowrap; }
.settings-section { display: grid; gap: 14px; margin-top: 24px; padding-top: 22px; border-top: 1px solid #eef0f4; }
.settings-section__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.settings-section__heading h3 { margin: 0; color: var(--zone-heading); font-size: 16px; letter-spacing: -.01em; }
.settings-section__hint { max-width: 360px; color: var(--zone-subtle); font-size: 11px; line-height: 1.4; text-align: right; }
.variant-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-top: 0; padding: 14px; border: 1px solid var(--zone-primary-border); border-radius: 12px; background: linear-gradient(135deg, #faf5ff 0%, #fff 100%); box-shadow: 0 5px 14px rgba(76, 29, 149, .04); }
.variant-toolbar--inline { grid-column: 1 / -1; }
.variant-toolbar__copy { display: grid; gap: 4px; min-width: 0; }
.variant-toolbar__copy small { color: var(--zone-muted); font-size: 10px; line-height: 1.4; }
.variant-toolbar__body { display: grid; gap: 8px; min-width: min(100%, 520px); }
.variant-toolbar__switcher { display: flex; flex-wrap: wrap; gap: 6px; }
.variant-chip { display: grid; grid-template-columns: 24px minmax(80px, 1fr); grid-template-rows: auto auto; align-items: center; gap: 1px 7px; min-width: 132px; padding: 6px 8px; border: 1px solid #d8dee8; border-radius: 8px; color: #475569; background: #fff; text-align: left; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, color .16s ease, transform .16s ease; }
.variant-chip:hover { border-color: #a78bfa; color: var(--zone-primary-ink); background: #fff; box-shadow: 0 4px 10px rgba(124, 58, 237, .08); transform: translateY(-1px); }
.variant-chip > strong { display: grid; grid-row: 1 / span 2; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: var(--zone-primary-ink); background: var(--zone-primary-soft); font-size: 11px; }
.variant-chip > span { overflow: hidden; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.variant-chip > small { overflow: hidden; color: var(--zone-subtle); font-size: 9px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.variant-chip--active { border-color: var(--zone-primary); color: #fff; background: var(--zone-primary); box-shadow: 0 7px 14px rgba(124, 58, 237, .2); }
.variant-chip--active > strong { color: var(--zone-primary); background: #fff; }
.variant-chip--active > small { color: #ede9fe; }
.variant-toolbar__controls { display: grid; grid-template-columns: minmax(150px, 1fr) auto auto; gap: 6px; min-width: 0; }
.variant-toolbar__select,
.variant-toolbar__name { width: 100%; height: 34px; padding: 0 9px; border: 1px solid #d8dee8; border-radius: 8px; outline: none; color: #334155; background: #fff; font-size: 11px; }
.variant-toolbar__select:focus,
.variant-toolbar__name:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167, 139, 250, .16); }
.icon-button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #d8dee8; border-radius: 8px; color: var(--zone-primary-ink); background: #fff; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, color .16s ease, transform .16s ease; }
.icon-button:hover:not(:disabled) { border-color: #a78bfa; background: var(--zone-primary-soft); transform: translateY(-1px); }
.icon-button--danger { color: #b91c1c; }
.icon-button--danger:hover:not(:disabled) { border-color: #fca5a5; background: #fef2f2; }
.icon-button:disabled { opacity: .45; cursor: not-allowed; }
.flyer-preview { display: grid; gap: 14px; margin-top: 20px; padding: 18px; border: 1px solid var(--zone-border); border-radius: 14px; background: #fbfbfd; }
.flyer-preview__heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.flyer-preview__heading h3 { margin: 0; color: var(--zone-heading); font-size: 16px; letter-spacing: -.01em; }
.flyer-preview__heading p { max-width: 560px; margin: 5px 0 0; color: var(--zone-muted); font-size: 11px; line-height: 1.45; }
.flyer-preview__tools { display: flex; align-items: flex-end; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
.flyer-preview__format-picker { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
.flyer-preview__format-button { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; align-items: center; gap: 2px 6px; min-width: 68px; padding: 7px 8px; border: 1px solid var(--zone-border-strong); border-radius: 8px; color: var(--zone-muted); background: #fff; font-size: 10px; font-weight: 800; text-align: left; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, color .16s ease; }
.flyer-preview__format-button:hover { border-color: #a78bfa; color: var(--zone-primary-ink); background: var(--zone-primary-soft); }
.flyer-preview__format-button small { grid-column: 2; color: var(--zone-subtle); font-size: 9px; font-weight: 700; }
.flyer-preview__format-button--active { border-color: var(--zone-primary); color: #fff; background: var(--zone-primary); box-shadow: 0 5px 12px rgba(124, 58, 237, .2); }
.flyer-preview__format-button--active small { color: #ede9fe; }
.flyer-preview__zoom-picker { display: grid; gap: 4px; min-width: 138px; padding: 6px 8px 7px; border: 1px solid var(--zone-border-strong); border-radius: 8px; color: var(--zone-muted); background: #fff; font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.flyer-preview__zoom-picker select { width: 100%; min-height: 22px; border: 0; outline: none; color: var(--zone-heading); background: transparent; font-size: 11px; font-weight: 800; text-transform: none; cursor: pointer; }
.flyer-preview__viewport { display: flex; align-items: flex-start; justify-content: center; min-width: 0; min-height: 280px; padding: clamp(18px, 3vw, 34px); overflow: auto; border: 1px solid #27272a; border-radius: 11px; background-color: #1a1a1a; background-image: radial-gradient(rgba(255, 255, 255, .08) .8px, transparent .8px); background-size: 18px 18px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .03), inset 0 12px 30px rgba(0, 0, 0, .16); scrollbar-color: #71717a #27272a; }
.flyer-preview__viewport--real { justify-content: flex-start; height: min(72vh, 760px); max-height: 760px; scrollbar-gutter: stable; }
.flyer-preview__page { display: flex; flex: 0 0 auto; flex-direction: column; width: min(100%, 420px); min-width: 0; min-height: 0; overflow: hidden; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; box-shadow: 0 24px 60px rgba(0, 0, 0, .34); }
.flyer-preview__page-meta { display: flex; flex: 0 0 auto; justify-content: space-between; gap: 10px; margin-bottom: 7px; color: #64748b; font-size: 8px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.flyer-preview__safe-area { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 5px; background: #f8fafc; }
.flyer-preview__zone-label { display: flex; flex: 0 0 auto; justify-content: space-between; gap: 10px; margin-bottom: 5px; color: #64748b; font-size: 8px; font-weight: 800; }
.flyer-preview__safe-area .preview-stage { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; margin: 0; padding: 10px; border-color: var(--zone-border-strong); background: #fff; }
.flyer-preview__safe-area .preview-canvas { flex: 1 1 auto; height: auto; min-height: 0; }
.preview-stage { margin: 20px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 9px; background: #f8fafc; }
.preview-toolbar { display: flex; justify-content: space-between; margin-bottom: 10px; color: var(--zone-muted); font-size: 11px; font-weight: 700; }
.preview-canvas { flex: 1 1 auto; min-height: 230px; overflow: hidden; border: 1px solid #1e293b; border-radius: 8px; background: #172033; }
.preview-grid,
.preview-featured { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.preview-line { container-type: size; display: flex; flex: 1 1 0; width: 100%; min-width: 0; min-height: 0; }
.preview-featured__area { min-width: 0; min-height: 0; }
.preview-featured__grid { container-type: size; display: grid; width: 100%; height: 100%; min-width: 0; min-height: 0; }
.preview-featured--reverse .preview-featured__area--featured { order: 2; }
.preview-featured--reverse .preview-featured__area--regular { order: 1; }
.preview-cell { display: flex; align-items: stretch; justify-content: center; box-sizing: border-box; min-width: 0; min-height: 0; overflow: hidden; padding: 0; border: 1px solid rgba(124, 58, 237, .22); border-radius: 5px; color: var(--zone-ink); background: #e2e8f0; font: inherit; font-size: 11px; font-weight: 800; }
.preview-cell--highlight { border-color: #fbbf24; background: #fef3c7; }
.preview-cell--selectable,
.preview-cell--editing { cursor: pointer; }
.preview-cell--selectable:hover { filter: brightness(1.08); }
.preview-cell--editing { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.preview-product-card { container-type: inline-size; position: relative; display: flex; flex: 1 1 auto; flex-direction: column; align-items: stretch; box-sizing: border-box; width: 100%; height: 100%; min-width: 0; min-height: 0; gap: 4px; padding: 5px; overflow: hidden; border-top: 3px solid var(--preview-accent, #1558a6); color: #172033; background: #fff; text-align: left; }
.preview-product-card__index { position: absolute; top: 4px; right: 4px; display: grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; color: #fff; background: #172033; font-size: 8px; font-weight: 900; line-height: 1; }
.preview-product-card__name { display: -webkit-box; flex: 0 0 auto; min-width: 0; padding-right: 18px; overflow: hidden; color: #172033; font-size: 8px; font-weight: 900; line-height: 1.05; text-overflow: ellipsis; text-transform: uppercase; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.preview-product-card__image { display: flex; flex: 1 1 0; align-items: center; justify-content: center; min-height: 0; overflow: hidden; padding: 1px 0; }
.preview-product-card__image img { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(15, 23, 42, .16)); }
.preview-product-card__offer { display: inline-flex; flex: 0 0 auto; align-items: baseline; align-self: center; justify-content: center; box-sizing: border-box; max-width: 100%; min-width: 0; padding: 3px 5px 4px; overflow: hidden; border-radius: 4px; color: #fff; background: #e31b2d; font-weight: 900; line-height: .85; white-space: nowrap; }
.preview-product-card__currency { margin-right: 2px; font-size: 8px; }
.preview-product-card__offer strong { font-size: 18px; letter-spacing: 0; }
.preview-product-card__offer sup { position: relative; top: -.22em; margin-left: 1px; font-size: 10px; }
.preview-product-card__offer small { margin-left: 3px; font-size: 8px; }
.preview-product-card--highlight { border-top-color: #e11d48; }
@container (min-width: 72px) {
  .preview-product-card { gap: 5px; padding: 7px; }
  .preview-product-card__index { width: 20px; height: 20px; font-size: 9px; }
  .preview-product-card__name { padding-right: 23px; font-size: 10px; line-height: 1.08; }
  .preview-product-card__offer { padding: 4px 7px 5px; }
  .preview-product-card__currency { font-size: 10px; }
  .preview-product-card__offer strong { font-size: 24px; }
  .preview-product-card__offer sup { font-size: 13px; }
  .preview-product-card__offer small { font-size: 10px; }
}
@container (min-width: 150px) {
  .preview-product-card { gap: 7px; padding: 10px; border-top-width: 5px; }
  .preview-product-card__index { top: 7px; right: 7px; width: 24px; height: 24px; font-size: 10px; }
  .preview-product-card__name { padding-right: 28px; font-size: 13px; line-height: 1.1; }
  .preview-product-card__offer { padding: 6px 10px 7px; border-radius: 6px; }
  .preview-product-card__currency { font-size: 13px; }
  .preview-product-card__offer strong { font-size: 34px; }
  .preview-product-card__offer sup { font-size: 17px; }
  .preview-product-card__offer small { font-size: 12px; }
}
@container (max-width: 71px) {
  .preview-product-card__offer small { display: none; }
}
.preview-summary { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 10px; color: var(--zone-muted); font-size: 10px; }
.preview-summary span + span::before { content: '·'; margin-right: 12px; color: #cbd5e1; }
.field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 14px; border: 1px solid #eef0f4; border-radius: 12px; background: #f8f9fb; }
.field { display: grid; gap: 6px; min-width: 0; padding: 11px; border: 1px solid #edf0f4; border-radius: 9px; background: #fff; }
.field > span,
.field-label { color: #475569; font-size: 11px; font-weight: 800; }
.field small { color: var(--zone-subtle); font-size: 10px; line-height: 1.35; }
.field select,
.field input[type="number"] { width: 100%; height: 36px; padding: 0 10px; border: 1px solid var(--zone-border-strong); border-radius: 8px; outline: none; color: #334155; background: #fff; font-size: 12px; transition: border-color .16s ease, box-shadow .16s ease; }
.field select:focus,
.field input[type="number"]:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167, 139, 250, .16); }
.field select:disabled,
.field input:disabled { color: #94a3b8; background: #f8fafc; cursor: not-allowed; }
.showcase-settings { display: grid; grid-template-columns: minmax(170px, 1fr) minmax(160px, 1.6fr) 28px minmax(130px, .7fr) minmax(100px, .5fr); align-items: end; gap: 14px; margin-top: 20px; padding: 18px; border: 1px solid #fde68a; border-radius: 12px; background: #fffbeb; }
.showcase-settings p { margin: 5px 0 0; color: #78716c; font-size: 11px; line-height: 1.4; }
.showcase-settings input[type="range"] { width: 100%; accent-color: var(--zone-primary); }
.showcase-settings > strong { color: var(--zone-primary-ink); font-size: 15px; text-align: center; }
.showcase-spacing { display: grid; grid-column: 1 / -1; gap: 8px; min-width: 0; padding-top: 12px; border-top: 1px solid #f1e8c8; }
.showcase-spacing__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.card-format-picker { display: grid; grid-column: 1 / -1; gap: 7px; min-width: 0; padding: 12px; border: 1px solid #fde68a; border-radius: 10px; background: #fffdf3; }
.card-format-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 5px; max-height: 172px; overflow: auto; padding: 1px; }
.card-format-picker__item { display: flex; flex-direction: column; min-width: 0; gap: 4px; }
.card-format-picker__number { min-height: 28px; border: 1px solid var(--zone-border-strong); border-radius: 7px; color: var(--zone-muted); background: #fff; font-size: 11px; font-weight: 800; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, color .16s ease; }
.card-format-picker__number:hover { border-color: #a78bfa; color: var(--zone-primary-ink); background: var(--zone-primary-soft); }
.card-format-picker__item--active .card-format-picker__number { border-color: var(--zone-primary); color: #fff; background: var(--zone-primary); }
.card-format-picker__highlight { display: inline-flex; align-items: center; justify-content: center; gap: 3px; min-height: 22px; padding: 2px 6px; border: 1px solid #e2e8f0; border-radius: 999px; color: var(--zone-subtle); background: #fff; font-size: 9px; font-weight: 800; white-space: nowrap; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, color .16s ease; }
.card-format-picker__highlight:hover { border-color: #fbbf24; color: #92400e; }
.card-format-picker__highlight--on { border-color: #fbbf24; color: #92400e; background: #fef3c7; }
.structure-manager :is(a, button, select, input):focus-visible { outline: 3px solid rgba(124, 58, 237, .24); outline-offset: 2px; }
@media (max-width: 900px) {
  .structure-manager__intro { align-items: flex-start; flex-direction: column; }
  .structure-manager__actions { width: 100%; }
  .button { flex: 1; }
  .structure-manager__workspace { grid-template-columns: 1fr; }
  .count-panel { position: static; }
  .count-list { grid-template-columns: repeat(4, minmax(0, 1fr)); max-height: none; }
  .count-item { justify-content: center; padding: 7px 4px; }
  .count-item__copy, .count-item__check { display: none; }
  .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .showcase-settings { grid-template-columns: 1fr 1fr; }
  .showcase-spacing__fields { grid-template-columns: 1fr; }
  .variant-toolbar { align-items: stretch; flex-direction: column; }
  .variant-toolbar__body { min-width: 0; }
  .variant-toolbar__controls { min-width: 0; }
  .settings-section__heading { align-items: flex-start; flex-direction: column; }
  .settings-section__hint { max-width: none; text-align: left; }
  .flyer-preview__heading { align-items: flex-start; flex-direction: column; }
  .flyer-preview__tools { width: 100%; justify-content: space-between; }
  .flyer-preview__format-picker { justify-content: flex-start; }
  .card-format-picker { grid-column: 1 / -1; }
  .card-format-picker__grid { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
  .showcase-settings > strong { text-align: left; }
}
@media (max-width: 560px) {
  .structure-manager__topbar-inner,
  .structure-manager__main { width: min(100% - 24px, 1380px); }
  .structure-manager__main { padding-top: 26px; }
  .structure-manager__topbar { height: 56px; }
  .structure-manager__brand { font-size: 12px; }
  .structure-manager__back span { display: none; }
  .structure-manager__secondary-link { display: none; }
  .editor-panel { padding: 15px; }
  .editor-panel__heading { flex-direction: column; }
  .flyer-preview { padding: 14px; }
  .flyer-preview__tools { align-items: stretch; flex-direction: column; }
  .flyer-preview__zoom-picker { width: 100%; }
  .flyer-preview__viewport--real { height: min(68vh, 560px); }
  .flyer-preview__viewport { padding: 10px; }
  .flyer-preview__page-meta { font-size: 8px; }
  .flyer-preview__format-button { min-width: 60px; padding: 6px; }
  .field-grid { grid-template-columns: 1fr; }
  .count-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .intro-copy { font-size: 13px; }
  .variant-chip { flex: 1 1 118px; min-width: 0; }
}

/* Editor shell: the structure manager uses the same stage / inspector rhythm
   as the canvas editor instead of behaving like a long settings page. */
.structure-manager {
  height: 100vh;
  overflow: hidden;
  background: #111827;
}
.structure-manager__topbar {
  border-bottom-color: #2b3244;
  background: #151a2a;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .03);
}
.structure-manager__back,
.structure-manager__secondary-link { color: #a1a1aa; }
.structure-manager__back:hover,
.structure-manager__secondary-link:hover { color: #c4b5fd; }
.structure-manager__brand { color: #f8fafc; }
.structure-manager__brand-mark {
  border-color: rgba(167, 139, 250, .34);
  color: #c4b5fd;
  background: rgba(124, 58, 237, .18);
}
.structure-manager__main {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  height: calc(100vh - 64px);
  min-height: 0;
  padding: 16px 18px 18px;
  overflow: hidden;
}
.structure-manager__intro {
  flex: 0 0 auto;
  margin-bottom: 12px;
  padding: 15px 18px;
  border-color: #2b3244;
  border-radius: 12px;
  background: #171b2b;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .16);
}
.structure-manager__intro .eyebrow { margin-bottom: 6px; }
.structure-manager__intro .eyebrow { color: #c4b5fd; }
.structure-manager h1 { color: #f8fafc; font-size: clamp(22px, 2.4vw, 32px); }
.intro-copy { max-width: 940px; margin-top: 7px; color: #a1a1aa; line-height: 1.45; }
.structure-manager__actions .button { min-height: 36px; }
.structure-manager__actions .button--secondary {
  border-color: #41475a;
  color: #d4d4d8;
  background: #202637;
}
.structure-manager__actions .button--secondary:hover {
  border-color: #8b5cf6;
  color: #ede9fe;
  background: #2a2442;
}
.feedback { flex: 0 0 auto; margin-bottom: 12px; }
.structure-manager__workspace {
  flex: 1 1 auto;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}
.count-panel,
.editor-panel {
  height: 100%;
  min-height: 0;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
}
.count-panel {
  position: static;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  border-color: #2b3244;
  color: #d4d4d8;
  background: #171b2b;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .16);
}
.panel-heading { flex: 0 0 auto; padding: 2px 4px 12px; border-bottom-color: #2b3244; }
.panel-heading h2 { color: #f8fafc; }
.panel-heading > svg { color: #a78bfa; }
.count-list { flex: 1 1 auto; min-height: 0; max-height: none; overflow-y: auto; }
.count-item { color: #a1a1aa; }
.count-item:hover { border-color: rgba(167, 139, 250, .34); background: #22263a; }
.count-item--active {
  border-color: rgba(167, 139, 250, .52);
  color: #ede9fe;
  background: rgba(124, 58, 237, .2);
  box-shadow: inset 3px 0 0 #8b5cf6;
}
.count-item__number { color: #d4d4d8; background: #252b3a; }
.count-item--active .count-item__number { color: #fff; background: #7c3aed; }
.count-item__copy small { color: #71717a; }
.count-item__check { color: #a78bfa; }
.editor-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border-color: #2b3244;
  background: #111827;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .16);
}
.editor-panel__heading {
  grid-column: 1 / -1;
  padding: 13px 16px;
  border-bottom-color: #2b3244;
  background: #1a1f2d;
}
.editor-panel__heading h2 { color: #f8fafc; }
.editor-panel__heading p { color: #94a3b8; }
.automatic-badge {
  border-color: rgba(167, 139, 250, .34);
  color: #c4b5fd;
  background: rgba(124, 58, 237, .18);
}
.flyer-preview {
  grid-column: 1;
  grid-row: 2 / span 2;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 16px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #1a1a1a;
}
.flyer-preview__heading { align-items: flex-start; }
.flyer-preview__heading h3 { color: #f8fafc; }
.flyer-preview__heading p { color: #a1a1aa; }
.flyer-preview .panel-kicker { color: #a78bfa; }
.flyer-preview__viewport,
.flyer-preview__viewport--real {
  align-self: stretch;
  height: auto;
  max-height: none;
  min-height: 0;
  padding: clamp(18px, 3vw, 34px);
  border-color: #27272a;
  background-color: #1a1a1a;
}
.settings-section {
  grid-column: 2;
  grid-row: 2;
  display: block;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 18px;
  overflow-y: auto;
  border: 0;
  border-left: 1px solid #d8dee8;
  border-radius: 0;
  background: #fff;
}
.settings-section__heading { align-items: flex-start; }
.settings-section__hint { max-width: 180px; }
.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
}
.field { padding: 10px; }
.variant-toolbar { flex-direction: column; gap: 10px; }
.variant-toolbar__body { min-width: 0; }
.showcase-settings {
  grid-column: 2;
  grid-row: 3;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 14px 18px;
  border-radius: 0;
  border-right: 0;
  border-bottom: 0;
  border-left: 1px solid #f1e8c8;
}
.showcase-spacing__fields { grid-template-columns: 1fr; }

@media (max-width: 900px) {
  .structure-manager {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .structure-manager__main {
    height: auto;
    min-height: calc(100vh - 64px);
    padding: 14px 12px 24px;
    overflow: visible;
  }
  .structure-manager__intro {
    padding: 15px 16px;
  }
  .intro-copy {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .structure-manager__workspace {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .count-panel {
    height: auto;
    max-height: 190px;
  }
  .count-list { flex: 0 0 auto; max-height: 128px; }
  .editor-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .editor-panel__heading { grid-column: 1; grid-row: 1; }
  .flyer-preview {
    grid-column: 1;
    grid-row: 2;
    min-height: 560px;
  }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real { height: min(65vh, 560px); }
  .settings-section {
    grid-column: 1;
    grid-row: 3;
    overflow: visible;
    border-top: 1px solid #d8dee8;
    border-left: 0;
  }
  .showcase-settings {
    grid-column: 1;
    grid-row: 4;
    border-top: 1px solid #f1e8c8;
    border-left: 0;
  }
  .settings-section__hint { max-width: none; }
}

@media (max-width: 560px) {
  .structure-manager__main { min-height: calc(100vh - 56px); }
  .structure-manager__intro { margin-bottom: 10px; padding: 14px; }
  .intro-copy { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
  .editor-panel__heading { padding: 13px 14px; }
  .flyer-preview { min-height: 470px; padding: 12px; }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real { height: min(60vh, 460px); padding: 12px; }
  .settings-section { padding: 14px; }
  .showcase-settings { padding: 14px; }
}

/* Keep the responsive version an editor too: the recipe rail stays beside
   the stage, while the inspector becomes a scrollable lower panel. */
@media (max-width: 900px) {
  .structure-manager {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .structure-manager__main {
    height: auto;
    min-height: calc(100vh - 64px);
    padding: 12px;
    overflow: visible;
  }
  .structure-manager__intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px 16px;
    padding: 12px 14px;
  }
  .structure-manager h1 { font-size: clamp(18px, 3.6vw, 24px); }
  .intro-copy {
    display: -webkit-box;
    margin-top: 5px;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
  .structure-manager__actions {
    width: auto;
    gap: 8px;
  }
  .structure-manager__actions .button {
    flex: none;
    min-height: 34px;
    padding: 0 10px;
    font-size: 11px;
    white-space: nowrap;
  }
  .structure-manager__workspace {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: 104px minmax(0, 1fr);
    grid-template-rows: auto;
    gap: 10px;
    min-height: 0;
  }
  .count-panel {
    position: sticky;
    top: 76px;
    height: calc(100vh - 90px);
    max-height: calc(100vh - 90px);
    padding: 10px 7px;
  }
  .panel-heading {
    align-items: center;
    padding: 2px 3px 10px;
  }
  .panel-heading h2 { font-size: 12px; }
  .panel-heading .panel-kicker { font-size: 8px; }
  .count-list {
    grid-template-columns: 1fr;
    min-height: 0;
    max-height: none;
    overflow-y: auto;
  }
  .count-item {
    justify-content: center;
    min-height: 36px;
    padding: 5px 4px;
  }
  .editor-panel {
    height: auto;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    overflow: visible;
  }
  .editor-panel__heading {
    grid-column: 1;
    grid-row: 1;
    padding: 11px 13px;
  }
  .editor-panel__heading h2 { font-size: 15px; }
  .editor-panel__heading p { font-size: 10px; }
  .automatic-badge { padding: 6px 8px; font-size: 10px; }
  .flyer-preview {
    grid-column: 1;
    grid-row: 2;
    min-height: 460px;
    padding: 11px;
  }
  .flyer-preview__heading { gap: 8px; }
  .flyer-preview__heading h3 { font-size: 14px; }
  .flyer-preview__heading p { display: none; }
  .flyer-preview__tools { gap: 7px; }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real {
    height: min(65vh, 560px);
    min-height: 360px;
    padding: 12px;
  }
  .settings-section {
    grid-column: 1;
    grid-row: 3;
    min-height: 0;
    max-height: none;
    overflow: visible;
    border-top: 1px solid #d8dee8;
    border-left: 0;
  }
  .showcase-settings {
    grid-column: 1;
    grid-row: 4;
    max-height: 240px;
    overflow-y: auto;
    border-top: 1px solid #f1e8c8;
    border-left: 0;
  }
}

@media (max-width: 560px) {
  .structure-manager__topbar { height: 56px; }
  .structure-manager__main {
    height: auto;
    min-height: calc(100vh - 56px);
    padding: 8px;
    overflow: visible;
  }
  .structure-manager__intro {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-bottom: 8px;
    padding: 10px 12px;
  }
  .intro-copy { display: none; }
  .structure-manager__actions { width: 100%; }
  .structure-manager__actions .button { flex: 1; }
  .structure-manager__workspace { grid-template-columns: 84px minmax(0, 1fr); gap: 8px; }
  .count-panel { top: 68px; height: calc(100vh - 80px); max-height: calc(100vh - 80px); }
  .editor-panel__heading { padding: 10px; }
  .flyer-preview { padding: 8px; }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real { padding: 8px; }
  .settings-section { padding: 12px; }
}

/* Final studio layout. The previous rules keep the component readable when
   styles are inspected in isolation; these rules define the actual editor
   shell and keep the preview, recipe rail and inspector in one workspace. */
.structure-manager {
  --zone-ink: #172033;
  --zone-heading: #f8fafc;
  --zone-muted: #a1a1aa;
  --zone-subtle: #71717a;
  --zone-border: #2b3244;
  --zone-border-strong: #41475a;
  --zone-primary: #8b5cf6;
  --zone-primary-strong: #7c3aed;
  --zone-primary-ink: #6d28d9;
  --zone-primary-soft: #f5f3ff;
  --zone-primary-surface: #1a1530;
  --zone-primary-border: rgba(167, 139, 250, .34);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  min-height: 100vh;
  overflow: hidden;
  color: #e4e4e7;
  background:
    radial-gradient(circle at 76% -12%, rgba(124, 58, 237, .16), transparent 34%),
    #0b0f19;
}
.structure-manager__topbar {
  position: relative;
  z-index: 20;
  flex: 0 0 62px;
  height: 62px;
  border-bottom: 1px solid #252b3a;
  background: rgba(15, 20, 32, .94);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .16);
  backdrop-filter: blur(18px);
}
.structure-manager__topbar-inner,
.structure-manager__main {
  width: 100%;
  max-width: none;
  margin: 0;
}
.structure-manager__topbar-inner {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 22px;
  height: 100%;
  padding: 0 clamp(14px, 2.2vw, 32px);
}
.structure-manager__back,
.structure-manager__secondary-link {
  color: #a1a1aa;
  font-size: 12px;
}
.structure-manager__back {
  gap: 7px;
  transition: color .16s ease, transform .16s ease;
}
.structure-manager__back:hover {
  color: #ede9fe;
  transform: translateX(-2px);
}
.structure-manager__secondary-link:hover { color: #c4b5fd; }
.structure-manager__brand {
  gap: 9px;
  color: #f8fafc;
  font-size: 13px;
  letter-spacing: -.01em;
}
.structure-manager__brand-mark {
  width: 29px;
  height: 29px;
  border-color: rgba(167, 139, 250, .38);
  border-radius: 9px;
  color: #c4b5fd;
  background: rgba(124, 58, 237, .2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .04), 0 4px 14px rgba(124, 58, 237, .16);
}
.structure-manager__topbar-spacer { flex: 1 1 auto; }
.structure-manager__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
  padding: 14px clamp(12px, 1.7vw, 24px) 16px;
  overflow: hidden;
}
.structure-manager__intro {
  flex: 0 0 auto;
  align-items: center;
  min-height: 76px;
  margin-bottom: 10px;
  padding: 14px 18px;
  border: 1px solid #292f41;
  border-radius: 13px;
  background:
    linear-gradient(110deg, rgba(29, 35, 53, .96), rgba(24, 27, 45, .9)),
    #171b2b;
  box-shadow: 0 12px 28px rgba(0, 0, 0, .18), inset 0 1px 0 rgba(255, 255, 255, .03);
}
.structure-manager__intro .eyebrow {
  margin-bottom: 5px;
  color: #c4b5fd;
}
.structure-manager h1 {
  color: #fafafa;
  font-size: clamp(21px, 2.2vw, 30px);
  letter-spacing: -.035em;
}
.intro-copy {
  max-width: 890px;
  margin-top: 6px;
  color: #a1a1aa;
  font-size: 12px;
  line-height: 1.4;
}
.structure-manager__actions { gap: 8px; }
.structure-manager__actions .button {
  min-height: 35px;
  border-radius: 8px;
  font-size: 11px;
}
.structure-manager__actions .button--secondary {
  border-color: #41475a;
  color: #d4d4d8;
  background: #202637;
}
.structure-manager__actions .button--secondary:hover {
  border-color: #8b5cf6;
  color: #ede9fe;
  background: #2a2442;
}
.structure-manager__actions .button--primary {
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  box-shadow: 0 8px 18px rgba(124, 58, 237, .26);
}
.structure-manager__actions .button--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
}
.feedback {
  flex: 0 0 auto;
  margin: 0 0 10px;
  padding: 9px 12px;
  border-color: rgba(74, 222, 128, .3);
  border-radius: 8px;
  color: #bbf7d0;
  background: rgba(22, 101, 52, .2);
  font-size: 11px;
}
.feedback--error {
  border-color: rgba(248, 113, 113, .32);
  color: #fecaca;
  background: rgba(127, 29, 29, .22);
}
.structure-manager__workspace {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: 218px minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  align-items: stretch;
}
.count-panel,
.editor-panel {
  min-width: 0;
  min-height: 0;
  border: 1px solid #292f41;
  border-radius: 13px;
  box-shadow: 0 16px 34px rgba(0, 0, 0, .2);
}
.count-panel {
  position: static;
  display: flex;
  flex-direction: column;
  height: auto;
  padding: 12px 9px;
  overflow: hidden;
  color: #d4d4d8;
  background: #151a2a;
}
.panel-heading {
  flex: 0 0 auto;
  padding: 3px 6px 11px;
  border-bottom-color: #2b3244;
}
.panel-heading h2,
.editor-panel__heading h2 {
  color: #f8fafc;
}
.panel-heading h2 { font-size: 14px; }
.panel-heading .panel-kicker { color: #a78bfa; }
.panel-heading > svg { color: #a78bfa; }
.count-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  margin-top: 9px;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-color: #41475a transparent;
}
.count-item {
  min-height: 39px;
  padding: 5px 7px;
  border-color: transparent;
  border-radius: 8px;
  color: #a1a1aa;
}
.count-item:hover {
  border-color: rgba(167, 139, 250, .28);
  color: #ede9fe;
  background: #22263a;
}
.count-item--active {
  border-color: rgba(167, 139, 250, .48);
  color: #ede9fe;
  background: rgba(124, 58, 237, .2);
  box-shadow: inset 3px 0 0 #8b5cf6, 0 4px 12px rgba(0, 0, 0, .12);
}
.count-item__number {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: #d4d4d8;
  background: #252b3a;
}
.count-item--active .count-item__number { background: #7c3aed; }
.count-item__copy strong { font-size: 11px; }
.count-item__copy small { color: #71717a; font-size: 9px; }
.count-item__check { color: #a78bfa; }
.editor-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(350px, 390px);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: auto;
  overflow: hidden;
  border-color: #292f41;
  background: #111827;
}
.editor-panel__heading {
  grid-column: 1 / -1;
  flex: 0 0 auto;
  padding: 11px 15px;
  border-bottom-color: #2b3244;
  background: #171c2c;
}
.editor-panel__heading .panel-kicker { color: #a78bfa; }
.editor-panel__heading p {
  margin-top: 5px;
  color: #94a3b8;
  font-size: 10px;
}
.automatic-badge {
  padding: 6px 9px;
  border-color: rgba(167, 139, 250, .34);
  color: #c4b5fd;
  background: rgba(124, 58, 237, .18);
  font-size: 10px;
}
.flyer-preview {
  grid-column: 1;
  grid-row: 2 / span 2;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 14px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(circle at 50% -20%, rgba(124, 58, 237, .12), transparent 46%),
    #0f1420;
}
.flyer-preview__heading {
  align-items: flex-start;
  min-width: 0;
  gap: 12px;
}
.flyer-preview__heading h3 {
  color: #f8fafc;
  font-size: 14px;
}
.flyer-preview__heading p {
  max-width: 420px;
  margin-top: 4px;
  color: #858997;
  font-size: 10px;
}
.flyer-preview .panel-kicker { color: #a78bfa; }
.flyer-preview__tools {
  align-items: flex-start;
  gap: 7px;
}
.flyer-preview__format-picker {
  justify-content: flex-end;
  gap: 4px;
}
.flyer-preview__format-button {
  min-width: 57px;
  padding: 6px 7px;
  border-color: #353c50;
  border-radius: 7px;
  color: #a1a1aa;
  background: #171c2a;
  font-size: 9px;
}
.flyer-preview__format-button:hover {
  border-color: #8b5cf6;
  color: #ede9fe;
  background: #27213d;
}
.flyer-preview__format-button small { color: #71717a; font-size: 8px; }
.flyer-preview__format-button--active {
  border-color: #8b5cf6;
  color: #fff;
  background: #6d28d9;
  box-shadow: 0 6px 14px rgba(124, 58, 237, .24);
}
.flyer-preview__format-button--active small { color: #ede9fe; }
.flyer-preview__zoom-picker {
  min-width: 122px;
  padding: 6px 8px;
  border-color: #353c50;
  border-radius: 7px;
  color: #858997;
  background: #171c2a;
}
.flyer-preview__zoom-picker select { color: #f4f4f5; }
.flyer-preview__viewport {
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: auto;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  padding: clamp(16px, 2.5vw, 30px);
  overflow: auto;
  border: 1px solid #292f41;
  border-radius: 10px;
  background-color: #0c1019;
  background-image:
    linear-gradient(rgba(255, 255, 255, .025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, .025) 1px, transparent 1px),
    radial-gradient(circle, rgba(167, 139, 250, .08) 1px, transparent 1px);
  background-position: center, center, 0 0;
  background-size: 32px 32px, 32px 32px, 16px 16px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .02), inset 0 16px 30px rgba(0, 0, 0, .2);
  scrollbar-color: #4b5563 #171c2a;
}
.flyer-preview__viewport--fit { overflow: hidden; }
.flyer-preview__viewport--real {
  align-items: flex-start;
  justify-content: flex-start;
  scrollbar-gutter: stable;
}
.flyer-preview__page {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 26px 70px rgba(0, 0, 0, .46), 0 0 0 1px rgba(255, 255, 255, .08);
}
.flyer-preview__page-meta {
  min-width: 0;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 7px;
}
.flyer-preview__page-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flyer-preview__safe-area {
  box-sizing: border-box;
  overflow: hidden;
  border-color: #cbd5e1;
  background: #f8fafc;
}
.flyer-preview__zone-label {
  margin-bottom: 4px;
  color: #64748b;
  font-size: 7px;
}
.flyer-preview__safe-area .preview-stage {
  min-height: 0;
  margin: 0;
  padding: 8px;
  overflow: hidden;
  border-color: #dbe3ed;
  border-radius: 7px;
  background: #fff;
}
.flyer-preview__safe-area .preview-canvas { min-height: 0; }
.preview-toolbar {
  flex: 0 0 auto;
  margin-bottom: 7px;
  color: #64748b;
  font-size: 8px;
}
.preview-toolbar__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #7c3aed;
  font-weight: 800;
}
.preview-canvas {
  min-height: 0;
  border-color: #293348;
  border-radius: 7px;
  background:
    radial-gradient(circle at 16% 10%, rgba(124, 58, 237, .18), transparent 36%),
    #151d2d;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .03);
}
.preview-cell {
  border-color: rgba(139, 92, 246, .28);
  border-radius: 6px;
  background: #dbe4ef;
  transition: border-color .16s ease, box-shadow .16s ease, filter .16s ease;
}
.preview-cell:hover { border-color: rgba(167, 139, 250, .72); }
.preview-cell--highlight {
  border-color: #fbbf24;
  background: #fef3c7;
  box-shadow: 0 0 0 1px rgba(251, 191, 36, .18), 0 5px 12px rgba(251, 191, 36, .12);
}
.preview-cell--editing {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}
.preview-product-card {
  border-top-color: var(--preview-accent, #1558a6);
  border-radius: 5px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .04);
}
.preview-product-card__index { background: #172033; }
.preview-product-card__offer {
  border-radius: 4px;
  background: linear-gradient(135deg, #ef233c, #c81d38);
  box-shadow: 0 3px 7px rgba(190, 24, 60, .2);
}
.preview-summary {
  gap: 5px 10px;
  margin-top: 7px;
  color: #858997;
  font-size: 9px;
}
.preview-summary span + span::before { color: #4b5563; }
.settings-section {
  grid-column: 2;
  grid-row: 2;
  display: block;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 16px;
  overflow-y: auto;
  border: 0;
  border-left: 1px solid #d8dee8;
  border-radius: 0;
  background: #f7f8fb;
  scrollbar-color: #cbd5e1 transparent;
}
.settings-section__heading {
  position: sticky;
  top: -16px;
  z-index: 2;
  align-items: flex-start;
  margin: -16px -16px 13px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: rgba(247, 248, 251, .96);
  backdrop-filter: blur(10px);
}
.settings-section__heading .panel-kicker { color: #7c3aed; }
.settings-section__heading h3 { color: #172033; font-size: 15px; }
.settings-section__hint {
  max-width: 150px;
  color: #94a3b8;
  font-size: 10px;
  text-align: right;
}
.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  padding: 0;
  border: 0;
  background: transparent;
}
.field-grid > .field:first-child { grid-column: 1 / -1; }
.field {
  gap: 5px;
  padding: 9px;
  border-color: #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 3px 9px rgba(15, 23, 42, .035);
}
.field > span,
.field-label { color: #334155; font-size: 10px; }
.field small { color: #94a3b8; font-size: 9px; }
.field select,
.field input[type="number"] {
  height: 32px;
  padding: 0 8px;
  border-color: #dbe3ed;
  border-radius: 7px;
  color: #1e293b;
  background: #fbfcfe;
  font-size: 11px;
}
.field select:focus,
.field input[type="number"]:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, .14);
}
.variant-toolbar {
  align-items: stretch;
  gap: 9px;
  padding: 11px;
  border-color: #ddd6fe;
  border-radius: 9px;
  background: linear-gradient(135deg, #faf5ff, #fff);
  box-shadow: 0 4px 12px rgba(76, 29, 149, .04);
}
.variant-toolbar__copy small { color: #64748b; font-size: 9px; }
.variant-toolbar__body { gap: 7px; }
.variant-toolbar__switcher { gap: 5px; }
.variant-chip {
  min-width: 112px;
  padding: 5px 6px;
  border-color: #ddd6fe;
  border-radius: 7px;
  color: #475569;
  background: #fff;
}
.variant-chip:hover {
  border-color: #a78bfa;
  color: #5b21b6;
  background: #faf5ff;
}
.variant-chip > strong {
  width: 22px;
  height: 22px;
  color: #6d28d9;
  background: #f5f3ff;
}
.variant-chip > span { font-size: 10px; }
.variant-chip > small { font-size: 8px; }
.variant-chip--active {
  border-color: #7c3aed;
  background: #7c3aed;
}
.variant-toolbar__controls { grid-template-columns: minmax(0, 1fr) 32px 32px; }
.variant-toolbar__name,
.icon-button { height: 32px; }
.variant-toolbar__name {
  border-color: #d8dee8;
  color: #334155;
  background: #fff;
}
.icon-button {
  width: 32px;
  border-color: #d8dee8;
}
.card-format-picker {
  padding: 10px;
  border-color: #fde68a;
  border-radius: 9px;
  background: #fffdf3;
}
.card-format-picker__grid { gap: 4px; max-height: 142px; }
.card-format-picker__number { min-height: 26px; }
.card-format-picker__highlight { min-height: 20px; font-size: 8px; }
.showcase-settings {
  grid-column: 2;
  grid-row: 3;
  grid-template-columns: minmax(0, 1fr) 1fr;
  gap: 9px;
  min-width: 0;
  margin: 0;
  padding: 12px 16px;
  border-top: 1px solid #f1e8c8;
  border-right: 0;
  border-bottom: 0;
  border-left: 1px solid #f1e8c8;
  border-radius: 0;
  background: #fffbeb;
}
.showcase-settings p { color: #78716c; font-size: 10px; }
.showcase-settings > strong { color: #92400e; }
.showcase-spacing { gap: 7px; padding-top: 9px; }
.showcase-spacing__fields { gap: 7px; }
.structure-manager :is(a, button, select, input):focus-visible {
  outline: 2px solid rgba(167, 139, 250, .72);
  outline-offset: 2px;
}

@media (max-width: 1180px) {
  .editor-panel { grid-template-columns: minmax(0, 1fr) minmax(310px, 350px); }
  .flyer-preview__format-button { min-width: 51px; }
  .flyer-preview__format-button span { display: none; }
  .flyer-preview__format-button small { grid-column: 1; }
}

@media (max-width: 900px) {
  .structure-manager {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }
  .structure-manager__topbar {
    position: sticky;
    top: 0;
    flex-basis: 58px;
    height: 58px;
  }
  .structure-manager__main {
    height: auto;
    min-height: calc(100dvh - 58px);
    padding: 12px;
    overflow: visible;
  }
  .structure-manager__intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
  }
  .structure-manager__actions { width: 100%; }
  .structure-manager__actions .button { flex: 1 1 0; }
  .intro-copy { max-width: 760px; }
  .structure-manager__workspace {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: 1fr;
    gap: 10px;
    min-height: 0;
  }
  .count-panel {
    height: auto;
    max-height: none;
    padding: 10px;
  }
  .count-list {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    max-height: 114px;
    margin-top: 8px;
  }
  .count-item { justify-content: center; }
  .count-item__copy { display: none; }
  .count-item__check { display: none; }
  .editor-panel {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    height: auto;
    overflow: visible;
  }
  .editor-panel__heading { grid-column: 1; grid-row: 1; }
  .flyer-preview {
    grid-column: 1;
    grid-row: 2;
    min-height: 590px;
  }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real {
    height: min(66vh, 640px);
    min-height: 390px;
  }
  .settings-section {
    grid-column: 1;
    grid-row: 3;
    overflow: visible;
    border-top: 1px solid #d8dee8;
    border-left: 0;
  }
  .settings-section__heading { position: static; margin: 0 0 13px; padding: 0 0 12px; background: transparent; }
  .showcase-settings {
    grid-column: 1;
    grid-row: 4;
    border-top: 1px solid #f1e8c8;
    border-left: 0;
  }
}

@media (max-width: 560px) {
  .structure-manager__topbar-inner { gap: 12px; padding: 0 12px; }
  .structure-manager__topbar { flex-basis: 54px; height: 54px; }
  .structure-manager__brand { font-size: 12px; }
  .structure-manager__back span,
  .structure-manager__secondary-link { display: none; }
  .structure-manager__main {
    min-height: calc(100dvh - 54px);
    padding: 8px;
  }
  .structure-manager__intro {
    gap: 9px;
    margin-bottom: 8px;
    padding: 12px;
  }
  .structure-manager h1 { font-size: 20px; }
  .intro-copy { display: none; }
  .structure-manager__actions .button { min-height: 34px; padding: 0 9px; }
  .count-panel { padding: 9px 7px; }
  .panel-heading { padding-inline: 4px; }
  .count-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    max-height: 95px;
  }
  .count-item { min-height: 34px; }
  .count-item__number { width: 24px; height: 24px; }
  .editor-panel__heading { align-items: flex-start; flex-direction: column; padding: 11px 12px; }
  .automatic-badge { align-self: flex-start; }
  .flyer-preview { min-height: 490px; padding: 9px; }
  .flyer-preview__heading { gap: 8px; }
  .flyer-preview__heading p { display: none; }
  .flyer-preview__tools { width: 100%; align-items: stretch; flex-direction: column; }
  .flyer-preview__format-picker { justify-content: flex-start; }
  .flyer-preview__format-button { min-width: 0; flex: 1 1 0; }
  .flyer-preview__format-button span { display: inline; }
  .flyer-preview__zoom-picker { width: 100%; }
  .flyer-preview__viewport,
  .flyer-preview__viewport--real {
    height: min(63vh, 510px);
    min-height: 330px;
    padding: 10px;
  }
  .settings-section { padding: 13px 12px; }
  .field-grid { grid-template-columns: 1fr; }
  .field-grid > .field:first-child { grid-column: auto; }
  .variant-toolbar__controls { grid-template-columns: minmax(0, 1fr) 32px 32px; }
  .showcase-settings { grid-template-columns: 1fr 1fr; padding: 13px 12px; }
  .showcase-spacing__fields { grid-template-columns: 1fr; }
}

/* Redesign 2026-09: palco grande primeiro. O banner superior vira uma faixa
   slim, o heading do editor compacta e a viewport recebe toda a altura livre.
   O artboard usa a nova regra de fit (largura + max-height) para Story, Feed,
   Post, Banner e A4 aparecerem inteiros e legiveis. */
.structure-manager__main { padding: 10px 16px 12px; }
.structure-manager__intro {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 0;
  margin-bottom: 8px;
  padding: 10px 14px;
}
.structure-manager__intro .eyebrow { margin: 0 0 2px; font-size: 9px; }
.structure-manager h1 { font-size: 20px; line-height: 1.1; }
.intro-copy {
  display: block;
  max-width: 760px;
  margin-top: 3px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.structure-manager__actions .button { min-height: 34px; font-size: 12px; }
.structure-manager__workspace { grid-template-columns: 200px minmax(0, 1fr); }
.editor-panel { grid-template-columns: minmax(0, 1fr) 380px; }
.editor-panel__heading { align-items: center; padding: 8px 14px; }
.editor-panel__heading h2 { font-size: 15px; }
.editor-panel__heading p {
  margin-top: 2px;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flyer-preview { gap: 8px; padding: 10px 12px; }
.flyer-preview__heading {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.flyer-preview__heading h3 { font-size: 13px; }
.flyer-preview__heading p { display: none; }
.flyer-preview .panel-kicker { margin-bottom: 2px; font-size: 9px; }
.flyer-preview__tools { flex-direction: row; align-items: center; gap: 8px; }
.flyer-preview__format-picker { gap: 6px; }
.flyer-preview__format-note { color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: .03em; white-space: nowrap; }
.flyer-preview__format-button {
  grid-template-columns: auto auto;
  grid-template-rows: auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 10px;
}
.flyer-preview__format-button small { grid-column: auto; }
.flyer-preview__format-button :is(svg) { width: 15px; height: 15px; }
.flyer-preview__zoom-picker { min-width: 150px; padding: 5px 8px; }
.flyer-preview__viewport {
  flex: 1 1 auto;
  height: 100%;
  padding: 14px;
  border-radius: 12px;
}
.flyer-preview__viewport--fit { align-items: center; justify-content: center; }
.flyer-preview__page {
  margin: auto;
  padding: 10px;
  border-color: #dbe3ed;
  border-radius: 10px;
}
.flyer-preview__page-meta { font-size: 9px; }
.flyer-preview__safe-area {
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.flyer-preview__zone-label { font-size: 9px; }
.flyer-preview__safe-area .preview-stage { padding: 8px; border-radius: 6px; }
.preview-toolbar { font-size: 10px; }
.preview-canvas {
  border-color: #cbd5e1;
  background: #eef2f7;
}
.preview-cell {
  border-color: #cbd5e1;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, .08);
}
.preview-product-card__name { font-size: 11px; }
@media (max-width: 1180px) {
  .intro-copy { white-space: normal; }
}

/* Compact header 2026-09: topbar + faixa + headings slim para o palco do
   preview receber o maximo de altura livre. */
.structure-manager__topbar { flex-basis: 48px; height: 48px; }
.structure-manager__brand-mark { width: 26px; height: 26px; }
.structure-manager__main { padding: 8px 16px 10px; }
.structure-manager__intro {
  gap: 12px;
  margin-bottom: 6px;
  padding: 6px 12px;
  border-radius: 10px;
}
.structure-manager__intro .eyebrow { display: none; }
.structure-manager h1 { font-size: 15px; }
.intro-copy { display: none; }
.structure-manager__actions .button { min-height: 30px; font-size: 11px; }
.feedback { margin-bottom: 6px; padding: 7px 10px; font-size: 11px; }
.editor-panel__heading { padding: 6px 12px; }
.editor-panel__heading h2 { font-size: 13px; }
.editor-panel__heading p { display: none; }
.editor-panel__heading .panel-kicker { margin-bottom: 1px; font-size: 9px; }
.automatic-badge { padding: 5px 8px; font-size: 9px; }
.flyer-preview { gap: 6px; padding: 8px 10px; }
.flyer-preview__heading h3 { font-size: 12px; }
.flyer-preview .panel-kicker { display: none; }
.flyer-preview__format-button { padding: 6px 8px; }
.flyer-preview__zoom-picker { min-width: 132px; }
.flyer-preview__viewport { padding: 12px; }

/* Palco dominante: o preview vira o centro da tela. Header unico no topbar,
   rail estreito, inspetor mais fino, chrome interno do artboard removido. */
.structure-manager__topbar { flex: 0 0 46px; height: 46px; }
.structure-manager__topbar-inner { gap: 12px; padding: 0 12px; }
.structure-manager__actions { display: flex; gap: 6px; }
.structure-manager__actions .button { min-height: 30px; padding: 0 10px; font-size: 11px; }
.structure-manager__main { padding: 0; }
.structure-manager__intro { display: none; }
.feedback { margin: 8px 12px 0; }
.structure-manager__workspace {
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 0;
  min-height: 0;
}
.count-panel {
  border: 0;
  border-right: 1px solid #252b3a;
  border-radius: 0;
  background: #101522;
  box-shadow: none;
}
.panel-heading { padding: 10px 10px 8px; }
.panel-heading h2 { font-size: 12px; }
.panel-heading .panel-kicker { font-size: 8px; }
.count-item { min-height: 34px; padding: 4px 6px; }
.editor-panel {
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: minmax(0, 1fr);
  border: 0;
  border-radius: 0;
  background: #0b0f19;
  box-shadow: none;
}
.editor-panel__heading { display: none; }
.flyer-preview {
  grid-column: 1;
  grid-row: 1;
  gap: 0;
  padding: 0;
  background: #0b0f19;
}
.flyer-preview__heading {
  min-height: 44px;
  padding: 6px 10px;
  border-bottom: 1px solid #1f2535;
  background: #121826;
}
.flyer-preview__identity {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.flyer-preview__identity strong { color: #f8fafc; font-size: 12px; }
.flyer-preview__identity span { color: #94a3b8; font-size: 10px; }
.flyer-preview__viewport {
  height: auto;
  min-height: 0;
  padding: 10px;
  border: 0;
  border-radius: 0;
  background-color: #080c14;
}
.flyer-preview__page {
  padding: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
}
.flyer-preview__page-meta,
.flyer-preview__zone-label,
.preview-toolbar,
.preview-summary { display: none; }
.flyer-preview__safe-area {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #fff;
}
.flyer-preview__safe-area .preview-stage {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
}
.flyer-preview__safe-area .preview-canvas {
  min-height: 0;
  border: 0;
  border-radius: 0;
}
.settings-section {
  grid-column: 2;
  grid-row: 1;
  padding: 12px;
  border-left: 1px solid #e5e7eb;
}
.settings-section__heading {
  position: static;
  margin: 0 0 10px;
  padding: 0 0 8px;
}
.settings-section__heading h3 { font-size: 13px; }
.showcase-settings {
  grid-column: 2;
  grid-row: auto;
  max-height: none;
}
.editor-panel__inspector {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  background: #f7f8fb;
  scrollbar-color: #cbd5e1 transparent;
}
.editor-panel__inspector .settings-section {
  grid-column: auto;
  grid-row: auto;
  flex: 0 0 auto;
  min-height: 0;
  margin: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.editor-panel__inspector .showcase-settings {
  grid-column: auto;
  grid-row: auto;
  flex: 0 0 auto;
  max-height: none;
  border-left: 0;
}
@media (max-width: 900px) {
  .structure-manager__workspace { grid-template-columns: 1fr; }
  .editor-panel { grid-template-columns: 1fr; grid-template-rows: minmax(520px, 70vh) auto; }
  .flyer-preview { grid-row: 1; min-height: 520px; }
  .editor-panel__inspector { grid-column: 1; grid-row: 2; max-height: none; overflow: visible; }
}
</style>
