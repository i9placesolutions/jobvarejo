import { describe, it, expect } from 'vitest'
import { buildCardRecoverySearchPayload } from '~/utils/cardRecoveryPayload'

describe('buildCardRecoverySearchPayload', () => {
  const cardWithData = (productData: any, overrides: any = {}) => ({
    _productData: productData,
    getObjects: () => [],
    ...overrides
  })

  it('null/sem name extraivel: retorna null', () => {
    expect(buildCardRecoverySearchPayload(null)).toBeNull()
    expect(buildCardRecoverySearchPayload({})).toBeNull()
    expect(buildCardRecoverySearchPayload(cardWithData({ name: '' }))).toBeNull()
  })

  it('apenas name: term=name, sem brand/flavor/weight', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({ name: 'Coca Cola' }))
    expect(result).toEqual({ term: 'Coca Cola' })
  })

  it('name + brand + flavor + weight: incluidos no term + retornados', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({
      name: 'Refri',
      brand: 'CocaCola',
      flavor: 'Original',
      weight: '350ml'
    }))
    expect(result?.term).toBe('Refri CocaCola Original 350ml')
    expect(result?.brand).toBe('CocaCola')
    expect(result?.flavor).toBe('Original')
    expect(result?.weight).toBe('350ml')
  })

  it('brand ja no name: nao duplica no term mas mantem em brand', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({
      name: 'Coca Cola Original 350ml',
      brand: 'Coca Cola',
      flavor: 'Original',
      weight: '350ml'
    }))
    expect(result?.term).toBe('Coca Cola Original 350ml')
    expect(result?.brand).toBe('Coca Cola')
    expect(result?.flavor).toBe('Original')
    expect(result?.weight).toBe('350ml')
  })

  it('case insensitive matching no nome', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({
      name: 'COCA cola',
      brand: 'Coca Cola'
    }))
    expect(result?.term).toBe('COCA cola')
  })

  it('fallback para text do titulo quando productData.name ausente', () => {
    const card = cardWithData(
      {},
      {
        getObjects: () => [{ name: 'smart_title', type: 'text', text: 'Banana Prata' }]
      }
    )
    const result = buildCardRecoverySearchPayload(card)
    expect(result?.term).toBe('Banana Prata')
  })

  it('fallback para layerName quando nem productData.name nem titulo', () => {
    const card = cardWithData({}, { layerName: 'Card 1' })
    const result = buildCardRecoverySearchPayload(card)
    expect(result?.term).toBe('Card 1')
  })

  it('apenas brand sem name: retorna null', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({ brand: 'CocaCola' }))
    expect(result).toBeNull()
  })

  it('campos vazios/whitespace ignorados', () => {
    const result = buildCardRecoverySearchPayload(cardWithData({
      name: 'Foo',
      brand: '  ',
      flavor: ''
    }))
    expect(result).toEqual({ term: 'Foo' })
  })

  it('_productData nao-objeto: tratado como vazio', () => {
    const card = cardWithData('invalid' as any, { layerName: 'Fallback' })
    const result = buildCardRecoverySearchPayload(card)
    expect(result?.term).toBe('Fallback')
  })
})
