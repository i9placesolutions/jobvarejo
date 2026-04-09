// QROfertas-matching card template presets
// These templates define different layout variations for product cards
import type { CardTemplateElement, CardTemplateStyle, BuilderCardTemplate } from '~/types/builder'

// Helper: cria elemento com defaults corretos (w/h, nao width/height)
let _order = 0
function el(
  id: string,
  type: CardTemplateElement['type'],
  slot: string,
  overrides: Partial<CardTemplateElement> & { width?: string; height?: string } = {}
): CardTemplateElement {
  const { width, height, ...rest } = overrides
  return {
    id,
    type,
    slot,
    x: '0',
    y: '0',
    w: width || '100%',
    h: height || 'auto',
    order: _order++,
    ...rest,
  }
}
// Card Template Presets Style — sistema QROfertas com CSS vars
const baseStyle: Partial<CardTemplateStyle> = {
  bg: '#ffffff',
  borderRadius: '8px',
  contentType: 'V3_TIE',
  ordem: 'TITULO-IMAGEM-ETIQUETA',
  xWeight: 'X_60-40',
  yWeight: 'Y_50-50',
  invadir: 'INVADIR_20',
}

// ========================================
// VERTICAL TEMPLATES
// ========================================

// Nome no topo, imagem grande no meio, preco embaixo — estilo QROfertas classico
export const TEMPLATE_VERTICAL_CLASSIC: BuilderCardTemplate = {
  id: 'qro-vertical-classic',
  name: 'Vertical Classico',
  category: 'vertical',
  description: 'Nome no topo, imagem grande, preco embaixo',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    contentType: 'V3_TIE',
    ordem: 'TITULO-IMAGEM-ETIQUETA',
    xWeight: 'X_50-50',
    invadir: 'NAO_INVADIR',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '40%', height: 'auto' }),
    el('name', 'text', 'top', { width: '100%', height: '15%' }),
    el('image', 'image', 'middle', { width: '100%', height: '55%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Price on top, image middle, name bottom
export const TEMPLATE_VERTICAL_PRICE_TOP: BuilderCardTemplate = {
  id: 'qro-vertical-price-top',
  name: 'Preco no Topo',
  category: 'vertical',
  description: 'Preco destacado no topo do card',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    ordem: 'ETIQUETA-IMAGEM-TITULO',
    xWeight: 'X_60-40',
    invadir: 'NAO_INVADIR',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '40%', height: 'auto' }),
    el('price', 'price', 'top', { width: '100%', height: '20%' }),
    el('image', 'image', 'middle', { width: '100%', height: '55%' }),
    el('name', 'text', 'bottom', { width: '100%', height: '15%' }),
  ],
}

// Image fills most, name overlay, price bottom
export const TEMPLATE_VERTICAL_IMAGE_FOCUS: BuilderCardTemplate = {
  id: 'qro-vertical-image-focus',
  name: 'Imagem Grande',
  category: 'vertical',
  description: 'Imagem dominante com nome sobreposto',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    ordem: 'IMAGEM-TITULO-ETIQUETA',
    xWeight: 'X_70-30',
    invadir: 'INVADIR_50',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '40%', height: 'auto' }),
    el('image', 'image', 'top', { width: '100%', height: '65%' }),
    el('name', 'text', 'middle', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Name top, image middle, price bottom
export const TEMPLATE_VERTICAL_NAME_TOP: BuilderCardTemplate = {
  id: 'qro-vertical-name-top',
  name: 'Nome no Topo',
  category: 'vertical',
  description: 'Nome do produto em destaque no topo',
  card_style: { ...baseStyle, layout: 'vertical' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-right', { x: '4px', y: '4px', width: '40%', height: 'auto' }),
    el('name', 'text', 'top', { width: '100%', height: '15%' }),
    el('image', 'image', 'middle', { width: '100%', height: '55%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Centered layout with all elements stacked
export const TEMPLATE_VERTICAL_CENTERED: BuilderCardTemplate = {
  id: 'qro-vertical-centered',
  name: 'Centralizado',
  category: 'vertical',
  description: 'Todos os elementos centralizados',
  card_style: { ...baseStyle, layout: 'vertical', textAlign: 'center' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-center', { width: '40%', height: 'auto' }),
    el('image', 'image', 'middle', { width: '80%', height: '55%' }),
    el('name', 'text', 'middle', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Name strip on top, image large, price over the image near the footer
export const TEMPLATE_VERTICAL_SHELF: BuilderCardTemplate = {
  id: 'qro-vertical-shelf',
  name: 'Vertical Vitrine',
  category: 'vertical',
  description: 'Faixa de nome no topo com imagem grande e preco sobreposto',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    padding: '6px',
    gap: '3px',
    imageSize: '62%',
    nameScale: 0.92,
    nameFontWeight: 900,
    nameMaxLines: 2,
    pricePosition: 'overlay-bottom',
    priceScale: 1.12,
    priceWidth: '90%',
    priceBorderRadius: '18px',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '34%', height: 'auto' }),
    el('name', 'text', 'top', { width: '100%', height: '15%' }),
    el('image', 'image', 'middle', { width: '100%', height: '62%' }),
    el('price', 'price', 'bottom-overlay', { width: '100%', height: '20%' }),
  ],
}

// Information-heavy top block with the product packshot anchored at the bottom
export const TEMPLATE_VERTICAL_BOTTOM_IMAGE: BuilderCardTemplate = {
  id: 'qro-vertical-bottom-image',
  name: 'Info em Cima',
  category: 'vertical',
  description: 'Nome e preco primeiro, imagem apoiada na base do card',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    imagePosition: 'bottom',
    imageSize: '42%',
    gap: '2px',
    padding: '8px 8px 6px',
    nameTextAlign: 'left',
    nameScale: 0.9,
    nameMaxLines: 3,
    priceAlign: 'flex-start',
    priceScale: 1.08,
    priceWidth: '100%',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-right', { x: '4px', y: '4px', width: '34%', height: 'auto' }),
    el('name', 'text', 'top', { width: '100%', height: '15%', textAlign: 'left' }),
    el('price', 'price', 'middle', { width: '100%', height: '20%' }),
    el('image', 'image', 'bottom', { width: '100%', height: '42%' }),
  ],
}

// Image-led layout with the price centered over the packshot
export const TEMPLATE_VERTICAL_PRICE_BAND: BuilderCardTemplate = {
  id: 'qro-vertical-price-band',
  name: 'Preco na Imagem',
  category: 'vertical',
  description: 'Preco dominante sobre a imagem com nome no rodape',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    imageSize: '68%',
    gap: '2px',
    padding: '6px',
    nameScale: 0.88,
    nameFontWeight: 900,
    nameMaxLines: 2,
    pricePosition: 'overlay-center',
    priceScale: 1.2,
    priceWidth: '84%',
    priceBorderRadius: '20px',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '32%', height: 'auto' }),
    el('image', 'image', 'top', { width: '100%', height: '68%' }),
    el('name', 'text', 'bottom', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom-overlay', { width: '100%', height: '20%' }),
  ],
}

// ========================================
// HORIZONTAL TEMPLATES
// ========================================

// Image left, name and price right
export const TEMPLATE_HORIZONTAL_CLASSIC: BuilderCardTemplate = {
  id: 'qro-horizontal-classic',
  name: 'Horizontal Classico',
  category: 'horizontal',
  description: 'Imagem a esquerda, info a direita',
  card_style: { ...baseStyle, layout: 'horizontal' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '30%', height: 'auto' }),
    el('image', 'image', 'left', { width: '45%', height: '100%' }),
    el('name', 'text', 'right-top', { width: '55%', height: '35%' }),
    el('price', 'price', 'right-bottom', { width: '55%', height: '50%' }),
  ],
}

// Image right, name and price left
export const TEMPLATE_HORIZONTAL_REVERSED: BuilderCardTemplate = {
  id: 'qro-horizontal-reversed',
  name: 'Horizontal Invertido',
  category: 'horizontal',
  description: 'Info a esquerda, imagem a direita',
  card_style: { ...baseStyle, layout: 'horizontal' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-right', { x: '4px', y: '4px', width: '30%', height: 'auto' }),
    el('name', 'text', 'left-top', { width: '55%', height: '35%' }),
    el('price', 'price', 'left-bottom', { width: '55%', height: '50%' }),
    el('image', 'image', 'right', { width: '45%', height: '100%' }),
  ],
}

// Image left small, price prominent right
export const TEMPLATE_HORIZONTAL_PRICE_FOCUS: BuilderCardTemplate = {
  id: 'qro-horizontal-price-focus',
  name: 'Preco Destaque Horizontal',
  category: 'horizontal',
  description: 'Preco grande a direita com imagem pequena',
  card_style: { ...baseStyle, layout: 'horizontal' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '25%', height: 'auto' }),
    el('image', 'image', 'left', { width: '35%', height: '100%' }),
    el('name', 'text', 'right-top', { width: '65%', height: '30%' }),
    el('price', 'price', 'right-bottom', { width: '65%', height: '55%' }),
  ],
}

// Wide banner style
export const TEMPLATE_HORIZONTAL_BANNER: BuilderCardTemplate = {
  id: 'qro-horizontal-banner',
  name: 'Banner Horizontal',
  category: 'horizontal',
  description: 'Estilo banner largo para destaques',
  card_style: { ...baseStyle, layout: 'horizontal' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '20%', height: 'auto' }),
    el('image', 'image', 'left', { width: '30%', height: '100%' }),
    el('name', 'text', 'center', { width: '35%', height: '100%' }),
    el('price', 'price', 'right', { width: '35%', height: '100%' }),
  ],
}

// Text centered between packshot and price column
export const TEMPLATE_HORIZONTAL_CENTER_SHOWCASE: BuilderCardTemplate = {
  id: 'qro-horizontal-center-showcase',
  name: 'Vitrine Central',
  category: 'horizontal',
  description: 'Imagem, nome central e preco em coluna lateral',
  card_style: {
    ...baseStyle,
    layout: 'horizontal',
    padding: '6px',
    gap: '6px',
    nameTextAlign: 'center',
    nameScale: 0.92,
    priceScale: 1.12,
    priceWidth: '100%',
  } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'left', { width: '34%', height: '100%' }),
    el('name', 'text', 'center', { width: '34%', height: '35%', textAlign: 'center' }),
    el('price', 'price', 'right', { width: '32%', height: '55%' }),
  ],
}

// Large price block before the product image
export const TEMPLATE_HORIZONTAL_PRICE_COLUMN: BuilderCardTemplate = {
  id: 'qro-horizontal-price-column',
  name: 'Preco em Coluna',
  category: 'horizontal',
  description: 'Preco grande na esquerda, imagem no meio e nome na direita',
  card_style: {
    ...baseStyle,
    layout: 'horizontal',
    padding: '6px',
    gap: '6px',
    nameTextAlign: 'left',
    nameScale: 0.88,
    nameMaxLines: 3,
    priceScale: 1.24,
    priceWidth: '100%',
    priceBorderRadius: '18px',
  } as CardTemplateStyle,
  elements: [
    el('price', 'price', 'left', { width: '28%', height: '100%' }),
    el('image', 'image', 'center', { width: '32%', height: '100%' }),
    el('name', 'text', 'right', { width: '40%', height: '35%', textAlign: 'left' }),
  ],
}

// Shelf-style card with small packshot and more space for information
export const TEMPLATE_HORIZONTAL_SHELF: BuilderCardTemplate = {
  id: 'qro-horizontal-shelf',
  name: 'Prateleira',
  category: 'horizontal',
  description: 'Packshot compacto com informacoes mais comerciais',
  card_style: {
    ...baseStyle,
    layout: 'horizontal',
    padding: '5px 6px',
    gap: '5px',
    nameTextAlign: 'left',
    nameScale: 0.86,
    nameMaxLines: 3,
    priceScale: 1.1,
    priceWidth: '100%',
  } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'left', { width: '28%', height: '100%' }),
    el('name', 'text', 'center', { width: '42%', height: '35%', textAlign: 'left' }),
    el('price', 'price', 'right', { width: '30%', height: '50%' }),
  ],
}

// ========================================
// DESTAQUE (HIGHLIGHT) TEMPLATES
// ========================================

// Large card with big image and prominent price
export const TEMPLATE_DESTAQUE_GRANDE: BuilderCardTemplate = {
  id: 'qro-destaque-grande',
  name: 'Destaque Grande',
  category: 'destaque',
  description: 'Card grande para produto em destaque',
  card_style: { ...baseStyle, layout: 'vertical', fontSize: 'large' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '8px', y: '8px', width: '35%', height: 'auto' }),
    el('image', 'image', 'top', { width: '100%', height: '60%' }),
    el('name', 'text', 'middle', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Highlight with split layout
export const TEMPLATE_DESTAQUE_SPLIT: BuilderCardTemplate = {
  id: 'qro-destaque-split',
  name: 'Destaque Dividido',
  category: 'destaque',
  description: 'Layout dividido para destaque especial',
  card_style: { ...baseStyle, layout: 'horizontal', fontSize: 'large' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '8px', y: '8px', width: '30%', height: 'auto' }),
    el('image', 'image', 'left', { width: '50%', height: '100%' }),
    el('name', 'text', 'right-top', { width: '50%', height: '35%' }),
    el('price', 'price', 'right-bottom', { width: '50%', height: '50%' }),
  ],
}

// Hero highlight card with the price floating above the image
export const TEMPLATE_DESTAQUE_OVERLAY: BuilderCardTemplate = {
  id: 'qro-destaque-overlay',
  name: 'Destaque Hero',
  category: 'destaque',
  description: 'Imagem dominante com etiqueta sobreposta e nome no topo',
  card_style: {
    ...baseStyle,
    layout: 'vertical',
    padding: '8px',
    gap: '3px',
    imageSize: '72%',
    nameScale: 0.9,
    nameFontWeight: 900,
    nameMaxLines: 2,
    pricePosition: 'overlay-bottom',
    priceScale: 1.35,
    priceWidth: '88%',
    priceBorderRadius: '24px',
  } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-left', { x: '8px', y: '8px', width: '30%', height: 'auto' }),
    el('name', 'text', 'top', { width: '100%', height: '15%' }),
    el('image', 'image', 'middle', { width: '100%', height: '72%' }),
    el('price', 'price', 'bottom-overlay', { width: '100%', height: '20%' }),
  ],
}

// Split highlight with price, image and name occupying dedicated columns
export const TEMPLATE_DESTAQUE_PRICE_COLUMN: BuilderCardTemplate = {
  id: 'qro-destaque-price-column',
  name: 'Destaque Colunas',
  category: 'destaque',
  description: 'Preco em bloco, imagem de apoio e nome em coluna dedicada',
  card_style: {
    ...baseStyle,
    layout: 'horizontal',
    padding: '8px',
    gap: '8px',
    nameTextAlign: 'left',
    nameScale: 0.9,
    nameMaxLines: 3,
    priceScale: 1.32,
    priceWidth: '100%',
    priceBorderRadius: '22px',
  } as CardTemplateStyle,
  elements: [
    el('price', 'price', 'left', { width: '30%', height: '100%' }),
    el('image', 'image', 'center', { width: '30%', height: '100%' }),
    el('name', 'text', 'right', { width: '40%', height: '35%', textAlign: 'left' }),
  ],
}

// ========================================
// COMPACT TEMPLATES
// ========================================

// Minimal card with small image
export const TEMPLATE_COMPACT_MINI: BuilderCardTemplate = {
  id: 'qro-compact-mini',
  name: 'Compacto Mini',
  category: 'compact',
  description: 'Card compacto para listas densas',
  card_style: { ...baseStyle, layout: 'horizontal', padding: '4px' } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'left', { width: '30%', height: '100%' }),
    el('name', 'text', 'right-top', { width: '70%', height: '35%' }),
    el('price', 'price', 'right-bottom', { width: '70%', height: '50%' }),
  ],
}

// Text only compact
export const TEMPLATE_COMPACT_TEXT: BuilderCardTemplate = {
  id: 'qro-compact-text',
  name: 'Compacto Texto',
  category: 'compact',
  description: 'Card compacto focado em texto e preco',
  card_style: { ...baseStyle, layout: 'vertical', padding: '4px' } as CardTemplateStyle,
  elements: [
    el('name', 'text', 'top', { width: '100%', height: '20%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '25%' }),
  ],
}

// Dense shelf with narrow image, text block and side price
export const TEMPLATE_COMPACT_SIDE_PRICE: BuilderCardTemplate = {
  id: 'qro-compact-side-price',
  name: 'Compacto Lateral',
  category: 'compact',
  description: 'Layout enxuto com packshot estreito e preco lateral',
  card_style: {
    ...baseStyle,
    layout: 'horizontal',
    padding: '4px 5px',
    gap: '4px',
    nameTextAlign: 'left',
    nameScale: 0.82,
    nameMaxLines: 3,
    priceScale: 0.94,
    priceWidth: '100%',
    priceBorderRadius: '14px',
      contentType: 'G2_IT_IE',
  } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'left', { width: '24%', height: '100%' }),
    el('name', 'text', 'center', { width: '48%', height: '35%', textAlign: 'left' }),
    el('price', 'price', 'right', { width: '28%', height: '50%' }),
  ],
}

// ========================================
// SPECIAL TEMPLATES
// ========================================

// Overlay style with image background
export const TEMPLATE_SPECIAL_OVERLAY: BuilderCardTemplate = {
  id: 'qro-special-overlay',
  name: 'Overlay',
  category: 'special',
  description: 'Texto sobre imagem de fundo',
  card_style: { ...baseStyle, layout: 'overlay' } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'background', { width: '100%', height: '100%' }),
    el('badge', 'badge', 'top-left', { x: '4px', y: '4px', width: '35%', height: 'auto' }),
    el('name', 'text', 'bottom-overlay', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom-overlay', { width: '100%', height: '20%' }),
  ],
}

// Diagonal split design
export const TEMPLATE_SPECIAL_DIAGONAL: BuilderCardTemplate = {
  id: 'qro-special-diagonal',
  name: 'Diagonal',
  category: 'special',
  description: 'Design diagonal moderno',
  card_style: { ...baseStyle, layout: 'vertical' } as CardTemplateStyle,
  elements: [
    el('badge', 'badge', 'top-right', { x: '4px', y: '4px', width: '35%', height: 'auto' }),
    el('image', 'image', 'top', { width: '100%', height: '55%' }),
    el('name', 'text', 'middle', { width: '100%', height: '15%' }),
    el('price', 'price', 'bottom', { width: '100%', height: '20%' }),
  ],
}

// Stamp-style hero card with centered offer and product name near the footer
export const TEMPLATE_SPECIAL_PRICE_STAMP: BuilderCardTemplate = {
  id: 'qro-special-price-stamp',
  name: 'Selo de Preco',
  category: 'special',
  description: 'Preco centralizado sobre a arte com leitura rapida',
  card_style: {
    ...baseStyle,
    layout: 'overlay',
    padding: '8px',
    gap: '3px',
    nameScale: 0.86,
    nameMaxLines: 2,
    nameTextAlign: 'left',
    pricePosition: 'overlay-center',
    priceScale: 1.28,
    priceWidth: '82%',
    priceBorderRadius: '24px',
    priceBg: 'rgba(255,255,255,0.94)',
  } as CardTemplateStyle,
  elements: [
    el('image', 'image', 'background', { width: '100%', height: '100%' }),
    el('badge', 'badge', 'top-right', { x: '6px', y: '6px', width: '34%', height: 'auto' }),
    el('name', 'text', 'bottom-overlay', { width: '100%', height: '15%', textAlign: 'left' }),
    el('price', 'price', 'bottom-overlay', { width: '100%', height: '20%' }),
  ],
}

// All Collection Templates
export const QRO_CARD_TEMPLATES: BuilderCardTemplate[] = [
  TEMPLATE_VERTICAL_CLASSIC,
  TEMPLATE_VERTICAL_PRICE_TOP,
  TEMPLATE_VERTICAL_IMAGE_FOCUS,
  TEMPLATE_VERTICAL_NAME_TOP,
  TEMPLATE_VERTICAL_CENTERED,
  TEMPLATE_VERTICAL_SHELF,
  TEMPLATE_VERTICAL_BOTTOM_IMAGE,
  TEMPLATE_VERTICAL_PRICE_BAND,
  TEMPLATE_HORIZONTAL_CLASSIC,
  TEMPLATE_HORIZONTAL_REVERSED,
  TEMPLATE_HORIZONTAL_PRICE_FOCUS,
  TEMPLATE_HORIZONTAL_BANNER,
  TEMPLATE_HORIZONTAL_CENTER_SHOWCASE,
  TEMPLATE_HORIZONTAL_PRICE_COLUMN,
  TEMPLATE_HORIZONTAL_SHELF,
  TEMPLATE_DESTAQUE_GRANDE,
  TEMPLATE_DESTAQUE_SPLIT,
  TEMPLATE_DESTAQUE_OVERLAY,
  TEMPLATE_DESTAQUE_PRICE_COLUMN,
  TEMPLATE_COMPACT_MINI,
  TEMPLATE_COMPACT_TEXT,
  TEMPLATE_COMPACT_SIDE_PRICE,
  TEMPLATE_SPECIAL_OVERLAY,
  TEMPLATE_SPECIAL_DIAGONAL,
  TEMPLATE_SPECIAL_PRICE_STAMP,
]

// Categories UI for template carousel
export const QRO_TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'vertical', label: 'Vertical' },
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'destaque', label: 'Destaque' },
  { id: 'compact', label: 'Compacto' },
  { id: 'special', label: 'Especial' },
]

export function getQroCardTemplateById(id: string | null | undefined): BuilderCardTemplate | null {
  if (!id) return null
  return QRO_CARD_TEMPLATES.find(template => template.id === id) || null
}

export function isQroCardTemplateId(id: string | null | undefined): boolean {
  return !!getQroCardTemplateById(id)
}
