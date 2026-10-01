import { describe, expect, it } from 'vitest'
import { patchInactiveCardLabels } from '~/utils/inactiveCardLabelPatch'

describe('patchInactiveCardLabels', () => {
  it('preserva todos os elementos e posições salvo o conteúdo da etiqueta', () => {
    const original: any = { objects: [{ _customId: 'card', left: 800, top: 1200, width: 300, objects: [
      { name: 'smart_image', left: -70, top: -40, src: 'produto.png' },
      { name: 'smart_title', left: 20, top: -100, text: 'Produto' },
      { name: 'priceGroup', left: 40, top: 90, width: 200, height: 80, scaleX: 1, scaleY: 1, originX: 'center', angle: 5 }
    ] }, { name: 'footer', left: 500, top: 1900 }] }
    const changed = patchInactiveCardLabels(original, new Map([['card', { templateId: 'nova', label: { name: 'priceGroup', width: 100, height: 40, left: 999, top: 999, objects: [{ text: '26,99' }] } }]]))
    expect(changed.objects[0].left).toBe(800)
    expect(changed.objects[0].top).toBe(1200)
    expect(changed.objects[0].objects.slice(0, 2)).toEqual(original.objects[0].objects!.slice(0, 2))
    expect(changed.objects[1]).toEqual(original.objects[1])
    expect(changed.objects[0].objects[2]).toMatchObject({ left: 40, top: 90, scaleX: 2, scaleY: 2, angle: 5 })
    expect(original.objects[0].objects![2].width).toBe(200)
  })
})
