<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Upload, Folder, Clock, Tag, Image as ImageIcon, Grip, Edit, Trash, FolderInput, Move, ArrowLeft, ChevronRight } from 'lucide-vue-next'
import ContextMenu from './ui/ContextMenu.vue'
import Dialog from './ui/Dialog.vue'

import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import { ShoppingCart, Sparkles } from 'lucide-vue-next'

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
    { id: 'elements', name: 'Elementos', icon: ImageIcon },
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

// Reactive Data - Now fetched from API
const assets = ref<{
    uploads: any[],
    brand: any[],
    folders: Folder[],
    recents: any[],
    elements: any[]
}>({
    uploads: [],
    brand: [],
    folders: [
        { id: 'f1', name: 'Campanha Natal', type: 'folder', parentId: null },
        { id: 'f2', name: 'Cliente A', type: 'folder', parentId: null }
    ],
    recents: [],
    elements: [],

})

// Fetch assets from Contabo S3 on mount
const fetchAssets = async () => {
    isLoadingAssets.value = true
    try {
        const data = await $fetch('/api/assets')
        if (data && Array.isArray(data)) {
            assets.value.uploads = data.map((item: any) => ({
                ...item,
                folderId: null
            }))
        }
    } catch (e) {
        console.error('Failed to fetch assets:', e)
    } finally {
        isLoadingAssets.value = false
    }
}

// Fetch brands/logos from Contabo
const fetchBrands = async () => {
    isLoadingAssets.value = true
    try {
        const data = await $fetch('/api/brands')
        if (data && Array.isArray(data)) {
            assets.value.brand = data
        }
    } catch (e) {
        console.error('Failed to fetch brands:', e)
    } finally {
        isLoadingAssets.value = false
    }
}

// Watch category changes to fetch data
watch(activeCategory, (newCat) => {
    if (newCat === 'uploads') fetchAssets()
    if (newCat === 'brand') fetchBrands()
})

onMounted(() => {
    fetchAssets()
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

const handleAction = async (action: string) => {
    const item = contextMenu.value.item
    
    if (action === 'new_folder') {
        // Create folder in current view (Root or inside currentFolderId)
        dialog.value = { show: true, type: 'new_folder', inputValue: '', targetItem: null }
        return
    }

    if (!item) return

    if (action === 'delete') {
        if (confirm(`Tem certeza que deseja excluir "${item.name}"?`)) {
            if (item.type === 'folder') {
                 assets.value.folders = assets.value.folders.filter(f => f.id !== item.id && f.parentId !== item.id)
            } else {
                 // Deletar do Contabo Storage
                 try {
                     await $fetch('/api/assets/delete', {
                         method: 'POST',
                         body: { key: item.id }
                     })
                     // Remover da lista local apenas após sucesso
                     assets.value.uploads = assets.value.uploads.filter(u => u.id !== item.id)
                 } catch (e) {
                     console.error('Erro ao deletar asset:', e)
                     alert('Erro ao deletar arquivo. Tente novamente.')
                 }
            }
        }
    } else if (action === 'rename') {
        dialog.value = { show: true, type: 'rename', inputValue: item.name, targetItem: item }
    } else if (action === 'new_folder_inside') {
        dialog.value = { show: true, type: 'new_folder', inputValue: '', targetItem: item } // targetItem is parent
    } else if (action === 'move') {
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
const availableMoveTargets = computed(() => {
    const item = dialog.value.targetItem
    if (!item) return []
    
    if (item.type === 'folder') {
        // Cannot move folder into itself or its children
        // Simplified check (no recursive check for children)
        return assets.value.folders.filter(f => f.id !== item.id && f.parentId !== item.id)
    } else {
        // File can move to any folder except current parent
        return assets.value.folders.filter(f => f.id !== currentFolderId.value)
    }
})

const handleDialogConfirm = () => {
    const { type, targetItem, inputValue } = dialog.value
    
    if (type === 'rename') {
        if (targetItem.type === 'folder') {
            const folder = assets.value.folders.find(f => f.id === targetItem.id)
            if (folder) folder.name = inputValue
        } else {
             const file = assets.value.uploads.find(u => u.id === targetItem.id)
             if (file) file.name = inputValue
        }
    } else if (type === 'new_folder') {
        // If targetItem exists (from 'new_folder_inside'), use it as parent.
        // Else use currentFolderId
        const parentId = targetItem ? targetItem.id : currentFolderId.value
        
        assets.value.folders.push({
            id: `f${Date.now()}`,
            name: inputValue || 'Nova Pasta',
            type: 'folder',
            parentId: parentId
        })
    } else if (type === 'move') {
         if (targetItem.type === 'folder') {
             const folder = assets.value.folders.find(f => f.id === targetItem.id)
             if (folder) folder.parentId = moveTargetId.value || null
         } else {
             const file = assets.value.uploads.find(u => u.id === targetItem.id)
             if (file) {
                 file.folderId = moveTargetId.value || null
                 // If we moved it, and we are in 'folders' view, it might disappear from current view, which is expected.
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
const { uploadFile, isUploading, error: uploadError } = useUpload()
const fileInput = ref<HTMLInputElement | null>(null)

const triggerUpload = () => {
    fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
        const file = target.files[0]
        if (!file) return;

        try {
            // Upload para endpoint correto dependendo da categoria
            const endpoint = activeCategory.value === 'brand' ? '/api/brands/upload' : '/api/upload'
            const formData = new FormData()
            formData.append('file', file)

            const result = await $fetch(endpoint, {
                method: 'POST',
                body: formData
            }) as { success: boolean, url: string }

            if (result.success) {
                // Refresh from server to get consistent data
                if (activeCategory.value === 'brand') {
                    await fetchBrands()
                } else {
                    await fetchAssets()
                }
            }
        } catch (e) {
            console.error(e)
            uploadError.value = 'Erro ao fazer upload'
        } finally {
            // Reset input
            if (fileInput.value) fileInput.value.value = ''
        }
    }
}
</script>

<template>
    <div class="flex flex-col h-full bg-[#1e1e1e]">
        <!-- Category Nav -->
        <div class="flex items-center gap-1 p-2 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
            <button 
                v-for="cat in categories" 
                :key="cat.id"
                @click="activeCategory = cat.id; currentFolderId = null"
                :class="[
                    'flex flex-col items-center justify-center p-2 rounded-lg min-w-[60px] h-[55px] transition-all',
                    activeCategory === cat.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                ]"
            >
                <component :is="cat.icon" class="w-4 h-4 mb-1" />
                <span class="text-[9px] font-medium">{{ cat.name }}</span>
            </button>
        </div>

        <div v-if="activeCategory === 'uploads' || activeCategory === 'brand' || (activeCategory === 'folders' && currentFolderId)" class="px-3 py-2 border-b border-white/5">
            <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileUpload" />
            <Button size="sm" class="w-full text-xs" @click="triggerUpload" :disabled="isUploading">
                <template v-if="isUploading">Enviando...</template>
                <template v-else>
                    <Upload class="w-3.5 h-3.5 mr-2" />
                    {{ activeCategory === 'brand' ? 'Upload Marca' : 'Fazer Upload' }}
                </template>
            </Button>
            <p v-if="uploadError" class="text-[9px] text-red-400 mt-1">{{ uploadError }}</p>
        </div>

        <!-- Breadcrumb / Header for Folders -->
        <div v-if="activeCategory === 'folders'" class="px-3 py-2 border-b border-white/5 flex items-center justify-between text-zinc-400">
            <div class="flex items-center gap-2">
                <template v-if="currentFolderId">
                    <button @click="goBack" class="p-1 hover:bg-white/10 rounded">
                        <ArrowLeft class="w-4 h-4" />
                    </button>
                    <div class="flex items-center gap-1 text-xs">
                        <span class="cursor-pointer hover:text-white" @click="currentFolderId = null">Raiz</span>
                        <ChevronRight class="w-3 h-3" />
                        <span class="text-white font-medium">{{ currentFolder?.name }}</span>
                    </div>
                </template>
                <template v-else>
                     <span class="text-xs font-medium pl-1">Minhas Pastas</span>
                </template>
            </div>
            <button 
                @click="dialog = { show: true, type: 'new_folder', inputValue: '', targetItem: null }" 
                class="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
                title="Nova Pasta"
            >
                <FolderInput class="w-3.5 h-3.5" />
            </button>
        </div>

        <!-- Grid Content -->
        <div 
            class="flex-1 overflow-y-auto custom-scrollbar p-3"
            @contextmenu="handleBackgroundContextMenu"
        >
            <div class="grid grid-cols-2 gap-2">
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
                        class="col-span-2 flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer text-zinc-400 hover:text-white border border-transparent hover:border-zinc-700 transition-all select-none"
                    >
                        <Folder class="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
                        <div class="flex flex-col">
                             <span class="text-xs font-medium">{{ item.name }}</span>
                             <span class="text-[9px] text-zinc-500">Pasta</span>
                        </div>
                    </div>

                    <!-- Render Files (Grid Style) -->
                    <div 
                        v-for="asset in currentItems.filter(i => i.type !== 'folder')" 
                        :key="asset.id"
                        class="aspect-square bg-zinc-800 rounded-lg overflow-hidden relative group cursor-grab active:cursor-grabbing border border-zinc-700 hover:border-zinc-500 transition-all"
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
                    <div 
                        v-for="asset in currentItems" 
                        :key="asset.id"
                        class="aspect-square bg-zinc-800 rounded-lg overflow-hidden relative group cursor-grab active:cursor-grabbing border border-zinc-700 hover:border-zinc-500 transition-all"
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
                             <div class="w-full h-full flex flex-col items-center justify-center p-2 text-zinc-500 bg-zinc-800/50">
                                <ShoppingCart class="w-6 h-6 mb-1 opacity-20" />
                                <span class="text-[9px] text-zinc-300 font-medium text-center line-clamp-2 leading-tight">{{ asset.name }}</span>
                                <span v-if="asset.price" class="text-[10px] text-green-400 font-bold mt-1">R$ {{ asset.price }}</span>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
            
            <div v-if="!currentItems.length" class="text-center py-10 text-zinc-600">
                <p class="text-[10px] uppercase tracking-widest">Vazio</p>
                <p v-if="activeCategory === 'folders' && !currentFolderId" class="text-[9px] mt-2">Clique com o botão direito para criar pasta (WIP)</p>
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
                            <option value="">Raiz</option>
                            <option v-for="target in availableMoveTargets" :key="target.id" :value="target.id">
                                {{ target.name }}
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
</template>

<style scoped>
/* Barra de rolagem vertical */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }

/* Barra de rolagem horizontal - sempre visível */
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #333 transparent;
}

/* Forçar scrollbar horizontal */
.overflow-x-auto {
    overflow-x: auto !important;
    scrollbar-width: thin;
    scrollbar-color: #444 transparent;
}

.overflow-x-auto::-webkit-scrollbar {
    height: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-track {
    background: transparent;
}
</style>
