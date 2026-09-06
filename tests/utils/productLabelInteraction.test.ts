import { describe, expect, it } from 'vitest'
import {
  getProductLabelChildInteractionProps,
  getProductLabelGroupInteractionProps,
  isProductLabelBackgroundName
} from '~/utils/productLabelInteraction'

describe('productLabelInteraction', () => {
  it('mantem a etiqueta como um grupo selecionavel no modo move', () => {
    expect(getProductLabelGroupInteractionProps('move')).toMatchObject({
      subTargetCheck: false,
      interactive: true,
      selectable: true,
      evented: true
    })
    expect(getProductLabelChildInteractionProps('move', false)).toMatchObject({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false
    })
  })

  it('habilita elementos internos no modo edit', () => {
    expect(getProductLabelGroupInteractionProps('edit')).toMatchObject({
      subTargetCheck: true,
      interactive: true
    })
    expect(getProductLabelChildInteractionProps('edit', false)).toMatchObject({
      selectable: true,
      evented: true,
      lockMovementX: false,
      lockMovementY: false,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false
    })
  })

  it('mantem backgrounds de etiqueta fora da selecao individual', () => {
    expect(getProductLabelChildInteractionProps('edit', true)).toMatchObject({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false
    })
  })

  it('reconhece os nomes de backgrounds raster', () => {
    expect(isProductLabelBackgroundName('splash_image')).toBe(true)
    expect(isProductLabelBackgroundName('price_bg_image')).toBe(true)
    expect(isProductLabelBackgroundName('price_integer_text')).toBe(false)
  })
})
