import { describe, expect, it } from 'vitest'
import { artForSize, artHasOrientation, blankArt } from '~/utils/art-studio/composition'

describe('Formatos publicados no catálogo', () => {
  const source = () => ({ ...blankArt(), alternates: [
    { ...blankArt(), width: 1080, height: 1080, background: '#ff0000' },
    { ...blankArt(), width: 1920, height: 1080, background: '#0000ff' }
  ] })
  it('mostra a montagem específica sem alterar o modelo', () => {
    const doc = source()
    const result = artForSize(doc, 1080, 1080)
    expect(result.background).toBe('#ff0000')
    expect(result.alternates).toBeUndefined()
    result.background = '#ffffff'
    expect(doc.alternates[0]!.background).toBe('#ff0000')
  })
  it('filtra também pelos formatos alternativos', () => {
    for (const orientation of ['all', 'square', 'portrait', 'landscape']) {
      expect(artHasOrientation(source(), orientation)).toBe(true)
    }
    expect(artHasOrientation(blankArt(), 'square')).toBe(false)
  })
  it('adapta dimensões apenas quando não há montagem salva', () => {
    const result = artForSize(source(), 794, 1123)
    expect([result.width, result.height]).toEqual([794, 1123])
    expect(result.background).toBe(blankArt().background)
    expect(result.alternates).toBeUndefined()
  })
})
