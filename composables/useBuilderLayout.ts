// ============================================================================
// useBuilderLayout — Grid automático e cálculo de layout
// ============================================================================

/**
 * Calcula a melhor grade (columns x rows) baseado na quantidade de produtos.
 * A última linha incompleta é preenchida pelo último produto expandindo (colSpan).
 * Prefere layouts mais largos que altos. Max 6 colunas.
 */
export function getAutoGrid(productCount: number): { columns: number; rows: number } {
  if (productCount <= 0) return { columns: 1, rows: 1 }
  if (productCount === 1) return { columns: 1, rows: 1 }
  if (productCount === 2) return { columns: 2, rows: 1 }
  if (productCount === 3) return { columns: 3, rows: 1 }
  if (productCount === 4) return { columns: 2, rows: 2 }

  // For 5+ products, calculate ideal columns based on count
  let cols: number
  if (productCount <= 6) cols = 3
  else if (productCount <= 8) cols = 4
  else if (productCount <= 12) cols = 4
  else if (productCount <= 20) cols = 5
  else cols = 6

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

export interface HighlightLayoutConfig {
  name: string
  productsPerPage: number
  columns: string           // grid-template-columns
  rows: string              // grid-template-rows
  areas: string             // grid-template-areas
  highlightPositions: number[] // quais índices são destaque
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
  // 7 Produtos - 1 destaque esquerdo + 6 normais
  {
    name: '7 Produtos - 1 Dest. Esq.',
    productsPerPage: 7,
    columns: '2fr 1fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"d0 p1 p2" "d0 p3 p4" "p5 p6 p6"',
    highlightPositions: [0],
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
  // 10 Produtos - 2 destaques laterais + 8 normais
  {
    name: '10 Produtos - 2 Dest. Laterais',
    productsPerPage: 10,
    columns: '2fr 1fr 1fr 2fr',
    rows: '1fr 1fr 1fr',
    areas: '"d0 p2 p3 d1" "d0 p4 p5 d1" "p6 p7 p8 p9"',
    highlightPositions: [0, 1],
  },
  // 11 Produtos - 1 destaque esquerdo + 10 normais
  {
    name: '11 Produtos - 1 Dest. Esq.',
    productsPerPage: 11,
    columns: '2fr 1fr 1fr 1fr',
    rows: '1fr 1fr 1fr',
    areas: '"d0 p1 p2 p3" "d0 p4 p5 p6" "p7 p8 p9 p10"',
    highlightPositions: [0],
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
  // 14 Produtos - 2 destaques topo + 12 normais
  {
    name: '14 Produtos - 2 Dest. Topo',
    productsPerPage: 14,
    columns: '1fr 1fr 1fr 1fr',
    rows: '1.4fr 1fr 1fr 1fr',
    areas: '"d0 d0 d1 d1" "p2 p3 p4 p5" "p6 p7 p8 p9" "p10 p11 p12 p13"',
    highlightPositions: [0, 1],
  },
  // 16 Produtos - 4 destaques topo + 12 normais
  {
    name: '16 Produtos - 4 Dest. Topo',
    productsPerPage: 16,
    columns: '1fr 1fr 1fr 1fr',
    rows: '1.4fr 1fr 1fr 1fr',
    areas: '"d0 d1 d2 d3" "p4 p5 p6 p7" "p8 p9 p10 p11" "p12 p13 p14 p15"',
    highlightPositions: [0, 1, 2, 3],
  },
  // 18 Produtos - 4 destaques topo + 14 normais
  {
    name: '18 Produtos - 4 Dest. Topo',
    productsPerPage: 18,
    columns: '1fr 1fr 1fr 1fr 1fr',
    rows: '1.4fr 1fr 1fr 1fr',
    areas: '"d0 d0 d1 d2 d3" "p4 p5 p6 p7 p8" "p9 p10 p11 p12 p13" "p14 p15 p16 p17 p17"',
    highlightPositions: [0, 1, 2, 3],
  },
  // 20 Produtos - 4 destaques topo + 16 normais
  {
    name: '20 Produtos - 4 Dest. Topo',
    productsPerPage: 20,
    columns: '1fr 1fr 1fr 1fr 1fr',
    rows: '1.4fr 1fr 1fr 1fr',
    areas: '"d0 d0 d1 d1 d2" "d2 p3 p4 p5 p6" "p7 p8 p9 p10 p11" "p12 p13 p14 p15 . " "p16 p17 p18 p19 ."',
    highlightPositions: [0, 1, 2],
  },
]

/**
 * Busca o primeiro HighlightLayout que atende EXATAMENTE a quantidade de produtos.
 * Se o primeiro produto tem is_highlight, prefere layouts com destaque esquerdo/topo.
 */
export function getAutoHighlightLayout(productCount: number): HighlightLayoutConfig | null {
  if (productCount < 5) return null
  // Find layouts matching exact product count
  const matches = HIGHLIGHT_LAYOUTS.filter(l => l.productsPerPage === productCount)
  if (matches.length === 0) return null
  // Prefer first match (typically left highlight or top highlight)
  return matches[0]
}

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
  const { layout, products, paginatedProducts, productsPerPage } = useBuilderFlyer()

  // Auto when layout is null OR columns=0 rows=0
  const isAuto = computed(() => !layout.value || isAutoLayout(layout.value))

  // In auto mode, try to use a highlight layout if available for the product count
  const autoHighlightLayout = computed<HighlightLayoutConfig | null>(() => {
    if (!isAuto.value) return null
    const count = paginatedProducts.value.length
    if (count < 5) return null
    // Check if any product has is_highlight flag
    const hasHL = paginatedProducts.value.some(p => p.is_highlight)
    const hl = getAutoHighlightLayout(count)
    if (hl) return hl
    // No exact match — no auto highlight
    return null
  })

  const effectiveGrid = computed(() => {
    if (isAuto.value) {
      if (autoHighlightLayout.value) {
        // Highlight layout defines its own grid
        return {
          columns: autoHighlightLayout.value.columns.split(' ').length,
          rows: autoHighlightLayout.value.rows.split(' ').length,
        }
      }
      const count = paginatedProducts.value.length || productsPerPage.value
      return getAutoGrid(count)
    }
    return {
      columns: layout.value?.columns ?? 3,
      rows: layout.value?.rows ?? 2,
    }
  })

  const effectiveProductsPerPage = computed(() => {
    if (isAuto.value) {
      return products.value.length || 6
    }
    return layout.value?.products_per_page ?? 6
  })

  const hasHighlightLayout = computed(() => {
    // Check manually-set layout first
    const cfg = layout.value?.grid_config
    if (cfg && typeof cfg === 'object' && 'areas' in cfg && cfg.areas) return true
    // Then check auto highlight
    return !!autoHighlightLayout.value
  })

  const highlightGridStyle = computed(() => {
    // Manual layout config takes priority
    const cfg = layout.value?.grid_config
    if (cfg && typeof cfg === 'object' && 'areas' in cfg && cfg.areas) {
      return getGridAreasStyle(cfg as any)
    }
    // Auto highlight layout
    if (autoHighlightLayout.value) {
      return getGridAreasStyle(autoHighlightLayout.value)
    }
    return null
  })

  const autoHighlightPositions = computed<number[]>(() => {
    if (autoHighlightLayout.value) {
      return autoHighlightLayout.value.highlightPositions
    }
    return []
  })

  return {
    isAuto,
    effectiveGrid,
    effectiveProductsPerPage,
    hasHighlightLayout,
    highlightGridStyle,
    autoHighlightPositions,
    getAutoGrid,
    getCellAreaName,
  }
}
