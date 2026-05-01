import { describe, it, expect } from 'vitest'
import { buildCardRelayoutSignature } from '~/utils/cardRelayoutSignature'

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
