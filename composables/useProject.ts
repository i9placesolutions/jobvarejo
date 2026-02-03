import { reactive, ref, computed, watch } from 'vue'

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
    const supabase = useSupabase()
    const { saveCanvasData, saveThumbnail, loadCanvasData, loadCanvasDataFromPath, deleteProjectFiles, saveStatus: storageSaveStatus } = useStorage()

    const activePage = computed(() => project.pages[project.activePageIndex])

    // Watch storage save status
    watch(storageSaveStatus, (status) => {
        saveStatus.value = status
    })

    const initProject = () => {
        if (project.pages.length === 0) {
            // Cria página inicial padrão (Story)
            addPage('RETAIL_OFFER', 1080, 1920, 'Capa Story')
        }
    }

    const addPage = (type: 'RETAIL_OFFER' | 'FREE_DESIGN', width: number, height: number, name?: string) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newPage: Page = {
            id,
            name: name || `Página ${project.pages.length + 1}`,
            width,
            height,
            type,
            canvasData: null, // Começa vazio
            canvasDataPath: undefined
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

    const updatePageData = (index: number, json: any) => {
        if (project.pages[index]) {
            const objectCount = json?.objects?.length || 0;
            console.log(`💾 updatePageData: salvando ${objectCount} objeto(s) na página ${index} (${project.pages[index].id})`);
            
            project.pages[index].canvasData = json
            
            // Verificar se foi salvo corretamente
            const savedObjectCount = project.pages[index].canvasData?.objects?.length || 0;
            if (savedObjectCount !== objectCount) {
                console.error(`❌ PROBLEMA: Salvamos ${objectCount} objetos mas página tem ${savedObjectCount}`);
            } else {
                console.log(`✅ updatePageData: ${savedObjectCount} objeto(s) salvos corretamente`);
            }
            
            markAsUnsaved()
            // Also persist a local draft to survive reloads/offline.
            const p = project.pages[index]
            if (p?.id && project.id) {
                writeDraft(project.id, p.id, json)
                console.log(`📝 Draft local salvo para página ${p.id}`);
            }
            writeProjectDraft()
        } else {
            console.error(`❌ updatePageData: página ${index} não existe!`);
        }
    }

    const markAsUnsaved = () => {
        hasUnsavedChanges.value = true
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
        const newPage: Page = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${sourcePage.name} (Cópia)`,
            width: sourcePage.width,
            height: sourcePage.height,
            type: sourcePage.type,
            canvasData: clonedJson,
            thumbnail: sourcePage.thumbnail
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
    const saveProjectDB = async () => {
        // Não executar no servidor (SSR)
        if (import.meta.server) {
            return
        }

        isSaving.value = true
        saveStatus.value = 'saving'

        try {
            const supabase = useSupabase()

            // 1. Salvar cada página no Storage
            const storagePaths: string[] = []
            const thumbnailUrls: string[] = []

            for (let i = 0; i < project.pages.length; i++) {
                const page = project.pages[i]

                // Salvar canvas JSON no Storage (com retry automático)
                if (page.canvasData) {
                    try {
                        // Tentar salvar na Contabo (com retry interno)
                        const path = await saveCanvasData(project.id, page.id, page.canvasData, 3)
                        if (path) {
                            storagePaths[i] = path
                            page.canvasDataPath = path
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
                if (page.thumbnail) {
                    const url = await saveThumbnail(project.id, page.id, page.thumbnail)
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
                    metadata.canvasData = page.canvasData
                    console.log(`💾 Incluindo canvasData no banco para página ${page.id} (${page.canvasData?.objects?.length || 0} objetos)`)
                }

                return metadata
            })

            const payload = {
                name: project.name,
                // Armazenar apenas metadados, não o canvas completo
                canvas_data: pageMetadata,
                preview_url: thumbnailUrls[0] || project.pages[0]?.thumbnailUrl
            }

            // 3. Salvar no banco
            if (project.id.startsWith('proj_')) {
                // Create new project
                const { data, error } = await supabase
                    .from('projects')
                    .insert(payload)
                    .select()
                    .single()

                if (error) throw error
                if (data?.id) project.id = data.id
            } else {
                // Update existing project
                const { error } = await supabase
                    .from('projects')
                    .update(payload)
                    .eq('id', project.id)

                if (error) throw error
            }

            lastSavedAt.value = new Date()
            hasUnsavedChanges.value = false
            saveStatus.value = 'saved'

            // Clear local drafts after a successful save.
            for (const p of project.pages) {
                if (p?.id) clearDraft(project.id, p.id)
            }
            clearProjectDraft(project.id)

            console.log('Project Saved (Storage):', project.id)
        } catch (e) {
            console.error('Save Failed:', e)
            saveStatus.value = 'error'
        } finally {
            isSaving.value = false
        }
    }

    /**
     * Auto-save com debounce
     * Salva automaticamente após período de inatividade
     */
    let saveTimeout: any = null
    const AUTO_SAVE_DELAY = 3000 // 3 segundos

    const triggerAutoSave = () => {
        if (!project.id || project.id.startsWith('proj_')) {
            // Não auto-salvar projetos não criados ainda
            return
        }

        clearTimeout(saveTimeout)
        hasUnsavedChanges.value = true
        saveStatus.value = 'saving'

        saveTimeout = setTimeout(() => {
            saveProjectDB()
        }, AUTO_SAVE_DELAY)
    }

    const cancelAutoSave = () => {
        clearTimeout(saveTimeout)
    }

    /**
     * Carrega o projeto, buscando dados do Storage quando necessário
     */
    const loadProjectDB = async (id: string) => {
        // Não executar no servidor (SSR)
        if (import.meta.server) {
            return false
        }

        console.log('🔄 loadProjectDB iniciado para ID:', id)

        try {
            const supabase = useSupabase()
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            if (!data) {
                console.log('❌ Projeto não encontrado:', id)
                return false
            }

            console.log('📦 Dados do projeto carregados do banco:', { id: data.id, name: data.name, canvasDataType: typeof data.canvas_data })
            console.log('📦 canvas_data preview:', JSON.stringify(data.canvas_data).substring(0, 500))

            project.id = data.id
            project.name = data.name

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

            for (const pageMeta of storedPages) {
                // Pular se pageMeta não for um objeto válido ou não tiver id
                if (!pageMeta || typeof pageMeta !== 'object' || !pageMeta.id) continue

                let canvasData = null
                let serverCanvasData = null

                // CRITICAL: PRIMEIRO verificar se tem canvasData direto no banco
                // Isso é mais rápido e garante que dados recentes sejam usados
                if ((pageMeta as any).canvasData) {
                    serverCanvasData = (pageMeta as any).canvasData
                    const objectCount = serverCanvasData?.objects?.length || 0
                    console.log(`📦 CanvasData encontrado no banco: ${objectCount} objetos`)
                }
                // Só buscar do Storage se NÃO tiver canvasData no banco
                else if (pageMeta.canvasDataPath) {
                    console.log('📥 Buscando canvasData do Storage:', pageMeta.canvasDataPath)
                    serverCanvasData = await loadCanvasDataFromPath(pageMeta.canvasDataPath)
                    if (serverCanvasData) {
                        const objectCount = serverCanvasData?.objects?.length || 0
                        console.log('✅ CanvasData carregado do Storage:', { hasData: !!serverCanvasData, objectCount })
                    } else {
                        console.warn('⚠️ CanvasData não encontrado no Storage')
                    }
                }

                // Offline-safe: Verificar draft local, mas só usar se for válido e mais recente
                const draft = readDraft(data.id, pageMeta.id)
                if (draft?.canvasData) {
                    const draftObjectCount = draft.canvasData?.objects?.length || 0
                    const draftAge = Date.now() - draft.updatedAt
                    const draftAgeMin = Math.floor(draftAge / 60000)

                    // Verificar se o draft tem conteúdo válido (deve ter objetos > 0)
                    const draftIsValid = draftObjectCount > 0
                    const serverObjectCount = serverCanvasData?.objects?.length || 0

                    console.log(`📝 Draft encontrado para página ${pageMeta.id}: ${draftObjectCount} objetos (idade: ${draftAgeMin}min)`)
                    console.log(`📝 Servidor tem: ${serverObjectCount} objetos`)

                    // CRITICAL: Só usar draft se ele tiver objetos válidos E se o servidor não tiver dados melhores
                    // Se o servidor tem dados mas o draft está vazio, sempre usar o servidor
                    // Se o servidor tem mais objetos que o draft, usar o servidor
                    if (draftIsValid && serverObjectCount > 0 && draftObjectCount < serverObjectCount) {
                        console.log(`⚠️ Draft tem ${draftObjectCount} objetos, servidor tem ${serverObjectCount} - usando servidor`)
                        canvasData = serverCanvasData
                    } else if (draftIsValid && (serverObjectCount === 0 || draftObjectCount >= serverObjectCount)) {
                        canvasData = draft.canvasData
                        console.log(`📝 Usando rascunho local (draft) para a página ${pageMeta.id} (${draftAgeMin}min atrás, ${draftObjectCount} objetos)`)
                    } else {
                        if (draftObjectCount === 0 && serverObjectCount > 0) {
                            // Limpar o draft vazio para evitar usar ele novamente
                            clearDraft(data.id, pageMeta.id)
                            console.log(`🗑️ Draft vazio removido, usando servidor com ${serverObjectCount} objetos`)
                        }
                        canvasData = serverCanvasData
                    }
                } else {
                    // Sem draft, usar dados do servidor
                    canvasData = serverCanvasData
                }

                // Validação final: garantir que temos dados válidos
                if (canvasData) {
                    const finalObjectCount = canvasData?.objects?.length || 0
                    console.log(`✅ CanvasData final para página ${pageMeta.id}:`, { hasData: !!canvasData, objectCount: finalObjectCount })
                } else {
                    console.warn(`⚠️ CanvasData é NULL para página ${pageMeta.id}`)
                }
                // Nota: Páginas novas podem não ter canvasData ainda, isso é normal

                const page: Page = {
                    id: pageMeta.id,
                    name: pageMeta.name,
                    width: pageMeta.width || 1080,
                    height: pageMeta.height || 1920,
                    type: pageMeta.type || 'RETAIL_OFFER',
                    canvasData,
                    canvasDataPath: pageMeta.canvasDataPath,
                    thumbnailUrl: pageMeta.thumbnailUrl
                }

                project.pages.push(page)
                console.log('✅ Página adicionada:', { id: page.id, name: page.name, hasCanvasData: !!page.canvasData })
            }

            // Se não tem páginas, inicializar
            if (project.pages.length === 0) initProject()

            project.activePageIndex = 0
            hasUnsavedChanges.value = false
            saveStatus.value = 'saved'
            isProjectLoaded.value = true // Marca que o projeto foi carregado

            console.log('✅ Projeto carregado com sucesso:', { pagesCount: project.pages.length, activePageHasData: !!project.pages[0]?.canvasData })
            return true
        } catch (e) {
            console.error('❌ Load Failed:', e)
            // Offline-safe fallback: restore from local project draft if present.
            const local = readProjectDraft(id)
            if (local?.project?.pages?.length) {
                console.log('📝 Restaurando projeto do rascunho local (offline fallback):', id)
                project.id = local.project.id || id
                project.name = local.project.name || project.name
                project.pages = local.project.pages || []
                project.activePageIndex = local.project.activePageIndex || 0
                hasUnsavedChanges.value = true
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
            const supabase = useSupabase()
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error

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
        resizePage,
        saveProjectDB,
        triggerAutoSave,
        cancelAutoSave,
        loadProjectDB,
        deleteProjectDB,
        isSaving,
        saveStatus,
        lastSavedAt,
        hasUnsavedChanges,
        isProjectLoaded
    }
}
