/**
 * Product Zone Types
 * Ported from legacy system - Full feature parity
 */

// === PRODUCT IMAGE ===
export interface ProductImage {
  id: string;
  src: string;
  x: number; // offset dentro do container da imagem
  y: number;
  scale: number;
  rotation?: number;
  imgWidth?: number; // dimensão natural ou fixada
  imgHeight?: number;
  // Crop em porcentagem (0-100)
  imgCropTop?: number;
  imgCropRight?: number;
  imgCropBottom?: number;
  imgCropLeft?: number;
  // Efeitos
  imgEffect?: 'none' | 'grayscale' | 'sepia' | 'brightness' | 'contrast' | 'blur';
  effectIntensity?: number;
}

// === PRODUCT ===
export interface Product {
  id: string | number;
  name: string;
  images: ProductImage[];
  emoji?: string;
  // Posição no canvas (calculada pelo grid ou free mode)
  x: number;
  y: number;
  width: number;
  height: number;
  // ===== PREÇO PRINCIPAL =====
  price: number | string;
  unit?: string; // 'kg', 'un', 'pct', 'lt', etc.
  showPrice?: boolean;
  priceMode?: 'retail' | 'wholesale' | 'pack';
  // ===== NOVOS CAMPOS DE PREÇO =====
  // Preço da embalagem/caixa (PREÇO CX. AVULSA, PREÇO FARDO)
  pricePack?: number | string;
  // Preço unitário (PREÇO UND. AVULSA)
  priceUnit?: number | string;
  // Preço especial/promocional da embalagem (PREÇO ESPECIAL, PREÇO ACIMA X EMBA.)
  priceSpecial?: number | string;
  // Preço unitário especial/promocional (PREÇO ESPECIAL UN., PREÇO UND. ACIMA X EMB)
  priceSpecialUnit?: number | string;
  // Condição para preço especial (OBSERVAÇÕES: "ACIMA DE 36 UN.", "ACIMA DE 5 FARDOS")
  specialCondition?: string;
  // ===== METADATA DE EMBALAGEM =====
  // Quantidade por embalagem (do campo "QUANT. EMBA" ou padrão "C/12UN")
  packQuantity?: number;
  // Unidade da embalagem ("UN", "CX", "FD", etc.)
  packUnit?: string;
  // Etiqueta da embalagem ("FD", "CX", "PCT", "UNIDADE", "FARDO")
  packageLabel?: string;
  // ===== WHOLESALE/ATACADO (legado) =====
  priceWholesale?: number | string;
  wholesaleTrigger?: number;
  wholesaleTriggerUnit?: string;
  // ===== FREE MODE (ignora grid) =====
  isFreeMode?: boolean;
  freeX?: number;
  freeY?: number;
  freeWidth?: number;
  freeHeight?: number;
  // Posição no grid
  colIndex?: number;
  rowIndex?: number;
  // Styling do card
  backgroundColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  type?: 'yellow' | 'red' | 'green' | 'blue' | 'none';
  // Nome/Label positioning
  nameX?: number;
  nameY?: number;
  nameScale?: number;
  nameColor?: string;
  nameFont?: string;
  // Limite (badge)
  limitText?: string;
  limitX?: number;
  limitY?: number;
  limitColor?: string;
  // Extras
  brand?: string;
  weight?: string;
  flavor?: string;
  // Z-index
  zIndex?: number;
  // Referência ao splash
  splashId?: string;
  // Status de processamento
  status?: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  // Dados brutos da origem
  raw?: any;
}

// === SPLASH (Etiqueta de Preço) ===
export interface Splash {
  id: string;
  parentId: string | number; // product.id
  // Preço formatado
  price?: string;
  unit?: string;
  // Posição relativa ao produto (offset do centro)
  x: number; // horizontal offset
  y: number; // vertical offset (positive = up)
  // Transform
  scale?: number;
  rotation?: number;
  // Estilo visual
  style?: 'classic' | 'bubble' | 'star' | 'explosion' | 'ribbon' | 'circle' | 'modern';
  // Cores
  color?: string; // background
  textColor?: string;
  accentColor?: string; // para bordas/efeitos
  // Efeitos de texto
  textEffect?: 'none' | 'stroke' | 'shadow' | 'glow';
  effectColor?: string;
  effectThickness?: number;
  // Fonte
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  // Layout interno (posição do R$, centavos, etc)
  currencyPosition?: 'left' | 'top-left' | 'integrated';
  decimalSize?: number; // % do tamanho principal
  // Visibilidade
  visible?: boolean;
}

// === PRODUCT ZONE (Container) ===
export interface ProductZone {
  id?: string;
  enabled?: boolean; // Whether the zone is active/visible
  // Bounds
  x: number;
  y: number;
  width: number;
  height: number;
  // Espaçamento
  padding: number;
  gapHorizontal?: number;
  gapVertical?: number;
  // Grid
  columns?: number; // 0 = auto
  rows?: number; // 0 = auto
  layoutDirection?: 'horizontal' | 'vertical'; // preenchimento
  // Aspect ratio dos cards
  cardAspectRatio?: 'auto' | 'square' | '3:4' | '4:3' | '16:9' | '9:16' | 'fill';
  // Comportamento da última linha
  lastRowBehavior?: 'fill' | 'center' | 'stretch' | 'left';
  // Alinhamento vertical
  verticalAlign?: 'top' | 'center' | 'bottom' | 'stretch';
  // Highlights (destaque de produtos)
  highlightCount?: number;
  highlightPos?: 'first' | 'last' | 'random';
  highlightHeight?: number; // multiplicador (1.5 = 50% mais alto)
  highlightStyle?: 'larger' | 'featured' | 'banner';
  // Lock
  isLocked?: boolean;
  // Visual
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  showBorder?: boolean;
  // Splash offset global
  splashOffsetY?: number;
  splashOffsetByCol?: number[];
  splashOffsetByRow?: number[];
}

// === GLOBAL STYLES ===
export interface GlobalStyles {
  // Card defaults
  cardColor?: string;
  cardBorderRadius?: number;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  isProdBgTransparent?: boolean;
  // Accent
  accentColor?: string;
  secondaryColor?: string;
  // Nome do produto
  prodNameFont?: string;
  prodNameColor?: string;
  prodNameSize?: number;
  // Multiplier over the responsive default size (Fabric-based editor).
  prodNameScale?: number;
  prodNameWeight?: number;
  prodNameAlign?: 'left' | 'center' | 'right';
  prodNameLineHeight?: number;
  prodNameTransform?: 'none' | 'upper' | 'lower';
  // Limite
  limitFont?: string;
  limitColor?: string;
  limitSize?: number;
  limitBgColor?: string;
  // Splash
  splashStyle?: Splash['style'];
  splashColor?: string;
  splashSpecialColor?: string;
  splashTextColor?: string;
  // When set, uses a custom label template instead of the built-in splash style.
  splashTemplateId?: string;
  splashOffsetY?: number;
  splashScale?: number;
  // Label (price tag) advanced styling (zone-level overrides; does not mutate templates)
  splashFill?: string;
  splashStrokeWidth?: number;
  splashRoundness?: number; // 0..1 (1 = pill)
  splashTextScale?: number;
  // Price
  priceFont?: string;
  priceFontSize?: number;
  priceFontWeight?: number | string;
  priceTextColor?: string;
  priceCurrencyColor?: string;
  currencySymbol?: string;
  // Tema
  theme?: 'light' | 'dark' | 'vibrant' | 'minimal';
}

// === LAYOUT PRESET ===
export type LayoutPresetCategory = 'grid' | 'special';

export interface LayoutPreset {
  id: string;
  name: string;
  icon?: string;
  category?: LayoutPresetCategory;
  columns?: number;
  rows?: number;
  layoutDirection?: 'horizontal' | 'vertical';
  cardAspectRatio?: ProductZone['cardAspectRatio'];
  lastRowBehavior?: ProductZone['lastRowBehavior'];
  verticalAlign?: ProductZone['verticalAlign'];
  padding?: number;
  gapHorizontal?: number;
  gapVertical?: number;
  description?: string;
  // Highlight settings for special presets
  highlightCount?: number;
  highlightPos?: 'first' | 'last' | 'random';
  highlightHeight?: number;
  // UI preview metadata (mini thumbnail in ProductZoneSettings)
  previewKind?: 'grid' | 'hero' | 'sidebar';
  previewCols?: number;
  previewRows?: number;
  previewCount?: number;
}

// === PRESET DEFINITIONS ===
// Simplified: grid presets (auto + column count) + special layouts (highlight)
export const LAYOUT_PRESETS: LayoutPreset[] = [
  // ==================== GRID ====================
  {
    id: 'auto',
    name: 'Automático',
    icon: 'wand',
    category: 'grid',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 15,
    gapHorizontal: 15,
    gapVertical: 15,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 3,
    previewRows: 3,
    description: 'Calcula automaticamente a melhor distribuição'
  },
  {
    id: 'cols-1',
    name: '1 Coluna',
    icon: 'rows',
    category: 'grid',
    columns: 1,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 16,
    gapHorizontal: 14,
    gapVertical: 14,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 1,
    previewRows: 4,
    description: 'Lista vertical com 1 produto por linha'
  },
  {
    id: 'cols-2',
    name: '2 Colunas',
    icon: 'grid-2x2',
    category: 'grid',
    columns: 2,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 15,
    gapHorizontal: 14,
    gapVertical: 14,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 2,
    previewRows: 3,
    description: '2 produtos por linha'
  },
  {
    id: 'cols-3',
    name: '3 Colunas',
    icon: 'grid-3x3',
    category: 'grid',
    columns: 3,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 14,
    gapHorizontal: 12,
    gapVertical: 12,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 3,
    previewRows: 3,
    description: '3 produtos por linha'
  },
  {
    id: 'cols-4',
    name: '4 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 4,
    previewRows: 3,
    description: '4 produtos por linha'
  },
  {
    id: 'cols-5',
    name: '5 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 5,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 10,
    gapHorizontal: 8,
    gapVertical: 8,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 5,
    previewRows: 2,
    description: '5 produtos por linha'
  },
  {
    id: 'cols-6',
    name: '6 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 6,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 8,
    gapHorizontal: 6,
    gapVertical: 6,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 6,
    previewRows: 2,
    description: '6 produtos por linha'
  },
  {
    id: 'cols-7',
    name: '7 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 7,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 7,
    gapHorizontal: 5,
    gapVertical: 5,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 7,
    previewRows: 2,
    description: '7 produtos por linha (alta densidade)'
  },
  {
    id: 'cols-8',
    name: '8 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 8,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 6,
    gapHorizontal: 4,
    gapVertical: 4,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 8,
    previewRows: 2,
    description: '8 produtos por linha (máxima densidade)'
  },
  {
    id: 'grid-2x3',
    name: 'Grid 2×3',
    icon: 'grid-2x2',
    category: 'grid',
    columns: 2,
    rows: 3,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 14,
    gapHorizontal: 12,
    gapVertical: 12,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 2,
    previewRows: 3,
    description: 'Tabloide 2×3 (ajuste automático quando necessário)'
  },
  {
    id: 'grid-3x4',
    name: 'Grid 3×4',
    icon: 'grid-3x3',
    category: 'grid',
    columns: 3,
    rows: 4,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 3,
    previewRows: 4,
    description: 'Encarte 3×4 para maior densidade'
  },
  {
    id: 'grid-4x4',
    name: 'Grid 4×4',
    icon: 'layout-grid',
    category: 'grid',
    columns: 4,
    rows: 4,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 10,
    gapHorizontal: 8,
    gapVertical: 8,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 4,
    previewRows: 4,
    description: 'Volume alto com 16 slots-base'
  },
  {
    id: 'grid-5x2',
    name: 'Grid 5×2',
    icon: 'layout-grid',
    category: 'grid',
    columns: 5,
    rows: 2,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 9,
    gapHorizontal: 7,
    gapVertical: 7,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 5,
    previewRows: 2,
    description: 'Faixa horizontal com alta largura'
  },
  {
    id: 'grid-2x4',
    name: 'Grid 2×4',
    icon: 'grid-2x2',
    category: 'grid',
    columns: 2,
    rows: 4,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 2,
    previewRows: 4,
    description: 'Grade alta 2×4 para listas longas'
  },
  {
    id: 'grid-3x2',
    name: 'Grid 3×2',
    icon: 'grid-3x3',
    category: 'grid',
    columns: 3,
    rows: 2,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 13,
    gapHorizontal: 11,
    gapVertical: 11,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 3,
    previewRows: 2,
    description: 'Grade compacta 3×2 para vitrine rápida'
  },
  {
    id: 'grid-4x3',
    name: 'Grid 4×3',
    icon: 'layout-grid',
    category: 'grid',
    columns: 4,
    rows: 3,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 10,
    gapHorizontal: 8,
    gapVertical: 8,
    highlightCount: 0,
    previewKind: 'grid',
    previewCols: 4,
    previewRows: 3,
    description: 'Encarte clássico 4×3 (12 slots-base)'
  },

  // ==================== ESPECIAIS ====================
  {
    id: 'featured',
    name: 'Destaque',
    icon: 'star',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 14,
    gapHorizontal: 12,
    gapVertical: 12,
    highlightCount: 1,
    highlightPos: 'first',
    highlightHeight: 1.5,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Primeiro produto maior (1.5x)'
  },
  {
    id: 'featured-2',
    name: 'Destaque x2',
    icon: 'star',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 14,
    gapHorizontal: 12,
    gapVertical: 12,
    highlightCount: 2,
    highlightPos: 'first',
    highlightHeight: 1.5,
    previewKind: 'sidebar',
    previewCols: 4,
    previewRows: 4,
    description: 'Dois primeiros produtos maiores (1.5x)'
  },
  {
    id: 'featured-3',
    name: 'Destaque x3',
    icon: 'star',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 13,
    gapHorizontal: 11,
    gapVertical: 11,
    highlightCount: 3,
    highlightPos: 'first',
    highlightHeight: 1.6,
    previewKind: 'sidebar',
    previewCols: 4,
    previewRows: 4,
    description: 'Três primeiros produtos destacados (1.6x)'
  },
  {
    id: 'featured-4',
    name: 'Destaque x4',
    icon: 'star',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 13,
    gapHorizontal: 11,
    gapVertical: 11,
    highlightCount: 4,
    highlightPos: 'first',
    highlightHeight: 1.45,
    previewKind: 'sidebar',
    previewCols: 4,
    previewRows: 4,
    description: 'Quatro primeiros produtos em destaque'
  },
  {
    id: 'showcase',
    name: 'Vitrine',
    icon: 'sparkles',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 1,
    highlightPos: 'first',
    highlightHeight: 2,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Primeiro produto bem grande (2x)'
  },
  {
    id: 'showcase-right',
    name: 'Vitrine Dir.',
    icon: 'sparkles',
    category: 'special',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 1,
    highlightPos: 'last',
    highlightHeight: 2,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Último produto bem grande (2x)'
  },
  {
    id: 'hero-left',
    name: 'Hero Esquerda',
    icon: 'sparkles',
    category: 'special',
    columns: 3,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 1,
    highlightPos: 'first',
    highlightHeight: 2.4,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Bloco principal grande à esquerda'
  },
  {
    id: 'hero-right',
    name: 'Hero Direita',
    icon: 'sparkles',
    category: 'special',
    columns: 3,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 12,
    gapHorizontal: 10,
    gapVertical: 10,
    highlightCount: 1,
    highlightPos: 'last',
    highlightHeight: 2.4,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Bloco principal grande à direita'
  },
  {
    id: 'hero-duo-left',
    name: 'Hero Duplo Esq.',
    icon: 'sparkles',
    category: 'special',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 11,
    gapHorizontal: 9,
    gapVertical: 9,
    highlightCount: 2,
    highlightPos: 'first',
    highlightHeight: 2.1,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Dois cards hero no lado esquerdo'
  },
  {
    id: 'hero-duo-right',
    name: 'Hero Duplo Dir.',
    icon: 'sparkles',
    category: 'special',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 11,
    gapHorizontal: 9,
    gapVertical: 9,
    highlightCount: 2,
    highlightPos: 'last',
    highlightHeight: 2.1,
    previewKind: 'hero',
    previewCols: 4,
    previewRows: 4,
    description: 'Dois cards hero no lado direito'
  },
  {
    id: 'sidebar-left',
    name: 'Coluna Esq.',
    icon: 'star',
    category: 'special',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 11,
    gapHorizontal: 9,
    gapVertical: 9,
    highlightCount: 3,
    highlightPos: 'first',
    highlightHeight: 1.9,
    previewKind: 'sidebar',
    previewCols: 4,
    previewRows: 4,
    description: 'Coluna lateral de destaque à esquerda'
  },
  {
    id: 'sidebar-right',
    name: 'Coluna Dir.',
    icon: 'star',
    category: 'special',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'fill',
    lastRowBehavior: 'fill',
    padding: 11,
    gapHorizontal: 9,
    gapVertical: 9,
    highlightCount: 3,
    highlightPos: 'last',
    highlightHeight: 1.9,
    previewKind: 'sidebar',
    previewCols: 4,
    previewRows: 4,
    description: 'Coluna lateral de destaque à direita'
  }
];

// === SPLASH STYLE DEFINITIONS ===
export const SPLASH_STYLES = [
  { id: 'classic', name: 'Clássico', description: 'Elipse tradicional de varejo' },
  { id: 'bubble', name: 'Bolha', description: 'Círculo com bordas suaves' },
  { id: 'star', name: 'Estrela', description: 'Formato de estrela explosiva' },
  { id: 'explosion', name: 'Explosão', description: 'Bordas irregulares de impacto' },
  { id: 'ribbon', name: 'Faixa', description: 'Faixa diagonal ou horizontal' },
  { id: 'circle', name: 'Círculo', description: 'Círculo perfeito' },
  { id: 'modern', name: 'Moderno', description: 'Retângulo arredondado minimalista' }
] as const;

// === HELPER TYPES ===
export type ProductZoneState = {
  products: Product[];
  splashes: Splash[];
  zone: ProductZone;
  globalStyles: GlobalStyles;
  selectedId: string | number | null;
  selectedType: 'product' | 'splash' | 'zone' | 'product-img' | 'product-name' | null;
  selectedSubId?: string; // para imagens
};

// === DEFAULT VALUES ===
export const DEFAULT_PRODUCT_ZONE: ProductZone = {
  enabled: false, // Disabled by default - user must explicitly enable
  x: 50,
  y: 150,
  width: 900,
  height: 600,
  padding: 15,
  gapHorizontal: 15,
  gapVertical: 15,
  columns: 0,
  rows: 0,
  layoutDirection: 'horizontal',
  cardAspectRatio: 'fill',
  lastRowBehavior: 'fill',
  verticalAlign: 'stretch',
  highlightCount: 0,
  isLocked: false,
  showBorder: true,
  borderColor: '#404040',
  borderWidth: 2,
  borderRadius: 16,
  splashOffsetY: 0
};

export const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  cardColor: '#ffffff',
  cardBorderRadius: 8,
  cardBorderColor: '#000000',
  cardBorderWidth: 0,
  isProdBgTransparent: false,
  accentColor: '#dc2626',
  prodNameFont: 'Inter',
  prodNameColor: '#000000',
  prodNameSize: 24,
  prodNameScale: 1,
  prodNameWeight: 700,
  prodNameAlign: 'center',
  prodNameLineHeight: 1.05,
  prodNameTransform: 'upper',
  limitColor: '#ef4444',
  limitSize: 14,
  splashStyle: 'classic',
  splashColor: '#dc2626',
  splashTextColor: '#ffffff',
  splashTemplateId: undefined,
  splashScale: 1,
  splashFill: '#000000',
  splashStrokeWidth: undefined,
  splashRoundness: 1,
  splashTextScale: 1,
  priceFont: 'Arial',
  priceFontSize: 60,
  priceFontWeight: undefined,
  priceTextColor: undefined,
  // Keep undefined by default to preserve the template's own currency color (ex: black on yellow circle).
  // Users can override per design/zone via Product Zone settings.
  priceCurrencyColor: undefined,
  currencySymbol: 'R$',
  theme: 'vibrant'
};

export const DEFAULT_SPLASH: Partial<Splash> = {
  x: 0,
  y: -10,
  scale: 1,
  rotation: -5,
  style: 'classic',
  color: '#dc2626',
  textColor: '#ffffff',
  textEffect: 'shadow',
  effectColor: 'rgba(0,0,0,0.3)',
  effectThickness: 2,
  fontFamily: 'Arial',
  fontSize: 60,
  fontWeight: 700,
  currencyPosition: 'left',
  decimalSize: 50,
  visible: true
};
