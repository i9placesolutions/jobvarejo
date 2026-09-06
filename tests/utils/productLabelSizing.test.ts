import { describe, expect, it } from 'vitest'
import { fitProductPriceLabelToImage } from '~/utils/productLabelSizing'

const makeObject = (width: number, scale = 1) => ({
  width,
  height: 40,
  scaleX: scale,
  scaleY: scale,
  visible: true,
  set(values: Record<string, any>) { Object.assign(this, values) },
  getScaledWidth() { return this.width * Math.abs(this.scaleX || 1) },
  getScaledHeight() { return this.height * Math.abs(this.scaleY || 1) },
  setCoords() {}
})

describe('fitProductPriceLabelToImage', () => {
  it('aumenta e reduz a etiqueta conforme a largura visual da imagem', () => {
    const label: any = makeObject(160)
    const wideImage: any = makeObject(280)
    const narrowImage: any = makeObject(120)

    expect(fitProductPriceLabelToImage(label, wideImage, 320, 220)).toBe(true)
    const wideLabelWidth = label.getScaledWidth()
    expect(wideLabelWidth).toBeCloseTo(229.6, 1)

    expect(fitProductPriceLabelToImage(label, narrowImage, 320, 220)).toBe(true)
    expect(label.getScaledWidth()).toBeCloseTo(98.4, 1)
    // A second pass does not keep accumulating scale.
    expect(fitProductPriceLabelToImage(label, narrowImage, 320, 220)).toBe(false)
  })

  it('mantem piso legivel e respeita escala manual do usuario', () => {
    const narrowLabel: any = makeObject(180)
    const tinyImage: any = makeObject(20)
    expect(fitProductPriceLabelToImage(narrowLabel, tinyImage, 320, 220)).toBe(true)
    expect(narrowLabel.getScaledWidth()).toBeCloseTo(89.6, 1)

    const manualLabel: any = makeObject(180)
    manualLabel.__manualScaleX = 1.25
    expect(fitProductPriceLabelToImage(manualLabel, tinyImage, 320, 220)).toBe(false)
    expect(manualLabel.scaleX).toBe(1)
  })
})
