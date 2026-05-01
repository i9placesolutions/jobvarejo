import { describe, it, expect } from 'vitest'
import {
  PRICE_LAYOUT_NODE_PREFIXES,
  PRICE_LAYOUT_NODE_EXACT,
  isPriceLayoutNode,
  isCardContainerLikeGroup,
  isMisnamedProductCardGroup,
  makePriceLayoutKeyBuilder,
  isFiniteLayoutNumber,
  getCardHostForPriceGroup,
  getCardSizeForPriceGroup
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

describe('isFiniteLayoutNumber', () => {
  it('numeros finitos → true', () => {
    expect(isFiniteLayoutNumber(0)).toBe(true)
    expect(isFiniteLayoutNumber(1)).toBe(true)
    expect(isFiniteLayoutNumber(-100.5)).toBe(true)
    expect(isFiniteLayoutNumber(1e10)).toBe(true)
  })

  it('strings parseaveis para numero finito → true', () => {
    expect(isFiniteLayoutNumber('42')).toBe(true)
    expect(isFiniteLayoutNumber('-3.14')).toBe(true)
    expect(isFiniteLayoutNumber('0')).toBe(true)
  })

  it('NaN/Infinity → false', () => {
    expect(isFiniteLayoutNumber(NaN)).toBe(false)
    expect(isFiniteLayoutNumber(Infinity)).toBe(false)
    expect(isFiniteLayoutNumber(-Infinity)).toBe(false)
  })

  it('strings invalidas → false', () => {
    expect(isFiniteLayoutNumber('abc')).toBe(false)
    expect(isFiniteLayoutNumber('NaN')).toBe(false)
  })

  it('null → true (Number(null)=0), undefined → false (Number(undefined)=NaN)', () => {
    expect(isFiniteLayoutNumber(null)).toBe(true)
    expect(isFiniteLayoutNumber(undefined)).toBe(false)
  })

  it('empty string → true (Number("")=0)', () => {
    expect(isFiniteLayoutNumber('')).toBe(true)
  })
})

describe('getCardHostForPriceGroup', () => {
  it('retorna null quando sem parent group', () => {
    expect(getCardHostForPriceGroup({})).toBeNull()
    expect(getCardHostForPriceGroup({ group: null })).toBeNull()
  })

  it('encontra parent com isSmartObject', () => {
    const card = { type: 'group', isSmartObject: true, getObjects: () => [] }
    const priceGroup = { group: card }
    expect(getCardHostForPriceGroup(priceGroup)).toBe(card)
  })

  it('encontra parent com isProductCard', () => {
    const card = { type: 'group', isProductCard: true, getObjects: () => [] }
    const priceGroup = { group: card }
    expect(getCardHostForPriceGroup(priceGroup)).toBe(card)
  })

  it('encontra parent com name product-card*', () => {
    const card = { type: 'group', name: 'product-card-1', getObjects: () => [] }
    const priceGroup = { group: card }
    expect(getCardHostForPriceGroup(priceGroup)).toBe(card)
  })

  it('encontra parent com offerBackground entre children', () => {
    const card = {
      type: 'group',
      getObjects: () => [{ name: 'offerBackground' }, { name: 'priceGroup' }]
    }
    const priceGroup = { group: card }
    expect(getCardHostForPriceGroup(priceGroup)).toBe(card)
  })

  it('sobe varios niveis de aninhamento', () => {
    const card = { type: 'group', isSmartObject: true, getObjects: () => [] }
    const middle = { type: 'group', getObjects: () => [], group: card }
    const priceGroup = { group: middle }
    expect(getCardHostForPriceGroup(priceGroup)).toBe(card)
  })

  it('retorna null quando nada na cadeia parece card', () => {
    const middle = { type: 'group', getObjects: () => [{ name: 'random' }] }
    const priceGroup = { group: middle }
    expect(getCardHostForPriceGroup(priceGroup)).toBeNull()
  })
})

describe('getCardSizeForPriceGroup', () => {
  it('retorna null se sem host', () => {
    expect(getCardSizeForPriceGroup({})).toBeNull()
  })

  it('prefere _cardWidth/_cardHeight', () => {
    const card = {
      type: 'group',
      isSmartObject: true,
      _cardWidth: 200,
      _cardHeight: 280,
      width: 100, height: 150,
      getObjects: () => []
    }
    expect(getCardSizeForPriceGroup({ group: card })).toEqual({ width: 200, height: 280 })
  })

  it('cai para width/height nativos', () => {
    const card = {
      type: 'group',
      isSmartObject: true,
      width: 150, height: 200,
      getObjects: () => []
    }
    expect(getCardSizeForPriceGroup({ group: card })).toEqual({ width: 150, height: 200 })
  })

  it('cai para getScaledWidth/Height', () => {
    const card = {
      type: 'group',
      isSmartObject: true,
      getScaledWidth: () => 120,
      getScaledHeight: () => 180,
      getObjects: () => []
    }
    expect(getCardSizeForPriceGroup({ group: card })).toEqual({ width: 120, height: 180 })
  })

  it('retorna null se dimensoes < 20px (degenerate)', () => {
    const card = {
      type: 'group',
      isSmartObject: true,
      _cardWidth: 10, _cardHeight: 10,
      getObjects: () => []
    }
    expect(getCardSizeForPriceGroup({ group: card })).toBeNull()
  })

  it('valores negativos sao tratados em abs', () => {
    const card = {
      type: 'group',
      isSmartObject: true,
      _cardWidth: -200, _cardHeight: -280,
      getObjects: () => []
    }
    expect(getCardSizeForPriceGroup({ group: card })).toEqual({ width: 200, height: 280 })
  })
})
