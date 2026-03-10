<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { Sparkles, X, Check, AlertCircle, Loader2, Upload, Plus, Play, RefreshCw, ChevronDown } from 'lucide-vue-next'
import { useProductProcessor, type SmartProduct } from '../composables/useProductProcessor'
import { toWasabiDirectUrl } from '~/utils/storageProxy'
import type { LabelTemplate } from '~/types/label-template'

type ImportTargetMode = 'zone' | 'multi-frame'
type ImageBgPolicy = 'auto' | 'never' | 'always'
type ImageMatchMode = 'precise' | 'fast'
type ImageQuickAction = 'search' | 'upload' | 'storage' | 'reprocess'
type FrameCandidate = { id: string; name: string; left?: number; top?: number }
type FrameAssignment = { productId: string; frameId: string | null }
type ProductImportOptions = {
    mode?: 'replace' | 'append'
    labelTemplateId?: string
    targetMode?: ImportTargetMode
    selectedFrameIds?: string[]
    frameAssignments?: FrameAssignment[]
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

const props = defineProps<{
    modelValue: boolean
    initialProducts?: SmartProduct[]
    showImportMode?: boolean
    existingCount?: number
    labelTemplates?: LabelTemplate[]
    initialLabelTemplateId?: string
    availableFramesForImport?: FrameCandidate[]
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
const importMode = ref<'replace' | 'append'>('replace')
const targetMode = ref<ImportTargetMode>('zone')
const selectedFrameIds = ref<string[]>([])
const frameAssignmentsMap = ref<Record<string, string | null>>({})
// Importacao inteligente: por padrao, queremos remover o fundo das imagens encontradas.
const imageBgPolicy = ref<ImageBgPolicy>('always')
const isSubmittingImport = ref(false)
const appendBaseProducts = ref<SmartProduct[] | null>(null)

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
    const source = String(p?.imageSource || '')
    const provider = String(p?.imageProvider || '')
    const confidence = Number.isFinite(Number(p?.imageConfidence)) ? Number(p.imageConfidence).toFixed(4) : 'na'
    const candidates = Number.isFinite(Number(p?.imageCandidateCount))
        ? String(Math.max(0, Math.floor(Number(p.imageCandidateCount))))
        : 'na'
    const attempts = Number.isFinite(Number(p?.imageAttemptCount))
        ? String(Math.max(0, Math.floor(Number(p.imageAttemptCount))))
        : 'na'
    const reviewReason = String(p?.imageReviewReason || p?.imageDecisionReason || p?.error || '')
    return `${status}|${source}|${provider}|${confidence}|${candidates}|${attempts}|${reviewReason}`
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
        return {
            state: 'Revisão',
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
        stopImageQueue()
        resetImageProcessingState()
        reviewPage.value = 1
        activeReviewRowIndex.value = null
        return
    }

    isSubmittingImport.value = false
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
    await parseText(textInput.value);
    
    if (products.value.length > 0) {
        if (shouldAppend) mergeParsedProductsWithAppendBase()
        step.value = 'review';
        // Process all images automatically
        await startImageProcessing()
    }
}

const triggerFilePicker = () => {
    listFileInput.value?.click()
}

const handleFileSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const shouldAppend = !!appendBaseProducts.value
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
    await parseFile(file)
    if (products.value.length > 0) {
        if (shouldAppend) mergeParsedProductsWithAppendBase()
        step.value = 'review'
        await startImageProcessing()
    }
}

const createEmptyProduct = (): SmartProduct => ({
    id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

    emit('import', JSON.parse(JSON.stringify(products.value)), opts)
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
            image.onload = () => resolve(image)
            image.onerror = reject
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

const filteredProductRows = computed(() => {
    if (!reviewSearch.value.trim()) return productRows.value
    const filteredSet = new Set<any>(filteredProducts.value)
    return productRows.value.filter((row) => filteredSet.has(row.product))
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
const reviewPageCount = computed(() => Math.max(1, Math.ceil(filteredProductRows.value.length / REVIEW_PAGE_SIZE)))
const gotoReviewPage = (nextPage: number) => {
    const totalPages = reviewPageCount.value
    const normalized = Math.min(Math.max(1, Number(nextPage) || 1), totalPages)
    reviewPage.value = normalized
}

const imageStatusCounters = computed(() => {
    const rows = filteredProductRowsForAll.value
    let done = 0
    let pending = 0
    let conflict = 0
    for (const row of rows) {
        if (!row) continue
        if (row.status === 'done') done += 1
        else if (row.status === 'review_pending' || row.status === 'error') conflict += 1
        else pending += 1
    }
    return { done, pending, conflict, total: rows.length }
})

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
    const status = String(row?.status || '')
    if (status === 'done') return 'ring-1 ring-emerald-500/50 border-emerald-700/70'
    if (status === 'processing') return 'ring-1 ring-blue-500/55 border-blue-700/70'
    if (status === 'review_pending') return 'ring-1 ring-amber-500/55 border-amber-700/70'
    if (status === 'error') return 'ring-1 ring-rose-500/55 border-rose-700/70'
    return 'ring-1 ring-zinc-700/60 border-zinc-700'
}

const thumbnailStatusText = (row: any): string => {
    const status = String(row?.status || '')
    if (status === 'pending' && isRetryingImage(row)) return 'Reprocessando'
    if (status === 'processing') return 'Processando...'
    if (status === 'review_pending') return 'Revisão pendente'
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
        const input = document.getElementById(`image-upload-${row.productId}`)
        if (input instanceof HTMLInputElement) {
            input.click()
        }
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
    const input = document.getElementById(`image-upload-${row.productId}`)
    if (input instanceof HTMLInputElement) {
        input.click()
    }
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

const orderedFrameIds = computed(() => availableFrames.value.map(frame => frame.id))
const selectedFrameSet = computed(() => new Set(selectedFrameIds.value))
const selectedFrames = computed(() => availableFrames.value.filter(frame => selectedFrameSet.value.has(frame.id)))
const multiFrameImportCount = computed(() => Math.min(productRows.value.length, selectedFrameIds.value.length))
const isProcessingProducts = computed(() => products.value.some((p: any) => p.status === 'processing'))
const isImageQueueLocked = computed(() => isImageQueueRunning.value)
const canUseMultiFrame = computed(() => availableFrames.value.length > 0)

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

    try {
        const compressed = await compressImageInBrowser(file).catch(() => file)
        const uploadBlob = compressed instanceof Blob ? compressed : file
        const contentType = String((uploadBlob as any)?.type || file.type || 'image/png')
        const uploadFilenameBase = sanitizeFilenameBase(product?.name || file.name || 'produto')
        const uploadFilenameExt = contentType.includes('webp') ? 'webp' : (contentType.split('/')[1] || 'png')
        const uploadFilename = `${uploadFilenameBase}.${uploadFilenameExt}`
        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false
        const remoteDisabled = isManualUploadRemoteTemporarilyDisabled()
        const applyLocalFallback = async () => {
            const localDataUrl = await createLocalImageFallbackUrl(uploadBlob, file)
            if (localDataUrl) {
                product.imageUrl = localDataUrl
            } else {
                shouldRevokeLocalPreview = false
                product.imageUrl = localPreview
            }
            product.status = 'done'
            markManualImageSelection(product, 'Imagem aplicada manualmente em modo fallback')
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
        const headers = await getApiAuthHeaders()
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

const handleImageUpload = async (event: Event, index: number) => {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    if (!files.length) return
    input.value = ''

    // Se selecionar múltiplas imagens, aplica em sequência a partir do produto clicado:
    // imagem[0] -> produto[index], imagem[1] -> produto[index+1], etc.
    for (let i = 0; i < files.length; i++) {
        const targetIndex = index + i
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
        width="1160px"
    >
        <div class="flex flex-col gap-4 min-h-[640px] max-h-[82vh]">
            
            <!-- STEP 1: INPUT -->
            <div v-if="step === 'input'" class="flex flex-col gap-4 flex-1">
                <div
                    v-if="appendBaseProducts"
                    class="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between gap-3 text-emerald-200 text-xs"
                >
                    <p>
                        Adicionando itens na revisão atual ({{ appendBaseProducts.length }} existentes).
                    </p>
                    <Button variant="ghost" size="sm" @click="backToReviewWithoutAppending">
                        Voltar para revisão
                    </Button>
                </div>

                <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3 text-blue-200 text-xs">
                    <Sparkles class="w-5 h-5 shrink-0" />
                    <p>Cole sua lista de produtos ou envie um arquivo (CSV/Excel/PDF/imagem). A IA identifica preços unitário/atacado e busca imagens automaticamente.</p>
                </div>

                <!-- File Upload / Drop -->
                <div
                    class="border border-dashed border-zinc-700 rounded-lg p-4 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors"
                    @dragover.prevent
                    @drop.prevent="handleDropFile"
                >
                    <input
                        ref="listFileInput"
                        type="file"
                        class="hidden"
                        :accept="LIST_FILE_ACCEPT"
                        @change="handleFileSelected"
                    />
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-zinc-200">Importar por arquivo</div>
                            <div class="text-[10px] text-zinc-500 truncate">Arraste e solte aqui ou clique em “Escolher arquivo”</div>
                        </div>
                        <Button variant="ghost" size="sm" class="shrink-0" @click="triggerFilePicker" :disabled="isParsing">
                            <Upload class="w-3.5 h-3.5 mr-2" />
                            Escolher arquivo
                        </Button>
                    </div>
                    <div class="mt-2 text-[10px] text-zinc-500">Suporta: imagem, CSV, Excel, PDF, TXT</div>
                </div>

                <textarea 
                    v-model="textInput"
                    placeholder="Ex: Arroz Tio João 5kg R$ 29,90, Feijão Camil 1kg 8,90..."
                    class="flex-1 w-full bg-zinc-800 border-zinc-700 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                ></textarea>

                <div class="flex justify-end pt-2">
                    <Button @click="handleParse" :disabled="isParsing || !textInput.trim()">
                        <template v-if="isParsing">
                            <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                            Analisando...
                        </template>
                        <template v-else>
                            Processar Lista
                        </template>
                    </Button>
                </div>

                <p v-if="parsingError" class="text-red-400 text-xs">{{ parsingError }}</p>
            </div>

            <!-- STEP 2: REVIEW -->
            <div
                v-else
                ref="reviewContainerRef"
                tabindex="0"
                class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1"
                @keydown="onReviewKeydown"
            >
                <!-- Review Header / Controls -->
                <div class="shrink-0 p-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(10,10,12,0.96))] shadow-[0_16px_44px_rgba(0,0,0,0.28)] space-y-4">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
                            Revisao operacional
                        </span>
                        <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                            {{ getImageQueueModeLabel(imageMatchMode) }}
                        </span>
                        <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                            {{ imageBgPolicyLabel }}
                        </span>
                        <span class="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200/90">
                            {{ reviewOperationLabel }}
                        </span>
                    </div>
                    <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-zinc-100 truncate">Revisao dos produtos</div>
                            <div class="text-[11px] text-zinc-500">
                                Mostrando <span class="text-zinc-300 font-semibold">{{ filteredProductRows.length }}</span> de
                                <span class="text-zinc-300 font-semibold">{{ products.length }}</span>
                            </div>
                            <div class="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                Priorize itens em conflito, ajuste o essencial e importe quando a fila terminar.
                            </div>
                            <div v-if="activeReviewRow" class="text-[10px] text-zinc-500 mt-1">
                                Atalho: linha {{ activeReviewRowVisibleIndex + 1 }} • Selecionada: {{ activeReviewRow.product.name || `Produto ${activeReviewRow.index + 1}` }}
                            </div>
                            <div class="text-[10px] text-zinc-500 mt-1">
                                Atalhos: ↑/↓ navega • Enter busca • Espaço próxima ação • S busca • R reprocessa • U upload • T storage
                            </div>
                        </div>
                        <div class="w-full xl:w-96 shrink-0">
                            <Input v-model="reviewSearch" placeholder="Buscar (nome, marca, preço...)" class="h-10 text-sm" />
                        </div>
                        <Button
                            class="xl:w-auto w-full h-10"
                            variant="ghost"
                            :disabled="isSubmittingImport || !canRunImageQueue"
                            @click="toggleImageQueueProcessing"
                        >
                            <Loader2 v-if="isImageQueueRunning && !isQueuePaused" class="w-3.5 h-3.5 mr-2 animate-spin" />
                            <Play v-else-if="isImageQueueRunning && isQueuePaused" class="w-3.5 h-3.5 mr-2" />
                            <Play v-else class="w-3.5 h-3.5 mr-2" />
                            <span class="text-[11px] font-bold uppercase tracking-widest">
                                {{ imageQueueActionLabel }}
                            </span>
                        </Button>
                        <Button
                            v-if="targetMode !== 'multi-frame'"
                            class="xl:w-auto w-full h-10 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="importButtonDisabled"
                            @click="handleImport"
                        >
                            <Loader2 v-if="isProcessingProducts || isSubmittingImport" class="w-3.5 h-3.5 mr-2 animate-spin" />
                            <Check v-else class="w-3.5 h-3.5 mr-2" />
                            Importar {{ products.length }} Produtos
                        </Button>
                    </div>
                    <div class="grid gap-2 grid-cols-1 sm:grid-cols-3">
                        <div class="rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-3 text-[11px]">
                            <div class="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200/75">Prontas</div>
                            <div class="mt-1 text-lg font-semibold text-white">{{ imageStatusCounters.done }}</div>
                            <div class="text-[10px] text-emerald-100/65">itens concluidos de {{ imageStatusCounters.total }}</div>
                        </div>
                        <div class="rounded-xl border border-sky-500/15 bg-sky-500/8 p-3 text-[11px]">
                            <div class="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200/75">Pendentes</div>
                            <div class="mt-1 text-lg font-semibold text-white">{{ imageStatusCounters.pending }}</div>
                            <div class="text-[10px] text-sky-100/65">aguardando busca, pausa ou retry</div>
                        </div>
                        <div class="rounded-xl border border-amber-500/15 bg-amber-500/8 p-3 text-[11px]">
                            <div class="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-200/75">Conflito</div>
                            <div class="mt-1 text-lg font-semibold text-white">{{ imageStatusCounters.conflict }}</div>
                            <div class="text-[10px] text-amber-100/65">pedem decisao manual ou novo processamento</div>
                        </div>
                    </div>

                    <div
                        class="grid gap-3"
                        :class="props.showImportMode ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'"
                    >
                        <div v-if="props.showImportMode" class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Modo</div>
                                <div class="text-[11px] text-zinc-500">
                                    Zona tem <span class="text-zinc-300 font-semibold">{{ Math.max(0, Number(props.existingCount || 0)) }}</span> itens
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    class="h-9 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all"
                                    :class="importMode === 'replace' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    @click="importMode = 'replace'"
                                    title="Remove os produtos atuais da zona e recria a grade"
                                >
                                    Substituir
                                </button>
                                <button
                                    type="button"
                                    class="h-9 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all"
                                    :class="importMode === 'append' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    @click="importMode = 'append'"
                                    title="Adiciona ao que já existe e reorganiza a grade"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        <div class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Etiqueta</div>
                                <div class="text-[11px] text-zinc-500">Modelo aplicado aos novos cards</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <img
                                    v-if="selectedLabelTemplate?.previewDataUrl"
                                    :src="selectedLabelTemplate.previewDataUrl"
                                    alt="preview"
                                    class="w-18 h-8 object-contain rounded bg-zinc-800/60 border border-zinc-700 cursor-pointer hover:border-zinc-500 transition-colors"
                                    @click="showLabelPreview = true"
                                />
                                <select
                                    class="h-9 flex-1 bg-transparent border border-zinc-700 rounded px-2 text-xs text-zinc-200 focus:outline-none min-w-0"
                                    :value="selectedLabelTemplateId"
                                    @change="selectedLabelTemplateId = String(($event.target as HTMLSelectElement).value || '')"
                                >
                                    <option value="">(usar padrão da zona)</option>
                                    <option v-for="tpl in labelTemplateList" :key="tpl.id" :value="tpl.id">
                                        {{ tpl.name }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Destino</div>
                                <div class="text-[11px] text-zinc-500">Escolha entre zona atual e multi-frame</div>
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    class="h-9 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all"
                                    :class="targetMode === 'zone' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    @click="targetMode = 'zone'"
                                >
                                    Zona atual
                                </button>
                                <button
                                    type="button"
                                    class="h-9 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    :class="targetMode === 'multi-frame' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    :disabled="!canUseMultiFrame"
                                    @click="targetMode = 'multi-frame'"
                                >
                                    Multi-frame
                                </button>
                            </div>
                        </div>

                        <div class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tratamento de imagem</div>
                                <div class="text-[11px] text-zinc-500">Define quando remover fundo na busca automática</div>
                            </div>
                            <select
                                v-model="imageBgPolicy"
                                class="h-9 w-full bg-transparent border border-zinc-700 rounded px-2 text-xs text-zinc-200 focus:outline-none"
                                :disabled="isImageQueueLocked"
                            >
                                <option value="auto">Auto (recomendado)</option>
                                <option value="never">Nunca remover fundo</option>
                                <option value="always">Sempre remover fundo</option>
                            </select>
                            <div class="text-[10px] text-zinc-500 leading-relaxed">
                                Auto preserva qualidade e evita recortes agressivos.
                            </div>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Match de imagem</div>
                                <div class="text-[11px] text-zinc-500">{{ getImageQueueModeLabel(imageMatchMode) }} em fila</div>
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                                <button
                                    v-for="option in imageMatchModeOptions"
                                    :key="option.value"
                                    type="button"
                                    class="h-9 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                                    :class="imageMatchMode === option.value ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    :disabled="isImageQueueLocked"
                                    @click="imageMatchMode = option.value"
                                >
                                    {{ option.label }}
                                </button>
                            </div>
                            <label class="text-[10px] text-zinc-400">
                                Concorrência
                                <select
                                    v-model.number="imageConcurrency"
                                    class="mt-1 h-8 w-full bg-transparent border border-zinc-700 rounded px-2 text-xs text-zinc-200 focus:outline-none"
                                    :disabled="isImageQueueLocked"
                                >
                                    <option :value="3">3</option>
                                    <option :value="4">4</option>
                                    <option :value="5">5</option>
                                    <option :value="6">6</option>
                                    <option :value="8">8</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div v-if="showImageQueueControls" class="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Progresso de busca automática</div>
                            <div class="text-[11px] text-zinc-400">
                                {{ imageQueueProgress.status || 'Pronta' }} • {{ imageQueueProgress.done }}/{{ imageQueueProgress.total }}
                                <span v-if="imageQueueProgress.active"> • {{ imageQueueProgress.active }} em andamento</span>
                                <span v-if="imageQueueProgress.retrying"> • {{ imageQueueProgress.retrying }} retries em espera</span>
                            </div>
                        </div>
                        <div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div class="h-full bg-emerald-500 transition-all" :style="{ width: `${imageQueueProgress.percent}%` }"></div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 justify-between">
                            <div class="text-[10px] text-zinc-500">
                                Falhas: {{ imageQueueProgress.failed }}
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                class="h-7 px-2.5"
                                @click="stopImageQueue"
                                :disabled="!imageQueueState.running"
                            >
                                <RefreshCw class="w-3.5 h-3.5 mr-2" />
                                Interromper
                            </Button>
                        </div>
                        <div v-if="isImageQueueLocked" class="text-[10px] text-zinc-500 leading-relaxed">
                            Configuracoes de busca ficam travadas enquanto a fila estiver em andamento para evitar resultados inconsistentes no mesmo lote.
                        </div>
                    </div>

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
                </div>

                <div class="shrink-0 min-h-[300px] max-h-[46vh] overflow-y-auto custom-scrollbar border border-zinc-800 rounded-xl bg-zinc-900/50">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-zinc-800 text-zinc-400 sticky top-0 z-10">
                            <tr>
                                <th class="p-3 w-32">Img</th>
                                <th class="p-3">Produto</th>
                                <th class="p-3 min-w-[430px]">Preços e Regras</th>
                                <th class="p-3 w-44 text-center">Status</th>
                                <th class="p-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-zinc-800">
                            <tr
                                v-for="row in reviewRowsWithMeta"
                                :key="row.productId"
                                class="hover:bg-white/5 group align-top transition-colors"
                                :class="activeReviewRowIndex === row.index ? 'bg-zinc-900/80 ring-1 ring-violet-400/40' : ''"
                                @click="activeReviewRowIndex = row.index"
                            >
                                <!-- Image Column -->
                                <td class="p-3">
                                    <div class="w-[10.5rem] space-y-2">
                                        <div :class="[
                                            'w-[10.5rem] h-[10.5rem] rounded-xl bg-zinc-900/70 flex items-center justify-center overflow-hidden border relative',
                                            thumbnailUiStateClass(row.product)
                                        ]">
                                            <template v-if="row.product?.imageUrl">
                                                <div class="absolute inset-0 bg-zinc-700/45 animate-pulse" />
                                                <img
                                                    loading="lazy"
                                                    :src="resolveProductImageUrl(row.product.imageUrl)"
                                                    class="relative z-10 w-full h-full object-contain"
                                                    :class="row.product?.status === 'processing' ? 'opacity-30' : ''"
                                                    alt="Pré-visualização do produto"
                                                />
                                                <div v-if="row.product?.status === 'processing'" class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-black/45">
                                                    <Loader2 class="w-4 h-4 text-blue-300 animate-spin" />
                                                    <span class="text-[9px] text-zinc-200">processando</span>
                                                </div>
                                            </template>
                                            <template v-else-if="row.product?.status === 'processing'">
                                                <Loader2 class="w-4 h-4 text-blue-500 animate-spin" />
                                            </template>
                                            <template v-else>
                                                <div class="text-[10px] text-zinc-500 text-center px-2">
                                                    <AlertCircle
                                                        v-if="row.product?.status === 'review_pending' || row.product?.status === 'error'"
                                                        class="w-4 h-4 mx-auto mb-1"
                                                        :class="{
                                                            'text-amber-500': row.product?.status === 'review_pending',
                                                            'text-red-500': row.product?.status === 'error'
                                                        }"
                                                    />
                                                    {{ thumbnailStatusText(row.product) }}
                                                </div>
                                            </template>
                                        </div>

                                        <input
                                            :id="`image-upload-${row.productId}`"
                                            type="file"
                                            class="hidden"
                                            accept="image/*"
                                            multiple
                                            @change="handleImageUpload($event, row.index)"
                                        />

                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                class="h-7 px-2.5 text-[10px] rounded-md border border-sky-500/50 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 transition-colors font-semibold"
                                                :disabled="row.product?.status === 'processing'"
                                                @click.stop="runImageQuickAction(row, 'search')"
                                            >
                                                Buscar
                                            </button>

                                            <button
                                                type="button"
                                                class="h-7 px-2.5 text-[10px] rounded-md border border-zinc-700/80 bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/80 transition-colors"
                                                :disabled="row.product?.status === 'processing'"
                                                @click.stop="reprocessProductImage(row.index, true)"
                                            >
                                                Reprocessar
                                            </button>

                                            <label
                                                :for="`image-upload-${row.productId}`"
                                                class="h-7 inline-flex items-center px-2.5 text-[10px] rounded-md border border-zinc-700/80 bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/80 cursor-pointer transition-colors"
                                            >
                                                Upload
                                            </label>

                                            <button
                                                type="button"
                                                class="h-7 px-2.5 text-[10px] rounded-md border border-zinc-700/80 bg-zinc-800/70 text-zinc-100 hover:bg-zinc-700/80 transition-colors"
                                                :disabled="row.product?.status === 'processing'"
                                                @click.stop="runImageQuickAction(row, 'storage')"
                                            >
                                                Storage
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            v-if="row.imageNextAction"
                                            class="w-full h-7 px-2.5 text-[10px] rounded-md border border-amber-700/70 bg-amber-800/40 text-amber-100 hover:bg-amber-700/60 transition-colors text-left"
                                            @click.stop="runImageNextAction(row)"
                                            :disabled="row.product?.status === 'processing'"
                                        >
                                            {{ row.imageNextAction?.label || 'Próxima ação' }}
                                        </button>
                                    </div>
                                </td>

                                <!-- Name Inputs -->
                                <td class="p-3 align-middle">
                                    <input
                                        v-model="row.product.name"
                                        class="w-full bg-transparent border-none text-white focus:ring-0 p-0 text-sm font-semibold placeholder-zinc-600"
                                        placeholder="Nome do Produto"
                                    />
                                    <input
                                        v-model="row.product.brand"
                                        class="w-full bg-transparent border-none text-zinc-500 focus:ring-0 p-0 text-xs mt-1"
                                        placeholder="Marca (opcional)"
                                    />
                                    <input
                                        v-model="row.product.productCode"
                                        class="w-full bg-transparent border-none text-zinc-500 focus:ring-0 p-0 text-xs mt-1"
                                        placeholder="EAN/Código (opcional)"
                                    />
                                    <input
                                        v-model="row.product.weight"
                                        class="w-full bg-transparent border-none text-zinc-500 focus:ring-0 p-0 text-xs mt-1"
                                        placeholder="Peso (ex: 500G, 1L)"
                                    />
                                    <div
                                        v-if="
                                            row.product?.status === 'review_pending' &&
                                            !row.imageNextAction
                                        "
                                        class="text-[10px] text-amber-400 mt-1"
                                    >
                                        Revisão pendente:
                                        {{ row.product.imageDecisionReason || row.product.error || 'Baixa confiança no match automático.' }}
                                    </div>
                                </td>

                                <!-- Price Inputs -->
                                <td class="p-3">
                                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                                        <div class="rounded-md border border-zinc-800 bg-zinc-950/45 p-2 space-y-1.5">
                                            <div class="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Preço base</div>
                                            <div class="grid grid-cols-2 gap-2">
                                                <label class="text-[10px] text-zinc-500 uppercase">
                                                    Und
                                                    <input
                                                        v-model="row.product.priceUnit"
                                                        class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                                <label class="text-[10px] text-zinc-500 uppercase">
                                                    Emb
                                                    <input
                                                        v-model="row.product.pricePack"
                                                        class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div class="rounded-md border border-emerald-900/40 bg-emerald-950/15 p-2 space-y-1.5">
                                            <div class="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Preço especial</div>
                                            <div class="grid grid-cols-2 gap-2">
                                                <label class="text-[10px] text-emerald-400 uppercase">
                                                    +Esp
                                                    <input
                                                        v-model="row.product.priceSpecialUnit"
                                                        class="mt-1 w-full bg-transparent border border-emerald-900/50 rounded px-2 py-1 text-emerald-300 text-xs focus:outline-none focus:border-emerald-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                                <label class="text-[10px] text-emerald-400 uppercase">
                                                    Esp
                                                    <input
                                                        v-model="row.product.priceSpecial"
                                                        class="mt-1 w-full bg-transparent border border-emerald-900/50 rounded px-2 py-1 text-emerald-300 text-xs focus:outline-none focus:border-emerald-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-2 grid grid-cols-3 gap-2">
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            Emb
                                            <input
                                                :value="row.product.packageLabel ?? ''"
                                                @input="e => row.product.packageLabel = String((e.target as any).value || '').toUpperCase()"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="FD"
                                            />
                                        </label>
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            C/
                                            <input
                                                type="number"
                                                :value="row.product.packQuantity ?? ''"
                                                @input="e => { const v = Number((e.target as any).value); row.product.packQuantity = Number.isFinite(v) && v > 0 ? v : null }"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="12"
                                            />
                                        </label>
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            Un
                                            <input
                                                :value="row.product.packUnit ?? ''"
                                                @input="e => row.product.packUnit = String((e.target as any).value || '').toUpperCase()"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="UN"
                                            />
                                        </label>
                                    </div>

                                        <div class="mt-2">
                                            <label class="text-[10px] text-zinc-500 uppercase">
                                                Condição
                                                <input
                                                    :value="row.product.specialCondition ?? ''"
                                                    @input="e => row.product.specialCondition = String((e.target as any).value || '')"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="ACIMA DE 36 UN."
                                                />
                                            </label>
                                        </div>

                                    <div class="mt-2 flex justify-end">
                                        <button
                                            type="button"
                                            class="text-[10px] text-zinc-500 hover:text-zinc-300"
                                            @click="toggleAdvancedFields(row.productId)"
                                        >
                                            {{ isAdvancedFieldsExpanded(row.productId) ? 'Ocultar campos avançados' : 'Mostrar campos avançados' }}
                                        </button>
                                    </div>

                                    <details class="mt-1" :open="isAdvancedFieldsExpanded(row.productId)">
                                        <summary class="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300">Campos avançados</summary>
                                        <div class="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2 text-[10px] text-zinc-600">
                                            <label class="uppercase">
                                                Preço
                                                <input
                                                    :value="row.product.price ?? ''"
                                                    @input="e => row.product.price = String((e.target as any).value || '')"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="0,00"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                R$ Atacado
                                                <input
                                                    :value="row.product.priceWholesale ?? ''"
                                                    @input="e => row.product.priceWholesale = String((e.target as any).value || '')"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="0,00"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                Trigger
                                                <input
                                                    type="number"
                                                    :value="row.product.wholesaleTrigger ?? ''"
                                                    @input="e => { const v = Number((e.target as any).value); row.product.wholesaleTrigger = Number.isFinite(v) && v > 0 ? v : null }"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="10"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                Unidade Trigger
                                                <input
                                                    :value="row.product.wholesaleTriggerUnit ?? ''"
                                                    @input="e => row.product.wholesaleTriggerUnit = String((e.target as any).value || '').toUpperCase()"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="FD"
                                                />
                                            </label>
                                        </div>
                                    </details>
                                </td>
                                
                                <!-- Status -->
                                        <td class="p-3 text-center align-top">
                                    <div
                                        class="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium uppercase"
                                        :class="row.imageStatusMeta.toneClass"
                                    >
                                        {{ row.imageStatusMeta.state }}
                                    </div>
                                    <div class="mt-1 flex items-center justify-center flex-wrap gap-1 text-[9px]">
                                        <span :class="['inline-flex items-center rounded-full px-2 py-0.5 border font-medium uppercase tracking-wide', row.imageStatusMeta.toneClass]">
                                            Conf: {{ row.imageStatusMeta.confidence }}
                                        </span>
                                        <span class="inline-flex items-center rounded-full px-2 py-0.5 border border-zinc-700 text-zinc-300 bg-zinc-800">
                                            {{ row.imageStatusMeta.source }}
                                        </span>
                                        <span class="inline-flex items-center rounded-full px-2 py-0.5 border border-zinc-700 text-zinc-400 bg-zinc-900">
                                            {{ row.imageStatusMeta.providerLabel }}
                                        </span>
                                    </div>
                                    <div v-if="row.imageNextAction" class="mt-2 rounded border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-left">
                                        <div class="text-[9px] uppercase tracking-wider text-yellow-200/80 font-semibold">Próximo passo</div>
                                        <div class="text-[9px] text-yellow-300/90 leading-snug">
                                            {{ row.imageNextAction?.helper }}
                                        </div>
                                        <button
                                            type="button"
                                            class="mt-1 inline-flex items-center rounded px-2 py-1 text-[9px] font-semibold bg-yellow-500/20 text-yellow-100 hover:bg-yellow-500/30 transition-colors"
                                            @click="runImageNextAction(row)"
                                        >
                                            {{ row.imageNextAction?.label }}
                                        </button>
                                    </div>
                                    <div
                                        v-if="row.product?.imageReviewReason && !row.imageNextAction"
                                        class="mt-1 text-[9px] text-zinc-500 leading-snug"
                                    >
                                        {{ row.product.imageReviewReason }}
                                    </div>
                                </td>

                                <!-- Actions -->
                                <td class="p-3 text-right align-top">
                                    <button @click="removeProduct(row.index)" class="text-zinc-500 hover:text-red-400 p-1">
                                        <X class="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="!filteredProductRowsPage.length" :key="`empty-review-row`" class="text-zinc-500">
                                <td colspan="5" class="p-6 text-center text-[10px]">
                                    Nenhum produto encontrado para "{{ reviewSearch }}".
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="shrink-0 flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-white/5">
                    <button @click="startAppendFromReview" class="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                         <Plus class="w-3 h-3" /> Adicionar via lista/arquivo
                    </button>

                    <div class="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span>Página {{ reviewPage }} de {{ reviewPageCount }}</span>
                        <span>•</span>
                        <span>Exibindo {{ filteredProductRowsPage.length }} de {{ filteredProductRows.length }} itens</span>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" @click="gotoReviewPage(reviewPage - 1)" :disabled="reviewPage <= 1">
                            <ChevronDown class="w-3.5 h-3.5 mr-2 rotate-90" />
                            Anterior
                        </Button>
                        <Button variant="ghost" size="sm" @click="gotoReviewPage(reviewPage + 1)" :disabled="reviewPage >= reviewPageCount">
                            <ChevronDown class="w-3.5 h-3.5 mr-2 -rotate-90" />
                            Próximo
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            @click="startImageProcessing(true)"
                            :disabled="isImageQueueRunning || isSubmittingImport"
                        >
                            <RefreshCw class="w-3.5 h-3.5 mr-2" />
                            Forçar reprocessar imagens
                        </Button>
                        <Button
                            v-if="targetMode !== 'multi-frame'"
                            size="sm"
                            @click="handleImport"
                            class="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="importButtonDisabled"
                        >
                            <Loader2 v-if="isProcessingProducts || isSubmittingImport" class="w-3.5 h-3.5 mr-2 animate-spin" />
                            <Check v-else class="w-3.5 h-3.5 mr-2" />
                            Importar {{ products.length }} Produtos
                        </Button>
                    </div>
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
