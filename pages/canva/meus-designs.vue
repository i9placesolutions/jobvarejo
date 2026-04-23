<script setup lang="ts">
import {
  FolderOpen, FolderPlus, Search, Loader2, Image, Layers,
  ExternalLink, Pencil, Trash2, MoveRight, MoreVertical,
  X, Plus, Clock, Filter, ChevronRight,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'canva',
  middleware: 'builder-auth',
  ssr: false,
})

// Interfaces
interface MyDesign {
  id: string
  title: string
  canva_design_id: string
  canva_edit_url: string | null
  canva_view_url: string | null
  folder_id: string | null
  template_id: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

interface CanvaFolder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

interface BreadcrumbItem {
  id: string | null
  name: string
}

// Estado reativo
const designs = ref<MyDesign[]>([])
const folders = ref<CanvaFolder[]>([])
const allFolders = ref<CanvaFolder[]>([])
const isLoadingDesigns = ref(false)
const isLoadingFolders = ref(false)
const currentFolderId = ref<string | null>(null)
const breadcrumbs = ref<BreadcrumbItem[]>([{ id: null, name: 'Raiz' }])
const searchQuery = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const activeStatus = ref<'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('ALL')

// Modais
const showCreateFolderModal = ref(false)
const showRenameFolderModal = ref(false)
const showMoveFolderModal = ref(false)
const showDeleteConfirm = ref(false)
const newFolderName = ref('')
const renameFolderName = ref('')
const selectedFolder = ref<CanvaFolder | null>(null)
const selectedDesign = ref<MyDesign | null>(null)
const moveTargetFolderId = ref<string | null>(null)
const deleteTarget = ref<{ type: 'folder' | 'design'; id: string; name: string } | null>(null)

// Menu de contexto
const openMenuId = ref<string | null>(null)

const toggleMenu = (id: string) => {
  openMenuId.value = openMenuId.value === id ? null : id
}

const closeMenus = () => {
  openMenuId.value = null
}

// Buscar designs
const fetchDesigns = async () => {
  isLoadingDesigns.value = true
  try {
    const params: Record<string, string> = {}
    if (currentFolderId.value) params.folder_id = currentFolderId.value
    if (activeStatus.value !== 'ALL') params.status = activeStatus.value
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()

    const query = new URLSearchParams(params).toString()
    const data = await $fetch<MyDesign[]>(`/api/canva/my-designs${query ? '?' + query : ''}`)
    designs.value = data || []
  } catch (err: unknown) {
    console.error('Erro ao buscar designs:', err)
    designs.value = []
  } finally {
    isLoadingDesigns.value = false
  }
}

// Buscar pastas
const fetchFolders = async () => {
  isLoadingFolders.value = true
  try {
    const params: Record<string, string> = {}
    if (currentFolderId.value) params.parent_id = currentFolderId.value

    const query = new URLSearchParams(params).toString()
    const data = await $fetch<CanvaFolder[]>(`/api/canva/folders${query ? '?' + query : ''}`)
    folders.value = data || []
  } catch (err: unknown) {
    console.error('Erro ao buscar pastas:', err)
    folders.value = []
  } finally {
    isLoadingFolders.value = false
  }
}

// Buscar todas as pastas (para o modal de mover)
const fetchAllFolders = async () => {
  try {
    const data = await $fetch<CanvaFolder[]>('/api/canva/folders')
    allFolders.value = data || []
  } catch (err: unknown) {
    console.error('Erro ao buscar todas as pastas:', err)
    allFolders.value = []
  }
}

// Carregar dados da pasta atual
const loadCurrentFolder = async () => {
  await Promise.all([fetchFolders(), fetchDesigns()])
}

// Navegar para pasta
const navigateToFolder = async (folder: CanvaFolder) => {
  closeMenus()
  currentFolderId.value = folder.id
  breadcrumbs.value.push({ id: folder.id, name: folder.name })
  await loadCurrentFolder()
}

// Navegar via breadcrumb
const navigateToBreadcrumb = async (index: number) => {
  closeMenus()
  const item = breadcrumbs.value[index]
  if (!item) return
  currentFolderId.value = item.id
  breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
  await loadCurrentFolder()
}

// Busca com debounce
const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    fetchDesigns()
  }, 400)
}

// Trocar filtro de status
const setStatusFilter = (status: 'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
  activeStatus.value = status
  fetchDesigns()
}

// Criar pasta
const createFolder = async () => {
  if (!newFolderName.value.trim()) return
  try {
    const body: Record<string, string> = { name: newFolderName.value.trim() }
    if (currentFolderId.value) body.parent_id = currentFolderId.value

    await $fetch('/api/canva/folders', { method: 'POST', body })
    showCreateFolderModal.value = false
    newFolderName.value = ''
    await fetchFolders()
  } catch (err: unknown) {
    console.error('Erro ao criar pasta:', err)
  }
}

// Renomear pasta
const openRenameFolder = (folder: CanvaFolder) => {
  closeMenus()
  selectedFolder.value = folder
  renameFolderName.value = folder.name
  showRenameFolderModal.value = true
}

const renameFolder = async () => {
  if (!selectedFolder.value || !renameFolderName.value.trim()) return
  try {
    await $fetch(`/api/canva/folders/${selectedFolder.value.id}`, {
      method: 'PUT',
      body: { name: renameFolderName.value.trim() },
    })
    showRenameFolderModal.value = false
    selectedFolder.value = null
    renameFolderName.value = ''
    await fetchFolders()
  } catch (err: unknown) {
    console.error('Erro ao renomear pasta:', err)
  }
}

// Deletar pasta ou design
const openDeleteConfirm = (type: 'folder' | 'design', id: string, name: string) => {
  closeMenus()
  deleteTarget.value = { type, id, name }
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  if (!deleteTarget.value) return
  try {
    const endpoint = deleteTarget.value.type === 'folder'
      ? `/api/canva/folders/${deleteTarget.value.id}`
      : `/api/canva/my-designs/${deleteTarget.value.id}`

    await $fetch(endpoint, { method: 'DELETE' })
    showDeleteConfirm.value = false
    deleteTarget.value = null
    await loadCurrentFolder()
  } catch (err: unknown) {
    console.error('Erro ao deletar:', err)
  }
}

// Mover design para pasta
const openMoveDesign = async (design: MyDesign) => {
  closeMenus()
  selectedDesign.value = design
  moveTargetFolderId.value = design.folder_id
  await fetchAllFolders()
  showMoveFolderModal.value = true
}

const moveDesign = async () => {
  if (!selectedDesign.value) return
  try {
    await $fetch(`/api/canva/my-designs/${selectedDesign.value.id}`, {
      method: 'PUT',
      body: { folder_id: moveTargetFolderId.value },
    })
    showMoveFolderModal.value = false
    selectedDesign.value = null
    moveTargetFolderId.value = null
    await fetchDesigns()
  } catch (err: unknown) {
    console.error('Erro ao mover design:', err)
  }
}

// Formatar data
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffHours < 1) return 'agora'
    if (diffHours < 24) return `${diffHours}h atras`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d atras`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return '--'
  }
}

// Labels e cores de status
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Rascunho', color: 'text-amber-400', bg: 'bg-amber-500/15' },
  PUBLISHED: { label: 'Publicado', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  ARCHIVED: { label: 'Arquivado', color: 'text-zinc-400', bg: 'bg-zinc-500/15' },
}

const statusTabs = [
  { key: 'ALL' as const, label: 'Todos' },
  { key: 'DRAFT' as const, label: 'Rascunhos' },
  { key: 'PUBLISHED' as const, label: 'Publicados' },
  { key: 'ARCHIVED' as const, label: 'Arquivados' },
]

// Verifica se esta carregando
const isLoading = computed(() => isLoadingDesigns.value || isLoadingFolders.value)

// Verifica se esta vazio (sem pastas e sem designs)
const isEmpty = computed(() => !isLoading.value && folders.value.length === 0 && designs.value.length === 0)

// Fechar menu ao clicar fora
const handleClickOutside = () => {
  closeMenus()
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await loadCurrentFolder()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Meus Designs</h1>
        <p class="text-sm text-zinc-500 mt-1">Gerencie seus designs organizados por pastas</p>
      </div>
      <button
        @click="showCreateFolderModal = true"
        class="inline-flex items-center justify-center gap-2 h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all border border-violet-400/20 shrink-0"
      >
        <FolderPlus class="w-4 h-4" />
        <span>Nova Pasta</span>
      </button>
    </div>

    <!-- Breadcrumbs -->
    <nav class="flex items-center gap-1 mb-6 text-sm overflow-x-auto pb-1">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id ?? 'root'">
        <ChevronRight v-if="index > 0" class="w-3.5 h-3.5 text-zinc-600 shrink-0" />
        <button
          @click="navigateToBreadcrumb(index)"
          class="px-2 py-1 rounded-md transition-colors whitespace-nowrap shrink-0"
          :class="index === breadcrumbs.length - 1
            ? 'text-violet-400 font-medium bg-violet-500/10'
            : 'text-zinc-400 hover:text-white hover:bg-white/5'"
        >
          {{ crumb.name }}
        </button>
      </template>
    </nav>

    <!-- Filtros: Tabs de status + busca -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
      <!-- Tabs de status -->
      <div class="flex items-center gap-1 bg-[#18181b]/60 border border-white/5 rounded-xl p-1">
        <button
          v-for="tab in statusTabs"
          :key="tab.key"
          @click="setStatusFilter(tab.key)"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          :class="activeStatus === tab.key
            ? 'bg-violet-600 text-white shadow-sm'
            : 'text-zinc-400 hover:text-white hover:bg-white/5'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Campo de busca -->
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          placeholder="Buscar design por titulo..."
          class="w-full h-10 pl-10 pr-4 bg-[#18181b]/60 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && folders.length === 0 && designs.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden animate-pulse"
      >
        <div class="aspect-square bg-white/5" />
        <div class="p-4 space-y-2">
          <div class="h-4 bg-white/5 rounded w-3/4" />
          <div class="h-3 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="isEmpty"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="w-20 h-20 bg-[#18181b]/80 border border-white/5 rounded-2xl flex items-center justify-center mb-6">
        <Image class="w-10 h-10 text-zinc-600" />
      </div>
      <h2 class="text-lg font-semibold text-zinc-300 mb-2">
        {{ searchQuery ? 'Nenhum design encontrado' : 'Nenhum design ainda' }}
      </h2>
      <p class="text-sm text-zinc-500 max-w-md mb-6">
        {{ searchQuery
          ? 'Tente outro termo de busca ou limpe o filtro.'
          : 'Comece criando designs a partir dos templates disponiveis.' }}
      </p>
      <NuxtLink
        v-if="!searchQuery"
        to="/canva"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all border border-violet-400/20"
      >
        <Layers class="w-4 h-4" />
        Ver Templates
      </NuxtLink>
    </div>

    <!-- Grid misto: Pastas + Designs -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <!-- Pastas -->
      <div
        v-for="folder in folders"
        :key="'folder-' + folder.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-[#18181b] transition-all duration-300 cursor-pointer"
        @click="navigateToFolder(folder)"
      >
        <div class="aspect-square bg-[#09090b] flex items-center justify-center relative">
          <FolderOpen class="w-16 h-16 text-violet-500/40 group-hover:text-violet-500/60 transition-colors" />

          <!-- Menu da pasta -->
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
            <button
              @click.stop="toggleMenu('folder-' + folder.id)"
              class="p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <MoreVertical class="w-4 h-4" />
            </button>

            <!-- Dropdown -->
            <div
              v-if="openMenuId === 'folder-' + folder.id"
              class="absolute right-0 top-9 w-44 bg-[#1e1e21] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50"
            >
              <button
                @click.stop="openRenameFolder(folder)"
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Pencil class="w-3.5 h-3.5" />
                Renomear
              </button>
              <button
                @click.stop="openDeleteConfirm('folder', folder.id, folder.name)"
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
                Deletar
              </button>
            </div>
          </div>
        </div>

        <div class="p-4">
          <h3 class="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
            {{ folder.name }}
          </h3>
          <div class="flex items-center gap-2 mt-2">
            <Clock class="w-3 h-3 text-zinc-600" />
            <span class="text-[11px] text-zinc-500">{{ formatDate(folder.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Designs -->
      <div
        v-for="design in designs"
        :key="'design-' + design.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-[#18181b] transition-all duration-300 cursor-pointer"
        @click="navigateTo(`/canva/${design.id}`)"
      >
        <!-- Thumbnail -->
        <div class="aspect-square bg-[#09090b] relative overflow-hidden">
          <img
            v-if="design.thumbnail_url"
            :src="design.thumbnail_url"
            :alt="design.title"
            class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Image class="w-12 h-12 text-zinc-700" />
          </div>

          <!-- Overlay -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span class="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg shadow-lg">
              Abrir Design
            </span>
          </div>

          <!-- Badge de status -->
          <div
            class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold"
            :class="[statusConfig[design.status]?.bg, statusConfig[design.status]?.color]"
          >
            {{ statusConfig[design.status]?.label || design.status }}
          </div>

          <!-- Menu do design -->
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
            <button
              @click.stop="toggleMenu('design-' + design.id)"
              class="p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <MoreVertical class="w-4 h-4" />
            </button>

            <!-- Dropdown -->
            <div
              v-if="openMenuId === 'design-' + design.id"
              class="absolute right-0 top-9 w-48 bg-[#1e1e21] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50"
            >
              <a
                v-if="design.canva_edit_url"
                :href="design.canva_edit_url"
                target="_blank"
                @click.stop
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                Abrir no Canva
              </a>
              <button
                @click.stop="navigateTo(`/canva/${design.id}`)"
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Pencil class="w-3.5 h-3.5" />
                Editar Produtos
              </button>
              <button
                @click.stop="openMoveDesign(design)"
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <MoveRight class="w-3.5 h-3.5" />
                Mover para Pasta
              </button>
              <div class="my-1 border-t border-white/5" />
              <button
                @click.stop="openDeleteConfirm('design', design.id, design.title)"
                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
                Deletar
              </button>
            </div>
          </div>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
            {{ design.title || 'Sem titulo' }}
          </h3>
          <div class="flex items-center gap-2 mt-2">
            <Clock class="w-3 h-3 text-zinc-600" />
            <span class="text-[11px] text-zinc-500">{{ formatDate(design.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Criar Pasta -->
    <Teleport to="body">
      <div
        v-if="showCreateFolderModal"
        class="fixed inset-0 z-[100] flex items-center justify-center"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showCreateFolderModal = false" />

        <!-- Conteudo -->
        <div class="relative w-full max-w-md mx-4 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl">
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 class="text-base font-semibold text-white">Nova Pasta</h2>
            <button
              @click="showCreateFolderModal = false"
              class="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="px-6 py-5">
            <label class="block text-xs text-zinc-400 mb-2">Nome da pasta</label>
            <input
              v-model="newFolderName"
              @keydown.enter="createFolder"
              placeholder="Ex: Ofertas Semanais"
              autofocus
              class="w-full h-11 px-4 bg-[#09090b] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
            <button
              @click="showCreateFolderModal = false"
              class="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="createFolder"
              :disabled="!(newFolderName || '').trim()"
              class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all border border-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: Renomear Pasta -->
    <Teleport to="body">
      <div
        v-if="showRenameFolderModal"
        class="fixed inset-0 z-[100] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showRenameFolderModal = false" />

        <div class="relative w-full max-w-md mx-4 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl">
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 class="text-base font-semibold text-white">Renomear Pasta</h2>
            <button
              @click="showRenameFolderModal = false"
              class="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="px-6 py-5">
            <label class="block text-xs text-zinc-400 mb-2">Novo nome</label>
            <input
              v-model="renameFolderName"
              @keydown.enter="renameFolder"
              placeholder="Nome da pasta"
              autofocus
              class="w-full h-11 px-4 bg-[#09090b] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
            <button
              @click="showRenameFolderModal = false"
              class="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="renameFolder"
              :disabled="!(renameFolderName || '').trim()"
              class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all border border-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: Mover Design para Pasta -->
    <Teleport to="body">
      <div
        v-if="showMoveFolderModal"
        class="fixed inset-0 z-[100] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showMoveFolderModal = false" />

        <div class="relative w-full max-w-md mx-4 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl">
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 class="text-base font-semibold text-white">Mover Design</h2>
            <button
              @click="showMoveFolderModal = false"
              class="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="px-6 py-5">
            <p class="text-xs text-zinc-400 mb-3">
              Movendo: <span class="text-white font-medium">{{ selectedDesign?.title || 'Sem titulo' }}</span>
            </p>

            <label class="block text-xs text-zinc-400 mb-2">Selecione a pasta de destino</label>

            <div class="space-y-1.5 max-h-60 overflow-y-auto">
              <!-- Opcao: Raiz (sem pasta) -->
              <button
                @click="moveTargetFolderId = null"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                :class="moveTargetFolderId === null
                  ? 'bg-violet-600/20 border border-violet-500/30 text-violet-300'
                  : 'bg-white/5 border border-transparent text-zinc-300 hover:bg-white/10'"
              >
                <FolderOpen class="w-4 h-4 shrink-0" />
                <span>Raiz (sem pasta)</span>
              </button>

              <!-- Lista de pastas -->
              <button
                v-for="folder in allFolders"
                :key="folder.id"
                @click="moveTargetFolderId = folder.id"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                :class="moveTargetFolderId === folder.id
                  ? 'bg-violet-600/20 border border-violet-500/30 text-violet-300'
                  : 'bg-white/5 border border-transparent text-zinc-300 hover:bg-white/10'"
              >
                <FolderOpen class="w-4 h-4 shrink-0" />
                <span>{{ folder.name }}</span>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
            <button
              @click="showMoveFolderModal = false"
              class="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="moveDesign"
              class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all border border-violet-400/20"
            >
              Mover
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal: Confirmar Exclusao -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-[100] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showDeleteConfirm = false" />

        <div class="relative w-full max-w-sm mx-4 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl">
          <div class="px-6 py-5 text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-red-500/15 rounded-xl flex items-center justify-center">
              <Trash2 class="w-6 h-6 text-red-400" />
            </div>
            <h2 class="text-base font-semibold text-white mb-2">Confirmar exclusao</h2>
            <p class="text-sm text-zinc-400">
              Tem certeza que deseja deletar
              {{ deleteTarget?.type === 'folder' ? 'a pasta' : 'o design' }}
              <span class="text-white font-medium">"{{ deleteTarget?.name }}"</span>?
            </p>
            <p v-if="deleteTarget?.type === 'folder'" class="text-xs text-red-400/80 mt-2">
              Os designs dentro desta pasta podem ser afetados.
            </p>
          </div>

          <div class="flex items-center gap-3 px-6 py-4 border-t border-white/5">
            <button
              @click="showDeleteConfirm = false"
              class="flex-1 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="confirmDelete"
              class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Deletar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
