import { reactive, ref, computed, watch } from 'vue'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

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
const lastSavedAt = ref<Date | null>(null)
const hasUnsavedChanges = ref(false)
const isProjectLoaded = ref(false) // Flag para indicar quando o projeto foi carregado do banco
const unsavedRevision = ref(0)
const queuedSaveAfterCurrent = ref(false)

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
type ProjectDraftPayload = { updatedAt: number; project: { id: string; name: string; pages: Page[]; activePageIndex: number } }

const hashString = (input: string): string => {
    let hash = 5381
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i)
        hash |= 0
    }
    return `h${(hash >>> 0).toString(16)}`
}

const makePageId = (): string => Math.random().toString(36).substr(2, 9)

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

const computeCanvasFingerprint = (canvasData: any): string => {
    try {
        if (!canvasData || typeof canvasData !== 'object') return 'empty'
        return hashString(JSON.stringify(canvasData))
    } catch {
        return `fallback:${getCanvasObjectCount(canvasData)}:${getCanvasSavedAt(canvasData)}`
    }
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

const readDraft = (projectId: string, pageId: string): DraftPayload | null => {
    if (import.meta.server) return null
    try {
        const raw = localStorage.getItem(getDraftKey(projectId, pageId))
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        if (typeof parsed.updatedAt !== 'number' || !('canvasData' in parsed)) return null
        return parsed as DraftPayload
    } catch {
        return null
    }
}
const writeDraft = (projectId: string, pageId: string, canvasData: any) => {
    if (import.meta.server) return
    try {
        const payload: DraftPayload = { updatedAt: Date.now(), canvasData }
        localStorage.setItem(getDraftKey(projectId, pageId), JSON.stringify(payload))
    } catch {
        // ignore quota / serialization issues
    }
}
const clearDraft = (projectId: string, pageId: string) => {
    if (import.meta.server) return
    try {
        localStorage.removeItem(getDraftKey(projectId, pageId))
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
    // if local draft is newer than remote payload, prefer local draft and resync.
    const draftIsNewer = draftTs > 0 && (remoteTs === 0 || draftTs > (remoteTs + 1500))
    if (draftIsNewer) {
        return { canvasData: draftData, source: 'draft-newer-than-remote', needsRemoteSync: true as const }
    }

    return { canvasData: remoteData, source: 'remote-newer-than-draft', needsRemoteSync: false as const }
}

const readProjectDraft = (projectId: string): ProjectDraftPayload | null => {
    if (import.meta.server) return null
    try {
        const raw = localStorage.getItem(getProjectDraftKey(projectId))
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        if (typeof parsed.updatedAt !== 'number' || !parsed.project) return null
        return parsed as ProjectDraftPayload
    } catch {
        return null
    }
}

const writeProjectDraft = () => {
    if (import.meta.server) return
    try {
        if (!project.id) return
        const payload: ProjectDraftPayload = {
            updatedAt: Date.now(),
            project: {
                id: project.id,
                name: project.name,
                pages: JSON.parse(JSON.stringify(project.pages)),
                activePageIndex: project.activePageIndex
            }
        }
        localStorage.setItem(getProjectDraftKey(project.id), JSON.stringify(payload))
    } catch {
        // ignore
    }
}

const clearProjectDraft = (projectId: string) => {
    if (import.meta.server) return
    try {
        localStorage.removeItem(getProjectDraftKey(projectId))
    } catch {
        // ignore
    }
}

export const useProject = () => {
    const { getApiAuthHeaders } = useApiAuth()
    const { saveCanvasData, saveThumbnail, loadCanvasData, loadCanvasDataFromPath, recoverLatestNonEmptyCanvasData, deleteProjectFiles, saveStatus: storageSaveStatus } = useStorage()
    const projectServerUpdatedAt = ref<string | null>(null)
    const projectLoadSession = ref(0)

    const activePage = computed(() => project.pages[project.activePageIndex])

    // Watch storage save status
    watch(storageSaveStatus, (status) => {
        saveStatus.value = status
    })

    const initProject = () => {
        if (project.pages.length === 0) {
            // Offline-safe: restore last local draft for the default (unsaved) project.
            // Without this, `proj_default` would lose all edits (including sticker outline) on reload.
            const local = readProjectDraft(project.id)
            if (local?.project?.pages?.length) {
                try {
                    project.id = local.project.id || project.id
                    project.name = local.project.name || project.name
                    project.pages = local.project.pages || []
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
        if (project.pages[index]) {
            project.pages[index].thumbnail = dataUrl
            markAsUnsaved()
            writeProjectDraft()
        }
    }

    type UpdatePageDataOptions = {
        markUnsaved?: boolean
        source?: 'user' | 'system'
        skipIfSameFingerprint?: boolean
    }

    const updatePageData = (index: number, json: any, opts: UpdatePageDataOptions = {}) => {
        if (project.pages[index]) {
            const stampedJson = (json && typeof json === 'object')
                ? { ...json, __savedAt: Date.now() }
                : json
            const fingerprint = computeCanvasFingerprint(stampedJson)
            if (opts.skipIfSameFingerprint && project.pages[index].lastSavedFingerprint === fingerprint) {
                return false
            }
            const objectCount = stampedJson?.objects?.length || 0;
            console.log(`💾 updatePageData: salvando ${objectCount} objeto(s) na página ${index} (${project.pages[index].id})`);
            
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
            } else {
                console.log(`✅ updatePageData: ${savedObjectCount} objeto(s) salvos corretamente`);
            }
            
            const shouldMarkUnsaved = opts.markUnsaved ?? (opts.source !== 'system')
            if (shouldMarkUnsaved) markAsUnsaved()
            // Also persist a local draft to survive reloads/offline.
            const p = project.pages[index]
            if (p?.id && project.id) {
                writeDraft(project.id, p.id, stampedJson)
                console.log(`📝 Draft local salvo para página ${p.id}`);
            }
            writeProjectDraft()
            return true
        } else {
            console.error(`❌ updatePageData: página ${index} não existe!`);
            return false
        }
    }

    const markAsUnsaved = () => {
        hasUnsavedChanges.value = true
        unsavedRevision.value += 1
    }

    // --- A Regra de Ouro: Smart Duplicate ---
    const duplicatePage = (index: number) => {
        const sourcePage = project.pages[index]
        if (!sourcePage || !sourcePage.canvasData) return

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
     * Salva o projeto usando Supabase Storage para os dados pesados
     * O banco armazena apenas metadados e caminhos para os arquivos
     */
	    const saveProjectDB = async (opts: { forceEmptyOverwrite?: boolean } = {}) => {
	        // Não executar no servidor (SSR)
	        if (import.meta.server) {
	            return
	        }

	        // Prevent concurrent saves from racing and tripping optimistic concurrency on ourselves.
	        if (isSaving.value) {
	            queuedSaveAfterCurrent.value = true
	            console.warn('[saveProjectDB] Save já em andamento; enfileirando novo save após conclusão.')
	            return
	        }

	        isSaving.value = true
	        saveStatus.value = 'saving'
	        const saveRevisionAtStart = unsavedRevision.value
	        const saveLoadSessionAtStart = projectLoadSession.value
	        let saveSucceeded = false
	        let changedDuringSave = false
	        let saveAbortedByContextSwitch = false
	        const abortIfStaleSaveContext = (): boolean => {
	            if (saveLoadSessionAtStart === projectLoadSession.value) return false
	            saveAbortedByContextSwitch = true
	            saveStatus.value = 'idle'
	            console.warn('[saveProjectDB] Save abortado: contexto do projeto mudou durante a gravação.')
	            return true
	        }

	        try {
	            normalizeProjectPageIds(project.pages as any[], 'saveProjectDB:preflight')
	            if (abortIfStaleSaveContext()) return
	                const isUnsafeEmptyOverwrite = (page: Page): boolean => {
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
	                saveStatus.value = 'error'
	                console.error('🛑 Bloqueando save remoto para evitar overwrite vazio em páginas persistidas:', unsafeEmptyPages.map((p) => ({
	                    pageId: p.id,
	                    persistedCount: p.lastPersistedObjectCount || 0,
	                    currentCount: getCanvasObjectCount(p.canvasData),
                        dirty: !!p.dirty
	                })))
	                return
	            }

            // 1. Salvar cada página no Storage
            const storagePaths: string[] = []
            const thumbnailUrls: string[] = []

	            for (const [i, page] of project.pages.entries()) {
	                if (abortIfStaleSaveContext()) return

	                // Salvar canvas JSON no Storage (com retry automático)
		                if (page?.canvasData) {
	                    try {
	                        const currentCount = getCanvasObjectCount(page.canvasData)
	                        const persistedCount = Number(page?.lastPersistedObjectCount || 0)
	                        if (isUnsafeEmptyOverwrite(page) && !opts.forceEmptyOverwrite) {
	                            console.warn(`🛡️ Skip upload vazio para página ${page.id} (persistido=${persistedCount}, atual=${currentCount})`)
	                            continue
	                        }
                        // Tentar salvar na Contabo (com retry interno)
	                        const path = await saveCanvasData(project.id, page.id, page.canvasData, 3)
	                        if (abortIfStaleSaveContext()) return
	                        if (path) {
                            storagePaths[i] = path
                            page.canvasDataPath = path
                            page.lastPersistedObjectCount = currentCount
                            console.log('✅ Canvas salvo na Contabo:', path)
                        } else {
                            // Se falhou após todas as tentativas, o draft local já está salvo
                            console.warn(`⚠️ Falha ao salvar canvas na Contabo após múltiplas tentativas (página ${page.id})`)
                            console.warn('   ✅ Draft local foi salvo automaticamente - dados não foram perdidos')
                            // Não lançar erro aqui - continuar salvando outras páginas
                        }
                    } catch (err: any) {
                        console.error('❌ Erro crítico ao salvar canvas na Contabo:', err)
                        console.error('   ✅ Draft local foi salvo automaticamente - dados não foram perdidos')
                        // Não lançar erro - continuar com outras páginas
                    }
                }

                // Salvar thumbnail no Storage
	                if (page?.thumbnail) {
	                    const url = await saveThumbnail(project.id, page.id, page.thumbnail)
	                    if (abortIfStaleSaveContext()) return
	                    if (url) {
                        thumbnailUrls[i] = url
                        page.thumbnailUrl = url
                    }
                }
            }

            // 2. Preparar payload mínimo para o banco (apenas metadados)
	            const pageMetadata = project.pages.map((page, index) => {
                const metadata: any = {
                    id: page.id,
                    name: page.name,
                    width: page.width,
                    height: page.height,
                    type: page.type,
                    canvasDataPath: storagePaths[index] || page.canvasDataPath, // Caminho no Storage
                    thumbnailUrl: thumbnailUrls[index] || page.thumbnailUrl // URL do thumbnail
                }

                // CRITICAL: SEMPRE incluir canvasData no banco como backup
                // Mesmo quando temos storagePath, mantemos canvasData para garantir
                // que os dados nunca sejam perdidos se o Storage falhar
	                if (page.canvasData) {
	                    const currentCount = getCanvasObjectCount(page.canvasData)
	                    const persistedCount = Number(page?.lastPersistedObjectCount || 0)
	                    const shouldBlockEmptyBackup = isUnsafeEmptyOverwrite(page) && !opts.forceEmptyOverwrite
	                    if (shouldBlockEmptyBackup) {
	                        console.warn(`🛡️ Bloqueando backup vazio no DB para página ${page.id} (persistido=${persistedCount}, atual=${currentCount})`)
	                    } else {
                        metadata.canvasData = page.canvasData
                        console.log(`💾 Incluindo canvasData no banco para página ${page.id} (${currentCount} objetos)`)
                    }
                }

                return metadata
            })

	            const payload = {
	                name: project.name,
                // Armazenar apenas metadados, não o canvas completo
                canvas_data: pageMetadata,
	                preview_url: thumbnailUrls[0] || project.pages[0]?.thumbnailUrl
	            }
	            if (abortIfStaleSaveContext()) return

		            const headers = await getApiAuthHeaders()
		            // 3. Salvar no banco
	            if (project.id.startsWith('proj_')) {
                const response = await $fetch<any>('/api/projects', {
                    method: 'POST',
                    headers,
                    body: payload
                })
                if (abortIfStaleSaveContext()) return

                const created = response?.project || null
                if (!created) throw new Error('Falha ao criar projeto no servidor')
                if (created?.id) project.id = created.id
                if (created?.updated_at) projectServerUpdatedAt.value = created.updated_at
	            } else {
	                const response = await $fetch<any>('/api/projects', {
	                    method: 'POST',
	                    headers,
	                    body: {
                          id: project.id,
                          ...payload
                        }
	                })
	                if (abortIfStaleSaveContext()) return
	                const updatedProject = response?.project || null
	                if (!updatedProject) {
	                    saveStatus.value = 'error'
	                    throw new Error('Falha ao atualizar projeto no servidor.')
	                }
		                projectServerUpdatedAt.value = String(updatedProject.updated_at || '')
		            }

		            if (abortIfStaleSaveContext()) return
		            changedDuringSave = unsavedRevision.value !== saveRevisionAtStart
		            lastSavedAt.value = new Date()
	            if (!changedDuringSave) {
	                hasUnsavedChanges.value = false
	                saveStatus.value = 'saved'
	                project.pages.forEach((page) => {
	                    page.dirty = false
	                    page.lastPersistedObjectCount = getCanvasObjectCount(page.canvasData)
	                    if (page.canvasData) {
	                        page.lastSavedFingerprint = computeCanvasFingerprint(page.canvasData)
	                    }
	                })

	                // Clear local drafts only when nothing changed during this save.
	                for (const p of project.pages) {
	                    if (p?.id) clearDraft(project.id, p.id)
	                }
	                clearProjectDraft(project.id)
	            } else {
	                hasUnsavedChanges.value = true
	                saveStatus.value = 'idle'
	                console.warn('[saveProjectDB] Mudanças detectadas durante o save; mantendo estado pendente para novo sync.')
	            }

		            console.log('Project Saved (Storage):', project.id)
		            saveSucceeded = true
		        } catch (e) {
		            if (saveAbortedByContextSwitch) {
		                saveStatus.value = 'idle'
		            } else {
		                console.error('Save Failed:', e)
		                saveStatus.value = 'error'
		            }
		        } finally {
		            isSaving.value = false
		            const shouldRunFollowUpSave = !saveAbortedByContextSwitch && saveSucceeded && (changedDuringSave || queuedSaveAfterCurrent.value)
		            queuedSaveAfterCurrent.value = false
		            if (shouldRunFollowUpSave) {
	                setTimeout(() => {
	                    if (!isSaving.value) {
	                        void saveProjectDB()
	                    }
	                }, 250)
	            }
	        }
	    }

    /**
     * Auto-save com debounce
     * Salva automaticamente após período de inatividade
     */
    let saveTimeout: any = null
    const AUTO_SAVE_DELAY = 6000 // 6 segundos (menos pressão de I/O durante edição intensa)

    const triggerAutoSave = () => {
        if (!project.id || project.id.startsWith('proj_')) {
            // Não auto-salvar projetos não criados ainda
            return
        }
        if (!hasUnsavedChanges.value && !project.pages.some((p) => p?.dirty)) {
            return
        }

        clearTimeout(saveTimeout)
        hasUnsavedChanges.value = true

        saveTimeout = setTimeout(() => {
            saveProjectDB()
        }, AUTO_SAVE_DELAY)
    }

    const cancelAutoSave = () => {
        clearTimeout(saveTimeout)
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
        clearTimeout(saveTimeout)
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

            console.log('📦 Dados do projeto carregados do banco:', { id: data.id, name: data.name, canvasDataType: typeof data.canvas_data })
            console.log('📦 canvas_data preview:', JSON.stringify(data.canvas_data).substring(0, 500))

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

            // Carregar cada página
            project.pages = []
            let recoveredFromNewerDraft = false
            const recoveredDraftPages: string[] = []

            const loadedPageIds = new Set<string>()
            for (const pageMeta of storedPages) {
                if (currentSession !== projectLoadSession.value) {
                    console.warn('⏭️ Carregamento de páginas interrompido por sessão mais nova')
                    return false
                }
                // Pular se pageMeta não for um objeto válido
                if (!pageMeta || typeof pageMeta !== 'object') continue
                const rawPageId = String((pageMeta as any).id || '').trim()
                const pageId = ensureUniquePageId(rawPageId, loadedPageIds)
                if (rawPageId !== pageId) {
                    console.warn(`[pages] ID de página normalizado durante loadProjectDB: "${rawPageId || '(vazio)'}" -> "${pageId}"`)
                }

                let canvasData = null
                let serverCanvasData = null
                const dbCanvasData = (pageMeta as any).canvasData || null

                // Prefer Storage as the source of truth (DB canvasData is a backup and can get stale).
                if (pageMeta.canvasDataPath) {
                    console.log('📥 Buscando canvasData do Storage:', pageMeta.canvasDataPath)
                    serverCanvasData = await loadCanvasDataFromPath(pageMeta.canvasDataPath)
                    if (serverCanvasData) {
                        const objectCount = serverCanvasData?.objects?.length || 0
                        console.log('✅ CanvasData carregado do Storage:', { hasData: !!serverCanvasData, objectCount })
                    } else {
                        console.warn('⚠️ CanvasData não encontrado no Storage')
                    }
                }

                const serverCountBeforeRecovery = getCanvasObjectCount(serverCanvasData)
                const dbCountBeforeRecovery = getCanvasObjectCount(dbCanvasData)
                if (pageMeta.canvasDataPath && serverCountBeforeRecovery === 0 && dbCountBeforeRecovery === 0) {
                    const recovered = await recoverLatestNonEmptyCanvasData({
                        projectId: data.id,
                        pageId,
                        preferredKey: pageMeta.canvasDataPath
                    })
                    if (recovered?.json) {
                        serverCanvasData = recovered.json
                        pageMeta.canvasDataPath = recovered.key
                        console.warn(`🛟 Recovery automático aplicado para página ${pageId}: ${recovered.objectCount} objetos`)
                    }
                }

                const bestRemote = pickBestRemoteCanvasData(serverCanvasData, dbCanvasData)
                serverCanvasData = bestRemote.data
                if (bestRemote.source !== 'none') {
                    const objectCount = serverCanvasData?.objects?.length || 0
                    console.log(`📦 CanvasData remoto selecionado: ${bestRemote.source} (${objectCount} objetos)`)
                }

                // Offline-safe: comparar rascunho local vs remoto e preservar o mais novo.
                const draft = readDraft(data.id, pageId)
                if (draft?.canvasData) {
                    const draftObjectCount = getCanvasObjectCount(draft.canvasData)
                    const draftAge = Date.now() - Number(draft.updatedAt || 0)
                    const draftAgeMin = Math.floor(draftAge / 60000)
                    const remoteObjectCount = getCanvasObjectCount(serverCanvasData)
                    console.log(`📝 Draft encontrado para página ${pageId}: ${draftObjectCount} objetos (idade: ${draftAgeMin}min)`)
                    console.log(`📝 Remoto tem: ${remoteObjectCount} objetos`)
                }

                const draftDecision = resolveCanvasDataWithDraft({
                    projectId: data.id,
                    pageId,
                    remoteCanvasData: serverCanvasData,
                    draft
                })
                canvasData = draftDecision.canvasData

                if (draftDecision.needsRemoteSync) {
                    recoveredFromNewerDraft = true
                    recoveredDraftPages.push(pageId)
                }
                console.log(`📦 Fonte final da página ${pageId}: ${draftDecision.source}`)

                // Validação final: garantir que temos dados válidos
                if (canvasData) {
                    const finalObjectCount = canvasData?.objects?.length || 0
                    if (finalObjectCount > 0) {
                        console.log(`✅ CanvasData final para página ${pageId}: ${finalObjectCount} objeto(s)`)
                    }
                }
                // Nota: Páginas novas podem não ter canvasData ainda, isso é normal

                const finalObjectCount = getCanvasObjectCount(canvasData)
                const finalFingerprint = computeCanvasFingerprint(canvasData)

                const page: Page = {
                        id: pageId,
                    name: pageMeta.name,
                    width: pageMeta.width || 1080,
                    height: pageMeta.height || 1920,
                    type: pageMeta.type || 'RETAIL_OFFER',
                    canvasData,
                    canvasDataPath: pageMeta.canvasDataPath,
                    thumbnailUrl: toWasabiProxyUrl(pageMeta.thumbnailUrl) || undefined,
                    lastLoadedFingerprint: finalFingerprint,
                    lastSavedFingerprint: finalFingerprint,
                    lastPersistedObjectCount: finalObjectCount,
                    dirty: false
                }

                project.pages.push(page)
                console.log('✅ Página adicionada:', { id: page.id, name: page.name, hasCanvasData: !!page.canvasData })
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
                console.warn('📝 Projeto restaurado com rascunho local mais novo; agendando re-sync remoto.', {
                    pages: recoveredDraftPages
                })
                setTimeout(() => {
                    if (currentSession !== projectLoadSession.value) return
                    triggerAutoSave()
                }, 400)
            }

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
                project.pages = (local.project.pages || []).map((page) => {
                    const fp = computeCanvasFingerprint(page?.canvasData)
                    return {
                        ...page,
                        lastLoadedFingerprint: fp,
                        lastSavedFingerprint: fp,
                        lastPersistedObjectCount: getCanvasObjectCount(page?.canvasData),
                        dirty: true
                    } as Page
                })
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
            await $fetch('/api/projects', {
                method: 'DELETE',
                headers,
                query: { id }
            })

            return true
        } catch (e) {
            console.error('Delete Failed:', e)
            return false
        }
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
        loadProjectDB,
        deleteProjectDB,
        isSaving,
        saveStatus,
        lastSavedAt,
        hasUnsavedChanges,
        isProjectLoaded
    }
}
