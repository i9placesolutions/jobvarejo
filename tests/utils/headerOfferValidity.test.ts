import { expect, it } from 'vitest'
import { layoutHeaderOfferValidity } from '../../utils/headerOfferValidity'
import { applyDynamicBusinessTextColor } from '../../utils/dynamicBusinessFields'
import { CANVAS_CUSTOM_PROPS } from '../../utils/canvasCustomProps'
const object = (props: any): any => ({ left: 0, top: 200, width: 900, height: 60, scaleX: 1, scaleY: 1,
  set(v: any) { Object.assign(this, v) }, setCoords() {}, initDimensions() {},
  getBoundingRect() { return { left: this.left, top: this.top, width: this.width * this.scaleX, height: this.height * this.scaleY } }, ...props })
it('mantém a cor manual nas três linhas após salvar, reabrir e atualizar a data', () => {
  const text = object({ type: 'textbox', quickDataField: 'validity', text: 'data antiga', fontSize: 24, fill: '#14223d', quickValidityStartDate: '2026-09-14', quickValidityEndDate: '2026-09-19', quickValidityMode: 'date_range' })
  const zone = object({ isProductZone: true, top: 300 })
  layoutHeaderOfferValidity(text, [zone])
  const weight = text.styles[1][0].fontWeight
  expect(applyDynamicBusinessTextColor(text, '#ffffff')).toBe(true)
  expect(text.styles[1][0]).toMatchObject({ fill: '#ffffff', fontWeight: weight })
  expect(CANVAS_CUSTOM_PROPS).toContain('dynamicFieldTextColor')
  const saved = JSON.parse(JSON.stringify(text))
  const reloaded = object({ ...saved, quickValidityEndDate: '2026-09-20' })
  layoutHeaderOfferValidity(reloaded, [zone])
  expect(reloaded.text).toContain('20 DE SETEMBRO')
  for (const row of Object.values(reloaded.styles) as any[]) {
    expect(Object.values(row).every((style: any) => style.fill === '#ffffff')).toBe(true)
  }
  expect(reloaded.fill).toBe('#ffffff')
})
it('mantém três linhas, contraste e posição após reaplicar o layout', () => {
  const text = object({ text: 'data antiga', fontSize: 24, fill: '#ffffff', quickValidityStartDate: '2026-09-14', quickValidityEndDate: '2026-09-19', quickValidityMode: 'date_range' })
  const band = object({ name: 'validity-backdrop', fill: '#781c12' })
  const zone = object({ isProductZone: true, top: 300 })
  expect(layoutHeaderOfferValidity(text, [band, zone])).toBe(true)
  expect(text.text).toBe('OFERTA VÁLIDA DE\n14 A 19 DE SETEMBRO\nOU ENQUANTO DURAREM OS ESTOQUES')
  expect(text.textAlign).toBe('left')
  expect(text.fill).toBe('#ffffff')
  expect(band.fill).toBe('#781c12')
  expect(band.visible).toBe(false)
  expect(text.styles[1][0].fill).toBe('#ffe11f')
  expect(text.styles[0][0].fontSize).toBeLessThan(text.styles[1][0].fontSize)
  expect(layoutHeaderOfferValidity(text, [band, zone])).toBe(false)
})
it('não altera a validade quando não há espaço acima dos produtos', () => {
  const text = object({ text: 'original', quickValidityStartDate: '2026-09-14' })
  expect(layoutHeaderOfferValidity(text, [object({ isProductZone: true, top: 235 })])).toBe(null)
  expect(text.text).toBe('original')
})
it('alinha bloco e calendário à esquerda sem restaurar a faixa ao reaplicar', () => {
  const text = object({ left: 210, top: 113, width: 1000, fontSize: 24, fill: '#14223d', name: 'dynamic-validity', quickValidityStartDate: '2026-09-12', quickValidityEndDate: '2026-09-13', quickValidityMode: 'date_range' })
  const band = object({ name: 'validity-backdrop', left: 47, top: 172, width: 1286, fill: '#880000' })
  const icon = object({ quickDynamicIconFor: 'validity', width: 24, height: 24, left: 125, top: 180, stroke: '#ffffff', fill: 'none' })
  const zone = object({ isProductZone: true, top: 250 })
  expect(layoutHeaderOfferValidity(text, [band, icon, zone])).toBe(true)
  expect(band.visible).toBe(false)
  expect(text.textAlign).toBe('left')
  expect(text.left).toBeLessThan(210)
  expect(icon.left).toBeLessThan(text.left)
  expect(icon.height * icon.scaleY).toBeCloseTo(24 * 2.6)
  expect(text.styles[0][0].fontSize).toBeLessThan(text.styles[1][0].fontSize)
  const before = [text.left, text.top, icon.left, icon.top]
  layoutHeaderOfferValidity(text, [band, icon, zone])
  expect([text.left, text.top, icon.left, icon.top]).toEqual(before)
  expect(band.visible).toBe(false)
})
