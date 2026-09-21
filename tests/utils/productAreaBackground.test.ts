import { describe, expect, it } from 'vitest'
import { normalizeProductAreaBackgrounds } from '../../utils/productAreaBackground'
import { CANVAS_CUSTOM_PROPS } from '../../utils/canvasCustomProps'

describe('fundo da área de produtos', () => {
  it.each(['#fff', '#FFFFFF', 'white', 'rgb(255, 255, 255)', 'rgba(255,255,255,1)'])('remove painel legado %s sem tocar nos cards', fill => {
    const panel = { type: 'Rect', name: 'product-area-background', fill, stroke: '#ccc', shadow: {} }
    const card = { type: 'Rect', name: 'background', fill }
    const canvas = { objects: [{ type: 'Group', objects: [panel, card] }] }
    expect(normalizeProductAreaBackgrounds(canvas)).toBe(1)
    expect(panel).toMatchObject({ fill: 'transparent', stroke: 'transparent', shadow: null })
    expect(card.fill).toBe(fill)
    expect(normalizeProductAreaBackgrounds(JSON.parse(JSON.stringify(canvas)))).toBe(0)
  })
  it('preserva cores, branco escolhido manualmente, imagens e frames', () => {
    const objects = [
      { type: 'Rect', fill: '#fff', productAreaBackgroundMode: 'custom' },
      { type: 'Rect', fill: '#fef3e2' },
      { type: 'Image', fill: '#fff' },
      { type: 'Rect', fill: '#fff', isFrame: true }
    ].map(o => ({ ...o, name: 'product-area-background' }))
    const before = JSON.stringify(objects)
    expect(normalizeProductAreaBackgrounds({ objects })).toBe(0)
    expect(JSON.stringify(objects)).toBe(before)
    expect(CANVAS_CUSTOM_PROPS).toContain('productAreaBackgroundMode')
  })
})
