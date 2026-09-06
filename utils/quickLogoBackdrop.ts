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
 * Projetos antigos não tinham esse campo; o quadrado mantém a placa clara
 * existente até que o usuário escolha outra opção.
 */
export const normalizeQuickLogoBackdropMode = (
  value: unknown,
  fallback: QuickLogoBackdropMode = 'square'
): QuickLogoBackdropMode => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'none' || raw === 'transparent' || raw === 'sem fundo' || raw === 'sem-fundo') return 'none'
  if (raw === 'square' || raw === 'quadrado' || raw === 'rectangle' || raw === 'rect' || raw === 'rounded') return 'square'
  if (raw === 'round' || raw === 'circle' || raw === 'circular' || raw === 'redondo') return 'round'
  if (raw === 'oval' || raw === 'ellipse' || raw === 'elipse') return 'oval'
  return fallback
}
