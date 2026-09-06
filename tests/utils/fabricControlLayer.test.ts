import { describe, expect, it } from 'vitest'
import {
  applyVisibleSelectionChrome,
  EDITOR_SELECTION_CHROME,
  patchFabricObjectSelectionDefaults,
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
})
