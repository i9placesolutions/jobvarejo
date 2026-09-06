import { describe, expect, it } from 'vitest'
import { layoutCustomPriceGroup } from '~/utils/priceCustomTemplateLayout'

const withFakeImageData = (width: number, height: number, data: Uint8ClampedArray, run: () => void) => {
  const originalDocument = (globalThis as any).document
  ;(globalThis as any).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        clearRect() {},
        drawImage() {},
        getImageData: () => ({ data })
      })
    })
  }
  try {
    run()
  } finally {
    ;(globalThis as any).document = originalDocument
  }
}

describe('layoutCustomPriceGroup', () => {
  it('mantem o crop baseado no conteudo visivel da imagem de fundo', () => {
    const width = 100
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 10; y < 90; y += 1) {
      for (let x = 20; x < 80; x += 1) {
        data[(y * width + x) * 4 + 3] = 255
      }
    }

    const image: any = {
      type: 'image',
      name: 'price_bg_image',
      width,
      height,
      cropX: 0,
      cropY: 0,
      _element: { naturalWidth: width, naturalHeight: height },
      set(props: any) { Object.assign(this, props) }
    }
    const priceBg: any = {
      type: 'rect',
      name: 'price_bg',
      width: 200,
      height: 100,
      __originalWidth: 200,
      __originalHeight: 100,
      set(props: any) { Object.assign(this, props) }
    }
    const group: any = {
      width: 200,
      height: 100,
      getObjects: () => [priceBg, image],
      set(props: any) { Object.assign(this, props) }
    }

    withFakeImageData(width, height, data, () => {
      layoutCustomPriceGroup(group, 400, 200, {
        fabric: {},
        getSinglePriceCurrencyTextCandidate: () => null,
        ensureSinglePriceCurrencyCircleAnchor: () => null,
        isTextLikeObject: () => false,
        constrainSinglePriceTextInsideBackground: () => {}
      })
    })

    expect(image.cropX).toBe(20)
    expect(image.cropY).toBe(35)
    expect(image.width).toBe(60)
    expect(image.height).toBe(30)
    expect(image.scaleX).toBeCloseTo(112 / 60)
    expect(image.scaleY).toBeCloseTo(112 / 60)
  })
})
