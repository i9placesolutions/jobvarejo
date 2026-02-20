<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Upload, Folder, Clock, Tag, Image as ImageIcon, Grip, Edit, Trash, FolderInput, Move, ArrowLeft, ChevronRight } from 'lucide-vue-next'
import ContextMenu from './ui/ContextMenu.vue'
import Dialog from './ui/Dialog.vue'
import ConfirmDialog from './ui/ConfirmDialog.vue'

import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import { ShoppingCart, Sparkles } from 'lucide-vue-next'
import { useFolder } from '~/composables/useFolder'
import { useAiImageStudio } from '~/composables/useAiImageStudio'

// Props
const props = defineProps<{
    searchQuery?: string
}>()

const emit = defineEmits<{
    (e: 'insert-asset', asset: any): void
}>()

const categories = [
    { id: 'uploads', name: 'Uploads', icon: Upload },
    { id: 'folders', name: 'Pastas', icon: Folder },
    { id: 'recents', name: 'Recentes', icon: Clock },
    { id: 'brand', name: 'Marca', icon: Tag },
]

const activeCategory = ref('uploads')
const currentFolderId = ref<string | null>(null)
const isLoadingAssets = ref(false)

interface Folder {
    id: string | number
    name: string
    type: 'folder'
    parentId: string | number | null
}

// Use folder composable to get real folders from database
const { folders: dbFolders, loadFolders, createFolder, updateFolder, deleteFolder, moveFolder } = useFolder()
const { getApiAuthHeaders } = useApiAuth()
const aiStudio = useAiImageStudio()

// Mapeamento asset_key -> folder_id para persistência de "mover para pasta"
const assetFolderMap = ref<Map<string, string | null>>(new Map())

const ASSET_FOLDERS_MIGRATION_MSG = 'A tabela asset_folders não existe. Execute o SQL em database/asset_folders_migration.sql no PostgreSQL para persistir a movimentação de imagens.'

// Mapeamento asset_key -> display_name para persistência de "renomear"
const assetNameMap = ref<Map<string, string>>(new Map())
const ASSET_NAMES_MIGRATION_MSG = 'A tabela asset_names não existe. Execute o SQL em database/asset_names_migration.sql no PostgreSQL para persistir o renomeio de imagens.'

function isAssetFoldersTableMissing(err: any): boolean {
    if (!err) return false
    const e = err as { message?: string; code?: string; status?: number; statusCode?: number; data?: any }
    const m = String(e?.message ?? e?.data?.statusMessage ?? '').toLowerCase()
    const c = String(e?.code ?? '')
    const status = Number(e?.status ?? e?.statusCode ?? 0)
    return (status === 404) || m.includes('asset_folders') || m.includes('does not exist') || c === '42P01' || c === 'PGRST116'
}

function isAssetNamesTableMissing(err: any): boolean {
    if (!err) return false
    const e = err as { message?: string; code?: string; status?: number; statusCode?: number; data?: any }
    const m = String(e?.message ?? e?.data?.statusMessage ?? '').toLowerCase()
    const c = String(e?.code ?? '')
    const status = Number(e?.status ?? e?.statusCode ?? 0)
    return (status === 404) || m.includes('asset_names') || m.includes('does not exist') || c === '42P01' || c === 'PGRST116'
}

const loadAssetFolders = async () => {
    try {
        const headers = await getApiAuthHeaders()
        const data = await $fetch('/api/asset-folders', { headers })
        const map = new Map<string, string | null>()
        ;(Array.isArray(data) ? data : []).forEach((row: { asset_key: string; folder_id: string | null }) => {
            map.set(row.asset_key, row.folder_id)
        })
        assetFolderMap.value = map
    } catch (e) {
        if (isAssetFoldersTableMissing(e)) {
            console.warn('asset_folders: tabela ausente.', ASSET_FOLDERS_MIGRATION_MSG)
        } else {
            console.error('Erro ao carregar asset_folders:', e)
        }
    }
}

const loadAssetNames = async () => {
    try {
        const headers = await getApiAuthHeaders()
        const data = await $fetch('/api/asset-names', { headers })
        const map = new Map<string, string>()
        ;(Array.isArray(data) ? data : []).forEach((row: { asset_key: string; display_name: string }) => {
            const k = String(row.asset_key || '').trim()
            if (!k) return
            map.set(k, String(row.display_name || '').trim())
        })
        assetNameMap.value = map
    } catch (e) {
        if (isAssetNamesTableMissing(e)) {
            console.warn('asset_names: tabela ausente.', ASSET_NAMES_MIGRATION_MSG)
        } else {
            console.error('Erro ao carregar asset_names:', e)
        }
    }
}

	// Reactive Data - Now fetched from API
	const assets = ref<{
	    uploads: any[],
	    brand: any[],
	    folders: Folder[],
	    recents: any[]
	}>({
	    uploads: [],
	    brand: [],
	    folders: [], // Pastas vazias - serão carregadas do banco
	    recents: [],
	})

// Watch database folders and sync to assets
watch(dbFolders, (newFolders) => {
    // Convert database folders to AssetsPanel format
    assets.value.folders = newFolders.map(f => ({
        id: f.id,
        name: f.name,
        type: 'folder' as const,
        parentId: f.parent_id
    }))
}, { immediate: true, deep: true })

const UPLOADS_PAGE_SIZE = 60
const UPLOADS_SEARCH_PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 250
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const uploadsCursor = ref<string | null>(null)
const uploadsHasMore = ref(true)
const uploadsLoadingMore = ref(false)
const assetsScrollRef = ref<HTMLElement | null>(null)

const normalizeUploadAsset = (item: any) => {
    const map = assetFolderMap.value
    const names = assetNameMap.value
    const id = String(item?.id || '').trim()
    const key = String(item?.key || '').trim()
    const folderId = (id && map.get(id) !== undefined) ? map.get(id) : (key ? map.get(key) : null)
    const overrideName = (id && names.get(id)) ? names.get(id) : (key ? names.get(key) : undefined)
    return {
        ...item,
        folderId: folderId ?? null,
        name: (typeof overrideName === 'string' && overrideName.trim().length) ? overrideName : item?.name
    }
}

const mergeUploadsUnique = (current: any[], incoming: any[]) => {
    const byId = new Map<string, any>()
    current.forEach(item => byId.set(String(item?.id || ''), item))
    incoming.forEach(item => {
        const id = String(item?.id || '')
        if (!id) return
        byId.set(id, { ...byId.get(id), ...item })
    })
    return Array.from(byId.values())
}

const fetchUploadsPage = async (opts?: { reset?: boolean; fresh?: boolean }) => {
    const reset = !!opts?.reset
    const fresh = !!opts?.fresh
    const searchQuery = activeCategory.value === 'uploads'
        ? String(props.searchQuery || '').trim()
        : ''
    const isSearchMode = searchQuery.length > 0

    if (uploadsLoadingMore.value) return
    if (!reset && !uploadsHasMore.value) return

    uploadsLoadingMore.value = true
    if (reset) isLoadingAssets.value = true

    try {
        const headers = await getApiAuthHeaders()
        const query: Record<string, string | number> = {
            paginated: 1,
            limit: isSearchMode ? UPLOADS_SEARCH_PAGE_SIZE : UPLOADS_PAGE_SIZE,
            source: 'uploads',
            ai: 0
        }
        if (isSearchMode) query.q = searchQuery
        if (!reset && uploadsCursor.value) query.cursor = uploadsCursor.value
        if (fresh) query.fresh = 1

        const response = await $fetch<any>('/api/assets', { headers, query: query as any }) as {
            items?: any[]
            nextCursor?: string | null
            hasMore?: boolean
        } | any[]

        const responseItems = Array.isArray(response)
            ? response
            : (Array.isArray(response?.items) ? response.items : [])

        // Ignore stale responses when the user keeps typing.
        if (activeCategory.value === 'uploads') {
            const currentSearchQuery = String(props.searchQuery || '').trim()
            if (currentSearchQuery !== searchQuery) return
        }

        const normalizedItems = responseItems.map(normalizeUploadAsset)
        assets.value.uploads = reset
            ? normalizedItems
            : mergeUploadsUnique(assets.value.uploads, normalizedItems)

        if (Array.isArray(response)) {
            uploadsCursor.value = normalizedItems.length >= UPLOADS_PAGE_SIZE
                ? String((Number(uploadsCursor.value || 0) || 0) + normalizedItems.length)
                : null
            uploadsHasMore.value = normalizedItems.length >= UPLOADS_PAGE_SIZE
        } else {
            uploadsCursor.value = response?.nextCursor ?? null
            uploadsHasMore.value = Boolean(response?.hasMore && response?.nextCursor)
        }
    } catch (e) {
        console.error('Failed to fetch assets:', e)
    } finally {
        uploadsLoadingMore.value = false
        if (reset) isLoadingAssets.value = false
    }
}

const fetchAssets = async (opts?: { fresh?: boolean }) => {
    uploadsCursor.value = null
    uploadsHasMore.value = true
    await fetchUploadsPage({ reset: true, fresh: !!opts?.fresh })
    const isSearchMode = activeCategory.value === 'uploads' && String(props.searchQuery || '').trim().length > 0
    if (!isSearchMode) {
        await nextTick()
        await maybeLoadMoreUploads()
    }
}

const fetchMoreAssets = async () => {
    await fetchUploadsPage({ reset: false, fresh: false })
}

// Fetch brands/logos from Contabo
const fetchBrands = async () => {
    isLoadingAssets.value = true
    try {
        const headers = await getApiAuthHeaders()
        const data = await $fetch('/api/brands', { headers })
        if (data && Array.isArray(data)) {
            assets.value.brand = data
        }
    } catch (e) {
        console.error('Failed to fetch brands:', e)
    } finally {
        isLoadingAssets.value = false
    }
}

// Fetch recent items (combines uploads and brands sorted by lastModified)
const fetchRecents = async () => {
    isLoadingAssets.value = true
    try {
        const headers = await getApiAuthHeaders()
        // Fetch both uploads and brands
        const [uploadsData, brandsData] = await Promise.all([
            $fetch('/api/assets', { headers, query: { limit: 50 } }).catch(() => []),
            $fetch('/api/brands', { headers }).catch(() => [])
        ])
        
        // Combine and sort by lastModified (most recent first)
        const allItems = [
            ...(Array.isArray(uploadsData) ? uploadsData.map((item: any) => ({
                ...normalizeUploadAsset(item),
                type: 'upload'
            })) : []),
            ...(Array.isArray(brandsData) ? brandsData.map((item: any) => ({
                ...item,
                type: 'brand'
            })) : [])
        ]
        
        // Sort by lastModified (most recent first)
        allItems.sort((a: any, b: any) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0
            return dateB - dateA
        })
        
        // Limit to 50 most recent items
        assets.value.recents = allItems.slice(0, 50)
    } catch (e) {
        console.error('Failed to fetch recent items:', e)
        assets.value.recents = []
    } finally {
        isLoadingAssets.value = false
    }
}

// Watch category changes to fetch data
watch(activeCategory, (newCat) => {
    if (newCat === 'uploads') fetchAssets()
    if (newCat === 'folders' && assets.value.uploads.length === 0) fetchAssets()
    if (newCat === 'brand') fetchBrands()
    if (newCat === 'recents') fetchRecents()
})

watch(
    () => props.searchQuery,
    (next, prev) => {
        if (activeCategory.value !== 'uploads') return
        const nextQuery = String(next || '').trim()
        const prevQuery = String(prev || '').trim()
        if (nextQuery === prevQuery) return
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
        searchDebounceTimer = setTimeout(() => {
            void fetchAssets()
        }, SEARCH_DEBOUNCE_MS)
    }
)

// When AI Studio creates a new image, refresh libraries
watch(() => aiStudio.refreshTick.value, async () => {
    await fetchAssets({ fresh: true })
    await fetchRecents()
})

onMounted(async () => {
    await loadFolders()
    await loadAssetFolders()
    await loadAssetNames()
    await fetchAssets()
    if (activeCategory.value === 'recents') {
        await fetchRecents()
    }
})

onBeforeUnmount(() => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
        searchDebounceTimer = null
    }
})

// Current folder object
const currentFolder = computed(() => {
    return assets.value.folders.find(f => f.id === currentFolderId.value)
})

// Computed Items
const currentItems = computed(() => {
    let items = [];
    if (activeCategory.value === 'folders') {
        const folders = assets.value.folders.filter(f => f.parentId === currentFolderId.value)
        const files = assets.value.uploads.filter(u => u.folderId === currentFolderId.value)
        items = [...folders, ...files]
    } else {
        items = assets.value[activeCategory.value as keyof typeof assets.value] || []
    }

    // Apply Search
    if (props.searchQuery?.trim()) {
        if (activeCategory.value === 'uploads') return items
        // Normalize: Lowercase and remove accents
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const query = normalize(props.searchQuery);
        return items.filter((item: any) => {
            const itemName = normalize(item.name || '');
            return itemName.includes(query);
        })
    }
    
    return items
})

const maybeLoadMoreUploads = async (scrollEl?: HTMLElement | null) => {
    if (!(activeCategory.value === 'uploads' || activeCategory.value === 'folders')) return
    if (isLoadingAssets.value || uploadsLoadingMore.value || !uploadsHasMore.value) return

    const el = scrollEl || assetsScrollRef.value
    if (!el) return

    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining > 220) return
    await fetchMoreAssets()
}

const handleAssetsScroll = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    void maybeLoadMoreUploads(target)
}

// Navigation
const enterFolder = (folderId: string) => {
    currentFolderId.value = folderId
}

const goBack = () => {
    if (currentFolder.value) {
        currentFolderId.value = (currentFolder.value.parentId as string) || null
    } else {
        currentFolderId.value = null
    }
}

// Context Menu Logic
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    item: null as any,
    isBackground: false
})

const contextMenuItems = computed(() => {
    if (contextMenu.value.isBackground) {
        return [
            { label: 'Nova Pasta', action: 'new_folder', icon: FolderInput },
        ]
    }
    
    // Different menu for Files vs Folders
    if (contextMenu.value.item?.type === 'folder') {
        return [
            { label: 'Renomear', action: 'rename', icon: Edit },
            { label: 'Nova Pasta Dentro', action: 'new_folder_inside', icon: FolderInput },
            { label: 'Mover', action: 'move', icon: Move },
            { label: 'Excluir', action: 'delete', icon: Trash, danger: true },
        ]
    } else {
         return [
            { label: 'Mover', action: 'move', icon: Move },
            { label: 'Renomear', action: 'rename', icon: Edit },
            { label: 'Excluir', action: 'delete', icon: Trash, danger: true },
        ]
    }
})

const handleContextMenu = (e: MouseEvent, item: any) => {
    e.preventDefault()
    e.stopPropagation() // Prevent background menu
    contextMenu.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        item,
        isBackground: false
    }
}

const handleBackgroundContextMenu = (e: MouseEvent) => {
    if (activeCategory.value !== 'folders') return
    e.preventDefault()
    contextMenu.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        item: null,
        isBackground: true
    }
}

// Confirm Dialog State
const showConfirmDialog = ref(false)
const pendingDeleteItem = ref<any>(null)
const confirmDeleteMessage = computed(() => {
    const item = pendingDeleteItem.value
    if (!item) return ''
    return `Tem certeza que deseja excluir "${item.name}"?`
})

const confirmDelete = async () => {
    const item = pendingDeleteItem.value
    if (!item) return
    uploadError.value = ''
    
    if (item.type === 'folder') {
        // Deletar pasta do banco de dados
        try {
            await deleteFolder(String(item.id))
            // A pasta será removida automaticamente via watch do dbFolders
        } catch (e) {
            console.error('Erro ao deletar pasta:', e)
            uploadError.value = 'Erro ao deletar pasta. Tente novamente.'
        }
    } else {
         // Deletar do Contabo Storage
         try {
             const assetKey = String(item?.key || item?.id || '').trim()
             if (!assetKey) throw new Error('Chave do asset ausente')
             const headers = await getApiAuthHeaders()
             await $fetch('/api/assets/delete', {
                 method: 'POST',
                 headers,
                 body: { key: assetKey }
             })
             // Remover da lista local apenas após sucesso
             assets.value.uploads = assets.value.uploads.filter(u => u.id !== item.id)
         } catch (e) {
             console.error('Erro ao deletar asset:', e)
             uploadError.value = 'Erro ao deletar arquivo. Tente novamente.'
         }
    }
    
    showConfirmDialog.value = false
    pendingDeleteItem.value = null
}

const handleAction = async (action: string) => {
    const item = contextMenu.value.item
    
    if (action === 'new_folder') {
        // Create folder in current view (Root or inside currentFolderId)
        dialog.value = { show: true, type: 'new_folder', inputValue: '', targetItem: null }
        return
    }

    if (!item) return

    if (action === 'delete') {
        pendingDeleteItem.value = item
        showConfirmDialog.value = true
    } else if (action === 'rename') {
        dialog.value = { show: true, type: 'rename', inputValue: item.name, targetItem: item }
    } else if (action === 'new_folder_inside') {
        dialog.value = { show: true, type: 'new_folder', inputValue: '', targetItem: item } // targetItem is parent
    } else if (action === 'move') {
        moveTargetId.value = ''
        dialog.value = { show: true, type: 'move', inputValue: '', targetItem: item }
    }
}

// Dialog Logic
const dialog = ref({
    show: false,
    type: '', // 'rename', 'new_folder', 'move'
    inputValue: '',
    targetItem: null as any
})

const dialogTitle = computed(() => {
    switch (dialog.value.type) {
        case 'rename': return 'Renomear'
        case 'new_folder': return 'Nova Pasta'
        case 'move': return 'Mover para'
        default: return ''
    }
})

const moveTargetId = ref('')

// Build folder path label (e.g. "Background / Carnaval")
const getFolderPathLabel = (folderId: string | undefined | null): string => {
    const parts: string[] = []
    let current = assets.value.folders.find(f => f.id === folderId)
    while (current) {
        parts.unshift(current.name)
        current = assets.value.folders.find(f => f.id === current?.parentId)
    }
    return parts.join(' / ')
}

// Get folder depth for indentation
const getFolderDepth = (folderId: string | undefined | null): number => {
    let depth = 0
    let current = assets.value.folders.find(f => f.id === folderId)
    while (current?.parentId) {
        depth++
        current = assets.value.folders.find(f => f.id === current?.parentId)
    }
    return depth
}

// Get all descendant folder IDs (to prevent moving folder into its own children)
const getDescendantIds = (folderId: string): Set<string> => {
    const ids = new Set<string>()
    const collect = (parentId: string) => {
        assets.value.folders.filter(f => f.parentId === parentId).forEach(f => {
            ids.add(f.id as string)
            collect(f.id as string)
        })
    }
    collect(folderId)
    return ids
}

const availableMoveTargets = computed(() => {
    const item = dialog.value.targetItem
    if (!item) return []
    
    let filtered: typeof assets.value.folders
    if (item.type === 'folder') {
        // Cannot move folder into itself or any of its descendants
        const descendants = getDescendantIds(item.id as string)
        filtered = assets.value.folders.filter(f => f.id !== item.id && !descendants.has(f.id as string))
    } else {
        // File can move to any folder except current parent
        filtered = assets.value.folders.filter(f => f.id !== currentFolderId.value)
    }
    
    // Sort by path for hierarchical display, then add depth/label
    return filtered
        .map(f => ({
            ...f,
            pathLabel: getFolderPathLabel(String(f.id)),
            depth: getFolderDepth(String(f.id))
        }))
        .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel))
})

const handleDialogConfirm = async () => {
    const { type, targetItem, inputValue } = dialog.value
    uploadError.value = ''
    
    if (type === 'rename') {
        if (targetItem.type === 'folder') {
            // Renomear pasta no banco de dados
            try {
                await updateFolder(String(targetItem.id), { name: inputValue })
                // A pasta será atualizada automaticamente via watch do dbFolders
            } catch (e) {
                console.error('Erro ao renomear pasta:', e)
                uploadError.value = 'Erro ao renomear pasta. Tente novamente.'
                return
            }
        } else {
             const file = assets.value.uploads.find(u => u.id === targetItem.id)
             const nextName = String(inputValue || '').trim()
             if (file && nextName) file.name = nextName

             const assetKey = String(targetItem?.key || targetItem?.id || '').trim()
             const looksLikeWasabiKey = assetKey.includes('/') && !assetKey.startsWith('cache:')
             if (nextName && looksLikeWasabiKey) {
                 try {
                     const headers = await getApiAuthHeaders()
                     await $fetch('/api/asset-names', {
                         method: 'POST',
                         headers,
                         body: { asset_key: assetKey, display_name: nextName }
                     })
                     assetNameMap.value.set(assetKey, nextName)
                     assetNameMap.value = new Map(assetNameMap.value)
                 } catch (e) {
                     console.error('Erro ao persistir renomeio do asset:', e)
                     uploadError.value = isAssetNamesTableMissing(e) ? ASSET_NAMES_MIGRATION_MSG : 'Erro ao renomear arquivo. Tente novamente.'
                     return
                 }
             }
        }
    } else if (type === 'new_folder') {
        // If targetItem exists (from 'new_folder_inside'), use it as parent.
        // Else use currentFolderId
        const parentId = targetItem ? String(targetItem.id) : (currentFolderId.value ? String(currentFolderId.value) : null)
        
        // Criar pasta no banco de dados
        try {
            const newFolder = await createFolder(inputValue || 'Nova Pasta', parentId)
            // A pasta já foi adicionada ao dbFolders no createFolder
            // Aguardar próximo tick para garantir que a reatividade foi processada
            await nextTick()
            // Forçar atualização imediata do assets para garantir reatividade
            if (newFolder) {
                // Atualizar assets.value.folders sincronizando com dbFolders
                assets.value.folders = dbFolders.value.map(f => ({
                    id: f.id,
                    name: f.name,
                    type: 'folder' as const,
                    parentId: f.parent_id
                }))
            }
        } catch (e) {
            console.error('Erro ao criar pasta:', e)
            uploadError.value = 'Erro ao criar pasta. Tente novamente.'
            return
        }
    } else if (type === 'move') {
         if (targetItem.type === 'folder') {
             // Mover pasta no banco de dados
             try {
                 await moveFolder(String(targetItem.id), moveTargetId.value ? String(moveTargetId.value) : null)
                 // A pasta será atualizada automaticamente via watch do dbFolders
             } catch (e) {
                 console.error('Erro ao mover pasta:', e)
                 uploadError.value = 'Erro ao mover pasta. Tente novamente.'
                 return
             }
         } else {
             const file = assets.value.uploads.find(u => u.id === targetItem.id)
             if (file) {
                 const folderId = moveTargetId.value || null
                 const assetKey = String(targetItem?.key || targetItem?.id || '').trim()
                 try {
                     const headers = await getApiAuthHeaders()
                     await $fetch('/api/asset-folders', {
                         method: 'POST',
                         headers,
                         body: { asset_key: assetKey || targetItem.id, folder_id: folderId }
                     })
                     assetFolderMap.value.set(assetKey || targetItem.id, folderId)
                     assetFolderMap.value = new Map(assetFolderMap.value)
                 } catch (e) {
                     console.error('Erro ao persistir movimento do asset:', e)
                     uploadError.value = isAssetFoldersTableMissing(e) ? ASSET_FOLDERS_MIGRATION_MSG : 'Erro ao mover arquivo. Tente novamente.'
                     return
                 }
                 file.folderId = folderId
             }
         }
    }

    dialog.value.show = false
}

// Long Press Logic
let pressTimer: any = null
let longPressFired = false
const startLongPress = (e: Event, item: any) => {
    longPressFired = false
    pressTimer = setTimeout(() => {
        longPressFired = true
        let clientX = 0
        let clientY = 0
        
        if (window.MouseEvent && e instanceof MouseEvent) {
            clientX = e.clientX
            clientY = e.clientY
        } else {
            const touchEvent = e as TouchEvent
            const touch = touchEvent.touches?.[0]
            if (touch) {
                clientX = touch.clientX
                clientY = touch.clientY
            }
        }
        
        contextMenu.value = {
            show: true,
            x: clientX,
            y: clientY,
            item,
            isBackground: false
        }
    }, 500)
}
const cancelLongPress = () => clearTimeout(pressTimer)

const handleAssetClick = (asset: any) => {
    // Prevent a long-press from also triggering an insert on mouseup/click.
    if (longPressFired) {
        longPressFired = false
        return
    }
    if (!asset || asset.type === 'folder') return
    if (!asset.url) return
    emit('insert-asset', asset)
}

// Drag and Drop (Preserved logic)
const handleDragStart = (e: DragEvent, asset: any) => {
    if (e.dataTransfer) {
        // Enriched payload for Products
        const payload = {
            type: 'image', // Keep as image for basic drop support
            url: asset.url,
            name: asset.name,
            // Extra Data
            price: asset.price,
            brand: asset.brand,
            weight: asset.weight,
            isSmartProduct: !!asset.price // Flag
        };
        
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
    }
}



// Upload Logic
import { useUpload } from '../composables/useUpload'
const { uploadFile, uploadFiles, isUploading, error: uploadError } = useUpload()
const fileInput = ref<HTMLInputElement | null>(null)
const isBrandUploading = ref(false)
const uploadBatch = ref<{ active: boolean; done: number; total: number; failed: number }>({ active: false, done: 0, total: 0, failed: 0 })

const isAnyUploading = computed(() => isUploading.value || isBrandUploading.value)
const uploadButtonText = computed(() => {
    if (!isAnyUploading.value) return (activeCategory.value === 'brand' ? 'Marca' : 'Upload')
    const b = uploadBatch.value
    if (b.active && b.total > 1) return `Enviando ${b.done}/${b.total}`
    return 'Enviando...'
})

const triggerUpload = () => {
    fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = Array.from(target.files || []).filter(Boolean)
    if (target) target.value = ''
    if (files.length > 0) {
        // Upload para endpoint correto dependendo da categoria
        const endpoint = activeCategory.value === 'brand' ? '/api/brands/upload' : '/api/upload'
        uploadBatch.value = { active: files.length > 1, done: 0, total: files.length, failed: 0 }

        try {
            const upsertItem = async (file: File, result: { success: boolean, url: string, key?: string } | null) => {
                if (!result?.success) return

                const newItem = {
                    id: result.key || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    url: result.url,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    folderId: activeCategory.value === 'folders' ? currentFolderId.value : null,
                    lastModified: new Date().toISOString()
                }

                if (activeCategory.value === 'brand') {
                    assets.value.brand = [newItem, ...assets.value.brand]
                } else {
                    assets.value.uploads = [newItem, ...assets.value.uploads]
                }

                if (activeCategory.value === 'folders' && currentFolderId.value && result.key) {
                    try {
                        const headers = await getApiAuthHeaders()
                        await $fetch('/api/asset-folders', {
                            method: 'POST',
                            headers,
                            body: { asset_key: result.key, folder_id: String(currentFolderId.value) }
                        })
                        assetFolderMap.value.set(result.key, String(currentFolderId.value))
                        assetFolderMap.value = new Map(assetFolderMap.value)
                    } catch (e) {
                        console.error('Erro ao persistir pasta do upload:', e)
                        if (isAssetFoldersTableMissing(e)) {
                            uploadError.value = ASSET_FOLDERS_MIGRATION_MSG
                        }
                    }
                }

                assets.value.recents = [{ ...newItem, type: activeCategory.value === 'brand' ? 'brand' : 'upload' }, ...assets.value.recents].slice(0, 50)
            }

            if (endpoint === '/api/upload') {
                const results = await uploadFiles(files, {
                    continueOnError: true,
                    onProgress: ({ done, total, ok }) => {
                        uploadBatch.value = { ...uploadBatch.value, active: total > 1, done, total, failed: uploadBatch.value.failed + (ok ? 0 : 1) }
                    }
                })

                for (const r of results) {
                    if (r?.result?.success) {
                        await upsertItem(r.file, r.result as any)
                    }
                }
            } else {
                // Brand endpoint doesn't use composable; keep its own uploading state.
                isBrandUploading.value = true
                let done = 0
                for (const file of files) {
                    try {
                        const formData = new FormData()
                        formData.append('file', file)
                        const headers = await getApiAuthHeaders()
                        const result = await ($fetch as any)(endpoint, { method: 'POST', headers, body: formData }) as any
                        done += 1
                        uploadBatch.value = { ...uploadBatch.value, active: files.length > 1, done, total: files.length }
                        await upsertItem(file, result)
                    } catch (e) {
                        done += 1
                        uploadBatch.value = { ...uploadBatch.value, active: files.length > 1, done, total: files.length, failed: uploadBatch.value.failed + 1 }
                        console.error(e)
                    }
                }
            }

            if (uploadBatch.value.failed > 0) {
                uploadError.value = `Falha em ${uploadBatch.value.failed} arquivo(s)`
            }

            // Refresh only once at the end (avoid heavy reload per file).
            if (activeCategory.value === 'brand') {
                await fetchBrands()
            } else {
                await fetchAssets({ fresh: true })
                await nextTick()
                await maybeLoadMoreUploads()
            }
        } catch (e) {
            console.error(e)
            uploadError.value = 'Erro ao fazer upload'
        } finally {
            isBrandUploading.value = false
            uploadBatch.value = { active: false, done: 0, total: 0, failed: 0 }
        }
    }
}

</script>

<template>
    <div class="flex flex-col h-full bg-[#1a1a1a]">
        <!-- Category Nav (compact, matching PropertiesPanel) -->
        <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/5 shrink-0 overflow-x-auto nav-scrollbar">
            <button 
                v-for="cat in categories" 
                :key="cat.id"
                @click="activeCategory = cat.id; currentFolderId = null"
                :class="[
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide cursor-pointer transition-all whitespace-nowrap shrink-0',
                    activeCategory === cat.id ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-500 hover:text-zinc-400'
                ]"
            >
                <component :is="cat.icon" class="w-3 h-3" />
                <span>{{ cat.name }}</span>
            </button>
        </div>

        <div v-if="activeCategory === 'uploads' || activeCategory === 'brand' || (activeCategory === 'folders' && currentFolderId)" class="px-2 py-1.5 border-b border-white/5">
            <input type="file" ref="fileInput" class="hidden" accept="image/*" multiple @change="handleFileUpload" />
            <div class="flex items-center gap-1.5">
                <button 
                    @click="triggerUpload" 
                    :disabled="isAnyUploading"
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-40"
                >
                    <template v-if="isAnyUploading">
                        <span class="animate-pulse">{{ uploadButtonText }}</span>
                    </template>
                    <template v-else>
                        <Upload class="w-3 h-3" />
                        {{ uploadButtonText }}
                    </template>
                </button>
                <button
                    @click="aiStudio.openStudio({ initial: { mode: 'generate', filenameBase: 'ai-image' }, applyMode: 'insert' })"
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                    <Sparkles class="w-3 h-3" />
                    IA
                </button>
            </div>
            <p v-if="uploadError" class="text-[9px] text-red-400 mt-1">{{ uploadError }}</p>
        </div>

        <!-- Breadcrumb / Header for Folders -->
        <div v-if="activeCategory === 'folders'" class="px-2 py-1.5 border-b border-white/5 flex items-center justify-between text-zinc-400">
            <div class="flex items-center gap-1.5">
                <template v-if="currentFolderId">
                    <button @click="goBack" class="p-0.5 hover:bg-white/10 rounded">
                        <ArrowLeft class="w-3.5 h-3.5" />
                    </button>
                    <div class="flex items-center gap-1 text-[10px]">
                        <span class="cursor-pointer hover:text-white" @click="currentFolderId = null">Raiz</span>
                        <ChevronRight class="w-2.5 h-2.5" />
                        <span class="text-white font-semibold uppercase tracking-wide">{{ currentFolder?.name }}</span>
                    </div>
                </template>
                <template v-else>
                     <span class="text-[10px] font-semibold uppercase tracking-wide pl-0.5">Minhas Pastas</span>
                </template>
            </div>
            <button 
                @click="dialog = { show: true, type: 'new_folder', inputValue: '', targetItem: null }" 
                class="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
                title="Nova Pasta"
            >
                <FolderInput class="w-3 h-3" />
            </button>
        </div>

        <!-- Grid Content -->
        <div 
            ref="assetsScrollRef"
            class="flex-1 overflow-y-auto custom-scrollbar p-2"
            @scroll.passive="handleAssetsScroll"
            @contextmenu="handleBackgroundContextMenu"
        >
            <div class="grid grid-cols-2 gap-1.5">
                <!-- Folders Category View -->
                <template v-if="activeCategory === 'folders'">
                    <!-- Render Folders First -->
                    <div 
                        v-for="item in currentItems.filter(i => i.type === 'folder')" 
                        :key="item.id" 
                        @click="enterFolder(item.id)"
                        @contextmenu="(e) => handleContextMenu(e, item)"
                        @mousedown="(e) => startLongPress(e, item)"
                        @touchstart="(e) => startLongPress(e, item)"
                        @mouseup="cancelLongPress"
                        @mouseleave="cancelLongPress"
                        @touchend="cancelLongPress"
                        class="col-span-2 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer text-zinc-400 hover:text-white border border-transparent hover:border-white/10 transition-all select-none"
                    >
                        <Folder class="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" />
                        <div class="flex flex-col">
                             <span class="text-[11px] font-medium">{{ item.name }}</span>
                             <span class="text-[9px] text-zinc-500">Pasta</span>
                        </div>
                    </div>

                    <!-- Render Files (Grid Style) -->
                    <div 
                        v-for="asset in currentItems.filter(i => i.type !== 'folder')" 
                        :key="asset.id"
                        class="aspect-square bg-[#1e1e1e] rounded overflow-hidden relative group cursor-grab active:cursor-grabbing border border-white/5 hover:border-white/15 transition-all"
                        draggable="true"
                        @click="handleAssetClick(asset)"
                        @dragstart="(e) => handleDragStart(e, asset)"
                        @contextmenu="(e) => handleContextMenu(e, asset)"
                        @mousedown="(e) => startLongPress(e, asset)"
                        @touchstart="(e) => startLongPress(e, asset)"
                        @mouseup="cancelLongPress"
                        @mouseleave="cancelLongPress"
                        @touchend="cancelLongPress"
                    >
                        <img :src="asset.url" crossorigin="anonymous" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                            <span class="text-[9px] text-white font-medium truncate w-full">{{ asset.name }}</span>
                        </div>
                    </div>
                </template>

                <!-- Assets Grid -->
                <template v-else>
                    <!-- Empty state for recents -->
                    <div v-if="activeCategory === 'recents' && currentItems.length === 0" class="col-span-2 flex flex-col items-center justify-center py-6 text-zinc-500">
                        <Clock class="w-6 h-6 mb-2 opacity-40" />
                        <p class="text-[10px] font-semibold uppercase tracking-wide">Nenhum item recente</p>
                        <p class="text-[9px] mt-1 opacity-60">Os arquivos usados aparecerão aqui</p>
                    </div>
                    
                    <div 
                        v-for="asset in currentItems" 
                        :key="asset.id"
                        class="aspect-square bg-[#1e1e1e] rounded overflow-hidden relative group cursor-grab active:cursor-grabbing border border-white/5 hover:border-white/15 transition-all"
                        draggable="true"
                        @click="handleAssetClick(asset)"
                        @dragstart="(e) => handleDragStart(e, asset)"
                        @contextmenu="(e) => handleContextMenu(e, asset)"
                        @mousedown="(e) => startLongPress(e, asset)"
                        @touchstart="(e) => startLongPress(e, asset)"
                        @mouseup="cancelLongPress"
                        @mouseleave="cancelLongPress"
                        @touchend="cancelLongPress"
                    >
                        <template v-if="asset.url">
                            <img :src="asset.url" crossorigin="anonymous" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                <span class="text-[9px] text-white font-medium truncate w-full">{{ asset.name }}</span>
                            </div>
                        </template>
                        <template v-else>
                             <div class="w-full h-full flex flex-col items-center justify-center p-2 text-zinc-500 bg-[#1e1e1e]">
                                <ShoppingCart class="w-5 h-5 mb-1 opacity-20" />
                                <span class="text-[9px] text-zinc-300 font-medium text-center line-clamp-2 leading-tight">{{ asset.name }}</span>
                                <span v-if="asset.price" class="text-[10px] text-green-400 font-bold mt-1">R$ {{ asset.price }}</span>
                            </div>
                        </template>
                    </div>
                </template>
            </div>

            <div
                v-if="(activeCategory === 'uploads' || activeCategory === 'folders') && (uploadsLoadingMore || uploadsHasMore)"
                class="col-span-2 flex items-center justify-center py-3"
            >
                <button
                    v-if="uploadsHasMore && !uploadsLoadingMore"
                    @click="fetchMoreAssets"
                    class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors"
                >
                    Carregar mais
                </button>
                <div v-else class="text-[10px] text-zinc-500 animate-pulse">Carregando mais uploads...</div>
            </div>
            
            <!-- Empty state (only show if not already showing empty state for recents) -->
            <div v-if="!currentItems.length && !(activeCategory === 'recents')" class="text-center py-8 text-zinc-600">
                <p class="text-[10px] font-semibold uppercase tracking-widest">Vazio</p>
                <p v-if="activeCategory === 'folders' && !currentFolderId" class="text-[9px] mt-2">Clique com o botão direito para criar pasta</p>
            </div>
        </div>

        <!-- Context Menu -->
        <ContextMenu 
            v-model="contextMenu.show" 
            :x="contextMenu.x" 
            :y="contextMenu.y" 
            :items="contextMenuItems"
            @select="handleAction"
        />


        <!-- Action Dialog -->
        <Dialog v-model="dialog.show" :title="dialogTitle">
            <div class="flex flex-col gap-4">
                <template v-if="dialog.type === 'move'">
                     <div class="flex flex-col gap-2">
                        <label class="text-xs text-zinc-400">Mover para:</label>
                        <select v-model="moveTargetId" class="bg-zinc-800 border-zinc-700 rounded text-xs p-2 text-white">
                            <option value="">📁 Raiz</option>
                            <option v-for="target in availableMoveTargets" :key="target.id" :value="target.id">
                                {{ '\u00A0\u00A0'.repeat(target.depth) }}{{ target.depth > 0 ? '└ ' : '' }}{{ target.name }}
                            </option>
                        </select>
                    </div>
                </template>
                <template v-else>
                    <Input v-model="dialog.inputValue" placeholder="Nome da pasta" autofocus />
                </template>
                
                <div class="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" @click="dialog.show = false">Cancelar</Button>
                    <Button size="sm" @click="handleDialogConfirm">Confirmar</Button>
                </div>
            </div>
        </Dialog>
    </div>

    <!-- Confirm Dialog -->
    <ConfirmDialog
        :show="showConfirmDialog"
        title="Confirmar Exclusão"
        :message="confirmDeleteMessage"
        variant="danger"
        confirm-text="Excluir"
        cancel-text="Cancelar"
        @confirm="confirmDelete"
        @cancel="showConfirmDialog = false; pendingDeleteItem = null"
    />
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}
.nav-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #444 transparent;
}
.nav-scrollbar::-webkit-scrollbar { height: 3px; }
.nav-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
.nav-scrollbar::-webkit-scrollbar-track { background: transparent; }
</style>
