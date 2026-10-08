import { describe, expect, it } from 'vitest'
import { catalogFontFaceFromFile } from '../../server/utils/catalog-preview-draw'

describe('catalogFontFaceFromFile', () => {
  it('registra o nome com espaço usado nos modelos e o nome do arquivo', () => {
    expect(catalogFontFaceFromFile('BarlowCondensed-ExtraBold.ttf')).toEqual({ families: ['Barlow Condensed', 'BarlowCondensed'], weight: '800', style: 'normal' })
    expect(catalogFontFaceFromFile('FiraSans-SemiBoldItalic.ttf')).toEqual({ families: ['Fira Sans', 'FiraSans'], weight: '600', style: 'italic' })
  })

  it('mapeia Black para 900 e mantém nomes de uma palavra', () => {
    expect(catalogFontFaceFromFile('Barlow-Black.ttf')).toEqual({ families: ['Barlow'], weight: '900', style: 'normal' })
    expect(catalogFontFaceFromFile('Barlow-ExtraLight.ttf').weight).toBe('200')
  })

  it('aceita fontes variáveis sem variante no nome', () => {
    expect(catalogFontFaceFromFile('Montserrat[wght].ttf')).toEqual({ families: ['Montserrat'], weight: '400', style: 'normal' })
    expect(catalogFontFaceFromFile('RobotoSlab[wght].ttf').families).toEqual(['Roboto Slab', 'RobotoSlab'])
  })
})
