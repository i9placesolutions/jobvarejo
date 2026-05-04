export const MOBILE_PANELS = ['tools', 'layers', 'properties', 'pages', 'uploads', 'more'] as const

export type MobilePanel = typeof MOBILE_PANELS[number]

const MOBILE_PANEL_TITLES: Record<MobilePanel, string> = {
  tools: 'Ferramentas',
  layers: 'Camadas',
  properties: 'Propriedades',
  pages: 'Páginas',
  uploads: 'Imagens',
  more: 'Mais'
}

export const isMobilePanel = (value: unknown): value is MobilePanel =>
  typeof value === 'string' && (MOBILE_PANELS as readonly string[]).includes(value)

export const getMobilePanelTitle = (panel: MobilePanel | null | undefined): string =>
  panel && isMobilePanel(panel) ? MOBILE_PANEL_TITLES[panel] : MOBILE_PANEL_TITLES.more
