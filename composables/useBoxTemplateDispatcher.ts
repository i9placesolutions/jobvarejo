// ============================================================================
// useBoxTemplateDispatcher — Dispatcher de familia de template por celula
// ============================================================================
// Decide qual familia de template usar para UM box de produto, baseado no
// tamanho real da celula e se ela e destaque. As familias sao:
//
//   hero     — celula grande, imagem full-bleed + nome sobreposto + tag gigante
//   split    — celula media-grande paisagem, imagem esquerda + texto/preco direita
//   vertical — celula media retrato, nome topo + imagem meio + preco rodape
//   compact  — celula pequena, split horizontal 40/60 compactado
//   table    — sem imagem, linha horizontal (grade em modo tabela)
//
// A fase 1 do brief mapeia cada familia para um cardLayout ja existente:
//
//   hero     → 'classico'  (ate o template Hero dedicado ser criado)
//   split    → 'lateral'
//   vertical → 'premium'
//   compact  → 'compacto'
//   table    → 'mini'      (placeholder ate <BuilderFlyerProductTable> existir)
// ============================================================================

export type BoxTemplateFamily = 'hero' | 'split' | 'vertical' | 'compact' | 'table'

export interface DispatchInput {
  cellWidth: number
  cellHeight: number
  isHighlight: boolean
  isTableMode?: boolean
  columns?: number
}

// Limiares em pixels. Sao aproximados e calibrados empiricamente.
// Uma celula > 520px no menor lado conta como "hero" (grade 1x1, destaques
// grandes). Entre 280 e 520, decidimos entre split/vertical por aspect ratio.
// Abaixo de 280 e sempre compact.
const HERO_MIN_SIDE = 520
const COMPACT_MAX_SIDE = 280

export function dispatchBoxTemplate(input: DispatchInput): BoxTemplateFamily {
  if (input.isTableMode) return 'table'

  const w = Math.max(0, input.cellWidth || 0)
  const h = Math.max(0, input.cellHeight || 0)
  const minSide = Math.min(w, h)
  const aspect = h > 0 ? w / h : 1

  if (input.isHighlight && minSide >= HERO_MIN_SIDE * 0.7) return 'hero'
  if (minSide >= HERO_MIN_SIDE) return 'hero'
  if (minSide < COMPACT_MAX_SIDE) return 'compact'

  // Paisagem (larga e baixa) → split horizontal 50/50
  // Retrato (alta e estreita) → vertical empilhado
  return aspect >= 1.1 ? 'split' : 'vertical'
}

const FAMILY_TO_CARD_LAYOUT: Record<BoxTemplateFamily, string> = {
  hero: 'classico',
  split: 'lateral',
  vertical: 'premium',
  compact: 'compacto',
  table: 'mini',
}

export function familyToCardLayout(family: BoxTemplateFamily): string {
  return FAMILY_TO_CARD_LAYOUT[family]
}

// Helper reativo: retorna o cardLayout em funcao de refs de tamanho/destaque.
// Use dentro de componentes com `const layout = useBoxTemplateDispatcher(...)`.
export function useBoxTemplateDispatcher(
  cellWidth: Ref<number> | ComputedRef<number>,
  cellHeight: Ref<number> | ComputedRef<number>,
  isHighlight: Ref<boolean> | ComputedRef<boolean>,
  opts?: { tableMode?: Ref<boolean> | ComputedRef<boolean>; columns?: Ref<number> | ComputedRef<number> },
) {
  const family = computed<BoxTemplateFamily>(() =>
    dispatchBoxTemplate({
      cellWidth: cellWidth.value,
      cellHeight: cellHeight.value,
      isHighlight: isHighlight.value,
      isTableMode: opts?.tableMode?.value ?? false,
      columns: opts?.columns?.value,
    }),
  )
  const cardLayout = computed(() => familyToCardLayout(family.value))
  return { family, cardLayout }
}
