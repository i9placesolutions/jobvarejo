// Presets do layout v2 do card de produto — 25 variacoes QROfertas Builder V2.
// Consumido por components/builder/BuilderFlyerProductCard.vue.
//
// Cada preset define grid-template-areas/rows/cols que o card v2 aplica
// via inline style. Badge sempre posicionado absoluto (fora do grid).
//
// layoutKind:
//   'grid'    → renderer generico aplica areas/rows/cols
//   'exotic'  → template Vue dedicado cuida do rendering (overlay,
//               diagonal, clip-path, imagem sangrando, etc.)

export type V2PresetCategory = 'vertical' | 'horizontal' | 'destaque' | 'compact' | 'special'
export type V2PresetLayoutKind = 'grid' | 'exotic'
export type V2SlotAlign = 'center' | 'left' | 'right'

export interface V2Preset {
  id: string
  name: string
  category: V2PresetCategory
  layoutKind: V2PresetLayoutKind
  // Grid descriptors (apenas para layoutKind='grid')
  areas?: string
  rows?: string
  cols?: string
  align?: { name?: V2SlotAlign; price?: V2SlotAlign }
  // Tuning por slot
  nameWeight?: number
  priceScale?: number
  nameScale?: number
  imageFit?: 'contain' | 'cover'
  // Padding do container em cqi
  padding?: string
}

// ════════════════════════════════════════════════════════════════════
// VERTICAL (8)
// ════════════════════════════════════════════════════════════════════
const VERTICAL: V2Preset[] = [
  {
    id: 'qro-vertical-classic',
    name: 'Vertical Classico',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"name" "image" "price"',
    rows: '15fr 55fr 30fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-price-top',
    name: 'Preco no Topo',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"price" "image" "name"',
    rows: '25fr 55fr 20fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    priceScale: 1.1,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-image-focus',
    name: 'Imagem Grande',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"image" "name" "price"',
    rows: '60fr 15fr 25fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 800,
    nameScale: 0.92,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-name-top',
    name: 'Nome no Topo',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"name" "image" "price"',
    rows: '24fr 50fr 26fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    nameScale: 1.15,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-centered',
    name: 'Centralizado',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"image" "name" "price"',
    rows: '55fr 15fr 30fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 800,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-shelf',
    name: 'Vertical Vitrine',
    category: 'vertical',
    layoutKind: 'exotic', // faixa de nome top + imagem + preco sobreposto
    nameWeight: 900,
    priceScale: 1.12,
  },
  {
    id: 'qro-vertical-bottom-image',
    name: 'Info em Cima',
    category: 'vertical',
    layoutKind: 'grid',
    areas: '"name" "price" "image"',
    rows: '18fr 22fr 60fr',
    cols: '1fr',
    align: { name: 'left', price: 'left' },
    nameWeight: 900,
    priceScale: 1.08,
    imageFit: 'contain',
  },
  {
    id: 'qro-vertical-price-band',
    name: 'Preco na Imagem',
    category: 'vertical',
    layoutKind: 'exotic', // faixa de preco sobreposto centro da imagem
    nameWeight: 900,
    priceScale: 1.2,
  },
]

// ════════════════════════════════════════════════════════════════════
// HORIZONTAL (7)
// ════════════════════════════════════════════════════════════════════
const HORIZONTAL: V2Preset[] = [
  {
    id: 'qro-horizontal-classic',
    name: 'Horizontal Classico',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"image name" "image price"',
    rows: '45fr 55fr',
    cols: '48fr 52fr',
    align: { name: 'left', price: 'left' },
    nameWeight: 900,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-reversed',
    name: 'Horizontal Invertido',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"name image" "price image"',
    rows: '45fr 55fr',
    cols: '52fr 48fr',
    align: { name: 'right', price: 'right' },
    nameWeight: 900,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-price-focus',
    name: 'Preco Destaque Horizontal',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"image name" "image price"',
    rows: '30fr 70fr',
    cols: '38fr 62fr',
    align: { name: 'left', price: 'left' },
    nameWeight: 900,
    priceScale: 1.25,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-banner',
    name: 'Banner Horizontal',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"image name price"',
    rows: '1fr',
    cols: '32fr 36fr 32fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-center-showcase',
    name: 'Vitrine Central',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"image name price"',
    rows: '1fr',
    cols: '34fr 34fr 32fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    priceScale: 1.12,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-price-column',
    name: 'Preco em Coluna',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"price image name"',
    rows: '1fr',
    cols: '28fr 32fr 40fr',
    align: { name: 'left', price: 'center' },
    nameWeight: 900,
    priceScale: 1.24,
    imageFit: 'contain',
  },
  {
    id: 'qro-horizontal-shelf',
    name: 'Prateleira',
    category: 'horizontal',
    layoutKind: 'grid',
    areas: '"image name price"',
    rows: '1fr',
    cols: '28fr 42fr 30fr',
    align: { name: 'left', price: 'center' },
    nameWeight: 900,
    priceScale: 1.1,
    imageFit: 'contain',
  },
]

// ════════════════════════════════════════════════════════════════════
// DESTAQUE (4) — para produtos isHighlight
// ════════════════════════════════════════════════════════════════════
const DESTAQUE: V2Preset[] = [
  {
    id: 'qro-destaque-grande',
    name: 'Destaque Grande',
    category: 'destaque',
    layoutKind: 'grid',
    areas: '"image" "name" "price"',
    rows: '60fr 15fr 25fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    priceScale: 1.2,
    imageFit: 'contain',
    padding: '3cqi',
  },
  {
    id: 'qro-destaque-split',
    name: 'Destaque Dividido',
    category: 'destaque',
    layoutKind: 'grid',
    areas: '"image name" "image price"',
    rows: '45fr 55fr',
    cols: '50fr 50fr',
    align: { name: 'left', price: 'left' },
    nameWeight: 900,
    priceScale: 1.15,
    imageFit: 'contain',
  },
  {
    id: 'qro-destaque-overlay',
    name: 'Destaque Hero',
    category: 'destaque',
    layoutKind: 'exotic', // imagem dominante, etiqueta sobreposta bottom-right
    nameWeight: 900,
    priceScale: 1.35,
  },
  {
    id: 'qro-destaque-price-column',
    name: 'Destaque Colunas',
    category: 'destaque',
    layoutKind: 'grid',
    areas: '"price image name"',
    rows: '1fr',
    cols: '30fr 30fr 40fr',
    align: { name: 'left', price: 'center' },
    nameWeight: 900,
    priceScale: 1.32,
    imageFit: 'contain',
  },
]

// ════════════════════════════════════════════════════════════════════
// COMPACT (3) — listas densas 10-20 produtos
// ════════════════════════════════════════════════════════════════════
const COMPACT: V2Preset[] = [
  {
    id: 'qro-compact-mini',
    name: 'Compacto Mini',
    category: 'compact',
    layoutKind: 'grid',
    areas: '"image name" "image price"',
    rows: '45fr 55fr',
    cols: '32fr 68fr',
    align: { name: 'left', price: 'left' },
    nameWeight: 800,
    nameScale: 0.86,
    imageFit: 'contain',
    padding: '1.5cqi',
  },
  {
    id: 'qro-compact-text',
    name: 'Compacto Texto',
    category: 'compact',
    layoutKind: 'grid',
    areas: '"name" "price"',
    rows: '45fr 55fr',
    cols: '1fr',
    align: { name: 'center', price: 'center' },
    nameWeight: 900,
    nameScale: 1.1,
    imageFit: 'contain',
    padding: '2cqi',
  },
  {
    id: 'qro-compact-side-price',
    name: 'Compacto Lateral',
    category: 'compact',
    layoutKind: 'grid',
    areas: '"image name price"',
    rows: '1fr',
    cols: '24fr 48fr 28fr',
    align: { name: 'left', price: 'center' },
    nameWeight: 800,
    nameScale: 0.94,
    imageFit: 'contain',
    padding: '1.5cqi',
  },
]

// ════════════════════════════════════════════════════════════════════
// SPECIAL (3) — efeitos visuais, todos exoticos
// ════════════════════════════════════════════════════════════════════
const SPECIAL: V2Preset[] = [
  {
    id: 'qro-special-overlay',
    name: 'Overlay',
    category: 'special',
    layoutKind: 'exotic', // imagem fullbleed, nome+preco sobrepostos base
    nameWeight: 900,
  },
  {
    id: 'qro-special-diagonal',
    name: 'Diagonal',
    category: 'special',
    layoutKind: 'exotic', // corte diagonal via clip-path
    nameWeight: 900,
  },
  {
    id: 'qro-special-price-stamp',
    name: 'Selo de Preco',
    category: 'special',
    layoutKind: 'exotic', // etiqueta como selo circular sobre imagem
    nameWeight: 900,
    priceScale: 1.28,
  },
]

export const V2_PRESETS_LIST: V2Preset[] = [
  ...VERTICAL,
  ...HORIZONTAL,
  ...DESTAQUE,
  ...COMPACT,
  ...SPECIAL,
]

export const V2_PRESETS: Record<string, V2Preset> = Object.fromEntries(
  V2_PRESETS_LIST.map(p => [p.id, p]),
)

export const V2_DEFAULT_PRESET_ID = 'qro-vertical-classic'
export const V2_DEFAULT_DESTAQUE_PRESET_ID = 'qro-destaque-grande'

export function getV2Preset(id: string | null | undefined, isHighlight = false): V2Preset {
  if (id && V2_PRESETS[id]) return V2_PRESETS[id]!
  return V2_PRESETS[isHighlight ? V2_DEFAULT_DESTAQUE_PRESET_ID : V2_DEFAULT_PRESET_ID]!
}
