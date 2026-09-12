<script setup lang="ts">
import ProductPaletteControls from './ProductPaletteControls.vue'
import type { GlobalStyles, ProductPalette } from '~/types/product-zone'
import { useEditorVisualViewport } from '~/composables/useEditorVisualViewport'
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Layers,
  Trash2,
  Image as CanvasIcon,
  ShoppingBasket,
  SlidersHorizontal,
  Download,
} from 'lucide-vue-next'
import QuickCardColors from './QuickCardColors.vue'
import OfferValidityPrompt from './OfferValidityPrompt.vue'
import {
  formatBusinessAddressValues,
  formatBusinessContactValues,
  formatBusinessPaymentMethods,
  type BusinessProfile
} from '~/utils/businessProfile'
import {
  formatOfferDate, formatOfferDateInterval, normalizeOfferDateFormat, type OfferDateFormat,
  formatOfferValidityPeriod,
  formatOfferValidityScope,
  inferOfferValidityMode,
  normalizeOfferValidityMode,
  normalizeOfferValidityScope,
  type OfferValidityMode,
  type OfferValidityScope
} from '~/utils/offerValidity'
import { FLYER_TEMPLATE_FORMATS } from '~/utils/flyerTemplateApi'
import type { ProductZoneStructure, ProductZoneStructureVariant } from '~/types/product-zone'
import { getProductZoneStructureFormatLabel } from '~/utils/product-zone-structure'

// O onboarding só é necessário quando o tema realmente pede um dado ausente.
// Carregá-lo sob demanda deixa a primeira abertura do editor mais leve no 4G.
const QuickModeBusinessSetupDialog = defineAsyncComponent(() => import('./QuickModeBusinessSetupDialog.vue'))

type QuickModeZone = {
  id: string
  name: string
  count: number
  structure?: ProductZoneStructure | null
  structureVariants?: ProductZoneStructureVariant[]
  selectedStructureVariantId?: string
}

type QuickModeProduct = {
  id: string
  name: string
  price?: string
  imageUrl?: string
  labelName?: string
}

type QuickModeLabelTemplate = {
  id: string
  name: string
  previewDataUrl?: string
}

type QuickModeImportMode = 'replace' | 'append'

type QuickModePage = {
  id: string
  name?: string
  width?: number
  height?: number
  thumbnail?: string
  thumbnailUrl?: string
  templateModelId?: string
  templateModelName?: string
  templateFormatId?: string
  templateFormatLabel?: string
  templateThemeName?: string
}

type QuickModeModel = {
  id: string
  name: string
}

type BusinessFieldId =
  | 'logo'
  | 'companyName'
  | 'slogan'
  | 'phone'
  | 'whatsapp'
  | 'address'
  | 'hours'
  | 'instagram'
  | 'facebook'
  | 'website'
  | 'footerPaymentImages'
  | 'paymentMethods'
  | 'paymentNotes'

const BUSINESS_FIELDS: Array<{ id: BusinessFieldId; label: string }> = [
  { id: 'logo', label: 'Logo da loja' },
  { id: 'companyName', label: 'Nome da loja' },
  { id: 'slogan', label: 'Slogan' },
  { id: 'phone', label: 'Telefone' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'address', label: 'Endereço' },
  { id: 'hours', label: 'Horário' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'website', label: 'Site' },
  { id: 'footerPaymentImages', label: 'Cartões aceitos' },
  { id: 'paymentMethods', label: 'Formas de pagamento' },
  { id: 'paymentNotes', label: 'Observação de pagamento' },
]

const props = defineProps<{
  productPaletteStyles?: Partial<GlobalStyles>
  cardColorMode?: 'auto' | 'manual'
  cardColor?: string
  zones: QuickModeZone[]
  selectedZoneId: string
  products?: QuickModeProduct[]
  bulkLabelTemplates?: QuickModeLabelTemplate[]
  busy?: boolean
  businessProfile?: Partial<BusinessProfile> & Record<string, any>
  businessFieldVisibility?: Record<string, boolean>
  requiredBusinessFields?: string[]
  businessSetupSaving?: boolean
  businessSetupError?: string
  validityDateFormat?: OfferDateFormat
  validityStartDate?: string
  validityEndDate?: string
  validityMode?: OfferValidityMode | string
  validityWhileStocks?: boolean
  showValidity?: boolean
  validityPromptReady?: boolean
  completedProductReviews?: number
  offerScope?: Partial<OfferValidityScope>
  pages?: QuickModePage[]
  currentPageId?: string
  templateModels?: QuickModeModel[]
  currentModelId?: string
}>()

const emit = defineEmits<{
  (event: 'restore-grid', payload: { zoneId: string; preset: 'model' | '2' | '3' }): void
  (event: 'mobile-section', value: string): void
  (event: 'export'): void
  (event: 'product-palette', value: Partial<ProductPalette>): void
  (event: 'card-colors', payload: { mode: 'auto' | 'manual'; color?: string; allPages: boolean }): void
  (event: 'select-zone', zoneId: string): void
  (event: 'select-zone-structure', payload: { zoneId: string; variantId: string }): void
  (event: 'select-product', productId: string): void
  (event: 'open-product-image-picker', productId: string): void
  (event: 'clear-products'): void
  (event: 'delete-product', productId: string): void
  (event: 'move-product', payload: { productId: string; direction: 'up' | 'down' }): void
  (event: 'change-all-labels', templateId: string): void
  (event: 'import', payload: { mode: QuickModeImportMode; text: string; file?: File; autoFillImages: boolean; oneProductPerPage: boolean }): void
  (event: 'toggle-business-field', payload: { field: BusinessFieldId; enabled: boolean }): void
  (event: 'save-business-setup', payload: { businessProfile: Record<string, any>; hiddenFields: string[]; logoFile?: File | null }): void
  (event: 'update-validity', payload: { startDate: string; endDate: string; mode: OfferValidityMode; whileStocks: boolean; show: boolean; dateFormat: OfferDateFormat; scope: OfferValidityScope }): void
  (event: 'open-business-profile'): void
  (event: 'select-page', pageId: string): void
  (event: 'request-delete-page', pageId: string): void
  (event: 'use-template-model', modelId: string): void
}>()

const { height: mobileViewportHeight, bottomInset: mobileKeyboardInset } = useEditorVisualViewport()
const mobileStructureExpanded = ref(false)
const mobileSection = ref<'products' | 'pages' | 'preview' | 'tools'>('preview')
watch(mobileSection, value => emit('mobile-section', value))
const activeTab = ref<'search' | 'mine'>('search')
const productsReviewed = ref(false)
const listText = ref('')
const importMode = ref<QuickModeImportMode>('append')
const listFile = ref<File | null>(null)
const listFileInput = ref<HTMLInputElement | null>(null)
const listFileError = ref('')
const selectListFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  listFileError.value = ''
  if (!file) return
  if (!/\.(xlsx?|csv|tsv|pdf|txt)$/i.test(file.name) || file.size > 12 * 1024 * 1024 || !file.size) {
    listFileError.value = 'Escolha uma planilha, PDF ou TXT de até 12 MB.'
    return
  }
  listFile.value = file
}
const productListInput = ref<HTMLTextAreaElement | null>(null)
const autoFillImages = ref(true)
const oneProductPerPage = ref(false)
// Os dados da loja não devem competir com a revisão dos produtos.
const dataPanelOpen = ref(false)
const validityDateFormat = ref<OfferDateFormat>(normalizeOfferDateFormat(props.validityDateFormat))
watch(() => props.validityDateFormat, value => { validityDateFormat.value = normalizeOfferDateFormat(value) })
const validityStartDate = ref(String(props.validityStartDate || ''))
const validityEndDate = ref(String(props.validityEndDate || ''))
const validityMode = ref<OfferValidityMode>(normalizeOfferValidityMode(
  props.validityMode || inferOfferValidityMode(validityStartDate.value, validityEndDate.value)
))
const validityWhileStocks = ref(props.validityWhileStocks !== false)
const showValidity = ref(props.showValidity !== false)
const offerScope = reactive<OfferValidityScope>(normalizeOfferValidityScope(props.offerScope))
// Confirmar a validade em cada abertura, depois de carregar os dados do encarte.
const validityPromptOpen = ref(false)
const validityPromptResolved = ref(false)
const validityPromptError = ref('')
const businessSetupOpen = ref(false)
const pendingDeleteProductId = ref('')
const clearProductsConfirmOpen = ref(false)
const bulkLabelMenuOpen = ref(false)
const pageThumbErrors = ref<Record<string, boolean>>({})
const productImageErrors = ref<Record<string, boolean>>({})

const selectedZone = computed(() => {
  return props.zones.find(item => item.id === props.selectedZoneId) || props.zones[0] || null
})

const productCount = computed(() => selectedZone.value?.count || 0)
const products = computed(() => Array.isArray(props.products) ? props.products : [])
const hasImportContent = computed(() => !!listFile.value || listText.value.trim().length > 0)
const selectedZoneStructure = computed(() => selectedZone.value?.structure || null)
const selectedZoneStructureVariants = computed<ProductZoneStructureVariant[]>(() => (
  Array.isArray(selectedZone.value?.structureVariants)
    ? selectedZone.value.structureVariants
    : []
))
const selectedZoneStructureVariant = computed(() => {
  const selectedId = String(selectedZone.value?.selectedStructureVariantId || '').trim()
  return selectedZoneStructureVariants.value.find(variant => String(variant?.id || '').trim() === selectedId)
    || selectedZoneStructureVariants.value[0]
    || null
})
const selectedZoneStructureLabel = computed(() => {
  const formatLabel = getProductZoneStructureFormatLabel(selectedZoneStructure.value?.format)
  const variantName = String(selectedZoneStructureVariant.value?.name || '').trim()
  if (!variantName || variantName.toLowerCase() === 'padrão') return formatLabel
  return `${variantName} · ${formatLabel}`
})
const getStructureDimensionsLabel = (structure: Partial<ProductZoneStructure> | null | undefined) => {
  const columns = Number(structure?.columns || 0)
  const rows = Number(structure?.rows || 0)
  if (columns > 0 && rows > 0) return `${columns} × ${rows}`
  if (columns > 0) return `${columns} colunas`
  if (rows > 0) return `${rows} linhas`
  return 'Automático'
}
const selectedZoneStructureDimensions = computed(() => {
  return getStructureDimensionsLabel(selectedZoneStructure.value)
})
const selectedZoneStructureDirection = computed(() => (
  selectedZoneStructure.value?.layoutDirection === 'vertical' ? 'de cima para baixo' : 'em linhas'
))
const hasAlternativeZoneStructures = computed(() => selectedZoneStructureVariants.value.length > 1 && productCount.value > 0)

const markProductImageError = (productId: string) => {
  const id = String(productId || '').trim()
  if (id) productImageErrors.value[id] = true
}

const clearProductImageError = (productId: string) => {
  const id = String(productId || '').trim()
  if (id && productImageErrors.value[id]) delete productImageErrors.value[id]
}

watch(products, () => {
  // Uma troca de imagem mantém o mesmo produto; limpar o erro permite que a
  // nova referência do Wasabi volte a aparecer imediatamente.
  productImageErrors.value = {}
}, { deep: true })

const quickPages = computed(() => Array.isArray(props.pages) ? props.pages.filter(page => String(page?.id || '').trim()) : [])
const templateModels = computed(() => Array.isArray(props.templateModels)
  ? props.templateModels.filter(model => String(model?.id || '').trim())
  : [])

const isUsablePageThumbnail = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  const source = value.trim().toLowerCase()
  if (!source || source === 'data:,' || source === 'about:blank') return false
  if (source.startsWith('blob:null') || source.startsWith('javascript:')) return false
  return true
}

const getPageThumbnailSrc = (page: QuickModePage): string => {
  const id = String(page?.id || '').trim()
  if (!id || pageThumbErrors.value[id]) return ''
  const inline = typeof page?.thumbnail === 'string' ? page.thumbnail.trim() : ''
  const stored = typeof page?.thumbnailUrl === 'string' ? page.thumbnailUrl.trim() : ''
  const source = inline || stored
  return isUsablePageThumbnail(source) ? source : ''
}

const getPageThumbnailStyle = (page: QuickModePage) => {
  // A fila mantém o formato de cada página para o cliente reconhecer o
  // encarte visualmente, sem esticar uma página vertical para ocupar uma
  // linha horizontal inteira.
  const width = Math.max(320, Number(page?.width || 1080))
  const height = Math.max(320, Number(page?.height || 1080))
  const thumbWidth = 148
  return {
    width: `${thumbWidth}px`,
    height: 'auto',
    aspectRatio: `${width} / ${height}`
  }
}

const markPageThumbnailError = (page: QuickModePage) => {
  const id = String(page?.id || '').trim()
  if (id) pageThumbErrors.value[id] = true
}

const getPageFormat = (page: QuickModePage) => {
  const width = Number(page?.width || 0)
  const height = Number(page?.height || 0)
  const exact = FLYER_TEMPLATE_FORMATS.find(format => (
    format.width === Math.round(width) && format.height === Math.round(height)
  ))
  if (exact) return exact

  const explicitId = String(page?.templateFormatId || '').trim()
  if (explicitId) {
    const explicit = FLYER_TEMPLATE_FORMATS.find(format => format.id === explicitId)
    if (explicit) return explicit
  }

  if (!(width > 0 && height > 0)) return null
  const ratio = width / height
  return FLYER_TEMPLATE_FORMATS.reduce<typeof FLYER_TEMPLATE_FORMATS[number] | null>((best, format) => {
    const distance = Math.abs((format.width / format.height) - ratio)
    if (!best) return format
    return distance < Math.abs((best.width / best.height) - ratio) ? format : best
  }, null)
}

const getPageModelName = (page: QuickModePage): string => {
  const explicit = String(page?.templateModelName || '').trim()
  if (explicit) return explicit
  const rawName = String(page?.name || '').trim()
  const separatorIndex = rawName.indexOf(' · ')
  return separatorIndex > 0 ? rawName.slice(0, separatorIndex) : rawName || 'Modelo'
}

const getPageFormatLabel = (page: QuickModePage): string => {
  const explicit = String(page?.templateFormatLabel || '').trim()
  if (explicit) return explicit
  const format = getPageFormat(page)
  return format?.label || `${Number(page?.width || 0)}×${Number(page?.height || 0)}`
}

const businessFieldValue = (field: BusinessFieldId): string => {
  const profile = props.businessProfile || {}
  if (field === 'logo') {
    return String(profile.logo || '').trim() ? 'Logo padrão cadastrada' : ''
  }
  if (field === 'footerPaymentImages') return (profile.footerPaymentImages || []).join(', ')
  if (field === 'paymentMethods') {
    return formatBusinessPaymentMethods(profile.paymentMethods ?? profile.payment_methods)
  }
  const rawValue = field === 'paymentNotes'
    ? profile.paymentNotes ?? profile.payment_notes
    : field === 'hours'
      ? profile.hours ?? profile.openingHours
      : field === 'whatsapp'
        ? formatBusinessContactValues(
          profile.whatsappNumbers ?? profile.whatsapp_numbers ?? profile.whatsapps,
          profile.whatsapp
        )
        : field === 'address'
          ? formatBusinessAddressValues(
            profile.addresses ?? profile.enderecos ?? profile.addressList,
            profile.address
          )
      : profile[field]
  return String(rawValue || '').trim()
}

const BUSINESS_FIELD_ALIASES: Record<string, BusinessFieldId> = {
  logo: 'logo',
  companyname: 'companyName',
  company_name: 'companyName',
  name: 'companyName',
  slogan: 'slogan',
  phone: 'phone',
  whatsapp: 'whatsapp',
  address: 'address',
  hours: 'hours',
  instagram: 'instagram',
  facebook: 'facebook',
  website: 'website',
  footerpaymentimages: 'footerPaymentImages',
  paymentmethods: 'paymentMethods',
  payment_methods: 'paymentMethods',
  payments: 'paymentMethods',
  paymentnotes: 'paymentNotes',
  payment_notes: 'paymentNotes',
}

const templateBusinessFieldIds = computed<BusinessFieldId[]>(() => {
  const seen = new Set<BusinessFieldId>()
  return (Array.isArray(props.requiredBusinessFields) ? props.requiredBusinessFields : [])
    .map(field => BUSINESS_FIELD_ALIASES[String(field || '').trim().replace(/\s+/g, '').toLowerCase()])
    .filter((field): field is BusinessFieldId => !!field)
    .filter(field => {
      if (seen.has(field)) return false
      seen.add(field)
      return true
    })
})

const businessFieldRows = computed(() => {
  const fieldsInTemplate = templateBusinessFieldIds.value
  return BUSINESS_FIELDS
    .filter(field => fieldsInTemplate.length === 0 || fieldsInTemplate.includes(field.id))
    .map(field => ({
      ...field,
      value: businessFieldValue(field.id),
      enabled: props.businessFieldVisibility?.[field.id] !== false,
    }))
})

const visibleBusinessFieldCount = computed(() => businessFieldRows.value.filter(field => field.enabled).length)

const requiredBusinessSetupFields = computed<BusinessFieldId[]>(() => {
  const requested = new Set(templateBusinessFieldIds.value)
  if (requested.size === 0) return []

  return BUSINESS_FIELDS
    .map(field => field.id)
    .filter(field => requested.has(field))
    .filter(field => props.businessFieldVisibility?.[field] !== false)
    .filter(field => {
      if (field === 'companyName' && props.businessProfile?.__companyNameFromAccountFallback === true) return true
      if (field === 'paymentMethods' && props.businessProfile?.__paymentMethodsConfigured === false) return true
      return !businessFieldValue(field)
    })
})

const shouldOpenBusinessSetup = computed(() => (
  props.validityPromptReady === true &&
  validityPromptResolved.value &&
  productsReviewed.value &&
  requiredBusinessSetupFields.value.length > 0
))

watch(shouldOpenBusinessSetup, shouldOpen => {
  if (shouldOpen) businessSetupOpen.value = true
  else if (requiredBusinessSetupFields.value.length === 0) businessSetupOpen.value = false
}, { immediate: true })

const formatDateForSummary = (value: string): string => {
  const parts = String(value || '').split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || '')
}

const validitySummary = computed(() => {
  if (!showValidity.value || validityDateFormat.value === 'hidden') return 'Validade oculta no encarte'
  const start = formatOfferDate(validityStartDate.value, validityDateFormat.value)
  const end = formatOfferDate(validityEndDate.value, validityDateFormat.value)
  const dates = validityMode.value === 'while_stocks'
    ? 'Até acabar o estoque'
    : validityMode.value === 'single_day'
      ? (start || end ? `Somente em ${start || end}` : 'Escolha o dia')
      : start && end
        ? formatOfferDateInterval(start, end)
        : start
          ? `A partir de ${start}`
          : end
            ? `Até ${end}`
            : 'Escolha o período'
  const stockSuffix = validityWhileStocks.value && validityMode.value !== 'while_stocks'
    ? ' e enquanto houver estoque'
    : ''
  const scope = formatOfferValidityScope(offerScope)
  return [`${dates}${stockSuffix}`, scope].filter(Boolean).join(' · ')
})

const validityPromptPreview = computed(() => {
  const start = String(validityStartDate.value || '').trim()
  const end = String(validityEndDate.value || '').trim()
  if (validityMode.value === 'single_day' && !start && !end) {
    return 'Escolha uma data para ver o texto final.'
  }
  if (validityMode.value === 'date_range' && (!start || !end)) {
    return 'Escolha as duas datas para ver o texto final.'
  }
  return formatOfferValidityPeriod(
    formatDateForSummary(start),
    formatDateForSummary(end),
    validityMode.value,
    true
  )
})

watch(() => props.validityStartDate, value => { validityStartDate.value = String(value || '') })
watch(() => props.validityEndDate, value => { validityEndDate.value = String(value || '') })
watch(() => props.validityMode, value => {
  if (value === undefined || value === null || String(value).trim() === '') return
  validityMode.value = normalizeOfferValidityMode(value)
})
watch(() => props.validityWhileStocks, value => {
  if (value === undefined) return
  validityWhileStocks.value = value !== false
})
watch(() => props.validityPromptReady, ready => {
  if (ready !== false && !validityPromptResolved.value) validityPromptOpen.value = true
}, { immediate: true })

const continueAfterProductReview = () => {
  productsReviewed.value = true
  mobileSection.value = 'tools'
}
watch(() => props.completedProductReviews, (value, previous) => {
  if (!value || value === previous) return
  listText.value = ''
  listFile.value = null
  activeTab.value = 'mine'
  continueAfterProductReview()
})
watch(() => props.showValidity, value => { showValidity.value = value !== false })
watch(() => props.offerScope, value => {
  Object.assign(offerScope, normalizeOfferValidityScope(value))
}, { deep: true })
watch(() => props.selectedZoneId, () => {
  pendingDeleteProductId.value = ''
  clearProductsConfirmOpen.value = false
  bulkLabelMenuOpen.value = false
})

const handleZoneChange = (event: Event) => {
  emit('select-zone', (event.target as HTMLSelectElement).value)
}

const handleZoneStructureChange = (event: Event) => {
  const zoneId = String(selectedZone.value?.id || '').trim()
  const variantId = String((event.target as HTMLSelectElement)?.value || '').trim()
  if (!zoneId || !variantId || productCount.value <= 0) return
  emit('select-zone-structure', { zoneId, variantId })
}

const submitList = (mode: QuickModeImportMode = 'replace') => {
  if (!hasImportContent.value || props.busy) return
  emit('import', {
    mode,
    text: listFile.value ? '' : listText.value.trim(),
    file: listFile.value || undefined,
    autoFillImages: autoFillImages.value,
    oneProductPerPage: oneProductPerPage.value
  })
}

const openMobileProductList = () => {
  mobileSection.value = 'products'
  activeTab.value = productCount.value > 0 ? 'mine' : 'search'
}

const startMobileProductList = () => {
  mobileSection.value = 'products'
  activeTab.value = 'search'
  void nextTick(() => productListInput.value?.focus({ preventScroll: true }))
}

const openMobileTools = () => {
  mobileSection.value = 'tools'
  dataPanelOpen.value = true
}

const handlePrimaryProductAction = () => {
  if (activeTab.value === 'mine') {
    continueAfterProductReview()
    return
  }
  if (!hasImportContent.value) return
  submitList(productCount.value > 0 ? importMode.value : 'replace')
}

const mobilePrimaryAction = computed(() => {
  if (productCount.value > 0) {
    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Confira os produtos do encarte',
      description: `${productCount.value} ${productCount.value === 1 ? 'produto adicionado' : 'produtos adicionados'} para você revisar.`,
      action: 'Ver produtos',
    }
  }
  return {
    eyebrow: 'COMECE POR AQUI',
    title: 'Cole a lista de produtos',
    description: 'Nós organizamos os produtos e preparamos as imagens para conferência.',
    action: 'Adicionar lista',
  }
})

const toggleBusinessField = (field: BusinessFieldId) => {
  emit('toggle-business-field', {
    field,
    enabled: props.businessFieldVisibility?.[field] === false,
  })
}

const selectValidityMode = (value: unknown, commit = false) => {
  validityMode.value = normalizeOfferValidityMode(value)
  // Todas as opções comerciais oferecidas neste fluxo incluem a condição de estoque.
  validityWhileStocks.value = true
  validityPromptError.value = ''
  if (validityMode.value === 'single_day') {
    const date = validityStartDate.value || validityEndDate.value
    validityStartDate.value = date
    validityEndDate.value = date
  } else if (validityMode.value === 'while_stocks') {
    validityStartDate.value = ''
    validityEndDate.value = ''
  }
  if (commit) updateValidity()
}

const handleValidityModeChange = (event: Event) => {
  selectValidityMode((event.target as HTMLSelectElement)?.value, true)
}

const updateValidity = () => {
  validityPromptError.value = ''
  validityWhileStocks.value = true
  validityMode.value = normalizeOfferValidityMode(validityMode.value)
  if (validityMode.value === 'single_day') {
    const date = validityStartDate.value || validityEndDate.value
    validityStartDate.value = date
    validityEndDate.value = date
  } else if (validityMode.value === 'while_stocks') {
    validityStartDate.value = ''
    validityEndDate.value = ''
  }
  emit('update-validity', {
    startDate: validityStartDate.value,
    endDate: validityEndDate.value,
    mode: validityMode.value,
    whileStocks: validityWhileStocks.value,
    show: showValidity.value,
    dateFormat: validityDateFormat.value,
    scope: { ...offerScope },
  })
}

const applyValidityPrompt = (payload: { startDate: string; endDate: string; mode: OfferValidityMode; whileStocks: boolean; dateFormat: OfferDateFormat; show: boolean }) => {
  validityDateFormat.value = payload.dateFormat
  if (!payload.show) {
    showValidity.value = false
    updateValidity()
    validityPromptResolved.value = true
    validityPromptOpen.value = false
    return
  }
  validityStartDate.value = payload.startDate
  validityEndDate.value = payload.endDate
  validityMode.value = payload.mode
  validityWhileStocks.value = payload.whileStocks
  confirmValidityPrompt()
}

const confirmValidityPrompt = () => {
  const mode = normalizeOfferValidityMode(validityMode.value)
  validityWhileStocks.value = true
  if (mode === 'single_day') {
    const date = validityStartDate.value || validityEndDate.value
    if (!date) {
      validityPromptError.value = 'Escolha o dia em que a oferta será válida.'
      return
    }
    validityStartDate.value = date
    validityEndDate.value = date
  } else if (mode === 'date_range') {
    if (!validityStartDate.value || !validityEndDate.value) {
      validityPromptError.value = 'Informe o início e o final da validade.'
      return
    }
    if (validityEndDate.value < validityStartDate.value) {
      validityPromptError.value = 'O final precisa ser igual ou posterior ao início.'
      return
    }
  } else {
    validityStartDate.value = ''
    validityEndDate.value = ''
  }
  validityPromptError.value = ''
  showValidity.value = true
  updateValidity()
  validityPromptResolved.value = true
  validityPromptOpen.value = false
}

const requestDeleteProduct = (productId: string) => {
  const id = String(productId || '').trim()
  if (!id) return
  pendingDeleteProductId.value = pendingDeleteProductId.value === id ? '' : id
  clearProductsConfirmOpen.value = false
}

const requestClearProducts = () => {
  clearProductsConfirmOpen.value = !clearProductsConfirmOpen.value
  pendingDeleteProductId.value = ''
}

const confirmDeleteProduct = () => {
  const id = pendingDeleteProductId.value
  if (!id) return
  emit('delete-product', id)
  pendingDeleteProductId.value = ''
}

const confirmClearProducts = () => {
  emit('clear-products')
  clearProductsConfirmOpen.value = false
}

const toggleBulkLabelMenu = () => {
  if (!products.value.length || !props.bulkLabelTemplates?.length) return
  bulkLabelMenuOpen.value = !bulkLabelMenuOpen.value
  clearProductsConfirmOpen.value = false
  pendingDeleteProductId.value = ''
}

const changeAllLabels = (templateId: string) => {
  const id = String(templateId || '').trim()
  if (!id) return
  emit('change-all-labels', id)
  bulkLabelMenuOpen.value = false
}

const selectPage = (pageId: string) => {
  const id = String(pageId || '').trim()
  if (!id) return
  emit('select-page', id)
}

const requestDeletePage = (pageId: string) => {
  const id = String(pageId || '').trim()
  if (!id || props.busy || quickPages.value.length <= 1) return
  emit('request-delete-page', id)
}

const useTemplateModel = (modelId: string) => {
  const id = String(modelId || '').trim()
  if (!id || id === String(props.currentModelId || '').trim() || props.busy) return
  emit('use-template-model', id)
}
</script>

<template>
  <OfferValidityPrompt
    v-if="validityPromptOpen"
    :date-format="validityDateFormat"
    :start-date="validityStartDate"
    :end-date="validityEndDate"
    :mode="validityMode"
    :while-stocks="validityWhileStocks"
    @confirm="applyValidityPrompt"
  />

  <QuickModeBusinessSetupDialog
    v-if="businessSetupOpen"
    :open="businessSetupOpen"
    :fields="requiredBusinessSetupFields"
    :business-profile="props.businessProfile"
    :busy="props.busy || props.businessSetupSaving"
    :error-message="props.businessSetupError"
    @complete="emit('save-business-setup', $event)"
  />

  <section
    :class="['quick-mobile-action-dock', { 'is-hidden': mobileSection !== 'preview' }]"
    aria-label="Próximo passo da edição rápida"
  >
    <div class="quick-mobile-action-dock__copy">
      <span>{{ mobilePrimaryAction.eyebrow }}</span>
      <strong>{{ mobilePrimaryAction.title }}</strong>
      <small>{{ mobilePrimaryAction.description }}</small>
    </div>
    <button type="button" :disabled="props.busy" @click="handlePrimaryProductAction">
      <ClipboardPaste :size="18" />
      <span>{{ mobilePrimaryAction.action }}</span>
      <ArrowRight :size="17" aria-hidden="true" />
    </button>
  </section>

  <div class="quick-mode-controls-layout" :data-mobile-section="mobileSection" :style="{ '--mobile-keyboard-inset': `${mobileKeyboardInset}px`, '--mobile-visible-height': mobileViewportHeight ? `${mobileViewportHeight}px` : '100dvh' }">
    <nav class="quick-mobile-sections" aria-label="Edição rápida">
      <button type="button" :aria-pressed="mobileSection === 'preview'" @click="mobileSection = 'preview'"><CanvasIcon :size="20" /><span>Encarte</span></button>
      <button type="button" :aria-pressed="mobileSection === 'products'" @click="mobileSection === 'products' ? mobileSection = 'preview' : startMobileProductList()"><ShoppingBasket :size="20" /><span>Lista</span></button>
      <button type="button" :aria-pressed="mobileSection === 'pages'" @click="mobileSection = mobileSection === 'pages' ? 'preview' : 'pages'"><Layers :size="20" /><span>Páginas</span></button>
      <button type="button" :aria-pressed="mobileSection === 'tools'" @click="mobileSection === 'tools' ? mobileSection = 'preview' : openMobileTools()"><SlidersHorizontal :size="20" /><span>Ajustes</span></button>
      <button type="button" :disabled="props.busy" @click="emit('export')"><Download :size="20" /><span>Exportar</span></button>
    </nav>
    <aside class="quick-mode-sidebar" :aria-label="mobileSection === 'tools' ? 'Ajustes da edição rápida' : 'Produtos da edição rápida'">
    <div class="quick-mode-sidebar__content">
      <p v-if="mobileSection === 'tools' && !productsReviewed" class="quick-mobile-import-copy">Confira os produtos para liberar a grade, as cores e as outras opções.</p>
      <div class="quick-mode-sidebar__topbar">
        <div class="quick-mode-sidebar__title-wrap">
          <span class="quick-mode-sidebar__backmark" aria-hidden="true">+</span>
          <div>
            <p class="quick-mode-sidebar__eyebrow">Edição rápida</p>
            <h2>{{ mobileSection === 'tools' ? 'Ajustes' : 'Produtos' }}</h2>
          </div>
        </div>
        <span v-if="mobileSection !== 'tools'" class="quick-mode-sidebar__count">
          {{ productCount }} {{ productCount === 1 ? 'produto' : 'produtos' }}
        </span>
      </div>

      <div v-if="props.zones.length > 1 && activeTab !== 'search'" class="quick-mode-sidebar__zone-picker">
        <label for="quick-mode-zone">Destino do encarte</label>
        <select id="quick-mode-zone" :value="props.selectedZoneId" @change="handleZoneChange">
          <option v-for="item in props.zones" :key="item.id" :value="item.id">
            {{ item.name }} · {{ item.count }} {{ item.count === 1 ? 'produto' : 'produtos' }}
          </option>
        </select>
      </div>

      <details
        v-if="selectedZone && (activeTab === 'mine' || mobileSection === 'tools')"
        class="quick-mode-layout-options"
      >
        <summary>Organizar grid da página</summary>
        <div class="flex flex-wrap gap-2 p-2">
          <button type="button" :disabled="props.busy" class="rounded bg-violet-600 px-3 py-2 text-white disabled:opacity-50" @click="emit('restore-grid', { zoneId: props.selectedZoneId || '', preset: 'model' })">Restaurar grid padrão</button>
          <button type="button" :disabled="props.busy" class="rounded border border-white/20 px-3 py-2" @click="emit('restore-grid', { zoneId: props.selectedZoneId || '', preset: '2' })">2 colunas</button>
          <button type="button" :disabled="props.busy" class="rounded border border-white/20 px-3 py-2" @click="emit('restore-grid', { zoneId: props.selectedZoneId || '', preset: '3' })">3 colunas</button>
        </div>
        <p class="px-2 text-xs text-zinc-400">Altera somente a organização desta área de produtos. Você pode desfazer.</p>
        <label v-if="hasAlternativeZoneStructures" class="quick-mode-structure-card__select">
          <span>Disposições para {{ productCount }} produtos</span>
          <select
            :value="selectedZoneStructureVariant?.id || ''"
            :disabled="props.busy"
            aria-label="Disposição dos produtos no encarte"
            @change="handleZoneStructureChange"
          >
            <option v-for="variant in selectedZoneStructureVariants" :key="variant.id" :value="variant.id">
              {{ variant.name }} · {{ getProductZoneStructureFormatLabel(variant.format) }} · {{ getStructureDimensionsLabel(variant) }}{{ variant.id === selectedZoneStructureVariant?.id ? ' (atual)' : '' }}
            </option>
          </select>
          <small>Escolha uma alternativa para reorganizar os produtos. A alteração é salva automaticamente.</small>
        </label>
      </details>

      <div class="quick-mode-tabs" role="tablist" aria-label="Produtos">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'search'"
          :class="['quick-mode-tab', activeTab === 'search' ? 'quick-mode-tab--active' : '']"
          @click="activeTab = 'search'"
        >
          Adicionar lista
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'mine'"
          :class="['quick-mode-tab', activeTab === 'mine' ? 'quick-mode-tab--active' : '']"
          @click="activeTab = 'mine'"
        >
          Produtos no encarte
        </button>
      </div>

      <section v-if="activeTab === 'search'" class="quick-mode-search-card" role="tabpanel">
        <form @submit.prevent="handlePrimaryProductAction">
          <h3>Cole sua lista</h3>
          <p class="quick-mobile-import-copy">Depois você confere os nomes, preços e imagens.</p>
          <textarea
            ref="productListInput"
            v-model="listText"
            :disabled="props.busy || !!listFile"
            aria-label="Cole ou escreva uma lista de produtos"
            placeholder="Ex.: Arroz 5 kg 24,90&#10;Feijão 1 kg 7,99"
          ></textarea>
          <p class="quick-list-or">ou</p>
          <input ref="listFileInput" type="file" class="hidden" accept=".xlsx,.xls,.csv,.tsv,.pdf,.txt" :disabled="props.busy" @change="selectListFile" />
          <button type="button" class="quick-list-file-button" :disabled="props.busy" @click="listFileInput?.click()">
            Enviar arquivo
          </button>
          <p v-if="listFile" class="mb-3 text-sm text-violet-200">
            {{ listFile.name }}
            <button type="button" class="ml-2 underline" :disabled="props.busy" @click="listFile = null">Remover arquivo</button>
          </p>
          <p v-if="listFileError" role="alert" class="mb-3 text-sm text-red-300">{{ listFileError }}</p>
          <p class="mb-3 text-xs text-zinc-400">Planilha, PDF com texto ou TXT · até 12 MB.</p>

        </form>

      </section>

      <section v-if="activeTab === 'mine'" class="quick-mode-library-card" role="tabpanel">
        <div class="quick-mode-library-heading">
          <div>
            <span class="quick-mode-library-icon" aria-hidden="true">✓</span>
            <div>
              <h3>Meus Produtos</h3>
              <p>{{ productCount }} {{ productCount === 1 ? 'produto atual' : 'produtos atuais' }}</p>
            </div>
          </div>
          <button
            v-if="products.length"
            type="button"
            class="quick-mode-library-clear"
            :aria-expanded="clearProductsConfirmOpen"
            @click="requestClearProducts"
          >
            Limpar produtos
          </button>
        </div>

        <div v-if="productsReviewed && products.length" class="quick-mode-library-bulk-labels">
          <button
            type="button"
            class="quick-mode-library-bulk-labels__toggle"
            :disabled="!props.bulkLabelTemplates?.length"
            :aria-expanded="bulkLabelMenuOpen"
            @click="toggleBulkLabelMenu"
          >
            Trocar todas as etiquetas
            <span aria-hidden="true">{{ bulkLabelMenuOpen ? '−' : '+' }}</span>
          </button>
          <div v-if="bulkLabelMenuOpen" class="quick-mode-library-bulk-labels__menu" role="menu">
            <span>Aplicar em todos os produtos desta zona</span>
            <button
              v-for="template in props.bulkLabelTemplates"
              :key="template.id"
              type="button"
              role="menuitem"
              @click="changeAllLabels(template.id)"
            >
              <img v-if="template.previewDataUrl" :src="template.previewDataUrl" :alt="`Prévia da etiqueta ${template.name}`">
              <span>{{ template.name }}</span>
            </button>
          </div>
          <small v-if="!props.bulkLabelTemplates?.length" class="quick-mode-library-bulk-labels__hint">
            Não há uma etiqueta compatível com todos os produtos desta zona.
          </small>
        </div>

        <div v-if="props.zones.length > 1" class="quick-mode-library-zones">
          <button
            v-for="item in props.zones"
            :key="item.id"
            type="button"
            :class="['quick-mode-library-zone', item.id === props.selectedZoneId ? 'quick-mode-library-zone--active' : '']"
            @click="emit('select-zone', item.id)"
          >
            <span>{{ item.name }}</span>
            <strong>{{ item.count }}</strong>
          </button>
        </div>

        <div v-if="clearProductsConfirmOpen" class="quick-mode-library-confirm quick-mode-library-confirm--clear">
          <span>Remover os produtos desta página? A arte e a zona serão mantidas.</span>
          <div>
            <button type="button" class="quick-mode-library-confirm__yes" @click="confirmClearProducts">Confirmar</button>
            <button type="button" @click="clearProductsConfirmOpen = false">Cancelar</button>
          </div>
        </div>

        <div v-if="products.length" class="quick-mode-product-list">
          <article v-for="(product, productIndex) in products" :key="product.id" class="quick-mode-product-card">
            <div class="quick-mode-product-card__main">
              <button
                type="button"
                class="quick-mode-product-card__image"
                :class="{ 'quick-mode-product-card__image--missing': !product.imageUrl || productImageErrors[product.id] }"
                :aria-label="`${product.imageUrl && !productImageErrors[product.id] ? 'Trocar' : 'Escolher'} imagem de ${product.name}`"
                :title="`${product.imageUrl && !productImageErrors[product.id] ? 'Trocar' : 'Escolher'} imagem`"
                @click="emit('open-product-image-picker', product.id)"
              >
                <img
                  v-if="product.imageUrl && !productImageErrors[product.id]"
                  :src="product.imageUrl"
                  :alt="`Imagem de ${product.name}`"
                  loading="lazy"
                  @load="clearProductImageError(product.id)"
                  @error="markProductImageError(product.id)"
                >
                <span v-else class="quick-mode-product-card__image-fallback" aria-hidden="true">
                  <strong>+</strong>
                  <small>Escolher</small>
                </span>
              </button>
              <button
                type="button"
                class="quick-mode-product-card__copy"
                :aria-label="`Selecionar ${product.name} no encarte`"
                @click="emit('select-product', product.id)"
              >
                <strong>{{ product.name }}</strong>
                <small v-if="product.price">Oferta: {{ product.price }}</small>
                <small>{{ product.labelName ? `Etiqueta: ${product.labelName}` : 'Etiqueta padrão do produto' }}</small>
                <small class="quick-mode-product-card__image-status">
                  {{ product.imageUrl && !productImageErrors[product.id] ? 'Imagem atual · clique para trocar' : 'Sem imagem · clique para escolher' }}
                </small>
              </button>
            </div>

            <div class="quick-mode-product-card__actions">
              <button type="button" class="quick-mode-product-card__image-action" @click="emit('open-product-image-picker', product.id)">
                {{ product.imageUrl && !productImageErrors[product.id] ? 'Trocar imagem' : 'Escolher imagem' }}
              </button>
              <button type="button" @click="emit('select-product', product.id)">Abrir card</button>
              <button type="button" :disabled="productIndex === 0" aria-label="Mover produto para cima" title="Mover para cima" @click="emit('move-product', { productId: product.id, direction: 'up' })">↑</button>
              <button type="button" :disabled="productIndex === products.length - 1" aria-label="Mover produto para baixo" title="Mover para baixo" @click="emit('move-product', { productId: product.id, direction: 'down' })">↓</button>
              <button type="button" class="quick-mode-product-card__delete" @click="requestDeleteProduct(product.id)">
                Excluir
              </button>
            </div>

            <div v-if="pendingDeleteProductId === product.id" class="quick-mode-library-confirm">
              <span>Excluir este produto?</span>
              <div>
                <button type="button" class="quick-mode-library-confirm__yes" @click="confirmDeleteProduct">Confirmar</button>
                <button type="button" @click="pendingDeleteProductId = ''">Cancelar</button>
              </div>
            </div>
          </article>
        </div>

        <p v-else class="quick-mode-library-empty">
          Nenhum produto nesta zona. Pesquise uma lista para começar.
        </p>
        <p v-if="products.length">
          Clique na imagem para ver as opções do Wasabi ou enviar outra. O layout do modelo continua protegido.
        </p>
        <button type="button" class="quick-mode-library-action" @click="activeTab = 'search'">
          Pesquisar produtos
        </button>
      </section>

      <section v-if="productsReviewed && (activeTab === 'mine' || mobileSection === 'tools')" class="quick-mode-data-panel">
        <details class="quick-mobile-advanced-options">
          <summary>Aparência dos produtos</summary>
          <div class="quick-mobile-advanced-options__body">
            <ProductPaletteControls :styles="props.productPaletteStyles || {}" :busy="props.busy" @change="emit('product-palette', $event)" @reset="emit('product-palette', {})" />
            <QuickCardColors :mode="props.cardColorMode || 'auto'" :color="props.cardColor || '#ffffff'" :busy="props.busy" @apply="emit('card-colors', $event)" />
          </div>
        </details>
        <button
          type="button"
          class="quick-mode-data-panel__toggle"
          :aria-expanded="dataPanelOpen"
          @click="dataPanelOpen = !dataPanelOpen"
        >
          <span>
            <strong>{{ dataPanelOpen ? 'Dados no encarte' : 'Configurar dados' }}</strong>
            <small>{{ dataPanelOpen ? `${visibleBusinessFieldCount} campos ativos` : 'Abrir configurações da loja' }}</small>
          </span>
          <span class="quick-mode-data-panel__chevron" aria-hidden="true">{{ dataPanelOpen ? '−' : '+' }}</span>
        </button>

        <div v-if="dataPanelOpen" class="quick-mode-data-panel__body">
          <p class="quick-mode-data-panel__help">
            Escolha o que aparece neste encarte. A logo padrão entra na posição selecionada do cabeçalho e o cadastro é reutilizado nos próximos.
          </p>

          <div class="quick-mode-validity-card">
            <div class="quick-mode-data-row__copy">
              <strong>Validade da oferta</strong>
              <small>{{ validitySummary }}</small>
            </div>
            <button
              type="button"
              class="quick-mode-switch"
              :class="showValidity ? 'quick-mode-switch--active' : ''"
              :aria-pressed="showValidity"
              aria-label="Mostrar validade no encarte"
              @click="showValidity = !showValidity; updateValidity()"
            >
              <span></span>
            </button>
          </div>

          <label class="quick-mode-validity-mode">
            <span>Tipo de validade</span>
            <select :value="validityMode" @change="handleValidityModeChange">
              <option value="single_day">Só em um dia</option>
              <option value="date_range">Por um período</option>
              <option value="while_stocks">Enquanto houver estoque</option>
            </select>
          </label>

          <div v-if="validityMode === 'single_day'" class="quick-mode-date-grid quick-mode-date-grid--single">
            <label>
              <span>Data da oferta</span>
              <input v-model="validityStartDate" type="date" @change="updateValidity" />
            </label>
          </div>
          <div v-else-if="validityMode === 'date_range'" class="quick-mode-date-grid">
            <label>
              <span>Começa em</span>
              <input v-model="validityStartDate" type="date" @change="updateValidity" />
            </label>
            <label>
              <span>Termina em</span>
              <input v-model="validityEndDate" type="date" :min="validityStartDate || undefined" @change="updateValidity" />
            </label>
          </div>
          <p v-else class="quick-mode-validity-stocks-hint">Sem datas: a oferta vale até o estoque acabar.</p>

          <div class="quick-mode-offer-scope">
            <label class="quick-mode-offer-scope__mode">
              <span>Onde a oferta é válida</span>
              <select v-model="offerScope.mode" @change="updateValidity">
                <option value="all">Todas as lojas</option>
                <option value="city_only">Somente em uma cidade</option>
                <option value="city">Todas as lojas de uma cidade</option>
                <option value="store">Somente uma loja específica</option>
              </select>
            </label>
            <div v-if="offerScope.mode !== 'all'" class="quick-mode-offer-scope__fields">
              <label>
                <span>Cidade</span>
                <input v-model="offerScope.city" type="text" maxlength="100" placeholder="Rio Verde" @change="updateValidity" />
              </label>
              <label>
                <span>UF</span>
                <input v-model="offerScope.state" type="text" maxlength="2" placeholder="GO" @change="updateValidity" />
              </label>
              <label v-if="offerScope.mode === 'store'" class="quick-mode-offer-scope__store">
                <span>Nome da loja</span>
                <input v-model="offerScope.storeName" type="text" maxlength="140" placeholder="Loja do bairro Popular" @change="updateValidity" />
              </label>
            </div>
            <small v-if="offerScope.mode === 'city_only'">Ex.: Oferta válida somente em Rio Verde - GO.</small>
            <small v-else-if="offerScope.mode === 'city'">Ex.: Oferta válida em todas as lojas de Rio Verde - GO.</small>
            <small v-else-if="offerScope.mode === 'store'">Ex.: Oferta válida somente na loja do bairro Popular em Rio Verde - GO.</small>
          </div>

          <div class="quick-mode-business-list">
            <div v-for="row in businessFieldRows" :key="row.id" class="quick-mode-data-row">
              <div class="quick-mode-data-row__copy">
                <strong>{{ row.label }}</strong>
                <small>{{ row.value || 'Não informado' }}</small>
              </div>
              <button
                type="button"
                class="quick-mode-switch"
                :class="row.enabled ? 'quick-mode-switch--active' : ''"
                :aria-pressed="row.enabled"
                :aria-label="`${row.enabled ? 'Ocultar' : 'Mostrar'} ${row.label}`"
                @click="toggleBusinessField(row.id)"
              >
                <span></span>
              </button>
            </div>
          </div>

          <button type="button" class="quick-mode-profile-action" @click="emit('open-business-profile')">
            Abrir configuração completa
          </button>
        </div>
      </section>
    </div>

    <footer class="quick-mode-sidebar__footer">
      <button
        type="button"
        class="quick-mode-sidebar__footer-action"
        :disabled="props.busy || (activeTab === 'search' ? !hasImportContent : productCount === 0)"
        @click="handlePrimaryProductAction"
      >
        <span v-if="props.busy" class="quick-mode-spinner" aria-hidden="true"></span>
        <ArrowRight v-else :size="18" aria-hidden="true" />
        {{ props.busy ? 'Preparando produtos…' : activeTab === 'search' ? 'Conferir produtos' : 'Continuar com estes produtos' }}
      </button>
    </footer>
    </aside>

    <aside v-if="quickPages.length || templateModels.length" class="quick-mode-pages-rail" aria-label="Modelos e páginas do encarte">
      <section v-if="templateModels.length" class="quick-mode-models" aria-label="Modelos disponíveis">
        <div class="quick-mode-models__header">
          <span>Modelos</span>
          <small>Reutilizáveis</small>
        </div>
        <div class="quick-mode-models__list">
          <button
            v-for="model in templateModels"
            :key="`rail-model-${model.id}`"
            type="button"
            :class="['quick-mode-model', model.id === props.currentModelId ? 'quick-mode-model--active' : '']"
            :aria-current="model.id === props.currentModelId ? 'true' : undefined"
            :aria-label="`Usar modelo ${model.name}`"
            :title="`Usar modelo ${model.name} em uma nova página`"
            :disabled="model.id === props.currentModelId || props.busy"
            @click="useTemplateModel(model.id)"
          >
            <span>{{ model.name }}</span>
            <small>{{ model.id === props.currentModelId ? 'Atual' : 'Usar' }}</small>
          </button>
        </div>
        <p class="quick-mode-models__help">Modelos não são páginas. Escolha um para criar uma nova página.</p>
      </section>

      <div class="quick-mode-pages-rail__header">
        <div>
          <span>Páginas</span>
          <small>Criadas ou duplicadas</small>
        </div>
        <strong class="quick-mode-pages-rail__count">{{ quickPages.length }}</strong>
      </div>

      <div class="quick-mode-pages-rail__list">
        <div
          v-for="(page, index) in quickPages"
          :key="`rail-page-${page.id}`"
          class="quick-mode-page-thumb-wrap"
          :style="getPageThumbnailStyle(page)"
        >
          <button
            type="button"
            :class="['quick-mode-page-thumb', page.id === props.currentPageId ? 'quick-mode-page-thumb--active' : '']"
            :aria-current="page.id === props.currentPageId ? 'page' : undefined"
            :aria-label="`Página ${index + 1}: ${getPageModelName(page)}, ${getPageFormatLabel(page)}`"
            :title="`${getPageModelName(page)} · ${getPageFormatLabel(page)}`"
            @click="selectPage(page.id)"
          >
            <img
              v-if="getPageThumbnailSrc(page)"
              :src="getPageThumbnailSrc(page)"
              :alt="`Miniatura da página ${index + 1}`"
              loading="lazy"
              decoding="async"
              @error="markPageThumbnailError(page)"
            >
            <span v-else class="quick-mode-page-thumb__fallback" aria-hidden="true">
              <Layers class="h-4 w-4" />
              <small>{{ getPageFormatLabel(page) }}</small>
            </span>
            <span class="quick-mode-page-thumb__number">{{ index + 1 }}</span>
            <span class="quick-mode-page-thumb__label">{{ getPageFormatLabel(page) }}</span>
          </button>

          <button
            v-if="quickPages.length > 1"
            type="button"
            class="quick-mode-page-thumb__delete"
            :disabled="props.busy"
            :aria-label="`Excluir página ${index + 1}`"
            :title="`Excluir página ${index + 1}`"
            @click.stop="requestDeletePage(page.id)"
          >
            <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

      </div>
    </aside>
  </div>
</template>

<style scoped>
.quick-fill-option,.quick-clear-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px; margin:12px 0; border:1px solid #3d3f43; border-radius:12px; background:#27282b; }
.quick-fill-option span,.quick-clear-row span { display:grid; gap:4px; }
.quick-fill-option strong,.quick-clear-row strong { font-size:13px; color:#eee; }
.quick-fill-option small,.quick-clear-row small { font-size:12px; color:#a1a1aa; line-height:1.4; }
.quick-fill-option input { appearance:none; flex-shrink:0; width:36px; height:21px; border-radius:20px; background:#555; cursor:pointer; position:relative; }
.quick-fill-option input::after { content:''; position:absolute; width:15px; height:15px; top:3px; left:3px; border-radius:50%; background:white; transition:transform .15s; }
.quick-fill-option input:checked { background:#397bea; }
.quick-fill-option input:checked::after { transform:translateX(15px); }
.quick-fill-option input:focus-visible,.quick-clear-action:focus-visible { outline:2px solid #8eb9ff; outline-offset:3px; }
.quick-clear-action { display:flex; align-items:center; gap:6px; font-size:12px; color:#fca5a5; padding:8px; border-radius:7px; }
.quick-clear-action:hover { background:#432b2e; }

.quick-mode-controls-layout {
  display: flex;
  flex: 0 0 auto;
  width: 570px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #252627;
  color: #fff;
}

.quick-mode-sidebar {
  display: flex;
  flex-direction: column;
  width: 386px;
  flex: 0 0 386px;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  background: #252627;
  color: #fff;
}

.quick-mode-pages-rail {
  display: flex;
  flex: 0 0 184px;
  flex-direction: column;
  position: relative;
  width: 184px;
  min-width: 0;
  height: 100%;
  min-height: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, #1b2230 0%, #171a20 100%);
  color: #fff;
}

.quick-mode-models {
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 13px 10px 11px;
}

.quick-mode-models__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 0 4px;
}

.quick-mode-models__header span {
  color: #b9d0ff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  line-height: 1.15;
  text-transform: uppercase;
}

.quick-mode-models__header small {
  color: rgba(255, 255, 255, 0.42);
  font-size: 8px;
}

.quick-mode-models__list {
  display: grid;
  gap: 5px;
  margin-top: 8px;
}

.quick-mode-model {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  min-width: 0;
  min-height: 30px;
  border: 1px solid rgba(185, 208, 255, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  padding: 0 8px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.quick-mode-model span,
.quick-mode-model small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-model span {
  font-size: 10px;
  font-weight: 700;
}

.quick-mode-model small {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.42);
  font-size: 8px;
}

.quick-mode-model:hover:not(:disabled) {
  border-color: rgba(159, 192, 255, 0.7);
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-model--active {
  border-color: rgba(76, 139, 245, 0.72);
  background: rgba(76, 139, 245, 0.2);
  color: #fff;
}

.quick-mode-model:disabled {
  cursor: default;
}

.quick-mode-models__help {
  margin: 7px 4px 0;
  color: rgba(255, 255, 255, 0.42);
  font-size: 8px;
  line-height: 1.35;
}

.quick-mode-pages-rail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  padding: 17px 14px 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.quick-mode-pages-rail__header > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.quick-mode-pages-rail__header span {
  color: rgba(255, 255, 255, 0.82);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  line-height: 1.15;
  text-transform: uppercase;
}

.quick-mode-pages-rail__header small {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.42);
  font-size: 9px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-pages-rail__count {
  display: grid;
  min-width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 8px;
  background: rgba(159, 192, 255, 0.13);
  color: #b9d0ff;
  font-size: 12px;
  line-height: 1;
}

.quick-mode-pages-rail__manage {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid rgba(185, 208, 255, 0.28);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.quick-mode-pages-rail__manage:hover,
.quick-mode-pages-rail__manage[aria-expanded='true'] {
  border-color: rgba(159, 192, 255, 0.72);
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-pages-rail__options {
  position: absolute;
  top: 58px;
  right: 10px;
  z-index: 12;
  width: 260px;
  max-width: calc(100vw - 24px);
  border: 1px solid rgba(159, 192, 255, 0.42);
  border-radius: 10px;
  background: linear-gradient(160deg, #253954 0%, #1b2029 100%);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.38), 0 0 0 3px rgba(76, 139, 245, 0.08);
  padding: 10px;
}

.quick-mode-pages-rail__options-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quick-mode-pages-rail__options-heading > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.quick-mode-pages-rail__options-heading span,
.quick-mode-pages-rail__options-heading small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-pages-rail__options-heading span {
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}

.quick-mode-pages-rail__options-heading small {
  color: rgba(255, 255, 255, 0.55);
  font-size: 9px;
}

.quick-mode-pages-rail__options-heading > button {
  display: grid;
  width: 23px;
  height: 23px;
  flex: 0 0 23px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-size: 17px;
  line-height: 1;
}

.quick-mode-pages-rail__options-heading > button:hover {
  background: rgba(255, 255, 255, 0.13);
  color: #fff;
}

.quick-mode-pages-rail__options-help {
  margin: 8px 0 10px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 10px;
  line-height: 1.35;
}

.quick-mode-pages-rail__options-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.quick-mode-pages-rail__option {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  padding: 0 8px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.quick-mode-pages-rail__option:hover:not(:disabled),
.quick-mode-pages-rail__option[aria-expanded='true'] {
  border-color: rgba(159, 192, 255, 0.72);
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-pages-rail__option--primary {
  border-color: rgba(76, 139, 245, 0.58);
  background: rgba(76, 139, 245, 0.13);
}

.quick-mode-pages-rail__option--wide {
  grid-column: 1 / -1;
}

.quick-mode-pages-rail__option span {
  flex: 1;
  overflow: hidden;
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-pages-rail__option:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.quick-mode-pages-rail__format-menu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 7px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 7px;
}

.quick-mode-pages-rail__format-menu > span {
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
}

.quick-mode-pages-rail__format-menu button {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 5px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  padding: 6px;
  text-align: left;
}

.quick-mode-pages-rail__format-menu button:hover {
  border-color: rgba(159, 192, 255, 0.65);
  background: rgba(76, 139, 245, 0.15);
}

.quick-mode-pages-rail__format-menu strong,
.quick-mode-pages-rail__format-menu small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-pages-rail__format-menu strong {
  font-size: 9px;
}

.quick-mode-pages-rail__format-menu small {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 8px;
}

.quick-mode-pages-rail__list {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 13px 9px 16px;
  scrollbar-color: #4a6389 transparent;
  scrollbar-width: thin;
}

.quick-mode-pages-rail .quick-mode-page-thumb {
  max-width: 100%;
}

.quick-mode-page-thumb-wrap {
  position: relative;
  flex: 0 0 auto;
  max-width: 100%;
}

.quick-mode-pages-rail__add {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 148px;
  min-height: 66px;
  border: 1px dashed rgba(185, 208, 255, 0.38);
  border-radius: 9px;
  background: rgba(159, 192, 255, 0.035);
  color: rgba(185, 208, 255, 0.82);
  cursor: pointer;
  font-size: 9px;
  font-weight: 800;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.quick-mode-pages-rail__add:hover {
  border-color: rgba(185, 208, 255, 0.75);
  background: rgba(76, 139, 245, 0.13);
  color: #fff;
}

.quick-mode-sidebar__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: #4a4b4d transparent;
}

.quick-mode-sidebar__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  margin-bottom: 14px;
}

.quick-mode-structure-card {
  margin: 0 0 12px;
  border: 1px solid rgba(159, 192, 255, 0.28);
  border-radius: 9px;
  background: linear-gradient(145deg, rgba(37, 57, 82, 0.76), rgba(31, 32, 34, 0.96));
  padding: 11px;
}

.quick-mode-structure-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.quick-mode-structure-card__icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border: 1px solid rgba(159, 192, 255, 0.32);
  border-radius: 7px;
  background: rgba(76, 139, 245, 0.16);
  color: #b9d0ff;
}

.quick-mode-structure-card__title {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.quick-mode-structure-card__title span,
.quick-mode-structure-card__select > span {
  color: rgba(244, 245, 247, 0.58);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.25;
  text-transform: uppercase;
}

.quick-mode-structure-card__title strong {
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-structure-card__count {
  flex: 0 0 auto;
  color: #9fc0ff;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.quick-mode-structure-card__summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px 8px;
  margin: 10px 0;
  color: rgba(244, 245, 247, 0.6);
  font-size: 10px;
}

.quick-mode-structure-card__summary strong {
  color: #f4f5f7;
  font-size: 12px;
}

.quick-mode-structure-card__summary span::before {
  content: '·';
  margin-right: 8px;
  color: rgba(159, 192, 255, 0.72);
}

.quick-mode-structure-card__select {
  display: grid;
  gap: 6px;
}

.quick-mode-structure-card__select select {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(159, 192, 255, 0.35);
  border-radius: 7px;
  background: #171819;
  color: #f4f5f7;
  cursor: pointer;
  padding: 0 9px;
  outline: none;
  font-size: 11px;
}

.quick-mode-structure-card__select select:focus-visible {
  border-color: #8eb9ff;
  box-shadow: 0 0 0 3px rgba(76, 139, 245, 0.16);
}

.quick-mode-structure-card__select select:disabled {
  cursor: wait;
  opacity: 0.68;
}

.quick-mode-structure-card__select small,
.quick-mode-structure-card__hint {
  margin: 0;
  color: rgba(244, 245, 247, 0.5);
  font-size: 10px;
  line-height: 1.4;
}

.quick-mode-structure-card__hint {
  margin-top: 9px;
}

.quick-mode-sidebar__title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quick-mode-sidebar__backmark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  color: #fff;
  font-size: 25px;
  font-weight: 300;
  line-height: 1;
  transform: rotate(45deg);
}

.quick-mode-sidebar__eyebrow {
  margin: 0 0 2px;
  color: #b9c2cf;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-transform: uppercase;
}

.quick-mode-sidebar h2 {
  margin: 0;
  color: #fff;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.1;
}

.quick-mode-sidebar__count {
  flex: 0 0 auto;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  white-space: nowrap;
}

.quick-mode-pages-card {
  margin-bottom: 14px;
  border: 1px solid rgba(76, 139, 245, 0.28);
  border-radius: 9px;
  background: linear-gradient(145deg, rgba(37, 57, 82, 0.78), rgba(28, 29, 30, 0.92));
  padding: 12px;
}

.quick-mode-page-summary {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.quick-mode-page-summary:focus-visible {
  outline: 2px solid #9fc0ff;
  outline-offset: 4px;
  border-radius: 6px;
}

.quick-mode-page-summary__icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border: 1px solid rgba(159, 192, 255, 0.3);
  border-radius: 8px;
  background: rgba(76, 139, 245, 0.16);
  color: #b9d0ff;
}

.quick-mode-page-summary__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.quick-mode-page-summary__copy small,
.quick-mode-page-summary__copy strong,
.quick-mode-page-summary__copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-summary__copy small {
  color: #9fc0ff;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.1em;
  line-height: 1.1;
  text-transform: uppercase;
}

.quick-mode-page-summary__copy strong {
  color: rgba(255, 255, 255, 0.94);
  font-size: 12px;
  line-height: 1.2;
}

.quick-mode-page-summary__copy span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
  line-height: 1.2;
}

.quick-mode-page-summary__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.6);
}

.quick-mode-page-summary__meta strong {
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
}

.quick-mode-page-summary__meta small {
  font-size: 9px;
}

.quick-mode-page-summary__meta svg,
.quick-mode-page-resize-toggle svg {
  transition: transform 0.18s ease;
}

.quick-mode-page-summary__hint {
  margin: 8px 0 0 39px;
  color: rgba(244, 245, 247, 0.58);
  font-size: 10px;
  line-height: 1.35;
}

.quick-mode-page-summary__hint span {
  color: rgba(159, 192, 255, 0.8);
}

.quick-mode-page-strip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  margin: 11px -2px 0;
  max-height: 238px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2px 4px 4px 2px;
  scrollbar-color: #4a6389 transparent;
  scrollbar-width: thin;
}

.quick-mode-page-thumb {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  background: #f8fafc;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16);
  cursor: pointer;
  padding: 0;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.quick-mode-page-thumb:hover {
  border-color: rgba(159, 192, 255, 0.8);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.25);
  transform: translateX(2px);
}

.quick-mode-page-thumb:focus-visible {
  outline: 2px solid #b9d0ff;
  outline-offset: 2px;
}

.quick-mode-page-thumb:not(.quick-mode-page-thumb--active) {
  opacity: 0.74;
}

.quick-mode-page-thumb--active {
  border-color: #79a9ff;
  box-shadow: 0 0 0 2px rgba(76, 139, 245, 0.36), 0 5px 14px rgba(0, 0, 0, 0.28);
}

.quick-mode-page-thumb > img {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
  object-fit: contain;
}

.quick-mode-page-thumb__fallback {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  background: linear-gradient(145deg, #33445d, #172033);
  color: #b9d0ff;
  padding: 4px;
  text-align: center;
}

.quick-mode-page-thumb__fallback small {
  max-width: 100%;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.72);
  font-size: 7px;
  font-weight: 700;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-thumb__number {
  position: absolute;
  top: 7px;
  left: 7px;
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.84);
  color: #fff;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
}

.quick-mode-page-thumb--active .quick-mode-page-thumb__number {
  background: #3475ed;
}

.quick-mode-page-thumb__label {
  position: absolute;
  right: 7px;
  bottom: 7px;
  max-width: calc(100% - 35px);
  overflow: hidden;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.78);
  color: rgba(255, 255, 255, 0.88);
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  padding: 5px 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-thumb__delete {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 3;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 8px;
  background: rgba(17, 24, 39, 0.86);
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  opacity: 0.94;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.24);
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease, opacity 0.16s ease;
}

.quick-mode-page-thumb__delete:hover:not(:disabled),
.quick-mode-page-thumb__delete:focus-visible {
  border-color: rgba(248, 113, 113, 0.9);
  background: rgba(127, 29, 29, 0.92);
  color: #fff;
  transform: scale(1.05);
}

.quick-mode-page-thumb__delete:focus-visible {
  outline: 2px solid #fecaca;
  outline-offset: 2px;
}

.quick-mode-page-thumb__delete:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.quick-mode-pages-card__details {
  margin-top: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 11px;
}

.quick-mode-pages-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.quick-mode-pages-card__eyebrow {
  margin: 0 0 3px;
  color: #9fc0ff;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.quick-mode-pages-card h3 {
  margin: 0;
  color: #fff;
  font-size: 14px;
  line-height: 1.2;
}

.quick-mode-pages-card__heading > span {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.76);
  padding: 4px 7px;
  font-size: 9px;
  font-weight: 800;
}

.quick-mode-pages-card__help {
  margin: 7px 0 10px;
  color: rgba(244, 245, 247, 0.58);
  font-size: 10px;
  line-height: 1.4;
}

.quick-mode-page-list {
  display: grid;
  gap: 5px;
  max-height: 196px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: #4a6389 transparent;
}

.quick-mode-page-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  background: rgba(17, 18, 20, 0.36);
  color: #fff;
  cursor: pointer;
  padding: 7px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.quick-mode-page-item:hover {
  border-color: rgba(159, 192, 255, 0.55);
  background: rgba(76, 139, 245, 0.12);
}

.quick-mode-page-item--active {
  border-color: #4c8bf5;
  background: rgba(76, 139, 245, 0.2);
  box-shadow: inset 3px 0 0 #4c8bf5;
}

.quick-mode-page-item__index {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  font-weight: 800;
}

.quick-mode-page-item--active .quick-mode-page-item__index {
  background: #3475ed;
  color: #fff;
}

.quick-mode-page-item__copy {
  min-width: 0;
  flex: 1;
}

.quick-mode-page-item__copy strong,
.quick-mode-page-item__copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-item__copy strong {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  line-height: 1.2;
}

.quick-mode-page-item__copy small {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
}

.quick-mode-page-item__status {
  flex: 0 0 auto;
  color: #b9d0ff;
  font-size: 9px;
  font-weight: 800;
}

.quick-mode-page-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 9px;
}

.quick-mode-page-action,
.quick-mode-page-resize-toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  padding: 8px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, opacity 0.16s ease;
}

.quick-mode-page-action:hover:not(:disabled),
.quick-mode-page-resize-toggle:hover:not(:disabled),
.quick-mode-page-resize-toggle[aria-expanded='true'] {
  border-color: rgba(159, 192, 255, 0.6);
  background: rgba(76, 139, 245, 0.15);
}

.quick-mode-page-action--primary {
  border-color: rgba(76, 139, 245, 0.62);
  background: rgba(52, 117, 237, 0.18);
}

.quick-mode-page-action:disabled,
.quick-mode-page-resize-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.quick-mode-page-action strong,
.quick-mode-page-action small,
.quick-mode-page-resize-toggle strong,
.quick-mode-page-resize-toggle small {
  display: block;
}

.quick-mode-page-action strong,
.quick-mode-page-resize-toggle strong {
  font-size: 10px;
  line-height: 1.25;
}

.quick-mode-page-action small,
.quick-mode-page-resize-toggle small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
  line-height: 1.2;
}

.quick-mode-page-resize-toggle {
  width: 100%;
  margin-top: 6px;
}

.quick-mode-page-resize-toggle__copy {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  min-width: 0;
}

.quick-mode-page-resize-toggle > span:last-child {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.72);
  font-size: 16px;
  font-weight: 300;
  line-height: 1;
}

.quick-mode-page-menu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-top: 6px;
  border: 1px solid rgba(159, 192, 255, 0.25);
  border-radius: 7px;
  background: rgba(12, 18, 27, 0.76);
  padding: 7px;
}

.quick-mode-page-menu > span {
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.5);
  font-size: 9px;
}

.quick-mode-page-menu button {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 5px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  padding: 6px;
  text-align: left;
}

.quick-mode-page-menu button:hover {
  border-color: #4c8bf5;
  background: rgba(76, 139, 245, 0.15);
}

.quick-mode-page-menu button strong,
.quick-mode-page-menu button small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-menu button strong {
  font-size: 9px;
}

.quick-mode-page-menu button small {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.44);
  font-size: 8px;
}

.quick-mode-sidebar__zone-picker {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.quick-mode-sidebar__zone-picker label {
  color: rgba(255, 255, 255, 0.58);
  font-size: 10px;
  font-weight: 700;
}

.quick-mode-sidebar__zone-picker select {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: #303133;
  color: rgba(255, 255, 255, 0.9);
  padding: 0 10px;
  outline: none;
  font-size: 11px;
}

.quick-mode-sidebar__zone-picker select:focus {
  border-color: rgba(76, 139, 245, 0.8);
}

.quick-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 0;
  border-radius: 5px 5px 0 0;
  background: #1c1d1e;
}

.quick-mode-tab {
  position: relative;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  transition: color 0.16s ease, background-color 0.16s ease;
}

.quick-mode-tab:hover {
  color: #fff;
}

.quick-mode-tab--active {
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-bottom-color: #4c8bf5;
  border-radius: 5px 5px 0 0;
  background: #343536;
  color: #fff;
}

.quick-mode-search-card,
.quick-mode-library-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0 0 5px 5px;
  background: #1f2022;
  color: #f4f5f7;
  padding: 12px;
}

.quick-mode-search-card h3,
.quick-mode-library-card h3 {
  margin: 0;
  color: #f4f5f7;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
}

.quick-mode-example {
  margin: 2px 0 11px;
  color: rgba(244, 245, 247, 0.62);
  font-size: 11px;
  font-weight: 700;
}

.quick-mode-example button {
  border: 0;
  background: transparent;
  color: #a9c7ff;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.quick-mode-search-card textarea {
  display: block;
  width: 100%;
  min-height: 164px;
  resize: vertical;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 13px;
  background: #171819;
  color: #f4f5f7;
  padding: 13px 12px;
  outline: none;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.28);
}

.quick-mode-search-card textarea::placeholder {
  color: rgba(244, 245, 247, 0.42);
}

.quick-mode-search-card textarea:focus {
  border-color: #4c8bf5;
  box-shadow: 0 0 0 3px rgba(76, 139, 245, 0.14);
}

.quick-mode-search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 43px;
  margin-top: 10px;
  border: 1px solid #2865d9;
  border-radius: 6px;
  background: #3475ed;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 2px 0 rgba(18, 63, 143, 0.2);
  transition: background-color 0.16s ease, opacity 0.16s ease, transform 0.16s ease;
}

.quick-mode-search-button:hover:not(:disabled) {
  background: #2866dc;
}

.quick-mode-search-button--outline {
  border: 1px solid #3475ed;
  background: rgba(52, 117, 237, 0.1);
  color: #a9c7ff;
  box-shadow: none;
}

.quick-mode-search-button--outline:hover:not(:disabled) {
  background: rgba(52, 117, 237, 0.2);
}

.quick-mode-search-button:active:not(:disabled) {
  transform: translateY(1px);
}

.quick-mode-search-button:disabled {
  cursor: wait;
  opacity: 0.68;
}

.quick-mode-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.38);
  border-top-color: #fff;
  border-radius: 999px;
  animation: quick-mode-spin 0.75s linear infinite;
}

.quick-mode-append-button {
  display: block;
  width: 100%;
  margin-top: 9px;
  border: 0;
  background: transparent;
  color: #9fc0ff;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.quick-mode-append-button:hover:not(:disabled) {
  color: #c8dcff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.quick-mode-append-button:disabled {
  cursor: not-allowed;
  color: rgba(244, 245, 247, 0.34);
}

.quick-mode-search-hint {
  margin: 12px 1px 1px;
  color: rgba(244, 245, 247, 0.48);
  font-size: 10px;
  line-height: 1.45;
}

.quick-mode-library-card {
  min-height: 0;
}

.quick-mode-library-heading > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quick-mode-library-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quick-mode-library-clear {
  flex: 0 0 auto;
  min-height: 29px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  border-radius: 6px;
  background: rgba(127, 29, 29, 0.16);
  color: #fca5a5;
  cursor: pointer;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 700;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.quick-mode-library-clear:hover,
.quick-mode-library-clear[aria-expanded='true'] {
  border-color: rgba(248, 113, 113, 0.7);
  background: rgba(127, 29, 29, 0.3);
}

.quick-mode-library-bulk-labels {
  position: relative;
  margin-top: 10px;
}

.quick-mode-library-bulk-labels__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 31px;
  border: 1px solid rgba(167, 139, 250, 0.34);
  border-radius: 6px;
  background: rgba(124, 58, 237, 0.12);
  color: #ddd6fe;
  cursor: pointer;
  padding: 0 9px;
  font-size: 10px;
  font-weight: 700;
  text-align: left;
}

.quick-mode-library-bulk-labels__toggle:hover:not(:disabled),
.quick-mode-library-bulk-labels__toggle[aria-expanded='true'] {
  border-color: rgba(167, 139, 250, 0.66);
  background: rgba(124, 58, 237, 0.2);
}

.quick-mode-library-bulk-labels__toggle:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.quick-mode-library-bulk-labels__toggle span {
  color: #c4b5fd;
  font-size: 15px;
  font-weight: 400;
  line-height: 1;
}

.quick-mode-library-bulk-labels__menu {
  display: grid;
  gap: 4px;
  margin-top: 5px;
  border: 1px solid rgba(167, 139, 250, 0.28);
  border-radius: 7px;
  background: #111214;
  padding: 6px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.quick-mode-library-bulk-labels__menu > span {
  color: rgba(244, 245, 247, 0.5);
  padding: 2px 4px 4px;
  font-size: 9px;
}

.quick-mode-library-bulk-labels__menu button {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 31px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(244, 245, 247, 0.78);
  cursor: pointer;
  padding: 3px 5px;
  font-size: 10px;
  text-align: left;
}

.quick-mode-library-bulk-labels__menu button:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #fff;
}

.quick-mode-library-bulk-labels__menu img {
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  object-fit: contain;
}

.quick-mode-library-bulk-labels__hint {
  display: block;
  margin-top: 4px;
  color: rgba(244, 245, 247, 0.42);
  font-size: 9px;
  line-height: 1.35;
}

.quick-mode-library-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 9px;
  background: rgba(52, 117, 237, 0.16);
  color: #a9c7ff;
  font-size: 16px;
  font-weight: 900;
}

.quick-mode-library-heading p {
  margin: 3px 0 0;
  color: rgba(244, 245, 247, 0.5);
  font-size: 11px;
}

.quick-mode-library-card > p {
  margin: 16px 0;
  color: rgba(244, 245, 247, 0.55);
  font-size: 11px;
  line-height: 1.55;
}

.quick-mode-library-empty {
  margin: 14px 0 !important;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  padding: 12px;
  text-align: center;
}

.quick-mode-product-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.quick-mode-product-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: #171819;
  overflow: hidden;
}

.quick-mode-product-card__main {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px;
}

.quick-mode-product-card__image {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: #0e0f10;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.quick-mode-product-card__image:hover,
.quick-mode-product-card__image:focus-visible {
  border-color: rgba(76, 139, 245, 0.8);
  background: rgba(76, 139, 245, 0.14);
  outline: none;
}

.quick-mode-product-card__image--missing {
  border-style: dashed;
  border-color: rgba(185, 208, 255, 0.32);
  background: rgba(76, 139, 245, 0.08);
}

.quick-mode-product-card__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.quick-mode-product-card__image-fallback {
  display: grid;
  place-items: center;
  gap: 1px;
  line-height: 1;
}

.quick-mode-product-card__image-fallback strong {
  color: #b9d0ff;
  font-size: 21px;
  font-weight: 500;
}

.quick-mode-product-card__image-fallback small {
  color: rgba(185, 208, 255, 0.78);
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.quick-mode-product-card__copy {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: 2px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.quick-mode-product-card__copy:hover,
.quick-mode-product-card__copy:focus-visible {
  outline: none;
}

.quick-mode-product-card__copy:focus-visible strong {
  color: #b9d0ff;
}

.quick-mode-product-card__copy strong,
.quick-mode-product-card__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-product-card__copy strong {
  color: #f4f5f7;
  font-size: 12px;
  font-weight: 800;
}

.quick-mode-product-card__copy small {
  color: rgba(244, 245, 247, 0.55);
  font-size: 10px;
}

.quick-mode-product-card__image-status {
  color: rgba(185, 208, 255, 0.7) !important;
  font-size: 8px !important;
}

.quick-mode-product-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 8px;
}

.quick-mode-product-card__actions button,
.quick-mode-library-confirm button {
  min-height: 25px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(244, 245, 247, 0.72);
  cursor: pointer;
  padding: 0 7px;
  font-size: 10px;
  font-weight: 700;
}

.quick-mode-product-card__actions button:hover,
.quick-mode-library-confirm button:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.quick-mode-product-card__actions .quick-mode-product-card__image-action {
  border-color: rgba(76, 139, 245, 0.52);
  background: rgba(76, 139, 245, 0.14);
  color: #b9d0ff;
}

.quick-mode-product-card__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.quick-mode-product-card__actions .quick-mode-product-card__delete {
  border-color: rgba(248, 113, 113, 0.28);
  color: #fca5a5;
}

.quick-mode-library-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid rgba(248, 113, 113, 0.2);
  background: rgba(127, 29, 29, 0.14);
  color: #fecaca;
  padding: 7px 8px;
  font-size: 10px;
}

.quick-mode-library-confirm--clear {
  margin-top: 10px;
  border: 1px solid rgba(248, 113, 113, 0.24);
  border-radius: 6px;
}

.quick-mode-library-confirm > div {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
}

.quick-mode-library-confirm .quick-mode-library-confirm__yes {
  border-color: rgba(248, 113, 113, 0.48);
  background: rgba(185, 28, 28, 0.32);
  color: #fee2e2;
}

.quick-mode-library-zones {
  display: grid;
  gap: 6px;
  margin-top: 15px;
}

.quick-mode-library-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  background: #171819;
  color: rgba(244, 245, 247, 0.72);
  cursor: pointer;
  padding: 0 10px;
  font-size: 11px;
  text-align: left;
}

.quick-mode-library-zone strong {
  color: #9fc0ff;
}

.quick-mode-library-zone:hover,
.quick-mode-library-zone--active {
  border-color: rgba(76, 139, 245, 0.65);
  background: rgba(52, 117, 237, 0.14);
  color: #d6e4ff;
}

.quick-mode-library-action {
  min-height: 36px;
  border: 1px solid #3475ed;
  border-radius: 6px;
  background: #3475ed;
  color: #fff;
  cursor: pointer;
  padding: 0 13px;
  font-size: 11px;
  font-weight: 700;
}

.quick-mode-library-action:hover {
  background: #2866dc;
}

.quick-mode-data-panel {
  margin-top: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  background: rgba(28, 29, 30, 0.78);
  overflow: hidden;
}

.quick-mode-data-panel__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 54px;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  text-align: left;
}

.quick-mode-data-panel__toggle:hover {
  background: rgba(255, 255, 255, 0.045);
}

.quick-mode-data-panel__toggle strong,
.quick-mode-data-panel__toggle small {
  display: block;
}

.quick-mode-data-panel__toggle strong {
  font-size: 13px;
  line-height: 1.2;
}

.quick-mode-data-panel__toggle small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
}

.quick-mode-data-panel__chevron {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  font-weight: 400;
}

.quick-mode-data-panel__body {
  padding: 0 10px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.quick-mode-data-panel__help {
  margin: 10px 2px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  line-height: 1.45;
}

.quick-mode-validity-prompt {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(7, 10, 17, 0.72);
  padding: 18px;
  backdrop-filter: blur(7px);
}

.quick-mode-validity-prompt__card {
  width: min(640px, 100%);
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  border: 1px solid rgba(159, 192, 255, 0.38);
  border-radius: 20px;
  background: linear-gradient(155deg, #263957 0%, #171c25 100%);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.46), 0 0 0 4px rgba(76, 139, 245, 0.08);
  color: #fff;
  padding: clamp(20px, 4vw, 30px);
}

.quick-mode-validity-prompt__eyebrow {
  margin: 0;
  color: #9fc0ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.quick-mode-validity-prompt h2 {
  margin: 8px 0 0;
  color: #fff;
  font-size: clamp(24px, 4vw, 30px);
  line-height: 1.14;
}

.quick-mode-validity-prompt__help {
  max-width: 52ch;
  margin: 10px 0 22px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 14px;
  line-height: 1.45;
}

.quick-mode-validity-options {
  display: grid;
  gap: 10px;
}

.quick-mode-validity-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  padding: 14px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.quick-mode-validity-option:hover {
  border-color: rgba(159, 192, 255, 0.7);
  background: rgba(76, 139, 245, 0.16);
  transform: translateY(-1px);
}

.quick-mode-validity-option--active {
  border-color: rgba(159, 192, 255, 0.82);
  background: rgba(76, 139, 245, 0.22);
  box-shadow: inset 4px 0 0 #76a8ff;
}

.quick-mode-validity-option:focus-visible,
.quick-mode-validity-prompt__confirm:focus-visible,
.quick-mode-validity-prompt__dates input:focus-visible {
  outline: 3px solid rgba(159, 192, 255, 0.55);
  outline-offset: 2px;
}

.quick-mode-validity-option-radio {
  position: relative;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-radius: 50%;
}

.quick-mode-validity-option--active .quick-mode-validity-option-radio {
  border-color: #9fc0ff;
  background: #76a8ff;
  box-shadow: inset 0 0 0 4px #20304b;
}

.quick-mode-validity-option-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.quick-mode-validity-option strong {
  font-size: 15px;
  font-weight: 800;
}

.quick-mode-validity-option small {
  color: rgba(255, 255, 255, 0.54);
  font-size: 12px;
  line-height: 1.4;
}

.quick-mode-validity-prompt__dates {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  border: 1px solid rgba(159, 192, 255, 0.22);
  border-radius: 12px;
  background: rgba(9, 16, 29, 0.22);
  padding: 15px;
}

.quick-mode-validity-prompt__dates--range {
  grid-template-columns: 1fr 1fr;
}

.quick-mode-validity-section-heading {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.quick-mode-validity-section-number {
  display: grid;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: rgba(118, 168, 255, 0.18);
  color: #bcd2ff;
  font-size: 12px;
  font-weight: 800;
}

.quick-mode-validity-section-heading > span:last-child {
  display: grid;
  gap: 2px;
}

.quick-mode-validity-section-heading strong {
  font-size: 13px;
}

.quick-mode-validity-section-heading small {
  color: rgba(255, 255, 255, 0.54);
  font-size: 11px;
}

.quick-mode-validity-prompt__dates label,
.quick-mode-validity-mode {
  display: grid;
  gap: 5px;
}

.quick-mode-validity-prompt__dates label > span,
.quick-mode-validity-mode > span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  font-weight: 700;
}

.quick-mode-validity-prompt__dates input,
.quick-mode-validity-mode select {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: #303b4f;
  color: rgba(255, 255, 255, 0.92);
  color-scheme: dark;
  outline: none;
  padding: 0 10px;
  font-size: 14px;
}

.quick-mode-validity-prompt__dates input:focus,
.quick-mode-validity-mode select:focus {
  border-color: rgba(159, 192, 255, 0.9);
}

.quick-mode-validity-prompt__stocks {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin: 13px 0 0;
  border: 1px solid rgba(159, 192, 255, 0.18);
  border-radius: 12px;
  background: rgba(76, 139, 245, 0.09);
  color: rgba(255, 255, 255, 0.68);
  padding: 14px;
  font-size: 12px;
  line-height: 1.4;
}

.quick-mode-validity-stocks-hint {
  margin: 13px 0 0;
  border: 1px solid rgba(159, 192, 255, 0.18);
  border-radius: 7px;
  background: rgba(76, 139, 245, 0.09);
  color: rgba(255, 255, 255, 0.68);
  padding: 9px 10px;
  font-size: 10px;
  line-height: 1.4;
}

.quick-mode-validity-stocks-icon {
  display: grid;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: rgba(118, 168, 255, 0.2);
  color: #bcd2ff;
  font-size: 13px;
  font-weight: 800;
}

.quick-mode-validity-prompt__stocks > span:last-child {
  display: grid;
  gap: 3px;
}

.quick-mode-validity-prompt__stocks strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
}

.quick-mode-validity-prompt__stocks small {
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
}

.quick-mode-validity-preview {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  border: 1px solid rgba(118, 168, 255, 0.34);
  border-radius: 12px;
  background: rgba(118, 168, 255, 0.11);
  padding: 14px 15px;
}

.quick-mode-validity-preview-label {
  color: #bcd2ff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.quick-mode-validity-preview strong {
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  line-height: 1.45;
}

.quick-mode-validity-prompt__error {
  margin: 12px 0 0;
  color: #ffb4b4;
  font-size: 12px;
  line-height: 1.35;
}

.quick-mode-validity-prompt__confirm {
  width: 100%;
  min-height: 48px;
  margin-top: 18px;
  border: 1px solid #3475ed;
  border-radius: 10px;
  background: #3475ed;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.quick-mode-validity-prompt__confirm:hover {
  background: #2866dc;
}

.quick-mode-validity-prompt__confirm:active {
  transform: translateY(1px);
}

.quick-mode-validity-card,
.quick-mode-data-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 43px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
}

.quick-mode-validity-mode {
  margin: 7px 0;
}

.quick-mode-validity-mode select {
  min-height: 31px;
  border-color: rgba(255, 255, 255, 0.14);
  background: #303133;
  font-size: 10px;
}

.quick-mode-date-grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.quick-mode-data-row + .quick-mode-data-row {
  margin-top: 5px;
}

.quick-mode-data-row__copy {
  min-width: 0;
  flex: 1;
}

.quick-mode-data-row__copy strong,
.quick-mode-data-row__copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-data-row__copy strong {
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 700;
}

.quick-mode-data-row__copy small {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 9px;
}

.quick-mode-switch {
  position: relative;
  width: 30px;
  height: 17px;
  flex: 0 0 30px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #4a4c50;
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.quick-mode-switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.16s ease;
}

.quick-mode-switch--active {
  background: #3475ed;
}

.quick-mode-switch--active span {
  transform: translateX(13px);
}

.quick-mode-date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 7px 0;
}

.quick-mode-date-grid label {
  display: grid;
  gap: 4px;
}

.quick-mode-date-grid label > span {
  color: rgba(255, 255, 255, 0.46);
  font-size: 9px;
  font-weight: 700;
}

.quick-mode-date-grid input {
  width: 100%;
  min-height: 31px;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  background: #303133;
  color: rgba(255, 255, 255, 0.86);
  color-scheme: dark;
  outline: none;
  font-size: 10px;
}

.quick-mode-date-grid input:focus {
  border-color: rgba(76, 139, 245, 0.85);
}

.quick-mode-offer-scope {
  display: grid;
  gap: 6px;
  margin: 8px 0 9px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.025);
}

.quick-mode-offer-scope label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.quick-mode-offer-scope label > span {
  color: rgba(255, 255, 255, 0.52);
  font-size: 9px;
  font-weight: 700;
}

.quick-mode-offer-scope select,
.quick-mode-offer-scope input {
  width: 100%;
  min-height: 31px;
  padding: 0 7px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  background: #303133;
  color: rgba(255, 255, 255, 0.86);
  outline: none;
  font-size: 10px;
}

.quick-mode-offer-scope select:focus,
.quick-mode-offer-scope input:focus {
  border-color: rgba(76, 139, 245, 0.85);
}

.quick-mode-offer-scope__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  gap: 6px;
}

.quick-mode-offer-scope__store {
  grid-column: 1 / -1;
}

.quick-mode-offer-scope > small {
  color: rgba(255, 255, 255, 0.42);
  font-size: 9px;
  line-height: 1.35;
}

.quick-mode-business-list {
  display: grid;
  gap: 5px;
}

.quick-mode-profile-action {
  width: 100%;
  min-height: 34px;
  margin-top: 9px;
  border: 1px solid rgba(76, 139, 245, 0.55);
  border-radius: 5px;
  background: rgba(52, 117, 237, 0.12);
  color: #9fc0ff;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

.quick-mode-profile-action:hover {
  background: rgba(52, 117, 237, 0.22);
  color: #fff;
}

.quick-mode-sidebar__footer {
  flex: 0 0 auto;
  padding: 14px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(37, 38, 39, 0.72) 0%, #252627 28%);
}

.quick-mode-sidebar__footer-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  border: 1px solid #3475ed;
  border-radius: 7px;
  background: #3475ed;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: background-color 0.16s ease, opacity 0.16s ease, transform 0.16s ease;
}

.quick-mode-sidebar__footer-action:hover:not(:disabled) {
  background: #2866dc;
}

.quick-mode-sidebar__footer-action:active:not(:disabled) {
  transform: translateY(1px);
}

.quick-mode-sidebar__footer-action:disabled {
  cursor: wait;
  opacity: 0.68;
}

.quick-mode-sidebar__footer-action-mark {
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 999px;
  color: #fff;
  font-size: 15px;
  font-weight: 400;
  line-height: 1;
}

.quick-mobile-action-dock,
.quick-mobile-flow {
  display: none;
}

.quick-mobile-import-copy {
  margin: 7px 0 12px;
  color: rgba(244, 245, 247, 0.62);
  font-size: 12px;
  line-height: 1.45;
}

.quick-mobile-advanced-options {
  margin: 12px 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
}

.quick-mobile-advanced-options summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  cursor: pointer;
  color: rgba(244, 245, 247, 0.88);
  list-style: none;
  padding: 0 13px;
  font-size: 12px;
  font-weight: 750;
}

.quick-mobile-advanced-options summary::-webkit-details-marker {
  display: none;
}

.quick-mobile-advanced-options summary::after {
  content: '+';
  order: 3;
  color: #a9c7ff;
  font-size: 17px;
  font-weight: 400;
}

.quick-mobile-advanced-options[open] summary::after {
  content: '−';
}

.quick-mobile-advanced-options summary small {
  margin-left: auto;
  color: rgba(244, 245, 247, 0.46);
  font-size: 10px;
  font-weight: 600;
}

.quick-mobile-advanced-options__body {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
}

@keyframes quick-mode-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 767px) {
  .quick-mode-controls-layout {
    position: absolute;
    right: 12px;
    left: 12px;
    top: clamp(150px, 34vh, 220px);
    /* O dock de ferramentas ocupa uma faixa própria no rodapé do palco. */
    bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    z-index: 230;
    width: auto;
    height: auto;
    max-height: none;
    border: 1px solid rgba(76, 139, 245, 0.35);
    border-radius: 10px;
    background: rgba(37, 38, 39, 0.97);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
  }

  .quick-mode-sidebar {
    position: static;
    width: auto;
    height: 100%;
    max-height: none;
    flex: 1 1 0;
    overflow: hidden;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 9px 0 0 9px;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .quick-mode-pages-rail {
    flex: 0 0 154px;
    width: 154px;
    height: 100%;
    border-left: 0;
    border-radius: 0 9px 9px 0;
  }

  .quick-mode-pages-rail__header {
    padding: 14px 9px 11px;
  }

  .quick-mode-pages-rail__header span {
    font-size: 10px;
  }

  .quick-mode-pages-rail__header small {
    font-size: 8px;
  }

  .quick-mode-pages-rail__header-actions > strong {
    min-width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .quick-mode-pages-rail__manage {
    width: 24px;
    height: 24px;
  }

  .quick-mode-pages-rail__list {
    gap: 9px;
    padding: 10px 7px 12px;
  }

  .quick-mode-pages-rail .quick-mode-page-thumb {
    width: 100% !important;
  }

  .quick-mode-pages-rail__add {
    width: 132px;
    min-height: 58px;
  }

  .quick-mode-pages-rail .quick-mode-page-thumb__label {
    right: 5px;
    bottom: 5px;
    font-size: 7px;
    padding: 4px 5px;
  }

  .quick-mode-sidebar__content {
    overflow-y: auto;
    padding: 12px;
  }

  .quick-mode-sidebar__topbar {
    margin-bottom: 10px;
  }

  .quick-mode-sidebar__eyebrow,
  .quick-mode-search-hint {
    display: none;
  }

  .quick-mode-sidebar__footer {
    padding: 10px 12px 12px;
  }

  .quick-mode-sidebar__footer-action {
    min-height: 38px;
    font-size: 11px;
  }

  .quick-mode-sidebar h2 {
    font-size: 16px;
  }

  .quick-mode-sidebar__backmark {
    width: 26px;
    height: 26px;
    font-size: 21px;
  }

  .quick-mode-search-card textarea {
    min-height: 90px;
  }
}

@media (max-width: 520px) {
  .quick-mode-validity-prompt__card {
    padding: 18px;
  }

  .quick-mode-validity-prompt h2 {
    font-size: 23px;
  }

  .quick-mode-validity-prompt__dates--range {
    grid-template-columns: 1fr;
  }

  .quick-mode-pages-rail {
    flex-basis: 128px;
    width: 128px;
  }

  .quick-mode-pages-rail .quick-mode-page-thumb {
    width: 100% !important;
  }

  .quick-mode-pages-rail__add {
    width: 106px;
  }

  .quick-mode-pages-rail__header small {
    display: none;
  }
}

</style>

<style scoped>
.quick-mobile-sections { display:none; }
@media (max-width:767px) {
 .quick-mode-controls-layout { flex-direction:column; left:8px; right:8px; border-radius:18px; background:#242528; backdrop-filter:none; }
 .quick-mobile-sections { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; padding:6px; flex-shrink:0; border-bottom:1px solid #3a3b40; }
 .quick-mobile-sections button { min-height:44px; border-radius:11px; color:#c4c4ce; font-size:13px; font-weight:600; }
 .quick-mobile-sections button[aria-pressed=true] { background:#3d355b; color:#e8ddff; }
 .quick-mode-controls-layout[data-mobile-section=preview] { top:auto; height:58px; }
 .quick-mode-controls-layout[data-mobile-section=preview] .quick-mode-sidebar, .quick-mode-controls-layout[data-mobile-section=preview] .quick-mode-pages-rail,
 .quick-mode-controls-layout[data-mobile-section=products] .quick-mode-pages-rail,
 .quick-mode-controls-layout[data-mobile-section=pages] .quick-mode-sidebar { display:none; }
 .quick-mode-sidebar, .quick-mode-pages-rail { width:100%; flex:1; min-height:0; border:0; border-radius:0 0 18px 18px; }
 .quick-mode-controls-layout input:not([type=checkbox]), .quick-mode-controls-layout textarea, .quick-mode-controls-layout select { font-size:16px; }
 .quick-mode-controls-layout button { min-height:44px; }
}

</style>

<style scoped>
@media(max-width:767px) {
 .quick-mode-controls-layout { bottom:calc(116px + env(safe-area-inset-bottom, 0px)); }
}

</style>

<style scoped>
.quick-mobile-structure-toggle { display:none; }
@media(max-width:767px) {
 .quick-mode-controls-layout:not([data-mobile-section=preview]) { position:fixed;top:auto;bottom:calc(8px + var(--mobile-keyboard-inset, 0px) + env(safe-area-inset-bottom, 0px));height:calc(var(--mobile-visible-height, 100dvh) - 64px - env(safe-area-inset-bottom, 0px));max-height:none;z-index:500;border-color:#ffffff20; }
 .quick-mode-sidebar__topbar {padding-bottom:10px;}
 .quick-mode-structure-card {padding:8px 12px;margin-bottom:12px;}
 .quick-mobile-structure-toggle {display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;font-size:13px;color:#e4e4e7;}
 .quick-mobile-structure-toggle span:last-child {color:#c4b5fd;font-size:12px;}
 .quick-structure-details {display:none;}
 .quick-structure-details.is-expanded {display:block;padding-top:8px;}
 .quick-mode-sidebar__content {min-height:0;overscroll-behavior:contain;}
 .quick-mode-sidebar__footer {flex-shrink:0;padding:10px 12px;}
 .quick-mode-sidebar__footer-action {min-height:48px;font-size:14px;}
}

</style>

<style scoped>
@media(max-width:767px) {
 .quick-mobile-sections {position:fixed;left:0;right:0;bottom:var(--mobile-keyboard-inset,0px);z-index:700;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #ffffff14;border-bottom:0;background:#18181b;}
 .quick-mobile-sections button {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:50px;font-size:10px;font-weight:500;border-radius:12px;touch-action:manipulation;}
 .quick-mobile-sections button:last-child {color:#c4b5fd;}
 .quick-mode-controls-layout[data-mobile-section=preview] {position:fixed;top:auto;bottom:0;height:0;border:0;background:transparent;box-shadow:none;}
 .quick-mode-controls-layout[data-mobile-section=products],.quick-mode-controls-layout[data-mobile-section=pages],.quick-mode-controls-layout[data-mobile-section=tools] {bottom:calc(76px + var(--mobile-keyboard-inset,0px) + env(safe-area-inset-bottom,0px));height:calc(var(--mobile-visible-height,100dvh) - 132px - env(safe-area-inset-bottom,0px));}
 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-pages-rail {display:none;}
 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-sidebar__zone-picker,.quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-tabs,.quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-search-card,.quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-library-card,.quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-sidebar__footer {display:none;}
 .quick-mode-sidebar__backmark {display:none;}
}

</style>

<style scoped>
@media (max-width:767px) {
 .quick-mobile-action-dock {position:fixed;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));left:12px;z-index:650;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid rgba(147,197,253,.38);border-radius:20px;background:linear-gradient(135deg,rgba(19,39,79,.98),rgba(67,38,102,.98));box-shadow:0 14px 38px rgba(0,0,0,.42);padding:12px;transition:opacity .16s ease,transform .16s ease;}
 .quick-mobile-action-dock.is-hidden {pointer-events:none;opacity:0;transform:translateY(16px);}
 .quick-mobile-action-dock__copy {display:grid;gap:3px;min-width:0;}
 .quick-mobile-action-dock__copy > span {color:#bfdbfe;font-size:9px;font-weight:800;letter-spacing:.12em;line-height:1.1;text-transform:uppercase;}
 .quick-mobile-action-dock__copy strong {overflow:hidden;color:#fff;font-size:14px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap;}
 .quick-mobile-action-dock__copy small {display:-webkit-box;overflow:hidden;color:#cbd5e1;font-size:10px;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2;}
 .quick-mobile-action-dock button {display:flex;align-items:center;justify-content:center;gap:6px;min-height:48px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:#fff;color:#172554;padding:0 12px;font-size:12px;font-weight:800;box-shadow:0 4px 14px rgba(0,0,0,.18);touch-action:manipulation;}
 .quick-mobile-action-dock button:active:not(:disabled) {transform:translateY(1px);}
 .quick-mobile-action-dock button:disabled {opacity:.58;}

 .quick-mobile-flow {display:flex;align-items:center;justify-content:space-between;gap:7px;margin:0 0 16px;color:rgba(244,245,247,.52);font-size:10px;font-weight:750;}
 .quick-mobile-flow__step {display:flex;align-items:center;gap:5px;white-space:nowrap;}
 .quick-mobile-flow__step b {display:grid;width:20px;height:20px;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:rgba(244,245,247,.68);font-size:10px;}
 .quick-mobile-flow__step.is-active {color:#dbeafe;}
 .quick-mobile-flow__step.is-active b {border-color:#60a5fa;background:#2563eb;color:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.14);}
 .quick-mobile-flow__line {height:1px;min-width:10px;flex:1;background:rgba(255,255,255,.14);}

 .quick-mode-controls-layout[data-mobile-section=products],.quick-mode-controls-layout[data-mobile-section=tools] {border-radius:22px 22px 16px 16px;background:linear-gradient(165deg,#232b3d 0%,#1d1d23 56%,#18181b 100%);box-shadow:0 -12px 38px rgba(0,0,0,.36);}
 .quick-mode-sidebar {border-radius:inherit;}
 .quick-mode-sidebar__content {padding:18px 14px;}
 .quick-mode-sidebar__topbar {align-items:center;min-height:34px;margin-bottom:15px;padding:0 2px;}
 .quick-mode-sidebar h2 {font-size:20px;letter-spacing:-.02em;}
 .quick-mode-sidebar__count {margin-top:0;border:1px solid rgba(147,197,253,.2);border-radius:999px;background:rgba(59,130,246,.1);color:#bfdbfe;padding:5px 8px;font-size:10px;font-weight:750;}
 .quick-mode-tabs {min-height:48px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(8,14,27,.46);padding:4px;}
 .quick-mode-tab {min-height:38px!important;border:0!important;border-radius:10px!important;color:rgba(226,232,240,.64);font-size:12px;}
 .quick-mode-tab--active {background:rgba(96,165,250,.17);box-shadow:inset 0 0 0 1px rgba(147,197,253,.22);color:#eff6ff;}
 .quick-mode-search-card,.quick-mode-library-card {border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(8,12,21,.34);padding:15px;}
 .quick-mode-search-card h3 {font-size:18px;letter-spacing:-.02em;}
 .quick-mobile-import-copy {margin-top:8px;color:#b9c7db;font-size:12px;}
 .quick-mode-example {margin-bottom:10px;font-size:11px;}
 .quick-mode-search-card textarea {min-height:144px;border-color:rgba(147,197,253,.28);border-radius:14px;background:rgba(2,6,23,.6);padding:14px;font-size:16px;line-height:1.45;}
 .quick-mode-search-button {min-height:52px;margin-top:14px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#6d28d9);font-size:14px;box-shadow:0 10px 22px rgba(37,99,235,.24);}
 .quick-mode-search-button:hover:not(:disabled) {background:linear-gradient(135deg,#3b82f6,#7c3aed);}
 .quick-mode-search-button:disabled {cursor:not-allowed;opacity:.45;}
 .quick-fill-option {margin:12px 0;border-color:rgba(147,197,253,.16);border-radius:14px;background:rgba(255,255,255,.045);padding:13px;}
 .quick-fill-option strong {font-size:13px;}
 .quick-fill-option small {font-size:11px;}
 .quick-mobile-advanced-options {border-color:rgba(147,197,253,.14);background:rgba(255,255,255,.025);}
 .quick-mobile-advanced-options summary {min-height:47px;padding:0 13px;font-size:12px;}
 .quick-mobile-advanced-options__body {padding:12px;}
 .quick-product-advanced-option {border-color:rgba(147,197,253,.16)!important;border-radius:13px!important;background:rgba(255,255,255,.035);}
 .quick-mode-sidebar__footer {border-top-color:rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(24,24,27,.15),#18181b 45%);padding:11px 14px calc(12px + env(safe-area-inset-bottom,0px));}
 .quick-mode-sidebar__footer-action {min-height:52px!important;border-radius:14px;background:linear-gradient(135deg,#2563eb,#6d28d9);font-size:14px!important;}
 .quick-mode-sidebar__footer-action:hover:not(:disabled) {background:linear-gradient(135deg,#3b82f6,#7c3aed);}

 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-sidebar__topbar {margin-bottom:18px;}
 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-data-panel {margin-top:0;}
 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-data-panel__toggle {min-height:58px;border-radius:15px;background:rgba(59,130,246,.12);}
 .quick-mode-controls-layout[data-mobile-section=tools] .quick-mode-data-panel__body {margin-top:10px;border-radius:15px;}
}
@media (max-width:390px) {
 .quick-mobile-action-dock {right:8px;left:8px;gap:8px;padding:10px;}
 .quick-mobile-action-dock button {padding:0 10px;font-size:11px;}
 .quick-mobile-action-dock__copy strong {font-size:13px;}
 .quick-mobile-flow {gap:5px;font-size:9px;}
 .quick-mobile-flow__line {min-width:5px;}
}


/* A single, persistent action leads to product review on every screen size. */
.quick-review-ready { display:flex; gap:12px; margin:16px 0; padding:16px; border:1px solid #60a5fa55; border-radius:14px; background:#2563eb14; }
.quick-review-ready__icon { color:#93c5fd; flex-shrink:0; padding-top:2px; }
.quick-review-ready strong { display:block; color:#f8fafc; font-size:15px; }
.quick-review-ready p { margin:5px 0 0; color:#cbd5e1; font-size:13px; line-height:1.5; }
.quick-import-mode { border:0; padding:0; margin:18px 0; min-width:0; }
.quick-import-mode legend { color:#f1f5f9; font-size:13px; font-weight:700; margin-bottom:8px; }
.quick-import-mode label { display:flex; gap:10px; padding:12px; margin:6px 0; border:1px solid #ffffff20; border-radius:10px; cursor:pointer; }
.quick-import-mode label.is-selected { border-color:#60a5fa; background:#2563eb1a; }
.quick-import-mode input { accent-color:#3b82f6; margin:3px 0 0; flex-shrink:0; }
.quick-import-mode strong { display:block; font-size:13px; color:#f1f5f9; }
.quick-import-mode small { display:block; font-size:12px; color:#b6bfce; margin-top:4px; line-height:1.4; }
.quick-review-footer-hint { margin:0 0 9px; color:#cbd5e1; font-size:12px; line-height:1.4; text-align:center; }
.quick-mode-sidebar__footer-action:focus-visible, .quick-import-mode label:focus-within { outline:3px solid #93c5fd; outline-offset:3px; }
.quick-mode-search-card textarea { line-height:1.6; }
</style>

<style scoped>
.quick-list-or { margin: 12px 0; text-align: center; color: #a1a1aa; font-size: 12px; }
.quick-list-file-button { display: block; width: 100%; min-height: 44px; margin-bottom: 10px; border: 1px solid #52525b; border-radius: 12px; color: #f4f4f5; font-weight: 600; transition: background .15s; }
.quick-list-file-button:hover:not(:disabled) { background: #3f3f46; }
.quick-list-file-button:disabled { opacity: .5; }
</style>

<style scoped>
.quick-mode-layout-options { margin-bottom: 16px; border: 1px solid #3f3f46; border-radius: 12px; padding: 0 14px; }
.quick-mode-layout-options summary { padding: 14px 0; color: #f4f4f5; font-size: 13px; font-weight: 600; cursor: pointer; }
.quick-mode-layout-options > label { margin: 0 0 14px; }
</style>
