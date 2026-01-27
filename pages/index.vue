<script setup lang="ts">
import { Search, Plus, Grid, List, FolderOpen, Star, Sparkles, LogOut, Folder, FolderPlus, MoreVertical, Pencil, Trash2 } from 'lucide-vue-next'
import FolderTreeItem from '~/components/FolderTreeItem.vue'

// Page config - middleware handles auth check
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false, // Desabilita SSR para evitar erros no servidor
})

// Composables
const auth = useAuth()
const supabase = useSupabase()
const { folders, loadFolders, createFolder, updateFolder, deleteFolder, toggleFolder, activeFolderId, setActiveFolder, expandedFolders, getChildren } = useFolder()

// State
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref<'recent' | 'name' | 'date'>('recent')
const showCreateProject = ref(false)
const showCreateFolder = ref(false)
const showFolderMenu = ref<string | null>(null)
const folderMenuPosition = ref({ x: 0, y: 0 })
const newProjectName = ref('')
const newFolderName = ref('')
const editingFolderId = ref<string | null>(null)
const editingFolderName = ref('')
const isLoading = ref(false)
const isLoadingProjects = ref(true)
const draggedProjectId = ref<string | null>(null)
const isMounted = ref(false)

// Projects data - initialize with empty arrays for SSR
const projects = ref<any[]>([])
const user = ref<any>(null)

// Helper to safely access projects
const safeProjects = computed(() => projects.value || [])
const safeFolders = computed(() => folders.value || [])

// Close folder menu when clicking outside - only on client
const folderMenuRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (process.client) {
    document.addEventListener('click', (e) => {
      if (showFolderMenu.value && !(e.target as HTMLElement)?.closest?.('.folder-context-menu')) {
        showFolderMenu.value = null
      }
    })
  }
})

// Load user profile, folders and projects
const loadData = async () => {
  isLoadingProjects.value = true
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', auth.user.value?.id || '')
      .single()

    if (profile) {
      user.value = profile
    }

    // Load folders
    await loadFolders()

    // Load projects with folder info
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    projects.value = projectsData || []
  } catch (error) {
    console.error('Error loading data:', error)
  } finally {
    isLoadingProjects.value = false
  }
}

// Load data on mount
onMounted(async () => {
  isMounted.value = true
  await auth.getSession()
  if (auth.user.value) {
    loadData()
  }
})

// Watch for auth user changes
watch(() => auth.user.value, (newUser) => {
  if (newUser) {
    loadData()
  }
})

// Computed: Folder tree with expansion state
const folderTree = computed(() => {
  // During SSR, return empty array to avoid issues
  if (process.server || !folders.value) return []

  const buildTree = (parentId: string | null = null, depth = 0) => {
    return folders.value
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .map(folder => ({
        ...folder,
        children: buildTree(folder.id, depth + 1),
        depth,
        isExpanded: expandedFolders.value.has(folder.id),
      }))
  }
  return buildTree()
})

// Computed: Projects in active folder (or all if no folder selected)
const activeFolderProjects = computed(() => {
  if (!activeFolderId.value) return []

  const getFolderTreeIds = (folderId: string): string[] => {
    const ids = [folderId]
    const children = getChildren(folderId)
    children.forEach(child => {
      ids.push(...getFolderTreeIds(child.id))
    })
    return ids
  }

  const folderIds = getFolderTreeIds(activeFolderId.value)
  return safeProjects.value.filter(p => p.folder_id && folderIds.includes(p.folder_id))
})

// Computed: Projects without folder (root level)
const rootProjects = computed(() => {
  return safeProjects.value.filter(p => !p.folder_id)
})

// Computed: Filtered and sorted projects
const filteredProjects = computed(() => {
  let result: any[]

  if (searchQuery.value) {
    result = safeProjects.value.filter(p =>
      p.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  } else if (activeFolderId.value) {
    result = activeFolderProjects.value
  } else {
    // Show all projects when no folder selected
    result = [...rootProjects.value, ...safeProjects.value.filter(p => p.folder_id)]
  }

  // Sort
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'recent') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    } else if (sortBy.value === 'name') {
      return (a.name || '').localeCompare(b.name || '')
    } else {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  return result
})

// Get project count for a folder
const getProjectCount = (folderId: string): number => {
  return safeProjects.value.filter(p => p.folder_id === folderId).length
}

// Helper: valid project name
const isValidProjectName = computed(() => {
  return newProjectName.value && newProjectName.value.trim().length > 0
})

// Helper: valid folder name
const isValidFolderName = computed(() => {
  return newFolderName.value && newFolderName.value.trim().length > 0
})

// Create project
const createProject = async () => {
  if (!isValidProjectName.value) return

  isLoading.value = true
  try {
    const initialPage = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Página 1',
      width: 1080,
      height: 1920,
      type: 'RETAIL_OFFER',
      canvasData: null,
      thumbnail: undefined,
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: newProjectName.value,
        canvas_data: [initialPage],
        folder_id: activeFolderId.value,
      })
      .select()
      .single()

    if (error) throw error

    if (data) {
      projects.value.unshift(data)
    }

    newProjectName.value = ''
    showCreateProject.value = false
    navigateTo(`/editor/${data.id}`)
  } catch (error: any) {
    console.error('Error creating project:', error)
    alert('Erro ao criar projeto. Tente novamente.')
  } finally {
    isLoading.value = false
  }
}

// Delete project
const deleteProject = async (projectId: string) => {
  if (!confirm('Tem certeza que deseja excluir este projeto?')) return

  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error
    projects.value = projects.value.filter(p => p.id !== projectId)
  } catch (error) {
    console.error('Error deleting project:', error)
    alert('Erro ao excluir projeto.')
  }
}

// Open project
const openProject = (projectId: string) => {
  navigateTo(`/editor/${projectId}`)
}

// Create folder
const handleCreateFolder = async () => {
  if (!isValidFolderName.value) return

  try {
    await createFolder(newFolderName.value, activeFolderId.value)
    newFolderName.value = ''
    showCreateFolder.value = false
  } catch (error) {
    alert('Erro ao criar pasta.')
  }
}

// Start editing folder name
const startEditFolder = (folder: any) => {
  editingFolderId.value = folder.id
  editingFolderName.value = folder.name
  showFolderMenu.value = null
}

// Save folder name
const saveFolderName = async () => {
  if (!editingFolderId.value || !editingFolderName.value.trim()) return

  try {
    await updateFolder(editingFolderId.value, { name: editingFolderName.value.trim() })
    editingFolderId.value = null
    editingFolderName.value = ''
  } catch (error) {
    alert('Erro ao renomear pasta.')
  }
}

// Cancel editing folder
const cancelEditFolder = () => {
  editingFolderId.value = null
  editingFolderName.value = ''
}

// Delete folder
const handleDeleteFolder = async (folderId: string) => {
  const hasChildren = getChildren(folderId).length > 0
  const projectCount = getProjectCount(folderId)

  let message = 'Tem certeza que deseja excluir esta pasta?'
  if (projectCount > 0) {
    message = `Esta pasta contém ${projectCount} projeto(s). Tem certeza que deseja excluir?`
  }
  if (hasChildren) {
    message += ' As subpastas também serão excluídas.'
  }

  if (!confirm(message)) return

  try {
    await deleteFolder(folderId)
    showFolderMenu.value = null
    if (activeFolderId.value === folderId) {
      activeFolderId.value = null
    }
  } catch (error) {
    alert('Erro ao excluir pasta.')
  }
}

// Show folder context menu
const showFolderContextMenu = (folderId: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  folderMenuPosition.value = { x: event.clientX, y: event.clientY }
  showFolderMenu.value = folderId
}

// Format date relative
const formatDistanceToNow = (date: string) => {
  const now = new Date()
  const projectDate = new Date(date)
  const diffInMs = now.getTime() - projectDate.getTime()
  const diffInMins = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMs / 3600000)
  const diffInDays = Math.floor(diffInMs / 864000)

  if (diffInMins < 1) return 'Agora'
  if (diffInMins < 60) return `${diffInMins}m atrás`
  if (diffInHours < 24) return `${diffInHours}h atrás`
  if (diffInDays < 7) return `${diffInDays}d atrás`
  return projectDate.toLocaleDateString('pt-BR')
}

// Handle sign out
const handleSignOut = async () => {
  await auth.signOut()
}

// Drag and drop handlers
const handleDragStart = (projectId: string, event: DragEvent) => {
  draggedProjectId.value = projectId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDropOnFolder = async (folderId: string, event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!draggedProjectId.value) return

  try {
    const { error } = await supabase
      .from('projects')
      .update({ folder_id: folderId })
      .eq('id', draggedProjectId.value)

    if (error) throw error

    const project = projects.value.find(p => p.id === draggedProjectId.value)
    if (project) {
      project.folder_id = folderId
    }
  } catch (error) {
    console.error('Error moving project:', error)
    alert('Erro ao mover projeto.')
  }

  draggedProjectId.value = null
}

const handleDropOnRoot = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!draggedProjectId.value) return

  try {
    const { error } = await supabase
      .from('projects')
      .update({ folder_id: null })
      .eq('id', draggedProjectId.value)

    if (error) throw error

    const project = projects.value.find(p => p.id === draggedProjectId.value)
    if (project) {
      project.folder_id = null
    }
  } catch (error) {
    console.error('Error moving project:', error)
    alert('Erro ao mover projeto.')
  }

  draggedProjectId.value = null
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Animated Background -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
    </div>

    <div class="relative z-10 flex h-screen">
      <!-- Sidebar -->
      <aside class="w-64 border-r border-border/50 bg-card/40 backdrop-blur-sm flex flex-col">
        <!-- Sidebar Header -->
        <div class="p-4 border-b border-border/50">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles class="w-4 h-4 text-primary" />
            </div>
            <span class="font-bold text-sm">Studio PRO</span>
          </div>
        </div>

        <!-- Search -->
        <div class="p-3">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar designs..."
              class="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>

        <!-- Folders Section -->
        <div class="flex-1 overflow-y-auto px-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pastas</span>
            <button
              @click="showCreateFolder = true"
              class="p-1 hover:bg-muted rounded transition-colors"
              title="Nova pasta"
            >
              <FolderPlus class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <!-- All Projects (root) -->
          <div
            :class="[
              'flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors mb-1',
              !activeFolderId ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
            ]"
            @click="setActiveFolder(null)"
            @dragover="handleDragOver"
            @drop="handleDropOnRoot"
          >
            <FolderOpen class="w-4 h-4" />
            <span class="text-sm">Todos os Designs</span>
            <span class="ml-auto text-xs text-muted-foreground">{{ rootProjects.length }}</span>
          </div>

          <!-- Folder Tree -->
          <div class="folder-tree">
            <template v-if="isMounted">
              <FolderTreeItem
                v-for="folder in folderTree"
                :key="folder.id"
                :folder="folder"
                :level="0"
                :is-active="activeFolderId === folder.id"
                :is-expanded="folder.isExpanded"
                :project-count="getProjectCount(folder.id)"
                :is-editing="editingFolderId === folder.id"
                :editing-name="editingFolderName"
                :active-folder-id="activeFolderId"
                :editing-folder-id="editingFolderId"
                :expanded-folders="expandedFolders"
                @select="(id: string) => setActiveFolder(id)"
                @toggle="(id: string) => toggleFolder(id)"
                @context-menu="(e: MouseEvent, id: string) => { e.stopPropagation(); showFolderContextMenu(id, e) }"
                @update-name="(name: string) => editingFolderName = name"
                @drop-on-folder="handleDropOnFolder"
                @save-edit="saveFolderName"
                @cancel-edit="cancelEditFolder"
              />
            </template>
          </div>
        </div>

        <!-- User Section -->
        <div class="p-3 border-t border-border/50">
          <div v-if="user" class="flex items-center gap-2">
            <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span class="text-xs font-medium text-primary">{{ user.name?.charAt(0) || 'U' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ user.name }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ user.email }}</p>
            </div>
            <button
              @click="handleSignOut"
              class="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <!-- Header -->
        <header class="h-14 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold">
              <span v-if="activeFolderId">{{ folders.find(f => f.id === activeFolderId)?.name || 'Pasta' }}</span>
              <span v-else-if="searchQuery">Resultados da busca</span>
              <span v-else>Todos os Designs</span>
            </h1>
            <span class="text-sm text-muted-foreground">({{ filteredProjects.length }})</span>
          </div>

          <div class="flex items-center gap-3">
            <!-- Sort -->
            <select
              v-model="sortBy"
              class="px-3 py-2 bg-muted/50 hover:bg-muted border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
            >
              <option value="recent">Recentes</option>
              <option value="name">Nome</option>
              <option value="date">Data</option>
            </select>

            <!-- View Mode -->
            <div class="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
              <button
                @click="viewMode = 'grid'"
                :class="['p-1.5 rounded transition-colors', viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50']"
              >
                <Grid class="w-4 h-4" />
              </button>
              <button
                @click="viewMode = 'list'"
                :class="['p-1.5 rounded transition-colors', viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50']"
              >
                <List class="w-4 h-4" />
              </button>
            </div>

            <!-- New Project Button -->
            <button
              @click="showCreateProject = true"
              class="btn-primary flex items-center gap-2"
            >
              <Plus class="w-4 h-4" />
              <span>Novo Design</span>
            </button>
          </div>
        </header>

        <!-- Projects Grid/List -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Loading State -->
          <div v-if="isLoadingProjects" class="flex items-center justify-center h-full">
            <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>

          <!-- Projects Grid -->
          <div
            v-else-if="filteredProjects.length > 0"
            class="grid gap-4"
            :class="viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1'"
          >
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="group relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
              draggable="true"
              @dragstart="handleDragStart(project.id, $event)"
              @click="openProject(project.id)"
            >
              <!-- Thumbnail -->
              <div class="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 relative">
                <img
                  v-if="project.preview_url"
                  :src="project.preview_url"
                  class="w-full h-full object-cover"
                  :alt="project.name"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Sparkles class="w-8 h-8 text-primary/30" />
                </div>
              </div>

              <!-- Content -->
              <div class="p-3">
                <h3 class="font-medium text-sm text-foreground mb-1 truncate">{{ project.name || 'Sem título' }}</h3>
                <p class="text-xs text-muted-foreground">{{ formatDistanceToNow(project.created_at) }}</p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen class="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 class="text-lg font-semibold mb-2">
                <span v-if="searchQuery">Nenhum resultado encontrado</span>
                <span v-else-if="activeFolderId">Pasta vazia</span>
                <span v-else>Nenhum projeto ainda</span>
              </h3>
              <p class="text-sm text-muted-foreground mb-6">
                <span v-if="searchQuery">Tente outra busca</span>
                <span v-else>Crie seu primeiro design para começar</span>
              </p>
              <button
                v-if="!searchQuery"
                @click="showCreateProject = true"
                class="btn-primary inline-flex items-center gap-2"
              >
                <Plus class="w-4 h-4" />
                Criar Design
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Create Project Modal -->
    <div
      v-if="showCreateProject"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="showCreateProject = false"
    >
      <div class="glass-card w-full max-w-md p-6">
        <h3 class="text-lg font-semibold mb-4">Novo Design</h3>
        <p class="text-sm text-muted-foreground mb-4">
          <span v-if="activeFolderId">Criar em: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Criar na raiz</span>
        </p>
        <input
          v-model="newProjectName"
          type="text"
          placeholder="Nome do projeto..."
          class="w-full px-4 py-3 bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4"
          @keyup.enter="createProject()"
        />
        <div class="flex gap-3">
          <button
            @click="showCreateProject = false"
            class="flex-1 px-4 py-2.5 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="createProject()"
            :disabled="isLoading || !isValidProjectName"
            class="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {{ isLoading ? 'Criando...' : 'Criar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Folder Modal -->
    <div
      v-if="showCreateFolder"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="showCreateFolder = false"
    >
      <div class="glass-card w-full max-w-md p-6">
        <h3 class="text-lg font-semibold mb-4">Nova Pasta</h3>
        <p class="text-sm text-muted-foreground mb-4">
          <span v-if="activeFolderId">Criar dentro de: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Criar na raiz</span>
        </p>
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Nome da pasta..."
          class="w-full px-4 py-3 bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 mb-4"
          @keyup.enter="handleCreateFolder()"
        />
        <div class="flex gap-3">
          <button
            @click="showCreateFolder = false"
            class="flex-1 px-4 py-2.5 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="handleCreateFolder()"
            :disabled="!isValidFolderName"
            class="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>
    </div>

    <!-- Folder Context Menu -->
    <teleport to="body">
      <div
        v-if="showFolderMenu"
        class="fixed z-[100] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
        :style="{ left: `${folderMenuPosition.x}px`, top: `${folderMenuPosition.y}px` }"
      >
        <button
          @click="startEditFolder(folders.find(f => f.id === showFolderMenu))"
          class="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"
        >
          <Pencil class="w-4 h-4" />
          Renomear
        </button>
        <button
          @click="handleDeleteFolder(showFolderMenu)"
          class="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors"
        >
          <Trash2 class="w-4 h-4" />
          Excluir
        </button>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
@reference "../assets/css/main.css";

.glass-card {
  @apply bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl;
}

.btn-primary {
  @apply px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200;
}

.folder-tree {
  user-select: none;
}
</style>
