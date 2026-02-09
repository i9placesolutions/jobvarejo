/**
 * Product Zone Helpers
 * Ported from legacy system - Utility functions for Product Zone
 */

import type { Product, ProductImage, Splash, ProductZone, GlobalStyles } from '~/types/product-zone';
import { DEFAULT_PRODUCT_ZONE, DEFAULT_GLOBAL_STYLES, DEFAULT_SPLASH } from '~/types/product-zone';

// =============================================================================
// CALCULATE OPTIMAL IMAGE SIZE (CORE ALGORITHM - DO NOT MODIFY)
// =============================================================================

/**
 * Calcula o tamanho ótimo da imagem baseado no tamanho do card e quantidade de produtos.
 * Este algoritmo garante consistência visual e que imagens não ocupem o espaço reservado ao nome/limite.
 * 
 * @param productZone - Zona de produtos (usado para decisões futuras)
 * @param productCount - Quantidade de produtos no grid
 * @param hasName - Se o produto tem nome visível
 * @param hasLimit - Se o produto tem badge de limite
 * @param productWidth - Largura do card do produto
 * @param productHeight - Altura do card do produto
 */
export const calculateOptimalImageSize = (
  productZone: ProductZone | null,
  productCount: number,
  hasName: boolean,
  hasLimit: boolean,
  productWidth: number,
  productHeight: number
): { maxWidth: number; maxHeight: number } => {
  const cellWidth = productWidth;
  const cellHeight = productHeight;

  // Reserva fixa no topo para o nome
  const topReserve = Math.min(cellHeight * 0.15, 50);
  const bottomReserve = 0;
  const sidePadding = Math.max(2, cellWidth * 0.01);

  const availableWidth = cellWidth - (sidePadding * 2);
  const availableHeight = cellHeight - topReserve - bottomReserve;

  // Fill ratio baseado na quantidade de produtos
  let imageFillRatio: number;
  if (productCount <= 2) imageFillRatio = 0.98;
  else if (productCount <= 4) imageFillRatio = 0.95;
  else if (productCount <= 6) imageFillRatio = 0.92;
  else if (productCount <= 9) imageFillRatio = 0.88;
  else if (productCount <= 12) imageFillRatio = 0.85;
  else if (productCount <= 16) imageFillRatio = 0.80;
  else imageFillRatio = 0.75;

  const imageWidth = availableWidth * imageFillRatio;
  const imageHeight = availableHeight * imageFillRatio;

  const MIN_SIZE = Math.max(60, Math.min(cellWidth * 0.4, cellHeight * 0.3));

  return {
    maxWidth: Math.max(MIN_SIZE, imageWidth),
    maxHeight: Math.max(MIN_SIZE, imageHeight)
  };
};

// =============================================================================
// PRICE PARSING & FORMATTING
// =============================================================================

/**
 * Parse preço de string para número
 * Aceita formatos: "19,90", "R$ 19.90", "19.9", etc.
 */
export const parsePrice = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  
  // Remove símbolos, espaços e mantém apenas dígitos/separadores relevantes
  const cleaned = value.toString()
    .replace(/R\$\s*/gi, '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) return 0;
  
  // Detecta o separador decimal pelo último separador presente.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let decimalSeparator: ',' | '.' | null = null;
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.';
    const parts = cleaned.split(sep);
    const occurrences = parts.length - 1;
    const fraction = parts[1] ?? '';
    if (occurrences === 1 && fraction.length > 0 && fraction.length <= 2) {
      decimalSeparator = sep;
    }
  }

  let normalized: string;
  if (!decimalSeparator) {
    // Apenas separadores de milhar (ou formato inválido): remove todos.
    normalized = cleaned.replace(/[.,]/g, '');
  } else {
    const decimalIndex = cleaned.lastIndexOf(decimalSeparator);
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fractionPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = `${integerPart}.${fractionPart}`;
  }
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formata preço para exibição em formato brasileiro
 */
export const formatPriceBR = (value: number | string, includeSymbol = false): string => {
  const num = typeof value === 'string' ? parsePrice(value) : value;
  const formatted = num.toFixed(2).replace('.', ',');
  return includeSymbol ? `R$ ${formatted}` : formatted;
};

/**
 * Separa preço em partes para renderização estilizada
 */
export const splitPrice = (value: number | string): { integer: string; decimal: string; currency: string } => {
  const num = typeof value === 'string' ? parsePrice(value) : value;
  const [intPart, decPart] = num.toFixed(2).split('.');
  
  return {
    integer: intPart || '0',
    decimal: decPart || '00',
    currency: 'R$'
  };
};

/**
 * Calcula preço de pacote (atacado)
 */
export const getPackPrice = (unitPrice: number, quantity: number): number => {
  return unitPrice * quantity;
};

/**
 * Calcula preço promocional
 */
export const getPromoPrice = (originalPrice: number, discountPercent: number): number => {
  return originalPrice * (1 - discountPercent / 100);
};

// =============================================================================
// PRODUCT ZONE HELPERS
// =============================================================================

/**
 * Obtém o padding efetivo da zona
 */
export const getZonePadding = (zone: ProductZone): number => {
  return zone.padding ?? DEFAULT_PRODUCT_ZONE.padding ?? 15;
};

/**
 * Obtém o gap horizontal
 */
export const getGapHorizontal = (zone: ProductZone): number => {
  return zone.gapHorizontal ?? zone.padding ?? 15;
};

/**
 * Obtém o gap vertical
 */
export const getGapVertical = (zone: ProductZone): number => {
  return zone.gapVertical ?? zone.padding ?? 15;
};

/**
 * Obtém comportamento da última linha
 */
export const getLastRowBehavior = (zone: ProductZone): ProductZone['lastRowBehavior'] => {
  return zone.lastRowBehavior ?? 'center';
};

/**
 * Obtém offset do splash por coluna
 */
export const getSplashOffsetByCol = (zone: ProductZone, colIndex: number): number => {
  if (!zone.splashOffsetByCol || zone.splashOffsetByCol.length === 0) return 0;
  return zone.splashOffsetByCol[colIndex] ?? 0;
};

/**
 * Obtém offset do splash por linha
 */
export const getSplashOffsetByRow = (zone: ProductZone, rowIndex: number): number => {
  if (!zone.splashOffsetByRow || zone.splashOffsetByRow.length === 0) return 0;
  return zone.splashOffsetByRow[rowIndex] ?? 0;
};

// =============================================================================
// GRID CALCULATION
// =============================================================================

/**
 * Calcula o layout do grid baseado na zona e quantidade de produtos
 */
export const calculateGridLayout = (
  zone: ProductZone,
  productCount: number
): { cols: number; rows: number; itemWidth: number; itemHeight: number } => {
  const padding = getZonePadding(zone);
  const gapH = getGapHorizontal(zone);
  const gapV = getGapVertical(zone);
  
  const availableWidth = Math.max(1, zone.width - (padding * 2));
  const availableHeight = Math.max(1, zone.height - (padding * 2));
  let cols: number;
  let rows: number;

  // Colunas fixas ou automáticas
  if (zone.columns && zone.columns > 0) {
    // Colunas fixas: respeita o valor definido mesmo com poucos produtos
    // Isso permite layouts como "6 colunas" funcionarem corretamente
    cols = zone.columns;
  } else {
    // Auto-calculate: prioriza preenchimento e evita "órfãos" na ultima linha
    const minCardWidth = 60; 
    const maxColsByWidth = Math.max(1, Math.floor((availableWidth + gapH) / (minCardWidth + gapH)));
    const limitCols = productCount > 0 
      ? Math.min(productCount, maxColsByWidth) 
      : 1;

    const applyRatio = zone.cardAspectRatio && zone.cardAspectRatio !== 'auto' && zone.cardAspectRatio !== 'fill';
    const ratioValue = applyRatio ? getAspectRatioValue(zone.cardAspectRatio ?? '') : null;
    const cardRatio = ratioValue ?? 0.72;
    const zoneRatio = availableWidth / Math.max(1, availableHeight);
    
    let bestCols = 1;
    let bestScore = -Infinity;
    
    for (let c = 1; c <= limitCols; c++) {
      const r = Math.ceil(productCount / c);
      
      const gapTotalW = (c - 1) * gapH;
      const gapTotalH = (r - 1) * gapV;
      
      let w = (availableWidth - gapTotalW) / c;
      let h = (availableHeight - gapTotalH) / r;
      
      if (h <= 0 || w <= 0) continue;
      
      if (applyRatio && cardRatio) {
        const heightFromRatio = w / cardRatio;
        if (heightFromRatio <= h) {
          h = heightFromRatio;
        } else {
          w = h * cardRatio;
        }
      }
      
      const usedW = (c * w) + gapTotalW;
      const usedH = (r * h) + gapTotalH;
      const fillRatio = (usedW * usedH) / (availableWidth * availableHeight);
      
      const emptySlots = (r * c) - productCount;
      const lastRowItemCount = productCount % c || c;
      const balance = Math.abs(c - r) / Math.max(c, r);
      const gridRatio = usedW / Math.max(1, usedH);
      const ratioPenalty = Math.abs(gridRatio - zoneRatio);
      
      let score = fillRatio;
      score -= emptySlots * 0.04;
      if (productCount > 1 && lastRowItemCount === 1) score -= 0.35;
      if (c === 1 && productCount > 1 && availableWidth > 140) score -= 0.3;
      score -= balance * 0.15;
      score -= ratioPenalty * 0.1;
      
      if (score > bestScore) {
        bestScore = score;
        bestCols = c;
      }
    }
    
    cols = bestCols;
  }

  // --- TRAVAS DE SEGURANÇA FORÇADAS ---
  // O sistema pode insistir em 1 coluna em zonas muito altas; forçamos colunas se houver espaço mínimo.
  const minForcedCardWidth = 80;
  const minWidthForCols = (desiredCols: number) => {
    return (desiredCols * minForcedCardWidth) + ((desiredCols - 1) * gapH);
  };
  
  if (productCount >= 2 && cols < 2 && availableWidth >= minWidthForCols(2)) {
    cols = 2;
  }
  
  if (productCount >= 5 && cols < 3 && availableWidth >= minWidthForCols(3)) {
    cols = 3;
  }

  // Linhas fixas ou calculadas
  const minRowsForCount = Math.max(1, Math.ceil(Math.max(1, productCount) / Math.max(1, cols)));
  if (zone.rows && zone.rows > 0) {
    rows = Math.max(zone.rows, minRowsForCount);
  } else {
    rows = minRowsForCount;
  }

  // Calcular dimensões dos itens
  const totalGapW = (cols - 1) * gapH;
  const totalGapH = (rows - 1) * gapV;
  
  let itemWidth = (availableWidth - totalGapW) / cols;
  let itemHeight = (availableHeight - totalGapH) / rows;
  
  // Proteção contra valores negativos ou zero
  if (itemWidth < 10) itemWidth = 10;
  if (itemHeight < 10) itemHeight = 10;

  // Aplicar aspect ratio se definido
  if (zone.cardAspectRatio && zone.cardAspectRatio !== 'auto' && zone.cardAspectRatio !== 'fill') {
    const ratio = getAspectRatioValue(zone.cardAspectRatio ?? '');
    if (ratio) {
      const heightFromRatio = itemWidth / ratio;
      if (heightFromRatio <= itemHeight) {
        itemHeight = heightFromRatio;
      } else {
        itemWidth = itemHeight * ratio;
      }
    }
  }

  return { cols, rows, itemWidth, itemHeight };
};

/**
 * Converte string de aspect ratio para valor numérico
 */
export const getAspectRatioValue = (ratio: string): number | null => {
  const ratios: Record<string, number> = {
    'square': 1,
    '1:1': 1,
    '3:4': 3/4,
    '4:3': 4/3,
    '16:9': 16/9,
    '9:16': 9/16,
    '2:3': 2/3,
    '3:2': 3/2
  };
  return ratios[ratio] ?? null;
};

/**
 * Calcula a posição de um produto no grid
 */
export const calculateProductPosition = (
  zone: ProductZone,
  index: number,
  cols: number,
  itemWidth: number,
  itemHeight: number,
  productCount: number
): { x: number; y: number } => {
  const padding = getZonePadding(zone);
  const gapH = getGapHorizontal(zone);
  const gapV = getGapVertical(zone);
  
  const row = Math.floor(index / cols);
  const col = index % cols;
  
  let xOffset = padding + (col * (itemWidth + gapH));
  const yOffset = padding + (row * (itemHeight + gapV));
  
  // Centralizar última linha se comportamento for 'center'
  const totalRows = Math.ceil(productCount / cols);
  const lastRowItemCount = productCount % cols || cols;
  
  if (row === totalRows - 1 && lastRowItemCount < cols) {
    const behavior = getLastRowBehavior(zone);
    
    if (behavior === 'center') {
      const rowWidth = (lastRowItemCount * itemWidth) + ((lastRowItemCount - 1) * gapH);
      const availableWidth = zone.width - (padding * 2);
      const centerOffset = (availableWidth - rowWidth) / 2;
      xOffset = centerOffset + (col * (itemWidth + gapH)) + padding;
    }
    // 'fill' e 'stretch' mantém o comportamento padrão
    // 'left' também mantém
  }

  return {
    x: zone.x + xOffset,
    y: zone.y + yOffset
  };
};

// =============================================================================
// MIGRATION HELPERS
// =============================================================================

/**
 * Migra produto de formato antigo para novo
 */
export const migrateProduct = (oldProduct: any): Product => {
  const id = oldProduct.id ?? `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const hasValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  };

  // Processar imagens
  let images: ProductImage[] = [];
  if (Array.isArray(oldProduct.images)) {
    images = oldProduct.images.map((img: any, idx: number) => ({
      id: img.id ?? `img_${id}_${idx}`,
      src: img.src ?? img.url ?? '',
      x: img.x ?? 0,
      y: img.y ?? 0,
      scale: img.scale ?? 1,
      rotation: img.rotation ?? 0,
      imgWidth: img.imgWidth ?? img.width,
      imgHeight: img.imgHeight ?? img.height,
      imgCropTop: img.imgCropTop ?? 0,
      imgCropRight: img.imgCropRight ?? 0,
      imgCropBottom: img.imgCropBottom ?? 0,
      imgCropLeft: img.imgCropLeft ?? 0,
      imgEffect: img.imgEffect ?? 'none'
    }));
  } else if (oldProduct.imageUrl || oldProduct.image || oldProduct.url) {
    images = [{
      id: `img_${id}_0`,
      src: oldProduct.imageUrl ?? oldProduct.image ?? oldProduct.url ?? '',
      x: 0,
      y: 0,
      scale: 1
    }];
  }

  // ===== LÓGICA DE PREÇO =====
  // Prioridade de campos de preço (do mais específico para o mais genérico):
  // 1. priceUnit (PREÇO UND. AVULSA) - preço unitário
  // 2. price (legado) - preço principal
  // 3. pricePack (PREÇO CX. AVULSA) - preço da embalagem (como fallback)
  let finalPrice = 0;
  if (hasValue(oldProduct.priceUnit)) {
    finalPrice = parsePrice(oldProduct.priceUnit);
  } else if (hasValue(oldProduct.price)) {
    finalPrice = parsePrice(oldProduct.price);
  } else if (hasValue(oldProduct.pricePack)) {
    finalPrice = parsePrice(oldProduct.pricePack);
  }

  return {
    id,
    name: oldProduct.name ?? 'Produto',
    images,
    x: oldProduct.x ?? 0,
    y: oldProduct.y ?? 0,
    width: oldProduct.width ?? 200,
    height: oldProduct.height ?? 300,
    price: finalPrice,
    unit: oldProduct.unit ?? 'un',
    showPrice: oldProduct.showPrice ?? true,
    priceMode: oldProduct.price_mode ?? oldProduct.priceMode ?? 'retail',
    isFreeMode: oldProduct.isFreeMode ?? false,
    colIndex: oldProduct.colIndex,
    rowIndex: oldProduct.rowIndex,
    backgroundColor: oldProduct.backgroundColor ?? '#ffffff',
    borderRadius: oldProduct.borderRadius ?? 8,
    type: oldProduct.type ?? 'none',
    limitText: oldProduct.limit ?? oldProduct.limitText ?? '',
    brand: oldProduct.brand ?? '',
    weight: oldProduct.weight ?? '',
    flavor: oldProduct.flavor ?? '',
    zIndex: oldProduct.zIndex ?? 0,
    status: oldProduct.status ?? 'done',
    // ===== NOVOS CAMPOS DE PREÇO =====
    // Preservar os campos extras para uso futuro
    pricePack: hasValue(oldProduct.pricePack) ? parsePrice(oldProduct.pricePack) : undefined,
    priceUnit: hasValue(oldProduct.priceUnit) ? parsePrice(oldProduct.priceUnit) : undefined,
    priceSpecial: hasValue(oldProduct.priceSpecial) ? parsePrice(oldProduct.priceSpecial) : undefined,
    priceSpecialUnit: hasValue(oldProduct.priceSpecialUnit) ? parsePrice(oldProduct.priceSpecialUnit) : undefined,
    specialCondition: oldProduct.specialCondition ?? undefined,
    // Metadata de embalagem
    packQuantity: oldProduct.packQuantity ?? undefined,
    packUnit: oldProduct.packUnit ?? undefined,
    packageLabel: oldProduct.packageLabel ?? undefined,
    // Wholesale legado
    priceWholesale: hasValue(oldProduct.priceWholesale) ? parsePrice(oldProduct.priceWholesale) : undefined,
    wholesaleTrigger: oldProduct.wholesaleTrigger ?? undefined,
    wholesaleTriggerUnit: oldProduct.wholesaleTriggerUnit ?? undefined,
    // Raw data
    raw: oldProduct.raw ?? oldProduct
  };
};

/**
 * Migra ProductZone de formato antigo para novo
 */
export const migrateProductZone = (oldZone: any): ProductZone => {
  const padding = oldZone.padding ?? oldZone.margin ?? DEFAULT_PRODUCT_ZONE.padding;
  return {
    ...DEFAULT_PRODUCT_ZONE,
    id: oldZone.id ?? DEFAULT_PRODUCT_ZONE.id,
    enabled: oldZone.enabled ?? DEFAULT_PRODUCT_ZONE.enabled,
    x: oldZone.x ?? oldZone.left ?? DEFAULT_PRODUCT_ZONE.x,
    y: oldZone.y ?? oldZone.top ?? DEFAULT_PRODUCT_ZONE.y,
    width: oldZone.width ?? DEFAULT_PRODUCT_ZONE.width,
    height: oldZone.height ?? DEFAULT_PRODUCT_ZONE.height,
    padding,
    gapHorizontal: oldZone.gapHorizontal ?? oldZone.gap ?? padding ?? DEFAULT_PRODUCT_ZONE.gapHorizontal,
    gapVertical: oldZone.gapVertical ?? oldZone.gap ?? padding ?? DEFAULT_PRODUCT_ZONE.gapVertical,
    columns: oldZone.columns ?? oldZone.cols ?? 0,
    rows: oldZone.rows ?? 0,
    layoutDirection: oldZone.layoutDirection ?? 'horizontal',
    cardAspectRatio: oldZone.cardAspectRatio ?? 'auto',
    lastRowBehavior: oldZone.lastRowBehavior ?? oldZone.orphanBehavior ?? 'center',
    highlightCount: oldZone.highlightCount ?? 0,
    highlightPos: oldZone.highlightPos ?? DEFAULT_PRODUCT_ZONE.highlightPos,
    highlightHeight: oldZone.highlightHeight ?? DEFAULT_PRODUCT_ZONE.highlightHeight,
    highlightStyle: oldZone.highlightStyle ?? DEFAULT_PRODUCT_ZONE.highlightStyle,
    verticalAlign: oldZone.verticalAlign ?? DEFAULT_PRODUCT_ZONE.verticalAlign,
    isLocked: oldZone.isLocked ?? false,
    backgroundColor: oldZone.backgroundColor ?? DEFAULT_PRODUCT_ZONE.backgroundColor,
    borderColor: oldZone.borderColor ?? DEFAULT_PRODUCT_ZONE.borderColor,
    borderWidth: oldZone.borderWidth ?? DEFAULT_PRODUCT_ZONE.borderWidth,
    borderRadius: oldZone.borderRadius ?? DEFAULT_PRODUCT_ZONE.borderRadius,
    showBorder: oldZone.showBorder ?? DEFAULT_PRODUCT_ZONE.showBorder,
    splashOffsetY: oldZone.splashOffsetY ?? DEFAULT_PRODUCT_ZONE.splashOffsetY,
    splashOffsetByCol: Array.isArray(oldZone.splashOffsetByCol)
      ? oldZone.splashOffsetByCol
      : DEFAULT_PRODUCT_ZONE.splashOffsetByCol,
    splashOffsetByRow: Array.isArray(oldZone.splashOffsetByRow)
      ? oldZone.splashOffsetByRow
      : DEFAULT_PRODUCT_ZONE.splashOffsetByRow
  };
};

/**
 * Cria um ProductZone padrão
 */
export const createDefaultProductZone = (overrides?: Partial<ProductZone>): ProductZone => {
  return {
    ...DEFAULT_PRODUCT_ZONE,
    id: `zone_${Date.now()}`,
    ...overrides
  };
};

/**
 * Cria um Product padrão
 */
export const createDefaultProduct = (overrides?: Partial<Product>): Product => {
  const id = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: 'Novo Produto',
    images: [],
    x: 0,
    y: 0,
    width: 200,
    height: 300,
    price: 0,
    unit: 'un',
    showPrice: true,
    ...overrides
  };
};

/**
 * Cria um Splash padrão para um produto
 */
export const createDefaultSplash = (productId: string | number, price?: number | string): Splash => {
  return {
    id: `splash_${productId}`,
    parentId: productId,
    price: price ? formatPriceBR(price) : '0,00',
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
    fontWeight: 700,
    visible: true
  } as Splash;
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Valida um produto
 */
export const validateProduct = (product: Partial<Product>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!product.name || product.name.trim() === '') {
    errors.push('Nome do produto é obrigatório');
  }
  
  if (product.price !== undefined && product.price !== null) {
    const priceNum = parsePrice(product.price);
    if (priceNum < 0) {
      errors.push('Preço não pode ser negativo');
    }
  }
  
  if (product.width !== undefined && product.width <= 0) {
    errors.push('Largura deve ser maior que zero');
  }
  
  if (product.height !== undefined && product.height <= 0) {
    errors.push('Altura deve ser maior que zero');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Valida uma zona de produtos
 */
export const validateProductZone = (zone: Partial<ProductZone>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (zone.width !== undefined && zone.width <= 0) {
    errors.push('Largura da zona deve ser maior que zero');
  }
  
  if (zone.height !== undefined && zone.height <= 0) {
    errors.push('Altura da zona deve ser maior que zero');
  }
  
  if (zone.padding !== undefined && zone.padding < 0) {
    errors.push('Padding não pode ser negativo');
  }
  
  if (zone.columns !== undefined && zone.columns < 0) {
    errors.push('Número de colunas não pode ser negativo');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
