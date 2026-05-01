import { describe, it, expect } from 'vitest'
import {
  PRICE_LAYOUT_NODE_PREFIXES,
  PRICE_LAYOUT_NODE_EXACT,
  isPriceLayoutNode,
  isCardContainerLikeGroup,
  isMisnamedProductCardGroup,
  makePriceLayoutKeyBuilder
} from '~/utils/priceLayoutClassifiers'

describe('PRICE_LAYOUT_NODE_EXACT / PREFIXES', () => {
  it('exact set contem nomes canonicos', () => {
    expect(PRICE_LAYOUT_NODE_EXACT.has('priceGroup')).toBe(true)
    expect(PRICE_LAYOUT_NODE_EXACT.has('priceInteger')).toBe(true)
    expect(PRICE_LAYOUT_NODE_EXACT.has('priceDecimal')).toBe(true)
    expect(PRICE_LAYOUT_NODE_EXACT.has('priceUnit')).toBe(true)
    expect(PRICE_LAYOUT_NODE_EXACT.has('smart_price')).toBe(true)
  })

  it('prefixos cobrem variantes regular/varejo/atacado', () => {
    expect(PRICE_LAYOUT_NODE_PREFIXES).toContain('price_')
    expect(PRICE_LAYOUT_NODE_PREFIXES).toContain('retail_')
    expect(PRICE_LAYOUT_NODE_PREFIXES).toContain('wholesale_')
    expect(PRICE_LAYOUT_NODE_PREFIXES).toContain('atac_')
  })
})

describe('isPriceLayoutNode', () => {
  it('aceita nomes do exact set', () => {
    expect(isPriceLayoutNode({ name: 'priceGroup' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'priceInteger' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'smart_price' })).toBe(true)
  })

  it('aceita nomes com prefixos', () => {
    expect(isPriceLayoutNode({ name: 'price_currency' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'price_integer_text' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'retail_price' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'wholesale_unit' })).toBe(true)
    expect(isPriceLayoutNode({ name: 'atac_price' })).toBe(true)
  })

  it('rejeita nomes sem prefixo nem exact', () => {
    expect(isPriceLayoutNode({ name: 'offerBackground' })).toBe(false)
    expect(isPriceLayoutNode({ name: 'smart_title' })).toBe(false)
    expect(isPriceLayoutNode({ name: 'random' })).toBe(false)
  })

  it('rejeita objetos sem name', () => {
    expect(isPriceLayoutNode({})).toBe(false)
    expect(isPriceLayoutNode({ name: '' })).toBe(false)
    expect(isPriceLayoutNode({ name: '   ' })).toBe(false)
  })

  it('rejeita null/undefined/non-object', () => {
    expect(isPriceLayoutNode(null)).toBe(false)
    expect(isPriceLayoutNode(undefined)).toBe(false)
    expect(isPriceLayoutNode('priceGroup' as any)).toBe(false)
  })

  it('trim aplicado', () => {
    expect(isPriceLayoutNode({ name: '  priceGroup  ' })).toBe(true)
  })
})

describe('isCardContainerLikeGroup', () => {
  const group = (overrides: any = {}, children: any[] = []) => ({
    type: 'group',
    getObjects: () => children,
    ...overrides
  })

  it('aceita por isSmartObject/isProductCard', () => {
    expect(isCardContainerLikeGroup(group({ isSmartObject: true }))).toBe(true)
    expect(isCardContainerLikeGroup(group({ isProductCard: true }))).toBe(true)
  })

  it('aceita por nome com prefixo product-card', () => {
    expect(isCardContainerLikeGroup(group({ name: 'product-card-1' }))).toBe(true)
    expect(isCardContainerLikeGroup(group({ name: 'product-card' }))).toBe(true)
  })

  it('aceita por parentZoneId/smartGridId', () => {
    expect(isCardContainerLikeGroup(group({ parentZoneId: 'z1' }))).toBe(true)
    expect(isCardContainerLikeGroup(group({ smartGridId: 'g1' }))).toBe(true)
  })

  it('aceita por children com names canonicos', () => {
    expect(isCardContainerLikeGroup(group({}, [{ name: 'offerBackground' }]))).toBe(true)
    expect(isCardContainerLikeGroup(group({}, [{ name: 'smart_title' }]))).toBe(true)
    expect(isCardContainerLikeGroup(group({}, [{ name: 'smart_image' }]))).toBe(true)
    expect(isCardContainerLikeGroup(group({}, [{ name: 'product_image' }]))).toBe(true)
    expect(isCardContainerLikeGroup(group({}, [{ name: 'productImage' }]))).toBe(true)
    expect(isCardContainerLikeGroup(group({}, [{ name: 'smart_limit' }]))).toBe(true)
  })

  it('rejeita group sem children e sem flags', () => {
    expect(isCardContainerLikeGroup(group({}, []))).toBe(false)
  })

  it('rejeita non-group', () => {
    expect(isCardContainerLikeGroup({ type: 'rect' })).toBe(false)
    expect(isCardContainerLikeGroup(null)).toBe(false)
  })

  it('rejeita group sem getObjects (nao group real)', () => {
    expect(isCardContainerLikeGroup({ type: 'group', name: '' } as any)).toBe(false)
  })

  it('children com names nao canonicos sao ignorados', () => {
    expect(isCardContainerLikeGroup(group({}, [
      { name: 'priceInteger' }, { name: 'priceDecimal' }
    ]))).toBe(false)
  })
})

describe('isMisnamedProductCardGroup', () => {
  const group = (overrides: any = {}, children: any[] = []) => ({
    type: 'group',
    getObjects: () => children,
    ...overrides
  })

  it('priceGroup com children de card → true (caso erro)', () => {
    expect(isMisnamedProductCardGroup(group({ name: 'priceGroup' }, [
      { name: 'offerBackground' }, { name: 'smart_title' }
    ]))).toBe(true)
  })

  it('priceGroup com flag isSmartObject → true', () => {
    expect(isMisnamedProductCardGroup(group({ name: 'priceGroup', isSmartObject: true }))).toBe(true)
  })

  it('priceGroup com children de price layout → false (nao misnamed)', () => {
    expect(isMisnamedProductCardGroup(group({ name: 'priceGroup' }, [
      { name: 'priceInteger' }, { name: 'priceDecimal' }
    ]))).toBe(false)
  })

  it('non-priceGroup name → false', () => {
    expect(isMisnamedProductCardGroup(group({ name: 'priceTag' }, [
      { name: 'offerBackground' }
    ]))).toBe(false)
  })

  it('null/non-group → false', () => {
    expect(isMisnamedProductCardGroup(null)).toBe(false)
    expect(isMisnamedProductCardGroup({ type: 'rect', name: 'priceGroup' })).toBe(false)
  })
})

describe('makePriceLayoutKeyBuilder', () => {
  it('gera chaves estaveis com indice incremental por base', () => {
    const build = makePriceLayoutKeyBuilder()
    expect(build({ name: 'priceInteger' })).toBe('priceInteger#0')
    expect(build({ name: 'priceInteger' })).toBe('priceInteger#1')
    expect(build({ name: 'priceDecimal' })).toBe('priceDecimal#0')
    expect(build({ name: 'priceInteger' })).toBe('priceInteger#2')
  })

  it('cai para type quando name ausente', () => {
    const build = makePriceLayoutKeyBuilder()
    expect(build({ type: 'text' })).toBe('text#0')
    expect(build({ type: 'text' })).toBe('text#1')
  })

  it('cai para "node" quando ambos ausentes', () => {
    const build = makePriceLayoutKeyBuilder()
    expect(build({})).toBe('node#0')
    expect(build(null)).toBe('node#1')
  })

  it('builders diferentes tem counters independentes', () => {
    const b1 = makePriceLayoutKeyBuilder()
    const b2 = makePriceLayoutKeyBuilder()
    b1({ name: 'x' })
    b1({ name: 'x' })
    expect(b2({ name: 'x' })).toBe('x#0')
  })
})
