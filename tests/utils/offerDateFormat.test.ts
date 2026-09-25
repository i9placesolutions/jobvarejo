import { expect, it } from 'vitest'
import { formatOfferDate, formatOfferDateInterval, formatOfferValidityPeriod, getOfferValidityVisibilityTarget } from '~/utils/offerValidity'
it('formata sem depender do fuso e sem mudar o dia', () => {
  expect(formatOfferDate('2026-09-07')).toBe('07/09/2026')
  expect(formatOfferDate('2026-09-07', 'long')).toBe('7 de setembro')
  expect(formatOfferDate('07/09/2026', 'long')).toBe('7 de setembro')
  expect(formatOfferDate('2026-09-21', 'long')).toBe('21 de setembro')
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
  expect(formatOfferDateInterval('7 de setembro de 2026', '9 de setembro de 2026')).toBe('7 a 9 de setembro de 2026')
  expect(formatOfferDateInterval('30 de setembro de 2026', '1 de outubro de 2026')).toBe('30 de setembro de 2026 a 1 de outubro de 2026')
  expect(formatOfferDateInterval('31 de dezembro de 2026', '2 de janeiro de 2027')).toBe('31 de dezembro de 2026 a 2 de janeiro de 2027')
  expect(formatOfferValidityPeriod('25 de setembro de 2026', '26 de setembro de 2026', 'date_range', false)).toBe('Ofertas válidas de 25 a 26 de setembro de 2026')
  expect(formatOfferDateInterval('07/09/2026', '09/09/2026')).toBe('07/09/2026 a 09/09/2026')
})

it('compacta o período por extenso sem exibir o ano', () => {
  expect(formatOfferValidityPeriod(formatOfferDate('2026-09-13', 'long'), formatOfferDate('2026-09-14', 'long'), 'date_range', true))
    .toBe('Ofertas válidas de 13 a 14 de setembro e enquanto durarem os estoques')
  expect(formatOfferValidityPeriod(formatOfferDate('2026-09-21', 'long'), formatOfferDate('2026-09-21', 'long'), 'single_day', true))
    .toBe('Oferta válida somente em 21 de setembro e enquanto durarem os estoques')
})
