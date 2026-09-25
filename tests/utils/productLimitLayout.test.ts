import { expect, it } from 'vitest'
import { positionProductLimitBelowName } from '../../utils/productLimitLayout'
import { fitResponsiveProductTypography, harmonizeProductCardTypography } from '../../utils/productCardResponsiveTypography'
const node = (values: any) => ({ scaleX: 1, scaleY: 1, originX: 'center', originY: 'center', visible: true, set(values: any) { Object.assign(this, values) }, ...values })
it('posiciona o limite abaixo de um nome com duas linhas e acompanha novas alturas', () => {
  const title = node({ name: 'smart_title', text: 'LEITE PO NINHO 380G INTEGRAL', top: -120, left: 0, width: 280, height: 48 })
  const limit = node({ name: 'smart_limit', text: 'LIMITE 5 UN POR CLIENTE', top: -110, height: 16 })
  const card = { getObjects: () => [title, limit] }
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.top).toBeCloseTo(-96 + 4.32)
  title.height = 72
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.top).toBeCloseTo(-84 + 4.32)
  const top = limit.top
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.top).toBe(top)
})
it('usa a altura final após ajustar a fonte e harmonizar cards', () => {
  const title = node({ name: 'smart_title', top: -120, left: 0, width: 280, height: 48, fontSize: 30, initDimensions() { this.height = this.fontSize * 2.2 } })
  const limit = node({ name: 'smart_limit', text: 'LIMITE 5 UN POR CLIENTE', top: -120, height: 16 })
  const card = { width: 320, height: 360, getObjects: () => [title, limit] }
  fitResponsiveProductTypography(card, 320, 360)
  harmonizeProductCardTypography([card])
  expect(limit.top).toBeGreaterThan(title.top + title.height / 2)
})
it('preserva alinhamento lateral e oculta limite vazio', () => {
  const title = node({ name: 'smart_title', top: 10, left: 20, width: 100, height: 30, originX: 'left', originY: 'top' })
  const limit = node({ name: 'limitText', text: 'LIMITADO', top: 0, height: 16 })
  const card = { getObjects: () => [title, limit] }
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.left).toBe(70)
  expect(limit.top).toBeGreaterThan(40)
  limit.text = ''
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.visible).toBe(false)
})
it('mantém uma faixa opaca contrastante em limites antigos com preenchimento por caractere', () => {
  const title = node({ name: 'smart_title', top: 0, height: 30, width: 280 })
  const limit = node({ name: 'smart_limit', text: 'LIMITE 10 UN POR CLIENTE', fill: '#ef4444', styles: { 0: { 0: { fill: '#ef4444', fontWeight: '900' } } } })
  const card = { getObjects: () => [title, limit] }
  positionProductLimitBelowName(card, 320, 360)
  expect(limit.backgroundColor).toBe('#facc15')
  expect(limit.fill).toBe('#451a03')
  expect(limit.styles[0][0]).toEqual({ fontWeight: '900' })
  expect(limit.text).toBe('LIMITE 10 UN POR CLIENTE')
})
