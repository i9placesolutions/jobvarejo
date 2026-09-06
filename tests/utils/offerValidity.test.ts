import { describe, expect, it } from 'vitest'
import {
  formatOfferValidity,
  formatOfferValidityScope,
  inferOfferValidityMode,
  normalizeOfferValidityMode,
  normalizeOfferValidityScope,
} from '~/utils/offerValidity'

describe('offer validity scope', () => {
  it('formats all stores without adding a misleading location suffix', () => {
    expect(formatOfferValidityScope({ mode: 'all' })).toBe('')
  })

  it('formats all stores in a city', () => {
    expect(formatOfferValidityScope({ mode: 'city', city: 'Rio Verde', state: 'go' }))
      .toBe('Oferta válida em todas as lojas de Rio Verde - GO')
  })

  it('formats a city-only offer separately from all stores in that city', () => {
    expect(formatOfferValidityScope({ mode: 'city_only', city: 'Rio Verde', state: 'go' }))
      .toBe('Oferta válida somente em Rio Verde - GO')
  })

  it('requires store and city before printing a store-specific promise', () => {
    expect(formatOfferValidityScope({ mode: 'store', storeName: 'Loja Popular', city: 'Rio Verde', state: 'GO' }))
      .toBe('Oferta válida somente na loja Loja Popular em Rio Verde - GO')
    expect(formatOfferValidityScope({ mode: 'store', storeName: 'Loja Popular' })).toBe('')
  })

  it('normalizes aliases and uppercases the UF', () => {
    expect(normalizeOfferValidityScope({ mode: 'city', municipality: 'Rio Verde', uf: 'go' }))
      .toMatchObject({ mode: 'city', city: 'Rio Verde', state: 'GO' })
    expect(normalizeOfferValidityScope({ mode: 'city-only', municipality: 'Rio Verde', uf: 'go' }))
      .toMatchObject({ mode: 'city_only', city: 'Rio Verde', state: 'GO' })
  })

  it('supports the three validity period choices', () => {
    expect(normalizeOfferValidityMode('single-day')).toBe('single_day')
    expect(normalizeOfferValidityMode('date-range')).toBe('date_range')
    expect(normalizeOfferValidityMode('stocks')).toBe('while_stocks')
    expect(inferOfferValidityMode('2026-09-04', '2026-09-04')).toBe('single_day')
    expect(inferOfferValidityMode('2026-09-04', '2026-09-07')).toBe('date_range')
    expect(inferOfferValidityMode('', '')).toBe('while_stocks')
  })

  it('formats a single day, a range and stock-limited validity', () => {
    expect(formatOfferValidity('04/09/2026', '04/09/2026', undefined, 'single_day'))
      .toBe('Oferta válida somente em 04/09/2026')
    expect(formatOfferValidity('04/09/2026', '07/09/2026', undefined, 'date_range'))
      .toBe('Ofertas válidas de 04/09/2026 a 07/09/2026')
    expect(formatOfferValidity('', '', undefined, 'while_stocks'))
      .toBe('Ofertas válidas enquanto durarem os estoques')
  })

  it('formats dates combined with the stock limit', () => {
    expect(formatOfferValidity('04/09/2026', '04/09/2026', undefined, 'single_day', true))
      .toBe('Oferta válida somente em 04/09/2026 e enquanto durarem os estoques')
    expect(formatOfferValidity('04/09/2026', '07/09/2026', undefined, 'date_range', true))
      .toBe('Ofertas válidas de 04/09/2026 a 07/09/2026 e enquanto durarem os estoques')
  })
})
