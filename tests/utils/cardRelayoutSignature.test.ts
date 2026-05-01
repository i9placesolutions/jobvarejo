import { describe, it, expect } from 'vitest'
import { buildCardRelayoutSignature, resolvePriceGroupBaseScale } from '~/utils/cardRelayoutSignature'

describe('buildCardRelayoutSignature', () => {
  const baseGroup = (overrides: any = {}) => ({
    _productData: {},
    ...overrides
  })

  it('retorna string JSON valida', () => {
    const sig = buildCardRelayoutSignature(baseGroup(), 200, 300)
    expect(typeof sig).toBe('string')
    expect(() => JSON.parse(sig)).not.toThrow()
  })

  it('determinismo: mesmos inputs → mesma signature', () => {
    const group = baseGroup({ price: '10' })
    const styles = { cardColor: '#fff', priceFont: 'Inter' }
    const a = buildCardRelayoutSignature(group, 100, 200, styles)
    const b = buildCardRelayoutSignature(group, 100, 200, styles)
    expect(a).toBe(b)
  })

  it('width muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup(), 100, 200)
    const b = buildCardRelayoutSignature(baseGroup(), 101, 200)
    expect(a).not.toBe(b)
  })

  it('height muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup(), 100, 200)
    const b = buildCardRelayoutSignature(baseGroup(), 100, 201)
    expect(a).not.toBe(b)
  })

  it('cardColor muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup(), 100, 200, { cardColor: '#fff' })
    const b = buildCardRelayoutSignature(baseGroup(), 100, 200, { cardColor: '#000' })
    expect(a).not.toBe(b)
  })

  it('priceFont muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup(), 100, 200, { priceFont: 'Inter' })
    const b = buildCardRelayoutSignature(baseGroup(), 100, 200, { priceFont: 'Roboto' })
    expect(a).not.toBe(b)
  })

  it('priceUnit do group muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup({ priceUnit: '5' }), 100, 200)
    const b = buildCardRelayoutSignature(baseGroup({ priceUnit: '10' }), 100, 200)
    expect(a).not.toBe(b)
  })

  it('productData.name muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup({ _productData: { name: 'Banana' } }), 100, 200)
    const b = buildCardRelayoutSignature(baseGroup({ _productData: { name: 'Maca' } }), 100, 200)
    expect(a).not.toBe(b)
  })

  it('productData.limit muda → signature muda', () => {
    const a = buildCardRelayoutSignature(baseGroup({ _productData: { limit: 'LIMITE 3' } }), 100, 200)
    const b = buildCardRelayoutSignature(baseGroup({ _productData: { limit: 'LIMITE 5' } }), 100, 200)
    expect(a).not.toBe(b)
  })

  it('precisao 3 casas: 100.0001 e 100.0002 batem como 100', () => {
    const a = buildCardRelayoutSignature(baseGroup(), 100.0001, 200)
    const b = buildCardRelayoutSignature(baseGroup(), 100.0002, 200)
    expect(a).toBe(b)
  })

  it('NaN width/height → null no JSON', () => {
    const sig = buildCardRelayoutSignature(baseGroup(), NaN, NaN)
    const parsed = JSON.parse(sig)
    expect(parsed.w).toBeNull()
    expect(parsed.h).toBeNull()
  })

  it('group.priceUnit prefere sobre productData.priceUnit', () => {
    const sig = buildCardRelayoutSignature(
      baseGroup({ priceUnit: 'X', _productData: { priceUnit: 'Y' } }),
      100, 200
    )
    const parsed = JSON.parse(sig)
    expect(parsed.pricingSig.priceUnit).toBe('X')
  })

  it('productData.image fallback quando imageUrl ausente', () => {
    const sig = buildCardRelayoutSignature(
      baseGroup({ _productData: { image: 'fallback.jpg' } }),
      100, 200
    )
    const parsed = JSON.parse(sig)
    expect(parsed.pricingSig.imageUrl).toBe('fallback.jpg')
  })

  it('isProdBgTransparent boolean coerce', () => {
    const a = JSON.parse(buildCardRelayoutSignature(baseGroup(), 100, 200, { isProdBgTransparent: true }))
    const b = JSON.parse(buildCardRelayoutSignature(baseGroup(), 100, 200, { isProdBgTransparent: false }))
    expect(a.styleSig.isProdBgTransparent).toBe(true)
    expect(b.styleSig.isProdBgTransparent).toBe(false)
  })

  it('splashColor cai para accentColor quando ausente', () => {
    const sig = buildCardRelayoutSignature(
      baseGroup(), 100, 200,
      { accentColor: '#abc' } as any
    )
    const parsed = JSON.parse(sig)
    expect(parsed.styleSig.splashColor).toBe('#abc')
  })

  it('null/undefined styles → todos campos null/empty mas sem crash', () => {
    expect(() => buildCardRelayoutSignature(baseGroup(), 100, 200, undefined)).not.toThrow()
    expect(() => buildCardRelayoutSignature(baseGroup(), 100, 200, null as any)).not.toThrow()
  })
})

describe('resolvePriceGroupBaseScale', () => {
  it('prioriza __originalScaleX/Y se valido', () => {
    expect(resolvePriceGroupBaseScale({ __originalScaleX: 1.5 }, 'x', 1)).toBe(1.5)
    expect(resolvePriceGroupBaseScale({ __originalScaleY: 2 }, 'y', 1)).toBe(2)
  })

  it('__original* < 0.02: ignorado, cai em fallback', () => {
    const pg = { __originalScaleX: 0.01, scaleX: 1.5 }
    expect(resolvePriceGroupBaseScale(pg, 'x', 1)).toBe(1.5)
  })

  it('flip negativo preservado em magnitude (Math.abs)', () => {
    expect(resolvePriceGroupBaseScale({ __originalScaleX: -1.5 }, 'x', 1)).toBe(1.5)
  })

  it('sem __original*: infere base = current/zoneScale', () => {
    const pg = { scaleX: 2 }
    expect(resolvePriceGroupBaseScale(pg, 'x', 0.5)).toBe(4) // 2 / 0.5 = 4
  })

  it('zoneScale invalido (<= 0.02): retorna scale atual', () => {
    const pg = { scaleX: 1.7 }
    expect(resolvePriceGroupBaseScale(pg, 'x', 0)).toBe(1.7)
    expect(resolvePriceGroupBaseScale(pg, 'x', NaN)).toBe(1.7)
  })

  it('current scale invalido: usa 1 como safeCurrent, multiplica /zone', () => {
    const pg = { scaleX: 0 }
    // safeCurrent = 1; zoneScale 2: inferred = 1/2 = 0.5
    expect(resolvePriceGroupBaseScale(pg, 'x', 2)).toBe(0.5)
  })

  it('inferred base < 0.02: retorna safeCurrent', () => {
    // current=0.1, zone=100 → inferred = 0.001 < 0.02 → fallback
    const pg = { scaleX: 0.1 }
    expect(resolvePriceGroupBaseScale(pg, 'x', 100)).toBe(0.1)
  })

  it('axis x usa scaleX/__originalScaleX, axis y usa scaleY/__originalScaleY', () => {
    const pg = {
      scaleX: 1.1,
      scaleY: 2.2,
      __originalScaleX: 3.3,
      __originalScaleY: 4.4
    }
    expect(resolvePriceGroupBaseScale(pg, 'x', 1)).toBe(3.3)
    expect(resolvePriceGroupBaseScale(pg, 'y', 1)).toBe(4.4)
  })

  it('null/undefined priceGroup: retorna 1 (safeCurrent default)', () => {
    expect(resolvePriceGroupBaseScale(null, 'x', 1)).toBe(1)
    expect(resolvePriceGroupBaseScale(undefined, 'y', 0.5)).toBe(2) // 1/0.5
  })
})
