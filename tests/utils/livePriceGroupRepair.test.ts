import { describe, it, expect } from 'vitest'
import { repairLivePriceGroupBackgrounds } from '~/utils/livePriceGroupRepair'

const mkChild = (props: any = {}) => {
  const c: any = {
    visible: true,
    dirty: false,
    set(k: any, v?: any) {
      if (typeof k === 'object') Object.assign(c, k)
      else c[k] = v
    },
    setCoords() {},
    ...props
  }
  return c
}

const mkGroup = (children: any[], props: any = {}) => {
  const g: any = {
    type: 'group',
    visible: true,
    dirty: false,
    getObjects: () => children,
    set(k: any, v?: any) {
      if (typeof k === 'object') Object.assign(g, k)
      else g[k] = v
    },
    add(o: any) { children.push(o) },
    remove(o: any) {
      const idx = children.indexOf(o)
      if (idx >= 0) children.splice(idx, 1)
    },
    ...props
  }
  return g
}

describe('repairLivePriceGroupBackgrounds', () => {
  it('null/non-canvas: 0', () => {
    expect(repairLivePriceGroupBackgrounds(null)).toBe(0)
    expect(repairLivePriceGroupBackgrounds({})).toBe(0)
  })

  it('canvas sem product cards: 0', () => {
    const canvas = mkGroup([mkChild({ type: 'rect' })])
    expect(repairLivePriceGroupBackgrounds(canvas)).toBe(0)
  })

  it('renomeia bg image generica para splash_image', () => {
    const bgImage = mkChild({ type: 'image', name: 'custom_image_123', src: 'http://example.com/a.jpg' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text', text: '99' })
    const pg = mkGroup([bgImage, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    const result = repairLivePriceGroupBackgrounds(canvas)
    expect(result).toBeGreaterThan(0)
    expect(bgImage.name).toBe('splash_image')
  })

  it('preserva __originalSrc quando renomeia', () => {
    const bgImage = mkChild({ type: 'image', name: '', src: 'http://example.com/a.jpg' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([bgImage, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(bgImage.__originalSrc).toBe('http://example.com/a.jpg')
  })

  it('reativa visibilidade de price_bg oculto', () => {
    const bg = mkChild({ type: 'rect', name: 'price_bg', visible: false, fill: '#abc' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([bg, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(bg.visible).toBe(true)
  })

  it('repara price_bg com fill transparent quando nao ha bg image', () => {
    const bg = mkChild({ type: 'rect', name: 'price_bg', fill: 'transparent' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([bg, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(bg.fill).toBe('#000000')
  })

  it('preserva __originalFill quando reparando price_bg', () => {
    const bg = mkChild({ type: 'rect', name: 'price_bg', fill: '#abc', __originalFill: '#abc' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([bg, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(bg.__originalFill).toBe('#abc')
    expect(bg.fill).toBe('#abc')
  })

  it('grava __originalFill quando ainda nao salvou', () => {
    const bg = mkChild({ type: 'rect', name: 'price_bg', fill: '#abcdef' })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([bg, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(bg.__originalFill).toBe('#abcdef')
  })

  it('NAO repara card sem texto visivel (skip cedo)', () => {
    const bg = mkChild({ type: 'rect', name: 'price_bg', visible: false })
    // Sem texto visivel
    const pg = mkGroup([bg], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    expect(repairLivePriceGroupBackgrounds(canvas)).toBe(0)
    expect(bg.visible).toBe(false)
  })

  it('reativa price group oculto', () => {
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([priceText], { name: 'priceGroup', visible: false })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    repairLivePriceGroupBackgrounds(canvas)
    expect(pg.visible).toBe(true)
  })

  it('substitui broken image por Rect quando createRect injetado', () => {
    const brokenImage = mkChild({
      type: 'image',
      name: 'splash_image',
      src: 'data:image/png;base64,iVBOR...', // tiny placeholder
      __srcStripped: true,
      width: 200,
      height: 80,
      scaleX: 1,
      scaleY: 1
    })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([brokenImage, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    let createdRect: any = null
    const createRect = (props: any) => {
      createdRect = { ...props, sendToBack: () => {} }
      return createdRect
    }

    repairLivePriceGroupBackgrounds(canvas, createRect)
    expect(createdRect).toBeTruthy()
  })

  it('sem createRect: pula reparo de splash_image stripped', () => {
    const brokenImage = mkChild({
      type: 'image',
      name: 'splash_image',
      src: 'data:image/png;base64,tiny',
      __srcStripped: true,
      width: 200,
      height: 80
    })
    const priceText = mkChild({ type: 'text', name: 'price_integer_text' })
    const pg = mkGroup([brokenImage, priceText], { name: 'priceGroup' })
    const card = mkGroup([pg], { isProductCard: true })
    const canvas = mkGroup([card])

    // sem createRect
    const result = repairLivePriceGroupBackgrounds(canvas)
    // Pode haver outros reparos, mas o broken image continua no group
    expect(pg.getObjects()).toContain(brokenImage)
    expect(typeof result).toBe('number')
  })
})
