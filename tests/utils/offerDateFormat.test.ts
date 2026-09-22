import { expect, it } from 'vitest'
import { formatOfferDate, formatOfferDateInterval, formatOfferValidityPeriod, getOfferValidityVisibilityTarget } from '~/utils/offerValidity'
it('formata sem depender do fuso e sem mudar o dia', () => {
  expect(formatOfferDate('2026-09-07')).toBe('07/09/2026')
  expect(formatOfferDate('2026-09-07', 'long')).toBe('sete de setembro')
  expect(formatOfferDate('07/09/2026', 'long')).toBe('sete de setembro')
  expect(formatOfferDate('2026-09-21', 'long')).toBe('vinte e um de setembro')
  expect(formatOfferDate('2026-09-07', 'hidden')).toBe('')
})
it('oculta o grupo exclusivo de validade e preserva grupos com outros conteúdos', () => {
  const text: any = { type: 'textbox', quickDataField: 'validity' }
  const group = { getObjects: () => [text, { type: 'rect' }, { type: 'image' }] }
  text.group = group
  expect(getOfferValidityVisibilityTarget(text)).toBe(group)
  text.group = { getObjects: () => [text, { type: 'textbox', text: 'Telefone' }] }
  expect(getOfferValidityVisibilityTarget(text)).toBe(text)
})

it('compacta intervalos por extenso no mesmo mês e na mudança de mês', () => {
  expect(formatOfferDateInterval('sete de setembro de 2026', 'nove de setembro de 2026')).toBe('sete a nove de setembro de 2026')
  expect(formatOfferDateInterval('trinta de setembro de 2026', 'um de outubro de 2026')).toBe('trinta de setembro de 2026 a um de outubro de 2026')
  expect(formatOfferDateInterval('trinta e um de dezembro de 2026', 'dois de janeiro de 2027')).toBe('trinta e um de dezembro de 2026 a dois de janeiro de 2027')
  expect(formatOfferValidityPeriod('sete de setembro de 2026', 'nove de setembro de 2026', 'date_range', false)).toBe('Ofertas válidas de sete a nove de setembro de 2026')
  expect(formatOfferDateInterval('07/09/2026', '09/09/2026')).toBe('07/09/2026 a 09/09/2026')
})

it('compacta o período por extenso sem exibir o ano', () => {
  expect(formatOfferValidityPeriod(formatOfferDate('2026-09-13', 'long'), formatOfferDate('2026-09-14', 'long'), 'date_range', true))
    .toBe('Ofertas válidas de treze a quatorze de setembro e enquanto durarem os estoques')
  expect(formatOfferValidityPeriod(formatOfferDate('2026-09-21', 'long'), formatOfferDate('2026-09-21', 'long'), 'single_day', true))
    .toBe('Oferta válida somente em vinte e um de setembro e enquanto durarem os estoques')
})
