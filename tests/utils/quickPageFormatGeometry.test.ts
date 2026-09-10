import { describe, expect, it } from 'vitest'
import { reconcileQuickPageFormatGeometry } from '../../utils/quickPageFormatGeometry'

describe('formato materializado na edição rápida', () => {
  it('corrige Story salvo como Feed e invalida a miniatura antiga sem alterar os produtos', () => {
    const products = [{ name: 'Produto', price: '33,99' }]
    const page: any = { width: 1080, height: 1350, templateFormatId: 'feed', thumbnail: 'old', canvasData: { products } }
    const frames = [{ isFrame: true, width: 1080, height: 1920 }]
    expect(reconcileQuickPageFormatGeometry(page, frames)).toBe(true)
    expect(page).toMatchObject({ width: 1080, height: 1920, templateFormatId: 'stories', templateFormatLabel: 'Story 9:16', thumbnailDirty: true })
    expect(page.thumbnail).toBeUndefined()
    expect(page.canvasData.products).toBe(products)
    expect(reconcileQuickPageFormatGeometry(page, frames)).toBe(false)
    expect(JSON.parse(JSON.stringify(page)).height).toBe(1920)
  })
  it('não escolhe arbitrariamente entre vários frames nem muda formatos personalizados', () => {
    const page = { width: 1080, height: 1350 }
    expect(reconcileQuickPageFormatGeometry(page, [{ isFrame: true, width: 500, height: 700 }])).toBe(false)
    expect(reconcileQuickPageFormatGeometry(page, [{ isFrame: true }, { isFrame: true }])).toBe(false)
    expect(page.height).toBe(1350)
  })
})
