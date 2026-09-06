import { it, expect } from 'vitest'
import { fitResponsiveProductTypography } from '../../utils/productCardResponsiveTypography'
const makeCard = () => {
  const title: any = { name: 'smart_title', fontSize: 30, height: 60,
    set(values: any) { Object.assign(this, values) },
    initDimensions() { this.height = this.fontSize * 2.2 }
  }
  const price: any = { name: 'priceGroup', width: 220, height: 90, scaleX: 1, scaleY: 1,
    set(values: any) { Object.assign(this, values) } }
  return { getObjects: () => [title, price], title, price }
}
it('cards baixos recebem nomes e etiquetas menores que os destaques', () => {
  const featured = makeCard(), small = makeCard()
  fitResponsiveProductTypography(featured, 300, 300)
  fitResponsiveProductTypography(small, 300, 200)
  expect(small.title.fontSize).toBeLessThan(featured.title.fontSize)
  expect(small.price.scaleX).toBeLessThan(featured.price.scaleX)
  expect(small.price.height * small.price.scaleY).toBeLessThanOrEqual(60)
  const previous = small.price.scaleX
  fitResponsiveProductTypography(small, 300, 200)
  expect(small.price.scaleX).toBeCloseTo(previous)
})
it('nome volta a crescer ao ampliar o card e ignora tamanho fixo importado', () => {
  const card = makeCard()
  card.title.styles = { 0: { 0: { fontSize: 80, fill: '#f00' } } }
  fitResponsiveProductTypography(card, 300, 150)
  const small = card.title.fontSize
  expect(card.title.styles[0][0].fontSize).toBeUndefined()
  expect(card.title.styles[0][0].fill).toBe('#f00')
  fitResponsiveProductTypography(card, 300, 300)
  expect(card.title.fontSize).toBeGreaterThan(small)
})
it('não trava em 9 nas coordenadas locais do encarte salvo', () => {
  const featured = makeCard(), small = makeCard()
  fitResponsiveProductTypography(featured, 113.3652, 114.1536)
  fitResponsiveProductTypography(small, 115.3652, 77.4357)
  expect(small.title.fontSize / featured.title.fontSize).toBeLessThan(0.75)
  expect(small.title.height).toBeLessThanOrEqual(77.4357 * 0.23)
})
