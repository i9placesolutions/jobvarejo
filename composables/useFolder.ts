import { ref, computed } from 'vue'
import type { Folder } from '~/types/folder'

type FolderScope = 'all' | 'project' | 'asset'
type FolderContextScope = Exclude<FolderScope, 'all'>

type LoadFoldersOptions = {
  scope?: FolderScope
}

type CreateFolderOptions = {
  scope?: FolderContextScope
  icon?: string
}

export interface FolderTreeItem extends Folder {
  children: FolderTreeItem[]
  depth: number
  path: string[]
  isExpanded: boolean
  projectCount: number
}

// State
const folders = ref<Folder[]>([])
const isLoading = ref(false)
const activeFolderId = ref<string | null>(null)
const expandedFolders = ref<Set<string>>(new Set())

const SCOPE_ICON_MAP: Record<FolderContextScope, string> = {
  project: 'project-folder',
  asset: 'asset-folder',
}

export const useFolder = () => {
  const { getApiAuthHeaders } = useApiAuth()
  const requireHeaders = async (): Promise<Record<string, string>> => {
    try {
      return await getApiAuthHeaders()
    } catch {
      throw new Error('User not authenticated')
    }
  }

  // Computed: Folder tree structure
  const folderTree = computed<FolderTreeItem[]>(() => {
    const buildTree = (parentId: string | null = null, depth: number = 0): FolderTreeItem[] => {
      return folders.value
        .filter(f => f.parent_id === parentId)
        .sort((a, b) => a.order_index - b.order_index)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id, depth + 1),
          depth,
          path: getFolderPath(folder.id),
          isExpanded: expandedFolders.value.has(folder.id),
          projectCount: 0, // Will be calculated separately
        }))
    }
    return buildTree()
  })

  // Get folder path (array of folder names)
  const getFolderPath = (folderId: string): string[] => {
    const path: string[] = []
    let current = folders.value.find(f => f.id === folderId)
    while (current) {
      path.unshift(current.name)
      current = folders.value.find(f => f.id === current?.parent_id)
    }
    return path
  }

  // Load all folders for current user
  const loadFolders = async (opts: LoadFoldersOptions = {}) => {
    isLoading.value = true
    try {
      const headers = await getApiAuthHeaders().catch(() => null)
      if (!headers) {
        folders.value = []
        return
      }
      const scope = opts.scope || 'all'
      const query = scope === 'all' ? undefined : { scope }
      const data = await $fetch('/api/folders', { headers, query })
      folders.value = Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error loading folders:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Create a new folder
  const createFolder = async (name: string, parentId: string | null = null, opts: CreateFolderOptions = {}) => {
    try {
      // Get max order_index for siblings
      const siblings = folders.value.filter(f => f.parent_id === parentId)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order_index)) : -1

      const iconFromScope = opts.scope ? SCOPE_ICON_MAP[opts.scope] : undefined
      const icon = String(opts.icon || iconFromScope || '').trim() || undefined

      const headers = await requireHeaders()
      const response = await $fetch<any>('/api/folders', {
        method: 'POST',
        headers,
        body: {
          name,
          parent_id: parentId,
          order_index: maxOrder + 1,
          icon,
        }
      })
      const data = response?.folder || null

      if (data) {
        // Add to array and trigger reactivity
        folders.value = [...folders.value, data]
        // Auto-expand parent if creating nested folder
        if (parentId) {
          expandedFolders.value.add(parentId)
        }
        return data
      }
    } catch (error) {
      console.error('Error creating folder:', error)
      throw error
    }
  }

  // Update folder
  const updateFolder = async (folderId: string, updates: Partial<Folder>) => {
    try {
      const headers = await requireHeaders()
      const response = await $fetch<any>('/api/folders', {
        method: 'PATCH',
        headers,
        body: { id: folderId, ...updates },
      })
      const updated = response?.folder || null

      // Update local state
      const index = folders.value.findIndex(f => f.id === folderId)
      if (index !== -1) {
        const current = folders.value[index]
        if (!current) return
        folders.value[index] = updated || {
          ...current,
          ...updates,
          id: current.id,
          name: updates.name ?? current.name,
          parent_id: updates.parent_id ?? current.parent_id,
          user_id: current.user_id,
          icon: updates.icon ?? current.icon,
          color: updates.color ?? current.color,
          order_index: updates.order_index ?? current.order_index,
          created_at: current.created_at,
          updated_at: updates.updated_at ?? current.updated_at,
        }
      }
    } catch (error) {
      console.error('Error updating folder:', error)
      throw error
    }
  }

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    try {
      const headers = await requireHeaders()
      await $fetch('/api/folders', {
        method: 'DELETE',
        headers,
        query: { id: folderId }
      })

      // Remove from local state (cascade removes children too)
      const removeFolderAndChildren = (id: string) => {
        const children = folders.value.filter(f => f.parent_id === id)
        children.forEach(c => removeFolderAndChildren(c.id))
        folders.value = folders.value.filter(f => f.id !== id)
      }
      removeFolderAndChildren(folderId)

      // Clear from expanded if present
      expandedFolders.value.delete(folderId)
      if (activeFolderId.value === folderId) {
        activeFolderId.value = null
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
      throw error
    }
  }

  // Move folder to new parent
  const moveFolder = async (folderId: string, newParentId: string | null) => {
    // Prevent moving to itself or its descendants
    const getDescendantIds = (id: string): string[] => {
      const descendants: string[] = []
      const children = folders.value.filter(f => f.parent_id === id)
      children.forEach(c => {
        descendants.push(c.id)
        descendants.push(...getDescendantIds(c.id))
      })
      return descendants
    }

    const descendants = getDescendantIds(folderId)
    if (newParentId && descendants.includes(newParentId)) {
      throw new Error('Cannot move folder into its own descendant')
    }

    try {
      // Get new order_index
      const siblings = folders.value.filter(f => f.parent_id === newParentId && f.id !== folderId)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order_index)) : -1

      await updateFolder(folderId, {
        parent_id: newParentId,
        order_index: maxOrder + 1,
      })
    } catch (error) {
      console.error('Error moving folder:', error)
      throw error
    }
  }

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    if (expandedFolders.value.has(folderId)) {
      expandedFolders.value.delete(folderId)
    } else {
      expandedFolders.value.add(folderId)
    }
  }

  // Set active folder
  const setActiveFolder = (folderId: string | null) => {
    activeFolderId.value = folderId
  }

  // Get folder by ID
  const getFolder = (folderId: string): Folder | undefined => {
    return folders.value.find(f => f.id === folderId)
  }

  // Get root folders (no parent)
  const rootFolders = computed(() => {
    return folders.value.filter(f => !f.parent_id).sort((a, b) => a.order_index - b.order_index)
  })

  // Get children of a folder
  const getChildren = (parentId: string): Folder[] => {
    return folders.value
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
  }

  // Check if folder has children
  const hasChildren = (folderId: string): boolean => {
    return folders.value.some(f => f.parent_id === folderId)
  }

  return {
    // State
    folders,
    folderTree,
    rootFolders,
    isLoading,
    activeFolderId,
    expandedFolders,

    // Methods
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    toggleFolder,
    setActiveFolder,
    getFolder,
    getChildren,
    hasChildren,
    getFolderPath,
  }
}
