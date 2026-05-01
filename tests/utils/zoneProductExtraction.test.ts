import { describe, it, expect } from 'vitest'
import {
  mapCardToZoneReviewProduct,
  sortCardsByZoneOrder
} from '~/utils/zoneProductExtraction'

const card = (overrides: any = {}) => ({
  _customId: 'card-1',
  parentZoneId: 'zone-1',
  _productData: {},
  getObjects: () => [],
  ...overrides
})

const zone = (overrides: any = {}) => ({
  _customId: 'zone-1',
  ...overrides
})

describe('mapCardToZoneReviewProduct', () => {
  it('card vazio: defaults seguros', () => {
    const r = mapCardToZoneReviewProduct(card({ _productData: {} }), zone(), 0)
    expect(r.name).toBe('Produto 1')  // fallback
    expect(r.id).toBe('card-1')        // do _customId
    expect(r.zoneInstanceId).toBe('zone-1')
    expect(r.imageUrl).toBeNull()
    expect(r.status).toBe('pending')
    expect(r.brand).toBe('')
    expect(r.price_mode).toBe('retail')
  })

  it('com productData: usa nome dele', () => {
    const r = mapCardToZoneReviewProduct(
      card({ _productData: { name: 'Banana Prata' } }),
      zone(),
      0
    )
    expect(r.name).toBe('Banana Prata')
  })

  it('prefere text do titulo sobre productData.name', () => {
    const c = card({
      _productData: { name: 'old' },
      getObjects: () => [{ name: 'smart_title', type: 'text', text: 'novo do titulo' }]
    })
    const r = mapCardToZoneReviewProduct(c, zone(), 0)
    expect(r.name).toBe('novo do titulo')
  })

  it('fallback para layerName quando nem titulo nem productData.name', () => {
    const r = mapCardToZoneReviewProduct(
      card({ _productData: {}, layerName: 'Card Custom' }),
      zone(),
      0
    )
    expect(r.name).toBe('Card Custom')
  })

  it('CRLF normalizado para LF no titulo', () => {
    const c = card({
      _productData: {},
      getObjects: () => [{ name: 'smart_title', type: 'text', text: 'linha1\r\nlinha2' }]
    })
    const r = mapCardToZoneReviewProduct(c, zone(), 0)
    expect(r.name).toBe('linha1\nlinha2')
  })

  it('imageUrl: prioridade productData.imageUrl > productData.image > card.imageUrl', () => {
    expect(mapCardToZoneReviewProduct(
      card({ _productData: { imageUrl: 'a' } }), zone(), 0
    ).imageUrl).toBe('a')
    expect(mapCardToZoneReviewProduct(
      card({ _productData: { image: 'b' } }), zone(), 0
    ).imageUrl).toBe('b')
    expect(mapCardToZoneReviewProduct(
      card({ _productData: {}, imageUrl: 'c' }), zone(), 0
    ).imageUrl).toBe('c')
  })

  it('imageUrl com whitespace e trimmed', () => {
    expect(mapCardToZoneReviewProduct(
      card({ _productData: { imageUrl: '  https://example.com/x.png  ' } }), zone(), 0
    ).imageUrl).toBe('https://example.com/x.png')
  })

  it('status=done quando ha imageUrl', () => {
    const r = mapCardToZoneReviewProduct(
      card({ _productData: { imageUrl: 'foo.png' } }), zone(), 0
    )
    expect(r.status).toBe('done')
  })

  it('zoneInstanceId: card.parentZoneId precede tudo', () => {
    const r = mapCardToZoneReviewProduct(
      card({ parentZoneId: 'override', _productData: { zoneInstanceId: 'productData' } }),
      zone({ _customId: 'fromZone' }),
      0
    )
    expect(r.zoneInstanceId).toBe('override')
  })

  it('zoneInstanceId: fallback para zone._customId', () => {
    const r = mapCardToZoneReviewProduct(
      card({ parentZoneId: '', _productData: {} }),
      zone({ _customId: 'fromZone' }),
      0
    )
    expect(r.zoneInstanceId).toBe('fromZone')
  })

  it('id fallback para zone-product-INDEX quando sem productInstanceId', () => {
    const r = mapCardToZoneReviewProduct(
      card({ _customId: '', parentZoneId: '', _productData: {} }),
      zone({ _customId: '' }),
      4
    )
    expect(r.id).toBe('zone-product-5')
  })

  it('precos do productData passam por (card como fallback)', () => {
    const r = mapCardToZoneReviewProduct(
      card({ price: 'cardP', _productData: { price: 'pdP' } }),
      zone(), 0
    )
    expect(r.price).toBe('pdP')  // productData precede
  })

  it('precos do card como fallback', () => {
    const r = mapCardToZoneReviewProduct(
      card({ priceUnit: 'cardU', _productData: {} }),
      zone(), 0
    )
    expect(r.priceUnit).toBe('cardU')
  })
})

describe('sortCardsByZoneOrder', () => {
  it('ordena por _zoneOrder asc', () => {
    const c1 = { _zoneOrder: 3 }
    const c2 = { _zoneOrder: 1 }
    const c3 = { _zoneOrder: 2 }
    expect(sortCardsByZoneOrder([c1, c2, c3])).toEqual([c2, c3, c1])
  })

  it('cards sem _zoneOrder vao pro fim', () => {
    const a = { _zoneOrder: 1 }
    const b = {} // sem zoneOrder
    const c = { _zoneOrder: 2 }
    const sorted = sortCardsByZoneOrder([b, a, c])
    expect(sorted[0]).toBe(a)
    expect(sorted[1]).toBe(c)
    expect(sorted[2]).toBe(b)
  })

  it('lista vazia/null retorna []', () => {
    expect(sortCardsByZoneOrder([])).toEqual([])
    expect(sortCardsByZoneOrder(null as any)).toEqual([])
  })

  it('filtra null/falsy entries', () => {
    expect(sortCardsByZoneOrder([null, { _zoneOrder: 1 }, undefined as any])).toEqual([{ _zoneOrder: 1 }])
  })

  it('nao muta o input (slice)', () => {
    const input = [{ _zoneOrder: 2 }, { _zoneOrder: 1 }]
    const inputSnapshot = [...input]
    sortCardsByZoneOrder(input)
    expect(input).toEqual(inputSnapshot)
  })

  it('todos sem _zoneOrder: ordem preservada (stable)', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const sorted = sortCardsByZoneOrder([a, b])
    expect(sorted[0]).toBe(a)
    expect(sorted[1]).toBe(b)
  })
})
