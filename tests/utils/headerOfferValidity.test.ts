import { expect, it } from 'vitest'
import { layoutHeaderOfferValidity } from '../../utils/headerOfferValidity'
const object = (props: any): any => ({ left: 0, top: 200, width: 900, height: 60, scaleX: 1, scaleY: 1,
  set(v: any) { Object.assign(this, v) }, setCoords() {}, initDimensions() {},
  getBoundingRect() { return { left: this.left, top: this.top, width: this.width * this.scaleX, height: this.height * this.scaleY } }, ...props })
it('mantém três linhas, contraste e posição após reaplicar o layout', () => {
  const text = object({ text: 'data antiga', fontSize: 24, quickValidityStartDate: '2026-09-14', quickValidityEndDate: '2026-09-19', quickValidityMode: 'date_range' })
  const band = object({ name: 'validity-backdrop', fill: '#781c12' })
  const zone = object({ isProductZone: true, top: 300 })
  expect(layoutHeaderOfferValidity(text, [band, zone])).toBe(true)
  expect(text.text).toBe('OFERTA VÁLIDA DE\n14 A 19 DE SETEMBRO\nOU ENQUANTO DURAREM OS ESTOQUES')
  expect(text.textAlign).toBe('left')
  expect(text.fill).toBe('#ffffff')
  expect(band.fill).toBe('#781c12')
  expect(layoutHeaderOfferValidity(text, [band, zone])).toBe(false)
})
it('não altera a validade quando não há espaço acima dos produtos', () => {
  const text = object({ text: 'original', quickValidityStartDate: '2026-09-14' })
  expect(layoutHeaderOfferValidity(text, [object({ isProductZone: true, top: 235 })])).toBe(null)
  expect(text.text).toBe('original')
})
