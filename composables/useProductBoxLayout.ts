// ============================================================================
// useProductBoxLayout — Sistema de Layout de Box de Produto (16 variações)
// Baseado no QR Ofertas: ordem, content, etiqueta, X_, Y_, INVADIR
// ============================================================================

export type OrdemType = 'TITULO-IMAGEM-ETIQUETA' | 'IMAGEM-TITULO-ETIQUETA' | 'IMAGEM-ETIQUETA-TITULO'
export type ContentType = 'CONTENT_LINE' | 'CONTENT_COL_ETIQUETA_TITULO' | 'CONTENT_ROW_ETIQUETA_TITULO' | 'CONTENT_ROW_BOTTOM' | 'CONTENT_ROW_ETIQUETA_IMAGEM'
export type EtiquetaType = 'ETIQUETA-HORIZONTAL' | 'ETIQUETA-VERTICAL'
export type XType = 'X_30-70' | 'X_40-60' | 'X_50-50' | 'X_60-40' | 'X_70-30'
export type YType = 'Y_20-80' | 'Y_30-70' | 'Y_35-65' | 'Y_50-50' | 'Y_60-40' | 'Y_65-35' | 'Y_70-30' | 'Y_80-20'
export type InvadirType = 'NAO_INVADIR' | 'INVADIR_20' | 'INVADIR_50' | 'INVADIR_100'

export interface ProductBoxLayoutConfig {
  id: number
  ordem: OrdemType
  content: ContentType
  etiqueta: EtiquetaType
  x: XType
  y: YType
  invadir: InvadirType
  descricao: string
}

export const PRODUCT_BOX_LAYOUTS: ProductBoxLayoutConfig[] = [
  // --- CONTENT_LINE (empilhado vertical) ---
  { id: 1, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_70-30', y: 'Y_70-30', invadir: 'INVADIR_20', descricao: 'Nome cima, imagem grande, preço horizontal embaixo' },
  { id: 2, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_60-40', y: 'Y_65-35', invadir: 'INVADIR_20', descricao: 'Nome cima, imagem média, preço horizontal embaixo' },
  { id: 3, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_70-30', y: 'Y_70-30', invadir: 'INVADIR_50', descricao: 'Nome cima, imagem grande invasão média, preço horizontal' },
  { id: 4, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_40-60', y: 'Y_20-80', invadir: 'NAO_INVADIR', descricao: 'Nome cima pequeno, imagem+preço vertical ocupam 80%' },
  { id: 5, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_70-30', invadir: 'INVADIR_20', descricao: 'Nome cima, imagem 60%, preço vertical 40%' },
  { id: 6, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_70-30', y: 'Y_70-30', invadir: 'INVADIR_50', descricao: 'Nome cima, imagem 70%, preço vertical estreito' },

  // --- CONTENT_ROW_BOTTOM ---
  { id: 7, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_ROW_BOTTOM', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_30-70', invadir: 'NAO_INVADIR', descricao: 'Nome 30% topo, imagem+preço vertical em row embaixo' },

  // --- CONTENT_ROW_ETIQUETA_IMAGEM ---
  { id: 8, ordem: 'TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_ROW_ETIQUETA_IMAGEM', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_20-80', invadir: 'NAO_INVADIR', descricao: 'Nome 20% topo, etiqueta ao lado da imagem' },

  // --- CONTENT_COL_ETIQUETA_TITULO (colunas lado a lado) ---
  { id: 9, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_30-70', y: 'Y_60-40', invadir: 'NAO_INVADIR', descricao: 'Imagem 30% esquerda, nome+preço vertical 70% direita' },
  { id: 10, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_40-60', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 40% esquerda, nome+preço horizontal 60% direita' },
  { id: 11, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_50-50', y: 'Y_30-70', invadir: 'NAO_INVADIR', descricao: 'Imagem metade, nome+preço horizontal metade' },
  { id: 12, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_50-50', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Metade-metade equilibrado com preço horizontal' },
  { id: 13, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_60-40', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 60%, nome+preço horizontal 40%' },
  { id: 14, ordem: 'IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 60%, nome+preço vertical 40%' },

  // --- CONTENT_ROW_ETIQUETA_TITULO (imagem grande, preço+nome em row) ---
  { id: 15, ordem: 'IMAGEM-ETIQUETA-TITULO', content: 'CONTENT_ROW_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_40-60', y: 'Y_70-30', invadir: 'INVADIR_100', descricao: 'Imagem invasão total, preço+nome em row embaixo (30%)' },
  { id: 16, ordem: 'IMAGEM-ETIQUETA-TITULO', content: 'CONTENT_ROW_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_40-60', y: 'Y_70-30', invadir: 'INVADIR_100', descricao: 'Imagem invasão total (70%), preço+nome row embaixo (30%)' },
]

// Layouts bons para destaques (horizontal / colunas / invasão)
const HIGHLIGHT_LAYOUT_IDS = [9, 10, 11, 13, 15, 3, 6]
// Layouts bons para normais (vertical / empilhado)
const NORMAL_LAYOUT_IDS = [1, 2, 4, 5, 7]

/**
 * Retorna o layout config para um box baseado no modo e posição.
 * - 'smart': varia layouts entre boxes, destaques usam layouts horizontais
 * - 'standard': usa layout #2 (padrão vertical) para todos
 */
export function getLayoutForBox(
  boxIndex: number,
  isHighlight: boolean,
  modo: 'smart' | 'standard',
): ProductBoxLayoutConfig {
  if (modo === 'standard') {
    // Modo padrão: layout #2 para todos (vertical clássico)
    return PRODUCT_BOX_LAYOUTS[1]!
  }

  // Modo inteligente: destaques usam layouts horizontais, normais variam entre verticais
  if (isHighlight) {
    const idx = boxIndex % HIGHLIGHT_LAYOUT_IDS.length
    return PRODUCT_BOX_LAYOUTS.find(l => l.id === HIGHLIGHT_LAYOUT_IDS[idx])!
  }

  const idx = boxIndex % NORMAL_LAYOUT_IDS.length
  return PRODUCT_BOX_LAYOUTS.find(l => l.id === NORMAL_LAYOUT_IDS[idx])!
}

// ── Helpers para extrair valores numéricos das classes ────────────────────

export function parseXSplit(x: XType): { imagePercent: number; infoPercent: number } {
  const match = x.match(/X_(\d+)-(\d+)/)
  if (!match) return { imagePercent: 60, infoPercent: 40 }
  return { imagePercent: parseInt(match[1]!), infoPercent: parseInt(match[2]!) }
}

export function parseYSplit(y: YType): { topPercent: number; bottomPercent: number } {
  const match = y.match(/Y_(\d+)-(\d+)/)
  if (!match) return { topPercent: 80, bottomPercent: 20 }
  return { topPercent: parseInt(match[1]!), bottomPercent: parseInt(match[2]!) }
}

export function parseInvasion(invadir: InvadirType): number {
  if (invadir === 'NAO_INVADIR') return 0
  const match = invadir.match(/INVADIR_(\d+)/)
  return match ? parseInt(match[1]!) : 0
}

export function parseOrdem(ordem: OrdemType): string[] {
  return ordem.split('-') // ['TITULO', 'IMAGEM', 'ETIQUETA'] etc
}

// ── Composable ──────────────────────────────────────────────────────────────

export const useProductBoxLayout = () => {
  return {
    PRODUCT_BOX_LAYOUTS,
    getLayoutForBox,
    parseXSplit,
    parseYSplit,
    parseInvasion,
    parseOrdem,
  }
}
