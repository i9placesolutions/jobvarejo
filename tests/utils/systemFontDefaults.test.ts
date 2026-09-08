import { describe, expect, it } from 'vitest'
import {
  AVAILABLE_FONT_FAMILIES,
  DEFAULT_EDITOR_FONT_FAMILY
} from '~/utils/font-catalog'
import {
  DEFAULT_GLOBAL_STYLES,
  DEFAULT_SPLASH
} from '~/types/product-zone'
import { createDefaultSplash } from '~/utils/product-zone-helpers'

describe('fontes padrão do editor', () => {
  it('usa Barlow como primeira opção e fonte padrão de novos cards', () => {
    expect(DEFAULT_EDITOR_FONT_FAMILY).toBe('Barlow')
    expect(AVAILABLE_FONT_FAMILIES[0]).toBe(DEFAULT_EDITOR_FONT_FAMILY)
    expect(DEFAULT_GLOBAL_STYLES.prodNameFont).toBe(DEFAULT_EDITOR_FONT_FAMILY)
    expect(DEFAULT_GLOBAL_STYLES.priceFont).toBe(DEFAULT_EDITOR_FONT_FAMILY)
  })

  it('usa Barlow nas etiquetas novas sem alterar fontes explícitas existentes', () => {
    expect(DEFAULT_SPLASH.fontFamily).toBe(DEFAULT_EDITOR_FONT_FAMILY)
    expect(createDefaultSplash('produto-1').fontFamily).toBe(DEFAULT_EDITOR_FONT_FAMILY)
  })
})
