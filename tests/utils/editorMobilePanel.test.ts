import { describe, expect, it } from 'vitest'
import {
  getMobilePanelTitle,
  isMobilePanel,
  MOBILE_PANELS,
  type MobilePanel
} from '~/utils/editorMobilePanel'

describe('editorMobilePanel', () => {
  it('valida apenas paineis mobile conhecidos', () => {
    for (const panel of MOBILE_PANELS) {
      expect(isMobilePanel(panel)).toBe(true)
    }

    expect(isMobilePanel('invalid')).toBe(false)
    expect(isMobilePanel('')).toBe(false)
    expect(isMobilePanel(null)).toBe(false)
  })

  it('resolve titulos dos paineis e usa Mais como fallback', () => {
    const titles: Record<MobilePanel, string> = {
      tools: 'Ferramentas',
      layers: 'Camadas',
      properties: 'Propriedades',
      pages: 'Páginas',
      uploads: 'Imagens',
      more: 'Mais'
    }

    for (const [panel, title] of Object.entries(titles) as Array<[MobilePanel, string]>) {
      expect(getMobilePanelTitle(panel)).toBe(title)
    }

    expect(getMobilePanelTitle(null)).toBe('Mais')
    expect(getMobilePanelTitle(undefined)).toBe('Mais')
  })
})
