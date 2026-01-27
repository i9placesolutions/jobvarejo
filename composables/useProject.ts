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
        }
    }

    const updatePageData = (index: number, json: any) => {
        if (project.pages[index]) {
            project.pages[index].canvasData = json
            markAsUnsaved()
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

                // Salvar canvas JSON no Storage
                if (page.canvasData) {
                    const path = await saveCanvasData(project.id, page.id, page.canvasData)
                    if (path) {
                        storagePaths[i] = path
                        page.canvasDataPath = path
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
            const pageMetadata = project.pages.map((page, index) => ({
                id: page.id,
                name: page.name,
                width: page.width,
                height: page.height,
                type: page.type,
                canvasDataPath: storagePaths[index] || page.canvasDataPath, // Caminho no Storage
                thumbnailUrl: thumbnailUrls[index] || page.thumbnailUrl // URL do thumbnail
            }))

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

                // Se tem canvasDataPath, buscar do Storage usando o caminho direto
                if (pageMeta.canvasDataPath) {
                    console.log('📥 Buscando canvasData do Storage:', pageMeta.canvasDataPath)
                    canvasData = await loadCanvasDataFromPath(pageMeta.canvasDataPath)
                    console.log('✅ CanvasData carregado:', !!canvasData)
                } else if ((pageMeta as any).canvasData) {
                    // Legacy: dados ainda estão no banco
                    canvasData = (pageMeta as any).canvasData
                    console.log('📦 CanvasData encontrado no banco (legacy)')
                }

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
