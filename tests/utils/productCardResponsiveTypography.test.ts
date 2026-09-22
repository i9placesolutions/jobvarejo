import { it, expect } from 'vitest'
import { fitResponsiveProductTypography, harmonizeProductCardTypography } from '../../utils/productCardResponsiveTypography'
import { MANUAL_PRICE_POSITION_SOURCE } from '../../utils/pricePositionPolicy'
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
  expect(small.price.height * small.price.scaleY).toBeLessThanOrEqual(88)
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
it('etiqueta cresce proporcionalmente ao ampliar o card e estabiliza no relayout', () => {
  const card = makeCard()
  fitResponsiveProductTypography(card, 300, 300)
  const scale = card.price.scaleX
  fitResponsiveProductTypography(card, 900, 900)
  expect(card.price.scaleX).toBeCloseTo(scale * 3)
  expect(card.price.scaleY).toBeCloseTo(card.price.scaleX)
  fitResponsiveProductTypography(card, 900, 900)
  expect(card.price.scaleX).toBeCloseTo(scale * 3)
})
it('preserva a escala já calculada pela receita do card', () => {
  const card = makeCard()
  card.price.scaleX = card.price.scaleY = 3
  fitResponsiveProductTypography(card, 900, 900, 1, false)
  expect(card.price.scaleX).toBe(3)
})
it('preserva o ajuste manual da etiqueta', () => {
  const card = makeCard()
  card.price.__manualPricePosition = true
  card.price.__manualPricePositionSource = MANUAL_PRICE_POSITION_SOURCE
  fitResponsiveProductTypography(card, 900, 900)
  expect(card.price.scaleX).toBe(1)
})

it('modelos com cabeçalho conservam a largura e não encolhem à altura da pílula vizinha', () => {
  const pill = makeCard(), header = makeCard()
  pill.price.width = 320; pill.price.height = 120
  header.price.width = 320; header.price.height = 210
  for (const card of [pill, header]) {
    Object.assign(card, { width: 400, height: 500 })
    fitResponsiveProductTypography(card, 400, 500)
  }
  expect(header.price.width * header.price.scaleX).toBeGreaterThanOrEqual(pill.price.width * pill.price.scaleX * 0.97)
  const scale = header.price.scaleX
  for (let i = 0; i < 5; i++) harmonizeProductCardTypography([pill, header])
  expect(header.price.scaleX).toBe(scale)
  expect(header.price.height * header.price.scaleY).toBeLessThanOrEqual(220)
})
it('harmonização conserva escala manual mesmo ao lado de uma etiqueta menor', () => {
  const card = makeCard(), other = makeCard()
  card.price.scaleX = card.price.scaleY = 2
  card.price.__manualScaleX = card.price.__manualScaleY = 2
  harmonizeProductCardTypography([card, other])
  expect(card.price.scaleX).toBe(2)
})
