// ============================================================
// Grid Layouts QROfertas - Todos os 36 layouts de card
// ============================================================
// Nomenclatura:
//   2x2: G2_{TOPO-ESQ}_{TOPO-DIR}_{BAIXO-ESQ}_{BAIXO-DIR}
//   1x3 horizontal: H3_{ESQ}_{CENTRO}_{DIR}
//   3x1 vertical: V3_{TOPO}_{MEIO}_{BAIXO}
// Onde: I=IMAGEM, T=TITULO, E=ETIQUETA
// Quando um elemento repete na mesma linha, ele ocupa 2 colunas (span)

export interface GridLayout {
  areas: string
  columns: string
  rows: string
  label: string
  category: '2x2' | '1x3' | '3x1'
}

// Funcao auxiliar: para 1x3 e 3x1, mapeia elemento para variavel CSS de peso
function pesoVar(el: string): string {
  if (el === 'IMAGE') return 'var(--peso-1)'
  if (el === 'ETIQUETA') return 'var(--peso-2)'
  return 'var(--peso-3)' // TITULO
}

// ===================== 2x2 GRID (24 layouts) =====================
// Um elemento ocupa 2 celulas (span), os outros 2 ficam lado a lado
// Colunas: var(--peso-x-primary) var(--peso-x-sec)
// Linhas: var(--peso-y-primary) var(--peso-y-sec)
const cols2x2 = 'var(--peso-x-primary) var(--peso-x-sec)'
const rows2x2 = 'var(--peso-y-primary) var(--peso-y-sec)'

// ===================== MAPA COMPLETO =====================
export const GRID_LAYOUTS: Record<string, GridLayout> = {
  // --- 2x2: TITULO span no topo ---
  'G2_TT_IE': {
    areas: '"TITULO TITULO" "IMAGE ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo topo | Imagem + Etiqueta baixo',
    category: '2x2',
  },
  'G2_TT_EI': {
    areas: '"TITULO TITULO" "ETIQUETA IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo topo | Etiqueta + Imagem baixo',
    category: '2x2',
  },
  // --- 2x2: IMAGE span no topo ---
  'G2_II_TE': {
    areas: '"IMAGE IMAGE" "TITULO ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem topo | Titulo + Etiqueta baixo',
    category: '2x2',
  },
  'G2_II_ET': {
    areas: '"IMAGE IMAGE" "ETIQUETA TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem topo | Etiqueta + Titulo baixo',
    category: '2x2',
  },
  // --- 2x2: ETIQUETA span no topo ---
  'G2_EE_IT': {
    areas: '"ETIQUETA ETIQUETA" "IMAGE TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta topo | Imagem + Titulo baixo',
    category: '2x2',
  },
  'G2_EE_TI': {
    areas: '"ETIQUETA ETIQUETA" "TITULO IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta topo | Titulo + Imagem baixo',
    category: '2x2',
  },
  // --- 2x2: TITULO span no baixo ---
  'G2_IE_TT': {
    areas: '"IMAGE ETIQUETA" "TITULO TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem + Etiqueta topo | Titulo baixo',
    category: '2x2',
  },
  'G2_EI_TT': {
    areas: '"ETIQUETA IMAGE" "TITULO TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta + Imagem topo | Titulo baixo',
    category: '2x2',
  },
  // --- 2x2: IMAGE span no baixo ---
  'G2_TE_II': {
    areas: '"TITULO ETIQUETA" "IMAGE IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo + Etiqueta topo | Imagem baixo',
    category: '2x2',
  },
  'G2_ET_II': {
    areas: '"ETIQUETA TITULO" "IMAGE IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta + Titulo topo | Imagem baixo',
    category: '2x2',
  },
  // --- 2x2: ETIQUETA span no baixo ---
  'G2_IT_EE': {
    areas: '"IMAGE TITULO" "ETIQUETA ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem + Titulo topo | Etiqueta baixo',
    category: '2x2',
  },
  'G2_TI_EE': {
    areas: '"TITULO IMAGE" "ETIQUETA ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo + Imagem topo | Etiqueta baixo',
    category: '2x2',
  },
  // --- 2x2: TITULO span na esquerda ---
  'G2_TI_TE': {
    areas: '"TITULO IMAGE" "TITULO ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo esq | Imagem + Etiqueta dir',
    category: '2x2',
  },
  'G2_TE_TI': {
    areas: '"TITULO ETIQUETA" "TITULO IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo esq | Etiqueta + Imagem dir',
    category: '2x2',
  },
  // --- 2x2: IMAGE span na esquerda ---
  'G2_IT_IE': {
    areas: '"IMAGE TITULO" "IMAGE ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem esq | Titulo + Etiqueta dir',
    category: '2x2',
  },
  'G2_IE_IT': {
    areas: '"IMAGE ETIQUETA" "IMAGE TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem esq | Etiqueta + Titulo dir',
    category: '2x2',
  },
  // --- 2x2: ETIQUETA span na esquerda ---
  'G2_ET_EI': {
    areas: '"ETIQUETA TITULO" "ETIQUETA IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta esq | Titulo + Imagem dir',
    category: '2x2',
  },
  'G2_EI_ET': {
    areas: '"ETIQUETA IMAGE" "ETIQUETA TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta esq | Imagem + Titulo dir',
    category: '2x2',
  },
  // --- 2x2: TITULO span na direita ---
  'G2_IT_ET': {
    areas: '"IMAGE TITULO" "ETIQUETA TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem + Etiqueta esq | Titulo dir',
    category: '2x2',
  },
  'G2_ET_IT': {
    areas: '"ETIQUETA TITULO" "IMAGE TITULO"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta + Imagem esq | Titulo dir',
    category: '2x2',
  },
  // --- 2x2: IMAGE span na direita ---
  'G2_TI_EI': {
    areas: '"TITULO IMAGE" "ETIQUETA IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo + Etiqueta esq | Imagem dir',
    category: '2x2',
  },
  'G2_EI_TI': {
    areas: '"ETIQUETA IMAGE" "TITULO IMAGE"',
    columns: cols2x2, rows: rows2x2,
    label: 'Etiqueta + Titulo esq | Imagem dir',
    category: '2x2',
  },
  // --- 2x2: ETIQUETA span na direita ---
  'G2_TE_IE': {
    areas: '"TITULO ETIQUETA" "IMAGE ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Titulo + Imagem esq | Etiqueta dir',
    category: '2x2',
  },
  'G2_IE_TE': {
    areas: '"IMAGE ETIQUETA" "TITULO ETIQUETA"',
    columns: cols2x2, rows: rows2x2,
    label: 'Imagem + Titulo esq | Etiqueta dir',
    category: '2x2',
  },

  // ===================== 1x3 HORIZONTAL (6 layouts) =====================
  'H3_ITE': {
    areas: '"IMAGE TITULO ETIQUETA"',
    columns: `${pesoVar('IMAGE')} ${pesoVar('TITULO')} ${pesoVar('ETIQUETA')}`,
    rows: '100%',
    label: 'Horizontal: Imagem | Titulo | Etiqueta',
    category: '1x3',
  },
  'H3_IET': {
    areas: '"IMAGE ETIQUETA TITULO"',
    columns: `${pesoVar('IMAGE')} ${pesoVar('ETIQUETA')} ${pesoVar('TITULO')}`,
    rows: '100%',
    label: 'Horizontal: Imagem | Etiqueta | Titulo',
    category: '1x3',
  },
  'H3_TIE': {
    areas: '"TITULO IMAGE ETIQUETA"',
    columns: `${pesoVar('TITULO')} ${pesoVar('IMAGE')} ${pesoVar('ETIQUETA')}`,
    rows: '100%',
    label: 'Horizontal: Titulo | Imagem | Etiqueta',
    category: '1x3',
  },
  'H3_TEI': {
    areas: '"TITULO ETIQUETA IMAGE"',
    columns: `${pesoVar('TITULO')} ${pesoVar('ETIQUETA')} ${pesoVar('IMAGE')}`,
    rows: '100%',
    label: 'Horizontal: Titulo | Etiqueta | Imagem',
    category: '1x3',
  },
  'H3_EIT': {
    areas: '"ETIQUETA IMAGE TITULO"',
    columns: `${pesoVar('ETIQUETA')} ${pesoVar('IMAGE')} ${pesoVar('TITULO')}`,
    rows: '100%',
    label: 'Horizontal: Etiqueta | Imagem | Titulo',
    category: '1x3',
  },
  'H3_ETI': {
    areas: '"ETIQUETA TITULO IMAGE"',
    columns: `${pesoVar('ETIQUETA')} ${pesoVar('TITULO')} ${pesoVar('IMAGE')}`,
    rows: '100%',
    label: 'Horizontal: Etiqueta | Titulo | Imagem',
    category: '1x3',
  },

  // ===================== 3x1 VERTICAL (6 layouts) =====================
  'V3_TIE': {
    areas: '"TITULO" "IMAGE" "ETIQUETA"',
    columns: '1fr',
    rows: `${pesoVar('TITULO')} ${pesoVar('IMAGE')} ${pesoVar('ETIQUETA')}`,
    label: 'Vertical: Titulo | Imagem | Etiqueta',
    category: '3x1',
  },
  'V3_TEI': {
    areas: '"TITULO" "ETIQUETA" "IMAGE"',
    columns: '1fr',
    rows: `${pesoVar('TITULO')} ${pesoVar('ETIQUETA')} ${pesoVar('IMAGE')}`,
    label: 'Vertical: Titulo | Etiqueta | Imagem',
    category: '3x1',
  },
  'V3_ITE': {
    areas: '"IMAGE" "TITULO" "ETIQUETA"',
    columns: '1fr',
    rows: `${pesoVar('IMAGE')} ${pesoVar('TITULO')} ${pesoVar('ETIQUETA')}`,
    label: 'Vertical: Imagem | Titulo | Etiqueta',
    category: '3x1',
  },
  'V3_IET': {
    areas: '"IMAGE" "ETIQUETA" "TITULO"',
    columns: '1fr',
    rows: `${pesoVar('IMAGE')} ${pesoVar('ETIQUETA')} ${pesoVar('TITULO')}`,
    label: 'Vertical: Imagem | Etiqueta | Titulo',
    category: '3x1',
  },
  'V3_EIT': {
    areas: '"ETIQUETA" "IMAGE" "TITULO"',
    columns: '1fr',
    rows: `${pesoVar('ETIQUETA')} ${pesoVar('IMAGE')} ${pesoVar('TITULO')}`,
    label: 'Vertical: Etiqueta | Imagem | Titulo',
    category: '3x1',
  },
  'V3_ETI': {
    areas: '"ETIQUETA" "TITULO" "IMAGE"',
    columns: '1fr',
    rows: `${pesoVar('ETIQUETA')} ${pesoVar('TITULO')} ${pesoVar('IMAGE')}`,
    label: 'Vertical: Etiqueta | Titulo | Imagem',
    category: '3x1',
  },
}

// Aliases para compatibilidade com nomes antigos
export const CONTENT_TYPE_ALIASES: Record<string, string> = {
  'CONTENT_LINE': 'V3_TIE',
  'CONTENT_ROW_BOTTOM': 'G2_TT_IE',
  'CONTENT_COL_ETIQUETA_TITULO': 'G2_IT_IE',
}

// Resolver contentType: retorna a chave canonica do layout
export function resolveContentType(ct: string): string {
  return CONTENT_TYPE_ALIASES[ct] || ct
}

// Retorna layout options agrupados por categoria (para o select do sidebar)
export function getLayoutOptions(): { label: string; options: { value: string; label: string }[] }[] {
  const groups: Record<string, { value: string; label: string }[]> = {
    '2x2': [],
    '1x3': [],
    '3x1': [],
  }
  for (const [key, layout] of Object.entries(GRID_LAYOUTS)) {
    groups[layout.category].push({ value: key, label: layout.label })
  }
  return [
    { label: 'Grade 2x2 (elemento com span)', options: groups['2x2'] },
    { label: 'Horizontal 1x3', options: groups['1x3'] },
    { label: 'Vertical 3x1', options: groups['3x1'] },
  ]
}
