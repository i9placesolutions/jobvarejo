import { describe, expect, it } from 'vitest'
import { getProductImageToolbarPlacement } from '~/utils/productImageToolbarPlacement'

const baseInput = {
  targetLeft: 220,
  targetTop: 200,
  targetWidth: 180,
  targetHeight: 140,
  containerWidth: 900,
  containerHeight: 700,
  toolbarWidth: 420,
  toolbarHeight: 190
}

describe('getProductImageToolbarPlacement', () => {
  it('abre abaixo da imagem quando o topo não tem espaço suficiente', () => {
    const placement = getProductImageToolbarPlacement({
      ...baseInput,
      targetTop: 20
    })

    expect(placement.side).toBe('below')
    expect(placement.top).toBe(170)
  })

  it('mantém a barra acima quando a imagem está próxima da parte inferior', () => {
    const placement = getProductImageToolbarPlacement({
      ...baseInput,
      targetTop: 500
    })

    expect(placement.side).toBe('above')
    expect(placement.top).toBe(300)
  })

  it('limita horizontalmente o painel sem deslocá-lo para fora da tela', () => {
    const placement = getProductImageToolbarPlacement({
      ...baseInput,
      targetLeft: 840
    })

    expect(placement.left).toBe(472)
  })
})
