<script setup lang="ts">
import { Search, Plus, Grid, List, FolderOpen, Star, Sparkles, LogOut, Folder, FolderPlus, MoreVertical, Pencil, Trash2, Copy, Clock, Users, Bell, ChevronDown } from 'lucide-vue-next'
	import FolderTreeItem from '~/components/FolderTreeItem.vue'
	import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
	import { toWasabiProxyUrl } from '~/utils/storageProxy'
import type { Folder as FolderModel } from '~/types/folder'

// Page config - middleware handles auth check
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false, // Desabilita SSR para evitar erros no servidor
})

// Composables
const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()
const { folders, loadFolders, createFolder, updateFolder, deleteFolder, toggleFolder, activeFolderId, setActiveFolder, expandedFolders, getChildren } = useFolder()

// State
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref<'recent' | 'name' | 'date'>('recent')
const activeView = ref<'recent' | 'all' | 'shared' | 'starred'>('recent')
const filterOrganization = ref('all')
const filterType = ref('all')
const filterTime = ref('all')
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

// Project menu state
const showProjectMenu = ref<string | null>(null)
const projectMenuPosition = ref({ x: 0, y: 0 })
const editingProjectId = ref<string | null>(null)
const editingProjectName = ref('')
const renamingProjectId = ref<string | null>(null)

// Confirmation dialog state
const showConfirmDialog = ref(false)
const confirmDialogData = ref({
  title: '',
  message: '',
  action: null as (() => void) | null,
  variant: 'danger' as 'danger' | 'warning' | 'info'
})

// Notifications state
const showNotifications = ref(false)
const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const notificationButtonRef = ref<HTMLElement | null>(null)
const showWorkspaceMenu = ref(false)

// Delete confirmation modal
const showDeleteConfirm = ref(false)
const projectToDelete = ref<string | null>(null)
const projectToDeleteName = ref('')

// Projects data - initialize with empty arrays for SSR
const projects = ref<any[]>([])
const user = ref<any>(null)

// Helper to safely access projects
const safeProjects = computed(() => projects.value || [])
const safeFolders = computed(() => folders.value || [])

// Close menus when clicking outside - only on client
const folderMenuRef = ref<HTMLElement | null>(null)
const handleContextMenusOutsideClick = (e: Event) => {
  const target = e.target as HTMLElement | null
  if (showFolderMenu.value && !target?.closest?.('.folder-context-menu')) {
    showFolderMenu.value = null
  }
  if (showProjectMenu.value && !target?.closest?.('.project-context-menu')) {
    showProjectMenu.value = null
  }
  if (
    showWorkspaceMenu.value &&
    !target?.closest?.('.workspace-menu') &&
    !target?.closest?.('.workspace-trigger')
  ) {
    showWorkspaceMenu.value = false
  }
}
const handleNotificationsOutsideClick = (e: Event) => {
  const target = e.target as HTMLElement | null
  if (
    showNotifications.value &&
    !target?.closest?.('.notifications-modal') &&
    !target?.closest?.('.notification-button')
  ) {
    showNotifications.value = false
  }
}

// Load user profile, folders and projects
const loadData = async () => {
  isLoadingProjects.value = true
  try {
    const userId = auth.user.value?.id
    if (!userId) {
      isLoadingProjects.value = false
      return
    }

    // Get user profile
    const headers = await getApiAuthHeaders()
    const profile = await $fetch('/api/profile', { headers }).catch(() => null)
    if (profile) user.value = profile

    // Load folders
    await loadFolders()

    const projectsData = await $fetch('/api/projects', {
      headers
    })
    projects.value = (Array.isArray(projectsData) ? projectsData : []).map((p: any) => {
      if (p?.preview_url) p.preview_url = toWasabiProxyUrl(p.preview_url)
      // reset image error state if we previously failed with a non-proxied URL
      if (p && typeof p === 'object') p._thumbError = false
      return p
    })
	  } catch (error) {
	    console.error('Error loading data:', error)
	    projects.value = []
	  } finally {
    isLoadingProjects.value = false
  }
}

// Update last_viewed when project is opened
const updateLastViewed = async (projectId: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id: projectId, last_viewed: new Date().toISOString() }
    })
    
    // Update local state
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.last_viewed = new Date().toISOString()
    }
  } catch (error) {
    console.error('Error updating last_viewed:', error)
  }
}

// Toggle starred status
const toggleStarred = async (projectId: string) => {
  try {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return

    const newStarredValue = !project.is_starred

    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id: projectId, is_starred: newStarredValue }
    })

    // Update local state
    project.is_starred = newStarredValue
  } catch (error) {
    console.error('Error toggling starred:', error)
    alert('Erro ao atualizar favorito.')
  }
}

// Load notifications via server API
const loadNotifications = async () => {
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch('/api/notifications', {
      headers,
      query: { limit: 50 }
    })
    notifications.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error loading notifications:', error)
    notifications.value = []
  }
}

// Toggle notifications modal
const toggleNotifications = async () => {
  showWorkspaceMenu.value = false
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    await loadNotifications()
  }
}

const toggleWorkspaceMenu = () => {
  showNotifications.value = false
  showWorkspaceMenu.value = !showWorkspaceMenu.value
}

// Mark notification as read
const markAsRead = async (notificationId: string) => {
  try {
    const notification = notifications.value.find(n => n.id === notificationId)
    if (!notification || notification.read) return

    const headers = await getApiAuthHeaders()
    await $fetch('/api/notifications', {
      method: 'PATCH',
      headers,
      body: { id: notificationId, read: true }
    })

    notification.read = true
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}

// Mark all as read
const markAllAsRead = async () => {
  try {
    const unreadIds = notifications.value.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    const headers = await getApiAuthHeaders()
    await $fetch('/api/notifications', {
      method: 'PATCH',
      headers,
      body: { ids: unreadIds, read: true }
    })

    notifications.value.forEach(n => {
      if (!n.read) n.read = true
    })
  } catch (error) {
    console.error('Error marking all as read:', error)
  }
}

// Load data on mount
onMounted(async () => {
  isMounted.value = true
  await auth.getSession()
  if (auth.user.value) {
    loadData()
    loadNotifications()
  }
  
  // Global click handlers
  if (process.client) {
    document.addEventListener('click', handleContextMenusOutsideClick)
    document.addEventListener('click', handleNotificationsOutsideClick)
  }
})

onUnmounted(() => {
  if (process.client) {
    document.removeEventListener('click', handleContextMenusOutsideClick)
    document.removeEventListener('click', handleNotificationsOutsideClick)
  }
})

// Watch for auth user changes
watch(() => auth.user.value, (newUser) => {
  if (newUser) {
    loadData()
    loadNotifications()
  } else {
    notifications.value = []
  }
})

// Prevent stale folder filter from hiding all projects when user switches view.
watch(activeView, (view) => {
  if (view !== 'all' && activeFolderId.value) {
    setActiveFolder(null)
  }
})

// Computed: Folder tree with expansion state
type FolderTreeNode = FolderModel & {
  children: FolderTreeNode[]
  depth: number
  isExpanded: boolean
}

const folderTree = computed<FolderTreeNode[]>(() => {
  // During SSR, return empty array to avoid issues
  if (process.server || !folders.value) return []

  const buildTree = (parentId: string | null = null, depth = 0): FolderTreeNode[] => {
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

// Computed: Starred projects count
const starredProjectsCount = computed(() => {
  return safeProjects.value.filter(p => p.is_starred === true).length
})

// Computed: Projects based on active view
const viewProjects = computed(() => {
  let result: any[] = []

  if (activeView.value === 'recent') {
    // Recently viewed - order by last_viewed, fallback to updated_at
    result = [...safeProjects.value].sort((a, b) => {
      const aTime = a.last_viewed ? new Date(a.last_viewed).getTime() : (a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime())
      const bTime = b.last_viewed ? new Date(b.last_viewed).getTime() : (b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime())
      return bTime - aTime
    })
  } else if (activeView.value === 'shared') {
    // Shared files - projects marked as shared
    result = safeProjects.value.filter(p => p.is_shared === true)
  } else if (activeView.value === 'starred') {
    // Starred projects
    result = safeProjects.value.filter(p => p.is_starred === true)
  } else if (activeView.value === 'all') {
    // All projects
    result = safeProjects.value
  }

  return result
})

// Computed: Filtered and sorted projects
const filteredProjects = computed(() => {
  let result: any[] = []

  // Start with view-based filtering
  if (searchQuery.value) {
    result = viewProjects.value.filter(p =>
      p.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  } else if (activeFolderId.value && activeView.value === 'all') {
    // Filter by folder
    const folderIds = [activeFolderId.value]
    const getFolderTreeIds = (folderId: string): string[] => {
      const ids = [folderId]
      const children = getChildren(folderId)
      children.forEach(child => {
        ids.push(...getFolderTreeIds(child.id))
      })
      return ids
    }
    const allFolderIds = getFolderTreeIds(activeFolderId.value)
    result = viewProjects.value.filter(p => p.folder_id && allFolderIds.includes(p.folder_id))
  } else {
    result = viewProjects.value
  }

  // Apply additional filters
  if (filterOrganization.value === 'personal') {
    result = result.filter(p => !p.is_shared)
  } else if (filterOrganization.value === 'team') {
    result = result.filter(p => p.is_shared === true)
  }

  if (filterType.value === 'design') {
    // Assuming all projects are designs for now
    result = result
  } else if (filterType.value === 'template') {
    // Filter templates if we add a type field later
    result = result
  }

  // Apply time filter
  const now = new Date()
  if (filterTime.value === 'today') {
    const todayStart = new Date(now.setHours(0, 0, 0, 0))
    result = result.filter(p => {
      const viewTime = p.last_viewed ? new Date(p.last_viewed) : (p.updated_at ? new Date(p.updated_at) : new Date(p.created_at))
      return viewTime >= todayStart
    })
  } else if (filterTime.value === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    result = result.filter(p => {
      const viewTime = p.last_viewed ? new Date(p.last_viewed) : (p.updated_at ? new Date(p.updated_at) : new Date(p.created_at))
      return viewTime >= weekAgo
    })
  } else if (filterTime.value === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    result = result.filter(p => {
      const viewTime = p.last_viewed ? new Date(p.last_viewed) : (p.updated_at ? new Date(p.updated_at) : new Date(p.created_at))
      return viewTime >= monthAgo
    })
  }

  // Sort
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'recent') {
      const aTime = a.last_viewed ? new Date(a.last_viewed).getTime() : (a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime())
      const bTime = b.last_viewed ? new Date(b.last_viewed).getTime() : (b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime())
      return bTime - aTime
    } else if (sortBy.value === 'name') {
      return (a.name || '').localeCompare(b.name || '')
    } else if (sortBy.value === 'date') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return 0
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
    const userId = auth.user.value?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    const initialPage = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Página 1',
      width: 1080,
      height: 1920,
      type: 'RETAIL_OFFER',
      canvasData: null,
      thumbnail: undefined,
    }

    const headers = await getApiAuthHeaders()
    const response = await $fetch<any>('/api/projects', {
      method: 'POST',
      headers,
      body: {
        name: newProjectName.value,
        canvas_data: [initialPage],
        folder_id: activeFolderId.value,
        last_viewed: new Date().toISOString(),
      }
    })
    const data = response?.project || null

    if (data) {
      projects.value.unshift(data)
      
      // Create notification for new project
      await $fetch('/api/notifications', {
        method: 'POST',
        headers,
        body: {
          title: 'Projeto criado',
          message: `Seu projeto "${newProjectName.value}" foi criado com sucesso`,
          type: 'success',
          metadata: { project_id: data.id, project_name: newProjectName.value }
        }
      }).catch((err) => {
        console.warn('Falha ao criar notificação de projeto:', err)
      })
      
      // Reload notifications to show new one
      await loadNotifications()
      newProjectName.value = ''
      showCreateProject.value = false
      await updateLastViewed(data.id)
      navigateTo(`/editor/${data.id}`)
    } else {
      throw new Error('Falha ao criar projeto no servidor')
    }
  } catch (error: any) {
    console.error('Error creating project:', error)
    alert('Erro ao criar projeto. Tente novamente.')
  } finally {
    isLoading.value = false
  }
}

// Delete project
const deleteProject = async (projectId: string) => {
  confirmDialogData.value = {
    title: 'Excluir projeto',
    message: 'Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.',
    variant: 'danger',
    action: async () => {
      try {
        const headers = await getApiAuthHeaders()
        await $fetch('/api/projects', {
          method: 'DELETE',
          headers,
          query: { id: projectId }
        })
        projects.value = projects.value.filter(p => p.id !== projectId)
        showProjectMenu.value = null
      } catch (error) {
        console.error('Error deleting project:', error)
        alert('Erro ao excluir projeto.')
      }
    }
  }
  showConfirmDialog.value = true
}

// Duplicate project
const duplicateProject = async (projectId: string) => {
  try {
    const userId = auth.user.value?.id
    if (!userId) {
      alert('Usuário não autenticado.')
      return
    }

    const original = projects.value.find(p => p.id === projectId)
    if (!original) return

    const headers = await getApiAuthHeaders()
    const response = await $fetch<any>('/api/projects', {
      method: 'POST',
      headers,
      body: {
        name: `${original.name} (cópia)`,
        canvas_data: original.canvas_data,
        folder_id: original.folder_id,
        last_viewed: new Date().toISOString(),
      }
    })
    const data = response?.project || null

    if (data) {
      projects.value.unshift(data)
    }
    showProjectMenu.value = null
  } catch (error) {
    console.error('Error duplicating project:', error)
    alert('Erro ao duplicar projeto.')
  }
}

// Start renaming project
const startRenameProject = (project: any) => {
  renamingProjectId.value = project.id
  editingProjectName.value = project.name
  showProjectMenu.value = null
}

// Save project name
const saveProjectName = async (projectId: string) => {
  if (!editingProjectName.value.trim()) return

  try {
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id: projectId, name: editingProjectName.value.trim() }
    })

    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.name = editingProjectName.value.trim()
    }

    renamingProjectId.value = null
    editingProjectName.value = ''
  } catch (error) {
    console.error('Error renaming project:', error)
    alert('Erro ao renomear projeto.')
  }
}

// Cancel renaming project
const cancelRenameProject = () => {
  renamingProjectId.value = null
  editingProjectName.value = ''
}

// Show project context menu
const showProjectContextMenu = (projectId: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  projectMenuPosition.value = { x: event.clientX, y: event.clientY }
  showProjectMenu.value = projectId
}

// Handle confirm dialog
const handleConfirm = () => {
  if (confirmDialogData.value.action) {
    confirmDialogData.value.action()
  }
  showConfirmDialog.value = false
}

const handleCancelConfirm = () => {
  showConfirmDialog.value = false
}

// Open project
const openProject = async (projectId: string) => {
  // Update last_viewed before navigating
  await updateLastViewed(projectId)
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

  confirmDialogData.value = {
    title: 'Excluir pasta',
    message,
    variant: 'danger',
    action: async () => {
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
  }
  showConfirmDialog.value = true
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
  const diffInDays = Math.floor(diffInMs / 86400000)

  if (diffInMins < 1) return 'Agora'
  if (diffInMins < 60) return `${diffInMins}m atrás`
  if (diffInHours < 24) return `${diffInHours}h atrás`
  if (diffInDays < 7) return `${diffInDays}d atrás`
  return projectDate.toLocaleDateString('pt-BR')
}

// Format name to show only first and second name
const formatUserName = (fullName: string | null | undefined): string => {
  if (!fullName) return 'Job Varejo'
  const names = fullName.trim().split(/\s+/)
  if (names.length <= 2) return fullName
  return `${names[0]} ${names[1]}`
}

const THUMB_FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #f5c84a 0%, #b3261e 100%)',
  'linear-gradient(135deg, #ffe3a6 0%, #c93a30 100%)',
  'linear-gradient(135deg, #f2f2f2 0%, #b3261e 100%)',
  'linear-gradient(135deg, #f8d76d 0%, #8f1e19 100%)',
  'linear-gradient(135deg, #ffe9bc 0%, #d14a3f 100%)',
  'linear-gradient(135deg, #f8f8f8 0%, #a42620 100%)',
]

const hashText = (input: string): number => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const getProjectInitials = (project: any): string => {
  const name = String(project?.name || '').trim()
  if (!name) return 'JV'
  const words = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  const initials = words.map(w => (w[0] || '').toUpperCase()).join('')
  return initials || 'JV'
}

const getProjectThumbStyle = (project: any) => {
  const seed = `${String(project?.id || '')}:${String(project?.name || '')}`
  const idx = hashText(seed) % THUMB_FALLBACK_GRADIENTS.length
  return {
    background: THUMB_FALLBACK_GRADIENTS[idx] || THUMB_FALLBACK_GRADIENTS[0]
  }
}

const isUsableThumbnailUrl = (url: unknown): boolean => {
  if (typeof url !== 'string') return false
  const value = url.trim()
  if (!value) return false
  const lower = value.toLowerCase()
  if (lower === 'data:,' || lower === 'about:blank') return false
  if (lower.startsWith('blob:null')) return false
  if (lower.startsWith('javascript:')) return false
  return true
}

const hasUsableProjectPreview = (project: any): boolean => {
  return isUsableThumbnailUrl(project?.preview_url)
}

const handleProjectThumbLoad = (project: any, event: Event) => {
  const img = event?.target as HTMLImageElement | null
  if (!img) return
  if ((img.naturalWidth || 0) < 2 || (img.naturalHeight || 0) < 2) {
    project._thumbError = true
  }
}

// Handle sign out
const handleSignOut = async () => {
  await auth.signOut()
}

const handleWorkspaceSignOut = async () => {
  showWorkspaceMenu.value = false
  await handleSignOut()
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
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id: draggedProjectId.value, folder_id: folderId }
    })

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
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id: draggedProjectId.value, folder_id: null }
    })

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
  <div class="dashboard-shell h-screen text-zinc-900 flex flex-col">
    <!-- Modern Header (Figma Style) -->
    <header class="dashboard-header h-20 flex items-center justify-between px-6 shrink-0">
      <!-- Logo -->
      <div class="flex items-center">
        <img
          src="/logo.png"
          alt="Job Varejo"
          class="h-[5rem] w-auto object-contain drop-shadow-[0_14px_18px_rgba(85,54,24,0.2)]"
          loading="eager"
        />
      </div>

      <!-- User Avatar -->
      <div class="flex items-center gap-3">
        <div v-if="user" class="header-avatar w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white">
          {{ user.name?.charAt(0) || 'U' }}
        </div>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar (Figma Style) -->
      <aside class="dashboard-sidebar w-60 flex flex-col shrink-0">
        <!-- Top Header (Figma Style) -->
        <div class="h-12 px-3 border-b border-[#e7e7e7] flex items-center justify-between shrink-0">
          <!-- User/Workspace Selector -->
          <div class="relative flex-1 min-w-0">
            <button
              type="button"
              @click.stop="toggleWorkspaceMenu"
              class="workspace-trigger w-full flex items-center gap-2 cursor-pointer group rounded-lg px-2 py-1.5 transition-all"
              :class="{ 'is-open': showWorkspaceMenu }"
            >
              <!-- Avatar -->
              <div v-if="user" class="header-avatar w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0">
                <img 
                  v-if="user.avatar_url" 
                  :src="user.avatar_url" 
                  :alt="user.name"
                  class="w-full h-full rounded-full object-cover"
                />
                <span v-else>{{ user.name?.charAt(0) || 'U' }}</span>
              </div>
              <!-- Workspace Name -->
              <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <span class="text-xs font-medium text-zinc-900 truncate">{{ formatUserName(user?.name) }}</span>
                <ChevronDown
                  :class="[
                    'w-3.5 h-3.5 shrink-0 transition-all duration-200',
                    showWorkspaceMenu
                      ? 'rotate-180 text-zinc-700 opacity-100'
                      : 'text-zinc-400 opacity-100 group-hover:text-zinc-600'
                  ]"
                />
              </div>
            </button>

            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="showWorkspaceMenu"
                class="workspace-menu absolute left-0 right-0 top-[calc(100%+8px)] z-[60] rounded-xl overflow-hidden"
                @click.stop
              >
                <div class="px-3 py-2.5 border-b border-[#e7e7e7]">
                  <p class="text-xs font-semibold text-zinc-900 truncate">{{ formatUserName(user?.name) }}</p>
                  <p class="text-[11px] text-zinc-500 truncate">{{ user?.email || 'Conta ativa' }}</p>
                </div>
                <button
                  @click="handleWorkspaceSignOut"
                  class="workspace-menu-item w-full px-3 py-2.5 text-xs text-left flex items-center gap-2 transition-colors"
                >
                  <LogOut class="w-4 h-4" />
                  Sair
                </button>
              </div>
            </Transition>
          </div>
          
          <!-- Notification Bell -->
          <button 
            ref="notificationButtonRef"
            @click.stop="toggleNotifications"
            class="notification-button icon-button w-8 h-8 flex items-center justify-center rounded-lg transition-all text-zinc-500 hover:text-zinc-900 relative"
          >
            <Bell class="w-4 h-4" />
            <!-- Notification Badge -->
            <span 
              v-if="unreadCount > 0" 
              class="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#b3261e] rounded-full"
            ></span>
          </button>
        </div>

        <!-- Search (Rounded) -->
        <div class="p-3 border-b border-[#e7e7e7]">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar"
              class="soft-input w-full h-9 rounded-lg text-xs text-zinc-900 pl-9 pr-3 focus:outline-none placeholder:text-zinc-500 transition-all"
            />
          </div>
        </div>

        <!-- Navigation Links (Figma Style) -->
        <div class="p-2 border-b border-[#e7e7e7]">
          <button 
            @click="activeView = 'recent'"
            :class="['sidebar-nav-item w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 mb-1', activeView === 'recent' ? 'is-active' : '']"
          >
            <Clock class="w-4 h-4" />
            Recentes
          </button>
          <button 
            @click="activeView = 'all'"
            :class="['sidebar-nav-item w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5', activeView === 'all' ? 'is-active' : '']"
          >
            <FolderOpen class="w-4 h-4" />
            Todos os Projetos
          </button>
          <button 
            @click="activeView = 'shared'"
            :class="['sidebar-nav-item w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 mt-1', activeView === 'shared' ? 'is-active' : '']"
          >
            <Users class="w-4 h-4" />
            Compartilhados
          </button>
        </div>

        <!-- Folders Section (Figma Style) -->
        <div class="flex-1 overflow-y-auto">
          <div class="px-3 py-2">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-semibold uppercase text-zinc-500">Pastas</span>
              <button
                @click="showCreateFolder = true"
                class="icon-button p-1 rounded-lg text-zinc-500 hover:text-zinc-900 transition-all"
                title="Nova pasta"
              >
                <FolderPlus class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- All Projects (root) - Rounded -->
            <div
              :class="[
                'sidebar-folder-item flex items-center gap-2.5 h-9 px-3 rounded-lg cursor-pointer transition-all',
                !activeFolderId ? 'is-active' : ''
              ]"
              @click="setActiveFolder(null)"
              @dragover="handleDragOver"
              @drop="handleDropOnRoot"
            >
              <FolderOpen class="w-4 h-4 opacity-70" />
              <span class="text-xs font-medium truncate flex-1">Todos os Projetos</span>
              <span class="text-[10px] text-zinc-500 bg-[#f4f4f4] px-1.5 py-0.5 rounded">{{ rootProjects.length }}</span>
            </div>
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

        <!-- Starred Section (Figma Style) -->
        <div class="px-3 py-2 border-t border-[#e7e7e7]">
          <button
            @click="activeView = 'starred'"
            :class="['sidebar-nav-item w-full flex items-center gap-2.5 h-9 px-3 rounded-lg transition-all cursor-pointer', activeView === 'starred' ? 'is-active' : '']"
          >
            <Star class="w-4 h-4" :class="{ 'fill-current': activeView === 'starred' }" />
            <span class="text-xs font-medium">Favoritos</span>
            <span v-if="starredProjectsCount > 0" class="ml-auto text-[10px] text-zinc-500 bg-[#f4f4f4] px-1.5 py-0.5 rounded">
              {{ starredProjectsCount }}
            </span>
          </button>
        </div>

        <!-- Sign Out Button -->
        <div class="p-3 border-t border-[#e7e7e7]">
          <button
            @click="handleSignOut"
            class="sidebar-signout w-full h-9 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
            title="Sair"
          >
            <LogOut class="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="dashboard-main flex-1 flex flex-col overflow-hidden">
        <!-- Section Title -->
        <div class="px-6 pt-6 pb-4">
          <h1 class="text-xl font-semibold text-zinc-900 mb-1">
            <span v-if="activeFolderId">{{ folders.find(f => f.id === activeFolderId)?.name || 'Pasta' }}</span>
            <span v-else-if="searchQuery">Resultados da Busca</span>
            <span v-else-if="activeView === 'recent'">Vistos Recentemente</span>
            <span v-else-if="activeView === 'shared'">Compartilhados</span>
            <span v-else-if="activeView === 'starred'">Favoritos</span>
            <span v-else>Todos os Projetos</span>
          </h1>
          <p class="text-xs text-zinc-500">{{ filteredProjects.length }} projeto{{ filteredProjects.length !== 1 ? 's' : '' }}</p>
        </div>

        <!-- Filters and Controls (Figma Style) -->
        <div class="px-6 pb-4 flex items-center justify-between gap-4">
          <!-- Tabs -->
          <div class="segmented-control flex items-center gap-1 rounded-lg p-1 border">
            <button
              @click="activeView = 'recent'"
              :class="['segment-button px-3 py-1.5 rounded-md text-xs font-medium transition-all', activeView === 'recent' ? 'is-active' : '']"
            >
              Recentes
            </button>
            <button
              @click="activeView = 'shared'"
              :class="['segment-button px-3 py-1.5 rounded-md text-xs font-medium transition-all', activeView === 'shared' ? 'is-active' : '']"
            >
              Compartilhados
            </button>
            <button
              @click="activeView = 'all'"
              :class="['segment-button px-3 py-1.5 rounded-md text-xs font-medium transition-all', activeView === 'all' ? 'is-active' : '']"
            >
              Todos
            </button>
          </div>

          <!-- Filters Row -->
          <div class="flex items-center gap-2 flex-1 justify-end">
            <!-- Filter Dropdowns -->
            <div class="relative">
              <select
                v-model="filterOrganization"
                class="toolbar-select h-8 px-3 pr-8 rounded-lg text-xs text-zinc-900 focus:outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="all">Todas as equipes</option>
                <option value="personal">Pessoal</option>
                <option value="team">Equipe</option>
              </select>
              <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            <div class="relative">
              <select
                v-model="filterType"
                class="toolbar-select h-8 px-3 pr-8 rounded-lg text-xs text-zinc-900 focus:outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="all">Todos os arquivos</option>
                <option value="design">Design</option>
                <option value="template">Modelo</option>
              </select>
              <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            <div class="relative">
              <select
                v-model="filterTime"
                class="toolbar-select h-8 px-3 pr-8 rounded-lg text-xs text-zinc-900 focus:outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="all">Último acesso</option>
                <option value="today">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
              </select>
              <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>

            <!-- View Mode Toggle -->
            <div class="segmented-icon-control flex items-center rounded-lg p-1 border">
              <button
                @click="viewMode = 'grid'"
                :class="['icon-segment p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'is-active' : '']"
                title="Visualização em grade"
              >
                <Grid class="w-4 h-4" />
              </button>
              <button
                @click="viewMode = 'list'"
                :class="['icon-segment p-1.5 rounded-md transition-all', viewMode === 'list' ? 'is-active' : '']"
                title="Visualização em lista"
              >
                <List class="w-4 h-4" />
              </button>
            </div>

            <!-- New Project Button -->
            <button
              @click="showCreateProject = true"
              class="btn-accent h-8 px-4 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all"
            >
              <Plus class="w-4 h-4" />
              <span>Novo Projeto</span>
            </button>

          </div>
        </div>

        <!-- Projects Grid/List -->
        <div class="flex-1 overflow-y-auto px-6 pb-6">
          <!-- Loading State -->
          <div v-if="isLoadingProjects" class="flex items-center justify-center h-full">
            <div class="animate-spin w-8 h-8 border-3 border-[#b3261e] border-t-transparent rounded-full"></div>
          </div>

          <!-- Projects Grid (Figma Style - Rounded Cards) -->
          <div
            v-else-if="filteredProjects.length > 0"
            class="grid gap-4"
            :class="viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-1'"
          >
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="project-card group relative overflow-hidden transition-all duration-200 cursor-pointer rounded-xl"
              draggable="true"
              @dragstart="handleDragStart(project.id, $event)"
              @click="openProject(project.id)"
            >
              <!-- Thumbnail (Rounded Top) -->
                <div
                  class="aspect-video bg-linear-to-br from-[#efefef] to-[#e2e2e2] relative overflow-hidden rounded-t-xl"
                >
                <div v-if="hasUsableProjectPreview(project) && !project._thumbError" class="absolute inset-0 p-2 flex items-center justify-center">
                  <img
                    :src="project.preview_url"
                    class="max-w-full max-h-full object-contain rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-[1.01]"
                    :alt="project.name"
                    loading="lazy"
                    decoding="async"
                    @load="handleProjectThumbLoad(project, $event)"
                    @error="project._thumbError = true"
                  />
                </div>
                <div v-if="!hasUsableProjectPreview(project) || project._thumbError" class="w-full h-full p-2">
                  <div
                    class="w-full h-full rounded-lg border border-[var(--dash-border-soft)] relative overflow-hidden flex flex-col justify-between p-3"
                    :style="getProjectThumbStyle(project)"
                  >
                    <div class="absolute inset-0 opacity-20 pointer-events-none" style="background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0%, transparent 38%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.22) 0%, transparent 42%);"></div>
                    <div class="relative z-[1] text-[10px] font-medium uppercase tracking-[0.14em] text-white/80">Sem preview</div>
                    <div class="relative z-[1] text-white font-bold text-2xl leading-none">{{ getProjectInitials(project) }}</div>
                    <div class="relative z-[1] text-[10px] text-white/90 truncate">{{ project.name || 'Projeto sem nome' }}</div>
                  </div>
                </div>
                <div
                  class="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px] font-semibold tracking-wide pointer-events-none"
                >
                  {{ getProjectInitials(project) }}
                </div>

                <!-- Actions Button (top right - Rounded) -->
                <button
                  @click.stop="showProjectContextMenu(project.id, $event)"
                  class="thumb-action-btn absolute top-2 right-2 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                  title="Ações"
                >
                  <MoreVertical class="w-4 h-4 text-white" />
                </button>

                <!-- Star Button (top left - Rounded) -->
                <button
                  @click.stop="toggleStarred(project.id)"
                  :class="['thumb-action-btn thumb-star-btn absolute top-2 left-2 p-2 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg', project.is_starred ? 'is-starred' : '']"
                  title="Favoritar"
                >
                  <Star class="w-4 h-4" :class="{ 'fill-current': project.is_starred }" />
                </button>
              </div>

              <!-- Content (Rounded Bottom) -->
              <div class="p-3 rounded-b-xl">
                <!-- Renaming mode -->
                <div v-if="renamingProjectId === project.id" @click.stop class="mb-1">
                  <input
                    v-model="editingProjectName"
                    type="text"
                    class="inline-edit-input w-full px-2 py-1.5 text-xs rounded-lg focus:outline-none text-zinc-900"
                    @keyup.enter="saveProjectName(project.id)"
                    @keyup.esc="cancelRenameProject"
                    @blur="saveProjectName(project.id)"
                    ref="renameInput"
                  />
                </div>
                <!-- Normal mode -->
                <h3 v-else class="font-medium text-xs text-zinc-900 mb-1 truncate">
                  {{ project.name || 'Sem título' }}
                </h3>
                <p class="text-[10px] text-zinc-500">{{ formatDistanceToNow(project.last_viewed || project.updated_at || project.created_at) }}</p>
              </div>
            </div>
          </div>

          <!-- Empty State (Figma Style) -->
          <div v-else class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="empty-state-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border">
                <FolderOpen class="w-8 h-8 text-zinc-500" />
              </div>
              <h3 class="text-base font-semibold text-zinc-900 mb-2">
                <span v-if="searchQuery">Nenhum resultado encontrado</span>
                <span v-else-if="activeFolderId">Pasta vazia</span>
                <span v-else>Nenhum projeto ainda</span>
              </h3>
              <p class="text-xs text-zinc-500 mb-6">
                <span v-if="searchQuery">Tente outra busca</span>
                <span v-else>Crie seu primeiro projeto para começar</span>
              </p>
              <button
                v-if="!searchQuery"
                @click="showCreateProject = true"
                class="btn-accent h-10 px-6 text-white rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-all"
              >
                <Plus class="w-4 h-4" />
                Criar Projeto
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Create Project Modal (Figma Style) -->
    <div
      v-if="showCreateProject"
      class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      @click.self="showCreateProject = false"
    >
      <div class="dialog-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl">
        <h3 class="text-base font-semibold text-zinc-900 mb-2">Novo Projeto</h3>
        <p class="text-xs text-zinc-500 mb-4">
          <span v-if="activeFolderId">Criar em: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Criar na raiz</span>
        </p>
        <input
          v-model="newProjectName"
          type="text"
          placeholder="Nome do projeto..."
          class="soft-input w-full h-10 px-3 rounded-lg text-xs text-zinc-900 focus:outline-none mb-4 transition-all"
          @keyup.enter="createProject()"
        />
        <div class="flex gap-2">
          <button
            @click="showCreateProject = false"
            class="btn-soft flex-1 h-10 text-zinc-900 rounded-lg text-xs font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            @click="createProject()"
            :disabled="isLoading || !isValidProjectName"
            class="btn-accent flex-1 h-10 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            {{ isLoading ? 'Criando...' : 'Criar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Folder Modal (Figma Style) -->
    <div
      v-if="showCreateFolder"
      class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      @click.self="showCreateFolder = false"
    >
      <div class="dialog-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl">
        <h3 class="text-base font-semibold text-zinc-900 mb-2">Nova Pasta</h3>
        <p class="text-xs text-zinc-500 mb-4">
          <span v-if="activeFolderId">Criar dentro de: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Criar na raiz</span>
        </p>
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Nome da pasta..."
          class="soft-input w-full h-10 px-3 rounded-lg text-xs text-zinc-900 focus:outline-none mb-4 transition-all"
          @keyup.enter="handleCreateFolder()"
        />
        <div class="flex gap-2">
          <button
            @click="showCreateFolder = false"
            class="btn-soft flex-1 h-10 text-zinc-900 rounded-lg text-xs font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            @click="handleCreateFolder()"
            :disabled="!isValidFolderName"
            class="btn-accent flex-1 h-10 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            Criar
          </button>
        </div>
      </div>
    </div>

    <!-- Folder Context Menu (Figma Style) -->
    <teleport to="body">
      <div
        v-if="showFolderMenu"
        class="folder-context-menu context-menu fixed z-100 rounded-lg py-1.5 min-w-40 shadow-xl"
        :style="{ left: `${folderMenuPosition.x}px`, top: `${folderMenuPosition.y}px` }"
      >
        <button
          @click="startEditFolder(folders.find(f => f.id === showFolderMenu))"
          class="menu-item w-full px-3 py-2 text-xs text-left text-zinc-900 flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Pencil class="w-4 h-4" />
          Renomear
        </button>
        <button
          @click="handleDeleteFolder(showFolderMenu)"
          class="menu-item-danger w-full px-3 py-2 text-xs text-left flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Trash2 class="w-4 h-4" />
          Excluir
        </button>
      </div>
    </teleport>

    <!-- Project Context Menu (Figma Style) -->
    <teleport to="body">
      <div
        v-if="showProjectMenu"
        class="project-context-menu context-menu fixed z-100 rounded-lg py-1.5 min-w-40 shadow-xl"
        :style="{ left: `${projectMenuPosition.x}px`, top: `${projectMenuPosition.y}px` }"
      >
        <button
          @click="startRenameProject(projects.find(p => p.id === showProjectMenu))"
          class="menu-item w-full px-3 py-2 text-xs text-left text-zinc-900 flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Pencil class="w-4 h-4" />
          Renomear
        </button>
        <button
          @click="duplicateProject(showProjectMenu)"
          class="menu-item w-full px-3 py-2 text-xs text-left text-zinc-900 flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Copy class="w-4 h-4" />
          Duplicar
        </button>
        <button
          @click="toggleStarred(showProjectMenu)"
          class="menu-item w-full px-3 py-2 text-xs text-left text-zinc-900 flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Star class="w-4 h-4" :class="{ 'fill-current': projects.find(p => p.id === showProjectMenu)?.is_starred }" />
          {{ projects.find(p => p.id === showProjectMenu)?.is_starred ? 'Desfavoritar' : 'Favoritar' }}
        </button>
        <div class="menu-divider h-px my-1.5 mx-2"></div>
        <button
          @click="deleteProject(showProjectMenu)"
          class="menu-item-danger w-full px-3 py-2 text-xs text-left flex items-center gap-2.5 transition-colors rounded mx-1"
        >
          <Trash2 class="w-4 h-4" />
          Excluir
        </button>
      </div>
    </teleport>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      :show="showConfirmDialog"
      :title="confirmDialogData.title"
      :message="confirmDialogData.message"
      :variant="confirmDialogData.variant"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      @confirm="handleConfirm"
      @cancel="handleCancelConfirm"
    />

    <!-- Notifications Modal (Figma Style) -->
    <teleport to="body">
      <!-- Backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showNotifications"
          class="fixed inset-0 z-199 bg-black/20"
          @click="showNotifications = false"
        ></div>
      </Transition>

      <!-- Modal -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95 translate-y-[-8px]"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-[-8px]"
      >
        <div
          v-if="showNotifications && notificationButtonRef"
          class="notifications-modal fixed z-200"
          :style="{
            top: `${notificationButtonRef.getBoundingClientRect().bottom + 8}px`,
            left: `${notificationButtonRef.getBoundingClientRect().right + 8}px`
          }"
          @click.stop
        >
          <div class="notifications-panel w-80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-125">
            <!-- Header -->
            <div class="px-4 py-3 border-b border-[#e7e7e7] flex items-center justify-between">
              <h3 class="text-sm font-semibold text-zinc-900">Notificações</h3>
              <button
                v-if="unreadCount > 0"
                @click="markAllAsRead"
                class="link-accent text-xs transition-colors"
              >
                Marcar todas como lidas
              </button>
            </div>

            <!-- Notifications List -->
            <div class="flex-1 overflow-y-auto">
              <div v-if="notifications.length === 0" class="p-8 text-center">
                <Bell class="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                <p class="text-xs text-zinc-500">Nenhuma notificação</p>
              </div>
              
              <div v-else class="divide-y divide-[#ececec]">
                <div
                  v-for="notification in notifications"
                  :key="notification.id"
                  @click="markAsRead(notification.id)"
                  :class="[
                    'notification-item px-4 py-3 cursor-pointer transition-colors',
                    !notification.read ? 'is-unread' : ''
                  ]"
                >
                  <div class="flex items-start gap-3">
                    <!-- Icon -->
                    <div :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      notification.type === 'success' ? 'bg-green-500/20 text-green-400' :
                      notification.type === 'share' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-[#fde9e7] text-[#b3261e]'
                    ]">
                      <Bell v-if="notification.type === 'share'" class="w-4 h-4" />
                      <Sparkles v-else class="w-4 h-4" />
                    </div>
                    
                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-zinc-900 mb-0.5">{{ notification.title }}</p>
                      <p class="text-[11px] text-zinc-400 line-clamp-2">{{ notification.message }}</p>
                      <p class="text-[10px] text-zinc-500 mt-1">{{ formatDistanceToNow(notification.created_at) }}</p>
                    </div>

                    <!-- Unread Indicator -->
                    <div v-if="!notification.read" class="w-2 h-2 bg-[#b3261e] rounded-full shrink-0 mt-1"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-4 py-3 border-t border-[#e7e7e7]">
              <button
                @click="showNotifications = false"
                class="link-muted w-full text-xs transition-colors text-center"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>

  </div>
</template>

<style scoped>
.dashboard-shell {
  --dash-bg: #f8f6f1;
  --dash-surface: #ffffff;
  --dash-surface-soft: #fcf9f3;
  --dash-border: #e7d8c3;
  --dash-border-soft: #eadfce;
  --dash-text: #2f2419;
  --dash-muted: #746251;
  --dash-accent: #b3261e;
  --dash-accent-strong: #931f18;
  --dash-accent-soft: #fde9e4;
  --dash-accent-soft-hover: #f9d8d2;
  background:
    radial-gradient(circle at 12% 9%, rgba(210, 136, 36, 0.15) 0%, transparent 32%),
    radial-gradient(circle at 86% 16%, rgba(179, 38, 30, 0.08) 0%, transparent 28%),
    var(--dash-bg);
}

.dashboard-header {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 252, 247, 0.94) 100%);
  border-bottom: 1px solid var(--dash-border);
  box-shadow: 0 12px 30px -24px rgba(64, 43, 24, 0.5);
}

.header-avatar {
  background: linear-gradient(135deg, #c13d2e 0%, #8f1e19 100%);
  box-shadow: 0 10px 18px -12px rgba(147, 31, 24, 0.7);
}

.dashboard-sidebar {
  border-right: 1px solid var(--dash-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 252, 247, 0.95) 100%);
}

.dashboard-main {
  background: transparent;
}

.workspace-trigger:hover {
  background: rgba(179, 38, 30, 0.06);
}

.workspace-trigger.is-open {
  background: rgba(179, 38, 30, 0.1);
}

.workspace-menu {
  background: linear-gradient(180deg, #fffdf9 0%, #fff8ee 100%);
  border: 1px solid var(--dash-border);
  box-shadow: 0 18px 26px -18px rgba(56, 35, 17, 0.6);
}

.workspace-menu-item {
  color: #7a1d19;
}

.workspace-menu-item:hover {
  background: rgba(179, 38, 30, 0.1);
}

.icon-button:hover {
  background: rgba(179, 38, 30, 0.08);
}

.soft-input {
  background: linear-gradient(180deg, #fffefb 0%, #fff8ef 100%);
  border: 1px solid var(--dash-border);
}

.soft-input:hover {
  border-color: #d1b892;
}

.soft-input:focus {
  border-color: #b53a2b;
  box-shadow: 0 0 0 3px rgba(181, 58, 43, 0.17);
}

.sidebar-nav-item {
  color: #7d6d5c;
}

.sidebar-nav-item:hover {
  color: var(--dash-text);
  background: rgba(179, 38, 30, 0.08);
}

.sidebar-nav-item.is-active {
  color: var(--dash-text);
  background: var(--dash-accent-soft);
}

.sidebar-nav-item.is-active:hover {
  background: var(--dash-accent-soft-hover);
}

.sidebar-folder-item {
  color: #7d6d5c;
}

.sidebar-folder-item:hover {
  background: rgba(179, 38, 30, 0.08);
  color: var(--dash-text);
}

.sidebar-folder-item.is-active {
  background: rgba(179, 38, 30, 0.12);
  color: var(--dash-text);
}

.sidebar-signout {
  color: #92231e;
  background: rgba(179, 38, 30, 0.1);
}

.sidebar-signout:hover {
  color: #7a1d19;
  background: rgba(179, 38, 30, 0.18);
}

.segmented-control,
.segmented-icon-control {
  background: var(--dash-surface-soft);
  border-color: var(--dash-border);
}

.segment-button,
.icon-segment {
  color: #7d6d5c;
}

.segment-button:hover,
.icon-segment:hover {
  color: var(--dash-text);
}

.segment-button.is-active,
.icon-segment.is-active {
  color: var(--dash-text);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 10px -8px rgba(84, 58, 35, 0.55);
}

.toolbar-select {
  background: var(--dash-surface-soft);
  border: 1px solid var(--dash-border);
}

.toolbar-select:hover {
  background: #fff9f1;
}

.toolbar-select:focus {
  border-color: #b53a2b;
  box-shadow: 0 0 0 3px rgba(181, 58, 43, 0.14);
}

.btn-accent {
  background: linear-gradient(135deg, var(--dash-accent) 0%, #cc4a2b 100%);
  box-shadow: 0 14px 22px -14px rgba(179, 38, 30, 0.72);
}

.btn-accent:hover {
  background: linear-gradient(135deg, var(--dash-accent-strong) 0%, #b63f24 100%);
  box-shadow: 0 18px 26px -14px rgba(147, 31, 24, 0.68);
  transform: translateY(-1px);
}

.btn-accent:disabled {
  transform: none;
}

.btn-soft {
  background: var(--dash-surface-soft);
  border: 1px solid var(--dash-border);
}

.btn-soft:hover {
  background: #fff9f1;
}

.project-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 252, 248, 0.94) 100%);
  border: 1px solid var(--dash-border);
}

.project-card:hover {
  border-color: #d2b489;
  transform: translateY(-2px);
  box-shadow: 0 20px 26px -20px rgba(56, 35, 17, 0.6), 0 14px 24px -20px rgba(179, 38, 30, 0.35);
}

.thumb-action-btn {
  background: rgba(33, 25, 18, 0.72);
}

.thumb-action-btn:hover {
  background: rgba(33, 25, 18, 0.88);
}

.thumb-star-btn.is-starred {
  background: rgba(209, 146, 40, 0.92);
}

.inline-edit-input {
  background: #fffaf3;
  border: 1px solid #b63f24;
}

.empty-state-icon {
  background: linear-gradient(180deg, #ffffff 0%, #fff9f0 100%);
  border-color: var(--dash-border);
}

.modal-overlay {
  background: rgba(28, 19, 13, 0.45);
}

.dialog-panel {
  background: linear-gradient(180deg, #ffffff 0%, #fff9f1 100%);
  border: 1px solid var(--dash-border);
}

.context-menu {
  background: linear-gradient(180deg, #fffdf9 0%, #fff8ee 100%);
  border: 1px solid var(--dash-border);
}

.menu-item:hover {
  background: rgba(179, 38, 30, 0.08);
}

.menu-item-danger {
  color: #9a2620;
}

.menu-item-danger:hover {
  background: rgba(179, 38, 30, 0.1);
}

.menu-divider {
  background: var(--dash-border-soft);
}

.notifications-panel {
  background: linear-gradient(180deg, #ffffff 0%, #fffaf2 100%);
  border: 1px solid var(--dash-border);
}

.link-accent {
  color: var(--dash-accent);
}

.link-accent:hover {
  color: var(--dash-accent-strong);
}

.link-muted {
  color: #7c6b5a;
}

.link-muted:hover {
  color: var(--dash-text);
}

.notification-item:hover {
  background: rgba(179, 38, 30, 0.06);
}

.notification-item.is-unread {
  background: rgba(179, 38, 30, 0.08);
}

.folder-tree {
  user-select: none;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #c4c4c4;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #adadad;
}
</style>
