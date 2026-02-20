export type ProjectPageType = 'RETAIL_OFFER' | 'FREE_DESIGN'

export interface FabricCanvasJson {
  [key: string]: any
}

export interface ProjectCanvasPageMeta {
  id: string
  name: string
  width: number
  height: number
  type: ProjectPageType
  canvasDataPath?: string | null
  thumbnailUrl?: string | null
  canvasData?: FabricCanvasJson | null
}

// Row shape from public.projects
export interface ProjectRow {
  id: string
  name: string
  canvas_data: ProjectCanvasPageMeta[]
  preview_url: string | null
  created_at: string
  folder_id: string | null
  user_id: string | null
  last_viewed: string | null
  is_shared: boolean | null
  shared_with: string[] | null
  is_starred: boolean | null
  updated_at: string | null
}

export interface ProjectListRow {
  id: string
  name: string
  created_at: string
  updated_at: string | null
  preview_url: string | null
}

