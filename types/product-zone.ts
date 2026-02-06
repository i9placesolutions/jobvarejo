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
export type LayoutPresetCategory = 'basic' | 'grid' | 'vertical' | 'horizontal' | 'special';

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
  description?: string;
  // Optional extra settings for special presets
  highlightCount?: number;
  highlightPos?: 'first' | 'last' | 'random';
  highlightHeight?: number;
  highlightStyle?: 'larger' | 'featured' | 'banner';
}

// === PRESET DEFINITIONS ===
export const LAYOUT_PRESETS: LayoutPreset[] = [
  // ==================== BÁSICOS ====================
  {
    id: 'auto',
    name: 'Automático',
    icon: 'wand',
    category: 'basic',
    columns: 0,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'auto',
    lastRowBehavior: 'fill',
    description: 'Calcula automaticamente baseado no espaço disponível'
  },
  {
    id: 'grid-2',
    name: '2 Colunas',
    icon: 'grid-2x2',
    category: 'basic',
    columns: 2,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: '3:4',
    lastRowBehavior: 'fill',
    description: 'Grid com 2 colunas fixas'
  },
  {
    id: 'grid-3',
    name: '3 Colunas',
    icon: 'grid-3x3',
    category: 'basic',
    columns: 3,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: '3:4',
    lastRowBehavior: 'fill',
    description: 'Grid com 3 colunas fixas'
  },

  // ==================== GRIDS ====================
  {
    id: 'grid-4',
    name: '4 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 4,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'square',
    lastRowBehavior: 'fill',
    description: 'Grid denso com 4 colunas'
  },
  {
    id: 'grid-5',
    name: '5 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 5,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'square',
    lastRowBehavior: 'fill',
    description: 'Grid muito denso com 5 colunas'
  },
  {
    id: 'grid-6',
    name: '6 Colunas',
    icon: 'layout-grid',
    category: 'grid',
    columns: 6,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'square',
    lastRowBehavior: 'fill',
    description: 'Máxima densidade com 6 colunas'
  },

  // ==================== VERTICAIS ====================
  {
    id: 'list',
    name: 'Lista',
    icon: 'list',
    category: 'vertical',
    columns: 1,
    rows: 0,
    layoutDirection: 'vertical',
    cardAspectRatio: '16:9',
    lastRowBehavior: 'stretch',
    description: 'Lista vertical com cards largos'
  },
  {
    id: 'sidebar',
    name: 'Barra Lateral',
    icon: 'sidebar',
    category: 'vertical',
    columns: 1,
    rows: 0,
    layoutDirection: 'vertical',
    cardAspectRatio: '9:16',
    lastRowBehavior: 'fill',
    description: 'Coluna vertical estreita'
  },
  {
    id: 'cards',
    name: 'Cartões',
    icon: 'credit-card',
    category: 'vertical',
    columns: 2,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: 'square',
    lastRowBehavior: 'fill',
    description: 'Cartões quadrados organizados'
  },

  // ==================== HORIZONTAIS ====================
  {
    id: 'horizontal',
    name: 'Horizontal',
    icon: 'arrow-right',
    category: 'horizontal',
    columns: 0,
    rows: 1,
    layoutDirection: 'horizontal',
    cardAspectRatio: '16:9',
    lastRowBehavior: 'stretch',
    description: 'Linha única de produtos'
  },
  {
    id: 'magazine',
    name: 'Revista',
    icon: 'book-open',
    category: 'horizontal',
    columns: 2,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: '4:3',
    lastRowBehavior: 'fill',
    description: 'Estilo revista/catálogo'
  },

  // ==================== ESPECIAIS ====================
  {
    id: 'featured',
    name: 'Destaque',
    icon: 'star',
    category: 'special',
    columns: 2,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: '3:4',
    lastRowBehavior: 'center',
    highlightCount: 1,
    highlightPos: 'first',
    highlightHeight: 1.5,
    description: '1 produto em destaque + grid'
  },
  {
    id: 'showcase',
    name: 'Vitrine',
    icon: 'sparkles',
    category: 'special',
    columns: 3,
    rows: 0,
    layoutDirection: 'horizontal',
    cardAspectRatio: '3:4',
    lastRowBehavior: 'fill',
    highlightCount: 1,
    highlightPos: 'first',
    highlightHeight: 2,
    description: 'Produto grande em destaque'
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
  cardAspectRatio: 'auto',
  lastRowBehavior: 'center',
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
