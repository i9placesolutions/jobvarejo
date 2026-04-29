<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { Sparkles, X, Check, AlertCircle, Loader2, Upload, Plus, Play, RefreshCw, ChevronDown, SlidersHorizontal, Settings2, Wand2 } from 'lucide-vue-next'
import { useProductProcessor, type SmartProduct, type SmartProductImageCandidate } from '../composables/useProductProcessor'
import { toWasabiDirectUrl } from '~/utils/storageProxy'
import type { LabelTemplate } from '~/types/label-template'

type ImportTargetMode = 'zone' | 'multi-frame'
type ImportSourceMode = 'manual' | 'paste-list' | 'file-import'
type ImageBgPolicy = 'auto' | 'never' | 'always'
type ImageMatchMode = 'precise' | 'fast'
type ImageQuickAction = 'search' | 'upload' | 'storage' | 'reprocess'
type FrameCandidate = { id: string; name: string; left?: number; top?: number }
type ZoneCandidate = { id: string; name: string; left?: number; top?: number; existingCount?: number; frameName?: string }
type FrameAssignment = { productId: string; frameId: string | null }
type ZoneAssignment = { productId: string; zoneId: string | null }
type ProductImportOptions = {
    mode?: 'replace' | 'append'
    labelTemplateId?: string
    targetMode?: ImportTargetMode
    sourceMode?: ImportSourceMode
    selectedFrameIds?: string[]
    frameAssignments?: FrameAssignment[]
    zoneAssignments?: ZoneAssignment[]
    countRule?: 'min'
    cardsPerFrame?: 1
    imageMatchMode?: ImageMatchMode
    imageConcurrency?: number
}

type ImageNextAction = {
    action: 'search' | 'upload' | 'storage' | 'reprocess'
    label: string
    helper: string
}

type ReviewRowWithMeta = {
    productId: string
    index: number
    product: SmartProduct
    imageStatusMeta: ImageStatusMeta
    imageNextAction: ImageNextAction | null
}
type ReviewFilter = 'all' | 'approved' | 'suspect' | 'blocked' | 'pending'
type ReviewDecisionState = 'approved' | 'ambiguous' | 'blocked' | 'pending'

const props = defineProps<{
    modelValue: boolean
    initialProducts?: SmartProduct[]
    showImportMode?: boolean
    existingCount?: number
    initialImportMode?: 'replace' | 'append'
    labelTemplates?: LabelTemplate[]
    initialLabelTemplateId?: string
    availableFramesForImport?: FrameCandidate[]
    availableZonesForImport?: ZoneCandidate[]
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'import', products: SmartProduct[], opts?: ProductImportOptions): void
}>()

const { getApiAuthHeaders } = useApiAuth()
const fetchUntyped = $fetch as unknown as (url: string, options?: any) => Promise<any>

const textInput = ref('')
const step = ref<'input' | 'review'>('input')
const listFileInput = ref<HTMLInputElement | null>(null)
const reviewImageUploadInput = ref<HTMLInputElement | null>(null)
const importMode = ref<'replace' | 'append'>('replace')
const targetMode = ref<ImportTargetMode>('zone')
const importSource = ref<ImportSourceMode>('manual')
const selectedFrameIds = ref<string[]>([])
const frameAssignmentsMap = ref<Record<string, string | null>>({})
const zoneAssignmentsMap = ref<Record<string, string | null>>({})
// Importacao inteligente: por padrao, queremos remover o fundo das imagens encontradas.
const imageBgPolicy = ref<ImageBgPolicy>('always')
const isSubmittingImport = ref(false)
const appendBaseProducts = ref<SmartProduct[] | null>(null)
const reviewFilter = ref<ReviewFilter>('all')
const zoneFilterId = ref<string | null>(null)
const reviewSuggestionMap = ref<Record<string, SmartProductImageCandidate[]>>({})
const reviewSuggestionLoadingMap = ref<Record<string, boolean>>({})
const reviewSuggestionErrorMap = ref<Record<string, string | null>>({})

const LIST_FILE_ACCEPT = 'image/*,.csv,.tsv,.xlsx,.xls,.pdf,text/plain'
const REVIEW_PAGE_SIZE = 80
const clampImageConcurrency = (value: number): number => Math.min(8, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 0))
const clampImageMatchMode = (value: string): ImageMatchMode => String(value) === 'fast' ? 'fast' : 'precise'

// Composable
const { 
    products, 
    isParsing, 
    parsingError, 
    parseText, 
    parseFile,
    processProductImage, 
    applyImageCandidate,
    processAllImages, 
    imageQueueState,
    pauseImageProcessing,
    resumeImageProcessing,
    cancelImageProcessing,
    resetImageProcessingState,
    removeProduct 
} = useProductProcessor()

const imageMatchMode = ref<ImageMatchMode>('precise')
const imageConcurrency = ref<number>(4)
const reviewPage = ref(1)
const isQueuePaused = computed(() => imageQueueState.value.paused)
const isImageQueueRunning = computed(() => imageQueueState.value.running)
const expandedAdvancedRows = ref<Set<string>>(new Set())
const reviewContainerRef = ref<HTMLElement | null>(null)
const activeReviewRowIndex = ref<number | null>(null)
const pendingReviewUploadIndex = ref<number | null>(null)

const getImageQueueModeLabel = (mode: ImageMatchMode) => (mode === 'fast' ? 'Busca rápida' : 'Busca precisa')
const imageSourceFromProvider = (provider?: string): string => {
    const p = String(provider || '').trim().toLowerCase()
    if (!p) return 'ia'
    if (p.startsWith('cache')) return 'cache'
    if (p.startsWith('internal') || p === 'registry') return 's3'
    if (p.startsWith('ocr+')) return 'ia'
    if (p === 'manual' || p === 'manual-fallback' || p === 'manual-presigned') return 'manual'
    if (p === 'network' || p === 'server') return 'sistema'
    if (p === 'external-disabled' || p === 'external') return 'ia'
    if (p === 'serper' || p === 'google') return 'ia'
    return p
}
const imageQueueActionLabel = computed(() => {
    if (isImageQueueRunning.value) {
        return isQueuePaused.value ? 'Retomar busca' : 'Pausar busca'
    }
    return isQueuePaused.value ? 'Retomar busca' : 'Processar imagens'
})
const imageBgPolicyLabel = computed(() => {
    if (imageBgPolicy.value === 'always') return 'Fundo removido'
    if (imageBgPolicy.value === 'never') return 'Fundo original'
    return 'Fundo automatico'
})
const reviewOperationLabel = computed(() => imageQueueProgress.value.status || 'Pronta para revisar')
const canRunImageQueue = computed(() => products.value.length > 0)
const showImageQueueControls = computed(() => Boolean(products.value?.length))

const imageQueueProgress = computed(() => {
    const state = imageQueueState.value
    const total = state.total || 0
    const done = state.done || 0
    const retrying = state.retrying || 0
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
    let status = ''
    if (total > 0) {
        if (state.cancelled) status = 'Interrompido'
        else if (done >= total) status = 'Concluído'
        else if (isQueuePaused.value) status = 'Pausado'
        else if (state.running) status = 'Processando'
    }

    return {
        done,
        total,
        failed: state.failed,
        retrying,
        active: state.inFlight,
        percent,
        status
    }
})

const stopImageQueue = () => {
    cancelImageProcessing()
}

const formatConfidence = (value?: number): string => {
    if (!Number.isFinite(Number(value))) return '—'
    return Math.max(0, Math.min(1, Number(value))).toFixed(2)
}

const getImageConfidenceTone = (value?: number) => {
    if (!Number.isFinite(Number(value))) return 'unknown'
    const normalized = Math.max(0, Math.min(1, Number(value)))
    if (normalized >= 0.86) return 'high'
    if (normalized >= 0.6) return 'medium'
    if (normalized >= 0.35) return 'low'
    return 'critical'
}

const getImageConfidenceToneClass = (tone: ReturnType<typeof getImageConfidenceTone>) => {
    if (tone === 'high') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45'
    if (tone === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/45'
    if (tone === 'low') return 'bg-orange-500/15 text-orange-300 border-orange-500/45'
    if (tone === 'critical') return 'bg-rose-500/15 text-rose-300 border-rose-500/45'
    return 'bg-zinc-800 text-zinc-300 border-zinc-700'
}

type ImageStatusMeta = {
    state: string
    stateTone: 'high' | 'medium' | 'low' | 'critical' | 'unknown'
    source: string
    providerLabel: string
    confidence: string
    tone: ReturnType<typeof getImageConfidenceTone>
    toneClass: string
    attempts: number | null
    candidates: number | null
    attemptsText: string
    candidatesText: string
}

const imageStatusMetaCache = new WeakMap<object, { key: string; value: ImageStatusMeta }>()
const imageStatusMetaFingerprint = (p: SmartProduct): string => {
    const status = String(p?.status || '')
    const decision = String(p?.imageDecision || '')
    const source = String(p?.imageSource || '')
    const provider = String(p?.imageProvider || '')
    const confidence = Number.isFinite(Number(p?.imageConfidence)) ? Number(p.imageConfidence).toFixed(4) : 'na'
    const candidates = Number.isFinite(Number(p?.imageCandidateCount))
        ? String(Math.max(0, Math.floor(Number(p.imageCandidateCount))))
        : 'na'
    const candidateIds = Array.isArray(p?.imageCandidates)
        ? p.imageCandidates.map((candidate) => String(candidate?.id || '')).filter(Boolean).join(',')
        : ''
    const attempts = Number.isFinite(Number(p?.imageAttemptCount))
        ? String(Math.max(0, Math.floor(Number(p.imageAttemptCount))))
        : 'na'
    const reviewReason = String(p?.imageReviewReason || p?.imageDecisionReason || p?.error || '')
    return `${status}|${decision}|${source}|${provider}|${confidence}|${candidates}|${candidateIds}|${attempts}|${reviewReason}`
}

const isRetryingImage = (p: SmartProduct): boolean => {
    const reason = String(p?.error || p?.imageReviewReason || p?.imageDecisionReason || '').toLowerCase()
    return p?.status === 'pending' && (reason.includes('aguardando') || reason.includes('tentar novamente') || reason.includes('retry'))
}

const buildImageStatusMeta = (p: SmartProduct): ImageStatusMeta => {
    const source = normalizeImageSourceLabel(p.imageSource || imageSourceFromProvider(p.imageProvider))
    const providerLabel = normalizeImageSourceLabel(imageSourceFromProvider(p.imageProvider))
    const tone = getImageConfidenceTone(p.imageConfidence)
    const confidence = Number.isFinite(Number(p.imageConfidence)) ? Number(p.imageConfidence) : null
    const attempts = Number.isFinite(Number(p.imageAttemptCount))
        ? Math.max(0, Math.floor(Number(p.imageAttemptCount)))
        : null
    const candidates = Number.isFinite(Number(p.imageCandidateCount))
        ? Math.max(0, Math.floor(Number(p.imageCandidateCount)))
        : null
    const attemptsText = attempts === null ? 'T: —' : `T: ${attempts}`
    const candidatesText = candidates === null ? 'C: —' : `C: ${candidates}`

    if (p.status === 'done' && p.imageUrl) {
        return {
            state: 'Encontrada',
            stateTone: 'high',
            source,
            providerLabel,
            confidence: formatConfidence(confidence ?? undefined),
            tone,
            toneClass: getImageConfidenceToneClass(tone),
            attempts,
            candidates,
            attemptsText,
            candidatesText
        }
    }

    if (p.status === 'processing') {
        return {
            state: 'Processando',
            stateTone: 'medium',
            source,
            providerLabel,
            confidence: formatConfidence(confidence ?? undefined),
            tone,
            toneClass: getImageConfidenceToneClass(tone),
            attempts,
            candidates,
            attemptsText,
            candidatesText
        }
    }

    if (p.status === 'review_pending') {
        const decision = String(p?.imageDecision || '').toLowerCase()
        const hasCandidates = Array.isArray(p?.imageCandidates) && p.imageCandidates.length > 0
        if (isRetryingImage(p)) {
            return {
                state: 'Reprocessando',
                stateTone: 'medium',
                source,
                providerLabel,
                confidence: formatConfidence(confidence ?? undefined),
                tone: 'medium',
                toneClass: getImageConfidenceToneClass('medium'),
                attempts,
                candidates,
                attemptsText,
                candidatesText
            }
        }
        if (decision === 'blocked' || !hasCandidates) {
            return {
                state: 'Bloqueado',
                stateTone: 'critical',
                source,
                providerLabel,
                confidence: formatConfidence(confidence ?? undefined),
                tone: confidence !== null && confidence > 0.35 ? 'low' : 'critical',
                toneClass: getImageConfidenceToneClass(confidence !== null && confidence > 0.35 ? 'low' : 'critical'),
                attempts,
                candidates,
                attemptsText,
                candidatesText
            }
        }
        return {
            state: 'Suspeito',
            stateTone: 'low',
            source,
            providerLabel,
            confidence: formatConfidence(confidence ?? undefined),
            tone,
            toneClass: getImageConfidenceToneClass(tone),
            attempts,
            candidates,
            attemptsText,
            candidatesText
        }
    }

    if (isRetryingImage(p)) {
        return {
            state: 'Reprocessando',
            stateTone: 'medium',
            source,
            providerLabel,
            confidence: formatConfidence(confidence ?? undefined),
            tone: 'medium',
            toneClass: getImageConfidenceToneClass('medium'),
            attempts,
            candidates,
            attemptsText,
            candidatesText
        }
    }

    if (p.status === 'error') {
        return {
            state: 'Erro',
            stateTone: 'critical',
            source,
            providerLabel,
            confidence: formatConfidence(confidence ?? undefined),
            tone,
            toneClass: getImageConfidenceToneClass(tone),
            attempts,
            candidates,
            attemptsText,
            candidatesText
        }
    }

    return {
        state: 'Pendente',
        stateTone: 'critical',
        source,
        providerLabel,
        confidence: formatConfidence(confidence ?? undefined),
        tone,
        toneClass: getImageConfidenceToneClass(tone),
        attempts,
        candidates,
        attemptsText,
        candidatesText
    }
}

const normalizeImageSourceLabel = (value?: string): string => {
    const source = String(value || '').toLowerCase()
    if (!source) return 'IA'
    if (source === 'cache') return 'Cache'
    if (source === 's3') return 'S3'
    if (source === 'manual') return 'Manual'
    if (source === 'fallback') return 'Fallback'
    if (source === 'ai') return 'IA'
    if (source === 'system') return 'Sistema'
    return source.toUpperCase()
}

const normalizeCommercialPriceValue = (value: unknown): string =>
    String(value ?? '').replace(/R\$\s*/gi, '').trim()

const getFirstCommercialPrice = (product: Partial<SmartProduct> | null | undefined): string => {
    const candidates = [
        product?.priceUnit,
        product?.pricePack,
        product?.price,
        product?.priceSpecialUnit,
        product?.priceSpecial,
        product?.priceWholesale
    ]
    for (const candidate of candidates) {
        const normalized = normalizeCommercialPriceValue(candidate)
        if (normalized) return normalized
    }
    return ''
}

const hasCommercialPrice = (product: Partial<SmartProduct> | null | undefined): boolean =>
    !!getFirstCommercialPrice(product)

const normalizeProductForImport = (product: SmartProduct): SmartProduct => {
    const next = { ...product }
    const primaryPrice = getFirstCommercialPrice(next)
    if (!normalizeCommercialPriceValue(next.price) && primaryPrice) {
        next.price = primaryPrice
    }
    return next
}

const getReviewCandidateRenderKey = (candidate: SmartProductImageCandidate, index: number): string => {
    const stableKey = String(candidate?.key || candidate?.url || candidate?.previewUrl || candidate?.id || '').trim()
    return stableKey ? `${candidate?.source || 'candidate'}:${stableKey}` : `candidate:${index}`
}

const startImageProcessing = async (force = false) => {
    await processAllImages({
        bgPolicy: imageBgPolicy.value,
        matchMode: clampImageMatchMode(imageMatchMode.value),
        concurrency: clampImageConcurrency(imageConcurrency.value),
        force
    })
}

const toggleImageQueueProcessing = async () => {
    if (isImageQueueRunning.value) {
        if (isQueuePaused.value) {
            resumeImageProcessing()
        } else {
            pauseImageProcessing()
        }
        return
    }
    await startImageProcessing()
}

const reprocessProductImage = async (productIndex: number, force = false) => {
    const index = Number(productIndex)
    if (!Number.isInteger(index) || index < 0) return
    await processProductImage(index, {
        bgPolicy: imageBgPolicy.value,
        matchMode: clampImageMatchMode(imageMatchMode.value),
        force
    })
}

const imageMatchModeOptions = [
    { value: 'precise' as const, label: 'Busca precisa' },
    { value: 'fast' as const, label: 'Busca rápida' }
]

// Watcher to reset state when opening
watch(() => props.modelValue, (newVal) => {
    if (!newVal) {
        isSubmittingImport.value = false
        appendBaseProducts.value = null
        reviewFilter.value = 'all'
        reviewSuggestionMap.value = {}
        reviewSuggestionLoadingMap.value = {}
        reviewSuggestionErrorMap.value = {}
        stopImageQueue()
        resetImageProcessingState()
        reviewPage.value = 1
        activeReviewRowIndex.value = null
        return
    }

    isSubmittingImport.value = false
    reviewFilter.value = 'all'
    reviewSuggestionMap.value = {}
    reviewSuggestionLoadingMap.value = {}
    reviewSuggestionErrorMap.value = {}
    importMode.value = props.initialImportMode === 'append' ? 'append' : 'replace'
    importSource.value = 'manual'
    if (props.initialProducts && props.initialProducts.length > 0) {
        // Load external products directly into review mode
        products.value = props.initialProducts.map((p: any) => ({
            ...p,
            imageUrl: resolveProductImageUrl(p?.imageUrl || '')
        }))
        step.value = 'review'
    } else {
        products.value = []
        step.value = 'input'
        textInput.value = ''
    }

    if (targetMode.value === 'multi-frame') {
        if (selectedFrameIds.value.length === 0 && orderedFrameIds.value.length > 0) {
            setSelectedFrameIdsOrdered(orderedFrameIds.value)
        }
        reconcileFrameAssignments({ autofill: true })
    }
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        zoneAssignmentsMap.value = {}
        reconcileZoneAssignments({ autofill: true })
    }
    reviewPage.value = 1

    if (step.value === 'review') {
        activeReviewRowIndex.value = null
        nextTick(() => {
            reviewContainerRef.value?.focus()
            syncActiveReviewRowToFiltered()
        })
    }
})

const cloneProducts = (list: SmartProduct[]) =>
    JSON.parse(JSON.stringify(Array.isArray(list) ? list : [])) as SmartProduct[]

const mergeParsedProductsWithAppendBase = () => {
    if (!appendBaseProducts.value) return
    const base = cloneProducts(appendBaseProducts.value)
    const parsed = cloneProducts(products.value)
    products.value = [...base, ...parsed]
    appendBaseProducts.value = null
}

const handleParse = async () => {
    if (!textInput.value.trim()) return;
    const shouldAppend = !!appendBaseProducts.value
    importSource.value = 'paste-list'
    await parseText(textInput.value);
    
    if (products.value.length > 0) {
        if (shouldAppend) mergeParsedProductsWithAppendBase()
        step.value = 'review';
        // Process all images automatically
        await startImageProcessing()
    }
}

const openFilePickerInput = (input: HTMLInputElement | null) => {
    if (!input) return
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
    try {
        if (typeof pickerInput.showPicker === 'function') {
            pickerInput.showPicker()
            return
        }
    } catch {
        // Fall through to click for browsers that expose showPicker but reject this context.
    }
    input.click()
}

const triggerFilePicker = () => {
    openFilePickerInput(listFileInput.value)
}

const handleFileSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const shouldAppend = !!appendBaseProducts.value
    importSource.value = 'file-import'
    await parseFile(file)

    if (products.value.length > 0) {
        if (shouldAppend) mergeParsedProductsWithAppendBase()
        step.value = 'review'
        await startImageProcessing()
    }
}

const handleDropFile = async (event: DragEvent) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    const shouldAppend = !!appendBaseProducts.value
    importSource.value = 'file-import'
    await parseFile(file)
    if (products.value.length > 0) {
        if (shouldAppend) mergeParsedProductsWithAppendBase()
        step.value = 'review'
        await startImageProcessing()
    }
}

const createEmptyProduct = (): SmartProduct => ({
    id: `manual_${Date.now()}_${makeId()}`,
    name: '',
    brand: '',
    productCode: '',
    weight: '',
    price: '',
    pricePack: '',
    priceUnit: '',
    priceSpecial: '',
    priceSpecialUnit: '',
    specialCondition: '',
    priceWholesale: '',
    wholesaleTrigger: null,
    wholesaleTriggerUnit: '',
    packQuantity: null,
    packUnit: '',
    packageLabel: '',
    price_mode: 'retail',
    limit: '',
    flavor: '',
    imageUrl: null,
    status: 'pending',
    imageDecisionReason: '',
    raw: {}
})

const addManualProduct = () => {
    importSource.value = 'manual'
    products.value.unshift(createEmptyProduct())
    reviewSearch.value = ''
}

const startAppendFromReview = () => {
    appendBaseProducts.value = cloneProducts(products.value)
    textInput.value = ''
    step.value = 'input'
}

const backToReviewWithoutAppending = () => {
    if (appendBaseProducts.value) {
        products.value = cloneProducts(appendBaseProducts.value)
        appendBaseProducts.value = null
    }
    step.value = 'review'
}

const handleImport = () => {
    if (isSubmittingImport.value || importButtonDisabled.value) return
    isSubmittingImport.value = true

    const opts: ProductImportOptions = {
        mode: importMode.value,
        labelTemplateId: selectedLabelTemplateId.value || undefined,
        targetMode: targetMode.value,
        sourceMode: importSource.value,
        imageMatchMode: imageMatchMode.value,
        imageConcurrency: clampImageConcurrency(imageConcurrency.value)
    }

    if (targetMode.value === 'multi-frame') {
        opts.selectedFrameIds = [...selectedFrameIds.value]
        opts.frameAssignments = productRows.value.map((row) => ({
            productId: row.productId,
            frameId: getAssignedFrameId(row.productId)
        }))
        opts.countRule = 'min'
        opts.cardsPerFrame = 1
    }
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        opts.zoneAssignments = productRows.value.map((row) => ({
            productId: row.productId,
            zoneId: getAssignedZoneId(row.productId)
        }))
    }

    const importedProducts = (JSON.parse(JSON.stringify(products.value)) as SmartProduct[])
        .map((product) => normalizeProductForImport(product))
    emit('import', importedProducts, opts)
    emit('update:modelValue', false)
}

const showAssetPicker = ref(false)
const isLoadingAssets = ref(false)
const assets = ref<any[]>([])
const assetSearch = ref('')
const selectedProductIndex = ref<number | null>(null)
const selectedAssetKeys = ref<string[]>([])
const lastAssetSelectionAnchorKey = ref<string | null>(null)
const isApplyingSelectedAssets = ref(false)
const showLabelPreview = ref(false)
const MIN_ASSET_SEARCH_CHARS = 1

const reviewSearch = ref('')
const selectedLabelTemplateId = ref<string>('')
const resolveProductImageUrl = (rawUrl: any): string => {
    const value = String(rawUrl || '').trim()
    if (!value) return ''
    if (value.startsWith('blob:') || value.startsWith('data:')) return value
    const directUrl = toWasabiDirectUrl(value)
    if (directUrl) return directUrl
    if (value.startsWith('/')) return value
    return value
}

const withRequestTimeout = async <T>(
    timeoutMs: number,
    executor: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await executor(controller.signal)
    } finally {
        clearTimeout(timeoutId)
    }
}

const MANUAL_UPLOAD_API_TIMEOUT_MS = 20_000
const MANUAL_UPLOAD_PRESIGNED_TIMEOUT_MS = 30_000
const MANUAL_UPLOAD_REMOTE_COOLDOWN_MS = 2 * 60_000
let manualUploadRemoteDisabledUntil = 0

const isManualUploadRemoteTemporarilyDisabled = (): boolean => Date.now() < manualUploadRemoteDisabledUntil

const isLikelyConnectivityError = (err: any): boolean => {
    const normalized = [
        String(err?.message || ''),
        String(err?.statusMessage || ''),
        String(err?.cause?.message || ''),
        String(err?.cause || '')
    ].join(' ').toLowerCase()

    return (
        normalized.includes('failed to fetch') ||
        normalized.includes('<no response>') ||
        normalized.includes('network') ||
        normalized.includes('timed out') ||
        normalized.includes('timeout') ||
        normalized.includes('abort')
    )
}

const disableManualUploadRemoteTemporarily = (err: any) => {
    if (!isLikelyConnectivityError(err)) return
    manualUploadRemoteDisabledUntil = Date.now() + MANUAL_UPLOAD_REMOTE_COOLDOWN_MS
}

const getHttpStatus = (err: any): number => {
    const status = Number(
        err?.statusCode ??
        err?.status ??
        err?.response?.status ??
        err?.data?.statusCode
    )
    return Number.isFinite(status) ? status : 0
}

const isTransientAssetFetchError = (err: any): boolean => {
    const status = getHttpStatus(err)
    if (status === 0 && isLikelyConnectivityError(err)) return true
    return status === 502 || status === 503 || status === 504
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const sanitizeFilenameBase = (value: string): string => {
    const normalized = String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    return normalized || `produto-${Date.now()}`
}

const compressImageInBrowser = async (file: File): Promise<Blob> => {
    const objectUrl = URL.createObjectURL(file)
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image()
            const timer = setTimeout(() => reject(new Error('Timeout ao carregar imagem')), 8000)
            image.onload = () => { clearTimeout(timer); resolve(image) }
            image.onerror = (e) => { clearTimeout(timer); reject(e) }
            image.src = objectUrl
        })
        const maxSide = 1200
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * ratio))
        const height = Math.max(1, Math.round(img.height * ratio))
        const canvasEl = document.createElement('canvas')
        canvasEl.width = width
        canvasEl.height = height
        const ctx = canvasEl.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D indisponível')
        ctx.drawImage(img, 0, 0, width, height)
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvasEl.toBlob((b) => {
                if (!b) reject(new Error('Falha ao gerar blob comprimido'))
                else resolve(b)
            }, 'image/webp', 0.86)
        })
        return blob
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Falha ao converter imagem para Data URL'))
        reader.readAsDataURL(blob)
    })

const createLocalImageFallbackUrl = async (preferredBlob: Blob, originalFile: File): Promise<string | null> => {
    try {
        const preferred = await blobToDataUrl(preferredBlob)
        if (preferred) return preferred
    } catch {
        // try original file below
    }
    try {
        const original = await blobToDataUrl(originalFile)
        if (original) return original
    } catch {
        // caller handles null fallback
    }
    return null
}

const getRequestStatusCode = (err: any): number =>
    Number(err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)

const isAuthFailureError = (err: any): boolean => {
    const statusCode = getRequestStatusCode(err)
    if (statusCode === 401 || statusCode === 403) return true
    const message = String(err?.data?.statusMessage || err?.statusMessage || err?.message || '').toLowerCase()
    return (
        message.includes('sessao expirada') ||
        message.includes('login novamente') ||
        message.includes('authorization bearer token') ||
        message.includes('auth token')
    )
}

const uploadManualViaPresigned = async (
    product: any,
    uploadBlob: Blob,
    contentType: string,
    originalName: string
) => {
    const base = sanitizeFilenameBase(product?.name || originalName || 'produto')
    const ext = contentType.includes('webp') ? 'webp' : (contentType.split('/')[1] || 'png')
    const key = `imagens/manual-presigned-${Date.now()}-${base}.${ext}`
    const headers = await getApiAuthHeaders()

    const presigned = await withRequestTimeout(20000, (signal) =>
        fetchUntyped('/api/storage/presigned', {
            method: 'POST',
            headers,
            body: { key, contentType, operation: 'put' },
            signal: signal as any
        })
    )

    if (!presigned?.url) {
        throw new Error('Não foi possível obter URL assinada para upload')
    }

    const putResponse = await withRequestTimeout(MANUAL_UPLOAD_PRESIGNED_TIMEOUT_MS, (signal) =>
        fetch(String(presigned.url), {
            method: 'PUT',
            body: uploadBlob,
            headers: { 'Content-Type': contentType },
            signal
        })
    )
    if (!putResponse.ok) {
        throw new Error(`Upload direto falhou (${putResponse.status})`)
    }

    const signedGet = await withRequestTimeout(20000, (signal) =>
        fetchUntyped('/api/storage/presigned', {
            method: 'POST',
            headers,
            body: { key, operation: 'get' },
            signal: signal as any
        })
    )

    return {
        url: String(signedGet?.url || '').trim() || key,
        publicUrl: String(signedGet?.url || '').trim() || '',
        key,
        source: 'manual-presigned'
    }
}

watch(
    () => props.modelValue,
    (open) => {
        if (!open) return
        reviewSearch.value = ''
    }
)

watch(
    () => step.value,
    (nextStep) => {
        if (nextStep !== 'review') return
        syncActiveReviewRowToFiltered()
        nextTick(() => {
            reviewContainerRef.value?.focus()
        })
    }
)

watch(
    reviewPage,
    () => {
        const rows = filteredProductRows.value
        if (!rows.length) {
            activeReviewRowIndex.value = null
            return
        }

        const pageStart = (Math.max(1, reviewPage.value) - 1) * REVIEW_PAGE_SIZE
        const pageRows = rows.slice(pageStart, pageStart + REVIEW_PAGE_SIZE)
        const isActiveInPage = pageRows.some((row) => row.index === activeReviewRowIndex.value)
        if (!isActiveInPage && pageRows.length > 0) {
            activeReviewRowIndex.value = pageRows[0]!.index
        }
        syncActiveReviewRowToFiltered()
    }
)

const labelTemplateList = computed(() => {
    const list = Array.isArray(props.labelTemplates) ? props.labelTemplates : []
    return list
        .filter(Boolean)
        .slice()
        .sort((a: any, b: any) => {
            const ab = !!a?.isBuiltIn
            const bb = !!b?.isBuiltIn
            if (ab !== bb) return ab ? -1 : 1
            return String(a?.name || '').localeCompare(String(b?.name || ''))
        })
})

const selectedLabelTemplate = computed(() => {
    const id = String(selectedLabelTemplateId.value || '')
    if (!id) return null
    return labelTemplateList.value.find(t => String(t.id) === id) || null
})

const productTempIdMap = new WeakMap<object, string>()
let productTempIdSeq = 0

const getStableProductId = (product: any, index: number): string => {
    const persisted = String(product?.id ?? '').trim()
    if (persisted) return persisted

    if (product && typeof product === 'object') {
        const existing = productTempIdMap.get(product)
        if (existing) return existing
        productTempIdSeq += 1
        const next = `tmp-product-${productTempIdSeq}-${index + 1}`
        productTempIdMap.set(product, next)
        return next
    }
    return `tmp-product-fallback-${index + 1}`
}

const productRows = computed(() => {
    const list = Array.isArray(products.value) ? products.value : []
    return list.map((product: any, index: number) => ({
        product,
        index,
        productId: getStableProductId(product, index)
    }))
})

const filteredProducts = computed(() => {
    const list = products.value || []
    const q = normalizeText(String(reviewSearch.value || '').trim())
    if (!q) return list
    return list.filter((p: any) => {
        const hay = normalizeText(`${p?.name || ''} ${p?.brand || ''} ${p?.price || ''} ${p?.pricePack || ''} ${p?.priceUnit || ''} ${p?.priceSpecial || ''} ${p?.priceSpecialUnit || ''} ${p?.specialCondition || ''} ${p?.priceWholesale || ''}`)
        return hay.includes(q)
    })
})

const getReviewDecisionState = (product: SmartProduct): ReviewDecisionState => {
    if (product?.status === 'done' && product?.imageUrl) return 'approved'
    if (
        product?.imageDecision === 'ambiguous' ||
        (product?.status === 'review_pending' && Array.isArray(product?.imageCandidates) && product.imageCandidates.length > 0)
    ) {
        return 'ambiguous'
    }
    if (
        product?.imageDecision === 'blocked' ||
        product?.status === 'error' ||
        product?.status === 'review_pending'
    ) {
        return 'blocked'
    }
    return 'pending'
}

const matchesReviewFilter = (product: SmartProduct): boolean => {
    const bucket = getReviewDecisionState(product)
    if (reviewFilter.value === 'all') return true
    if (reviewFilter.value === 'suspect') return bucket === 'ambiguous'
    if (reviewFilter.value === 'approved') return bucket === 'approved'
    if (reviewFilter.value === 'blocked') return bucket === 'blocked'
    if (reviewFilter.value === 'pending') return bucket === 'pending'
    return true
}

const filteredProductRows = computed(() => {
    const filteredSet = reviewSearch.value.trim() ? new Set<any>(filteredProducts.value) : null
    const zoneFilter = zoneFilterId.value
    return productRows.value.filter((row) => {
        if (filteredSet && !filteredSet.has(row.product)) return false
        if (!matchesReviewFilter(row.product)) return false
        if (zoneFilter) {
            const assigned = getAssignedZoneId(row.productId)
            if (zoneFilter === '__none__') return !assigned
            return assigned === zoneFilter
        }
        return true
    })
})

const filteredProductRowsForAll = computed(() => filteredProducts.value.map((product) => product))
const filteredProductRowsPage = computed(() => {
    const start = (Math.max(1, reviewPage.value) - 1) * REVIEW_PAGE_SIZE
    return filteredProductRows.value.slice(start, start + REVIEW_PAGE_SIZE)
})
const reviewRowsWithMeta = computed(() =>
    filteredProductRowsPage.value.map((row) => ({
        ...row,
        imageStatusMeta: getImageStatusMeta(row.product),
        imageNextAction: getImageNextAction(row.product)
    }))
)
const productsMissingCommercialPrice = computed(() =>
    productRows.value.filter((row) => !hasCommercialPrice(row.product))
)
const missingCommercialPriceCount = computed(() => productsMissingCommercialPrice.value.length)
const reviewPageCount = computed(() => Math.max(1, Math.ceil(filteredProductRows.value.length / REVIEW_PAGE_SIZE)))
const gotoReviewPage = (nextPage: number) => {
    const totalPages = reviewPageCount.value
    const normalized = Math.min(Math.max(1, Number(nextPage) || 1), totalPages)
    reviewPage.value = normalized
}

const imageStatusCounters = computed(() => {
    const rows = filteredProductRowsForAll.value
    let approved = 0
    let pending = 0
    let ambiguous = 0
    let blocked = 0
    for (const row of rows) {
        if (!row) continue
        const bucket = getReviewDecisionState(row)
        if (bucket === 'approved') approved += 1
        else if (bucket === 'ambiguous') ambiguous += 1
        else if (bucket === 'blocked') blocked += 1
        else pending += 1
    }
    return {
        approved,
        pending,
        ambiguous,
        blocked,
        total: rows.length,
        attention: ambiguous + blocked
    }
})

const reviewFilterOptions = computed(() => ([
    { value: 'all' as const, label: 'Todos', count: imageStatusCounters.value.total },
    { value: 'suspect' as const, label: 'Suspeitos', count: imageStatusCounters.value.ambiguous },
    { value: 'blocked' as const, label: 'Bloqueados', count: imageStatusCounters.value.blocked },
    { value: 'approved' as const, label: 'Prontos', count: imageStatusCounters.value.approved },
    { value: 'pending' as const, label: 'Pendentes', count: imageStatusCounters.value.pending }
]))

const activeReviewRow = computed(() => {
    const rows = filteredProductRows.value
    if (!rows.length) {
        activeReviewRowIndex.value = null
        return null
    }

    const persisted = rows.find((row) => row.index === activeReviewRowIndex.value)
    if (persisted) return persisted

    const fallbackIndex = Math.min(Math.max(0, (reviewPage.value - 1) * REVIEW_PAGE_SIZE), rows.length - 1)
    const fallbackRow = rows[fallbackIndex] || rows[0]
    if (fallbackRow) {
        activeReviewRowIndex.value = fallbackRow.index
        return fallbackRow
    }
    return null
})

const activeReviewRowMeta = computed<ReviewRowWithMeta | null>(() => {
    const row = activeReviewRow.value
    if (!row) return null
    return {
        ...row,
        imageStatusMeta: getImageStatusMeta(row.product),
        imageNextAction: getImageNextAction(row.product)
    }
})

const setActiveReviewStringField = (field: string, value: string) => {
    const row = activeReviewRowMeta.value
    if (!row) return
    ;(row.product as any)[field] = value
}

const setActiveReviewUppercaseField = (field: string, value: string) => {
    setActiveReviewStringField(field, String(value || '').toUpperCase())
}

const setActiveReviewPositiveNumberField = (field: string, rawValue: unknown) => {
    const row = activeReviewRowMeta.value
    if (!row) return
    const value = Number(rawValue)
    ;(row.product as any)[field] = Number.isFinite(value) && value > 0 ? value : null
}

const mapAssetToReviewCandidate = (asset: any, index: number): SmartProductImageCandidate | null => {
    const key = String(asset?.key || '').trim()
    const url = resolveProductImageUrl(asset?.url || '')
    if (!key && !url) return null
    const assetSource = String(asset?.source || '').trim().toLowerCase()
    return {
        id: String(asset?.id || key || url || `storage-candidate-${index + 1}`),
        key: key || undefined,
        url: url || key,
        previewUrl: url || key || undefined,
        title: String(asset?.name || key || '').trim() || undefined,
        source: key || assetSource === 's3' ? 's3' : 'external',
        provider: assetSource === 'cache' ? 'internal-cache' : 'internal-storage',
        score: Number.isFinite(Number(asset?.score)) ? Number(asset.score) : undefined,
        reason: assetSource === 'cache'
            ? 'Sugestão encontrada no histórico interno do storage.'
            : 'Sugestão encontrada no Wasabi para este produto.',
        recommended: index === 0
    }
}

const mergeReviewCandidates = (...lists: Array<SmartProductImageCandidate[] | undefined | null>): SmartProductImageCandidate[] => {
    const merged: SmartProductImageCandidate[] = []
    const seen = new Set<string>()
    for (const list of lists) {
        if (!Array.isArray(list)) continue
        for (const candidate of list) {
            if (!candidate) continue
            const dedupeKey = String(candidate.key || candidate.url || candidate.id || '').trim()
            if (!dedupeKey || seen.has(dedupeKey)) continue
            seen.add(dedupeKey)
            merged.push(candidate)
        }
    }
    return merged
}

const activeStorageSuggestions = computed<SmartProductImageCandidate[]>(() => {
    const row = activeReviewRow.value
    if (!row) return []
    return reviewSuggestionMap.value[row.productId] || []
})

const activeReviewSuggestionError = computed(() => {
    const row = activeReviewRow.value
    if (!row) return ''
    return String(reviewSuggestionErrorMap.value[row.productId] || '').trim()
})

const isActiveReviewSuggestionLoading = computed(() => {
    const row = activeReviewRow.value
    if (!row) return false
    return !!reviewSuggestionLoadingMap.value[row.productId]
})

const activeReviewCandidates = computed<SmartProductImageCandidate[]>(() => {
    const product = activeReviewRow.value?.product
    return mergeReviewCandidates(
        Array.isArray(product?.imageCandidates) ? product.imageCandidates : [],
        activeStorageSuggestions.value
    )
})

const activeReviewDecisionState = computed<ReviewDecisionState>(() => {
    const product = activeReviewRow.value?.product
    return product ? getReviewDecisionState(product) : 'pending'
})

const activeDecisionToneClass = computed(() => {
    const bucket = activeReviewDecisionState.value
    if (bucket === 'approved') return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35'
    if (bucket === 'ambiguous') return 'bg-amber-500/15 text-amber-100 border-amber-500/35'
    if (bucket === 'blocked') return 'bg-rose-500/15 text-rose-100 border-rose-500/35'
    return 'bg-sky-500/15 text-sky-100 border-sky-500/35'
})

const activeDecisionLabel = computed(() => {
    const bucket = activeReviewDecisionState.value
    if (bucket === 'approved') return 'Aprovado'
    if (bucket === 'ambiguous') return 'Suspeito'
    if (bucket === 'blocked') return 'Bloqueado'
    return 'Pendente'
})

const selectedImportModeLabel = computed(() => importMode.value === 'append' ? 'Adicionar' : 'Substituir')
const selectedTargetModeLabel = computed(() => {
    if (targetMode.value === 'multi-frame') return 'Multi-frame'
    return canUseMultiZone.value ? 'Zonas' : 'Zona atual'
})
const selectedLabelTemplateSummary = computed(() => selectedLabelTemplate.value?.name || 'Padrão da zona')
const importImpactSummary = computed(() => {
    const totalProducts = products.value.length
    if (targetMode.value === 'multi-frame') {
        return `${multiFrameImportCount.value} ofertas serão distribuídas nos frames selecionados.`
    }
    if (canUseMultiZone.value) {
        return `${multiZoneImportCount.value} produtos serão distribuídos nas zonas selecionadas.`
    }
    const existing = Math.max(0, Number(props.existingCount || 0))
    if (importMode.value === 'replace') {
        return `${totalProducts} produtos novos entrarão e ${existing} itens atuais da zona serão substituídos.`
    }
    return `${totalProducts} produtos serão adicionados aos ${existing} itens já presentes na zona.`
})

const importReadinessText = computed(() => {
    if (missingCommercialPriceCount.value > 0) {
        return `Importação travada: ${missingCommercialPriceCount.value} item(ns) seguem sem preço comercial preenchido.`
    }
    if (imageStatusCounters.value.blocked > 0) return 'Importação travada: existem itens bloqueados que ainda precisam de imagem ou revisão manual.'
    if (imageStatusCounters.value.ambiguous > 0) return 'Importação aguardando sua escolha: existem itens suspeitos com mais de uma imagem possível.'
    if (imageStatusCounters.value.pending > 0) return 'A fila ainda está processando imagens.'
    return 'Lote pronto para importar com o template e destino selecionados.'
})

const importReadinessToneClass = computed(() => {
    if (missingCommercialPriceCount.value > 0) return 'border-rose-500/25 bg-rose-500/10 text-rose-100'
    if (imageStatusCounters.value.blocked > 0) return 'border-rose-500/25 bg-rose-500/10 text-rose-100'
    if (imageStatusCounters.value.ambiguous > 0) return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
    if (imageStatusCounters.value.pending > 0) return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
})

watch(
    () => [props.modelValue, step.value, activeReviewRow.value?.productId || '', activeReviewDecisionState.value] as const,
    ([open, currentStep, productId, decision]) => {
        if (!open || currentStep !== 'review' || !productId) return
        if (decision === 'approved') return
        const row = activeReviewRow.value
        if (!row) return
        void fetchReviewSuggestionsForRow(row)
    }
)

const formatCandidateConfidence = (candidate: SmartProductImageCandidate): string => {
    const confidence = Number(candidate?.confidence)
    if (Number.isFinite(confidence)) return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`
    const score = Number(candidate?.score)
    if (Number.isFinite(score)) return score.toFixed(score >= 10 ? 0 : 2)
    return '—'
}

const applyCandidateToReviewRow = async (
    row: { index: number; productId: string; product: SmartProduct } | null,
    candidate: SmartProductImageCandidate
) => {
    if (!row || !candidate) return
    await applyImageCandidate(row.index, candidate, {
        bgPolicy: imageBgPolicy.value,
        matchMode: imageMatchMode.value
    })
}

const fetchReviewSuggestionsForRow = async (
    row: { index: number; productId: string; product: SmartProduct } | null,
    options: { force?: boolean } = {}
) => {
    if (!row) return
    const productId = String(row.productId || '').trim()
    if (!productId) return
    if (reviewSuggestionLoadingMap.value[productId]) return
    if (!options.force && Array.isArray(reviewSuggestionMap.value[productId]) && reviewSuggestionMap.value[productId]!.length > 0) {
        return
    }
    if (
        !options.force &&
        Array.isArray(row.product?.imageCandidates) &&
        row.product.imageCandidates.some((candidate) => candidate?.source === 's3')
    ) {
        return
    }

    const query = buildCacheSearchTerm(row.product)
    if (query.length < MIN_ASSET_SEARCH_CHARS) return

    reviewSuggestionLoadingMap.value = { ...reviewSuggestionLoadingMap.value, [productId]: true }
    reviewSuggestionErrorMap.value = { ...reviewSuggestionErrorMap.value, [productId]: null }

    try {
        const headers = await getApiAuthHeaders()
        const data = await fetchUntyped('/api/assets', {
            headers,
            query: {
                q: query,
                limit: 8,
                source: 'uploads',
                fresh: options.force ? '1' : undefined,
                productName: String(row.product?.name || ''),
                brand: String(row.product?.brand || ''),
                flavor: String(row.product?.flavor || ''),
                weight: String(row.product?.weight || '')
            }
        })
        const next = Array.isArray(data)
            ? data
                .map((asset, index) => mapAssetToReviewCandidate(asset, index))
                .filter((candidate): candidate is SmartProductImageCandidate => !!candidate)
                .slice(0, 6)
            : []
        reviewSuggestionMap.value = { ...reviewSuggestionMap.value, [productId]: next }
    } catch (error: any) {
        reviewSuggestionErrorMap.value = {
            ...reviewSuggestionErrorMap.value,
            [productId]: String(error?.data?.message || error?.message || 'Falha ao carregar sugestões internas.')
        }
        reviewSuggestionMap.value = { ...reviewSuggestionMap.value, [productId]: [] }
    } finally {
        reviewSuggestionLoadingMap.value = { ...reviewSuggestionLoadingMap.value, [productId]: false }
    }
}

const activeReviewRowVisibleIndex = computed(() => {
    if (!filteredProductRows.value.length) return -1
    if (activeReviewRowIndex.value === null) return 0
    const found = filteredProductRows.value.findIndex((row) => row.index === activeReviewRowIndex.value)
    return found >= 0 ? found : 0
})

const moveActiveReviewRow = (delta: number) => {
    const rows = filteredProductRows.value
    if (!rows.length) {
        activeReviewRowIndex.value = null
        return
    }

    const current = activeReviewRowVisibleIndex.value
    const next = Math.min(Math.max(current + delta, 0), rows.length - 1)
    activeReviewRowIndex.value = rows[next]!.index
    reviewPage.value = Math.floor(next / REVIEW_PAGE_SIZE) + 1
}

const reviewRowToneClass = (tone: ReturnType<typeof getImageConfidenceTone>) => {
    if (tone === 'high') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/45'
    if (tone === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/45'
    if (tone === 'low') return 'bg-orange-500/15 text-orange-300 border-orange-500/45'
    if (tone === 'critical') return 'bg-rose-500/15 text-rose-300 border-rose-500/45'
    return 'bg-zinc-800 text-zinc-300 border-zinc-700'
}

const getImageStatusMeta = (p: SmartProduct): ImageStatusMeta => {
    const key = imageStatusMetaFingerprint(p)
    const cached = p ? imageStatusMetaCache.get(p as object) : null
    if (cached && cached.key === key) return cached.value

    const value = buildImageStatusMeta(p)
    imageStatusMetaCache.set(p as object, { key, value })
    return value
}

const isAdvancedFieldsExpanded = (rowId: string): boolean => expandedAdvancedRows.value.has(String(rowId || ''))
const toggleAdvancedFields = (rowId: string) => {
    const key = String(rowId || '')
    const next = new Set(expandedAdvancedRows.value)
    if (next.has(key)) {
        next.delete(key)
    } else {
        next.add(key)
    }
    expandedAdvancedRows.value = next
}

const thumbnailUiStateClass = (row: any): string => {
    const bucket = getReviewDecisionState(row as SmartProduct)
    if (bucket === 'approved') return 'ring-1 ring-emerald-500/50 border-emerald-700/70'
    if (bucket === 'ambiguous') return 'ring-1 ring-amber-500/55 border-amber-700/70'
    if (bucket === 'blocked') return 'ring-1 ring-rose-500/55 border-rose-700/70'
    if (String(row?.status || '') === 'processing') return 'ring-1 ring-blue-500/55 border-blue-700/70'
    return 'ring-1 ring-zinc-700/60 border-zinc-700'
}

const thumbnailStatusText = (row: any): string => {
    const status = String(row?.status || '')
    const bucket = getReviewDecisionState(row as SmartProduct)
    if (status === 'pending' && isRetryingImage(row)) return 'Reprocessando'
    if (status === 'processing') return 'Processando...'
    if (bucket === 'ambiguous') return 'Escolher imagem'
    if (bucket === 'blocked') return 'Bloqueado'
    if (status === 'error') return 'Sem imagem'
    if (status === 'pending') return 'Aguardando'
    return 'Sem imagem'
}

const getImageNextAction = (p: SmartProduct): ImageNextAction | null => {
    const status = String(p?.status || '')
    const isRetrying = isRetryingImage(p)
    if (status !== 'review_pending' && status !== 'error' && !isRetrying) return null

    const reason = String(p.imageReviewReason || p.imageDecisionReason || p.error || '').toLowerCase()
    if (isRetrying) {
        return {
            action: 'reprocess',
            label: 'Reprocessar',
            helper: 'Tentativa automática agendada. Clique para disparar novo ciclo agora.'
        }
    }
    if (!reason) {
        return {
            action: 'reprocess',
            label: 'Reprocessar',
            helper: 'Sem sugestão de fallback: tente novamente para buscar nova candidata.'
        }
    }

    if (reason.includes('manual') || reason.includes('enviar') || reason.includes('upload') || reason.includes('aplique')) {
        return {
            action: 'upload',
            label: 'Aplicar imagem manualmente',
            helper: 'Aplique uma foto para validar sem depender da busca remota.'
        }
    }

    if (reason.includes('storage') || reason.includes('galeria') || reason.includes('busca no storage')) {
        return {
            action: 'storage',
            label: 'Buscar no storage',
            helper: 'Use uma imagem já existente na galeria da campanha.'
        }
    }

    if (reason.includes('rerun') || reason.includes('reprocess') || reason.includes('tente novamente') || reason.includes('novo processamento')) {
        return {
            action: 'reprocess',
            label: 'Reprocessar',
            helper: 'Tente novamente com a configuração atual para buscar outra candidata.'
        }
    }

    return {
        action: 'reprocess',
        label: 'Reprocessar',
        helper: 'Ajuste o termo/campo e reexecute o fluxo para melhorar o match.'
    }
}

const runImageQuickAction = async (
    row: ReviewRowWithMeta | { index: number; productId: string; product: SmartProduct },
    action: ImageQuickAction
) => {
    if (!row || row.product?.status === 'processing') return

    if (action === 'storage') {
        openAssetPicker(row.index)
        return
    }

    if (action === 'upload') {
        openReviewImageUpload(row.index)
        return
    }

    if (action === 'search' || action === 'reprocess') {
        await processProductImage(row.index, {
            bgPolicy: imageBgPolicy.value,
            matchMode: clampImageMatchMode(imageMatchMode.value),
            force: true
        })
        return
    }
}

const runImageNextAction = async (row: ReviewRowWithMeta | { index: number; productId: string; product: SmartProduct; imageNextAction?: ImageNextAction | null }) => {
    const suggestion = row.imageNextAction || getImageNextAction(row.product)
    if (!suggestion) return
    await runImageQuickAction(row, suggestion.action)
}

const activeReviewRowOrFirst = computed(() => {
    const candidate = activeReviewRow.value
    if (candidate) return candidate
    const fallback = filteredProductRowsPage.value[0]
    return fallback ? fallback : null
})

const triggerActiveImageUpload = () => {
    const row = activeReviewRowOrFirst.value
    if (!row) return
    openReviewImageUpload(row.index)
}

const triggerActiveImageStorage = async () => {
    const row = activeReviewRowOrFirst.value
    if (!row) return
    await openAssetPicker(row.index)
}

const triggerActiveImageAction = async (action: ImageQuickAction) => {
    const row = activeReviewRowOrFirst.value
    if (!row) return
    if (action === 'search' || action === 'reprocess') {
        await runImageQuickAction(row, action)
        return
    }
    if (action === 'upload') {
        triggerActiveImageUpload()
        return
    }
    if (action === 'storage') {
        await triggerActiveImageStorage()
    }
}

const isTextLikeTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    if (!el) return false
    if ((el as HTMLElement).isContentEditable) return true
    const tag = String(el.tagName || '').toLowerCase()
    if (['input', 'textarea', 'select'].includes(tag)) return true
    if (el.closest?.('.no-review-shortcut')) return true
    const editable = String(el.getAttribute?.('contenteditable') || '').toLowerCase()
    return editable === 'true' || editable === ''
}

const syncActiveReviewRowToFiltered = () => {
    const rows = filteredProductRows.value
    if (!rows.length) {
        activeReviewRowIndex.value = null
        return
    }

    const current = rows.find((row) => row.index === activeReviewRowIndex.value)
    if (current) return

    const fallback = rows[Math.min(Math.max(0, (reviewPage.value - 1) * REVIEW_PAGE_SIZE), rows.length - 1)]
    activeReviewRowIndex.value = fallback ? fallback.index : rows[0]?.index || null
}

watch(
    () => filteredProductRows.value.length,
    () => {
        syncActiveReviewRowToFiltered()
    }
)

const onReviewKeydown = (event: KeyboardEvent) => {
    if (step.value !== 'review' || !props.modelValue) return
    if (event.defaultPrevented) return
    if (isTextLikeTarget(event.target)) return
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const row = activeReviewRow.value
    if (!row && !filteredProductRows.value.length) return

    if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveActiveReviewRow(1)
        return
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveActiveReviewRow(-1)
        return
    }

    if (event.key === 'PageDown') {
        event.preventDefault()
        moveActiveReviewRow(REVIEW_PAGE_SIZE)
        return
    }

    if (event.key === 'PageUp') {
        event.preventDefault()
        moveActiveReviewRow(-REVIEW_PAGE_SIZE)
        return
    }

    if (event.key === 'Home') {
        event.preventDefault()
        if (filteredProductRows.value.length > 0) {
            activeReviewRowIndex.value = filteredProductRows.value[0]!.index
            reviewPage.value = 1
        }
        return
    }

    if (event.key === 'End') {
        event.preventDefault()
        if (filteredProductRows.value.length > 0) {
            const last = filteredProductRows.value[filteredProductRows.value.length - 1]
            activeReviewRowIndex.value = last!.index
            reviewPage.value = reviewPageCount.value
        }
        return
    }

    if (event.key === 'Enter') {
        event.preventDefault()
        if (!row) return
        triggerActiveImageAction('search')
        return
    }

    if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        if (!row) return
        triggerActiveImageAction('reprocess')
        return
    }

    if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!row) return
        runImageQuickAction(row, 'search')
        return
    }

    if (event.key.toLowerCase() === 'u') {
        event.preventDefault()
        triggerActiveImageUpload()
        return
    }

    if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        triggerActiveImageStorage()
        return
    }

    if (event.key === ' ') {
        event.preventDefault()
        const active = row
        if (!active) return
        const suggestion = getImageNextAction(active.product)
        if (!suggestion) return
        void runImageNextAction(active)
    }
}

const availableFrames = computed<FrameCandidate[]>(() => {
    const source = Array.isArray(props.availableFramesForImport) ? props.availableFramesForImport : []
    const byId = new Map<string, FrameCandidate>()

    source.forEach((item: any, index: number) => {
        const id = String(item?.id || '').trim() || `frame-${index + 1}`
        if (byId.has(id)) return
        const name = String(item?.name || '').trim() || `Frame ${index + 1}`
        const left = Number(item?.left)
        const top = Number(item?.top)
        byId.set(id, {
            id,
            name,
            left: Number.isFinite(left) ? left : undefined,
            top: Number.isFinite(top) ? top : undefined
        })
    })

    const sorted = Array.from(byId.values())
    sorted.sort((a, b) => {
        const aTop = Number.isFinite(Number(a.top)) ? Number(a.top) : Number.POSITIVE_INFINITY
        const bTop = Number.isFinite(Number(b.top)) ? Number(b.top) : Number.POSITIVE_INFINITY
        if (aTop !== bTop) return aTop - bTop

        const aLeft = Number.isFinite(Number(a.left)) ? Number(a.left) : Number.POSITIVE_INFINITY
        const bLeft = Number.isFinite(Number(b.left)) ? Number(b.left) : Number.POSITIVE_INFINITY
        if (aLeft !== bLeft) return aLeft - bLeft

        return a.name.localeCompare(b.name)
    })
    return sorted
})

const availableZones = computed<ZoneCandidate[]>(() => {
    const source = Array.isArray(props.availableZonesForImport) ? props.availableZonesForImport : []
    const byId = new Map<string, ZoneCandidate>()

    source.forEach((item: any, index: number) => {
        const id = String(item?.id || '').trim() || `zone-${index + 1}`
        if (byId.has(id)) return
        const name = String(item?.name || '').trim() || `Zona ${index + 1}`
        const left = Number(item?.left)
        const top = Number(item?.top)
        const existingCount = Number(item?.existingCount)
        const frameName = String(item?.frameName || '').trim()
        byId.set(id, {
            id,
            name,
            left: Number.isFinite(left) ? left : undefined,
            top: Number.isFinite(top) ? top : undefined,
            existingCount: Number.isFinite(existingCount) ? Math.max(0, existingCount) : 0,
            frameName: frameName || undefined
        })
    })

    const sorted = Array.from(byId.values())
    sorted.sort((a, b) => {
        const aTop = Number.isFinite(Number(a.top)) ? Number(a.top) : Number.POSITIVE_INFINITY
        const bTop = Number.isFinite(Number(b.top)) ? Number(b.top) : Number.POSITIVE_INFINITY
        if (aTop !== bTop) return aTop - bTop

        const aLeft = Number.isFinite(Number(a.left)) ? Number(a.left) : Number.POSITIVE_INFINITY
        const bLeft = Number.isFinite(Number(b.left)) ? Number(b.left) : Number.POSITIVE_INFINITY
        if (aLeft !== bLeft) return aLeft - bLeft

        return a.name.localeCompare(b.name)
    })
    return sorted
})

const orderedFrameIds = computed(() => availableFrames.value.map(frame => frame.id))
const orderedZoneIds = computed(() => availableZones.value.map(zone => zone.id))
const selectedFrameSet = computed(() => new Set(selectedFrameIds.value))
const selectedFrames = computed(() => availableFrames.value.filter(frame => selectedFrameSet.value.has(frame.id)))
const multiFrameImportCount = computed(() => Math.min(productRows.value.length, selectedFrameIds.value.length))
const multiZoneImportCount = computed(() => productRows.value.filter(row => !!getAssignedZoneId(row.productId)).length)
const multiZoneUnassignedCount = computed(() => Math.max(0, productRows.value.length - multiZoneImportCount.value))
const countProductsAssignedToZone = (zoneId: string): number =>
    productRows.value.filter(row => getAssignedZoneId(row.productId) === zoneId).length
const bulkZoneAssignmentValue = computed(() => {
    const rows = productRows.value
    if (!rows.length) return ''
    const first = getAssignedZoneId(rows[0]!.productId)
    if (!first) return ''
    return rows.every(row => getAssignedZoneId(row.productId) === first) ? first : ''
})
const isProcessingProducts = computed(() => products.value.some((p: any) => p.status === 'processing'))
const isImageQueueLocked = computed(() => isImageQueueRunning.value)
const canUseMultiFrame = computed(() => availableFrames.value.length > 0)
const canUseMultiZone = computed(() => availableZones.value.length > 1)

const setSelectedFrameIdsOrdered = (ids: string[]) => {
    const wanted = new Set(
        (Array.isArray(ids) ? ids : [])
            .map(id => String(id || '').trim())
            .filter(Boolean)
    )
    selectedFrameIds.value = orderedFrameIds.value.filter(id => wanted.has(id))
}

const getAssignedFrameId = (productId: string): string | null => {
    const value = String(frameAssignmentsMap.value[String(productId) || ''] || '').trim()
    return value || null
}

const reconcileFrameAssignments = (opts: { autofill?: boolean } = {}) => {
    const productIds = productRows.value.map(row => row.productId)
    const selectedSet = new Set(selectedFrameIds.value)
    const next: Record<string, string | null> = {}
    const used = new Set<string>()

    productIds.forEach((productId) => {
        const assigned = getAssignedFrameId(productId)
        if (assigned && selectedSet.has(assigned) && !used.has(assigned)) {
            next[productId] = assigned
            used.add(assigned)
            return
        }
        next[productId] = null
    })

    if (opts.autofill !== false) {
        const queue = selectedFrameIds.value.filter(id => !used.has(id))
        let cursor = 0
        productIds.forEach((productId) => {
            if (next[productId]) return
            const candidate = queue[cursor]
            if (!candidate) return
            next[productId] = candidate
            used.add(candidate)
            cursor += 1
        })
    }

    frameAssignmentsMap.value = next
}

const initializeMultiFrameState = () => {
    setSelectedFrameIdsOrdered(orderedFrameIds.value)
    frameAssignmentsMap.value = {}
    reconcileFrameAssignments({ autofill: true })
}

const toggleFrameSelection = (frameId: string) => {
    const id = String(frameId || '').trim()
    if (!id) return
    const next = new Set(selectedFrameIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedFrameIdsOrdered(Array.from(next))
    reconcileFrameAssignments({ autofill: true })
}

const toggleSelectAllFrames = () => {
    const all = orderedFrameIds.value
    if (!all.length) {
        selectedFrameIds.value = []
        frameAssignmentsMap.value = {}
        return
    }
    if (selectedFrameIds.value.length === all.length) {
        selectedFrameIds.value = []
    } else {
        selectedFrameIds.value = [...all]
    }
    reconcileFrameAssignments({ autofill: true })
}

const isFrameAssignedElsewhere = (frameId: string, productId: string): boolean => {
    const id = String(frameId || '').trim()
    if (!id) return false
    return productRows.value.some((row) => {
        if (row.productId === productId) return false
        return getAssignedFrameId(row.productId) === id
    })
}

const setAssignmentForProduct = (productId: string, frameIdRaw: string) => {
    const pid = String(productId || '').trim()
    if (!pid) return

    const frameId = String(frameIdRaw || '').trim() || null
    const selectedSet = selectedFrameSet.value

    if (!frameId || !selectedSet.has(frameId)) {
        frameAssignmentsMap.value = { ...frameAssignmentsMap.value, [pid]: null }
        reconcileFrameAssignments({ autofill: false })
        return
    }

    const next = { ...frameAssignmentsMap.value }
    Object.keys(next).forEach((otherProductId) => {
        if (otherProductId !== pid && next[otherProductId] === frameId) {
            next[otherProductId] = null
        }
    })
    next[pid] = frameId
    frameAssignmentsMap.value = next
    reconcileFrameAssignments({ autofill: false })
}

const getAssignedZoneId = (productId: string): string | null => {
    const value = String(zoneAssignmentsMap.value[String(productId) || ''] || '').trim()
    return value || null
}

const reconcileZoneAssignments = (opts: { autofill?: boolean } = {}) => {
    const productIds = productRows.value.map(row => row.productId)
    const validZoneIds = new Set(orderedZoneIds.value)
    const next: Record<string, string | null> = {}

    productIds.forEach((productId) => {
        const assigned = getAssignedZoneId(productId)
        next[productId] = assigned && validZoneIds.has(assigned) ? assigned : null
    })

    if (opts.autofill !== false && orderedZoneIds.value.length > 0) {
        const existingCounts = availableZones.value.map(zone => Math.max(0, Number(zone.existingCount || 0)))
        const totalExisting = existingCounts.reduce((sum, count) => sum + count, 0)
        let allocations: number[]
        if (importMode.value === 'replace' && totalExisting > 0) {
            allocations = [...existingCounts]
            let allocated = allocations.reduce((sum, count) => sum + count, 0)
            while (allocated > productIds.length) {
                for (let i = allocations.length - 1; i >= 0 && allocated > productIds.length; i -= 1) {
                    const current = allocations[i] ?? 0
                    if (current <= 0) continue
                    allocations[i] = current - 1
                    allocated -= 1
                }
            }
            let cursor = 0
            while (allocated < productIds.length) {
                const index = cursor % allocations.length
                allocations[index] = (allocations[index] ?? 0) + 1
                allocated += 1
                cursor += 1
            }
        } else {
            const base = Math.floor(productIds.length / orderedZoneIds.value.length)
            const remainder = productIds.length % orderedZoneIds.value.length
            allocations = orderedZoneIds.value.map((_, index) => base + (index < remainder ? 1 : 0))
        }

        let productCursor = 0
        allocations.forEach((count, zoneIndex) => {
            const zoneId = orderedZoneIds.value[zoneIndex]
            if (!zoneId) return
            for (let i = 0; i < count && productCursor < productIds.length; i += 1) {
                const productId = productIds[productCursor]
                if (productId && !next[productId]) next[productId] = zoneId
                productCursor += 1
            }
        })
    }

    zoneAssignmentsMap.value = next
}

const setZoneAssignmentForProduct = (productId: string, zoneIdRaw: string) => {
    const pid = String(productId || '').trim()
    if (!pid) return
    const zoneId = String(zoneIdRaw || '').trim() || null
    const validZoneIds = new Set(orderedZoneIds.value)
    zoneAssignmentsMap.value = {
        ...zoneAssignmentsMap.value,
        [pid]: zoneId && validZoneIds.has(zoneId) ? zoneId : null
    }
}

const autoDistributeZoneAssignments = () => {
    zoneAssignmentsMap.value = {}
    reconcileZoneAssignments({ autofill: true })
}

const setBulkZoneAssignment = (zoneIdRaw: string) => {
    const zoneId = String(zoneIdRaw || '').trim()
    if (!zoneId) {
        autoDistributeZoneAssignments()
        return
    }
    const validZoneIds = new Set(orderedZoneIds.value)
    if (!validZoneIds.has(zoneId)) return
    const next: Record<string, string | null> = {}
    productRows.value.forEach((row) => {
        next[row.productId] = zoneId
    })
    zoneAssignmentsMap.value = next
    zoneFilterId.value = null
}

const getFrameNameById = (frameId: string | null): string => {
    const id = String(frameId || '').trim()
    if (!id) return ''
    return availableFrames.value.find(frame => frame.id === id)?.name || ''
}

const getZoneNameById = (zoneId: string | null): string => {
    const id = String(zoneId || '').trim()
    if (!id) return ''
    return availableZones.value.find(zone => zone.id === id)?.name || ''
}

const getProductDestinationLabel = (productId: string): string => {
    if (targetMode.value === 'multi-frame') {
        return getFrameNameById(getAssignedFrameId(productId)) || 'Sem frame'
    }
    if (canUseMultiZone.value) {
        return getZoneNameById(getAssignedZoneId(productId)) || 'Sem zona'
    }
    return selectedTargetModeLabel.value
}

const hasInvalidMultiFrameAssignments = computed(() => {
    if (targetMode.value !== 'multi-frame') return false
    if (multiFrameImportCount.value <= 0) return true
    const selectedSet = selectedFrameSet.value
    const used = new Set<string>()
    let validAssignments = 0
    for (const row of productRows.value) {
        const frameId = getAssignedFrameId(row.productId)
        if (!frameId || !selectedSet.has(frameId) || used.has(frameId)) continue
        used.add(frameId)
        validAssignments += 1
    }
    return validAssignments < multiFrameImportCount.value
})

const importButtonDisabled = computed(() => {
    if (isSubmittingImport.value) return true
    if (isProcessingProducts.value) return true
    if (isImageQueueLocked.value) return true
    if (missingCommercialPriceCount.value > 0) return true
    if (imageStatusCounters.value.attention > 0) return true
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        return multiZoneImportCount.value <= 0
    }
    if (targetMode.value !== 'multi-frame') return false
    if (!canUseMultiFrame.value) return true
    if (selectedFrameIds.value.length === 0) return true
    return hasInvalidMultiFrameAssignments.value
})

watch(targetMode, (mode, previous) => {
    if (mode !== 'multi-frame') return
    if (previous === 'multi-frame') return
    initializeMultiFrameState()
})

watch(() => orderedFrameIds.value.join('|'), () => {
    setSelectedFrameIdsOrdered(selectedFrameIds.value)
    if (targetMode.value === 'multi-frame') {
        if (selectedFrameIds.value.length === 0 && orderedFrameIds.value.length > 0) {
            setSelectedFrameIdsOrdered(orderedFrameIds.value)
        }
        reconcileFrameAssignments({ autofill: true })
    }
})

watch(() => productRows.value.map(row => row.productId).join('|'), () => {
    if (targetMode.value === 'multi-frame') {
        reconcileFrameAssignments({ autofill: true })
    }
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        reconcileZoneAssignments({ autofill: true })
    }
})

watch(() => orderedZoneIds.value.join('|'), () => {
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        reconcileZoneAssignments({ autofill: true })
    }
})

watch(importMode, () => {
    if (targetMode.value === 'zone' && canUseMultiZone.value) {
        autoDistributeZoneAssignments()
    }
})

const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const normalizeWeightNumber = (value: string): string => {
    const n = Number(String(value || '').replace(',', '.'))
    if (!Number.isFinite(n)) return String(value || '').replace(',', '.')
    const normalized = String(n)
    return normalized.includes('.') ? normalized.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : normalized
}
const canonicalizeWeightUnit = (rawUnit: string): string => {
    const u = String(rawUnit || '').toUpperCase()
    if (u === 'GR' || u === 'GRS') return 'G'
    if (u === 'LT' || u === 'LTS') return 'L'
    if (u === 'KGS') return 'KG'
    if (u === 'MLS') return 'ML'
    return u
}
const normalizeWeightToken = (rawWeight: string): string => {
    const compact = String(rawWeight || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/GRS?\b/g, 'G')
        .replace(/LTS?\b/g, 'L')
        .replace(/KGS\b/g, 'KG')
        .replace(/MLS\b/g, 'ML')

    const multipack = compact.match(/^(\d+)X(\d+(?:\.\d+)?)(KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)$/)
    if (multipack) {
        const mult = String(Number(multipack[1] || '0'))
        const qty = normalizeWeightNumber(multipack[2] || '0')
        const unit = canonicalizeWeightUnit(multipack[3] || '')
        return `${mult}X${qty}${unit}`
    }

    const single = compact.match(/^(\d+(?:\.\d+)?)(KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)$/)
    if (single) {
        const qty = normalizeWeightNumber(single[1] || '0')
        const unit = canonicalizeWeightUnit(single[2] || '')
        return `${qty}${unit}`
    }

    return compact
}
const extractWeightFromName = (name: string) => {
    const match = String(name || '').match(/(\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:ML|MLS|G|GR|GRS|KG|KGS|L|LT|LTS|MG|UN)\b|\d+(?:[.,]\d+)?\s*(?:ML|MLS|G|GR|GRS|KG|KGS|L|LT|LTS|MG|UN)\b)/i)
    if (!match) return ''
    return normalizeWeightToken(String(match[0] || ''))
}

const buildCacheSearchTerm = (product: any) => {
    const name = String(product?.name || '').trim()
    const parts = [name]
    if (product?.brand) parts.push(String(product.brand).trim())
    if (product?.flavor) parts.push(String(product.flavor).trim())

    const weightFromName = extractWeightFromName(name)
    const rawWeight = normalizeWeightToken(String(product?.weight || '').trim())
    const effectiveWeight = weightFromName || rawWeight
    if (effectiveWeight) {
        const normalizedName = normalizeText(name)
        const normalizedWeight = normalizeText(effectiveWeight)
        if (!normalizedWeight || !normalizedName.includes(normalizedWeight)) {
            parts.push(effectiveWeight)
        }
    }

    return parts.filter(Boolean).join(' ').trim()
}

const shouldPersistImageCache = (searchTerm: string, imageUrl: string): boolean => {
    const term = String(searchTerm || '').trim()
    const url = String(imageUrl || '').trim()
    if (!term || !url) return false
    if (term.length > 160 || url.length > 2048) return false
    if (url.startsWith('blob:') || url.startsWith('data:')) return false
    return true
}

const filteredAssets = computed(() => {
    return assets.value
})

const assetTempIdMap = new WeakMap<object, string>()
let assetTempIdSeq = 0

const getAssetSelectionKey = (asset: any): string => {
    const raw = String(asset?.id || asset?.key || asset?.url || '').trim()
    if (raw) return raw
    if (asset && typeof asset === 'object') {
        const existing = assetTempIdMap.get(asset)
        if (existing) return existing
        assetTempIdSeq += 1
        const next = `asset-${assetTempIdSeq}`
        assetTempIdMap.set(asset, next)
        return next
    }
    return 'asset-fallback'
}

const selectedAssetsForApply = computed(() => {
    if (!selectedAssetKeys.value.length) return []
    const byKey = new Map<string, any>()
    for (const asset of assets.value) {
        byKey.set(getAssetSelectionKey(asset), asset)
    }
    return selectedAssetKeys.value
        .map((key) => byKey.get(key))
        .filter(Boolean)
})

const isAssetSelected = (asset: any): boolean => {
    const key = getAssetSelectionKey(asset)
    return selectedAssetKeys.value.includes(key)
}

const toggleAssetSelection = (asset: any, event?: MouseEvent) => {
    const key = getAssetSelectionKey(asset)
    if (!key) return

    if (event?.shiftKey && lastAssetSelectionAnchorKey.value) {
        const orderedKeys = filteredAssets.value.map((entry) => getAssetSelectionKey(entry)).filter(Boolean)
        const start = orderedKeys.indexOf(lastAssetSelectionAnchorKey.value)
        const end = orderedKeys.indexOf(key)
        if (start !== -1 && end !== -1) {
            const [from, to] = start <= end ? [start, end] : [end, start]
            const range = orderedKeys.slice(from, to + 1)
            selectedAssetKeys.value = Array.from(new Set([...selectedAssetKeys.value, ...range]))
            lastAssetSelectionAnchorKey.value = key
            return
        }
    }

    if (selectedAssetKeys.value.includes(key)) {
        selectedAssetKeys.value = selectedAssetKeys.value.filter((k) => k !== key)
        if (lastAssetSelectionAnchorKey.value === key) {
            lastAssetSelectionAnchorKey.value = null
        }
        return
    }
    selectedAssetKeys.value = [...selectedAssetKeys.value, key]
    lastAssetSelectionAnchorKey.value = key
}

const clearAssetSelection = () => {
    selectedAssetKeys.value = []
    lastAssetSelectionAnchorKey.value = null
}

const fetchAssets = async () => {
    const query = String(assetSearch.value || '').trim()
    if (query.length < MIN_ASSET_SEARCH_CHARS) {
        assets.value = []
        return
    }

    isLoadingAssets.value = true
    try {
        const headers = await getApiAuthHeaders()
        const product = selectedProductForAssetPicker.value
        const fetchQuery = {
            q: query,
            limit: 120,
            productName: String(product?.name || ''),
            brand: String(product?.brand || ''),
            flavor: String(product?.flavor || ''),
            weight: String(product?.weight || '')
        }

        let data: any = null
        let lastErr: any = null
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                data = await fetchUntyped('/api/assets', { headers, query: fetchQuery })
                lastErr = null
                break
            } catch (err: any) {
                lastErr = err
                if (!isTransientAssetFetchError(err) || attempt === 2) break
                await sleep(350 * (attempt + 1))
            }
        }
        if (lastErr) throw lastErr

        if (data && Array.isArray(data)) {
            assets.value = data
        } else {
            assets.value = []
        }
    } catch (error) {
        if (isTransientAssetFetchError(error)) {
            console.warn('Falha transitória ao buscar assets. Tente novamente em instantes.')
        } else {
            console.error('Falha ao buscar assets:', error)
        }
        assets.value = []
    } finally {
        isLoadingAssets.value = false
    }
}

const openAssetPicker = (index: number) => {
    if (!Number.isInteger(index) || index < 0) return
    selectedProductIndex.value = index
    assets.value = []
    selectedAssetKeys.value = []
    lastAssetSelectionAnchorKey.value = null
    const product = products.value[index]
    assetSearch.value = buildCacheSearchTerm(product)
    showAssetPicker.value = true
}

const markManualImageSelection = (product: SmartProduct, reason: string) => {
    product.imageSource = 'manual'
    product.imageProvider = 'manual'
    product.imageCandidateCount = 0
    product.imageAttemptCount = 0
    product.imageConfidence = 1
    product.imageDecisionReason = reason
    product.imageReviewReason = reason
    product.imageDecision = 'approved'
    product.imageCandidates = []
}

watch(showAssetPicker, (open) => {
    if (open) return
    selectedProductIndex.value = null
    assets.value = []
    assetSearch.value = ''
    selectedAssetKeys.value = []
    lastAssetSelectionAnchorKey.value = null
    isApplyingSelectedAssets.value = false
})

const applyAssetToProduct = async (asset: any, productIndex: number) => {
    const product = products.value[productIndex]
    if (!product) return
    product.imageUrl = resolveProductImageUrl(asset.url)
    product.status = 'done'
    product.error = undefined
    markManualImageSelection(product, 'Imagem aplicada manualmente a partir da galeria de assets')

    // Salvar no cache do banco para próximas buscas
    try {
        const searchTerm = buildCacheSearchTerm(product)
        const imageUrl = resolveProductImageUrl(asset.url)
        if (!shouldPersistImageCache(searchTerm, imageUrl)) return
        const headers = await getApiAuthHeaders()
        await $fetch('/api/cache-product-image', {
            method: 'POST',
            headers,
            body: {
                searchTerm,
                productName: product.name,
                brand: product.brand || null,
                flavor: product.flavor || null,
                weight: product.weight || null,
                imageUrl,
                s3Key: asset.key || asset.id || null,
                source: 'storage'
            }
        })
    } catch (err) {
        // Cache é opcional, não bloquear
        console.warn('[Cache] Falha ao salvar asset no cache:', err)
    }
}

const assignableSelectedAssetCount = computed(() => {
    const startIndex = Number(selectedProductIndex.value)
    if (!Number.isInteger(startIndex) || startIndex < 0) return 0
    const remainingProducts = Math.max(0, products.value.length - startIndex)
    return Math.min(selectedAssetsForApply.value.length, remainingProducts)
})

const canApplySelectedAssets = computed(() => assignableSelectedAssetCount.value > 0)

const applySelectedAssets = async () => {
    if (!canApplySelectedAssets.value || selectedProductIndex.value === null) return
    const startIndex = selectedProductIndex.value
    isApplyingSelectedAssets.value = true
    try {
        const selected = selectedAssetsForApply.value
        const maxCount = Math.min(selected.length, products.value.length - startIndex)
        for (let i = 0; i < maxCount; i++) {
            const asset = selected[i]
            if (!asset) continue
            await applyAssetToProduct(asset, startIndex + i)
        }
        showAssetPicker.value = false
    } finally {
        isApplyingSelectedAssets.value = false
    }
}

const uploadManualImageForProduct = async (productIndex: number, file: File) => {
    const product = products.value[productIndex]
    if (!product) return

    const prevImage = product.imageUrl
    // Mostrar preview local imediato enquanto faz upload
    const localPreview = URL.createObjectURL(file)
    let shouldRevokeLocalPreview = true
    product.imageUrl = localPreview
    product.status = 'processing'
    product.error = undefined
    product.imageDecision = undefined
    product.imageCandidates = []

    try {
        const compressed = await compressImageInBrowser(file).catch(() => file)
        const uploadBlob = compressed instanceof Blob ? compressed : file
        const contentType = String((uploadBlob as any)?.type || file.type || 'image/png')
        const uploadFilenameBase = sanitizeFilenameBase(product?.name || file.name || 'produto')
        const uploadFilenameExt = contentType.includes('webp') ? 'webp' : (contentType.split('/')[1] || 'png')
        const uploadFilename = `${uploadFilenameBase}.${uploadFilenameExt}`
        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false
        const remoteDisabled = isManualUploadRemoteTemporarilyDisabled()
        const applyLocalFallback = async (reason = 'Imagem aplicada manualmente em modo fallback') => {
            const localDataUrl = await createLocalImageFallbackUrl(uploadBlob, file)
            if (localDataUrl) {
                product.imageUrl = localDataUrl
            } else {
                shouldRevokeLocalPreview = false
                product.imageUrl = localPreview
            }
            product.status = 'done'
            markManualImageSelection(product, reason)
            product.error = undefined
        }

        if (browserOffline || remoteDisabled) {
            await applyLocalFallback()
            if (remoteDisabled) {
                console.warn('[Upload Manual] Upload remoto em cooldown por falhas recentes. Usando fallback local.')
            }
            return
        }

        // Upload para Wasabi + salvar no cache do banco
        let headers: Record<string, string>
        try {
            headers = await getApiAuthHeaders()
        } catch (authErr) {
            console.warn('[Upload Manual] Sessão indisponível para upload remoto. Aplicando fallback local.', authErr)
            await applyLocalFallback('Imagem aplicada localmente. Faça login novamente para enviar ao storage.')
            return
        }
        const createUploadForm = (includeMetadata: boolean) => {
            const fd = new FormData()
            fd.append('file', uploadBlob, uploadFilename)
            if (includeMetadata) {
                fd.append('productName', product.name || 'Produto')
                if (product.brand) fd.append('brand', product.brand)
                if (product.flavor) fd.append('flavor', product.flavor)
                if (product.weight) fd.append('weight', product.weight)
                if (product.productCode) fd.append('productCode', product.productCode)
            }
            return fd
        }

        let result: any = null
        try {
            result = await withRequestTimeout(MANUAL_UPLOAD_API_TIMEOUT_MS, (signal) =>
                fetchUntyped('/api/upload-product-image', {
                    method: 'POST',
                    headers,
                    body: createUploadForm(true),
                    signal: signal as any
                })
            )
        } catch (primaryErr) {
            if (isAuthFailureError(primaryErr)) {
                console.warn('[Upload Manual] Upload remoto bloqueado por autenticação. Aplicando fallback local.', primaryErr)
                await applyLocalFallback('Imagem aplicada localmente. Faça login novamente para persistir no storage.')
                return
            }
            disableManualUploadRemoteTemporarily(primaryErr)
            if (isManualUploadRemoteTemporarilyDisabled()) {
                console.warn('[Upload Manual] Falha de conectividade detectada. Aplicando fallback local imediato.')
                await applyLocalFallback()
                return
            }
            console.warn('[Upload Manual] Endpoint inteligente indisponível, tentando upload direto...', primaryErr)
            try {
                result = await withRequestTimeout(MANUAL_UPLOAD_API_TIMEOUT_MS, (signal) =>
                    fetchUntyped('/api/upload', {
                        method: 'POST',
                        headers,
                        body: createUploadForm(false),
                        signal: signal as any
                    })
                )
            } catch (fallbackErr) {
                if (isAuthFailureError(fallbackErr)) {
                    console.warn('[Upload Manual] Upload direto bloqueado por autenticação. Aplicando fallback local.', fallbackErr)
                    await applyLocalFallback('Imagem aplicada localmente. Faça login novamente para persistir no storage.')
                    return
                }
                disableManualUploadRemoteTemporarily(fallbackErr)
                if (isManualUploadRemoteTemporarilyDisabled()) {
                    console.warn('[Upload Manual] Falha de conectividade persistente. Aplicando fallback local.')
                    await applyLocalFallback()
                    return
                }
                console.warn('[Upload Manual] Upload via API falhou, tentando presigned direto...', fallbackErr)
                try {
                    result = await uploadManualViaPresigned(product, uploadBlob, contentType, file.name)
                } catch (presignedErr) {
                    disableManualUploadRemoteTemporarily(presignedErr)
                    console.warn('[Upload Manual] Presigned também falhou, aplicando fallback local...', presignedErr)
                    await applyLocalFallback()
                    return
                }
            }
        }

        if (result?.url) {
            // Se veio pelo fallback simples, salvar cache para próximas buscas
            if (!result?.source || result?.source === 'manual' || result?.source === 'manual-fallback') {
                try {
                    const searchTerm = buildCacheSearchTerm(product)
                    const imageUrl = String(result.publicUrl || result.url || '').trim()
                    if (shouldPersistImageCache(searchTerm, imageUrl)) {
                        await $fetch('/api/cache-product-image', {
                            method: 'POST',
                            headers,
                            body: {
                                searchTerm,
                                productName: product.name || 'Produto',
                                brand: product.brand || null,
                                flavor: product.flavor || null,
                                weight: product.weight || null,
                                imageUrl,
                                s3Key: result.key || null,
                                source: result?.source || 'manual-fallback'
                            }
                        })
                    }
                } catch (cacheErr) {
                    console.warn('[Upload Manual] Falha ao salvar fallback no cache:', cacheErr)
                }
            }
        }

        if (result?.url) {
            product.imageUrl = resolveProductImageUrl(result.url)
            const source = String((result as any)?.source || '').toLowerCase()
            markManualImageSelection(
                product,
                source === 'manual-fallback'
                    ? 'Imagem enviada manualmente com fallback local aplicado'
                    : 'Imagem enviada manualmente'
            )
            product.status = 'done'
            product.error = undefined
            console.log('[Upload Manual] Imagem salva no Wasabi:', product.name)
        } else {
            product.status = 'error'
            product.error = 'Upload não retornou URL'
            product.imageUrl = prevImage || null
        }
    } catch (err: any) {
        console.error('[Upload Manual] Falha:', err)
        product.imageUrl = prevImage || null
        product.status = 'error'
        product.error = err?.message || 'Falha no upload'
    } finally {
        if (shouldRevokeLocalPreview) {
            URL.revokeObjectURL(localPreview)
        }
    }
}

const openReviewImageUpload = (index: number) => {
    if (!Number.isInteger(index) || index < 0) return
    pendingReviewUploadIndex.value = index
    openFilePickerInput(reviewImageUploadInput.value)
}

const handleReviewImageUploadSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    const startIndex = Number(pendingReviewUploadIndex.value)
    input.value = ''
    pendingReviewUploadIndex.value = null
    if (!files.length) return
    if (!Number.isInteger(startIndex) || startIndex < 0) return

    // Se selecionar múltiplas imagens, aplica em sequência a partir do produto clicado:
    // imagem[0] -> produto[index], imagem[1] -> produto[index+1], etc.
    for (let i = 0; i < files.length; i++) {
        const targetIndex = startIndex + i
        if (targetIndex >= products.value.length) break
        await uploadManualImageForProduct(targetIndex, files[i]!)
    }
}

const selectedProductForAssetPicker = computed(() => {
    const idx = Number(selectedProductIndex.value)
    if (!Number.isInteger(idx) || idx < 0) return null
    return products.value[idx] || null
})

watch(() => reviewSearch.value, () => {
    reviewPage.value = 1
})

const getAssetDisplayName = (asset: any): string => {
    const explicit = String(asset?.name || '').trim()
    if (explicit) return explicit
    const keyLike = String(asset?.key || asset?.id || '').trim()
    if (!keyLike) return 'Imagem sem nome'
    const lastSegment = keyLike.split('/').pop() || keyLike
    try {
        return decodeURIComponent(lastSegment)
    } catch {
        return lastSegment
    }
}
</script>

<template>
    <Dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        title="Importação Inteligente"
        width="1280px"
    >
        <div class="flex flex-col gap-3 min-h-145 max-h-[84vh]">

            <!-- STEP 1: INPUT -->
            <div v-if="step === 'input'" class="flex flex-col gap-4 flex-1">
                <div
                    v-if="appendBaseProducts"
                    class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between gap-3 text-emerald-100 text-xs"
                >
                    <p>Adicionando itens na revisão atual ({{ appendBaseProducts.length }} existentes).</p>
                    <Button variant="ghost" size="sm" @click="backToReviewWithoutAppending">Voltar para revisão</Button>
                </div>

                <!-- Hero compacto -->
                <div class="text-center pt-1 pb-2">
                    <div class="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200 mb-3">
                        <Sparkles class="h-3.5 w-3.5" />
                        Entrada Inteligente
                    </div>
                    <h2 class="text-2xl font-semibold text-white tracking-[-0.03em]">
                        Importe a oferta do jeito que ela chegar
                    </h2>
                    <p class="mt-1.5 text-[12px] text-zinc-400 max-w-lg mx-auto">
                        Cole uma lista, envie arquivo ou arraste uma imagem. O sistema organiza tudo automaticamente para revisão.
                    </p>
                </div>

                <!-- Dois métodos de input lado a lado -->
                <div class="grid gap-4 md:grid-cols-2 flex-1">
                    <!-- Upload de arquivo -->
                    <div
                        class="group rounded-2xl border-2 border-dashed border-zinc-700/60 bg-zinc-900/30 p-6 flex flex-col items-center justify-center text-center transition-all hover:border-sky-400/40 hover:bg-sky-500/4 cursor-pointer min-h-70"
                        @dragover.prevent
                        @drop.prevent="handleDropFile"
                        @click="triggerFilePicker"
                    >
                        <input ref="listFileInput" type="file" class="hidden" :accept="LIST_FILE_ACCEPT" @change="handleFileSelected" />
                        <div class="w-14 h-14 rounded-2xl border border-sky-400/20 bg-sky-500/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                            <Upload class="h-6 w-6 text-sky-300" />
                        </div>
                        <div class="text-lg font-semibold text-white mb-1">Arquivo ou Imagem</div>
                        <div class="text-[12px] text-zinc-400 mb-4 max-w-70">
                            Arraste aqui ou clique para enviar. Aceita CSV, Excel, PDF, TXT e imagem.
                        </div>
                        <div class="flex flex-wrap justify-center gap-1.5">
                            <span v-for="fmt in ['CSV', 'XLSX', 'PDF', 'Imagem', 'TXT']" :key="fmt" class="rounded-full border border-zinc-700/80 bg-zinc-800/50 px-2.5 py-0.5 text-[10px] text-zinc-400">{{ fmt }}</span>
                        </div>
                        <Loader2 v-if="isParsing" class="w-5 h-5 mt-4 animate-spin text-sky-300" />
                    </div>

                    <!-- Colar lista -->
                    <div class="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 flex flex-col min-h-70">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <div class="text-sm font-semibold text-white">Colar Lista</div>
                                <div class="text-[11px] text-zinc-500">Quando você já tem os produtos em texto.</div>
                            </div>
                            <span class="rounded-full border border-zinc-700/80 bg-zinc-800/50 px-2.5 py-0.5 text-[10px] text-zinc-400">Manual</span>
                        </div>
                        <textarea
                            v-model="textInput"
                            placeholder="Ex: Arroz Tio João 5kg R$ 29,90&#10;Feijão Camil 1kg 8,90&#10;Óleo Soya 900ml 6,49..."
                            class="flex-1 min-h-45 w-full rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-white resize-none placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40 transition-colors"
                        ></textarea>
                        <div class="mt-3 flex items-center justify-between gap-3">
                            <div class="text-[10px] text-zinc-500 leading-relaxed">
                                Pode misturar nome, marca, peso e preço na mesma linha.
                            </div>
                            <Button @click="handleParse" :disabled="isParsing || !textInput.trim()" class="shrink-0 bg-sky-600 hover:bg-sky-500 text-white">
                                <Loader2 v-if="isParsing" class="w-4 h-4 mr-2 animate-spin" />
                                <template v-if="isParsing">Analisando...</template>
                                <template v-else>Processar Lista</template>
                            </Button>
                        </div>
                    </div>
                </div>

                <p v-if="parsingError" class="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[11px] text-rose-200">
                    {{ parsingError }}
                </p>
            </div>

            <!-- STEP 2: REVIEW -->
            <div
                v-else
                ref="reviewContainerRef"
                tabindex="0"
                class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1"
                @keydown="onReviewKeydown"
            >
                <input
                    ref="reviewImageUploadInput"
                    type="file"
                    class="hidden"
                    accept="image/*"
                    multiple
                    @change="handleReviewImageUploadSelected"
                />
                <!-- Review Header Compacto -->
                <div class="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2.5">
                    <!-- Linha 1: Título + Stats inline + Ações -->
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <h2 class="text-lg font-semibold text-white shrink-0">Revisão</h2>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                    <Check class="w-3 h-3" /> {{ imageStatusCounters.approved }}
                                </span>
                                <span class="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 border border-sky-500/25 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                                    {{ imageStatusCounters.pending }} fila
                                </span>
                                <span v-if="imageStatusCounters.ambiguous" class="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                    <AlertCircle class="w-3 h-3" /> {{ imageStatusCounters.ambiguous }}
                                </span>
                                <span v-if="imageStatusCounters.blocked" class="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/25 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                    {{ imageStatusCounters.blocked }} bloq.
                                </span>
                                <span class="rounded-lg bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-500">
                                    {{ reviewOperationLabel }}
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <Button variant="ghost" size="sm" class="h-7 px-2.5" :disabled="isSubmittingImport || !canRunImageQueue" @click="toggleImageQueueProcessing">
                                <Loader2 v-if="isImageQueueRunning && !isQueuePaused" class="w-3 h-3 mr-1 animate-spin" />
                                <Play v-else class="w-3 h-3 mr-1" />
                                <span class="text-[10px]">{{ imageQueueActionLabel }}</span>
                            </Button>
                            <Button v-if="imageQueueState.running" variant="ghost" size="sm" class="h-7 px-2.5" @click="stopImageQueue">
                                <X class="w-3 h-3 mr-1" />
                                <span class="text-[10px]">Parar</span>
                            </Button>
                            <Button
                                v-if="targetMode !== 'multi-frame'"
                                size="sm"
                                class="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                :disabled="importButtonDisabled"
                                @click="handleImport"
                            >
                                <Loader2 v-if="isProcessingProducts || isSubmittingImport" class="w-3 h-3 mr-1 animate-spin" />
                                <Check v-else class="w-3 h-3 mr-1" />
                                <span class="text-[10px] font-bold">Importar {{ products.length }}</span>
                            </Button>
                        </div>
                    </div>

                    <!-- Progress bar inline -->
                    <div v-if="showImageQueueControls && imageQueueProgress.total > 0" class="space-y-1">
                        <div class="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div class="h-full bg-emerald-500 transition-all duration-300" :style="{ width: `${imageQueueProgress.percent}%` }"></div>
                        </div>
                        <div class="flex items-center justify-between text-[9px] text-zinc-500">
                            <span>{{ imageQueueProgress.status }} • {{ imageQueueProgress.done }}/{{ imageQueueProgress.total }}<span v-if="imageQueueProgress.active"> • {{ imageQueueProgress.active }} ativas</span></span>
                            <span v-if="imageQueueProgress.failed">{{ imageQueueProgress.failed }} falhas</span>
                        </div>
                    </div>

                    <!-- Linha 2: Filtros + Busca -->
                    <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div class="flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
                            <button
                                v-for="option in reviewFilterOptions"
                                :key="option.value"
                                type="button"
                                class="shrink-0 h-7 rounded-lg px-3 text-[10px] font-medium transition-all"
                                :class="reviewFilter === option.value ? 'text-white bg-zinc-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'"
                                @click="reviewFilter = option.value"
                            >
                                {{ option.label }} <span class="ml-0.5 opacity-60">{{ option.count }}</span>
                            </button>
                        </div>
                        <div class="flex-1 min-w-0">
                            <Input v-model="reviewSearch" placeholder="Buscar por nome, marca, preço..." class="h-7 text-xs bg-zinc-950/50 border-zinc-800" />
                        </div>
                    </div>
                </div>

                <!-- Configurações compactas -->
                <details class="group shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/30 [&_summary::-webkit-details-marker]:hidden">
                    <summary class="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-zinc-800/40 transition-colors rounded-xl outline-none">
                        <div class="flex items-center gap-2 text-[10px] font-medium text-zinc-400">
                            <Settings2 class="w-3.5 h-3.5" />
                            Configurações
                            <span class="text-zinc-600 group-open:hidden">{{ selectedImportModeLabel }} • {{ selectedTargetModeLabel }} • {{ selectedLabelTemplateSummary }}</span>
                        </div>
                        <ChevronDown class="w-3.5 h-3.5 text-zinc-600 transition-transform group-open:rotate-180" />
                    </summary>
                    <div class="px-3 pb-3 pt-1 border-t border-zinc-800/60">
                        <div
                            class="grid gap-2"
                            :class="props.showImportMode ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'grid-cols-2 xl:grid-cols-4'"
                        >
                            <div v-if="props.showImportMode" class="space-y-1.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Modo <span class="text-zinc-600 font-normal">({{ Math.max(0, Number(props.existingCount || 0)) }} itens)</span></div>
                                <div class="grid grid-cols-2 gap-0.5 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                                    <button type="button" class="h-7 rounded text-[9px] font-bold uppercase tracking-widest transition-all" :class="importMode === 'replace' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'" @click="importMode = 'replace'">Substituir</button>
                                    <button type="button" class="h-7 rounded text-[9px] font-bold uppercase tracking-widest transition-all" :class="importMode === 'append' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'" @click="importMode = 'append'">Adicionar</button>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Etiqueta</div>
                                <div class="flex items-center gap-1.5">
                                    <img v-if="selectedLabelTemplate?.previewDataUrl" :src="selectedLabelTemplate.previewDataUrl" alt="preview" class="w-12 h-7 object-contain rounded bg-zinc-800/60 border border-zinc-700 cursor-pointer hover:border-zinc-500 transition-colors shrink-0" @click="showLabelPreview = true" />
                                    <select class="h-7 flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 text-[10px] text-zinc-200 focus:outline-none focus:border-zinc-600 min-w-0" :value="selectedLabelTemplateId" @change="selectedLabelTemplateId = String(($event.target as HTMLSelectElement).value || '')">
                                        <option value="">(padrão da zona)</option>
                                        <option v-for="tpl in labelTemplateList" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Destino</div>
                                <div class="grid grid-cols-2 gap-0.5 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                                    <button type="button" class="h-7 rounded text-[9px] font-bold uppercase tracking-widest transition-all" :class="targetMode === 'zone' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'" @click="targetMode = 'zone'">Zona</button>
                                    <button type="button" class="h-7 rounded text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50" :class="targetMode === 'multi-frame' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'" :disabled="!canUseMultiFrame" @click="targetMode = 'multi-frame'">Multi-frame</button>
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Fundo</div>
                                <select v-model="imageBgPolicy" class="h-7 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 text-[10px] text-zinc-200 focus:outline-none focus:border-zinc-600" :disabled="isImageQueueLocked">
                                    <option value="auto">Auto</option>
                                    <option value="never">Nunca remover</option>
                                    <option value="always">Sempre remover</option>
                                </select>
                            </div>
                            <div class="space-y-1.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Busca</div>
                                <div class="grid grid-cols-2 gap-0.5 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                                    <button v-for="option in imageMatchModeOptions" :key="option.value" type="button" class="h-7 rounded text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-45" :class="imageMatchMode === option.value ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'" :disabled="isImageQueueLocked" @click="imageMatchMode = option.value">{{ option.label }}</button>
                                </div>
                                <label class="text-[9px] text-zinc-500 flex items-center justify-between">
                                    <span>Threads</span>
                                    <select v-model.number="imageConcurrency" class="h-6 bg-zinc-900 border border-zinc-800 rounded px-1.5 text-[10px] text-zinc-300 focus:outline-none" :disabled="isImageQueueLocked">
                                        <option :value="3">3</option><option :value="4">4</option><option :value="5">5</option><option :value="6">6</option><option :value="8">8</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                </details>

                    <div
                        v-if="targetMode === 'multi-frame'"
                        class="mt-3 p-3 rounded-lg border border-white/10 bg-black/20 flex flex-col gap-3"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Frames selecionados</div>
                                <div class="text-[10px] text-zinc-500">
                                    Ordem automática: visual (topo para baixo, esquerda para direita)
                                </div>
                            </div>
                            <button
                                type="button"
                                class="text-[10px] text-zinc-300 border border-zinc-700 rounded px-2 py-1 hover:bg-white/5 transition-colors"
                                @click="toggleSelectAllFrames"
                            >
                                {{ selectedFrameIds.length === orderedFrameIds.length && orderedFrameIds.length > 0 ? 'Desmarcar todos' : 'Selecionar todos' }}
                            </button>
                        </div>

                        <div v-if="availableFrames.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                            <label
                                v-for="frame in availableFrames"
                                :key="frame.id"
                                class="flex items-center gap-2 text-xs text-zinc-300 border border-zinc-800 rounded px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="accent-emerald-500"
                                    :checked="selectedFrameSet.has(frame.id)"
                                    @change="toggleFrameSelection(frame.id)"
                                />
                                <span class="truncate">{{ frame.name }}</span>
                            </label>
                        </div>
                        <div v-else class="text-[11px] text-amber-300">
                            Nenhum frame disponível na página ativa.
                        </div>

                        <div class="border border-zinc-800 rounded-md overflow-hidden">
                            <div class="grid grid-cols-12 bg-zinc-900/70 text-[10px] uppercase tracking-widest text-zinc-500 px-2 py-1">
                                <div class="col-span-6">Oferta</div>
                                <div class="col-span-6">Frame destino</div>
                            </div>
                            <div class="max-h-36 overflow-y-auto custom-scrollbar divide-y divide-zinc-800">
                                <div
                                    v-for="row in productRows"
                                    :key="row.productId"
                                    class="grid grid-cols-12 px-2 py-1.5 items-center gap-2"
                                >
                                    <div class="col-span-6 min-w-0">
                                        <div class="text-xs text-zinc-200 truncate">{{ row.product?.name || `Produto ${row.index + 1}` }}</div>
                                    </div>
                                    <div class="col-span-6">
                                        <select
                                            class="w-full h-7 bg-transparent border border-zinc-700 rounded px-2 text-[11px] text-zinc-200 focus:outline-none"
                                            :value="getAssignedFrameId(row.productId) || ''"
                                            @change="setAssignmentForProduct(row.productId, String(($event.target as HTMLSelectElement).value || ''))"
                                        >
                                            <option value="">(sem frame)</option>
                                            <option
                                                v-for="frame in selectedFrames"
                                                :key="frame.id"
                                                :value="frame.id"
                                                :disabled="isFrameAssignedElsewhere(frame.id, row.productId)"
                                            >
                                                {{ frame.name }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="text-[11px] text-zinc-400">
                            Serão importadas <span class="text-zinc-200 font-semibold">{{ multiFrameImportCount }}</span> ofertas (regra: mínimo entre ofertas e frames selecionados).
                        </div>

                        <div class="flex justify-end pt-1">
                            <Button
                                size="sm"
                                @click="handleImport"
                                class="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                :disabled="importButtonDisabled"
                            >
                                <Loader2 v-if="isProcessingProducts || isSubmittingImport" class="w-3.5 h-3.5 mr-2 animate-spin" />
                                <Check v-else class="w-3.5 h-3.5 mr-2" />
                                Importar {{ multiFrameImportCount }} Produtos
                            </Button>
                        </div>
                    </div>

                    <div
                        v-if="targetMode === 'zone' && canUseMultiZone"
                        class="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 flex flex-wrap items-center gap-2"
                    >
                        <div class="flex items-center gap-2 mr-1.5">
                            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Zonas</span>
                            <span class="text-[10px] text-zinc-500">
                                {{ multiZoneImportCount }}/{{ productRows.length }}
                            </span>
                        </div>

                        <label class="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <span class="font-semibold uppercase tracking-widest text-zinc-500">Geral</span>
                            <select
                                class="h-6 max-w-44 rounded-lg border border-sky-500/30 bg-zinc-950 px-2 text-[10px] text-sky-100 focus:outline-none focus:border-sky-400/70"
                                :value="bulkZoneAssignmentValue"
                                @change="setBulkZoneAssignment(String(($event.target as HTMLSelectElement).value || ''))"
                            >
                                <option value="">Auto distribuir</option>
                                <option v-for="zone in availableZones" :key="zone.id" :value="zone.id">
                                    {{ zone.name }}
                                </option>
                            </select>
                        </label>

                        <div class="w-px h-4 bg-zinc-800 mx-0.5"></div>

                        <button
                            v-for="zone in availableZones"
                            :key="zone.id"
                            type="button"
                            class="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[10px] transition-colors"
                            :class="zoneFilterId === zone.id
                                ? 'border-sky-400/60 bg-sky-500/15 text-sky-100'
                                : 'border-zinc-700 bg-zinc-900/70 hover:border-zinc-500 text-zinc-200'"
                            :title="zone.frameName ? `${zone.name} · ${zone.frameName}` : zone.name"
                            @click="zoneFilterId = zoneFilterId === zone.id ? null : zone.id"
                        >
                            <span class="font-medium truncate max-w-28">{{ zone.name }}</span>
                            <span
                                class="rounded-md px-1.5 py-0.5 text-[9px] tabular-nums font-semibold"
                                :class="countProductsAssignedToZone(zone.id) > 0 ? 'bg-emerald-500/20 text-emerald-200' : 'bg-zinc-800 text-zinc-400'"
                            >
                                {{ countProductsAssignedToZone(zone.id) }}
                            </span>
                        </button>

                        <button
                            v-if="multiZoneUnassignedCount > 0"
                            type="button"
                            class="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[10px] transition-colors"
                            :class="zoneFilterId === '__none__'
                                ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-200'"
                            @click="zoneFilterId = zoneFilterId === '__none__' ? null : '__none__'"
                        >
                            <span class="font-medium">Sem zona</span>
                            <span class="rounded-md bg-amber-500/20 text-amber-200 px-1.5 py-0.5 text-[9px] tabular-nums font-semibold">{{ multiZoneUnassignedCount }}</span>
                        </button>

                        <button
                            v-if="zoneFilterId"
                            type="button"
                            class="text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 px-1"
                            @click="zoneFilterId = null"
                        >
                            limpar
                        </button>

                        <div class="w-px h-4 bg-zinc-800 mx-1"></div>

                        <button
                            type="button"
                            class="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-[10px] font-medium text-sky-200 transition-colors"
                            @click="autoDistributeZoneAssignments"
                        >
                            <Wand2 class="w-3 h-3" />
                            Auto distribuir
                        </button>
                    </div>


                <div
                    v-if="activeReviewRowMeta"
                    class="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)] flex-1 min-h-0"
                >
                    <aside class="rounded-2xl border border-zinc-800 bg-zinc-950/55 shadow-2xl shadow-black/20 flex flex-col min-h-0 max-h-[68vh] overflow-hidden">
                        <div class="px-4 py-3 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Produtos adicionados</div>
                                    <div class="mt-1 flex items-baseline gap-2">
                                        <span class="text-2xl font-semibold leading-none text-white">{{ filteredProductRows.length }}</span>
                                        <span class="text-[11px] text-zinc-500">de {{ products.length }} no lote</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button type="button" class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30" @click="gotoReviewPage(reviewPage - 1)" :disabled="reviewPage <= 1">
                                        <ChevronDown class="h-4 w-4 rotate-90" />
                                    </button>
                                    <span class="min-w-10 text-center text-[10px] text-zinc-500 tabular-nums">{{ reviewPage }}/{{ reviewPageCount }}</span>
                                    <button type="button" class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30" @click="gotoReviewPage(reviewPage + 1)" :disabled="reviewPage >= reviewPageCount">
                                        <ChevronDown class="h-4 w-4 -rotate-90" />
                                    </button>
                                </div>
                            </div>
                            <div class="mt-3 grid grid-cols-4 gap-1.5">
                                <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                                    <div class="text-[9px] uppercase text-emerald-300/70">Prontos</div>
                                    <div class="text-sm font-semibold text-emerald-200">{{ imageStatusCounters.approved }}</div>
                                </div>
                                <div class="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1">
                                    <div class="text-[9px] uppercase text-sky-300/70">Fila</div>
                                    <div class="text-sm font-semibold text-sky-200">{{ imageStatusCounters.pending }}</div>
                                </div>
                                <div class="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1">
                                    <div class="text-[9px] uppercase text-amber-300/70">Revisar</div>
                                    <div class="text-sm font-semibold text-amber-200">{{ imageStatusCounters.ambiguous }}</div>
                                </div>
                                <div class="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1">
                                    <div class="text-[9px] uppercase text-rose-300/70">Bloq.</div>
                                    <div class="text-sm font-semibold text-rose-200">{{ imageStatusCounters.blocked }}</div>
                                </div>
                            </div>
                        </div>

                        <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                            <button
                                v-for="row in reviewRowsWithMeta"
                                :key="row.productId"
                                type="button"
                                class="w-full rounded-xl border p-2.5 text-left transition-all duration-200"
                                :class="activeReviewRowIndex === row.index
                                    ? 'border-sky-400/40 bg-sky-500/10 shadow-lg shadow-sky-950/20'
                                    : 'border-zinc-800/60 bg-zinc-900/35 hover:border-zinc-700 hover:bg-zinc-800/45'"
                                @click="activeReviewRowIndex = row.index"
                            >
                                <div class="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
                                    <div
                                        :class="[
                                            'h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-zinc-950/80',
                                            thumbnailUiStateClass(row.product)
                                        ]"
                                    >
                                        <img
                                            v-if="row.product?.imageUrl"
                                            :src="resolveProductImageUrl(row.product.imageUrl)"
                                            class="h-full w-full object-contain"
                                            alt=""
                                        />
                                        <div v-else class="flex h-full w-full items-center justify-center text-[8px] text-zinc-600">
                                            {{ row.product?.status === 'processing' ? '...' : '?' }}
                                        </div>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center justify-between gap-1">
                                            <div class="line-clamp-2 text-[12px] font-semibold leading-tight text-white">
                                                {{ row.product.name || `Produto ${row.index + 1}` }}
                                            </div>
                                            <span
                                                class="shrink-0 w-2 h-2 rounded-full"
                                                :class="{
                                                    'bg-emerald-500': row.imageStatusMeta.stateTone === 'high',
                                                    'bg-amber-500': row.imageStatusMeta.stateTone === 'medium' || row.imageStatusMeta.stateTone === 'low',
                                                    'bg-rose-500': row.imageStatusMeta.stateTone === 'critical',
                                                    'bg-zinc-600': row.imageStatusMeta.stateTone === 'unknown'
                                                }"
                                            ></span>
                                        </div>
                                        <div class="mt-1 text-[10px] text-zinc-500 line-clamp-1">
                                            <span class="text-zinc-400">#{{ row.index + 1 }}</span>
                                            <span v-if="row.product.brand"> • {{ row.product.brand }}</span>
                                            <span v-if="row.product.weight"> • {{ row.product.weight }}</span>
                                        </div>
                                        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
                                            <span v-if="hasCommercialPrice(row.product)" class="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-200">
                                                R$ {{ getFirstCommercialPrice(row.product) }}
                                            </span>
                                            <span v-else class="rounded-md border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-200">Sem preco</span>
                                            <select
                                                v-if="targetMode === 'zone' && canUseMultiZone"
                                                :value="getAssignedZoneId(row.productId) || ''"
                                                @change="setZoneAssignmentForProduct(row.productId, String(($event.target as HTMLSelectElement).value || ''))"
                                                @click.stop
                                                class="h-5 rounded-md border bg-zinc-900 px-1.5 text-[9px] text-zinc-200 focus:outline-none focus:border-sky-400/60 max-w-32"
                                                :class="getAssignedZoneId(row.productId) ? 'border-zinc-700/70' : 'border-amber-500/40 text-amber-200'"
                                                :title="getProductDestinationLabel(row.productId)"
                                            >
                                                <option value="">(sem zona)</option>
                                                <option v-for="zone in availableZones" :key="zone.id" :value="zone.id">{{ zone.name }}</option>
                                            </select>
                                            <span
                                                v-else
                                                class="rounded-md border border-zinc-700/70 bg-zinc-800/50 px-1.5 py-0.5 text-zinc-400 truncate max-w-32"
                                            >{{ getProductDestinationLabel(row.productId) }}</span>
                                            <span class="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-zinc-500">{{ row.imageStatusMeta.state }}</span>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            <div
                                v-if="!reviewRowsWithMeta.length"
                                class="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-[10px] text-zinc-500"
                            >
                                Nenhum produto para "{{ reviewSearch }}".
                            </div>
                        </div>

                        <div class="px-2 py-2 border-t border-zinc-800 shrink-0">
                            <button
                                @click="startAppendFromReview"
                                class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 text-[10px] font-bold uppercase tracking-widest text-sky-100 transition-colors hover:bg-sky-500/20"
                            >
                                <Plus class="h-3 w-3" />
                                Adicionar mais produtos
                            </button>
                        </div>
                    </aside>

                    <!-- Conteúdo principal scrollável -->
                    <div class="overflow-y-auto custom-scrollbar space-y-3 pr-1">
                        <!-- Produto em foco: imagem + info + ações -->
                        <section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                            <div class="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                                <!-- Imagem do produto -->
                                <div class="space-y-2">
                                    <div
                                        :class="[
                                            'relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-zinc-950/80',
                                            thumbnailUiStateClass(activeReviewRowMeta.product)
                                        ]"
                                    >
                                        <template v-if="activeReviewRowMeta.product?.imageUrl">
                                            <img
                                                :src="resolveProductImageUrl(activeReviewRowMeta.product.imageUrl)"
                                                class="h-full w-full object-contain p-3"
                                                :class="activeReviewRowMeta.product?.status === 'processing' ? 'opacity-30' : ''"
                                                alt="Imagem do produto ativo"
                                            />
                                            <div v-if="activeReviewRowMeta.product?.status === 'processing'" class="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
                                                <Loader2 class="h-5 w-5 animate-spin text-sky-300" />
                                            </div>
                                        </template>
                                        <template v-else-if="activeReviewRowMeta.product?.status === 'processing'">
                                            <Loader2 class="h-5 w-5 animate-spin text-sky-300" />
                                        </template>
                                        <template v-else>
                                            <div class="text-[10px] text-zinc-500">{{ thumbnailStatusText(activeReviewRowMeta.product) }}</div>
                                        </template>
                                        <div class="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                                            {{ activeReviewRowMeta.imageStatusMeta.source }}
                                        </div>
                                    </div>
                                    <div class="flex gap-1.5 text-[9px] text-zinc-500">
                                        <span>Conf. {{ activeReviewRowMeta.imageStatusMeta.confidence }}</span>
                                        <span>•</span>
                                        <span>{{ activeReviewRowMeta.imageStatusMeta.attemptsText }}</span>
                                    </div>
                                </div>

                                <!-- Info + Ações -->
                                <div class="min-w-0 space-y-3">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase" :class="activeDecisionToneClass">{{ activeDecisionLabel }}</span>
                                                <span class="text-[10px] text-zinc-500">Item {{ activeReviewRowMeta.index + 1 }}</span>
                                            </div>
                                            <h3 class="text-lg font-semibold leading-tight text-white">
                                                {{ activeReviewRowMeta.product.name || `Produto ${activeReviewRowMeta.index + 1}` }}
                                            </h3>
                                            <div class="mt-1 text-[11px] text-zinc-400">
                                                {{ activeReviewRowMeta.product.brand || 'Sem marca' }}
                                                <span v-if="activeReviewRowMeta.product.weight"> • {{ activeReviewRowMeta.product.weight }}</span>
                                                <span v-if="activeReviewRowMeta.product.productCode"> • {{ activeReviewRowMeta.product.productCode }}</span>
                                            </div>
                                        </div>
                                        <button type="button" class="shrink-0 h-7 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 text-[9px] font-bold uppercase text-rose-200 hover:bg-rose-500/20 transition-colors" @click="removeProduct(activeReviewRowMeta.index)">
                                            <X class="h-3 w-3 inline mr-1" />Remover
                                        </button>
                                    </div>

                                    <!-- Ações rápidas -->
                                    <div class="flex flex-wrap gap-1.5">
                                        <button type="button" class="h-8 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-[10px] font-bold uppercase text-sky-100 hover:bg-sky-500/20 transition-colors" @click="runImageQuickAction(activeReviewRowMeta, 'search')">Buscar</button>
                                        <button type="button" class="h-8 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 text-[10px] font-bold uppercase text-zinc-200 hover:bg-zinc-700/60 transition-colors" @click="reprocessProductImage(activeReviewRowMeta.index, true)">Reprocessar</button>
                                        <button type="button" class="h-8 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 text-[10px] font-bold uppercase text-zinc-200 hover:bg-zinc-700/60 transition-colors" @click="openAssetPicker(activeReviewRowMeta.index)">Storage</button>
                                        <button type="button" class="h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[10px] font-bold uppercase text-emerald-100 hover:bg-emerald-500/20 transition-colors" @click="openReviewImageUpload(activeReviewRowMeta.index)">
                                            <Upload class="h-3 w-3 inline mr-1" />Upload
                                        </button>
                                    </div>

                                    <!-- Próxima ação sugerida -->
                                    <div v-if="activeReviewRowMeta.imageNextAction" class="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100 flex items-center justify-between gap-2">
                                        <div>
                                            <span class="font-semibold text-amber-200">{{ activeReviewRowMeta.imageNextAction.label }}:</span>
                                            <span class="ml-1 text-amber-50/80">{{ activeReviewRowMeta.imageNextAction.helper }}</span>
                                        </div>
                                        <button type="button" class="shrink-0 h-7 rounded-md border border-amber-400/25 bg-amber-500/15 px-2.5 text-[9px] font-bold uppercase text-amber-100 hover:bg-amber-500/25 transition-colors" @click="runImageNextAction(activeReviewRowMeta)">Executar</button>
                                    </div>

                                    <!-- Motivo -->
                                    <p v-if="activeReviewRowMeta.product.imageReviewReason || activeReviewRowMeta.product.imageDecisionReason" class="text-[10px] text-zinc-500 leading-relaxed">
                                        {{ activeReviewRowMeta.product.imageReviewReason || activeReviewRowMeta.product.imageDecisionReason }}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <!-- Sugestões de imagem -->
                        <section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                    Sugestões de imagem
                                    <span v-if="activeReviewCandidates.length" class="text-zinc-500 font-normal ml-1">({{ activeReviewCandidates.length }})</span>
                                </div>
                                <button type="button" class="h-7 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 text-[9px] font-bold uppercase text-zinc-300 hover:bg-zinc-700/60 transition-colors disabled:opacity-50" :disabled="isActiveReviewSuggestionLoading" @click="fetchReviewSuggestionsForRow(activeReviewRowMeta, { force: true })">
                                    <Loader2 v-if="isActiveReviewSuggestionLoading" class="h-3 w-3 animate-spin inline" />
                                    <span v-else>Atualizar</span>
                                </button>
                            </div>

                            <div v-if="isActiveReviewSuggestionLoading && !activeReviewCandidates.length" class="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-6 text-center text-[10px] text-zinc-500">
                                Buscando imagens...
                            </div>
                            <div v-else-if="activeReviewCandidates.length" class="grid gap-2 grid-cols-2 xl:grid-cols-3">
                                <button
                                    v-for="(candidate, candidateIndex) in activeReviewCandidates"
                                    :key="getReviewCandidateRenderKey(candidate, candidateIndex)"
                                    type="button"
                                    class="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/4"
                                    @click="applyCandidateToReviewRow(activeReviewRowMeta, candidate)"
                                >
                                    <div class="relative aspect-4/3 bg-zinc-900/60">
                                        <img :src="resolveProductImageUrl(candidate.previewUrl || candidate.url)" class="h-full w-full object-contain p-2" alt="" />
                                        <div v-if="candidate.recommended" class="absolute left-1.5 top-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Recomendada</div>
                                        <div class="absolute right-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">{{ candidate.source === 's3' ? 'Storage' : 'Busca' }}</div>
                                    </div>
                                    <div class="p-2">
                                        <div class="flex items-center justify-between gap-1">
                                            <div class="line-clamp-1 text-[10px] font-medium text-white">{{ candidate.title || candidate.domain || 'Imagem' }}</div>
                                            <span class="text-[9px] font-semibold text-zinc-300 shrink-0">{{ formatCandidateConfidence(candidate) }}</span>
                                        </div>
                                        <div class="text-[9px] text-emerald-300 font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Usar esta</div>
                                    </div>
                                </button>
                            </div>
                            <div v-else class="rounded-lg border border-dashed border-zinc-800 px-4 py-5 text-center text-[10px] text-zinc-500">
                                {{ activeReviewSuggestionError || 'Sem candidatas. Use Storage, Upload ou Reprocessar.' }}
                            </div>
                            <div v-if="activeReviewSuggestionError" class="mt-2 text-[9px] text-rose-300/80">{{ activeReviewSuggestionError }}</div>
                        </section>

                        <!-- Dados comerciais -->
                        <section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                            <div class="flex items-center justify-between gap-3 mb-3">
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Dados comerciais</div>
                                <button type="button" class="h-7 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 text-[9px] font-bold uppercase text-zinc-300 hover:bg-zinc-700/60 transition-colors" @click="toggleAdvancedFields(activeReviewRowMeta.productId)">
                                    <SlidersHorizontal class="h-3 w-3 inline mr-1" />
                                    {{ isAdvancedFieldsExpanded(activeReviewRowMeta.productId) ? 'Ocultar' : 'Avançado' }}
                                </button>
                            </div>

                            <div class="grid gap-3 xl:grid-cols-2">
                                <!-- Identidade -->
                                <div class="space-y-2">
                                    <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                        Nome
                                        <input v-model="activeReviewRowMeta.product.name" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="Nome do produto" />
                                    </label>
                                    <div class="grid gap-2 grid-cols-2">
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Marca
                                            <input v-model="activeReviewRowMeta.product.brand" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="Marca" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Peso
                                            <input v-model="activeReviewRowMeta.product.weight" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="500G, 1L" />
                                        </label>
                                    </div>
                                    <div class="grid gap-2 grid-cols-2">
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            EAN / Código
                                            <input v-model="activeReviewRowMeta.product.productCode" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="Código" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Condição
                                            <input :value="activeReviewRowMeta.product.specialCondition ?? ''" @input="setActiveReviewStringField('specialCondition', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="ACIMA DE 36 UN." />
                                        </label>
                                    </div>
                                </div>

                                <!-- Preços -->
                                <div class="space-y-2">
                                    <div v-if="!hasCommercialPrice(activeReviewRowMeta.product)" class="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-100">
                                        Este produto ainda esta sem preco. Preencha pelo menos um campo antes de importar.
                                    </div>
                                    <div class="grid gap-2 grid-cols-2">
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            R$ Unidade
                                            <input v-model="activeReviewRowMeta.product.priceUnit" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="0,00" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            R$ Embalagem
                                            <input v-model="activeReviewRowMeta.product.pricePack" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="0,00" />
                                        </label>
                                    </div>
                                    <div class="grid gap-2 grid-cols-2">
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                                            R$ Especial Un
                                            <input v-model="activeReviewRowMeta.product.priceSpecialUnit" class="mt-1 h-9 w-full rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 text-sm text-emerald-100 placeholder:text-emerald-300/30 focus:outline-none focus:border-emerald-500" placeholder="0,00" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                                            R$ Especial
                                            <input v-model="activeReviewRowMeta.product.priceSpecial" class="mt-1 h-9 w-full rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 text-sm text-emerald-100 placeholder:text-emerald-300/30 focus:outline-none focus:border-emerald-500" placeholder="0,00" />
                                        </label>
                                    </div>
                                    <div class="grid gap-2 grid-cols-3">
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Embal.
                                            <input :value="activeReviewRowMeta.product.packageLabel ?? ''" @input="setActiveReviewUppercaseField('packageLabel', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="FD" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Qtd
                                            <input type="number" :value="activeReviewRowMeta.product.packQuantity ?? ''" @input="setActiveReviewPositiveNumberField('packQuantity', ($event.target as any).value)" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="12" />
                                        </label>
                                        <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            Un
                                            <input :value="activeReviewRowMeta.product.packUnit ?? ''" @input="setActiveReviewUppercaseField('packUnit', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="UN" />
                                        </label>
                                    </div>

                                    <!-- Avançados -->
                                    <details class="rounded-lg border border-zinc-800 bg-zinc-950/30 p-2.5 [&_summary::-webkit-details-marker]:hidden" :open="isAdvancedFieldsExpanded(activeReviewRowMeta.productId)">
                                        <summary class="cursor-pointer text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300">Campos avançados</summary>
                                        <div class="mt-2 grid gap-2 grid-cols-2">
                                            <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                Preço
                                                <input :value="activeReviewRowMeta.product.price ?? ''" @input="setActiveReviewStringField('price', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="0,00" />
                                            </label>
                                            <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                R$ Atacado
                                                <input :value="activeReviewRowMeta.product.priceWholesale ?? ''" @input="setActiveReviewStringField('priceWholesale', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="0,00" />
                                            </label>
                                            <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                Trigger
                                                <input type="number" :value="activeReviewRowMeta.product.wholesaleTrigger ?? ''" @input="setActiveReviewPositiveNumberField('wholesaleTrigger', ($event.target as any).value)" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="10" />
                                            </label>
                                            <label class="block text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                Un Trigger
                                                <input :value="activeReviewRowMeta.product.wholesaleTriggerUnit ?? ''" @input="setActiveReviewUppercaseField('wholesaleTriggerUnit', String(($event.target as any).value || ''))" class="mt-1 h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-400/40" placeholder="FD" />
                                            </label>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </section>

                        <!-- Fechamento compacto -->
                        <section class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                            <div class="flex items-center justify-between gap-3">
                                <div class="flex items-center gap-2 text-[10px]" :class="importReadinessToneClass.replace('border-', 'text-').split(' ').filter((c: string) => c.startsWith('text-'))[0]">
                                    <AlertCircle class="h-3.5 w-3.5 shrink-0" v-if="missingCommercialPriceCount > 0 || imageStatusCounters.blocked > 0 || imageStatusCounters.ambiguous > 0" />
                                    <Loader2 class="h-3.5 w-3.5 animate-spin shrink-0" v-else-if="imageStatusCounters.pending > 0" />
                                    <Check class="h-3.5 w-3.5 shrink-0" v-else />
                                    <span class="font-medium">{{ importReadinessText }}</span>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    <Button variant="ghost" size="sm" class="h-7 px-2" @click="startImageProcessing(true)" :disabled="isImageQueueRunning || isSubmittingImport">
                                        <RefreshCw class="h-3 w-3 mr-1" />
                                        <span class="text-[9px]">Reprocessar</span>
                                    </Button>
                                    <Button
                                        v-if="targetMode !== 'multi-frame'"
                                        size="sm"
                                        class="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                        :disabled="importButtonDisabled"
                                        @click="handleImport"
                                    >
                                        <Loader2 v-if="isProcessingProducts || isSubmittingImport" class="h-3 w-3 mr-1 animate-spin" />
                                        <Check v-else class="h-3 w-3 mr-1" />
                                        <span class="text-[10px] font-bold">Importar {{ products.length }}</span>
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
                <div
                    v-else
                    class="rounded-[28px] border border-dashed border-white/10 bg-white/2 px-6 py-10 text-center text-[12px] leading-relaxed text-zinc-500"
                >
                    Nenhum produto disponível nesta revisão. Ajuste os filtros ou volte para a entrada para carregar um novo lote.
                </div>
            </div>

        </div>
    </Dialog>

    <Dialog v-model="showAssetPicker" title="Selecionar imagens" width="720px">
        <div class="flex flex-col gap-3">
            <div v-if="selectedProductForAssetPicker" class="text-xs text-zinc-400 leading-relaxed">
                Produto inicial: <span class="text-zinc-200 font-medium">{{ selectedProductForAssetPicker.name }}</span>
                <span class="text-zinc-500">. Selecione várias imagens e aplique em sequência nos próximos cards.</span>
            </div>
            <div class="flex items-center gap-2">
                <Input
                    v-model="assetSearch"
                    placeholder="Buscar no storage (ex: COCA COLA 2L)"
                    class="flex-1"
                    @keydown.enter.prevent="fetchAssets"
                />
                <Button variant="ghost" size="sm" @click="fetchAssets" :disabled="isLoadingAssets">
                    <Loader2 v-if="isLoadingAssets" class="w-3.5 h-3.5 animate-spin" />
                    <span v-else>Buscar</span>
                </Button>
            </div>

            <div class="flex items-center justify-between gap-2 text-[11px]">
                <div class="text-zinc-500">
                    Selecionadas: <span class="text-zinc-200 font-medium">{{ selectedAssetsForApply.length }}</span>
                    <span v-if="selectedAssetsForApply.length" class="ml-1 text-zinc-500">
                        ({{ assignableSelectedAssetCount }} serão aplicadas)
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        @click="clearAssetSelection"
                        :disabled="!selectedAssetsForApply.length || isApplyingSelectedAssets"
                    >
                        Limpar
                    </Button>
                    <Button
                        size="sm"
                        class="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        @click="applySelectedAssets"
                        :disabled="!canApplySelectedAssets || isApplyingSelectedAssets"
                    >
                        <Loader2 v-if="isApplyingSelectedAssets" class="w-3.5 h-3.5 mr-2 animate-spin" />
                        <Check v-else class="w-3.5 h-3.5 mr-2" />
                        Aplicar selecionadas
                    </Button>
                </div>
            </div>

            <div class="max-h-90 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg bg-zinc-900/50 p-3">
                <div v-if="isLoadingAssets" class="text-xs text-zinc-500">Carregando imagens...</div>
                <div v-else-if="assetSearch.trim().length < MIN_ASSET_SEARCH_CHARS" class="text-xs text-zinc-500">
                    Digite ao menos {{ MIN_ASSET_SEARCH_CHARS }} caracteres e clique em buscar.
                </div>
                <div v-else-if="!filteredAssets.length" class="text-xs text-zinc-500">Nenhuma imagem encontrada.</div>
                <div v-else class="grid grid-cols-3 gap-2">
                    <button
                        v-for="asset in filteredAssets"
                        :key="getAssetSelectionKey(asset)"
                        :class="[
                            'rounded-lg overflow-hidden border transition-all text-left relative',
                            isAssetSelected(asset)
                                ? 'bg-zinc-800 border-emerald-500 ring-1 ring-emerald-400/50'
                                : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                        ]"
                        @click="toggleAssetSelection(asset, $event)"
                    >
                        <div
                            v-if="isAssetSelected(asset)"
                            class="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow"
                        >
                            <Check class="w-3 h-3" />
                        </div>
                        <div class="aspect-square">
                            <img :src="asset.url" class="w-full h-full object-cover" />
                        </div>
                        <div class="px-2 py-1.5 border-t border-zinc-700/80 bg-zinc-900/60">
                            <p class="text-[10px] text-zinc-200 leading-tight line-clamp-2">
                                {{ getAssetDisplayName(asset) }}
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </Dialog>

    <!-- Label Preview Fullscreen Modal -->
    <Dialog v-model="showLabelPreview" title="Preview da Etiqueta" fullscreen>
        <div class="flex flex-col items-center justify-center w-full h-full">
            <img
                v-if="selectedLabelTemplate?.previewDataUrl"
                :src="selectedLabelTemplate.previewDataUrl"
                alt="Preview em tela cheia"
                class="max-w-full max-h-full object-contain"
            />
            <div v-else class="text-zinc-500 text-sm">Nenhuma etiqueta selecionada</div>
        </div>
    </Dialog>
</template>
