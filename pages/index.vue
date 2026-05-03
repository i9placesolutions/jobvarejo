<script setup lang="ts">
import { Search, Plus, Grid, List, FolderOpen, Star, Sparkles, LogOut, Folder, FolderPlus, MoreVertical, Pencil, Trash2, Copy, Clock, Users, Bell, ChevronDown, Check, User, Menu as MenuIcon } from 'lucide-vue-next'
	import FolderTreeItem from '~/components/FolderTreeItem.vue'
	import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
	import FilterDropdown from '~/components/ui/FilterDropdown.vue'
import type { Folder as FolderModel } from '~/types/folder'
import { useResponsive } from '~/composables/useResponsive'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'

const { isMobile: dashMobile, isTablet: dashTablet } = useResponsive()
const showMobileDrawer = ref(false)

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
const normalizedSearchQuery = computed(() => String(searchQuery.value || '').trim().toLowerCase())
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref<'recent' | 'name' | 'date'>('recent')
const activeView = ref<'recent' | 'all' | 'shared' | 'starred'>('recent')
const filterOrganization = ref('all')
const filterType = ref('all')
const filterTime = ref('all')
const filterFolderId = ref('all')
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
const isDashboardBootstrapping = ref(false)
const lastBootstrappedUserId = ref<string | null>(null)
const dragPointerMeta = ref<{ projectId: string | null; x: number; y: number; at: number }>({
  projectId: null,
  x: 0,
  y: 0,
  at: 0
})
const transparentDragImage = import.meta.client
  ? (() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      return canvas
    })()
  : null

// Project menu state
const showProjectMenu = ref<string | null>(null)
const projectMenuPosition = ref({ x: 0, y: 0 })
const editingProjectId = ref<string | null>(null)
const editingProjectName = ref('')
const renamingProjectId = ref<string | null>(null)
const showMoveProjectModal = ref(false)
const projectToMoveId = ref<string | null>(null)
const moveProjectFolderId = ref('')
const isMovingProject = ref(false)

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
const notificationModalStyle = computed(() => {
  if (!notificationButtonRef.value) return {}
  const rect = notificationButtonRef.value.getBoundingClientRect()
  return {
    top: `${rect.bottom + 8}px`,
    right: `${Math.max(8, globalThis.innerWidth - rect.right)}px`
  }
})

// Delete confirmation modal
const showDeleteConfirm = ref(false)
const projectToDelete = ref<string | null>(null)
const projectToDeleteName = ref('')

// Toast notification system
let _toastId = 0
const toasts = ref<{ id: number; message: string; type: 'error' | 'success' | 'info' }[]>([])
const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
  const id = ++_toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 4500)
}

// Projects data - initialize with empty arrays for SSR
const projects = ref<any[]>([])
const user = ref<any>(null)

// Helper to safely access projects
const safeProjects = computed(() => projects.value || [])
const safeFolders = computed(() => folders.value || [])

const closeFloatingOverlays = () => {
  showFolderMenu.value = null
  showProjectMenu.value = null
  showNotifications.value = false
}

// Close menus when clicking outside - only on client
const folderMenuRef = ref<HTMLElement | null>(null)
const projectGridViewportEl = ref<HTMLElement | null>(null)
const handleContextMenusOutsideClick = (e: Event) => {
  const target = e.target as HTMLElement | null
  if (showFolderMenu.value && !target?.closest?.('.folder-context-menu')) {
    showFolderMenu.value = null
  }
  if (showProjectMenu.value && !target?.closest?.('.project-context-menu')) {
    showProjectMenu.value = null
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

    const headers = await getApiAuthHeaders()

    // Fire all three requests in parallel
    const [profile, , projectsData] = await Promise.all([
      $fetch('/api/profile', { headers }).catch(() => null),
      loadFolders({ scope: 'project' }).catch(() => null),
      $fetch('/api/projects', { headers }).catch(() => [])
    ])

    if (profile) user.value = profile as any
    projects.value = (Array.isArray(projectsData) ? projectsData : []).map((p: any) => {
      if (p && typeof p === 'object') {
        // Pre-parse dates once to avoid repeated new Date() calls in computed properties
        p._lastViewedMs = p.last_viewed ? new Date(p.last_viewed).getTime() : 0
        p._updatedAtMs = p.updated_at ? new Date(p.updated_at).getTime() : 0
        p._createdAtMs = p.created_at ? new Date(p.created_at).getTime() : 0
      }
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
      const nowIso = new Date().toISOString()
      project.last_viewed = nowIso
      project._lastViewedMs = new Date(nowIso).getTime()
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
    showToast('Erro ao atualizar favorito.')
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
  if (!showNotifications.value) {
    showFolderMenu.value = null
    showProjectMenu.value = null
  }
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    await loadNotifications()
  }
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

// Watch for auth user changes (by id) to avoid duplicate bootstrap calls
watch(() => auth.user.value?.id || null, async (userId) => {
  if (userId) {
    if (isDashboardBootstrapping.value) return
    // Guard against duplicate bootstrap runs for the same user id.
    if (lastBootstrappedUserId.value === userId && projects.value.length > 0) return
    isDashboardBootstrapping.value = true
    try {
      await Promise.all([loadData(), loadNotifications()])
      lastBootstrappedUserId.value = userId
    } finally {
      isDashboardBootstrapping.value = false
    }
  } else {
    if (auth.isLoading.value) return
    projects.value = []
    notifications.value = []
    lastBootstrappedUserId.value = null
  }
}, { immediate: true })

// Prevent stale folder filter from hiding all projects when user switches view.
watch(activeView, (view) => {
  if (view !== 'all' && activeFolderId.value) {
    setActiveFolder(null)
  }
})

watch(activeFolderId, (folderId) => {
  if (activeView.value !== 'all') return
  filterFolderId.value = folderId ? String(folderId) : 'all'
})

watch([showCreateProject, showCreateFolder, showMoveProjectModal], ([projectOpen, folderOpen, moveOpen]) => {
  if (projectOpen || folderOpen || moveOpen) {
    closeFloatingOverlays()
  }
})

// Computed: Folder tree with expansion state
type FolderTreeNode = FolderModel & {
  children: FolderTreeNode[]
  depth: number
  isExpanded: boolean
  projectCount: number
}

const folderTree = computed<FolderTreeNode[]>(() => {
  // During SSR, return empty array to avoid issues
  if (process.server || !folders.value) return []

  const searchTerm = normalizedSearchQuery.value

  const matchesSearch = (name: string): boolean => {
    const normalizedName = String(name || '').trim().toLowerCase()
    return !searchTerm || normalizedName.includes(searchTerm)
  }

  const buildTree = (parentId: string | null = null, depth = 0): FolderTreeNode[] => {
    return folders.value
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .map(folder => {
        const children = buildTree(folder.id, depth + 1)
        const isSelfMatch = matchesSearch(folder.name)
        if (!isSelfMatch && children.length === 0) return null

        return {
          ...folder,
          children,
          depth,
          isExpanded: expandedFolders.value.has(folder.id) || (!!searchTerm && (isSelfMatch || children.length > 0)),
          projectCount: getFolderProjectCount(folder.id),
        }
      })
      .filter((node): node is FolderTreeNode => node !== null)
  }
  return buildTree()
})

const getFolderProjectCount = (folderId: string): number => {
  const startId = String(folderId || '').trim()
  if (!startId) return 0

  const visited = new Set<string>()
  const walk = (currentId: string): number => {
    const id = String(currentId || '').trim()
    if (!id || visited.has(id)) return 0
    visited.add(id)

    let count = 0
    for (const project of safeProjects.value) {
      if (String(project.folder_id || '') === id) {
        count += 1
      }
    }

    const children = getChildren(id)
    for (const child of children) {
      count += walk(child.id)
    }

    return count
  }

  return walk(startId)
}

const getFolderTreeIds = (folderId: string): string[] => {
  const ids = [folderId]
  const children = getChildren(folderId)
  children.forEach(child => {
    ids.push(...getFolderTreeIds(child.id))
  })
  return ids
}

// Computed: Projects in active folder (or all if no folder selected)
const activeFolderProjects = computed(() => {
  if (!activeFolderId.value) return []

  const folderIds = getFolderTreeIds(activeFolderId.value)
  return safeProjects.value.filter(p => p.folder_id && folderIds.includes(p.folder_id))
})

const visibleFoldersOnDashboard = computed(() => {
  if (activeView.value !== 'all') return []
  const searchTerm = normalizedSearchQuery.value

  const selectedParent = activeFolderId.value ? String(activeFolderId.value) : null
  return safeFolders.value
    .filter((folder) => (
      selectedParent
        ? String(folder.parent_id || '') === selectedParent
        : !folder.parent_id
    ))
    .filter((folder) => (
      !searchTerm || String(folder.name || '').trim().toLowerCase().includes(searchTerm)
    ))
  .sort((a, b) => a.order_index - b.order_index)
})

const activeFolderName = computed(() => safeFolders.value.find(f => f.id === activeFolderId.value)?.name || 'Pasta sem nome')

const dashboardTitle = computed(() => {
  if (searchQuery.value) return 'Resultados da busca'
  if (activeFolderId.value) return activeFolderName.value
  if (isNoFolderView.value) return 'Sem pasta'
  if (activeView.value === 'recent') return 'Vistos recentemente'
  if (activeView.value === 'shared') return 'Compartilhados'
  if (activeView.value === 'starred') return 'Favoritos'
  return 'Todos os Projetos'
})

const dashboardContextHint = computed(() => {
  if (searchQuery.value) return 'Filtrando por palavra-chave.'
  if (activeView.value === 'all' && activeFolderId.value) return 'Mostrando só esta pasta e conteúdos aninhados.'
  if (isNoFolderView.value) return 'Projetos que ainda não estão em nenhuma pasta.'
  if (activeView.value === 'recent') return 'Últimos 10 projetos acessados.'
  if (activeView.value === 'shared') return 'Arquivos compartilhados com você.'
  if (activeView.value === 'starred') return 'Itens marcados como favoritos.'
  return 'Visão completa do seu workspace.'
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
    // Recently viewed — top 10 only, ordered by last_viewed → updated_at → created_at
    result = [...safeProjects.value]
      .sort((a, b) => {
        const aTime = (a._lastViewedMs || a._updatedAtMs || a._createdAtMs) ?? 0
        const bTime = (b._lastViewedMs || b._updatedAtMs || b._createdAtMs) ?? 0
        return bTime - aTime
      })
      .slice(0, 10)
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
  const searchTerm = normalizedSearchQuery.value

  // Start with view-based filtering
  if (activeFolderId.value && activeView.value === 'all' && String(filterFolderId.value || 'all') === 'all') {
    // Filter by folder
    const allFolderIds = getFolderTreeIds(activeFolderId.value)
    result = viewProjects.value.filter(p => p.folder_id && allFolderIds.includes(p.folder_id))
  } else {
    result = viewProjects.value
  }

  if (searchTerm) {
    result = result.filter(p => String(p.name || '').trim().toLowerCase().includes(searchTerm))
  }

  // Apply additional filters
  if (filterOrganization.value === 'personal') {
    result = result.filter(p => !p.is_shared)
  } else if (filterOrganization.value === 'team') {
    result = result.filter(p => p.is_shared === true)
  }

  const selectedFolderFilter = String(filterFolderId.value || 'all')
  if (selectedFolderFilter === 'root') {
    result = result.filter((p) => !p.folder_id)
  } else if (selectedFolderFilter !== 'all') {
    const scopedIds = getFolderTreeIds(selectedFolderFilter)
    result = result.filter((p) => p.folder_id && scopedIds.includes(String(p.folder_id)))
  }

  if (filterType.value === 'design') {
    // Assuming all projects are designs for now
    result = result
  } else if (filterType.value === 'template') {
    // Filter templates if we add a type field later
    result = result
  }

  // Apply time filter using pre-parsed timestamps
  const nowMs = Date.now()
  if (filterTime.value === 'today') {
    const todayStartMs = new Date().setHours(0, 0, 0, 0)
    result = result.filter(p => (p._lastViewedMs || p._updatedAtMs || p._createdAtMs) >= todayStartMs)
  } else if (filterTime.value === 'week') {
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000
    result = result.filter(p => (p._lastViewedMs || p._updatedAtMs || p._createdAtMs) >= weekAgoMs)
  } else if (filterTime.value === 'month') {
    const monthAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000
    result = result.filter(p => (p._lastViewedMs || p._updatedAtMs || p._createdAtMs) >= monthAgoMs)
  }

  // Sort using pre-parsed timestamps
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'recent') {
      const aTime = (a._lastViewedMs || a._updatedAtMs || a._createdAtMs) ?? 0
      const bTime = (b._lastViewedMs || b._updatedAtMs || b._createdAtMs) ?? 0
      return bTime - aTime
    } else if (sortBy.value === 'name') {
      return (a.name || '').localeCompare(b.name || '')
    } else if (sortBy.value === 'date') {
      return (b._createdAtMs ?? 0) - (a._createdAtMs ?? 0)
    }
    return 0
  })

  return result
})

type FolderOption = {
  id: string
  name: string
  depth: number
  pathLabel: string
}

const normalizeFolderId = (value: unknown): string => String(value || '').trim()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROJECT_NAME_MAX_LENGTH = 120
const DUPLICATE_PROJECT_SUFFIX = ' (cópia)'

const normalizeProjectName = (value: unknown, fallback = 'Untitled Project'): string => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return fallback
  if (trimmed.length <= PROJECT_NAME_MAX_LENGTH) return trimmed
  return trimmed.slice(0, PROJECT_NAME_MAX_LENGTH).trimEnd() || fallback
}

const buildDuplicateProjectName = (value: unknown): string => {
  const baseName = normalizeProjectName(value, 'Projeto')
  const maxBaseLength = Math.max(1, PROJECT_NAME_MAX_LENGTH - DUPLICATE_PROJECT_SUFFIX.length)
  const clippedBase = baseName.length > maxBaseLength
    ? baseName.slice(0, maxBaseLength).trimEnd()
    : baseName
  return `${clippedBase || 'Projeto'}${DUPLICATE_PROJECT_SUFFIX}`
}

const normalizeFolderIdForProjectPayload = (value: unknown): string | null | undefined => {
  const id = normalizeFolderId(value)
  if (!id) return null
  if (UUID_RE.test(id)) return id
  return undefined
}

const folderById = computed(() => {
  const map = new Map<string, FolderModel>()
  const list = Array.isArray(safeFolders.value) ? safeFolders.value : []
  list.forEach((folder) => {
    map.set(String(folder.id), folder)
  })
  return map
})

const getFolderPathSegments = (folderId: string): string[] => {
  const id = normalizeFolderId(folderId)
  if (!id) return []
  const segments: string[] = []
  const visited = new Set<string>()
  let cursor = id
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    const folder = folderById.value.get(cursor)
    if (!folder) break
    const name = String(folder.name || '').trim() || 'Pasta sem nome'
    segments.unshift(name)
    cursor = normalizeFolderId(folder.parent_id)
  }
  return segments
}

const formatFolderPathLabel = (folderId: string): string => {
  const parts = getFolderPathSegments(folderId)
  if (!parts.length) return 'Sem pasta (raiz)'
  return parts.join(' / ')
}

const pluralize = (value: number, singular: string, plural: string): string => {
  return `${value} ${value === 1 ? singular : plural}`
}

const getFolderSubfolderCount = (folderId: string): number => {
  return getChildren(folderId).length
}

const moveProjectFolderOptions = computed<FolderOption[]>(() => {
  const list = Array.isArray(safeFolders.value) ? safeFolders.value : []
  if (!list.length) return []

  const byParent = new Map<string | null, FolderModel[]>()
  for (const folder of list) {
    const key = folder.parent_id ?? null
    const bucket = byParent.get(key) || []
    bucket.push(folder)
    byParent.set(key, bucket)
  }

  byParent.forEach((bucket) => {
    bucket.sort((a, b) => (a.order_index - b.order_index) || String(a.name || '').localeCompare(String(b.name || '')))
  })

  const options: FolderOption[] = []
  const walk = (parentId: string | null = null, depth = 0, parentPath: string[] = []) => {
    const children = byParent.get(parentId) || []
    for (const folder of children) {
      const name = String(folder.name || '').trim() || 'Pasta sem nome'
      const path = [...parentPath, name]
      options.push({
        id: folder.id,
        name,
        depth,
        pathLabel: path.join(' / ')
      })
      walk(folder.id, depth + 1, path)
    }
  }

  walk(null, 0)
  return options
})

const projectToMoveName = computed(() => {
  const id = String(projectToMoveId.value || '').trim()
  if (!id) return ''
  return String(projects.value.find((p) => p.id === id)?.name || 'Projeto')
})

const folderFilterOptions = computed(() => moveProjectFolderOptions.value)
type DashboardFilterOption = {
  value: string
  label: string
  description: string
  group?: string
}

const organizationFilterOptions: DashboardFilterOption[] = [
  {
    value: 'all',
    label: 'Todas as equipes',
    description: 'Exibe projetos pessoais e compartilhados.',
    group: 'Escopo',
  },
  {
    value: 'personal',
    label: 'Pessoal',
    description: 'Mostra apenas seus projetos não compartilhados.',
    group: 'Escopo',
  },
  {
    value: 'team',
    label: 'Equipe',
    description: 'Mostra apenas projetos compartilhados com equipe.',
    group: 'Escopo',
  },
]

const typeFilterOptions: DashboardFilterOption[] = [
  {
    value: 'all',
    label: 'Todos os arquivos',
    description: 'Inclui todos os tipos de projeto.',
    group: 'Tipo',
  },
  {
    value: 'design',
    label: 'Design',
    description: 'Foco em artes e layouts.',
    group: 'Tipo',
  },
  {
    value: 'template',
    label: 'Modelo',
    description: 'Foco em projetos base para reutilizar.',
    group: 'Tipo',
  },
]

const timeFilterOptions: DashboardFilterOption[] = [
  {
    value: 'all',
    label: 'Último acesso',
    description: 'Sem recorte de período.',
    group: 'Período',
  },
  {
    value: 'today',
    label: 'Hoje',
    description: 'Somente itens acessados hoje.',
    group: 'Período',
  },
  {
    value: 'week',
    label: 'Esta semana',
    description: 'Itens acessados nos últimos 7 dias.',
    group: 'Período',
  },
  {
    value: 'month',
    label: 'Este mês',
    description: 'Itens acessados nos últimos 30 dias.',
    group: 'Período',
  },
]

const folderFilterDropdownOptions = computed<DashboardFilterOption[]>(() => {
  const base: DashboardFilterOption[] = [
    {
      value: 'all',
      label: 'Todas as pastas',
      description: 'Mostra projetos de qualquer pasta.',
      group: 'Visão geral',
    },
    {
      value: 'root',
      label: 'Sem pasta (raiz)',
      description: 'Somente projetos fora de pastas.',
      group: 'Visão geral',
    },
  ]

  const nested = folderFilterOptions.value.map((folderOption) => ({
    value: folderOption.id,
    label: folderOption.pathLabel,
    description: 'Inclui esta pasta e todas as subpastas.',
    group: folderOption.depth === 0 ? 'Pastas na raiz' : 'Subpastas',
  }))

  return [...base, ...nested]
})

const openFolderFromSidebar = (folderId: string | null) => {
  const normalized = normalizeFolderId(folderId)
  activeView.value = 'all'

  if (!normalized) {
    setActiveFolder(null)
    filterFolderId.value = 'all'
    return
  }

  setActiveFolder(normalized)
  filterFolderId.value = normalized
}

// "Sem pasta" quick filter
const isNoFolderView = computed(() =>
  filterFolderId.value === 'root' && activeView.value === 'all' && !activeFolderId.value
)

const goToNoFolder = () => {
  activeView.value = 'all'
  setActiveFolder(null)
  filterFolderId.value = 'root'
}

// Active filter chips
const activeFilterChips = computed(() => {
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (filterOrganization.value !== 'all') {
    const opt = [{ value: 'personal', label: 'Pessoal' }, { value: 'team', label: 'Equipe' }].find(o => o.value === filterOrganization.value)
    chips.push({ key: 'org', label: opt?.label ?? filterOrganization.value, clear: () => { filterOrganization.value = 'all' } })
  }
  if (filterType.value !== 'all') {
    const opt = typeFilterOptions.find(o => o.value === filterType.value)
    chips.push({ key: 'type', label: opt?.label ?? filterType.value, clear: () => { filterType.value = 'all' } })
  }
  if (filterTime.value !== 'all') {
    const opt = timeFilterOptions.find(o => o.value === filterTime.value)
    chips.push({ key: 'time', label: opt?.label ?? filterTime.value, clear: () => { filterTime.value = 'all' } })
  }
  if (filterFolderId.value !== 'all') {
    const opt = folderFilterDropdownOptions.value.find(o => o.value === filterFolderId.value)
    chips.push({ key: 'folder', label: opt?.label ?? 'Pasta', clear: () => { filterFolderId.value = 'all'; setActiveFolder(null) } })
  }
  return chips
})

const currentMoveProject = computed(() => {
  const id = normalizeFolderId(projectToMoveId.value)
  if (!id) return null
  return projects.value.find((p) => p.id === id) || null
})

const projectToMoveCurrentFolderId = computed(() => normalizeFolderId(currentMoveProject.value?.folder_id))

const projectToMoveCurrentFolderLabel = computed(() => {
  return formatFolderPathLabel(projectToMoveCurrentFolderId.value)
})

const moveProjectDestinationFolderLabel = computed(() => {
  return formatFolderPathLabel(moveProjectFolderId.value)
})

const isMoveDestinationUnchanged = computed(() => {
  return normalizeFolderId(moveProjectFolderId.value) === projectToMoveCurrentFolderId.value
})

// Get project count for a folder
const getProjectCount = (folderId: string): number => {
  return safeProjects.value.filter(p => p.folder_id === folderId).length
}

// Helper: valid project name
const isValidProjectName = computed(() => {
  const len = String(newProjectName.value || '').trim().length
  return len > 0 && len <= PROJECT_NAME_MAX_LENGTH
})

// Helper: valid folder name
const isValidFolderName = computed(() => {
  return newFolderName.value && newFolderName.value.trim().length > 0
})

// Create project
const createProject = async () => {
  if (!isValidProjectName.value) {
    showToast('Nome do projeto inválido. Use entre 1 e 120 caracteres.')
    return
  }

  isLoading.value = true
  try {
    const userId = auth.user.value?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    const initialPage = {
      id: makeId(),
      name: 'Página 1',
      width: 1080,
      height: 1920,
      type: 'RETAIL_OFFER',
      canvasData: null,
      thumbnail: undefined,
    }

    const headers = await getApiAuthHeaders()
    const folderId = normalizeFolderIdForProjectPayload(activeFolderId.value)
    const body: Record<string, any> = {
      name: normalizeProjectName(newProjectName.value),
      canvas_data: [initialPage],
      last_viewed: new Date().toISOString(),
    }
    if (folderId !== undefined) {
      body.folder_id = folderId
    }

    const response = await $fetch<any>('/api/projects', {
      method: 'POST',
      headers,
      body
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
    showToast('Erro ao criar projeto. Tente novamente.')
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
        showToast('Erro ao excluir projeto.')
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
      showToast('Usuário não autenticado.')
      return
    }

    const original = projects.value.find(p => p.id === projectId)
    if (!original) return

    const headers = await getApiAuthHeaders()
    const fullProject = await $fetch<any>('/api/projects', {
      headers,
      query: { id: projectId }
    })
    const canvasData = Array.isArray(fullProject?.canvas_data)
      ? fullProject.canvas_data
      : (Array.isArray((original as any)?.canvas_data) ? (original as any).canvas_data : null)
    if (!Array.isArray(canvasData) || canvasData.length === 0) {
      throw new Error('Projeto sem dados de canvas para duplicação')
    }

    const duplicateBody: Record<string, any> = {
      name: buildDuplicateProjectName(original.name),
      canvas_data: canvasData,
      last_viewed: new Date().toISOString(),
    }
    const duplicateFolderId = normalizeFolderIdForProjectPayload(original.folder_id)
    if (duplicateFolderId !== undefined) {
      duplicateBody.folder_id = duplicateFolderId
    }

    const response = await $fetch<any>('/api/projects', {
      method: 'POST',
      headers,
      body: duplicateBody
    })
    const data = response?.project || null

    if (data) {
      projects.value.unshift(data)
    }
    showProjectMenu.value = null
  } catch (error: any) {
    console.error('Error duplicating project:', {
      statusCode: error?.statusCode ?? error?.response?.status ?? null,
      statusMessage: error?.statusMessage ?? error?.data?.statusMessage ?? null,
      message: error?.message ?? null,
      data: error?.data ?? null
    })
    showToast('Erro ao duplicar projeto.')
  }
}

const moveProjectToFolder = async (projectId: string, folderId: string | null) => {
  const id = String(projectId || '').trim()
  if (!id) return
  try {
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers,
      body: { id, folder_id: folderId }
    })
    const project = projects.value.find(p => p.id === id)
    if (project) {
      project.folder_id = folderId
    }
  } catch (error) {
    console.error('Error moving project:', error)
    showToast('Erro ao mover projeto.')
  }
}

const openMoveProjectModal = (projectId: string | null | undefined) => {
  const id = String(projectId || '').trim()
  if (!id) return
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  projectToMoveId.value = id
  moveProjectFolderId.value = String(project.folder_id || '')
  showMoveProjectModal.value = true
  showProjectMenu.value = null
}

const closeMoveProjectModal = () => {
  showMoveProjectModal.value = false
  projectToMoveId.value = null
  moveProjectFolderId.value = ''
  isMovingProject.value = false
}

const confirmMoveProjectModal = async () => {
  const projectId = String(projectToMoveId.value || '').trim()
  if (!projectId) return
  if (isMoveDestinationUnchanged.value) return
  isMovingProject.value = true
  try {
    const folderId = String(moveProjectFolderId.value || '').trim()
    await moveProjectToFolder(projectId, folderId || null)
    closeMoveProjectModal()
  } finally {
    isMovingProject.value = false
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
    showToast('Erro ao renomear projeto.')
  }
}

// Cancel renaming project
const cancelRenameProject = () => {
  renamingProjectId.value = null
  editingProjectName.value = ''
}

// Show project context menu
const showProjectContextMenu = (projectId: string, event: MouseEvent) => {
  if (showCreateProject.value || showCreateFolder.value || showMoveProjectModal.value) return
  event.preventDefault()
  event.stopPropagation()
  showFolderMenu.value = null
  showNotifications.value = false
  projectMenuPosition.value = { x: event.clientX, y: event.clientY }
  showProjectMenu.value = projectId
}

const isInteractiveProjectCardTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('button, input, textarea, select, a, [contenteditable="true"], .project-context-menu, .folder-context-menu')
}

const handleProjectCardClick = (projectId: string, event: MouseEvent) => {
  if (isInteractiveProjectCardTarget(event.target)) return
  void openProject(projectId)
}

// Handle confirm dialog
const handleConfirm = async () => {
  showConfirmDialog.value = false
  if (confirmDialogData.value.action) {
    try {
      await confirmDialogData.value.action()
    } catch (error) {
      console.error('Erro ao executar ação confirmada:', error)
    }
  }
}

const handleCancelConfirm = () => {
  showConfirmDialog.value = false
}

// Open project
const openProject = (projectId: string) => {
  // Fire-and-forget: don't block navigation waiting for the PATCH
  updateLastViewed(projectId)
  navigateTo(`/editor/${projectId}`)
}

// Create folder
const handleCreateFolder = async () => {
  if (!isValidFolderName.value) return

  try {
    await createFolder(newFolderName.value, activeFolderId.value, { scope: 'project' })
    newFolderName.value = ''
    showCreateFolder.value = false
  } catch (error) {
    showToast('Erro ao criar pasta.')
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
    showToast('Erro ao renomear pasta.')
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
        showToast('Erro ao excluir pasta.')
      }
    }
  }
  showConfirmDialog.value = true
}

// Show folder context menu
const showFolderContextMenu = (folderId: string, event: MouseEvent) => {
  if (showCreateProject.value || showCreateFolder.value || showMoveProjectModal.value) return
  event.preventDefault()
  event.stopPropagation()
  showProjectMenu.value = null
  showNotifications.value = false
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
  if (!fullName) return 'Studio PRO'
  const names = fullName.trim().split(/\s+/)
  if (names.length <= 2) return fullName
  return `${names[0]} ${names[1]}`
}

const hasUsableProjectPreview = (project: any): boolean => {
  return !!getProjectPreviewSource(project)
}

const getProjectPreviewFrameStyle = (project: any) => {
  const width = Number(project?.preview_width || 0)
  const height = Number(project?.preview_height || 0)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {}
  }
  return {
    aspectRatio: `${width} / ${height}`
  }
}

const {
  rootEl: progressiveProjectPreviewRootEl,
  visibleIds: visibleProjectPreviewIds,
  shouldShowPreview: shouldShowProjectPreview,
  getPreviewSrc: getProjectPreviewSrc,
  promotePreview: promoteProjectPreview,
  setPreviewHost: setProjectPreviewHost,
  refreshPreviewObserver: refreshProjectPreviewObserver
} = useProgressivePreviewLoader<any>({
  getItems: () => filteredProjects.value,
  getId: (project: any) => String(project?.id || ''),
  getSrc: (project: any) => getProjectPreviewSource(project),
  enabled: () => !isLoadingProjects.value,
  immediateCount: () => viewMode.value === 'list' ? 6 : 12,
  batchSize: () => viewMode.value === 'list' ? 4 : 6,
  rootMargin: () => viewMode.value === 'list' ? '200px' : '300px',
  threshold: () => viewMode.value === 'list' ? 0.1 : 0.05,
  hydrateVisibleOnly: false,
  maxVisibleHydrated: null
})

watch(projectGridViewportEl, (value) => {
  progressiveProjectPreviewRootEl.value = value
  void refreshProjectPreviewObserver()
})

const isProjectPreviewDeferred = (project: any, index: number): boolean => {
  return hasUsableProjectPreview(project) && !shouldShowProjectPreview(project, index)
}

// Handle sign out
const handleSignOut = async () => {
  await auth.signOut()
}

// Drag and drop handlers
const handleProjectPointerDown = (projectId: string, event: MouseEvent) => {
  if (event.button !== 0) return
  dragPointerMeta.value = {
    projectId,
    x: Number(event.clientX || 0),
    y: Number(event.clientY || 0),
    at: Date.now()
  }
}

const handleDragStart = (projectId: string, event: DragEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, input, textarea, select, [contenteditable="true"], a')) {
    event.preventDefault()
    return
  }

  const meta = dragPointerMeta.value
  const dx = Number(event.clientX || 0) - Number(meta.x || 0)
  const dy = Number(event.clientY || 0) - Number(meta.y || 0)
  const dist = Math.hypot(dx, dy)
  const sameCard = meta.projectId === projectId
  const minDragDistance = 6
  // Ignore accidental click jitter that triggers native drag snapshot.
  if (!sameCard || dist < minDragDistance) {
    event.preventDefault()
    return
  }

  draggedProjectId.value = projectId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', projectId)
    if (transparentDragImage) {
      // Avoid heavy native drag snapshots (can trigger compositor glitches).
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0)
    }
  }
}

const handleDragEnd = () => {
  draggedProjectId.value = null
  dragPointerMeta.value = { projectId: null, x: 0, y: 0, at: 0 }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDropOnFolder = async (folderId: string, event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!draggedProjectId.value) return

  await moveProjectToFolder(draggedProjectId.value, folderId)

  draggedProjectId.value = null
}

const handleDropOnRoot = async (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!draggedProjectId.value) return

  await moveProjectToFolder(draggedProjectId.value, null)

  draggedProjectId.value = null
}
</script>


<template>
  <div class="dash-root h-screen w-screen overflow-hidden flex flex-col">
    <div class="flex-1 w-full h-full max-w-480 mx-auto overflow-hidden flex flex-col relative">

      <!-- Top Bar -->
      <header class="dash-topbar h-14 px-5 flex items-center justify-between shrink-0 relative z-30 safe-top">
        <div class="flex items-center gap-2.5">
          <!-- Mobile hamburger -->
          <button
            v-if="dashMobile"
            class="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-lg transition-all text-slate-500 hover:text-slate-800 -ml-1"
            @click="showMobileDrawer = true"
          >
            <MenuIcon class="w-5 h-5" />
          </button>
          <div class="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-50 border border-indigo-200">
            <Sparkles class="w-4 h-4 text-indigo-500" />
          </div>
          <span v-if="!dashMobile" class="text-[14px] font-bold tracking-tight text-slate-800">Studio <span class="text-slate-400 font-normal">PRO</span></span>
        </div>
        <!-- Busca centralizada no desktop -->
        <div v-if="!dashMobile" class="flex-1 max-w-md mx-6">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar projetos…"
              class="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl text-[13px] text-slate-800 pl-9 pr-4 focus:outline-none focus:border-indigo-400 focus:bg-white placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            ref="notificationButtonRef"
            @click.stop="toggleNotifications"
            class="notification-button w-9 h-9 flex items-center justify-center hover:bg-black/5 rounded-xl transition-all text-slate-400 hover:text-slate-700 relative"
          >
            <Bell class="w-[18px] h-[18px]" />
            <span v-if="unreadCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white"></span>
          </button>
          <div v-if="user" class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-black/5 rounded-xl cursor-pointer transition-all group">
            <div class="w-7 h-7 bg-linear-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden">
              <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.name" class="w-full h-full object-cover" />
              <span v-else>{{ user.name?.charAt(0) || 'U' }}</span>
            </div>
            <span v-if="!dashMobile" class="text-[13px] font-medium text-slate-500 group-hover:text-slate-700 max-w-35 truncate transition-colors">{{ formatUserName(user?.name) }}</span>
            <ChevronDown v-if="!dashMobile" class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>
      </header>

      <!-- Layout -->
      <div class="dash-layout relative flex-1 flex overflow-hidden min-h-0">

        <!-- Mobile Drawer (contains same sidebar content) -->
        <DashboardMobileDrawer v-if="dashMobile" v-model:open="showMobileDrawer">
          <div class="flex flex-col h-full">
            <!-- Search -->
            <div class="px-3 pt-3 pb-2.5 shrink-0">
              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Buscar projetos…"
                  class="w-full h-8 bg-slate-100 border border-slate-200 rounded-lg text-[12px] text-slate-800 pl-8 pr-3 focus:outline-none focus:border-indigo-400/40 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>
            <!-- Nav -->
            <div class="px-2 pb-1 shrink-0">
              <p class="sidebar-section-label px-2 mb-1">Explorar</p>
              <button @click="activeView = 'recent'; showMobileDrawer = false" :class="['dash-nav-item w-full', activeView === 'recent' ? 'active' : '']">
                <Clock class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Recentes</span>
              </button>
              <button @click="activeView = 'all'; setActiveFolder(null); filterFolderId = 'all'; showMobileDrawer = false" :class="['dash-nav-item w-full', activeView === 'all' && !activeFolderId ? 'active' : '']">
                <FolderOpen class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Todos</span>
              </button>
              <button @click="activeView = 'starred'; showMobileDrawer = false" :class="['dash-nav-item w-full', activeView === 'starred' ? 'active starred' : '']">
                <Star class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Favoritos</span>
              </button>
              <button @click="activeView = 'shared'; showMobileDrawer = false" :class="['dash-nav-item w-full', activeView === 'shared' ? 'active' : '']">
                <Users class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Compartilhados</span>
              </button>
            </div>
            <div class="sidebar-divider mx-3 my-1"></div>
            <!-- Bottom -->
            <div class="px-2 pb-3 mt-auto shrink-0">
              <div class="sidebar-divider mx-1 mb-2"></div>
              <button @click="navigateTo('/profile'); showMobileDrawer = false" class="dash-nav-item w-full">
                <User class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Meu Perfil</span>
              </button>
              <button @click="handleSignOut" class="dash-nav-item signout w-full">
                <LogOut class="w-3.5 h-3.5 shrink-0" /><span class="flex-1 text-left">Sair</span>
              </button>
            </div>
          </div>
        </DashboardMobileDrawer>

        <!-- Sidebar (hidden on mobile) -->
        <aside v-show="!dashMobile" class="dash-sidebar w-64 h-full min-h-0 flex flex-col shrink-0 overflow-hidden relative z-10">

          <!-- Nav Section -->
          <div class="px-3 pt-4 pb-1 shrink-0">
            <p class="sidebar-section-label px-1 mb-2">Explorar</p>
            <button
              @click="activeView = 'recent'"
              :class="['dash-nav-item w-full', activeView === 'recent' ? 'active' : '']"
              aria-label="Visualizar projetos recentes"
            >
              <Clock class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Recentes</span>
              <span class="nav-count">10</span>
            </button>
            <button
              @click="activeView = 'all'; setActiveFolder(null); filterFolderId = 'all'"
              :class="['dash-nav-item w-full', activeView === 'all' && !isNoFolderView && !activeFolderId ? 'active' : '']"
              aria-label="Visualizar todos os projetos"
            >
              <FolderOpen class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Todos</span>
              <span class="nav-count">{{ safeProjects.length }}</span>
            </button>
            <button
              @click="goToNoFolder"
              :class="['dash-nav-item w-full', isNoFolderView ? 'active' : '']"
              title="Projetos sem pasta"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                <line x1="9" y1="12" x2="15" y2="12" />
              </svg>
              <span class="flex-1 text-left">Sem pasta</span>
              <span v-if="rootProjects.length > 0" class="nav-count">{{ rootProjects.length }}</span>
            </button>
            <button
              @click="activeView = 'starred'"
              :class="['dash-nav-item w-full', activeView === 'starred' ? 'active starred' : '']"
            >
              <Star class="w-4 h-4 shrink-0" :class="{ 'fill-current text-amber-400': activeView === 'starred' }" />
              <span class="flex-1 text-left">Favoritos</span>
              <span v-if="starredProjectsCount > 0" class="nav-count">{{ starredProjectsCount }}</span>
            </button>
            <button
              @click="activeView = 'shared'"
              :class="['dash-nav-item w-full', activeView === 'shared' ? 'active' : '']"
              aria-label="Visualizar projetos compartilhados"
            >
              <Users class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Compartilhados</span>
            </button>
          </div>

          <!-- Divider -->
          <div class="sidebar-divider mx-4 my-2"></div>

          <!-- Folders -->
          <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
            <div class="flex items-center justify-between px-1 mb-2">
              <p class="sidebar-section-label">Pastas</p>
              <button
                @click="showCreateFolder = true"
                class="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-all"
                title="Nova pasta"
              >
                <FolderPlus class="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              :class="['dash-nav-item w-full', !activeFolderId && activeView === 'all' && !isNoFolderView ? 'active' : '']"
              @click="openFolderFromSidebar(null)"
              @dragover="handleDragOver"
              @drop="handleDropOnRoot"
              style="cursor:pointer"
            >
              <FolderOpen class="w-4 h-4 shrink-0 opacity-50" />
              <span class="flex-1 text-left font-medium truncate">Raiz</span>
              <span class="nav-count">{{ safeProjects.length }}</span>
            </div>
            <div class="folder-tree" v-if="isMounted">
              <FolderTreeItem
                v-for="folder in folderTree"
                :key="folder.id"
                :folder="folder"
                :level="0"
                :is-active="activeFolderId === folder.id"
                :is-expanded="folder.isExpanded"
                :project-count="folder.projectCount"
                :is-editing="editingFolderId === folder.id"
                :editing-name="editingFolderName"
                :active-folder-id="activeFolderId"
                :editing-folder-id="editingFolderId"
                :expanded-folders="expandedFolders"
                @select="(id: string) => openFolderFromSidebar(id)"
                @toggle="(id: string) => toggleFolder(id)"
                @context-menu="(e: MouseEvent, id: string) => { e.stopPropagation(); showFolderContextMenu(id, e) }"
                @update-name="(name: string) => editingFolderName = name"
                @drop-on-folder="handleDropOnFolder"
                @save-edit="saveFolderName"
                @cancel-edit="cancelEditFolder"
              />
            </div>
          </div>

          <!-- Bottom -->
          <div class="px-3 pb-3 shrink-0">
            <div class="sidebar-divider mx-1 mb-2"></div>
            <button
              @click="navigateTo('/profile')"
              class="dash-nav-item w-full"
              aria-label="Abrir perfil do usuário"
            >
              <User class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Meu Perfil</span>
            </button>
            <button
              @click="handleSignOut"
              class="dash-nav-item signout w-full"
              title="Sair"
            >
              <LogOut class="w-4 h-4 shrink-0" />
              <span class="flex-1 text-left">Sair</span>
            </button>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="dash-main flex-1 flex flex-col overflow-hidden relative z-10">

          <!-- Page Header -->
          <div :class="['flex items-center justify-between gap-4 shrink-0', dashMobile ? 'px-4 pt-4 pb-3' : 'px-7 pt-5 pb-4']">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h1 :class="['dash-page-title font-bold leading-tight text-slate-800 tracking-tight truncate', dashMobile ? 'text-[18px]' : 'text-[22px]']">{{ dashboardTitle }}</h1>
                <template v-if="activeFolderId">
                  <span class="text-slate-300 text-[12px]">/</span>
                  <span class="text-[13px] text-slate-500 truncate max-w-50 font-medium">{{ folders.find(f => f.id === activeFolderId)?.name }}</span>
                </template>
              </div>
              <p class="text-[12px] text-slate-400 mt-0.5">
                <span class="text-slate-500 font-semibold">{{ filteredProjects.length }}</span>
                {{ filteredProjects.length === 1 ? ' projeto' : ' projetos' }}
                <span v-if="!dashMobile" class="mx-1.5 text-slate-300">·</span>
                <span v-if="!dashMobile">{{ dashboardContextHint }}</span>
              </p>
            </div>
            <!-- Desktop: inline button / Mobile: FAB -->
            <button
              v-if="!dashMobile"
              @click="showCreateProject = true"
              class="dash-cta shrink-0 h-10 px-5 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-all"
            >
              <Plus class="w-4 h-4" />
              Novo Projeto
            </button>
          </div>

          <!-- Toolbar -->
          <div :class="['pb-3 flex items-center gap-3 shrink-0', dashMobile ? 'px-4 overflow-x-auto' : 'px-7']">
            <div class="dash-tabs flex items-center gap-0.5 p-0.5 rounded-xl shrink-0">
              <button @click="activeView = 'recent'" :class="['dash-tab', activeView === 'recent' ? 'active' : '']">Recentes</button>
              <button @click="activeView = 'all'" :class="['dash-tab', activeView === 'all' ? 'active' : '']">Todos</button>
              <button @click="activeView = 'starred'" :class="['dash-tab', activeView === 'starred' ? 'active' : '']">Favoritos</button>
              <button @click="activeView = 'shared'" :class="['dash-tab', activeView === 'shared' ? 'active' : '']">Compartilhados</button>
            </div>
            <div class="flex-1 min-w-0"></div>
            <div class="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 shrink-0">
              <button @click="viewMode = 'grid'" :class="['p-2 rounded-lg transition-all', viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600']" title="Grade"><Grid class="w-4 h-4" /></button>
              <button @click="viewMode = 'list'" :class="['p-2 rounded-lg transition-all', viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600']" title="Lista"><List class="w-4 h-4" /></button>
            </div>
          </div>

          <!-- Mobile FAB -->
          <button
            v-if="dashMobile"
            @click="showCreateProject = true"
            class="fixed bottom-6 right-5 z-100 w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 shadow-xl shadow-indigo-500/30 flex items-center justify-center text-white transition-all active:scale-95 safe-bottom"
          >
            <Plus class="w-6 h-6" />
          </button>

          <!-- Active Filter Chips -->
          <div v-if="activeFilterChips.length > 0" class="px-7 pb-3 flex items-center gap-2 flex-wrap shrink-0">
            <span class="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold">Filtros</span>
            <button
              v-for="chip in activeFilterChips"
              :key="chip.key"
              @click="chip.clear()"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 hover:text-indigo-700 transition-all"
            >
              {{ chip.label }}
              <svg class="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              v-if="activeFilterChips.length > 1"
              @click="filterOrganization = 'all'; filterType = 'all'; filterTime = 'all'; filterFolderId = 'all'; setActiveFolder(null)"
              class="text-[11px] text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
            >Limpar tudo</button>
          </div>

          <!-- Content Grid -->
          <div ref="projectGridViewportEl" class="flex-1 overflow-y-auto px-7 pb-7">
            <div v-if="isLoadingProjects" class="flex items-center justify-center h-full">
              <div class="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin opacity-70"></div>
            </div>

            <div v-else>
              <!-- Folder Cards -->
              <section v-if="activeView === 'all' && !searchQuery && visibleFoldersOnDashboard.length > 0" class="mb-6">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="section-label">
                    <span v-if="activeFolderId">Subpastas</span>
                    <span v-else>Pastas</span>
                  </h2>
                  <span class="text-[10px] text-slate-400">{{ visibleFoldersOnDashboard.length }}</span>
                </div>
                <div class="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  <button
                    v-for="folder in visibleFoldersOnDashboard"
                    :key="folder.id"
                    type="button"
                    :class="['dash-folder-card group text-left', activeFolderId === folder.id ? 'active' : '']"
                    @click="openFolderFromSidebar(folder.id)"
                    @contextmenu="(e: MouseEvent) => showFolderContextMenu(folder.id, e)"
                  >
                    <div class="flex items-center justify-between mb-2.5">
                      <div class="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                        <Folder class="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <span class="text-[10px] text-slate-400 font-mono">{{ getFolderProjectCount(folder.id) }}</span>
                    </div>
                    <p class="text-[13px] font-semibold text-slate-700 truncate leading-tight group-hover:text-slate-900 transition-colors">{{ folder.name || 'Sem nome' }}</p>
                    <p class="mt-0.5 text-[10px] text-slate-400">{{ pluralize(getFolderSubfolderCount(folder.id), 'subpasta', 'subpastas') }}</p>
                  </button>
                </div>
              </section>

              <div v-if="activeView === 'all' && visibleFoldersOnDashboard.length > 0 && filteredProjects.length > 0" class="flex items-center justify-between mb-3">
                <h2 class="section-label">Projetos</h2>
                <span class="text-[10px] text-slate-400">{{ filteredProjects.length }}</span>
              </div>

              <!-- Project Cards -->
              <div
                v-if="filteredProjects.length > 0"
                class="grid gap-4"
                :class="viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-1'"
              >
                <div
                  v-for="(project, projectIndex) in filteredProjects"
                  :key="project.id"
                  :ref="(el) => setProjectPreviewHost(project.id, el as Element | null)"
                  :data-preview-id="project.id"
                  :class="['project-card-shell group relative flex flex-col overflow-hidden cursor-pointer transition-all duration-200', viewMode === 'grid' ? 'dash-project-card' : 'dash-project-list-item']"
                  draggable="true"
                  @mousedown="handleProjectPointerDown(project.id, $event)"
                  @dragstart="handleDragStart(project.id, $event)"
                  @dragend="handleDragEnd"
                  @click="handleProjectCardClick(project.id, $event)"
                  @mouseenter="promoteProjectPreview(project, projectIndex)"
                >
                  <!-- Grid mode -->
                  <template v-if="viewMode === 'grid'">
                    <div class="aspect-[3/4] bg-slate-50 relative overflow-hidden rounded-t-[10px] dash-project-preview-frame" :style="getProjectPreviewFrameStyle(project)">
                      <DashboardProjectPreview
                        class="absolute inset-0"
                        :project="project"
                        :src="shouldShowProjectPreview(project, projectIndex) ? getProjectPreviewSrc(project, projectIndex) : ''"
                        image-class="project-thumb-media"
                        fallback-class="items-end justify-start rounded-xl border border-slate-200 p-4 text-4xl font-black tracking-tighter"
                        :loading="projectIndex < 8 ? 'eager' : 'lazy'"
                        :fetchpriority="projectIndex < 4 ? 'high' : (visibleProjectPreviewIds[String(project.id || '')] ? 'auto' : 'low')"
                      />
                      <!-- Overlay de acoes no hover -->
                      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all pointer-events-none"></div>
                      <button
                        @pointerdown.stop @mousedown.stop @touchstart.stop
                        @click.stop="toggleStarred(project.id)"
                        :class="['absolute top-2.5 left-2.5 w-8 h-8 rounded-lg backdrop-blur-md flex items-center justify-center border transition-all', project.is_starred ? 'bg-amber-50 text-amber-500 border-amber-300 opacity-100 shadow-sm' : 'bg-white/90 text-slate-400 border-slate-200 opacity-0 group-hover:opacity-100 hover:text-slate-700 shadow-sm']"
                        title="Favoritar"
                      ><Star class="w-4 h-4" :class="{ 'fill-current': project.is_starred }" /></button>
                      <button
                        @pointerdown.stop @mousedown.stop @touchstart.stop
                        @click.stop="showProjectContextMenu(project.id, $event)"
                        class="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg bg-white/90 backdrop-blur-md border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                        title="Ações"
                      ><MoreVertical class="w-4 h-4" /></button>
                    </div>
                    <div class="px-3.5 pt-3 pb-3.5 flex flex-col gap-1 dash-card-info">
                      <div v-if="renamingProjectId === project.id" @click.stop>
                        <input v-model="editingProjectName" type="text" class="w-full px-2 py-1 text-[13px] bg-slate-50 border border-indigo-400 rounded-md focus:outline-none text-slate-800" @keyup.enter="saveProjectName(project.id)" @keyup.esc="cancelRenameProject" @blur="saveProjectName(project.id)" ref="renameInput" />
                      </div>
                      <h3 v-else class="font-semibold text-[14px] text-slate-800 truncate tracking-tight transition-colors group-hover:text-indigo-600 leading-snug">{{ project.name || 'Sem título' }}</h3>
                      <div class="flex items-center justify-between gap-2 mt-0.5">
                        <p class="text-[11px] text-slate-400 truncate flex items-center gap-1 font-medium">
                          <Clock class="w-3 h-3 shrink-0" />
                          {{ formatDistanceToNow(project.last_viewed || project.updated_at || project.created_at) }}
                        </p>
                        <span v-if="!String(project.folder_id || '').trim()" class="text-[9px] font-semibold uppercase tracking-wider text-slate-400 border border-slate-200 rounded-full px-1.5 py-0.5 shrink-0">Raiz</span>
                      </div>
                    </div>
                  </template>

                  <!-- List mode -->
                  <template v-else>
                    <div class="flex items-center gap-4 px-4 py-3">
                      <div class="w-16 h-20 rounded-lg overflow-hidden bg-slate-50 shrink-0 border border-slate-200 dash-project-preview-frame">
                        <DashboardProjectPreview
                          :project="project"
                          :src="shouldShowProjectPreview(project, projectIndex) ? getProjectPreviewSrc(project, projectIndex) : ''"
                          fallback-class="items-center justify-center rounded-lg text-base font-black"
                          :loading="projectIndex < 4 ? 'eager' : 'lazy'"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div v-if="renamingProjectId === project.id" @click.stop>
                          <input v-model="editingProjectName" type="text" class="w-full px-2 py-0.5 text-[13px] bg-slate-50 border border-indigo-400 rounded focus:outline-none text-slate-800" @keyup.enter="saveProjectName(project.id)" @keyup.esc="cancelRenameProject" @blur="saveProjectName(project.id)" ref="renameInput" />
                        </div>
                        <h3 v-else class="text-[14px] font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{{ project.name || 'Sem título' }}</h3>
                        <p class="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock class="w-3 h-3 shrink-0" />
                          {{ formatDistanceToNow(project.last_viewed || project.updated_at || project.created_at) }}
                        </p>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <button @pointerdown.stop @mousedown.stop @touchstart.stop @click.stop="toggleStarred(project.id)" :class="['w-8 h-8 rounded-lg border flex items-center justify-center transition-all', project.is_starred ? 'bg-amber-50 text-amber-500 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600']"><Star class="w-4 h-4" :class="{ 'fill-current': project.is_starred }" /></button>
                        <button @pointerdown.stop @mousedown.stop @touchstart.stop @click.stop="showProjectContextMenu(project.id, $event)" class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"><MoreVertical class="w-4 h-4" /></button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="filteredProjects.length === 0 && !isLoadingProjects" class="flex items-center justify-center h-56">
                <div class="text-center">
                  <div class="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-200">
                    <FolderOpen class="w-5 h-5 text-slate-400" />
                  </div>
                  <h3 class="text-[14px] font-semibold text-slate-500 mb-1">
                    <span v-if="searchQuery">Nenhum resultado</span>
                    <span v-else-if="activeFolderId">Pasta vazia</span>
                    <span v-else>Nenhum projeto ainda</span>
                  </h3>
                  <p class="text-[12px] text-slate-400 mb-4">
                    <span v-if="searchQuery">Tente outra busca ou limpe os filtros</span>
                    <span v-else>Crie seu primeiro projeto para começar</span>
                  </p>
                  <button v-if="!searchQuery" @click="showCreateProject = true" class="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[12px] font-medium inline-flex items-center gap-2 transition-all">
                    <Plus class="w-3.5 h-3.5" />
                    Criar Projeto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

    <!-- Create Project Modal -->
    <div v-if="showCreateProject" class="fixed inset-0 z-500 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" @click.self="showCreateProject = false">
      <div class="dash-modal w-full max-w-sm">
        <h3 class="text-[15px] font-semibold text-slate-800 mb-1">Novo Projeto</h3>
        <p class="text-[12px] text-slate-400 mb-5">
          <span v-if="activeFolderId">Em: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Na raiz do workspace</span>
        </p>
        <input v-model="newProjectName" type="text" placeholder="Nome do projeto…" class="dash-modal-input mb-4" @keyup.enter="createProject()" />
        <div class="flex gap-2">
          <button @click="showCreateProject = false" class="dash-modal-btn-cancel flex-1">Cancelar</button>
          <button @click="createProject()" :disabled="isLoading || !isValidProjectName" class="dash-modal-btn-confirm flex-1">{{ isLoading ? 'Criando…' : 'Criar' }}</button>
        </div>
      </div>
    </div>

    <!-- Create Folder Modal -->
    <div v-if="showCreateFolder" class="fixed inset-0 z-500 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" @click.self="showCreateFolder = false">
      <div class="dash-modal w-full max-w-sm">
        <h3 class="text-[15px] font-semibold text-slate-800 mb-1">Nova Pasta</h3>
        <p class="text-[12px] text-slate-400 mb-5">
          <span v-if="activeFolderId">Dentro de: {{ folders.find(f => f.id === activeFolderId)?.name }}</span>
          <span v-else>Na raiz</span>
        </p>
        <input v-model="newFolderName" type="text" placeholder="Nome da pasta…" class="dash-modal-input mb-4" @keyup.enter="handleCreateFolder()" />
        <div class="flex gap-2">
          <button @click="showCreateFolder = false" class="dash-modal-btn-cancel flex-1">Cancelar</button>
          <button @click="handleCreateFolder()" :disabled="!isValidFolderName" class="dash-modal-btn-confirm flex-1">Criar</button>
        </div>
      </div>
    </div>

    <!-- Folder Context Menu -->
    <teleport to="body">
      <div
        v-if="showFolderMenu"
        class="folder-context-menu fixed z-100 bg-white border border-slate-200 rounded-xl py-1.5 min-w-40 shadow-xl shadow-black/10"
        :style="{ left: `${folderMenuPosition.x}px`, top: `${folderMenuPosition.y}px` }"
      >
        <button @click="startEditFolder(folders.find(f => f.id === showFolderMenu))" class="ctx-menu-item w-full">
          <Pencil class="w-3.5 h-3.5" />
          Renomear
        </button>
        <button @click="handleDeleteFolder(showFolderMenu)" class="ctx-menu-item danger w-full">
          <Trash2 class="w-3.5 h-3.5" />
          Excluir
        </button>
      </div>
    </teleport>

    <!-- Project Context Menu -->
    <teleport to="body">
      <div
        v-if="showProjectMenu"
        class="project-context-menu fixed z-100 bg-white border border-slate-200 rounded-xl py-1.5 min-w-40 shadow-xl shadow-black/10"
        :style="{ left: `${projectMenuPosition.x}px`, top: `${projectMenuPosition.y}px` }"
      >
        <button @click="startRenameProject(projects.find(p => p.id === showProjectMenu))" class="ctx-menu-item w-full">
          <Pencil class="w-3.5 h-3.5" />
          Renomear
        </button>
        <button @click="duplicateProject(showProjectMenu)" class="ctx-menu-item w-full">
          <Copy class="w-3.5 h-3.5" />
          Duplicar
        </button>
        <button @click="openMoveProjectModal(showProjectMenu)" class="ctx-menu-item w-full">
          <Folder class="w-3.5 h-3.5" />
          Mover para pasta
        </button>
        <button @click="toggleStarred(showProjectMenu)" class="ctx-menu-item w-full">
          <Star class="w-3.5 h-3.5" :class="{ 'fill-current': projects.find(p => p.id === showProjectMenu)?.is_starred }" />
          {{ projects.find(p => p.id === showProjectMenu)?.is_starred ? 'Desfavoritar' : 'Favoritar' }}
        </button>
        <div class="h-px bg-slate-100 my-1.5 mx-2"></div>
        <button @click="deleteProject(showProjectMenu)" class="ctx-menu-item danger w-full">
          <Trash2 class="w-3.5 h-3.5" />
          Excluir
        </button>
      </div>
    </teleport>

    <!-- Move Project Modal -->
    <div v-if="showMoveProjectModal" class="fixed inset-0 z-500 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" @click.self="closeMoveProjectModal">
      <div class="dash-modal w-full max-w-xl">
        <h3 class="text-[15px] font-semibold text-slate-800 mb-1">Mover projeto</h3>
        <p class="text-[12px] text-slate-400 mb-4">Escolha a pasta de destino.</p>

        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
          <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Projeto</p>
          <p class="text-[13px] text-slate-700 font-semibold truncate">{{ projectToMoveName }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Pasta atual</p>
            <p class="text-[12px] text-slate-600 wrap-break-word">{{ projectToMoveCurrentFolderLabel }}</p>
          </div>
          <div class="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5">
            <p class="text-[10px] uppercase tracking-wider text-indigo-400/70 mb-1">Destino</p>
            <p class="text-[12px] text-indigo-200 wrap-break-word">{{ moveProjectDestinationFolderLabel }}</p>
          </div>
        </div>

        <label class="block text-[11px] text-slate-500 mb-2">Selecionar destino</label>
        <div class="mb-4 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5">
          <button type="button" class="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all" :class="normalizeFolderId(moveProjectFolderId) === '' ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-slate-100 border border-transparent'" @click="moveProjectFolderId = ''">
            <Check v-if="normalizeFolderId(moveProjectFolderId) === ''" class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span v-else class="w-4 shrink-0"></span>
            <span class="min-w-0">
              <span class="block text-[12px] text-slate-700">Sem pasta (raiz)</span>
              <span class="block text-[10px] text-slate-400">Projetos fora de qualquer pasta.</span>
            </span>
          </button>
          <button v-for="folderOption in moveProjectFolderOptions" :key="folderOption.id" type="button" class="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all border" :class="normalizeFolderId(moveProjectFolderId) === folderOption.id ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-slate-100 border-transparent'" @click="moveProjectFolderId = folderOption.id">
            <Check v-if="normalizeFolderId(moveProjectFolderId) === folderOption.id" class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span v-else class="w-4 shrink-0"></span>
            <span class="min-w-0">
              <span class="block text-[12px] text-slate-700 truncate" :style="{ paddingLeft: `${folderOption.depth * 10}px` }">{{ folderOption.name }}</span>
              <span class="block text-[10px] text-slate-400 truncate">{{ folderOption.pathLabel }}</span>
            </span>
          </button>
        </div>

        <div class="flex gap-2">
          <button @click="closeMoveProjectModal" class="dash-modal-btn-cancel flex-1">Cancelar</button>
          <button @click="confirmMoveProjectModal" :disabled="isMovingProject || isMoveDestinationUnchanged" class="dash-modal-btn-confirm flex-1">
            {{ isMovingProject ? 'Movendo…' : (isMoveDestinationUnchanged ? 'Destino atual' : 'Mover') }}
          </button>
        </div>
      </div>
    </div>

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

    <!-- Notifications Modal -->
    <teleport to="body">
      <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showNotifications" class="fixed inset-0 z-199 bg-black/20" @click="showNotifications = false"></div>
      </Transition>
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95 translate-y-[-8px]" enter-to-class="opacity-100 scale-100 translate-y-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100 translate-y-0" leave-to-class="opacity-0 scale-95 translate-y-[-8px]">
        <div v-if="showNotifications && notificationButtonRef" class="notifications-modal fixed z-200" :style="notificationModalStyle" @click.stop>
          <div class="w-80 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-black/8 overflow-hidden flex flex-col max-h-125">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 class="text-[13px] font-semibold text-slate-800">Notificações</h3>
              <button v-if="unreadCount > 0" @click="markAllAsRead" class="text-[11px] text-indigo-500 hover:text-indigo-600 transition-colors">Marcar todas</button>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="notifications.length === 0" class="p-8 text-center">
                <Bell class="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p class="text-[12px] text-slate-400">Nenhuma notificação</p>
              </div>
              <div v-else class="divide-y divide-slate-100">
                <div v-for="notification in notifications" :key="notification.id" @click="markAsRead(notification.id)" :class="['px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50', !notification.read ? 'bg-indigo-50/50' : '']">
                  <div class="flex items-start gap-3">
                    <div :class="['w-7 h-7 rounded-lg flex items-center justify-center shrink-0', notification.type === 'success' ? 'bg-green-50 text-green-500' : notification.type === 'share' ? 'bg-blue-50 text-blue-500' : 'bg-indigo-50 text-indigo-500']">
                      <Bell v-if="notification.type === 'share'" class="w-3.5 h-3.5" />
                      <Sparkles v-else class="w-3.5 h-3.5" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[12px] font-semibold text-slate-700 mb-0.5">{{ notification.title }}</p>
                      <p class="text-[11px] text-slate-500 line-clamp-2">{{ notification.message }}</p>
                      <p class="text-[10px] text-slate-400 mt-1">{{ formatDistanceToNow(notification.created_at) }}</p>
                    </div>
                    <div v-if="!notification.read" class="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0 mt-1.5"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-t border-slate-100">
              <button @click="showNotifications = false" class="w-full text-[11px] text-slate-400 hover:text-slate-600 transition-colors text-center">Fechar</button>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>

    </div>
  </div>

  <!-- Toast Notifications -->
  <teleport to="body">
    <div class="fixed bottom-6 right-6 z-9999 flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'px-4 py-3 rounded-xl text-[13px] font-medium shadow-2xl border pointer-events-auto max-w-xs backdrop-blur-xl',
            toast.type === 'error' ? 'bg-red-50 border-red-300 text-red-700' :
            toast.type === 'success' ? 'bg-green-50 border-green-300 text-green-700' :
            'bg-white border-slate-200 text-slate-700 shadow-lg'
          ]"
        >
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </teleport>
</template>

<style scoped>
/* ─── Root ───────────────────────────────────────────── */
.dash-root {
  background: #f8f9fb;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
}

/* ─── Top Bar ─────────────────────────────────────────── */
.dash-topbar {
  border-bottom: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* ─── Layout ──────────────────────────────────────────── */
.dash-layout {
  /* nothing extra needed */
}

/* ─── Sidebar ─────────────────────────────────────────── */
.dash-sidebar {
  border-right: 1px solid rgba(0,0,0,0.07);
  background: #ffffff;
}

.sidebar-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  display: block;
}

.sidebar-divider {
  height: 1px;
  background: rgba(0,0,0,0.06);
}

/* ─── Nav Items ───────────────────────────────────────── */
.dash-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  margin-bottom: 2px;
  background: transparent;
}

.dash-nav-item:hover {
  color: #1e293b;
  background: rgba(0,0,0,0.04);
}

.dash-nav-item.active {
  color: #4338ca;
  font-weight: 600;
  background: rgba(99,102,241,0.08);
  border-color: rgba(99,102,241,0.12);
}

.dash-nav-item.active.starred {
  color: #d97706;
  font-weight: 600;
  background: rgba(251,191,36,0.1);
  border-color: rgba(251,191,36,0.18);
}

.dash-nav-item.signout {
  color: #94a3b8;
}

.dash-nav-item.signout:hover {
  color: #ef4444;
  background: rgba(239,68,68,0.06);
}

.nav-count {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'SF Mono', monospace;
  min-width: 16px;
  text-align: right;
  background: rgba(0,0,0,0.04);
  padding: 1px 6px;
  border-radius: 6px;
}

/* ─── Main ────────────────────────────────────────────── */
.dash-main {
  background: #f8f9fb;
}

/* ─── Page Title ──────────────────────────────────────── */
.dash-page-title {
  letter-spacing: -0.025em;
}

/* ─── CTA Button ──────────────────────────────────────── */
.dash-cta {
  background: #4f46e5;
  color: white;
  border: none;
  box-shadow: 0 4px 14px rgba(99,102,241,0.25);
}

.dash-cta:hover {
  background: #4338ca;
  box-shadow: 0 8px 24px rgba(99,102,241,0.35);
  transform: translateY(-1px);
}

/* ─── Tabs ────────────────────────────────────────────── */
.dash-tabs {
  background: rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.07);
}

.dash-tab {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.dash-tab:hover {
  color: #1e293b;
}

.dash-tab.active {
  background: #ffffff;
  color: #1e293b;
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  font-weight: 600;
}

/* ─── Section Labels ──────────────────────────────────── */
.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #94a3b8;
}

/* ─── Folder Cards ────────────────────────────────────── */
.dash-folder-card {
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.07);
  background: #ffffff;
  padding: 14px 16px;
  transition: all 0.15s ease;
}

.dash-folder-card:hover {
  background: #ffffff;
  border-color: rgba(99,102,241,0.3);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.dash-folder-card.active {
  border-color: rgba(99,102,241,0.4);
  background: rgba(99,102,241,0.04);
}

/* ─── Project Cards ───────────────────────────────────── */
.dash-project-card {
  border-radius: 14px;
  border: 1px solid rgba(0,0,0,0.07);
  background: #ffffff;
  overflow: hidden;
}

.dash-project-card:hover {
  border-color: rgba(99,102,241,0.3);
  background: #ffffff;
  transform: translateY(-3px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(99,102,241,0.08);
}

.dash-card-info {
  border-top: 1px solid rgba(0,0,0,0.05);
  background: #ffffff;
  border-radius: 0 0 14px 14px;
}

.dash-project-list-item {
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.07);
  background: #ffffff;
}

.dash-project-list-item:hover {
  border-color: rgba(99,102,241,0.3);
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

/* ─── Context Menus ───────────────────────────────────── */
.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  transition: all 0.1s ease;
  text-align: left;
}

.ctx-menu-item:hover {
  background: rgba(0,0,0,0.05);
  color: #111827;
}

.ctx-menu-item.danger {
  color: #dc2626;
}

.ctx-menu-item.danger:hover {
  background: rgba(239,68,68,0.08);
  color: #b91c1c;
}

/* ─── Modals ──────────────────────────────────────────── */
.dash-modal {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04);
}

.dash-modal-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: #f8f9fb;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 8px;
  font-size: 13px;
  color: #1e293b;
  outline: none;
  transition: all 0.15s ease;
  display: block;
}

.dash-modal-input:focus {
  border-color: rgba(99,102,241,0.5);
  background: #ffffff;
}

.dash-modal-input::placeholder {
  color: #94a3b8;
}

.dash-modal-btn-cancel {
  height: 38px;
  background: #f1f5f9;
  border: 1px solid rgba(0,0,0,0.1);
  color: #475569;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.dash-modal-btn-cancel:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.dash-modal-btn-confirm {
  height: 38px;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  border: 1px solid rgba(99,102,241,0.3);
  color: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
  box-shadow: 0 4px 12px rgba(99,102,241,0.2);
}

.dash-modal-btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
  box-shadow: 0 6px 16px rgba(99,102,241,0.3);
}

.dash-modal-btn-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ─── Folder Tree ─────────────────────────────────────── */
.folder-tree {
  user-select: none;
}

/* ─── Scrollbar ───────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }

/* ─── Focus ───────────────────────────────────────────── */
button:focus-visible,
input:focus-visible {
  outline: 2px solid rgba(99,102,241,0.6);
  outline-offset: 2px;
}

/* ─── Toast ───────────────────────────────────────────── */
.toast-enter-active { animation: toast-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
.toast-leave-active { animation: toast-out 0.2s ease forwards; }
.toast-move { transition: transform 0.2s ease; }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(10px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes toast-out {
  to { opacity: 0; transform: translateY(6px) scale(0.97); }
}
</style>
