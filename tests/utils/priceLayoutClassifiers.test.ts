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
  getCardSizeForPriceGroup,
  hasCorruptedPriceLayout,
  getPriceGroupFromAny,
  getCardGroupFromAny,
  getSinglePriceBackgroundCandidate,
  getSinglePriceBackgroundImageCandidate,
  getSinglePriceCurrencyTextCandidate,
  isLikelyPriceGroupObject
} from '~/utils/priceLayoutClassifiers'

describe('isLikelyPriceGroupObject', () => {
  const noPreserve = () => false

  it('non-group: false', () => {
    expect(isLikelyPriceGroupObject({ type: 'rect' }, noPreserve)).toBe(false)
    expect(isLikelyPriceGroupObject(null, noPreserve)).toBe(false)
  })

  it('name=priceGroup mas nao misnamed: true', () => {
    const g = { type: 'group', name: 'priceGroup', getObjects: () => [] }
    expect(isLikelyPriceGroupObject(g, noPreserve)).toBe(true)
  })

  it('name=priceGroup mas misnamed (parece card): false', () => {
    const g = {
      type: 'group',
      name: 'priceGroup',
      isSmartObject: true,
      getObjects: () => []
    }
    expect(isLikelyPriceGroupObject(g, noPreserve)).toBe(false)
  })

  it('card container (isProductCard): false', () => {
    const g = { type: 'group', isProductCard: true, getObjects: () => [] }
    expect(isLikelyPriceGroupObject(g, noPreserve)).toBe(false)
  })

  it('manual layout preservado: true', () => {
    const g = { type: 'group', getObjects: () => [] }
    expect(isLikelyPriceGroupObject(g, () => true)).toBe(true)
  })

  it('group sem name mas com priceLayoutNode child: true', () => {
    const g = {
      type: 'group',
      getObjects: () => [{ name: 'priceInteger' }]
    }
    expect(isLikelyPriceGroupObject(g, noPreserve)).toBe(true)
  })

  it('group sem name e sem priceLayoutNode child: false', () => {
    const g = {
      type: 'group',
      getObjects: () => [{ name: 'random' }]
    }
    expect(isLikelyPriceGroupObject(g, noPreserve)).toBe(false)
  })
})

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

describe('hasCorruptedPriceLayout', () => {
  const makeGroup = (groupProps: any, children: any[]) => ({
    type: 'group',
    scaleX: 1, scaleY: 1,
    ...groupProps,
    getObjects: () => children
  })

  const validNode = (overrides: any = {}) => ({
    name: 'priceInteger',
    type: 'text',
    left: 0, top: 0,
    scaleX: 1, scaleY: 1,
    fontSize: 12,
    visible: true,
    ...overrides
  })

  it('null/sem getObjects → false (no-op)', () => {
    expect(hasCorruptedPriceLayout(null)).toBe(false)
    expect(hasCorruptedPriceLayout({})).toBe(false)
  })

  it('group sem nodos de price layout → false', () => {
    const group = makeGroup({}, [{ name: 'random', type: 'rect' }])
    expect(hasCorruptedPriceLayout(group)).toBe(false)
  })

  it('group com nodos validos → false', () => {
    const group = makeGroup({}, [validNode()])
    expect(hasCorruptedPriceLayout(group)).toBe(false)
  })

  it('scaleX/Y do group invalido (NaN) → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({ scaleX: NaN }, [validNode()]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({ scaleY: NaN }, [validNode()]))).toBe(true)
  })

  it('scaleX/Y do group ~0 → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({ scaleX: 0.00001 }, [validNode()]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({ scaleY: 0 }, [validNode()]))).toBe(true)
  })

  it('node left/top NaN → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ left: NaN })]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ top: NaN })]))).toBe(true)
  })

  it('node scaleX/Y NaN → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ scaleX: NaN })]))).toBe(true)
  })

  it('node coords > 100k → true (deslocamento absurdo)', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ left: 100001 })]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ top: -100001 })]))).toBe(true)
  })

  it('node visible escala ~0 → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ scaleX: 0.00001 })]))).toBe(true)
  })

  it('node hidden com escala ~0 → false (e ok ficar invisivel)', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [
      validNode({ visible: false, scaleX: 0 })
    ]))).toBe(false)
  })

  it('text node visivel com fontSize <= 0 → true', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ fontSize: 0 })]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ fontSize: -5 })]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({}, [validNode({ fontSize: NaN })]))).toBe(true)
  })

  it('text node hidden com fontSize 0 → false (ok escondido)', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [
      validNode({ visible: false, fontSize: 0 })
    ]))).toBe(false)
  })

  it('non-text node com fontSize 0 → false (so afeta texto)', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [
      validNode({ type: 'rect', fontSize: 0 })
    ]))).toBe(false)
  })

  it('itext/textbox tambem validados', () => {
    expect(hasCorruptedPriceLayout(makeGroup({}, [
      validNode({ type: 'i-text', fontSize: 0 })
    ]))).toBe(true)
    expect(hasCorruptedPriceLayout(makeGroup({}, [
      validNode({ type: 'textbox', fontSize: 0 })
    ]))).toBe(true)
  })
})

describe('getPriceGroupFromAny', () => {
  const makeGroup = (props: any, kids: any[] = []) => ({
    type: 'group',
    getObjects: () => kids,
    ...props
  })

  it('null/undefined: null', () => {
    expect(getPriceGroupFromAny(null)).toBe(null)
    expect(getPriceGroupFromAny(undefined)).toBe(null)
  })

  it('direct: group com name=priceGroup retorna ele mesmo', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [
      { type: 'rect' }, { type: 'text' }
    ])
    expect(getPriceGroupFromAny(pg)).toBe(pg)
  })

  it('walk-up: child de priceGroup retorna o grupo pai', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [])
    const child = { type: 'text', group: pg }
    expect(getPriceGroupFromAny(child)).toBe(pg)
  })

  it('walk-down: card group retorna priceGroup interno', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [
      { type: 'rect' }, { type: 'text' }
    ])
    const card = makeGroup({ isProductCard: true }, [pg])
    expect(getPriceGroupFromAny(card)).toBe(pg)
  })

  it('heuristica: group sem name mas com rect+text e' + ' detectado e renomeado', () => {
    const pg = makeGroup({}, [
      { type: 'rect' }, { type: 'text' }
    ])
    const result = getPriceGroupFromAny(pg)
    expect(result).toBe(pg)
    expect(pg.name).toBe('priceGroup')
  })

  it('group nao-priceGroup-like: null', () => {
    const g = makeGroup({}, [])
    expect(getPriceGroupFromAny(g)).toBe(null)
  })

  it('object simples (nao group): null', () => {
    expect(getPriceGroupFromAny({ type: 'rect' })).toBe(null)
    expect(getPriceGroupFromAny({ type: 'text' })).toBe(null)
  })
})

describe('getCardGroupFromAny', () => {
  it('null/undefined: null', () => {
    expect(getCardGroupFromAny(null)).toBe(null)
    expect(getCardGroupFromAny(undefined)).toBe(null)
  })

  it('direct smartObject: retorna ele mesmo', () => {
    const card = { type: 'group', isSmartObject: true }
    expect(getCardGroupFromAny(card)).toBe(card)
  })

  it('direct productCard: retorna ele mesmo', () => {
    const card = { type: 'group', isProductCard: true }
    expect(getCardGroupFromAny(card)).toBe(card)
  })

  it('walk-up: child de card group retorna o card', () => {
    const card = { type: 'group', isProductCard: true }
    const child = { type: 'rect', group: card }
    expect(getCardGroupFromAny(child)).toBe(card)
  })

  it('group sem flags: null', () => {
    const g = { type: 'group' }
    expect(getCardGroupFromAny(g)).toBe(null)
  })

  it('walk-up via 2 niveis aninhados', () => {
    const card = { type: 'group', isProductCard: true }
    const middle = { type: 'group', group: card }
    const leaf = { type: 'rect', group: middle }
    expect(getCardGroupFromAny(leaf)).toBe(card)
  })
})

describe('getSinglePriceBackgroundCandidate', () => {
  it('lista vazia: null', () => {
    expect(getSinglePriceBackgroundCandidate([])).toBe(null)
  })

  it('por nome: price_bg vence', () => {
    const objs = [{ name: 'price_bg', type: 'rect' }, { name: 'splash_image', type: 'image' }]
    expect(getSinglePriceBackgroundCandidate(objs)).toBe(objs[0])
  })

  it('por nome: price_bg_image como fallback', () => {
    const objs = [{ name: 'price_bg_image', type: 'image' }]
    expect(getSinglePriceBackgroundCandidate(objs)).toBe(objs[0])
  })

  it('por nome: splash_image como ultimo fallback', () => {
    const objs = [{ name: 'splash_image', type: 'image' }]
    expect(getSinglePriceBackgroundCandidate(objs)).toBe(objs[0])
  })

  it('fallback por area: maior image vence', () => {
    const small = { type: 'image', width: 50, height: 50 }
    const big = { type: 'image', width: 200, height: 200 }
    expect(getSinglePriceBackgroundCandidate([small, big])).toBe(big)
  })

  it('rejeita price_currency_bg / priceSymbolBg', () => {
    const objs = [{ name: 'price_currency_bg', type: 'rect' }]
    expect(getSinglePriceBackgroundCandidate(objs)).toBe(null)
  })

  it('rejeita price_header_bg', () => {
    const objs = [{ name: 'price_header_bg', type: 'rect' }]
    expect(getSinglePriceBackgroundCandidate(objs)).toBe(null)
  })

  it('rejeita prefixos atac_/retail_/wholesale_', () => {
    expect(getSinglePriceBackgroundCandidate([{ name: 'atac_retail_bg', type: 'rect' }])).toBe(null)
    expect(getSinglePriceBackgroundCandidate([{ name: 'retail_bg', type: 'rect' }])).toBe(null)
    expect(getSinglePriceBackgroundCandidate([{ name: 'wholesale_bg', type: 'rect' }])).toBe(null)
  })

  it('aceita rect sem nome', () => {
    const r = { type: 'rect', width: 100, height: 100 }
    expect(getSinglePriceBackgroundCandidate([r])).toBe(r)
  })
})

describe('getSinglePriceBackgroundImageCandidate', () => {
  it('SO aceita type=image (rejeita rect)', () => {
    const r = { type: 'rect', width: 100, height: 100 }
    expect(getSinglePriceBackgroundImageCandidate([r])).toBe(null)
  })

  it('por nome: price_bg_image (so se for type image)', () => {
    const named = { name: 'price_bg_image', type: 'image' }
    expect(getSinglePriceBackgroundImageCandidate([named])).toBe(named)
  })

  it('nome canonico mas type !== image: cai no fallback', () => {
    const objs: any[] = [
      { name: 'price_bg_image', type: 'rect' }, // ignorado pelo named (nao e image)
      { name: 'foo', type: 'image', width: 100, height: 100 }
    ]
    expect(getSinglePriceBackgroundImageCandidate(objs)).toBe(objs[1])
  })

  it('lista vazia: null', () => {
    expect(getSinglePriceBackgroundImageCandidate([])).toBe(null)
  })
})

describe('getSinglePriceCurrencyTextCandidate', () => {
  it('price_currency_text vence', () => {
    const objs = [
      { name: 'price_currency' },
      { name: 'price_currency_text' },
      { name: 'priceSymbol' }
    ]
    expect(getSinglePriceCurrencyTextCandidate(objs)).toBe(objs[1])
  })

  it('priceSymbol como fallback', () => {
    const objs = [{ name: 'priceSymbol' }]
    expect(getSinglePriceCurrencyTextCandidate(objs)).toBe(objs[0])
  })

  it('price_currency como ultimo fallback', () => {
    const objs = [{ name: 'price_currency' }]
    expect(getSinglePriceCurrencyTextCandidate(objs)).toBe(objs[0])
  })

  it('lista sem candidatos: undefined (findByName returns undefined)', () => {
    // findByName retorna undefined quando nao acha; chained || passa undefined
    expect(getSinglePriceCurrencyTextCandidate([{ name: 'foo' }])).toBeUndefined()
  })
})
