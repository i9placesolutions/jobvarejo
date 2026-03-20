// ============================================================================
// useBuilderLayout — Grid automático e cálculo de layout
// ============================================================================

/**
 * Calcula a melhor grade (columns x rows) baseado na quantidade de produtos.
 * Baseado no QR Ofertas.
 */
export function getAutoGrid(productCount: number): { columns: number; rows: number } {
  if (productCount <= 0) return { columns: 1, rows: 1 }
  if (productCount === 1) return { columns: 1, rows: 1 }
  if (productCount === 2) return { columns: 2, rows: 1 }
  if (productCount === 3) return { columns: 3, rows: 1 }
  if (productCount === 4) return { columns: 2, rows: 2 }
  if (productCount <= 6) return { columns: 3, rows: 2 }
  if (productCount <= 8) return { columns: 4, rows: 2 }
  if (productCount === 9) return { columns: 3, rows: 3 }
  if (productCount <= 12) return { columns: 4, rows: 3 }
  if (productCount <= 15) return { columns: 5, rows: 3 }
  if (productCount <= 16) return { columns: 4, rows: 4 }
  if (productCount <= 20) return { columns: 5, rows: 4 }
  if (productCount <= 24) return { columns: 6, rows: 4 }
  if (productCount <= 25) return { columns: 5, rows: 5 }
  if (productCount <= 30) return { columns: 6, rows: 5 }
  // Fallback: roughly square
  const cols = Math.ceil(Math.sqrt(productCount * 1.2))
  const rows = Math.ceil(productCount / cols)
  return { columns: cols, rows }
}

/**
 * Verifica se um layout é automático (columns=0 e rows=0 indicam auto).
 */
export function isAutoLayout(layout: { columns: number; rows: number } | null): boolean {
  if (!layout) return false
  return layout.columns === 0 && layout.rows === 0
}

// ── Highlight layout presets ────────────────────────────────────────────────
// Layouts com grid-template-areas para produtos em destaque.
// Key = nome legível, value = configuração CSS Grid.

export interface HighlightLayoutConfig {
  name: string
  productsPerPage: number
  columns: string           // grid-template-columns
  rows: string              // grid-template-rows
  areas: string             // grid-template-areas
  highlightPositions: number[] // quais índices são destaque (ocupam mais espaço)
}

export const HIGHLIGHT_LAYOUTS: HighlightLayoutConfig[] = [
  // 5 Produtos - 1 destaque esquerdo + 4 normais
  {
    name: '5 Produtos - 1 Destaque Esq.',
    productsPerPage: 5,
    columns: '2fr 1fr 1fr',
    rows: '1fr 1fr',
    areas: '"d0 p1 p2" "d0 p3 p4"',
    highlightPositions: [0],
  },
  // 5 Produtos - 1 destaque direito + 4 normais
  {
    name: '5 Produtos - 1 Destaque Dir.',
    productsPerPage: 5,
    columns: '1fr 1fr 2fr',
    rows: '1fr 1fr',
    areas: '"p1 p2 d0" "p3 p4 d0"',
    highlightPositions: [0],
  },
  // 5 Produtos - 1 destaque topo + 4 normais
  {
    name: '5 Produtos - 1 Destaque Topo',
    productsPerPage: 5,
    columns: '1fr 1fr 1fr 1fr',
    rows: '2fr 1fr',
    areas: '"d0 d0 d0 d0" "p1 p2 p3 p4"',
    highlightPositions: [0],
  },
  // 6 Produtos - 2 destaques topo + 4 normais
  {
    name: '6 Produtos - 2 Dest. Topo',
    productsPerPage: 6,
    columns: '1fr 1fr 1fr 1fr',
    rows: '1.3fr 1fr',
    areas: '"d0 d0 d1 d1" "p2 p3 p4 p5"',
    highlightPositions: [0, 1],
  },
  // 7 Produtos - 3 destaques topo + 4 normais
  {
    name: '7 Produtos - 3 Dest. Topo',
    productsPerPage: 7,
    columns: '1fr 1fr 1fr',
    rows: '1.4fr 1fr',
    areas: '"d0 d1 d2" "p3 p4 . " "p5 p6 ."',
    highlightPositions: [0, 1, 2],
  },
  // 8 Produtos - 2 destaques topo + 6 normais
  {
    name: '8 Produtos - 2 Dest. Topo',
    productsPerPage: 8,
    columns: '1fr 1fr 1fr',
    rows: '1.5fr 1fr 1fr',
    areas: '"d0 d0 d1" "p2 p3 p4" "p5 p6 p7"',
    highlightPositions: [0, 1],
  },
  // 9 Produtos - 1 destaque centro + 8 normais
  {
    name: '9 Produtos - 1 Dest. Centro',
    productsPerPage: 9,
    columns: '1fr 2fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"p1 d0 p2" "p3 d0 p4" "p5 p6 p7"',
    highlightPositions: [0],
  },
  // 10 Produtos - 2 destaques laterais + 6 normais
  {
    name: '10 Produtos - 2 Dest. Laterais',
    productsPerPage: 10,
    columns: '2fr 1fr 1fr 2fr',
    rows: '1fr 1fr 1fr',
    areas: '"d0 p2 p3 d1" "d0 p4 p5 d1" "p6 p7 p8 p9"',
    highlightPositions: [0, 1],
  },
  // 12 Produtos - 4 destaques topo + 8 normais
  {
    name: '12 Produtos - 4 Dest. Topo',
    productsPerPage: 12,
    columns: '1fr 1fr 1fr 1fr',
    rows: '1.5fr 1fr 1fr',
    areas: '"d0 d1 d2 d3" "p4 p5 p6 p7" "p8 p9 p10 p11"',
    highlightPositions: [0, 1, 2, 3],
  },
]

/**
 * Dado um grid_config com areas, gera o CSS style para grid-template-areas.
 */
export function getGridAreasStyle(config: {
  areas?: string
  columns?: string
  rows?: string
} | null): Record<string, string> | null {
  if (!config?.areas) return null
  // Wrap fr units in minmax(0, Xfr) to prevent min-content from expanding rows
  const rows = (config.rows || '1fr 1fr').replace(/(\d*\.?\d*)fr/g, 'minmax(0, $1fr)')
  return {
    display: 'grid',
    gridTemplateColumns: config.columns || '1fr 1fr 1fr',
    gridTemplateRows: rows,
    gridTemplateAreas: config.areas,
  }
}

/**
 * Gera o grid-area name para uma célula baseado no index.
 * Destaque => d{index}, Normal => p{index}
 */
export function getCellAreaName(index: number, isHighlight: boolean): string {
  return isHighlight ? `d${index}` : `p${index}`
}

// ── Composable ──────────────────────────────────────────────────────────────

export const useBuilderLayout = () => {
  const { layout, products, paginatedProducts } = useBuilderFlyer()

  const isAuto = computed(() => isAutoLayout(layout.value))

  const effectiveGrid = computed(() => {
    if (isAuto.value) {
      return getAutoGrid(paginatedProducts.value.length || products.value.length)
    }
    return {
      columns: layout.value?.columns ?? 3,
      rows: layout.value?.rows ?? 2,
    }
  })

  const effectiveProductsPerPage = computed(() => {
    if (isAuto.value) {
      // Em modo automático, todos os produtos ficam na mesma página (sem paginação forçada)
      // ou usa o total dos produtos
      return products.value.length || 6
    }
    return layout.value?.products_per_page ?? 6
  })

  const hasHighlightLayout = computed(() => {
    const cfg = layout.value?.grid_config
    return !!(cfg && typeof cfg === 'object' && 'areas' in cfg && cfg.areas)
  })

  const highlightGridStyle = computed(() => {
    if (!hasHighlightLayout.value) return null
    return getGridAreasStyle(layout.value?.grid_config as any)
  })

  return {
    isAuto,
    effectiveGrid,
    effectiveProductsPerPage,
    hasHighlightLayout,
    highlightGridStyle,
    getAutoGrid,
    getCellAreaName,
  }
}
