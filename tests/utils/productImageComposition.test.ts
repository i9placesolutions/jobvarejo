import { describe, expect, it } from 'vitest'
import {
  getProductImageDuplicatePlacement,
  resolveProductImageDuplicateLayout
} from '~/utils/productImageComposition'

describe('getProductImageDuplicatePlacement', () => {
  it('preserva posição, escala e transform visual da imagem original', () => {
    expect(getProductImageDuplicatePlacement({
      left: 42,
      top: -18,
      scaleX: 0.62,
      scaleY: 0.78,
      originX: 'right',
      originY: 'bottom',
      angle: 12,
      skewX: 3,
      skewY: -2,
      flipX: true,
      flipY: false,
      opacity: 0.85
    } as any)).toEqual({
      left: 42,
      top: -18,
      originX: 'right',
      originY: 'bottom',
      angle: 12,
      scaleX: 0.62,
      scaleY: 0.78,
      skewX: 3,
      skewY: -2,
      flipX: true,
      flipY: false,
      opacity: 0.85
    })
  })

  it('usa defaults seguros quando a origem está incompleta', () => {
    expect(getProductImageDuplicatePlacement({} as any)).toEqual({
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      flipX: false,
      flipY: false,
      opacity: 1
    })
  })

  it('permite deslocar a cópia sem alterar escala ou rotação', () => {
    expect(getProductImageDuplicatePlacement({ left: 42, top: -18, scaleX: 0.62, scaleY: 0.78, angle: 12 } as any, {
      offsetX: 20,
      offsetY: 16
    })).toMatchObject({
      left: 62,
      top: -2,
      scaleX: 0.62,
      scaleY: 0.78,
      angle: 12
    })
  })
})

describe('resolveProductImageDuplicateLayout', () => {
  it('empilha em cards estreitos e altos', () => {
    expect(resolveProductImageDuplicateLayout({
      cardWidth: 180,
      cardHeight: 260,
      images: [{ width: 500, height: 500 }]
    })).toBe('vertical')
  })

  it('mantem imagens lado a lado em cards largos', () => {
    expect(resolveProductImageDuplicateLayout({
      cardWidth: 320,
      cardHeight: 180,
      images: [{ width: 500, height: 500 }]
    })).toBe('horizontal')
  })

  it('usa a direcao vertical da zona como desempate', () => {
    expect(resolveProductImageDuplicateLayout({
      cardWidth: 200,
      cardHeight: 200,
      images: [{ width: 100, height: 100 }],
      zoneLayoutDirection: 'vertical'
    })).toBe('vertical')
  })

  it('considera a area real do slot quando a zona restringe a largura', () => {
    expect(resolveProductImageDuplicateLayout({
      cardWidth: 320,
      cardHeight: 180,
      availableWidth: 150,
      availableHeight: 240,
      slotCount: 2,
      images: [{ width: 500, height: 500 }]
    })).toBe('vertical')
  })

  it('respeita uma receita explicita do card', () => {
    expect(resolveProductImageDuplicateLayout({
      cardWidth: 180,
      cardHeight: 260,
      requestedLayout: 'horizontal'
    })).toBe('horizontal')
  })
})
