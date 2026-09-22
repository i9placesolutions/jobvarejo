import { describe, it, expect } from 'vitest'
import { captureFormatDynamicContent, restoreFormatDynamicContent, fitFormatProductImages } from '../../utils/quickFormatContent'

describe('conteúdo entre formatos', () => {
  it('preserva edição e visibilidade sem copiar geometria antiga, inclusive após JSON', () => {
    const source = [{ name: 'phone-feed', businessProfileField: 'whatsapp', dynamicUserTextSource: 'quick-user', dynamicUserText: '(64) 99999-1234', quickFieldEnabled: false, left: 100 }]
    const content = JSON.parse(JSON.stringify(captureFormatDynamicContent(source)))
    const target: any = { name: 'phone-story', businessProfileField: 'whatsapp', left: 250, width: 400 }
    restoreFormatDynamicContent([target], content)
    expect(target.dynamicUserText).toBe('(64) 99999-1234')
    expect(target.quickFieldEnabled).toBe(false)
    expect(target.left).toBe(250)
    expect(target.width).toBe(400)
  })
  it('reencaixa imagens duplicadas preservando proporção e composição', () => {
    const image = (x: number, y: number, width: number, height: number): any => ({
      name: 'smart_image', type: 'image', left: x, top: y, width, height, scaleX: 1, scaleY: 1, __manualTransform: true,
      getRelativeCenterPoint() { return { x: this.left, y: this.top } },
      getScaledWidth() { return this.width * this.scaleX }, getScaledHeight() { return this.height * this.scaleY },
      set(values: any) { Object.assign(this, values) }, setPositionByOrigin(point: any) { this.left = point.x; this.top = point.y }
    })
    const images = [image(-25, 0, 50, 50), image(25, 0, 50, 50)]
    const card = { width: 300, height: 500, getObjects: () => images }
    fitFormatProductImages(card, { getObjects: () => [image(0, 30, 200, 160)] })
    expect(images.map(i => i.scaleX)).toEqual([2, 2])
    expect(images.map(i => i.left)).toEqual([-50, 50])
    expect(images.map(i => i.top)).toEqual([30, 30])
    expect(images[0].__manualTransformCardH).toBe(500)
  })
})
