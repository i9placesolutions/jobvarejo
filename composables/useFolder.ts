import { ref, computed } from 'vue'
import type { Folder } from '~/types/folder'

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

export const useFolder = () => {
  const supabase = useSupabase()
  const auth = useAuth()

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
  const loadFolders = async () => {
    if (!auth.user.value) return

    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', auth.user.value.id)
        .order('order_index', { ascending: true })

      if (error) throw error
      folders.value = data || []
    } catch (error) {
      console.error('Error loading folders:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Create a new folder
  const createFolder = async (name: string, parentId: string | null = null) => {
    if (!auth.user.value) throw new Error('User not authenticated')

    try {
      // Get max order_index for siblings
      const siblings = folders.value.filter(f => f.parent_id === parentId)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order_index)) : -1

      const { data, error } = await supabase
        .from('folders')
        .insert({
          name,
          parent_id: parentId,
          user_id: auth.user.value.id,
          order_index: maxOrder + 1,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        folders.value.push(data)
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
      const { error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', folderId)

      if (error) throw error

      // Update local state
      const index = folders.value.findIndex(f => f.id === folderId)
      if (index !== -1) {
        folders.value[index] = { ...folders.value[index], ...updates }
      }
    } catch (error) {
      console.error('Error updating folder:', error)
      throw error
    }
  }

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) throw error

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
