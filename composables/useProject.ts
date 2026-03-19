import { reactive, ref, computed, watch } from 'vue'
import { computeCanvasFingerprint } from '~/utils/editorCanvasState'
import { normalizeCanvasAssetUrls } from '~/utils/canvasAssetUrls'

export interface Page {
    id: string;
    name: string;
    width: number;
    height: number;
    type: 'RETAIL_OFFER' | 'FREE_DESIGN';
    canvasData: any; // JSON do FabricJS (em memória apenas)
    canvasDataPath?: string; // Caminho no Storage (salvo no banco)
    thumbnail?: string; // DataURL da miniatura (em memória)
    thumbnailUrl?: string; // URL pública no Storage
    thumbnailDirty?: boolean;
    lastSerializedCanvasJson?: string;
    lastSerializedCanvasBytes?: number;
    lastSerializedCanvasSavedAt?: number;
    lastLoadedFingerprint?: string;
    lastSavedFingerprint?: string;
    lastPersistedObjectCount?: number;
    dirty?: boolean;
}

export interface Project {
    id: string;
    name: string;
    pages: Page[];
    activePageIndex: number;
    canvasStorageEnabled?: boolean; // Flag para usar Storage
    colorStyles?: any[]; // Color styles for the project
}

// Estado Global (Singleton)
const project = reactive<Project>({
    id: 'proj_default',
    name: 'Novo Encarte',
    pages: [],
    activePageIndex: 0,
    canvasStorageEnabled: true
})

const isSaving = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveLastError = ref<string | null>(null) // Mensagem da última falha de save
const saveDebugStage = ref('idle')
const localDraftQuotaWarning = ref(false) // true quando localStorage está cheio
const lastSavedAt = ref<Date | null>(null)
const hasUnsavedChanges = ref(false)
const isProjectLoaded = ref(false) // Flag para indicar quando o projeto foi carregado do banco
const unsavedRevision = ref(0)
const queuedSaveAfterCurrent = ref(false)
const SAVE_WATCHDOG_MS = 120_000
// Soft timeout para upload do canvas.
// Worst case por tentativa: presigned (6s+12s) + proxy (35s) ~= 53s.
// Com CORS bloqueado, usamos 1 tentativa de proxy; nos demais casos deixamos
// margem para uma nova tentativa curta sem abortar prematuramente um upload saudável.
const CANVAS_UPLOAD_SOFT_TIMEOUT_MS = 120_000
const THUMBNAIL_UPLOAD_SOFT_TIMEOUT_MS = 12_000
let lastSaveChangedDuringRunLogAt = 0
// Exponential backoff counter for unsynced page retries.
// Reset to 0 when all pages sync successfully.
let _unsyncedRetryCount = 0

// HMR: flag que impede instâncias antigas de continuar salvando após o módulo ser substituído.
// Todos os timers são rastreados em _pendingSaveTimers para cancelamento no dispose.
let _moduleDisposed = false
const _pendingSaveTimers = new Set<ReturnType<typeof setTimeout>>()
// Timestamp da última edição do usuário. Usado pelo retry para evitar mostrar
// "Salvando..." enquanto o usuário está editando ativamente.
let _lastUserEditAt = 0

const createRealtimeClientId = (): string => {
    if (import.meta.server) return 'server'
    try {
        const fromCrypto = (globalThis as any)?.crypto?.randomUUID?.()
        if (fromCrypto) return String(fromCrypto)
    } catch {
        // ignore
    }
    return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
const realtimeClientId = ref<string>(createRealtimeClientId())

// -----------------------------------------------------------------------------
// Local draft persistence (offline-safe)
// When network/storage save fails (ERR_INTERNET_DISCONNECTED), we still want the
// editor state to survive reloads. We store the latest canvas JSON per page in
// localStorage and restore it on load.
// -----------------------------------------------------------------------------
const DRAFT_KEY_PREFIX = 'jobvarejo:draft:page:'
const getDraftKey = (projectId: string, pageId: string) => `${DRAFT_KEY_PREFIX}${projectId}:${pageId}`
type DraftPayload = { updatedAt: number; canvasData: any }
const DRAFT_PROJECT_KEY_PREFIX = 'jobvarejo:draft:project:'
const getProjectDraftKey = (projectId: string) => `${DRAFT_PROJECT_KEY_PREFIX}${projectId}`
type ProjectDraftPagePayload = Omit<Page, 'canvasData'> & { canvasData?: any }
type ProjectDraftPayload = {
    updatedAt: number
    project: {
        id: string
        name: string
        pages: ProjectDraftPagePayload[]
        activePageIndex: number
    }
}
type PendingLocalDraftOperation =
    | { type: 'set'; value: unknown }
    | { type: 'remove' }

const pendingLocalDraftOperations = new Map<string, PendingLocalDraftOperation>()
let pendingLocalDraftFlushTimer: ReturnType<typeof setTimeout> | null = null
let pendingLocalDraftFlushIdleId: number | null = null
const LOCAL_DRAFT_FLUSH_DELAY_MS = 600
const LOCAL_DRAFT_FLUSH_IDLE_TIMEOUT_MS = 2000

const makePageId = (): string => Math.random().toString(36).substr(2, 9)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: unknown): boolean => UUID_RE.test(String(value || '').trim())

const ensureUniquePageId = (wanted: unknown, used: Set<string>): string => {
    const raw = String(wanted || '').trim()
    if (raw && !used.has(raw)) {
        used.add(raw)
        return raw
    }
    let next = makePageId()
    while (used.has(next)) next = makePageId()
    used.add(next)
    return next
}

const normalizeProjectPageIds = (pages: any[], context: string): void => {
    if (!Array.isArray(pages)) return
    const used = new Set<string>()
    pages.forEach((page: any, idx: number) => {
        if (!page || typeof page !== 'object') return
        const prev = String(page.id || '').trim()
        const normalized = ensureUniquePageId(prev, used)
        if (normalized !== prev) {
            page.id = normalized
            console.warn(`[pages] ID de página ausente/duplicado normalizado (${context}) #${idx}: "${prev || '(vazio)'}" -> "${normalized}"`)
        }
    })
}

const getCanvasSavedAt = (canvasData: any): number => {
    if (!canvasData || typeof canvasData !== 'object') return 0
    const direct = [
        (canvasData as any).__savedAt,
        (canvasData as any)._savedAt,
        (canvasData as any).savedAt,
        (canvasData as any).updatedAt
    ]
    for (const v of direct) {
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) return n
    }
    const metaTs = Number((canvasData as any)?.meta?.savedAt)
    if (Number.isFinite(metaTs) && metaTs > 0) return metaTs
    return 0
}

const getCanvasObjectCount = (canvasData: any): number => {
    const n = Number(canvasData?.objects?.length || 0)
    return Number.isFinite(n) ? n : 0
}

const hasUsableSerializedCanvasSnapshot = (page: Page | null | undefined): boolean => {
    if (!page?.canvasData) return false
    if (typeof page.lastSerializedCanvasJson !== 'string' || !page.lastSerializedCanvasJson) return false
    const liveSavedAt = getCanvasSavedAt(page.canvasData)
    const cachedSavedAt = Number(page.lastSerializedCanvasSavedAt || 0)
    return liveSavedAt > 0 && cachedSavedAt > 0 && liveSavedAt === cachedSavedAt
}

const withSoftTimeout = async <T>(
    work: Promise<T>,
    timeoutMs: number,
    label: string,
    onTimeout?: () => void
): Promise<T | null> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let didTimeout = false
    try {
        const timeoutPromise = new Promise<null>((resolve) => {
            timeoutId = setTimeout(() => {
                didTimeout = true
                try {
                    onTimeout?.()
                } catch (timeoutAbortErr) {
                    console.warn(`[saveProjectDB] Falha ao abortar ${label} após timeout suave:`, timeoutAbortErr)
                }
                console.warn(`[saveProjectDB] Timeout suave em ${label} após ${Math.round(timeoutMs / 1000)}s; continuando com fallback.`)
                resolve(null)
            }, timeoutMs)
        })
        const result = await Promise.race([work, timeoutPromise])
        return result
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
        // Se o timeout disparou, tentamos abortar o trabalho. Ainda assim, algumas
        // promises podem terminar em background se ignorarem o abort; logamos isso
        // por visibilidade, mas não bloqueamos o fluxo principal.
        if (didTimeout) {
            work.then(
                (val) => val != null && console.log(`[saveProjectDB] ${label} completou em background após timeout (resultado disponível mas não utilizado).`),
                () => { /* erro em background, já logado pelo saveCanvasData */ }
            )
        }
    }
}

const MAX_PAGE_DB_CANVAS_BACKUP_BYTES = 8_000_000

/**
 * Estimate the byte size of a value when serialized to JSON.
 * FIX: the previous implementation did a full JSON.stringify + TextEncoder.encode
 * on every call, which is extremely expensive for 2-3MB canvas objects and was
 * being called on every single canvas edit via writeDraft.
 * 
 * The new implementation uses a sampling heuristic for large objects: stringify
 * only the first few objects to estimate bytes-per-object, then extrapolate.
 * Falls back to full stringify for small values.
 */
const estimateJsonBytes = (value: unknown): number => {
    try {
        if (!value || typeof value !== 'object') {
            const json = JSON.stringify(value)
            return typeof json === 'string' ? json.length : Number.MAX_SAFE_INTEGER
        }
        // For canvas data with many objects, sample to avoid full stringify
        const objects = (value as any)?.objects
        if (Array.isArray(objects) && objects.length > 5) {
            // Sample first 3 + last 2 objects to estimate average size
            const sampleIndices = [0, 1, 2, objects.length - 2, objects.length - 1]
            let sampleSize = 0
            let sampleCount = 0
            for (const i of sampleIndices) {
                if (i >= 0 && i < objects.length && objects[i]) {
                    const s = JSON.stringify(objects[i])
                    if (typeof s === 'string') {
                        sampleSize += s.length
                        sampleCount++
                    }
                }
            }
            if (sampleCount > 0) {
                const avgPerObject = sampleSize / sampleCount
                // Estimate total: object array + overhead (background, version, etc.)
                const objectsEstimate = avgPerObject * objects.length
                const overhead = 500 // version, background, viewportTransform, etc.
                return Math.round(objectsEstimate + overhead)
            }
        }
        // Fallback for small objects or non-canvas data
        const json = JSON.stringify(value)
        return typeof json === 'string' ? json.length : Number.MAX_SAFE_INTEGER
    } catch {
        return Number.MAX_SAFE_INTEGER
    }
}

const pickBestRemoteCanvasData = (storageCanvasData: any, dbCanvasData: any) => {
    if (!storageCanvasData && !dbCanvasData) return { data: null, source: 'none' as const }
    if (storageCanvasData && !dbCanvasData) return { data: storageCanvasData, source: 'storage' as const }
    if (!storageCanvasData && dbCanvasData) return { data: dbCanvasData, source: 'db' as const }

    const storageCount = getCanvasObjectCount(storageCanvasData)
    const dbCount = getCanvasObjectCount(dbCanvasData)
    // Safety first: avoid selecting a blank payload while a non-empty backup exists.
    if (storageCount === 0 && dbCount > 0) return { data: dbCanvasData, source: 'db(non-empty-safer)' as const }
    if (dbCount === 0 && storageCount > 0) return { data: storageCanvasData, source: 'storage(non-empty-safer)' as const }

    const storageTs = getCanvasSavedAt(storageCanvasData)
    const dbTs = getCanvasSavedAt(dbCanvasData)
    if (storageTs > 0 || dbTs > 0) {
        if (dbTs > storageTs) return { data: dbCanvasData, source: 'db(newer-ts)' as const }
        return { data: storageCanvasData, source: 'storage(newer-ts)' as const }
    }

    // Legacy payloads sem timestamp: preserva comportamento atual (Storage), mas evita
    // regressão quando Storage vier vazio e o banco tiver conteúdo.
    if (storageCount === 0 && dbCount > 0) return { data: dbCanvasData, source: 'db(non-empty)' as const }
    return { data: storageCanvasData, source: 'storage(legacy-default)' as const }
}

const getPendingLocalDraftValue = (key: string): unknown | null | undefined => {
    const op = pendingLocalDraftOperations.get(key)
    if (!op) return undefined
    return op.type === 'set' ? op.value : null
}

const clearPendingLocalDraftFlushSchedule = () => {
    if (pendingLocalDraftFlushTimer) {
        clearTimeout(pendingLocalDraftFlushTimer)
        pendingLocalDraftFlushTimer = null
    }
    if (pendingLocalDraftFlushIdleId !== null && typeof window !== 'undefined') {
        const cic = (window as any).cancelIdleCallback
        if (typeof cic === 'function') {
            cic(pendingLocalDraftFlushIdleId)
        }
        pendingLocalDraftFlushIdleId = null
    }
}

// Maximum bytes for a single draft entry in localStorage (~4.5 MB).
// localStorage has ~5-10 MB total depending on browser; we purge stale
// project drafts on load so a single large entry is acceptable.
// Raised from 2 MB to 4.5 MB to cover canvas pages with many product images
// (~2.7 MB raw JSON is common for complex encarte pages).
const LOCAL_DRAFT_MAX_ENTRY_BYTES = 4_500_000

/**
 * Aggressively free localStorage space occupied by draft keys that do NOT
 * belong to the current project.  Returns the number of keys removed.
 */
const purgeStaleLocalDrafts = (currentProjectId: string): number => {
    let removed = 0
    try {
        const allDraftKeys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && (k.startsWith(DRAFT_KEY_PREFIX) || k.startsWith(DRAFT_PROJECT_KEY_PREFIX))) {
                allDraftKeys.push(k)
            }
        }
        const currentSuffix = `${currentProjectId}:`
        const currentExact = currentProjectId
        for (const k of allDraftKeys) {
            // Keep keys that belong to the active project
            const afterPrefix = k.startsWith(DRAFT_KEY_PREFIX)
                ? k.slice(DRAFT_KEY_PREFIX.length)
                : k.slice(DRAFT_PROJECT_KEY_PREFIX.length)
            if (afterPrefix.startsWith(currentSuffix) || afterPrefix === currentExact) continue
            localStorage.removeItem(k)
            removed++
        }
    } catch {
        // ignore errors during cleanup
    }
    return removed
}

const flushPendingLocalDrafts = () => {
    if (import.meta.server) return
    clearPendingLocalDraftFlushSchedule()
    if (!pendingLocalDraftOperations.size) return

    const operations = Array.from(pendingLocalDraftOperations.entries())
    pendingLocalDraftOperations.clear()
    let quotaHitThisFlush = false
    for (const [key, operation] of operations) {
        try {
            if (operation.type === 'set') {
                const json = JSON.stringify(operation.value)
                // Skip entries that are too large for localStorage; they will
                // be persisted through the normal server save pipeline.
                if (json.length > LOCAL_DRAFT_MAX_ENTRY_BYTES) {
                    if (import.meta.dev) {
                        console.warn(`[draft] Skipping oversized draft (${(json.length / 1024).toFixed(0)} KB) for key: ${key}`)
                    }
                    continue
                }
                localStorage.setItem(key, json)
            } else {
                localStorage.removeItem(key)
            }
            // If we previously had a quota warning and this succeeded, clear it
            if (localDraftQuotaWarning.value) localDraftQuotaWarning.value = false
        } catch (err: any) {
            const isQuota = err?.name === 'QuotaExceededError' ||
                String(err?.message || '').toLowerCase().includes('quota')
            if (isQuota) {
                // --- Stage 1: purge ALL drafts from other projects ---
                const currentProjectId = project.id || ''
                const purged = purgeStaleLocalDrafts(currentProjectId)

                if (purged > 0 && operation.type === 'set') {
                    // Retry once after purge
                    try {
                        const json = JSON.stringify(operation.value)
                        if (json.length <= LOCAL_DRAFT_MAX_ENTRY_BYTES) {
                            localStorage.setItem(key, json)
                            if (localDraftQuotaWarning.value) localDraftQuotaWarning.value = false
                            continue // success — move to next operation
                        }
                    } catch {
                        // still full — fall through to stage 2
                    }
                }

                // --- Stage 2: purge ALL draft keys (including current project) and retry ---
                try {
                    const allKeys: string[] = []
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i)
                        if (k && (k.startsWith(DRAFT_KEY_PREFIX) || k.startsWith(DRAFT_PROJECT_KEY_PREFIX))) {
                            allKeys.push(k)
                        }
                    }
                    for (const k of allKeys) localStorage.removeItem(k)
                } catch {
                    // ignore cleanup errors
                }

                if (operation.type === 'set') {
                    try {
                        const json = JSON.stringify(operation.value)
                        if (json.length <= LOCAL_DRAFT_MAX_ENTRY_BYTES) {
                            localStorage.setItem(key, json)
                            if (localDraftQuotaWarning.value) localDraftQuotaWarning.value = false
                            continue // success after full purge
                        }
                    } catch {
                        // still full — silently skip, data is safe in memory/server pipeline
                    }
                }
                // Data is safe in memory and will be persisted via the server save pipeline.
                // No need to warn the user — this is a silent local cache miss.
            }
            // Non-quota errors (serialization) are ignored
        }
    }
}

const schedulePendingLocalDraftFlush = () => {
    if (import.meta.server || !pendingLocalDraftOperations.size) return
    if (pendingLocalDraftFlushTimer || pendingLocalDraftFlushIdleId !== null) return

    if (typeof window !== 'undefined') {
        const ric = (window as any).requestIdleCallback
        if (typeof ric === 'function') {
            pendingLocalDraftFlushIdleId = ric(() => {
                pendingLocalDraftFlushIdleId = null
                flushPendingLocalDrafts()
            }, { timeout: LOCAL_DRAFT_FLUSH_IDLE_TIMEOUT_MS })
        }
    }

    pendingLocalDraftFlushTimer = setTimeout(() => {
        pendingLocalDraftFlushTimer = null
        flushPendingLocalDrafts()
    }, LOCAL_DRAFT_FLUSH_DELAY_MS)
}

const readDraft = (projectId: string, pageId: string): DraftPayload | null => {
    if (import.meta.server) return null
    try {
        const key = getDraftKey(projectId, pageId)
        const queuedValue = getPendingLocalDraftValue(key)
        const parsed = queuedValue !== undefined
            ? queuedValue
            : (() => {
                const raw = localStorage.getItem(key)
                return raw ? JSON.parse(raw) : null
            })()
        if (!parsed || typeof parsed !== 'object') return null
        if (typeof parsed.updatedAt !== 'number' || !('canvasData' in parsed)) return null
        return parsed as DraftPayload
    } catch {
        return null
    }
}
const writeDraft = (
    projectId: string,
    pageId: string,
    canvasData: any,
    opts: { immediate?: boolean } = {}
) => {
    if (import.meta.server) return
    try {
        // Quick size estimate to avoid queueing payloads that will never fit
        // in localStorage (~5 MB total). estimateJsonBytes is already available.
        const estimatedSize = estimateJsonBytes(canvasData)
        if (estimatedSize > LOCAL_DRAFT_MAX_ENTRY_BYTES) {
            // FIX: throttle this warning — it was firing on every single canvas
            // edit (hundreds of times) flooding the console and wasting CPU on
            // the size estimate.  Log once per page per 30 seconds.
            const now = Date.now()
            const throttleKey = `draft-skip-${pageId}`
            const lastWarnAt = (writeDraft as any).__warnTimestamps?.[throttleKey] ?? 0
            if (now - lastWarnAt > 30_000) {
                if (!(writeDraft as any).__warnTimestamps) (writeDraft as any).__warnTimestamps = {}
                ;(writeDraft as any).__warnTimestamps[throttleKey] = now
                console.warn(`[draft] Canvas too large for local draft (${(estimatedSize / 1024).toFixed(0)} KB), skipping page ${pageId}`)
            }
            return
        }
        const key = getDraftKey(projectId, pageId)
        const payload: DraftPayload = { updatedAt: Date.now(), canvasData }
        pendingLocalDraftOperations.set(key, { type: 'set', value: payload })
        if (opts.immediate) {
            flushPendingLocalDrafts()
        } else {
            schedulePendingLocalDraftFlush()
        }
    } catch {
        // ignore quota / serialization issues
    }
}
const clearDraft = (projectId: string, pageId: string, savedAt?: number) => {
    if (import.meta.server) return
    try {
        const key = getDraftKey(projectId, pageId)
        // Proteger contra race condition em navegação SPA: se o draft no localStorage
        // é mais recente que o save que está tentando limpá-lo, NÃO apagar.
        // Isso acontece quando flushAutoSave() roda em background após onUnmounted
        // ter gravado um emergencySnapshot mais recente.
        if (savedAt && savedAt > 0) {
            const existing = localStorage.getItem(key)
            if (existing) {
                try {
                    const parsed = JSON.parse(existing)
                    const draftTs = Number(parsed?.updatedAt || 0)
                    if (draftTs > savedAt) {
                        console.log(`[clearDraft] Preservando draft mais recente (draft=${draftTs}, save=${savedAt}) para página ${pageId}`)
                        return
                    }
                } catch { /* ignore parse errors, proceed to clear */ }
            }
        }
        pendingLocalDraftOperations.delete(key)
        localStorage.removeItem(key)
    } catch {
        // ignore
    }
}

const resolveCanvasDataWithDraft = (opts: {
    projectId: string
    pageId: string
    remoteCanvasData: any
    draft: DraftPayload | null
}) => {
    const remoteData = opts.remoteCanvasData || null
    const remoteCount = getCanvasObjectCount(remoteData)
    const draft = opts.draft
    if (!draft?.canvasData) {
        return { canvasData: remoteData, source: 'remote-no-draft', needsRemoteSync: false as const }
    }

    const draftData = draft.canvasData
    const draftCount = getCanvasObjectCount(draftData)
    const draftIsValid = draftCount > 0
    const remoteTs = getCanvasSavedAt(remoteData)
    const draftJsonTs = getCanvasSavedAt(draftData)
    const draftLocalTs = Number(draft.updatedAt || 0)
    const draftTs = Math.max(draftJsonTs, draftLocalTs)
    const sameFingerprint = computeCanvasFingerprint(remoteData) === computeCanvasFingerprint(draftData)

    if (!draftIsValid) {
        if (remoteCount > 0) {
            clearDraft(opts.projectId, opts.pageId)
        }
        return { canvasData: remoteData, source: 'remote-draft-invalid', needsRemoteSync: false as const }
    }

    if (remoteCount === 0) {
        return { canvasData: draftData, source: 'draft-remote-empty', needsRemoteSync: true as const }
    }

    if (sameFingerprint) {
        clearDraft(opts.projectId, opts.pageId)
        return { canvasData: remoteData, source: 'remote-same-as-draft', needsRemoteSync: false as const }
    }

    // Protect unsynced changes on reload:
    // if local draft is strictly newer than remote payload, prefer local draft and resync.
    // FIX: changed `>=` to `>` — when both timestamps are equal, the draft was
    // created from the remote data and was never actually modified by the user.
    // Preferring the remote (authoritative) source on equal timestamps avoids
    // unnecessary re-saves and potential infinite recovery loops.
    const draftShouldWin = draftTs > 0 && (remoteTs === 0 || draftTs > remoteTs)
    if (draftShouldWin) {
        return { canvasData: draftData, source: 'draft-newer-than-remote', needsRemoteSync: true as const }
    }

    return { canvasData: remoteData, source: 'remote-newer-than-draft', needsRemoteSync: false as const }
}

const readProjectDraft = (projectId: string): ProjectDraftPayload | null => {
    if (import.meta.server) return null
    try {
        const key = getProjectDraftKey(projectId)
        const queuedValue = getPendingLocalDraftValue(key)
        const parsed = queuedValue !== undefined
            ? queuedValue
            : (() => {
                const raw = localStorage.getItem(key)
                return raw ? JSON.parse(raw) : null
            })()
        if (!parsed || typeof parsed !== 'object') return null
        if (typeof parsed.updatedAt !== 'number' || !parsed.project) return null
        return parsed as ProjectDraftPayload
    } catch {
        return null
    }
}

const serializeProjectDraftPages = (pages: Page[]): ProjectDraftPagePayload[] => {
    if (!Array.isArray(pages)) return []
    return pages.map((page) => ({
        id: String(page?.id || '').trim() || makePageId(),
        name: String(page?.name || '').trim() || 'Sem título',
        width: Number(page?.width || 1080),
        height: Number(page?.height || 1920),
        type: page?.type === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER',
        canvasDataPath: typeof page?.canvasDataPath === 'string'
            ? (page.canvasDataPath.trim() || undefined)
            : undefined,
        // NOTE: thumbnail (base64 data URL) is intentionally excluded from
        // localStorage drafts to avoid blowing the ~5 MB quota.  The
        // thumbnailUrl (S3 URL) is preserved for restoration.
        thumbnailUrl: typeof page?.thumbnailUrl === 'string'
            ? (page.thumbnailUrl.trim() || undefined)
            : undefined,
        thumbnailDirty: !!page?.thumbnailDirty,
        lastLoadedFingerprint: typeof page?.lastLoadedFingerprint === 'string'
            ? page.lastLoadedFingerprint
            : undefined,
        lastSavedFingerprint: typeof page?.lastSavedFingerprint === 'string'
            ? page.lastSavedFingerprint
            : undefined,
        lastPersistedObjectCount: Number.isFinite(Number(page?.lastPersistedObjectCount))
            ? Number(page.lastPersistedObjectCount)
            : undefined,
        dirty: !!page?.dirty
    }))
}

const hydratePagesFromProjectDraft = (projectId: string, pages: ProjectDraftPagePayload[]): Page[] => {
    if (!Array.isArray(pages)) return []
    return pages.map((page) => {
        const pageId = String(page?.id || '').trim() || makePageId()
        const pageDraft = readDraft(projectId, pageId)
        const preferredCanvasData = pageDraft?.canvasData ?? page?.canvasData ?? null
        const normalizedCanvasData = normalizeCanvasAssetUrls(preferredCanvasData, {
            clone: false,
            silent: true
        }).data
        const hasCanvasData = !!normalizedCanvasData
        const fingerprint = hasCanvasData ? computeCanvasFingerprint(normalizedCanvasData) : 'empty'
        const persistedObjectCount = hasCanvasData
            ? getCanvasObjectCount(normalizedCanvasData)
            : (Number.isFinite(Number(page?.lastPersistedObjectCount))
                ? Number(page.lastPersistedObjectCount)
                : 0)

        return {
            id: pageId,
            name: String(page?.name || '').trim() || 'Sem título',
            width: Number(page?.width || 1080),
            height: Number(page?.height || 1920),
            type: page?.type === 'FREE_DESIGN' ? 'FREE_DESIGN' : 'RETAIL_OFFER',
            canvasData: normalizedCanvasData,
            canvasDataPath: typeof page?.canvasDataPath === 'string'
                ? (page.canvasDataPath.trim() || undefined)
                : undefined,
            thumbnail: typeof page?.thumbnail === 'string' ? page.thumbnail : undefined,
            thumbnailUrl: typeof page?.thumbnailUrl === 'string'
                ? (page.thumbnailUrl.trim() || undefined)
                : undefined,
            thumbnailDirty: !!page?.thumbnailDirty,
            lastLoadedFingerprint: hasCanvasData
                ? fingerprint
                : (typeof page?.lastLoadedFingerprint === 'string' ? page.lastLoadedFingerprint : fingerprint),
            lastSavedFingerprint: hasCanvasData
                ? fingerprint
                : (typeof page?.lastSavedFingerprint === 'string' ? page.lastSavedFingerprint : fingerprint),
            lastPersistedObjectCount: persistedObjectCount,
            dirty: !!pageDraft?.canvasData || page?.dirty !== false
        } as Page
    })
}

const writeProjectDraft = (opts: { immediate?: boolean } = {}) => {
    if (import.meta.server) return
    try {
        if (!project.id) return
        const key = getProjectDraftKey(project.id)
        const payload: ProjectDraftPayload = {
            updatedAt: Date.now(),
            project: {
                id: project.id,
                name: project.name,
                pages: serializeProjectDraftPages(project.pages as Page[]),
                activePageIndex: project.activePageIndex
            }
        }
        pendingLocalDraftOperations.set(key, { type: 'set', value: payload })
        if (opts.immediate) {
            flushPendingLocalDrafts()
        } else {
            schedulePendingLocalDraftFlush()
        }
    } catch {
        // ignore
    }
}

const clearProjectDraft = (projectId: string) => {
    if (import.meta.server) return
    try {
        const key = getProjectDraftKey(projectId)
        pendingLocalDraftOperations.delete(key)
        localStorage.removeItem(key)
    } catch {
        // ignore
    }
}

const projectServerUpdatedAt = ref<string | null>(null)
const projectLoadSession = ref(0)
const pageCanvasLoadPromises = new Map<string, Promise<Page | null>>()
let deferredCanvasPrefetchRunId = 0

type ResolvedPageCanvasState = {
    canvasData: any
    canvasDataPath?: string
    finalObjectCount: number
    finalFingerprint: string
    needsRemoteSync: boolean
    source: string
}

const scheduleDeferredWork = (work: () => void, timeoutMs = 1800) => {
    if (typeof window === 'undefined') {
        work()
        return
    }

    const ric = (window as any).requestIdleCallback
    if (typeof ric === 'function') {
        ric(() => work(), { timeout: timeoutMs })
        return
    }

    window.setTimeout(work, Math.min(1400, timeoutMs))
}

const getProjectPageIndexById = (pageId: string): number => (
    project.pages.findIndex((page) => String(page?.id || '').trim() === String(pageId || '').trim())
)

const getDeferredCanvasPrefetchIds = (activePageId?: string | null, limit = 2): string[] => {
    const activeId = String(activePageId || '').trim()
    const activeIndex = activeId ? getProjectPageIndexById(activeId) : -1
    const pages = Array.isArray(project.pages) ? project.pages : []

    const candidates = pages
        .map((page, index) => ({ page, index }))
        .filter(({ page }) => !!page && !page.canvasData && !!String(page.canvasDataPath || '').trim())
        .filter(({ page }) => String(page?.id || '').trim() !== activeId)
        .sort((a, b) => {
            if (activeIndex < 0) return a.index - b.index
            const distA = Math.abs(a.index - activeIndex)
            const distB = Math.abs(b.index - activeIndex)
            if (distA !== distB) return distA - distB
            return a.index - b.index
        })
        .slice(0, Math.max(0, Math.floor(limit)))

    return candidates.map(({ page }) => String(page?.id || '').trim()).filter(Boolean)
}

export const useProject = () => {
    const { getApiAuthHeaders } = useApiAuth()
    const { saveCanvasData, saveThumbnail, loadCanvasData, loadCanvasDataFromPath, recoverLatestNonEmptyCanvasData, deleteProjectFiles, saveStatus: storageSaveStatus } = useStorage()

    const activePage = computed(() => project.pages[project.activePageIndex])

    // Storage status is only a backup transport signal (Wasabi upload/proxy).
    // Do not overwrite project-level save status with it, otherwise the UI can show
    // "Falha ao salvar" even when Postgres persistence succeeded.
    watch(storageSaveStatus, (status) => {
        if (status === 'error') {
            console.warn('[useProject] Falha no backup de storage detectada; persistência principal (Postgres) segue ativa.')
        }
    })

    const resolvePageCanvasState = async (opts: {
        projectId: string
        pageId: string
        pageMeta: any
        draft?: DraftPayload | null
    }): Promise<ResolvedPageCanvasState> => {
        let serverCanvasData = null
        const dbCanvasData = opts.pageMeta?.canvasData || null
        const preferredPath = String(opts.pageMeta?.canvasDataPath || '').trim()

        // canvasSavedAt é o timestamp que o save gravou no metadata do DB — representa
        // o momento exato em que o canvas foi salvo. Se o Wasabi tem dados mais antigos
        // que este timestamp, significa que um save posterior falhou no upload Wasabi
        // mas conseguiu gravar os metadados no DB.
        const expectedCanvasSavedAt = Number(opts.pageMeta?.canvasSavedAt || 0)

        if (preferredPath) {
            console.log('📥 Buscando canvasData do Storage:', preferredPath)
            serverCanvasData = await loadCanvasDataFromPath(preferredPath)
            if (serverCanvasData) {
                const objectCount = getCanvasObjectCount(serverCanvasData)
                const wasabiTs = getCanvasSavedAt(serverCanvasData)
                console.log('✅ CanvasData carregado do Storage:', { hasData: true, objectCount, wasabiTs })

                // Detectar dados stale no Wasabi: se o DB registra um timestamp mais recente
                // que o __savedAt do arquivo no Wasabi, o upload de um save posterior falhou.
                // Nesse caso, o Wasabi tem dados antigos (ex: de ontem) e devemos preferir
                // um backup legado do DB ou o draft local.
                if (expectedCanvasSavedAt > 0 && wasabiTs > 0 && expectedCanvasSavedAt - wasabiTs > 5_000) {
                    console.warn(
                        `⚠️ Wasabi stale detectado para página ${opts.pageId}: ` +
                        `Wasabi __savedAt=${wasabiTs} (${new Date(wasabiTs).toISOString()}), ` +
                        `DB canvasSavedAt=${expectedCanvasSavedAt} (${new Date(expectedCanvasSavedAt).toISOString()}). ` +
                        `Diferença: ${Math.round((expectedCanvasSavedAt - wasabiTs) / 1000)}s. ` +
                        `Preferindo backup legado do DB ou draft local.`
                    )
                    // Marcar como stale - pickBestRemoteCanvasData vai preferir um
                    // backup legado do DB se ele ainda existir, senão o draft local.
                    if (dbCanvasData && getCanvasObjectCount(dbCanvasData) > 0) {
                        // Backup legado do DB existe e tem conteúdo - ignorar Wasabi stale.
                        serverCanvasData = null
                    }
                    // Sem backup legado, manter Wasabi como fallback (melhor que nada),
                    // mas o draft local (se existir) vai ganhar em resolveCanvasDataWithDraft.
                }
            } else {
                console.warn('⚠️ CanvasData não encontrado no Storage')
            }
        }

        const serverCountBeforeRecovery = getCanvasObjectCount(serverCanvasData)
        const dbCountBeforeRecovery = getCanvasObjectCount(dbCanvasData)
        let resolvedCanvasPath = preferredPath || undefined

        if (preferredPath && serverCountBeforeRecovery === 0 && dbCountBeforeRecovery === 0) {
            const recovered = await recoverLatestNonEmptyCanvasData({
                projectId: opts.projectId,
                pageId: opts.pageId,
                preferredKey: preferredPath
            })
            if (recovered?.json) {
                serverCanvasData = recovered.json
                resolvedCanvasPath = recovered.key
                console.warn(`🛟 Recovery automático aplicado para página ${opts.pageId}: ${recovered.objectCount} objetos`)
            }
        }

        const bestRemote = pickBestRemoteCanvasData(serverCanvasData, dbCanvasData)
        serverCanvasData = bestRemote.data
        if (bestRemote.source !== 'none') {
            const objectCount = getCanvasObjectCount(serverCanvasData)
            console.log(`📦 CanvasData remoto selecionado: ${bestRemote.source} (${objectCount} objetos)`)
        }

        const draft = opts.draft ?? readDraft(opts.projectId, opts.pageId)
        if (draft?.canvasData) {
            const draftObjectCount = getCanvasObjectCount(draft.canvasData)
            const draftAge = Date.now() - Number(draft.updatedAt || 0)
            const draftAgeMin = Math.floor(draftAge / 60000)
            const remoteObjectCount = getCanvasObjectCount(serverCanvasData)
            console.log(`📝 Draft encontrado para página ${opts.pageId}: ${draftObjectCount} objetos (idade: ${draftAgeMin}min)`)
            console.log(`📝 Remoto tem: ${remoteObjectCount} objetos`)
        }

        const draftDecision = resolveCanvasDataWithDraft({
            projectId: opts.projectId,
            pageId: opts.pageId,
            remoteCanvasData: serverCanvasData,
            draft
        })
        const canvasData = normalizeCanvasAssetUrls(draftDecision.canvasData, {
            clone: false,
            silent: true
        }).data

        console.log(`📦 Fonte final da página ${opts.pageId}: ${draftDecision.source}`)
        if (canvasData) {
            const finalObjectCount = getCanvasObjectCount(canvasData)
            if (finalObjectCount > 0) {
                console.log(`✅ CanvasData final para página ${opts.pageId}: ${finalObjectCount} objeto(s)`)
            }
        }

        const finalObjectCount = getCanvasObjectCount(canvasData)
        const finalFingerprint = computeCanvasFingerprint(canvasData)

        return {
            canvasData,
            canvasDataPath: resolvedCanvasPath,
            finalObjectCount,
            finalFingerprint,
            needsRemoteSync: draftDecision.needsRemoteSync,
            source: draftDecision.source
        }
    }

    const applyResolvedPageCanvasState = (page: Page, resolved: ResolvedPageCanvasState) => {
        page.canvasData = resolved.canvasData
        page.canvasDataPath = resolved.canvasDataPath || page.canvasDataPath
        page.lastLoadedFingerprint = resolved.finalFingerprint
        page.lastSavedFingerprint = resolved.finalFingerprint
        page.lastPersistedObjectCount = resolved.finalObjectCount
        if (resolved.needsRemoteSync) {
            page.dirty = true
        }
    }

    const ensurePageCanvasDataLoaded = async (
        pageId: string,
        opts: { triggerSync?: boolean } = {}
    ): Promise<Page | null> => {
        const normalizedPageId = String(pageId || '').trim()
        if (!normalizedPageId) return null

        const pageIndex = getProjectPageIndexById(normalizedPageId)
        if (pageIndex < 0) return null
        const page = project.pages[pageIndex]
        if (!page) return null
        if (page.canvasData || (!page.canvasDataPath && !readDraft(project.id, normalizedPageId)?.canvasData)) {
            return page
        }

        const existing = pageCanvasLoadPromises.get(normalizedPageId)
        if (existing) return existing

        const sessionAtStart = projectLoadSession.value
        const draft = readDraft(project.id, normalizedPageId)
        const loadPromise = (async () => {
            try {
                const resolved = await resolvePageCanvasState({
                    projectId: project.id,
                    pageId: normalizedPageId,
                    pageMeta: page,
                    draft
                })

                if (sessionAtStart !== projectLoadSession.value) return null
                const livePageIndex = getProjectPageIndexById(normalizedPageId)
                if (livePageIndex < 0) return null
                const livePage = project.pages[livePageIndex]
                if (!livePage) return null

                applyResolvedPageCanvasState(livePage, resolved)
                console.log('✅ Página hidratada sob demanda:', {
                    id: livePage.id,
                    name: livePage.name,
                    source: resolved.source,
                    objectCount: resolved.finalObjectCount
                })

                if (resolved.needsRemoteSync) {
                    hasUnsavedChanges.value = true
                    unsavedRevision.value = Math.max(unsavedRevision.value, 1)
                    if (opts.triggerSync !== false && project.id && !project.id.startsWith('proj_')) {
                        triggerAutoSave()
                    }
                }

                return livePage
            } finally {
                pageCanvasLoadPromises.delete(normalizedPageId)
            }
        })()

        pageCanvasLoadPromises.set(normalizedPageId, loadPromise)
        return loadPromise
    }

    const scheduleCanvasDataPrefetch = (activePageId?: string | null, limit = 2) => {
        if (typeof window === 'undefined') return

        const runId = ++deferredCanvasPrefetchRunId
        const candidates = getDeferredCanvasPrefetchIds(activePageId, limit)
        if (!candidates.length) return

        let index = 0
        const pump = () => {
            if (runId !== deferredCanvasPrefetchRunId) return
            if (projectLoadSession.value <= 0) return
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                scheduleDeferredWork(pump, 3200)
                return
            }
            if (isSaving.value) {
                scheduleDeferredWork(pump, 2800)
                return
            }

            const nextPageId = candidates[index++]
            if (!nextPageId) return

            void ensurePageCanvasDataLoaded(nextPageId).finally(() => {
                if (runId !== deferredCanvasPrefetchRunId) return
                if (index < candidates.length) {
                    scheduleDeferredWork(pump, 2200)
                }
            })
        }

        scheduleDeferredWork(pump, 1600)
    }

    const initProject = () => {
        if (project.pages.length === 0) {
            // Offline-safe: restore last local draft for the default (unsaved) project.
            // Without this, `proj_default` would lose all edits (including sticker outline) on reload.
            const local = readProjectDraft(project.id)
            if (local?.project?.pages?.length) {
                try {
                    project.id = local.project.id || project.id
                    project.name = local.project.name || project.name
                    project.pages = hydratePagesFromProjectDraft(project.id, local.project.pages || [])
                    normalizeProjectPageIds(project.pages as any[], 'initProject:draft')
                    project.activePageIndex = Math.min(
                        Math.max(0, Number(local.project.activePageIndex || 0)),
                        Math.max(0, (project.pages.length || 1) - 1)
                    )
                    markAsUnsaved()
                    console.log('📝 Projeto restaurado do rascunho local:', { id: project.id, pages: project.pages.length })
                    return
                } catch {
                    // Fall through to create a fresh page
                }
            }
            // Cria página inicial padrão (Story)
            addPage('RETAIL_OFFER', 1080, 1920, 'Capa Story')
        }
    }

    const addPage = (type: 'RETAIL_OFFER' | 'FREE_DESIGN', width: number, height: number, name?: string) => {
        const existingIds = new Set((project.pages || []).map((p: any) => String(p?.id || '').trim()).filter(Boolean))
        const id = ensureUniquePageId(makePageId(), existingIds)
        const newPage: Page = {
            id,
            name: name || `Página ${project.pages.length + 1}`,
            width,
            height,
            type,
            canvasData: null, // Começa vazio
            canvasDataPath: undefined,
            lastLoadedFingerprint: 'empty',
            lastSavedFingerprint: 'empty',
            lastPersistedObjectCount: 0,
            dirty: false
        }
        project.pages.push(newPage)
        // Switch to new page
        project.activePageIndex = project.pages.length - 1
        markAsUnsaved()
    }

    const switchPage = (index: number) => {
        if (index >= 0 && index < project.pages.length) {
            project.activePageIndex = index
        }
    }

    const updatePageThumbnail = (index: number, dataUrl: string) => {
        const page = project.pages[index]
        if (!page) return
        if (page.thumbnail === dataUrl) return
        page.thumbnail = dataUrl
        page.thumbnailDirty = true
        if (!page.dirty && !hasUnsavedChanges.value) {
            markAsUnsaved()
        }
        writeProjectDraft()
    }

    type UpdatePageDataOptions = {
        markUnsaved?: boolean
        source?: 'user' | 'system'
        skipIfSameFingerprint?: boolean
        reason?: string
    }

    const updatePageData = (index: number, json: any, opts: UpdatePageDataOptions = {}) => {
        if (project.pages[index]) {
            const existingSavedAt = Number(
                (json as any)?.__savedAt ||
                (json as any)?._savedAt ||
                (json as any)?.savedAt ||
                (json as any)?.updatedAt ||
                0
            )
            const stampedJson = (json && typeof json === 'object')
                ? { ...json, __savedAt: existingSavedAt > 0 ? existingSavedAt : Date.now() }
                : json
            const fingerprint = computeCanvasFingerprint(stampedJson)
            if (opts.skipIfSameFingerprint && project.pages[index].lastSavedFingerprint === fingerprint) {
                return false
            }
            const objectCount = stampedJson?.objects?.length || 0;
            if (import.meta.dev) {
                console.log(`💾 updatePageData: salvando ${objectCount} objeto(s) na página ${index} (${project.pages[index].id})`, {
                    reason: opts.reason || 'unspecified',
                    source: opts.source || 'user'
                });
            }
            
            project.pages[index].canvasData = stampedJson
            project.pages[index].lastSavedFingerprint = fingerprint
            if (!project.pages[index].lastLoadedFingerprint) {
                project.pages[index].lastLoadedFingerprint = fingerprint
            }
            project.pages[index].dirty = opts.source === 'system'
                ? !!opts.markUnsaved
                : true
            
            // Verificar se foi salvo corretamente
            const savedObjectCount = project.pages[index].canvasData?.objects?.length || 0;
            if (savedObjectCount !== objectCount) {
                console.error(`❌ PROBLEMA: Salvamos ${objectCount} objetos mas página tem ${savedObjectCount}`);
            } else if (import.meta.dev) {
                console.log(`✅ updatePageData: ${savedObjectCount} objeto(s) salvos corretamente`);
            }
            
            const shouldMarkUnsaved = opts.markUnsaved ?? (opts.source !== 'system')
            if (shouldMarkUnsaved) markAsUnsaved()
            // Also persist a local draft to survive reloads/offline.
            const p = project.pages[index]
            const shouldFlushLocalDraftsNow = opts.source === 'system'
            if (p?.id && project.id) {
                writeDraft(project.id, p.id, stampedJson, { immediate: shouldFlushLocalDraftsNow })
                if (import.meta.dev) {
                    console.log(`📝 Draft local salvo para página ${p.id}`);
                }
            }
            writeProjectDraft({ immediate: shouldFlushLocalDraftsNow })
            return true
        } else {
            console.error(`❌ updatePageData: página ${index} não existe!`);
            return false
        }
    }

    const markAsUnsaved = () => {
        hasUnsavedChanges.value = true
        unsavedRevision.value += 1
        _lastUserEditAt = Date.now()
    }

    // --- A Regra de Ouro: Smart Duplicate ---
    const duplicatePage = async (index: number) => {
        const sourcePage = project.pages[index]
        if (!sourcePage) return
        if (!sourcePage.canvasData) {
            await ensurePageCanvasDataLoaded(sourcePage.id)
        }
        if (!sourcePage.canvasData) return

        // 1. Deep Clone do JSON
        const clonedJson = JSON.parse(JSON.stringify(sourcePage.canvasData))

        // 2. Lógica de "Sanitização" baseada no Tipo
        if (sourcePage.type === 'RETAIL_OFFER') {
            // Smart Clean: Mantém layout, remove dados específicos de produtos
            if (clonedJson.objects && Array.isArray(clonedJson.objects)) {
                clonedJson.objects.forEach((obj: any) => {
                    if (obj.isSmartObject) {
                        const resetChildren = (objects: any[]) => {
                            objects.forEach(child => {
                                if (child.type === 'i-text' || child.type === 'textbox' || child.type === 'text') {
                                    if (child.name === 'nameText') child.text = 'PRODUTO'
                                    if (child.name === 'priceInteger') child.text = '00'
                                    if (child.name === 'priceDecimal') child.text = ',00'
                                }
                                if (child.type === 'group') {
                                    resetChildren(child.objects)
                                }
                            })
                        }

                        if (obj.objects) resetChildren(obj.objects)
                        obj.id_produto_sql = null
                    }
                })
            }
        }

        // 3. Criar a nova página
        const existingIds = new Set((project.pages || []).map((p: any) => String(p?.id || '').trim()).filter(Boolean))
        const newPage: Page = {
            id: ensureUniquePageId(makePageId(), existingIds),
            name: `${sourcePage.name} (Cópia)`,
            width: sourcePage.width,
            height: sourcePage.height,
            type: sourcePage.type,
            canvasData: clonedJson,
            thumbnail: sourcePage.thumbnail,
            thumbnailDirty: !!sourcePage.thumbnail,
            lastLoadedFingerprint: computeCanvasFingerprint(clonedJson),
            lastSavedFingerprint: computeCanvasFingerprint(clonedJson),
            lastPersistedObjectCount: getCanvasObjectCount(clonedJson),
            dirty: true
        }

        // Inserir logo após a original
        project.pages.splice(index + 1, 0, newPage)
        project.activePageIndex = index + 1
        markAsUnsaved()
    }

    const deletePage = (index: number) => {
        if (project.pages.length <= 1) return // Não deletar a última
        project.pages.splice(index, 1)
        if (project.activePageIndex >= project.pages.length) {
            project.activePageIndex = project.pages.length - 1
        }
        markAsUnsaved()
    }

    const renamePage = (index: number, name: string) => {
        const page = project.pages[index]
        if (!page) return
        const fallbackName = `Página ${index + 1}`
        const nextName = String(name || '').trim() || fallbackName
        if (nextName === page.name) return
        page.name = nextName
        markAsUnsaved()
        writeProjectDraft()
    }

    const resizePage = (index: number, width: number, height: number) => {
        if (project.pages[index]) {
            project.pages[index].width = width
            project.pages[index].height = height
            markAsUnsaved()
        }
    }

    /**
     * Salva o projeto usando Storage S3-compatível (Wasabi/Contabo) para os dados pesados.
     * O banco armazena apenas metadados e caminhos para os arquivos.
     */
		    const saveProjectDB = async (opts: {
                forceEmptyOverwrite?: boolean
            } = {}) => {
		        // Não executar no servidor (SSR) ou se o módulo HMR foi substituído
		        if (import.meta.server || _moduleDisposed) {
		            return
		        }

	        const hasDirtyPages = Array.isArray(project.pages) && project.pages.some((page) => !!page?.dirty || !!page?.thumbnailDirty)
		        const requiresInitialPersist = !project.id || project.id.startsWith('proj_')
		        if (!hasUnsavedChanges.value && !hasDirtyPages && !requiresInitialPersist) {
		            return
		        }

		        // Prevent concurrent saves from racing and tripping optimistic concurrency on ourselves.
		        if (isSaving.value) {
	            const wasAlreadyQueued = queuedSaveAfterCurrent.value
	            queuedSaveAfterCurrent.value = true
	            if (!wasAlreadyQueued) {
	                console.info('[saveProjectDB] Save já em andamento; novo sync será executado ao concluir o atual.')
	            }
	            return
	        }

	        isSaving.value = true
	        saveStatus.value = 'saving'
	        const saveRevisionAtStart = unsavedRevision.value
	        const saveLoadSessionAtStart = projectLoadSession.value
	        let saveSucceeded = false
	        let changedDuringSave = false
	        let saveAbortedByContextSwitch = false
            let saveNeedsFollowUpForLocalChanges = false
            let currentSaveStage = 'preflight'
            const setSaveStage = (stage: string) => {
                currentSaveStage = stage
                saveDebugStage.value = stage
            }

	        // Watchdog: se a operação travar (await preso), força reset cedo o
            // bastante para o usuário não ficar preso olhando "Salvando..." por muito tempo.
            // FIX: the watchdog now only logs + sets error status but does NOT reset
            // isSaving/queuedSave — that's the `finally` block's job.  Previously the
            // watchdog could fire at the exact same time as the `finally` block,
            // causing a race that cleared `queuedSaveAfterCurrent` and dropped the
            // queued follow-up save, leading to data loss.
            let _saveWatchdogFired = false
	        let _saveWatchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
	            _saveWatchdog = null
                _saveWatchdogFired = true
	            if (isSaving.value) {
	                console.error(`[saveProjectDB] Watchdog: save travado por ${Math.round(SAVE_WATCHDOG_MS / 1000)}s na etapa "${currentSaveStage}", forçando reset de estado.`)
	                saveLastError.value = `Salvamento travou em "${currentSaveStage}". Clique em "Tentar novamente".`
	                saveStatus.value = 'error'
	                isSaving.value = false
	                // NOTE: intentionally NOT clearing queuedSaveAfterCurrent here —
	                // the finally block will handle it and schedule the follow-up.
	            }
	        }, SAVE_WATCHDOG_MS)
	        const abortIfStaleSaveContext = (): boolean => {
	            if (saveLoadSessionAtStart === projectLoadSession.value) return false
	            saveAbortedByContextSwitch = true
	            saveStatus.value = 'idle'
	            console.warn('[saveProjectDB] Save abortado: contexto do projeto mudou durante a gravação.')
	            return true
	        }

	        try {
                setSaveStage('preflight')
	            normalizeProjectPageIds(project.pages as any[], 'saveProjectDB:preflight')
            if (!Array.isArray(project.pages) || project.pages.length === 0) {
                saveStatus.value = 'idle'
                console.warn('[saveProjectDB] Save pulado: projeto sem páginas (estado transitório).')
                return
            }
	            if (abortIfStaleSaveContext()) return
	                const isUnsafeEmptyOverwrite = (page: Page): boolean => {
                    // Se canvasData é null/undefined, a página ainda não foi carregada do Wasabi.
                    // NÃO bloquear: apenas pular o upload desta página e manter o path existente.
                    if (page?.canvasData == null) return false
                    const currentCount = getCanvasObjectCount(page?.canvasData)
                    const persistedCount = Number(page?.lastPersistedObjectCount || 0)
                    // Só bloqueia vazio quando NÃO há edição pendente na página.
                    // Página dirty=true indica alteração intencional em canvasData (ex.: remover todos os objetos).
                    return currentCount === 0 && persistedCount > 0 && !page?.dirty
                }
	            const unsafeEmptyPages = project.pages.filter((page) => {
	                return isUnsafeEmptyOverwrite(page as Page)
	            })
	            if (unsafeEmptyPages.length > 0 && !opts.forceEmptyOverwrite) {
                    // Não bloquear o save inteiro — apenas logar aviso. As páginas problemáticas
                    // serão ignoradas no upload individual (veja guarda abaixo), enquanto páginas
                    // válidas (ativas e com dados) são salvas normalmente.
	                console.warn('⚠️ Páginas com canvas aparentemente vazio serão ignoradas no upload (dados existentes mantidos):', unsafeEmptyPages.map((p) => ({
	                    pageId: p.id,
	                    persistedCount: p.lastPersistedObjectCount || 0,
	                    currentCount: getCanvasObjectCount(p.canvasData),
                        dirty: !!p.dirty
	                })))
	            }

            // 1. Salvar cada página no Storage
            const storagePaths: string[] = []
            const thumbnailUrls: string[] = []
            const failedCanvasSyncPageIds = new Set<string>()
            const failedThumbnailSyncPageIds = new Set<string>()

            // Upload de todas as páginas em paralelo (canvas + thumbnail por página)
            setSaveStage('upload-pages')
            // FIX: snapshot the pages array at this point so that a concurrent
            // loadProjectDB replacing project.pages does not cause us to iterate
            // the NEW project's pages while uploading the OLD project's data.
            const pagesSnapshot = [...project.pages]
            const pageUploadPromises = pagesSnapshot.map(async (page, i) => {
                // FIX: the abort check inside this lambda only returns from the lambda,
                // NOT from saveProjectDB.  We still check so we can skip work early,
                // but the real abort check is after Promise.all below.
                if (abortIfStaleSaveContext()) return

                // Salvar canvas JSON no Storage (com retry automático)
                const shouldUploadCanvas = !!page?.canvasData && (!!page?.dirty || !page?.canvasDataPath)
                if (shouldUploadCanvas && page?.canvasData) {
                    try {
                        const currentCount = getCanvasObjectCount(page.canvasData)
                        const persistedCount = Number(page?.lastPersistedObjectCount || 0)
                        if (isUnsafeEmptyOverwrite(page) && !opts.forceEmptyOverwrite) {
                            console.warn(`🛡️ Skip upload vazio para página ${page.id} (persistido=${persistedCount}, atual=${currentCount})`)
                        } else {
                            const canvasUploadAbortController = new AbortController()
                            const path = await withSoftTimeout(
                                saveCanvasData(
                                    project.id,
                                    page.id,
                                    page.canvasData,
                                    // Uma rodada por save: o servidor já faz reset/retry do
                                    // client S3 e o autosync em background agenda novas tentativas.
                                    1,
                                    (() => {
                                        const serializedJson = typeof page?.lastSerializedCanvasJson === 'string'
                                            ? page.lastSerializedCanvasJson
                                            : null
                                        const serializedSavedAt = Number(page?.lastSerializedCanvasSavedAt || 0)
                                        const liveSavedAt = getCanvasSavedAt(page?.canvasData)
                                        return serializedJson && serializedSavedAt > 0 && serializedSavedAt === liveSavedAt
                                            ? serializedJson
                                            : null
                                    })(),
                                    canvasUploadAbortController.signal
                                ),
                                CANVAS_UPLOAD_SOFT_TIMEOUT_MS,
                                `upload-canvas:${page.id}`,
                                () => canvasUploadAbortController.abort(`saveProjectDB-soft-timeout:${page.id}`)
                            )
                            if (path) {
                                storagePaths[i] = path
                                page.canvasDataPath = path
                                page.lastPersistedObjectCount = currentCount
                                console.log('✅ Canvas salvo na Wasabi:', path)
                            } else {
                                failedCanvasSyncPageIds.add(page.id)
                                console.warn(`⚠️ Falha ao salvar canvas na Wasabi sem confirmação remota (página ${page.id})`)
                            }
                        }
                    } catch (err: any) {
                        failedCanvasSyncPageIds.add(page.id)
                        console.error('❌ Erro crítico ao salvar canvas na Wasabi:', err)
                    }
                }
                if (!storagePaths[i] && page?.canvasDataPath) {
                    storagePaths[i] = page.canvasDataPath
                }

                // Salvar thumbnail no Storage (em paralelo com canvas)
                const shouldUploadThumbnail = !!page?.thumbnail && (!!page?.dirty || !!page?.thumbnailDirty || !page?.thumbnailUrl)
                if (shouldUploadThumbnail && page?.thumbnail) {
                    const url = await withSoftTimeout(
                        saveThumbnail(project.id, page.id, page.thumbnail),
                        THUMBNAIL_UPLOAD_SOFT_TIMEOUT_MS,
                        `upload-thumbnail:${page.id}`
                    )
                    if (url) {
                        thumbnailUrls[i] = url
                        page.thumbnailUrl = url
                        page.thumbnailDirty = false
                    } else {
                        failedThumbnailSyncPageIds.add(page.id)
                        console.warn(`⚠️ Falha ao salvar thumbnail na Wasabi (página ${page.id})`)
                    }
                }
                if (!thumbnailUrls[i] && page?.thumbnailUrl) {
                    thumbnailUrls[i] = page.thumbnailUrl
                }
            })
            await Promise.all(pageUploadPromises)
            if (abortIfStaleSaveContext()) return

            const hasCanvasSyncFailures = failedCanvasSyncPageIds.size > 0
            if (hasCanvasSyncFailures) {
                changedDuringSave = unsavedRevision.value !== saveRevisionAtStart
                hasUnsavedChanges.value = true
                saveStatus.value = 'error'
                saveLastError.value = 'Falha ao salvar na Wasabi. O banco nao foi atualizado; o design segue apenas no rascunho local ate a sincronizacao completar.'
                console.warn(
                    `[saveProjectDB] Persistencia no banco adiada: ${failedCanvasSyncPageIds.size} pagina(s) sem upload confirmado na Wasabi.`,
                    { pageIds: Array.from(failedCanvasSyncPageIds) }
                )

                if (!changedDuringSave) {
                    _unsyncedRetryCount++
                    const maxRetryBackoff = 5 * 60_000
                    const retryCooldownMs = Math.min(15_000 * Math.pow(2, _unsyncedRetryCount - 1), maxRetryBackoff)
                    console.log(`[saveProjectDB] Novo retry do upload Wasabi em ${Math.round(retryCooldownMs / 1000)}s (tentativa ${_unsyncedRetryCount})`)
                    const retryTimer = setTimeout(() => {
                        _pendingSaveTimers.delete(retryTimer)
                        if (_moduleDisposed) return
                        if (!hasUnsavedChanges.value) return
                        if (isSaving.value) return
                        const hasDirtyPagesForRetry = project.pages.some((p) => p?.dirty)
                        if (!hasDirtyPagesForRetry) return
                        if (Date.now() - _lastUserEditAt < 30_000) {
                            console.log('[saveProjectDB] Retry do upload Wasabi postergado: usuario editando ativamente.')
                            return
                        }
                        console.log(`🔄 Retentando upload Wasabi das paginas pendentes (${Array.from(failedCanvasSyncPageIds).join(', ')})...`)
                        void saveProjectDB()
                    }, retryCooldownMs)
                    _pendingSaveTimers.add(retryTimer)
                }

                return
            }

            // 2. Preparar payload mínimo para o banco (apenas metadados)
                setSaveStage('prepare-db-payload')
	            const pageMetadata = project.pages.map((page, index) => {
                const metadata: any = {
                    id: page.id,
                    name: page.name,
                    width: page.width,
                    height: page.height,
                    type: page.type,
                    canvasDataPath: storagePaths[index] || page.canvasDataPath, // Caminho no Storage
                    thumbnailUrl: thumbnailUrls[index] || page.thumbnailUrl, // URL do thumbnail
                    // Timestamp do canvas no momento do save — permite detectar no reload
                    // se o arquivo Wasabi é mais antigo que o esperado (Wasabi upload falhou
                    // em um save posterior mas o DB manteve o canvasDataPath antigo).
                    canvasSavedAt: getCanvasSavedAt(page.canvasData) || Date.now()
                }

                return metadata
            })

	            let payload = {
	                name: project.name,
                // Armazenar apenas metadados, não o canvas completo
                canvas_data: pageMetadata,
	                preview_url: thumbnailUrls[0] || project.pages[0]?.thumbnailUrl
	            }
	            if (!Array.isArray(payload.canvas_data) || payload.canvas_data.length === 0) {
                    saveStatus.value = 'idle'
                    console.warn('[saveProjectDB] Save pulado: payload sem páginas válidas.')
                    return
                }
		            if (abortIfStaleSaveContext()) return

                    setSaveStage('prepare-request')
		            const headers = await getApiAuthHeaders()
                    const saveHeaders = {
                        ...headers,
                        ...(realtimeClientId.value ? { 'x-client-id': realtimeClientId.value } : {})
                    }
		            // 3. Salvar no banco
                const normalizedProjectId = String(project.id || '').trim()
                const shouldCreateProject = normalizedProjectId.startsWith('proj_') || !isUuid(normalizedProjectId)
                const persistProject = async (bodyPayload: any) => {
                    setSaveStage(shouldCreateProject ? 'persist-project:create' : 'persist-project:update')
                    // FIX: use AbortController so the request is truly cancelled on
                    // timeout — previously `timeout: 60_000` was a $fetch option that
                    // might not be supported by all $fetch versions (ofetch uses
                    // `signal` internally but the timeout implementation varies).
                    // Using an explicit AbortController guarantees the request is
                    // aborted and the promise rejects promptly.
                    const abortCtrl = new AbortController()
                    const abortTimer = setTimeout(() => abortCtrl.abort(), 45_000)
                    try {
                    if (shouldCreateProject) {
                        const response = await $fetch<any>('/api/projects', {
                            method: 'POST',
                            headers: saveHeaders,
                            body: bodyPayload,
                            signal: abortCtrl.signal
                        })

                        const created = response?.project || null
                        if (!created) throw new Error('Falha ao criar projeto no servidor')
                        if (created?.id) project.id = created.id
                        if (created?.updated_at) projectServerUpdatedAt.value = created.updated_at
                        return
                    }

                    const response = await $fetch<any>('/api/projects', {
                        method: 'POST',
                        headers: saveHeaders,
                        body: {
                            id: normalizedProjectId,
                            ...bodyPayload
                        },
                        signal: abortCtrl.signal
                    })
                    const updatedProject = response?.project || null
                    if (!updatedProject) {
                        saveStatus.value = 'error'
                        throw new Error('Falha ao atualizar projeto no servidor.')
                    }
                    projectServerUpdatedAt.value = String(updatedProject.updated_at || '')
                    } finally {
                        clearTimeout(abortTimer)
                    }
                }

                await persistProject(payload)

	                if (abortIfStaleSaveContext()) return
                    setSaveStage('finalize')
		            changedDuringSave = unsavedRevision.value !== saveRevisionAtStart
	            if (!changedDuringSave) {
                    const pagesWithNewLocalChangesDuringSave = new Set<string>()
                    saveNeedsFollowUpForLocalChanges = false
                    const unsyncedPageIds = new Set([
                        ...failedCanvasSyncPageIds,
                        ...pagesWithNewLocalChangesDuringSave
                    ])
	                const allPagesFullySynced = unsyncedPageIds.size === 0

	                project.pages.forEach((page) => {
	                    if (!unsyncedPageIds.has(page.id)) {
	                        page.dirty = false
                            if (!failedThumbnailSyncPageIds.has(page.id)) {
                                page.thumbnailDirty = false
                            }
	                        page.lastPersistedObjectCount = getCanvasObjectCount(page.canvasData)
	                        if (page.canvasData) {
	                            page.lastSavedFingerprint = computeCanvasFingerprint(page.canvasData)
	                        }
	                    }
	                })

	                // Limpar rascunhos apenas para páginas que foram salvas com sucesso.
	                // Passa o timestamp do save para proteger drafts mais recentes que
	                // possam ter sido escritos por emergencySnapshotDirtyPages durante
	                // navegação SPA (onUnmounted grava draft, save em background completa depois).
	                const saveCompletedAt = Date.now()
	                for (const p of project.pages) {
	                    if (p?.id && !unsyncedPageIds.has(p.id)) clearDraft(project.id, p.id, saveCompletedAt)
	                }

	                if (allPagesFullySynced) {
	                    _unsyncedRetryCount = 0 // Reset backoff on full sync
	                    hasUnsavedChanges.value = false
                        lastSavedAt.value = new Date()
	                    saveStatus.value = 'saved'
	                    clearProjectDraft(project.id)
                        if (failedThumbnailSyncPageIds.size > 0) {
                            console.warn(`[saveProjectDB] ${failedThumbnailSyncPageIds.size} thumbnail(s) não foram enviadas para a Wasabi; conteúdo do projeto foi salvo no banco.`)
                        }
	                } else {
	                    hasUnsavedChanges.value = true
	                    saveStatus.value = 'idle'
	                    console.warn(`[saveProjectDB] ${unsyncedPageIds.size} página(s) seguem pendentes; estado preservado para novo sync.`)
	                    // Auto-retry unsynced pages with exponential backoff.
	                    // Prevents the infinite retry loop when Wasabi is persistently
	                    // unreachable — previously the fixed 15s retry would fire
	                    // immediately after each 75s timeout, creating an aggressive
	                    // loop that spammed logs and never let the circuit breaker cool.
	                    _unsyncedRetryCount++
	                    const maxRetryBackoff = 5 * 60_000 // 5 minutos
	                    const retryCooldownMs = Math.min(15_000 * Math.pow(2, _unsyncedRetryCount - 1), maxRetryBackoff)
	                    console.log(`[saveProjectDB] Próximo retry de páginas pendentes em ${Math.round(retryCooldownMs / 1000)}s (tentativa ${_unsyncedRetryCount})`)
	                    const retryTimer = setTimeout(() => {
	                        _pendingSaveTimers.delete(retryTimer)
	                        if (_moduleDisposed) return
	                        if (!hasUnsavedChanges.value) return
	                        if (isSaving.value) return
	                        const hasDirtyPages = project.pages.some((p) => p?.dirty)
	                        if (!hasDirtyPages) return
	                        // Se o usuário está editando ativamente (últimos 30s), adiar o retry.
	                        // Evita mostrar "Salvando..." enquanto o usuário está trabalhando.
	                        // O auto-save periódico (90s) cuidará da persistência.
	                        if (Date.now() - _lastUserEditAt < 30_000) {
	                            console.log(`[saveProjectDB] Retry postergado: usuário editando ativamente.`)
	                            return
	                        }
	                        console.log(`🔄 Retentando upload de páginas pendentes (tentativa ${_unsyncedRetryCount})...`)
	                        void saveProjectDB()
	                    }, retryCooldownMs)
	                    _pendingSaveTimers.add(retryTimer)
	                }
	            } else {
	                hasUnsavedChanges.value = true
	                saveStatus.value = 'idle'
	                const now = Date.now()
	                if (now - lastSaveChangedDuringRunLogAt > 2500) {
	                    lastSaveChangedDuringRunLogAt = now
	                    console.info('[saveProjectDB] Mudanças detectadas durante o save; mantendo estado pendente para novo sync.')
	                }
	            }

		            console.log('Project Saved (Storage):', project.id)
		            saveSucceeded = true
		            // FIX: clear the error message on success — previously saveLastError
		            // was never reset, causing stale error messages to persist in the UI
		            // indefinitely after a subsequent successful save.
		            saveLastError.value = null
		            } catch (e) {
		                if (saveAbortedByContextSwitch) {
		                    saveStatus.value = 'idle'
		                } else {
		                    const statusCode = (e as any)?.statusCode ?? (e as any)?.response?.status ?? 0
		                    const statusMessage = (e as any)?.statusMessage ?? (e as any)?.data?.statusMessage ?? null
		                    const rawMessage = (e as any)?.message ?? null
		                    console.error('Save Failed:', { stage: currentSaveStage, statusCode, statusMessage, message: rawMessage, data: (e as any)?.data ?? null })
		                    // Monta mensagem amigável para exibir no toast
		                    if (Number(statusCode) === 401) {
		                        saveLastError.value = 'Sessão expirada. Faça login novamente.'
		                    } else if (Number(statusCode) === 429) {
		                        saveLastError.value = 'Muitas tentativas de salvar. Aguarde alguns segundos.'
		                    } else if (Number(statusCode) === 413) {
		                        saveLastError.value = 'Projeto muito grande para salvar. Tente reduzir o número de páginas.'
		                    } else if (statusMessage) {
		                        saveLastError.value = String(statusMessage).substring(0, 120)
		                    } else if (rawMessage) {
		                        saveLastError.value = String(rawMessage).substring(0, 120)
		                    } else {
		                        saveLastError.value = 'Falha ao salvar. Verifique sua conexão.'
		                    }
		                    saveStatus.value = 'error'
		                }
		            } finally {
                    setSaveStage('idle')
		            if (_saveWatchdog) { clearTimeout(_saveWatchdog); _saveWatchdog = null }
		            isSaving.value = false
		            // FIX: allow follow-up even when save didn't "succeed" (e.g. early return
		            // because no pages) — if someone queued a save while we held isSaving,
		            // we must honour that request regardless of whether THIS save produced
		            // data.  The previous condition `saveSucceeded && ...` silently dropped
		            // the queued save on early-return paths.
		            const shouldRunFollowUpSave = !saveAbortedByContextSwitch
		                && !_saveWatchdogFired
		                && (changedDuringSave || queuedSaveAfterCurrent.value || saveNeedsFollowUpForLocalChanges)
		            queuedSaveAfterCurrent.value = false
		            if (shouldRunFollowUpSave) {
	                const followUpTimer = setTimeout(() => {
	                    _pendingSaveTimers.delete(followUpTimer)
	                    if (_moduleDisposed) return
	                    if (!isSaving.value) {
	                        void saveProjectDB()
	                    }
	                }, 250)
	                _pendingSaveTimers.add(followUpTimer)
	            }
	        }
	    }

    /**
     * Auto-save com debounce
     * Salva automaticamente após período de inatividade
     */
    // NOTE: saveTimeout is tracked in _pendingSaveTimers for HMR cleanup.
    // When saveTimeout is cleared, also remove from _pendingSaveTimers.
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    let scheduledAutoSaveRevision = -1
    let scheduledAutoSaveProjectId = ''
    const AUTO_SAVE_DELAY = 90_000 // 90 segundos: debounce para upload remoto após ações do usuário

    const triggerAutoSave = () => {
        if (_moduleDisposed) return
        if (!project.id || project.id.startsWith('proj_')) {
            // Não auto-salvar projetos não criados ainda
            return
        }
        if (!hasUnsavedChanges.value && !project.pages.some((p) => p?.dirty)) {
            return
        }

        const currentRevision = unsavedRevision.value
        if (
            saveTimeout &&
            scheduledAutoSaveProjectId === project.id &&
            scheduledAutoSaveRevision === currentRevision
        ) {
            return
        }

        if (saveTimeout) { _pendingSaveTimers.delete(saveTimeout); clearTimeout(saveTimeout) }
        hasUnsavedChanges.value = true
        scheduledAutoSaveProjectId = project.id
        scheduledAutoSaveRevision = currentRevision

        saveTimeout = setTimeout(() => {
            if (saveTimeout) _pendingSaveTimers.delete(saveTimeout)
            saveTimeout = null
            scheduledAutoSaveRevision = -1
            scheduledAutoSaveProjectId = ''
            if (_moduleDisposed) return
            if (!hasUnsavedChanges.value && !project.pages.some((p) => p?.dirty)) return
            saveProjectDB()
        }, AUTO_SAVE_DELAY)
        _pendingSaveTimers.add(saveTimeout)
    }

    const cancelAutoSave = () => {
        if (saveTimeout) { _pendingSaveTimers.delete(saveTimeout); clearTimeout(saveTimeout) }
        saveTimeout = null
        scheduledAutoSaveRevision = -1
        scheduledAutoSaveProjectId = ''
    }

    const waitForSaveIdle = async (timeoutMs = 20_000): Promise<boolean> => {
        const start = Date.now()
        while (isSaving.value && (Date.now() - start) < timeoutMs) {
            await new Promise((resolve) => setTimeout(resolve, 80))
        }
        return !isSaving.value
    }

    /**
     * Força execução imediata do auto-save pendente.
     * Útil para eventos de lifecycle (reload/aba em background/fechar página).
     */
    const flushAutoSave = async () => {
        if (saveTimeout) { _pendingSaveTimers.delete(saveTimeout); clearTimeout(saveTimeout) }
        saveTimeout = null
        scheduledAutoSaveRevision = -1
        scheduledAutoSaveProjectId = ''
        flushPendingLocalDrafts()
        if (!hasUnsavedChanges.value && !project.pages.some((p) => p?.dirty)) return
        if (!project.id || project.id.startsWith('proj_')) return

        // If a save is already in flight, queue this flush and wait for completion.
        if (isSaving.value) {
            queuedSaveAfterCurrent.value = true
            const idle = await waitForSaveIdle()
            if (!idle) return
        }

        if (!hasUnsavedChanges.value && !project.pages.some((p) => p?.dirty)) return
        await saveProjectDB()

        // Ensure callers that depend on durability (e.g. mini editor save) only
        // continue when the current save cycle has settled.
        if (isSaving.value) {
            await waitForSaveIdle()
        }
    }

    /**
     * Carrega o projeto, buscando dados do Storage quando necessário
     */
	    const loadProjectDB = async (id: string) => {
	        // Não executar no servidor (SSR)
        if (import.meta.server) {
            return false
        }
        cancelAutoSave()
        flushPendingLocalDrafts()
        deferredCanvasPrefetchRunId += 1
        pageCanvasLoadPromises.clear()

        const currentSession = ++projectLoadSession.value
        isProjectLoaded.value = false
        projectServerUpdatedAt.value = null
        queuedSaveAfterCurrent.value = false
        unsavedRevision.value = 0
        project.pages = []
        project.activePageIndex = 0
        hasUnsavedChanges.value = false

        console.log('🔄 loadProjectDB iniciado para ID:', id)

        try {
            const headers = await getApiAuthHeaders()
            const data = await $fetch<any>('/api/projects', {
                headers,
                query: { id }
            })

            if (currentSession !== projectLoadSession.value) {
                console.warn('⏭️ loadProjectDB descartado por sessão mais nova')
                return false
            }

            if (!data) {
                console.log('❌ Projeto não encontrado:', id)
                return false
            }

            if (import.meta.dev) {
                const storedPagesPreview = Array.isArray(data.canvas_data)
                    ? data.canvas_data
                    : (Array.isArray((data.canvas_data as any)?.pages) ? (data.canvas_data as any).pages : [])
                console.log('📦 Dados do projeto carregados do banco:', {
                    id: data.id,
                    name: data.name,
                    canvasDataType: typeof data.canvas_data,
                    pages: storedPagesPreview.length
                })
            }

            project.id = data.id
            project.name = data.name
            projectServerUpdatedAt.value = data.updated_at || null

            // Verificar se os dados estão no novo formato (com caminhos do Storage)
            // Garantir que storedPages seja sempre um array válido
            let storedPages: any[] = []
            if (Array.isArray(data.canvas_data)) {
                storedPages = data.canvas_data
            } else if (data.canvas_data && typeof data.canvas_data === 'object') {
                // Pode ser um objeto com pages dentro
                if (Array.isArray((data.canvas_data as any).pages)) {
                    storedPages = (data.canvas_data as any).pages
                }
            }

            console.log('📄 Páginas armazenadas:', storedPages.length)

            // Carregar páginas: página ativa imediata, demais em paralelo ou sob demanda.
            project.pages = []
            let recoveredFromNewerDraft = false
            const recoveredDraftPages: string[] = []

            const loadedPageIds = new Set<string>()

            // Fase 1: Preparar todas as páginas (sync) e identificar quais precisam de hidratação
            interface PageLoadTask {
                page: Page
                pageMeta: any
                draft: DraftPayload | null
                shouldHydrateNow: boolean
                pageIndex: number
            }
            const pageLoadTasks: PageLoadTask[] = []

            for (const [pageIndex, pageMeta] of storedPages.entries()) {
                if (currentSession !== projectLoadSession.value) {
                    console.warn('⏭️ Carregamento de páginas interrompido por sessão mais nova')
                    return false
                }
                if (!pageMeta || typeof pageMeta !== 'object') continue
                const rawPageId = String((pageMeta as any).id || '').trim()
                const pageId = ensureUniquePageId(rawPageId, loadedPageIds)
                if (rawPageId !== pageId) {
                    console.warn(`[pages] ID de página normalizado durante loadProjectDB: "${rawPageId || '(vazio)'}" -> "${pageId}"`)
                }

                const draft = readDraft(data.id, pageId)
                const page: Page = {
                    id: pageId,
                    name: pageMeta.name,
                    width: pageMeta.width || 1080,
                    height: pageMeta.height || 1920,
                    type: pageMeta.type || 'RETAIL_OFFER',
                    canvasData: null,
                    canvasDataPath: pageMeta.canvasDataPath,
                    thumbnailUrl: typeof pageMeta.thumbnailUrl === 'string'
                        ? (pageMeta.thumbnailUrl.trim() || undefined)
                        : undefined,
                    lastLoadedFingerprint: 'deferred',
                    lastSavedFingerprint: 'deferred',
                    lastPersistedObjectCount: 0,
                    dirty: false
                }

                const shouldHydrateNow =
                    pageIndex === 0 ||
                    !!draft?.canvasData ||
                    !String(pageMeta?.canvasDataPath || '').trim()

                pageLoadTasks.push({ page, pageMeta, draft, shouldHydrateNow, pageIndex })
            }

            // Fase 2: Hidratar página ativa (index 0) primeiro, demais em paralelo
            const activeTask = pageLoadTasks.find(t => t.pageIndex === 0 && t.shouldHydrateNow)
            const otherHydrateTasks = pageLoadTasks.filter(t => t.shouldHydrateNow && t.pageIndex !== 0)

            // Página ativa: carregar imediatamente
            if (activeTask) {
                const resolved = await resolvePageCanvasState({
                    projectId: data.id,
                    pageId: activeTask.page.id,
                    pageMeta: activeTask.pageMeta,
                    draft: activeTask.draft
                })
                applyResolvedPageCanvasState(activeTask.page, resolved)
                if (resolved.needsRemoteSync) {
                    recoveredFromNewerDraft = true
                    recoveredDraftPages.push(activeTask.page.id)
                }
            }

            // Adicionar TODAS as páginas na ordem correta (antes de hidratar as demais)
            for (const task of pageLoadTasks) {
                project.pages.push(task.page)
            }

            // Demais páginas que precisam hidratação: carregar em paralelo (não bloquear a UI)
            if (otherHydrateTasks.length > 0) {
                const hydrationPromises = otherHydrateTasks.map(async (task) => {
                    try {
                        const resolved = await resolvePageCanvasState({
                            projectId: data.id,
                            pageId: task.page.id,
                            pageMeta: task.pageMeta,
                            draft: task.draft
                        })
                        applyResolvedPageCanvasState(task.page, resolved)
                        if (resolved.needsRemoteSync) {
                            recoveredFromNewerDraft = true
                            recoveredDraftPages.push(task.page.id)
                        }
                    } catch (err) {
                        console.warn(`⚠️ Falha ao hidratar página ${task.page.id}:`, err)
                    }
                })
                // Não bloquear: executar em background
                void Promise.all(hydrationPromises)
            }

            for (const task of pageLoadTasks) {
                console.log('✅ Página adicionada:', { id: task.page.id, name: task.page.name, hasCanvasData: !!task.page.canvasData })
            }

            // Se não tem páginas, inicializar
            if (project.pages.length === 0) initProject()
            normalizeProjectPageIds(project.pages as any[], 'loadProjectDB:final')

	            project.activePageIndex = 0
	            hasUnsavedChanges.value = recoveredFromNewerDraft
	            if (recoveredFromNewerDraft) {
	                unsavedRevision.value = Math.max(unsavedRevision.value, 1)
	            }
	            saveStatus.value = recoveredFromNewerDraft ? 'idle' : 'saved'
	            isProjectLoaded.value = true // Marca que o projeto foi carregado

            if (recoveredFromNewerDraft && !project.id.startsWith('proj_')) {
                console.warn('📝 Projeto restaurado com rascunho local mais novo; agendando persistência remota Wasabi-first.', {
                    pages: recoveredDraftPages
                })
                const scheduleRecoveredDraftRemoteSync = (attempt = 1) => {
                    const remoteSyncTimer = setTimeout(() => {
                        _pendingSaveTimers.delete(remoteSyncTimer)
                        if (_moduleDisposed) return
                        if (currentSession !== projectLoadSession.value) return
                        if (isSaving.value) return

                        const pendingRecoveredPages = project.pages.filter((page) =>
                            recoveredDraftPages.includes(String(page?.id || '')) &&
                            !!page?.dirty
                        )
                        const pagesWaitingForSnapshot = pendingRecoveredPages.filter((page) =>
                            !!page?.canvasData && !hasUsableSerializedCanvasSnapshot(page)
                        )

                        if (pagesWaitingForSnapshot.length > 0 && attempt < 10) {
                            console.log(
                                `⏳ Aguardando snapshot serializado para sync Wasabi do rascunho recuperado ` +
                                `(tentativa ${attempt}, páginas=${pagesWaitingForSnapshot.map((p) => p.id).join(', ')})`
                            )
                            scheduleRecoveredDraftRemoteSync(attempt + 1)
                            return
                        }

                        console.log('📤 Agendando upload Wasabi do rascunho recuperado')
                        void saveProjectDB()
                    }, 3000)
                    _pendingSaveTimers.add(remoteSyncTimer)
                }

                scheduleRecoveredDraftRemoteSync()
            }

            scheduleCanvasDataPrefetch(project.pages[project.activePageIndex]?.id || null)

            console.log('✅ Projeto carregado com sucesso:', { pagesCount: project.pages.length, activePageHasData: !!project.pages[0]?.canvasData })
            return true
        } catch (e) {
            if (currentSession !== projectLoadSession.value) {
                console.warn('⏭️ Ignorando erro de sessão antiga no loadProjectDB')
                return false
            }
            console.error('❌ Load Failed:', e)
            // Offline-safe fallback: restore from local project draft if present.
            const local = readProjectDraft(id)
            if (local?.project?.pages?.length) {
                console.log('📝 Restaurando projeto do rascunho local (offline fallback):', id)
                project.id = local.project.id || id
                project.name = local.project.name || project.name
                project.pages = hydratePagesFromProjectDraft(project.id, local.project.pages || []).map((page) => ({
                    ...page,
                    dirty: true
                }))
                normalizeProjectPageIds(project.pages as any[], 'loadProjectDB:offline-fallback')
	                project.activePageIndex = local.project.activePageIndex || 0
	                hasUnsavedChanges.value = true
	                unsavedRevision.value = Math.max(unsavedRevision.value, 1)
	                saveStatus.value = 'error'
	                isProjectLoaded.value = true
	                return true
            }
            saveStatus.value = 'error'
            return false
        }
    }

    /**
     * Deleta o projeto e todos os arquivos do Storage
     */
    const deleteProjectDB = async (id: string) => {
        try {
            // Primeiro deletar arquivos do Storage
            await deleteProjectFiles(id)

            // Depois deletar do banco
            const headers = await getApiAuthHeaders()
            const requestHeaders = {
                ...headers,
                ...(realtimeClientId.value ? { 'x-client-id': realtimeClientId.value } : {})
            }
            await $fetch('/api/projects', {
                method: 'DELETE',
                headers: requestHeaders,
                query: { id }
            })

            return true
        } catch (e) {
            console.error('Delete Failed:', e)
            return false
        }
    }

    // Snapshot de emergência: grava o canvasData atual de TODAS as páginas dirty
    // diretamente no localStorage (mesma key do draft normal via getDraftKey).
    // Chamado no beforeunload/visibilitychange como rede de segurança caso o draft
    // normal não tenha sido gravado (canvas muito grande para LOCAL_DRAFT_MAX_ENTRY_BYTES,
    // pending queue já foi flushed, etc.).
    // Usa um limite mais generoso (~5.2 MB vs 4.5 MB normal) para cobrir canvas grandes.
    const EMERGENCY_DRAFT_MAX_BYTES = 5_200_000
    let _lastEmergencySnapshotAt = 0
    const emergencySnapshotDirtyPages = () => {
        if (import.meta.server) return
        if (!project.id || project.id.startsWith('proj_')) return
        // Debounce: se já rodou nos últimos 500ms (triple-fire em exit), pular.
        const now = Date.now()
        if (now - _lastEmergencySnapshotAt < 500) return
        _lastEmergencySnapshotAt = now
        try {
            for (const page of project.pages) {
                if (!page?.id || !page?.canvasData || !page?.dirty) continue
                const draftKey = getDraftKey(project.id, page.id)
                // Se já existe um draft pending, o flushPendingLocalDrafts já vai gravá-lo
                if (pendingLocalDraftOperations.has(draftKey)) continue
                const payload: DraftPayload = { updatedAt: now, canvasData: page.canvasData }
                try {
                    const json = JSON.stringify(payload)
                    if (json.length <= EMERGENCY_DRAFT_MAX_BYTES) {
                        localStorage.setItem(draftKey, json)
                    }
                } catch { /* ignore quota errors */ }
            }
        } catch { /* ignore */ }
    }

    return {
        project,
        activePage,
        initProject,
        addPage,
        switchPage,
        updatePageData,
        updatePageThumbnail,
        duplicatePage,
        deletePage,
        renamePage,
        resizePage,
        saveProjectDB,
        triggerAutoSave,
        cancelAutoSave,
        flushAutoSave,
        flushPendingLocalDrafts,
        emergencySnapshotDirtyPages,
        ensurePageCanvasDataLoaded,
        scheduleCanvasDataPrefetch,
        loadProjectDB,
        deleteProjectDB,
        isSaving,
		        saveStatus,
		        saveLastError,
                saveDebugStage,
		        lastSavedAt,
		        hasUnsavedChanges,
		        isProjectLoaded,
	        localDraftQuotaWarning,
	        projectServerUpdatedAt,
	        realtimeClientId
	    }
	}

// HMR: quando o Vite substitui este módulo em desenvolvimento, os timers pendentes
// da instância anterior continuam rodando com estado antigo (isSaving, hasUnsavedChanges),
// causando múltiplos saveProjectDB simultâneos. O dispose reseta o estado compartilhado
// para que a nova instância comece limpa e as instâncias antigas parem de interferir.
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        // Marcar módulo como descartado — impede TODOS os timers e async pendentes
        // desta instância de disparar saveProjectDB novamente.
        _moduleDisposed = true

        // Cancelar TODOS os timers de save (retry, follow-up, recovery remoto)
        for (const timer of _pendingSaveTimers) clearTimeout(timer)
        _pendingSaveTimers.clear()

        // Cancelar timer de draft pendente
        if (pendingLocalDraftFlushTimer) {
            clearTimeout(pendingLocalDraftFlushTimer)
            pendingLocalDraftFlushTimer = null
        }
        if (pendingLocalDraftFlushIdleId) {
            cancelIdleCallback(pendingLocalDraftFlushIdleId)
            pendingLocalDraftFlushIdleId = null
        }
        // Resetar estado de save para evitar que a nova instância veja isSaving=true
        isSaving.value = false
        queuedSaveAfterCurrent.value = false
        hasUnsavedChanges.value = false
        isProjectLoaded.value = false
        _unsyncedRetryCount = 0
    })
}
