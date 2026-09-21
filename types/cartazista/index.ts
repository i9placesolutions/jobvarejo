import type { ArtComposition } from '~/types/art-studio'

export const CARTAZISTA_MODEL_KEYS = [
  'gondola',
  'standard',
  'second-unit',
  'de-por-discount',
  'landscape',
  'de-por',
  'wholesale-retail',
  'club',
  'club-discount',
  'pocket',
  'pack',
  'leve-3-2',
  'leve-x-y',
  'leve-por-legacy'
] as const

export type CartazistaModelKey = (typeof CARTAZISTA_MODEL_KEYS)[number]

export type CartazistaCategory =
  | 'Preço'
  | 'Gôndola'
  | 'Desconto'
  | 'Clube'
  | 'Atacado'
  | 'Pack'
  | 'Leve e pague'

export type CartazistaFormatId = 'a1' | 'a2' | 'a3' | 'a5' | 'a6' | 'a7'

export type CartazistaFormat = {
  id: CartazistaFormatId
  label: string
  description: string
  width: number
  height: number
  sheetColumns: number
  sheetRows: number
}

export const CARTAZISTA_FORMATS: CartazistaFormat[] = [
  { id: 'a1', label: 'A1', description: 'Cartaz gigante de vitrine', width: 1684, height: 2384, sheetColumns: 1, sheetRows: 1 },
  { id: 'a2', label: 'A2', description: 'Cartaz grande de corredor', width: 1191, height: 1684, sheetColumns: 1, sheetRows: 1 },
  { id: 'a3', label: 'A3', description: 'Cartaz de gôndola e ponta', width: 842, height: 1191, sheetColumns: 1, sheetRows: 1 },
  { id: 'a5', label: 'A5', description: 'Cartaz pequeno', width: 420, height: 595, sheetColumns: 2, sheetRows: 2 },
  { id: 'a6', label: 'A6', description: 'Etiqueta e comunicação compacta', width: 298, height: 420, sheetColumns: 2, sheetRows: 4 },
  { id: 'a7', label: 'A7', description: 'Preço unitário de balcão', width: 210, height: 298, sheetColumns: 3, sheetRows: 4 }
]

export const CARTAZISTA_THEMES = [
  { id: 'classic-yellow', name: 'Amarelo clássico', background: '#fff7c7', accent: '#e63225', ink: '#161616', price: '#e63225', secondary: '#ffd928', highlight: '#fff0a1' },
  { id: 'red-impact', name: 'Vermelho impacto', background: '#fff3ef', accent: '#cf1d2e', ink: '#171717', price: '#cf1d2e', secondary: '#ffcf32', highlight: '#ffe2df' },
  { id: 'fresh-green', name: 'Verde fresco', background: '#eff8e9', accent: '#1e704d', ink: '#17342a', price: '#d83b2f', secondary: '#bde58d', highlight: '#dff3c4' },
  { id: 'blue-clean', name: 'Azul limpeza', background: '#edf6ff', accent: '#1969bd', ink: '#12365f', price: '#d62735', secondary: '#9dd7ff', highlight: '#d8edff' },
  { id: 'black-neon', name: 'Preto neon', background: '#1d1f23', accent: '#f4ff56', ink: '#ffffff', price: '#f4ff56', secondary: '#f03232', highlight: '#34383d' },
  { id: 'orange-bargain', name: 'Laranja oferta', background: '#fff1dd', accent: '#f05b23', ink: '#3b2417', price: '#d92920', secondary: '#ffc343', highlight: '#ffe0a5' }
] as const

export type CartazistaThemeId = (typeof CARTAZISTA_THEMES)[number]['id']

export type CartazistaProduct = {
  id: string
  name: string
  price: number
  oldPrice?: number
  secondPrice?: number
  wholesalePrice?: number
  packQuantity?: number
  packPrice?: number
  unit?: string
  nearExpiry?: boolean
}

export type CartazistaSettings = {
  validity: string
  limitPerCustomer: string
  highlightNearExpiry: boolean
  nearExpiryLabel: string
  showLogo: boolean
  orientation: 'portrait' | 'landscape'
}

export type CartazistaDocument = {
  version: 1
  name: string
  modelId: CartazistaModelKey
  formatId: CartazistaFormatId
  themeId: CartazistaThemeId
  settings: CartazistaSettings
  products: CartazistaProduct[]
  activeProductId: string
  composition: ArtComposition
}

export type CartazistaModel = {
  id: CartazistaModelKey
  name: string
  category: CartazistaCategory
  description: string
  tags: string[]
  example: string
}

export type CartazistaTemplateSummary = CartazistaModel & {
  published: boolean
  revision: number
}

export type CartazistaDesign = {
  id: string
  name: string
  state: CartazistaDocument
  revision: number
  updated_at?: string
  created_at?: string
}
