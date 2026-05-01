import { describe, it, expect } from 'vitest'
import {
  mapCardToZoneReviewProduct,
  sortCardsByZoneOrder,
  sortZonesByVisualOrder,
  compareZonesByVisualOrder
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

describe('compareZonesByVisualOrder', () => {
  it('ambas com _zoneOrder diferentes: usa zoneOrder', () => {
    const a = { _zoneOrder: 5 }
    const b = { _zoneOrder: 1 }
    expect(compareZonesByVisualOrder(a, b, null, null)).toBe(4)  // 5 - 1
    expect(compareZonesByVisualOrder(b, a, null, null)).toBe(-4)
  })

  it('apenas a com _zoneOrder: a vem primeiro', () => {
    expect(compareZonesByVisualOrder(
      { _zoneOrder: 5 }, {}, null, null
    )).toBe(-1)
  })

  it('apenas b com _zoneOrder: b vem primeiro', () => {
    expect(compareZonesByVisualOrder(
      {}, { _zoneOrder: 5 }, null, null
    )).toBe(1)
  })

  it('ambas com mesmo _zoneOrder: cai em metrics', () => {
    expect(compareZonesByVisualOrder(
      { _zoneOrder: 1 }, { _zoneOrder: 1 },
      { top: 100, left: 0 }, { top: 50, left: 0 }
    )).toBe(50)  // a.top - b.top
  })

  it('sem _zoneOrder: usa metrics top, diff > 2px', () => {
    expect(compareZonesByVisualOrder({}, {},
      { top: 100, left: 0 }, { top: 50, left: 0 }
    )).toBe(50)
    expect(compareZonesByVisualOrder({}, {},
      { top: 50, left: 0 }, { top: 100, left: 0 }
    )).toBe(-50)
  })

  it('top diff <= 2px: desempata por left', () => {
    expect(compareZonesByVisualOrder({}, {},
      { top: 100, left: 200 }, { top: 101, left: 50 }
    )).toBe(150)  // a.left - b.left
  })

  it('metrics null: usa default {top: 0, left: 0}', () => {
    expect(compareZonesByVisualOrder({}, {}, null, null)).toBe(0)
  })

  it('metrics undefined: tambem usa default', () => {
    expect(compareZonesByVisualOrder({}, {}, undefined, undefined)).toBe(0)
  })
})

describe('sortZonesByVisualOrder', () => {
  const isProdZone = (obj: any) => !!obj?.isZone

  it('lista vazia/null: array vazio', () => {
    expect(sortZonesByVisualOrder([], isProdZone, () => null)).toEqual([])
    expect(sortZonesByVisualOrder(null as any, isProdZone, () => null)).toEqual([])
  })

  it('filtra non-zone via predicate', () => {
    const z1 = { isZone: true, _zoneOrder: 1 }
    const z2 = { isZone: false, _zoneOrder: 2 }
    expect(sortZonesByVisualOrder([z1, z2], isProdZone, () => null)).toEqual([z1])
  })

  it('ordena por _zoneOrder primario', () => {
    const a = { isZone: true, _zoneOrder: 3 }
    const b = { isZone: true, _zoneOrder: 1 }
    const c = { isZone: true, _zoneOrder: 2 }
    expect(sortZonesByVisualOrder([a, b, c], isProdZone, () => null))
      .toEqual([b, c, a])
  })

  it('ordena por metrics quando sem _zoneOrder', () => {
    const a = { isZone: true, _zoneOrder: undefined }
    const b = { isZone: true, _zoneOrder: undefined }
    const metricsMap = new Map([
      [a, { top: 200, left: 0 }],
      [b, { top: 50, left: 0 }]
    ])
    const result = sortZonesByVisualOrder(
      [a, b], isProdZone, (z: any) => metricsMap.get(z) ?? null
    )
    expect(result).toEqual([b, a])
  })

  it('nao muta o input array', () => {
    const z1 = { isZone: true, _zoneOrder: 2 }
    const z2 = { isZone: true, _zoneOrder: 1 }
    const input = [z1, z2]
    const snapshot = [...input]
    sortZonesByVisualOrder(input, isProdZone, () => null)
    expect(input).toEqual(snapshot)
  })

  it('null entries filtradas', () => {
    const z1 = { isZone: true, _zoneOrder: 1 }
    expect(sortZonesByVisualOrder(
      [null, z1, undefined as any],
      isProdZone,
      () => null
    )).toEqual([z1])
  })
})
