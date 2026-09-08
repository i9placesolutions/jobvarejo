export type QuickLogoBackdropMode = 'none' | 'square' | 'round' | 'oval'

export const QUICK_LOGO_BACKDROP_OPTIONS: ReadonlyArray<{
  id: QuickLogoBackdropMode
  label: string
}> = [
  { id: 'none', label: 'Sem fundo' },
  { id: 'square', label: 'Quadrado' },
  { id: 'round', label: 'Redondo' },
  { id: 'oval', label: 'Oval' }
]

/**
 * Normaliza o formato persistido do fundo da logo.
 * Projetos sem esse campo usam "sem fundo", que é o padrão comercial da
 * logo dinâmica. Fundo, borda e contorno sticker continuam escolhas
 * explícitas do cliente no painel de propriedades.
 */
export const normalizeQuickLogoBackdropMode = (
  value: unknown,
  fallback: QuickLogoBackdropMode = 'none'
): QuickLogoBackdropMode => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'none' || raw === 'transparent' || raw === 'sem fundo' || raw === 'sem-fundo') return 'none'
  if (raw === 'square' || raw === 'quadrado' || raw === 'rectangle' || raw === 'rect' || raw === 'rounded') return 'square'
  if (raw === 'round' || raw === 'circle' || raw === 'circular' || raw === 'redondo') return 'round'
  if (raw === 'oval' || raw === 'ellipse' || raw === 'elipse') return 'oval'
  return fallback
}
