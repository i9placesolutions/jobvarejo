export interface Folder {
  id: string
  name: string
  parent_id: string | null
  user_id: string
  icon: string
  color: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface FolderTreeItem extends Folder {
  children: FolderTreeItem[]
  depth: number
  path: string[]
  isExpanded: boolean
  projectCount?: number
}
