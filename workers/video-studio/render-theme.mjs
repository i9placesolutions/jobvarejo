export function assertRenderTheme(theme, catalog) {
  const available = typeof theme === 'string'
    && Array.isArray(catalog)
    && catalog.some(entry => (typeof entry === 'string' ? entry : entry?.id) === theme)

  if (!available) {
    const label = typeof theme === 'string' && theme.length > 0 ? ` "${theme}"` : ''
    throw new Error(`O modelo de vídeo${label} não está disponível neste renderizador. Atualize o worker para incluir esse modelo e tente novamente.`)
  }

  return theme
}
