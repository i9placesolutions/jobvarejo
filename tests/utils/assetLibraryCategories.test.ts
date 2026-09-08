import { describe, expect, it } from 'vitest'
import { ASSET_LIBRARY_CATEGORIES, categoryFromAssetKey, getAssetLibraryCategory } from '../../utils/assetLibraryCategories'
describe('biblioteca de assets', () => {
  it('reconhece todas as categorias canônicas', () => {
    for (const c of ASSET_LIBRARY_CATEGORIES) {
      expect(categoryFromAssetKey(c.prefix + 'imagem.webp')).toBe(c.id)
      expect(getAssetLibraryCategory(c.id)?.prefix).toBe(c.prefix)
    }
    expect(getAssetLibraryCategory('../projects')).toBeUndefined()
  })
  it('reconhece pastas antigas sem adivinhar por nome do arquivo', () => {
    expect(categoryFromAssetKey('Marcas/mercado.png')).toBe('logos')
    expect(categoryFromAssetKey('Selo 3d/asset.webp')).toBe('selos')
    expect(categoryFromAssetKey('Texturas/asset.png')).toBe('fundos')
    expect(categoryFromAssetKey('imagens/pessoas/a.webp')).toBe('pessoas')
    expect(categoryFromAssetKey('imagens/selo-leite.png')).toBeNull()
    expect(categoryFromAssetKey('projects/u/p/canvas.json')).toBeNull()
  })
})
