import { expect, it } from 'vitest'
import { formatOfferDate, formatOfferDateInterval, formatOfferValidityPeriod, getOfferValidityVisibilityTarget } from '~/utils/offerValidity'
it('formata sem depender do fuso e sem mudar o dia', () => {
  expect(formatOfferDate('2026-09-07')).toBe('07/09/2026')
  expect(formatOfferDate('2026-09-07', 'long')).toBe('07 de setembro de 2026')
  expect(formatOfferDate('07/09/2026', 'long')).toBe('07 de setembro de 2026')
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
  expect(formatOfferDateInterval('07 de setembro de 2026', '09 de setembro de 2026')).toBe('07 a 09 de setembro de 2026')
  expect(formatOfferDateInterval('30 de setembro de 2026', '01 de outubro de 2026')).toBe('30/09 a 01 de outubro')
  expect(formatOfferDateInterval('31 de dezembro de 2026', '02 de janeiro de 2027')).toBe('31 de dezembro de 2026 a 02 de janeiro de 2027')
  expect(formatOfferValidityPeriod('07 de setembro de 2026', '09 de setembro de 2026', 'date_range', false)).toBe('Ofertas válidas de 07 a 09 de setembro de 2026')
  expect(formatOfferDateInterval('07/09/2026', '09/09/2026')).toBe('07/09/2026 a 09/09/2026')
})
