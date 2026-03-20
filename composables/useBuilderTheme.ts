import type { BuilderFontConfig } from '~/types/builder'

export const useBuilderTheme = () => {
  const { theme } = useBuilderFlyer()
  const loadedFonts = useState<Set<string>>('builder-loaded-fonts', () => new Set())

  const loadGoogleFont = (url: string, family: string) => {
    if (!import.meta.client) return
    if (loadedFonts.value.has(family)) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
    loadedFonts.value.add(family)
  }

  const loadFont = (fontConfig: Pick<BuilderFontConfig, 'family' | 'google_url'>) => {
    if (fontConfig.google_url) {
      loadGoogleFont(fontConfig.google_url, fontConfig.family)
    }
  }

  // Watch theme changes and auto-load fonts
  watch(theme, (newTheme) => {
    if (!newTheme) return

    // If theme has font info in css_config or related font configs, load them
    const fontConfig = (newTheme as any).font_config as BuilderFontConfig | undefined
    if (fontConfig?.google_url && fontConfig?.family) {
      loadGoogleFont(fontConfig.google_url, fontConfig.family)
    }
  }, { immediate: true })

  return { loadGoogleFont, loadFont, loadedFonts }
}
