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
  'leve-por-legacy',
  'leve-pague',
  'banner-2m'
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

export type CartazistaFormatId = 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'banner-2m'

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
  { id: 'a4', label: 'A4', description: '1 cartaz por folha A4', width: 595, height: 842, sheetColumns: 1, sheetRows: 1 },
  { id: 'a5', label: 'A5', description: '2 cartazes por folha A4', width: 420, height: 595, sheetColumns: 1, sheetRows: 2 },
  { id: 'a6', label: 'A6', description: '4 cartazes por folha A4', width: 298, height: 420, sheetColumns: 2, sheetRows: 2 },
  { id: 'a7', label: 'A7', description: '8 cartazes por folha A4', width: 210, height: 298, sheetColumns: 2, sheetRows: 4 },
  { id: 'banner-2m', label: 'Faixa 200 × 62 cm', description: 'Faixa horizontal de dois metros', width: 2000, height: 620, sheetColumns: 1, sheetRows: 1 }
]

export const CARTAZISTA_THEMES = [
  { id: 'classic-yellow', name: 'Amarelo clássico', background: '#ffffff', accent: '#ed241c', ink: '#080808', price: '#ed241c', secondary: '#fff82b', highlight: '#fff82b' },
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
  payQuantity?: number
  copies?: number
  unit?: string
  nearExpiry?: boolean
}

export type CartazistaSettings = {
  freeDesign?: boolean
  title?: string
  showCurrency?: boolean
  showEach?: boolean
  foldGuide?: boolean
  removeBackground?: boolean
  header?: CartazistaHeader
  validity: string
  limitPerCustomer: string
  highlightNearExpiry: boolean
  nearExpiryLabel: string
  showLogo: boolean
  orientation: 'portrait' | 'landscape'
}

export type CartazistaHeader = {
  id: string
  name: string
  background: string
  seal: string
  color: string
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
