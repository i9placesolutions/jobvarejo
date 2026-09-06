import { describe, expect, it } from 'vitest'
import { replaceProductImageCopies } from '~/utils/productImageComposition'

const image = (id: string, src = '/api/storage/proxy?key=products%2Frice.png') => ({
  type: 'image', name: 'smart_image', _customId: id, src,
  width: 100, height: 200, scaleX: 0.8, scaleY: 0.5,
  left: 20, top: -15, angle: 12, flipX: true,
  setElement(element: any) { this.element = element; this.width = 999; this.height = 999 },
  element: null as any,
  set(props: any) { Object.assign(this, props) }
})
const replacement = { width: 200, height: 400, cropX: 8, cropY: 12, getElement: () => 'new texture' }

describe('replaceProductImageCopies', () => {
  it('troca todas as cópias mantendo IDs, posições, rotação e tamanho visual', () => {
    const first = image('one'), copy = image('two')
    copy.left = 70
    const card = { width: 300, height: 300, getObjects: () => [first, copy] }
    expect(replaceProductImageCopies(card, copy, replacement, '/new.png')).toEqual([first, copy])
    for (const img of [first, copy]) {
      expect(img.width * img.scaleX).toBe(80)
      expect(img.height * img.scaleY).toBe(100)
      expect(img).toMatchObject({ src: '/new.png', __originalSrc: '/new.png', angle: 12, top: -15, flipX: true, cropX: 8, cropY: 12, __manualTransform: true })
    }
    expect([first._customId, copy._customId, first.left, copy.left]).toEqual(['one', 'two', 20, 70])
  })
  it('não troca imagens diferentes, fundos da etiqueta nem outro card', () => {
    const first = image('one'), other = image('other', '/beans.png'), label = image('label')
    label.name = 'label_bg_image'
    const unrelated = image('unrelated')
    const card = { width: 300, height: 300, getObjects: () => [first, other, label] }
    expect(replaceProductImageCopies(card, first, replacement, '/new.png')).toEqual([first])
    expect(other.src).toBe('/beans.png')
    expect(label.src).toContain('rice')
    expect(unrelated.src).toContain('rice')
  })
})
