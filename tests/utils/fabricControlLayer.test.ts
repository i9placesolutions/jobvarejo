import { describe, expect, it } from 'vitest'
import {
  applyVisibleSelectionChrome,
  EDITOR_SELECTION_CHROME,
  patchFabricObjectSelectionDefaults,
  resolvePriceGroupSelectionDimensions,
  resolveProductCardSelectionDimensions
} from '~/utils/fabricControlLayer'

describe('fabricControlLayer', () => {
  it('patches Fabric ownDefaults so new objects get visible circular controls', () => {
    class InteractiveFabricObject {
      static ownDefaults = {
        transparentCorners: true,
        cornerStyle: 'rect',
        cornerColor: 'blue'
      }
    }

    patchFabricObjectSelectionDefaults({ InteractiveFabricObject })

    expect(InteractiveFabricObject.ownDefaults).toMatchObject(EDITOR_SELECTION_CHROME)
    expect(InteractiveFabricObject.prototype).toMatchObject(EDITOR_SELECTION_CHROME)
  })

  it('applies the same chrome to active selection members', () => {
    const child = {
      set: (values: Record<string, any>) => Object.assign(child, values)
    }
    const selection = {
      type: 'activeSelection',
      set: (values: Record<string, any>) => Object.assign(selection, values),
      getObjects: () => [child]
    }

    applyVisibleSelectionChrome(selection)

    expect(selection).toMatchObject(EDITOR_SELECTION_CHROME)
    expect(child).toMatchObject(EDITOR_SELECTION_CHROME)
  })

  it('uses the nominal card dimensions instead of an inflated child bbox', () => {
    const card = {
      type: 'group',
      name: 'product-card',
      isProductCard: true,
      _cardWidth: 300,
      _cardHeight: 250,
      width: 324,
      height: 274,
      getObjects: () => []
    }

    expect(resolveProductCardSelectionDimensions(card)).toEqual({ width: 300, height: 250 })
  })

  it('falls back to the card background when legacy dimensions are absent', () => {
    const card = {
      type: 'group',
      name: 'product-card',
      getObjects: () => [{ type: 'rect', name: 'offerBackground', width: 240, height: 180, scaleX: 1, scaleY: 1 }]
    }

    expect(resolveProductCardSelectionDimensions(card)).toEqual({ width: 240, height: 180 })
  })

  it('uses only the visible price label bounds for its selection geometry', () => {
    const priceGroup = {
      type: 'group',
      name: 'priceGroup',
      width: 420,
      height: 240,
      getObjects: () => [
        { type: 'rect', visible: true, width: 200, height: 80, left: 35, top: -10, originX: 'center', originY: 'center' },
        { type: 'rect', visible: false, width: 600, height: 300, left: -120, top: 0, originX: 'center', originY: 'center' }
      ]
    }

    expect(resolvePriceGroupSelectionDimensions(priceGroup)).toEqual({
      width: 200,
      height: 80,
      centerOffsetX: 35,
      centerOffsetY: -10
    })
  })

  it('uses the actual price background geometry even when the label is nested in a transformed group', () => {
    const background = {
      name: 'price_bg',
      visible: true,
      getCoords: () => [
        { x: 35, y: 0 },
        { x: 235, y: 0 },
        { x: 235, y: 80 },
        { x: 35, y: 80 }
      ]
    }
    const priceGroup = {
      type: 'group',
      name: 'priceGroup',
      calcTransformMatrix: () => [1, 0, 0, 1, 100, 50],
      getObjects: () => [{ type: 'group', visible: true, getObjects: () => [background] }]
    }

    expect(resolvePriceGroupSelectionDimensions(priceGroup)).toEqual({
      width: 200,
      height: 80,
      centerOffsetX: 35,
      centerOffsetY: -10
    })
  })

  it('renders the price selector border and handles from one visible geometry without mutating the group', () => {
    class FabricObject {
      setCoords() {
        ;(this as any).coordinatesAtRender = {
          width: (this as any).width,
          height: (this as any).height,
          left: (this as any).left,
          top: (this as any).top
        }
      }

      _renderControls() {
        return {
          width: (this as any).width,
          height: (this as any).height,
          left: (this as any).left,
          top: (this as any).top,
          coordinates: (this as any).coordinatesAtRender
        }
      }
    }

    patchFabricObjectSelectionDefaults({ FabricObject })
    const priceGroup: any = new FabricObject()
    Object.assign(priceGroup, {
      type: 'group',
      name: 'priceGroup',
      width: 420,
      height: 240,
      left: 100,
      top: 50,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      getObjects: () => [
        { type: 'rect', visible: true, width: 200, height: 80, left: 35, top: -10, originX: 'center', originY: 'center' }
      ]
    })

    expect(priceGroup._renderControls()).toEqual({
      width: 200,
      height: 80,
      left: 135,
      top: 40,
      coordinates: { width: 200, height: 80, left: 135, top: 40 }
    })
    expect(priceGroup).toMatchObject({ width: 420, height: 240, left: 100, top: 50 })
  })
})
