// Tipos para o modulo de integracao com Canva

export interface CanvaDesign {
  id: string
  title: string
  thumbnail: {
    width: number
    height: number
    url: string
  }
  urls: {
    edit_url: string
    view_url: string
  }
  created_at: number
  updated_at: number
  page_count: number
}

export interface CanvaDesignSlot {
  element_id: string
  type: 'text' | 'image'
  page_index: number
  page_id: string
  content?: string
  asset_id?: string
}

export interface CanvaProductMapping {
  slot_index: number
  element_id: string
  type: 'name' | 'price' | 'unit' | 'image'
  page_index: number
  page_id: string
  product?: CanvaMappedProduct
}

export interface CanvaMappedProduct {
  name: string
  offer_price: number | null
  original_price?: number | null
  unit?: string
  image?: string | null
  image_wasabi_key?: string | null
}

export interface CanvaTransaction {
  transaction_id: string
  design_id: string
  pages: CanvaTransactionPage[]
}

export interface CanvaTransactionPage {
  index: number
  id: string
  elements: CanvaTransactionElement[]
  thumbnail?: string
}

export interface CanvaTransactionElement {
  id: string
  type: 'richtext' | 'image' | 'video' | 'shape' | 'group'
  text?: string
  asset_id?: string
  dimensions?: {
    width: number
    height: number
    top: number
    left: number
  }
}

export interface CanvaApplyResult {
  success: boolean
  design_id: string
  pages_updated: number
  products_applied: number
  errors: string[]
}
