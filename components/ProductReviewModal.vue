<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { Sparkles, X, Check, AlertCircle, Loader2, Search, Upload, FolderOpen } from 'lucide-vue-next'
import { useProductProcessor, type SmartProduct } from '../composables/useProductProcessor'
import type { LabelTemplate } from '~/types/label-template'

type ImportTargetMode = 'zone' | 'multi-frame'
type ImageBgPolicy = 'auto' | 'never' | 'always'
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

const textInput = ref('')
const step = ref<'input' | 'review'>('input')
const listFileInput = ref<HTMLInputElement | null>(null)
const importMode = ref<'replace' | 'append'>('replace')
const targetMode = ref<ImportTargetMode>('zone')
const selectedFrameIds = ref<string[]>([])
const frameAssignmentsMap = ref<Record<string, string | null>>({})
// Importacao inteligente: por padrao, queremos remover o fundo das imagens encontradas.
const imageBgPolicy = ref<ImageBgPolicy>('always')

const LIST_FILE_ACCEPT = 'image/*,.csv,.tsv,.xlsx,.xls,.pdf,text/plain'

// Composable
const { 
    products, 
    isParsing, 
    parsingError, 
    parseText, 
    parseFile,
    processProductImage, 
    processAllImages, 
    removeProduct 
} = useProductProcessor()

const resolveProductIndex = (p: any) => {
    const id = p?.id
    if (id === null || id === undefined) return -1
    return (products.value || []).findIndex((x: any) => x?.id === id)
}

// Watcher to reset state when opening
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        importMode.value = 'replace'
        targetMode.value = 'zone'
        selectedFrameIds.value = []
        frameAssignmentsMap.value = {}
        imageBgPolicy.value = 'always'
        if (props.initialProducts && props.initialProducts.length > 0) {
            // Load external products directly into review mode
            products.value = props.initialProducts.map((p: any) => ({
                ...p,
                imageUrl: resolveProductImageUrl(p?.imageUrl || '')
            }))
            step.value = 'review'
        } else if (products.value.length === 0) {
            step.value = 'input'
            textInput.value = ''
        }
    }
})

const handleParse = async () => {
    if (!textInput.value.trim()) return;
    
    await parseText(textInput.value);
    
    if (products.value.length > 0) {
        step.value = 'review';
        // Process all images automatically
        await processAllImages({ bgPolicy: imageBgPolicy.value });
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

    await parseFile(file)

    if (products.value.length > 0) {
        step.value = 'review'
        await processAllImages({ bgPolicy: imageBgPolicy.value })
    }
}

const handleDropFile = async (event: DragEvent) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    await parseFile(file)
    if (products.value.length > 0) {
        step.value = 'review'
        await processAllImages({ bgPolicy: imageBgPolicy.value })
    }
}

const handleImport = () => {
    const opts: ProductImportOptions = {
        mode: importMode.value,
        labelTemplateId: selectedLabelTemplateId.value || undefined,
        targetMode: targetMode.value
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
const showLabelPreview = ref(false)
const MIN_ASSET_SEARCH_CHARS = 1

const reviewSearch = ref('')
const selectedLabelTemplateId = ref<string>('')
const runtimeConfig = useRuntimeConfig()

const resolveProductImageUrl = (rawUrl: any): string => {
    const value = String(rawUrl || '').trim()
    if (!value) return ''
    if (value.startsWith('blob:') || value.startsWith('data:')) return value
    if (value.startsWith('/api/storage/proxy?') || value.startsWith('/api/storage/p?')) return value

    if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
            const urlObj = new URL(value)
            if (
                urlObj.pathname.endsWith('/api/storage/proxy') ||
                urlObj.pathname.endsWith('/api/storage/p') ||
                urlObj.pathname.endsWith('/proxy') ||
                urlObj.pathname.endsWith('/p')
            ) {
                const key = urlObj.searchParams.get('key')
                if (key) {
                    const params = new URLSearchParams()
                    params.set('key', key)
                    const bucket = urlObj.searchParams.get('bucket')
                    if (bucket) params.set('bucket', bucket)
                    const version = urlObj.searchParams.get('v')
                    if (version) params.set('v', version)
                    return `/api/storage/p?${params.toString()}`
                }
            }
            const endpoint = String(runtimeConfig.public?.wasabiEndpoint || runtimeConfig.wasabiEndpoint || '').trim().toLowerCase()
            const bucket = String(runtimeConfig.public?.wasabiBucket || runtimeConfig.wasabiBucket || '').trim()
            const pathParts = decodeURIComponent(urlObj.pathname || '').split('/').filter(Boolean)
            if (endpoint && urlObj.host.toLowerCase().includes(endpoint) && bucket) {
                if (pathParts[0] === bucket && pathParts.length > 1) {
                    return `/api/storage/p?key=${encodeURIComponent(pathParts.slice(1).join('/'))}`
                }
                if (urlObj.host.startsWith(`${bucket}.`) && pathParts.length > 0) {
                    return `/api/storage/p?key=${encodeURIComponent(pathParts.join('/'))}`
                }
            }
        } catch {
            // keep original URL
        }
        return value
    }

    if (value.startsWith('/')) return value
    return `/api/storage/p?key=${encodeURIComponent(value)}`
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
        $fetch('/api/storage/presigned', {
            method: 'POST',
            headers,
            body: { key, contentType, operation: 'put' },
            signal: signal as any
        }) as Promise<any>
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

    return {
        url: `/api/storage/p?key=${encodeURIComponent(key)}`,
        publicUrl: '',
        key,
        source: 'manual-presigned'
    }
}

watch(
    () => props.modelValue,
    (open) => {
        if (!open) return
        selectedLabelTemplateId.value = String(props.initialLabelTemplateId || '')
        reviewSearch.value = ''
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
    if (isProcessingProducts.value) return true
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

const filteredAssets = computed(() => {
    return assets.value
})

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
        const data = await $fetch('/api/assets', {
            headers,
            query: {
                q: query,
                limit: 120,
                productName: String(product?.name || ''),
                brand: String(product?.brand || ''),
                flavor: String(product?.flavor || ''),
                weight: String(product?.weight || '')
            }
        })
        if (data && Array.isArray(data)) {
            assets.value = data
        } else {
            assets.value = []
        }
    } catch (error) {
        console.error('Falha ao buscar assets:', error)
        assets.value = []
    } finally {
        isLoadingAssets.value = false
    }
}

const openAssetPicker = (index: number) => {
    selectedProductIndex.value = index
    assets.value = []
    const product = products.value[index]
    assetSearch.value = buildCacheSearchTerm(product)
    showAssetPicker.value = true
}

watch(showAssetPicker, (open) => {
    if (open) return
    selectedProductIndex.value = null
    assets.value = []
    assetSearch.value = ''
})

const handleAssetSelect = async (asset: any) => {
    if (selectedProductIndex.value === null) return
    const product = products.value[selectedProductIndex.value]
    if (!product) return
    product.imageUrl = resolveProductImageUrl(asset.url)
    product.status = 'done'
    product.error = undefined
    showAssetPicker.value = false
    selectedProductIndex.value = null

    // Salvar no cache do banco para próximas buscas
    try {
        const searchTerm = buildCacheSearchTerm(product)
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
                imageUrl: resolveProductImageUrl(asset.url),
                s3Key: asset.key || asset.id || null,
                source: 'storage'
            }
        })
    } catch (err) {
        // Cache é opcional, não bloquear
        console.warn('[Cache] Falha ao salvar asset no cache:', err)
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
            }
            return fd
        }

        let result: any = null
        try {
            result = await withRequestTimeout(MANUAL_UPLOAD_API_TIMEOUT_MS, (signal) =>
                $fetch('/api/upload-product-image', {
                    method: 'POST',
                    headers,
                    body: createUploadForm(true),
                    signal: signal as any
                }) as Promise<any>
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
                    $fetch('/api/upload', {
                        method: 'POST',
                        headers,
                        body: createUploadForm(false),
                        signal: signal as any
                    }) as Promise<any>
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
                    await $fetch('/api/cache-product-image', {
                        method: 'POST',
                        headers,
                        body: {
                            searchTerm,
                            productName: product.name || 'Produto',
                            brand: product.brand || null,
                            flavor: product.flavor || null,
                            weight: product.weight || null,
                            imageUrl: result.publicUrl || result.url,
                            s3Key: result.key || null,
                            source: result?.source || 'manual-fallback'
                        }
                    })
                } catch (cacheErr) {
                    console.warn('[Upload Manual] Falha ao salvar fallback no cache:', cacheErr)
                }
            }
        }

        if (result?.url) {
            product.imageUrl = resolveProductImageUrl(result.url)
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

const getStatusColor = (status: string) => {
    switch(status) {
        case 'done': return 'text-green-500';
        case 'processing': return 'text-blue-500';
        case 'error': return 'text-red-500';
        default: return 'text-zinc-500';
    }
}

const filteredProducts = computed(() => {
    const list = products.value || []
    const q = normalizeText(String(reviewSearch.value || '').trim())
    if (!q) return list
    return list.filter((p: any) => {
        const hay = normalizeText(`${p?.name || ''} ${p?.brand || ''} ${p?.price || ''} ${p?.pricePack || ''} ${p?.priceUnit || ''} ${p?.priceSpecial || ''} ${p?.priceSpecialUnit || ''} ${p?.specialCondition || ''} ${p?.priceWholesale || ''}`)
        return hay.includes(q)
    })
})

const selectedProductForAssetPicker = computed(() => {
    const idx = Number(selectedProductIndex.value)
    if (!Number.isInteger(idx) || idx < 0) return null
    return products.value[idx] || null
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
            <div v-else class="flex flex-col gap-4 flex-1 h-full overflow-hidden">
                <!-- Review Header / Controls -->
                <div class="p-4 rounded-xl border border-white/10 bg-zinc-900/45 space-y-4">
                    <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-zinc-100 truncate">Revisão dos produtos</div>
                            <div class="text-[11px] text-zinc-500">
                                Mostrando <span class="text-zinc-300 font-semibold">{{ filteredProducts.length }}</span> de
                                <span class="text-zinc-300 font-semibold">{{ products.length }}</span>
                            </div>
                        </div>
                        <div class="w-full xl:w-96 shrink-0">
                            <Input v-model="reviewSearch" placeholder="Buscar (nome, marca, preço...)" class="h-10 text-sm" />
                        </div>
                    </div>

                    <div
                        class="grid gap-3"
                        :class="props.showImportMode ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1 xl:grid-cols-3'"
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
                                :disabled="isProcessingProducts"
                            >
                                <option value="auto">Auto (recomendado)</option>
                                <option value="never">Nunca remover fundo</option>
                                <option value="always">Sempre remover fundo</option>
                            </select>
                            <div class="text-[10px] text-zinc-500 leading-relaxed">
                                Auto preserva qualidade e evita recortes agressivos.
                            </div>
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
                    </div>
                </div>

                <div class="overflow-y-auto custom-scrollbar flex-1 border border-zinc-800 rounded-xl bg-zinc-900/50">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-zinc-800 text-zinc-400 sticky top-0 z-10">
                            <tr>
                                <th class="p-3 w-32">Img</th>
                                <th class="p-3">Produto</th>
                                <th class="p-3 min-w-[430px]">Preços e Regras</th>
                                <th class="p-3 w-24 text-center">Status</th>
                                <th class="p-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-zinc-800">
                            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-white/5 group align-top">
                                <!-- Image Column -->
                                <td class="p-3">
                                    <div class="w-26 h-26 rounded-lg bg-zinc-800/80 flex items-center justify-center overflow-hidden border border-zinc-700 relative">
                                        <img v-if="product.imageUrl" :src="resolveProductImageUrl(product.imageUrl)" class="w-full h-full object-contain" />
                                        <Loader2 v-else-if="product.status === 'processing'" class="w-4 h-4 text-blue-500 animate-spin" />
                                        <AlertCircle v-else-if="product.status === 'error'" class="w-4 h-4 text-red-500" />
                                        <div v-else class="text-zinc-600 font-xs">?</div>
                                        <input
                                            :id="`image-upload-${product.id}`"
                                            type="file"
                                            class="hidden"
                                            accept="image/*"
                                            multiple
                                            @change="handleImageUpload($event, resolveProductIndex(product))"
                                        />

                                        <div class="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <button
                                                class="bg-black/60 text-white rounded p-1"
                                                title="Selecionar do Storage"
                                                @click.stop="openAssetPicker(resolveProductIndex(product))"
                                            >
                                                <FolderOpen class="w-3 h-3" />
                                            </button>
                                        </div>
                                        
                                        <!-- Hover Action to Retry -->
                                        <div 
                                            v-if="!product.imageUrl && product.status !== 'processing'" 
                                            class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer z-10"
                                            @click="processProductImage(resolveProductIndex(product), { bgPolicy: imageBgPolicy })"
                                            title="Buscar Imagem"
                                        >
                                            <Search class="w-3 h-3 text-white" />
                                        </div>
                                        <label
                                            :for="`image-upload-${product.id}`"
                                            class="absolute top-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                                            title="Enviar Imagem"
                                        >
                                            <Upload class="w-3 h-3" />
                                        </label>
                                    </div>
                                </td>
                                
                                <!-- Name Input -->
                                <td class="p-3 align-middle">
                                    <input 
                                        v-model="product.name" 
                                        class="w-full bg-transparent border-none text-white focus:ring-0 p-0 text-sm font-semibold placeholder-zinc-600"
                                        placeholder="Nome do Produto"
                                    />
                                    <input 
                                        v-model="product.brand" 
                                        class="w-full bg-transparent border-none text-zinc-500 focus:ring-0 p-0 text-xs mt-1"
                                        placeholder="Marca (opcional)"
                                    />
                                </td>

                                <!-- Price Input -->
                                <td class="p-3">
                                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                                        <div class="rounded-md border border-zinc-800 bg-zinc-950/45 p-2 space-y-1.5">
                                            <div class="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Preço Base</div>
                                            <div class="grid grid-cols-2 gap-2">
                                                <label class="text-[10px] text-zinc-500 uppercase">
                                                    Und
                                                    <input
                                                        v-model="product.priceUnit"
                                                        class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                                <label class="text-[10px] text-zinc-500 uppercase">
                                                    Emb
                                                    <input
                                                        v-model="product.pricePack"
                                                        class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div class="rounded-md border border-emerald-900/40 bg-emerald-950/15 p-2 space-y-1.5">
                                            <div class="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Preço Especial</div>
                                            <div class="grid grid-cols-2 gap-2">
                                                <label class="text-[10px] text-emerald-400 uppercase">
                                                    +Esp
                                                    <input
                                                        v-model="product.priceSpecialUnit"
                                                        class="mt-1 w-full bg-transparent border border-emerald-900/50 rounded px-2 py-1 text-emerald-300 text-xs focus:outline-none focus:border-emerald-500"
                                                        placeholder="0,00"
                                                    />
                                                </label>
                                                <label class="text-[10px] text-emerald-400 uppercase">
                                                    Esp
                                                    <input
                                                        v-model="product.priceSpecial"
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
                                                :value="product.packageLabel ?? ''"
                                                @input="e => product.packageLabel = String((e.target as any).value || '').toUpperCase()"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="FD"
                                            />
                                        </label>
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            C/
                                            <input
                                                type="number"
                                                :value="product.packQuantity ?? ''"
                                                @input="e => { const v = Number((e.target as any).value); product.packQuantity = Number.isFinite(v) && v > 0 ? v : null }"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="12"
                                            />
                                        </label>
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            Un
                                            <input
                                                :value="product.packUnit ?? ''"
                                                @input="e => product.packUnit = String((e.target as any).value || '').toUpperCase()"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="UN"
                                            />
                                        </label>
                                    </div>

                                    <div class="mt-2">
                                        <label class="text-[10px] text-zinc-500 uppercase">
                                            Condição
                                            <input
                                                :value="product.specialCondition ?? ''"
                                                @input="e => product.specialCondition = String((e.target as any).value || '')"
                                                class="mt-1 w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
                                                placeholder="ACIMA DE 36 UN."
                                            />
                                        </label>
                                    </div>

                                    <!-- ===== PREÇO LEGADO (opcional, colapsado) ===== -->
                                    <details class="mt-2">
                                        <summary class="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">Legado</summary>
                                        <div class="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2 text-[10px] text-zinc-600">
                                            <label class="uppercase">
                                                Preço
                                                <input
                                                    :value="product.price ?? ''"
                                                    @input="e => product.price = String((e.target as any).value || '')"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="0,00"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                R$ Atacado
                                                <input
                                                    :value="product.priceWholesale ?? ''"
                                                    @input="e => product.priceWholesale = String((e.target as any).value || '')"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="0,00"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                Trigger
                                                <input
                                                    type="number"
                                                    :value="product.wholesaleTrigger ?? ''"
                                                    @input="e => { const v = Number((e.target as any).value); product.wholesaleTrigger = Number.isFinite(v) && v > 0 ? v : null }"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="10"
                                                />
                                            </label>
                                            <label class="uppercase">
                                                Unidade Trigger
                                                <input
                                                    :value="product.wholesaleTriggerUnit ?? ''"
                                                    @input="e => product.wholesaleTriggerUnit = String((e.target as any).value || '').toUpperCase()"
                                                    class="mt-1 w-full bg-transparent border border-zinc-800/50 rounded px-2 py-1 text-zinc-500 focus:outline-none"
                                                    placeholder="FD"
                                                />
                                            </label>
                                        </div>
                                    </details>
                                </td>
                                
                                <!-- Status -->
                                <td class="p-3 text-center align-middle">
                                    <span :class="['text-[10px] font-medium uppercase', getStatusColor(product.status)]">
                                        {{ product.status }}
                                    </span>
                                </td>

                                <!-- Actions -->
                                <td class="p-3 text-right align-middle">
                                    <button @click="removeProduct(resolveProductIndex(product))" class="text-zinc-500 hover:text-red-400 p-1">
                                        <X class="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-white/5">
                    <button @click="step = 'input'" class="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                         <X class="w-3 h-3" /> Voltar
                    </button>
                    <div class="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" @click="processAllImages({ bgPolicy: imageBgPolicy })">
                            <Search class="w-3.5 h-3.5 mr-2" />
                            Reprocessar Imagens
                        </Button>
                        <Button 
                            size="sm" 
                            @click="handleImport" 
                            class="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="importButtonDisabled"
                        >
                            <Loader2 v-if="isProcessingProducts" class="w-3.5 h-3.5 mr-2 animate-spin" />
                            <Check v-else class="w-3.5 h-3.5 mr-2" />
                            Importar {{ targetMode === 'multi-frame' ? multiFrameImportCount : products.length }} Produtos
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    </Dialog>

    <Dialog v-model="showAssetPicker" title="Selecionar imagem" width="720px">
        <div class="flex flex-col gap-3">
            <div v-if="selectedProductForAssetPicker" class="text-xs text-zinc-400">
                Produto: <span class="text-zinc-200 font-medium">{{ selectedProductForAssetPicker.name }}</span>
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

            <div class="max-h-90 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg bg-zinc-900/50 p-3">
                <div v-if="isLoadingAssets" class="text-xs text-zinc-500">Carregando imagens...</div>
                <div v-else-if="assetSearch.trim().length < MIN_ASSET_SEARCH_CHARS" class="text-xs text-zinc-500">
                    Digite ao menos {{ MIN_ASSET_SEARCH_CHARS }} caracteres e clique em buscar.
                </div>
                <div v-else-if="!filteredAssets.length" class="text-xs text-zinc-500">Nenhuma imagem encontrada.</div>
                <div v-else class="grid grid-cols-3 gap-2">
                    <button
                        v-for="asset in filteredAssets"
                        :key="asset.id"
                        class="bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 hover:border-zinc-500 transition-all text-left"
                        @click="handleAssetSelect(asset)"
                    >
                        <div class="aspect-square">
                            <img :src="asset.url" crossorigin="anonymous" class="w-full h-full object-cover" />
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
