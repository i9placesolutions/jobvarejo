import { describe, it, expect } from 'vitest'
import {
  getZoneRect,
  isLikelyProductZone,
  isStandalonePriceGroup,
  isLikelyProductCard,
  isProductCardContainer,
  isTextLikeObject,
  collectObjectsDeep,
  findByName,
  isPriceGroupOrPriceChild,
  isPathCloseCommand,
  isVectorPathClosed,
  hasObjectMaskApplied,
  isActiveSelectionObject,
  hasParentZoneBinding,
  isCardLikeForZoneBinding
} from '~/utils/fabricObjectClassifiers'

// Helpers de mock — todos seguem duck typing de Fabric.
const makeGroup = (overrides: any = {}, children: any[] = []) => ({
  type: 'group',
  getObjects: () => children,
  ...overrides
})
const makeRect = (overrides: any = {}) => ({
  type: 'rect',
  ...overrides
})
const makeText = (overrides: any = {}) => ({
  type: 'i-text',
  ...overrides
})
const makeImage = (overrides: any = {}) => ({
  type: 'image',
  ...overrides
})

describe('isTextLikeObject', () => {
  it('aceita variantes de texto Fabric', () => {
    expect(isTextLikeObject({ type: 'text' })).toBe(true)
    expect(isTextLikeObject({ type: 'i-text' })).toBe(true)
    expect(isTextLikeObject({ type: 'textbox' })).toBe(true)
    expect(isTextLikeObject({ type: 'I-Text' })).toBe(true) // case-insensitive
  })

  it('rejeita nao-texto', () => {
    expect(isTextLikeObject({ type: 'rect' })).toBe(false)
    expect(isTextLikeObject({ type: 'image' })).toBe(false)
    expect(isTextLikeObject({ type: 'group' })).toBe(false)
    expect(isTextLikeObject(null)).toBe(false)
    expect(isTextLikeObject(undefined)).toBe(false)
  })
})

describe('getZoneRect', () => {
  it('retorna proprio rect quando obj.type=rect', () => {
    const rect = makeRect({ name: 'foo' })
    expect(getZoneRect(rect)).toBe(rect)
  })

  it('null/undefined retornam null', () => {
    expect(getZoneRect(null)).toBeNull()
    expect(getZoneRect(undefined)).toBeNull()
  })

  it('objeto sem getObjects retorna null', () => {
    expect(getZoneRect({ type: 'image' })).toBeNull()
  })

  it('group: prefere zoneRect / zone-border / dashed sobre rect generico', () => {
    const generic = makeRect({ name: 'foo' })
    const zoneRect = makeRect({ name: 'zoneRect' })
    const group = makeGroup({}, [generic, zoneRect])
    expect(getZoneRect(group)).toBe(zoneRect)
  })

  it('group: aceita stroke dashed como sinal', () => {
    const dashed = makeRect({ name: 'border', strokeDashArray: [10, 10] })
    const group = makeGroup({}, [makeRect({ name: 'plain' }), dashed])
    expect(getZoneRect(group)).toBe(dashed)
  })

  it('group: fallback para qualquer rect quando nao ha sinal forte', () => {
    const plain = makeRect({ name: 'plain' })
    const group = makeGroup({}, [makeText({}), plain])
    expect(getZoneRect(group)).toBe(plain)
  })

  it('group sem rect: retorna null', () => {
    const group = makeGroup({}, [makeText({}), makeImage({})])
    expect(getZoneRect(group)).toBeNull()
  })
})

describe('isLikelyProductZone — deteccao de zona de produtos', () => {
  it('rejeita null e nao-group', () => {
    expect(isLikelyProductZone(null)).toBe(false)
    expect(isLikelyProductZone({ type: 'rect' })).toBe(false)
    expect(isLikelyProductZone({ type: 'image' })).toBe(false)
  })

  it('aceita por flag direta', () => {
    expect(isLikelyProductZone(makeGroup({ isProductZone: true }))).toBe(true)
    expect(isLikelyProductZone(makeGroup({ isGridZone: true }))).toBe(true)
  })

  it('aceita por name', () => {
    expect(isLikelyProductZone(makeGroup({ name: 'productZoneContainer' }))).toBe(true)
    expect(isLikelyProductZone(makeGroup({ name: 'gridZone' }))).toBe(true)
  })

  it('aceita por propriedades zone-specific (legado)', () => {
    expect(isLikelyProductZone(makeGroup({
      _zonePadding: 10,
      _zoneWidth: 200,
      _zoneHeight: 150
    }))).toBe(true)
  })

  it('REGRESSAO: dashed-rect SOZINHO nao e' + ' zone (evita falsos positivos em setas/anotacoes)', () => {
    const dashed = makeRect({ strokeDashArray: [10, 10] })
    const arrowGroup = makeGroup({ name: 'arrow' }, [dashed])
    expect(isLikelyProductZone(arrowGroup)).toBe(false)
  })

  it('aceita dashed-rect + sinal zone-specific (legado)', () => {
    const dashed = makeRect({ strokeDashArray: [10, 10] })
    const zone = makeGroup({ _zoneGlobalStyles: { fill: '#fff' } }, [dashed])
    expect(isLikelyProductZone(zone)).toBe(true)
    expect(isLikelyProductZone(makeGroup({ zoneName: 'A' }, [dashed]))).toBe(true)
    expect(isLikelyProductZone(makeGroup({ _zoneTemplateSnapshotId: 'tpl-1' }, [dashed]))).toBe(true)
    expect(isLikelyProductZone(makeGroup({ role: 'zone' }, [dashed]))).toBe(true)
  })
})

describe('isStandalonePriceGroup — etiqueta de preco solta', () => {
  it('rejeita group sem name=priceGroup', () => {
    expect(isStandalonePriceGroup(makeGroup({ name: 'priceTag' }))).toBe(false)
  })

  it('rejeita quando ja esta vinculado a card/zone (priceGroup interno)', () => {
    const pg = makeGroup({ name: 'priceGroup', isProductCard: true }, [])
    expect(isStandalonePriceGroup(pg)).toBe(false)
    expect(isStandalonePriceGroup(makeGroup({ name: 'priceGroup', isSmartObject: true }, []))).toBe(false)
    expect(isStandalonePriceGroup(makeGroup({ name: 'priceGroup', parentZoneId: 'z1' }, []))).toBe(false)
    expect(isStandalonePriceGroup(makeGroup({ name: 'priceGroup', smartGridId: 'g1' }, []))).toBe(false)
  })

  it('rejeita quando tem offerBackground (e card, nao etiqueta)', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [makeRect({ name: 'offerBackground' })])
    expect(isStandalonePriceGroup(pg)).toBe(false)
  })

  it('rejeita quando tem imagem (e card)', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [makeImage({ name: 'smart_image' })])
    expect(isStandalonePriceGroup(pg)).toBe(false)
  })

  it('aceita priceGroup so com textos/backgrounds da etiqueta', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [
      makeText({ name: 'price_integer_text' }),
      makeText({ name: 'price_decimal_text' }),
      makeRect({ name: 'price_bg' })
    ])
    expect(isStandalonePriceGroup(pg)).toBe(true)
  })
})

describe('isLikelyProductCard — card de produto', () => {
  it('rejeita objetos triviais', () => {
    expect(isLikelyProductCard(null)).toBe(false)
    expect(isLikelyProductCard({ type: 'rect' })).toBe(false)
    expect(isLikelyProductCard({ type: 'group' })).toBe(false) // sem getObjects
    expect(isLikelyProductCard(makeGroup({ excludeFromExport: true }))).toBe(false)
    expect(isLikelyProductCard(makeGroup({ isFrame: true }))).toBe(false)
  })

  it('rejeita zone (mesmo group)', () => {
    expect(isLikelyProductCard(makeGroup({ isProductZone: true }))).toBe(false)
  })

  it('rejeita etiqueta solta (priceGroup standalone)', () => {
    const pg = makeGroup({ name: 'priceGroup' }, [makeText({ name: 'price_integer_text' })])
    expect(isLikelyProductCard(pg)).toBe(false)
  })

  it('aceita card com parentZoneId (binding direto)', () => {
    expect(isLikelyProductCard(makeGroup({ parentZoneId: 'zone-1' }, [makeText({})]))).toBe(true)
  })

  it('aceita card com _cardWidth/_cardHeight (engine signal)', () => {
    expect(isLikelyProductCard(makeGroup({
      _cardWidth: 200,
      _cardHeight: 280
    }, [makeText({})]))).toBe(true)
  })

  it('aceita card com smartGridId / priceMode', () => {
    expect(isLikelyProductCard(makeGroup({ smartGridId: 'g1' }, []))).toBe(true)
    expect(isLikelyProductCard(makeGroup({ priceMode: 'unit' }, []))).toBe(true)
  })

  it('aceita por offerBackground (sinal forte)', () => {
    const card = makeGroup({}, [
      makeRect({ name: 'offerBackground' }),
      makeText({ name: 'smart_title' })
    ])
    expect(isLikelyProductCard(card)).toBe(true)
  })

  it('aceita priceGroup + title/imagem', () => {
    const card = makeGroup({}, [
      makeGroup({ name: 'priceGroup' }, []),
      makeText({ name: 'smart_title' }),
      makeImage({ name: 'smart_image' })
    ])
    expect(isLikelyProductCard(card)).toBe(true)
  })

  it('REGRESSAO: heuristica mais permissiva exige texto + visual', () => {
    // Apenas texto sem nada visual → nao card
    const onlyText = makeGroup({}, [makeText({}), makeText({})])
    expect(isLikelyProductCard(onlyText)).toBe(false)
  })

  it('rejeita group vazio (children.length === 0)', () => {
    expect(isLikelyProductCard(makeGroup({}, []))).toBe(false)
  })
})

describe('collectObjectsDeep — walk em profundidade', () => {
  it('arvore vazia retorna []', () => {
    expect(collectObjectsDeep(null)).toEqual([])
    expect(collectObjectsDeep({})).toEqual([])
    expect(collectObjectsDeep(makeGroup({}, []))).toEqual([])
  })

  it('coleta filhos diretos', () => {
    const t1 = makeText({ id: 1 })
    const t2 = makeText({ id: 2 })
    const root = makeGroup({}, [t1, t2])
    expect(collectObjectsDeep(root)).toEqual([t1, t2])
  })

  it('desce em grupos aninhados', () => {
    const leaf1 = makeText({ id: 'leaf1' })
    const leaf2 = makeText({ id: 'leaf2' })
    const inner = makeGroup({ id: 'inner' }, [leaf1, leaf2])
    const root = makeGroup({}, [inner])
    const flat = collectObjectsDeep(root)
    expect(flat).toEqual([inner, leaf1, leaf2])
  })

  it('preserva ordem de visita (DFS)', () => {
    const a = makeText({ id: 'a' })
    const b = makeText({ id: 'b' })
    const inner = makeGroup({ id: 'inner' }, [a, b])
    const c = makeText({ id: 'c' })
    const root = makeGroup({}, [inner, c])
    const ids = collectObjectsDeep(root).map((o: any) => o.id)
    expect(ids).toEqual(['inner', 'a', 'b', 'c'])
  })
})

describe('findByName', () => {
  it('encontra por name', () => {
    const a = { name: 'a' }
    const b = { name: 'b' }
    expect(findByName([a, b], 'b')).toBe(b)
  })

  it('retorna undefined quando nao encontra', () => {
    expect(findByName([{ name: 'a' }], 'z')).toBeUndefined()
  })

  it('lista vazia retorna undefined', () => {
    expect(findByName([], 'a')).toBeUndefined()
  })
})

describe('isProductCardContainer', () => {
  it('rejeita null/nao-group', () => {
    expect(isProductCardContainer(null)).toBe(false)
    expect(isProductCardContainer({ type: 'rect' })).toBe(false)
  })

  it('aceita por flag isSmartObject/isProductCard', () => {
    expect(isProductCardContainer(makeGroup({ isSmartObject: true }))).toBe(true)
    expect(isProductCardContainer(makeGroup({ isProductCard: true }))).toBe(true)
  })

  it('aceita por prefixo "product-card" no name', () => {
    expect(isProductCardContainer(makeGroup({ name: 'product-card-1' }))).toBe(true)
    expect(isProductCardContainer(makeGroup({ name: 'product-card-abc' }))).toBe(true)
  })

  it('cai em isLikelyProductCard como fallback', () => {
    // group com offerBackground passa em isLikelyProductCard
    const card = makeGroup({}, [
      makeRect({ name: 'offerBackground' }),
      makeText({ name: 'smart_title' })
    ])
    expect(isProductCardContainer(card)).toBe(true)
  })

  it('rejeita group nao-card sem flag', () => {
    expect(isProductCardContainer(makeGroup({}, []))).toBe(false)
  })
})

describe('isPriceGroupOrPriceChild', () => {
  it('retorna true para o priceGroup proprio', () => {
    expect(isPriceGroupOrPriceChild({ name: 'priceGroup' })).toBe(true)
  })

  it('retorna true para filho direto de priceGroup', () => {
    const pg = { name: 'priceGroup' }
    const child = { name: 'price_integer_text', group: pg }
    expect(isPriceGroupOrPriceChild(child)).toBe(true)
  })

  it('retorna false para neto (group.group=priceGroup, mas group nao e' + ' direto)', () => {
    const pg = { name: 'priceGroup' }
    const inner = { name: 'inner-group', group: pg }
    const grandChild = { name: 'leaf', group: inner }
    expect(isPriceGroupOrPriceChild(grandChild)).toBe(false)
  })

  it('rejeita null e objetos sem name', () => {
    expect(isPriceGroupOrPriceChild(null)).toBe(false)
    expect(isPriceGroupOrPriceChild({})).toBe(false)
    expect(isPriceGroupOrPriceChild({ name: 'card', group: { name: 'whatever' } })).toBe(false)
  })
})

describe('isPathCloseCommand', () => {
  it('aceita "Z" / "z" como string solta', () => {
    expect(isPathCloseCommand('Z')).toBe(true)
    expect(isPathCloseCommand('z')).toBe(true)
  })

  it('aceita ["Z"] / ["z"] como array', () => {
    expect(isPathCloseCommand(['Z'])).toBe(true)
    expect(isPathCloseCommand(['z'])).toBe(true)
    expect(isPathCloseCommand(['z', 0, 0])).toBe(true) // primeiro item importa
  })

  it('rejeita outros comandos', () => {
    expect(isPathCloseCommand('M')).toBe(false)
    expect(isPathCloseCommand(['L', 1, 2])).toBe(false)
    expect(isPathCloseCommand(['C', 0, 0, 0, 0])).toBe(false)
  })

  it('rejeita null/undefined/array vazio', () => {
    expect(isPathCloseCommand(null)).toBe(false)
    expect(isPathCloseCommand(undefined)).toBe(false)
    expect(isPathCloseCommand([])).toBe(false)
  })
})

describe('isVectorPathClosed', () => {
  it('aceita por flag isClosedPath', () => {
    expect(isVectorPathClosed({ isClosedPath: true })).toBe(true)
  })

  it('aceita quando ha segmento Z em path[]', () => {
    expect(isVectorPathClosed({
      path: [['M', 0, 0], ['L', 10, 10], ['Z']]
    })).toBe(true)
  })

  it('rejeita path aberto (sem Z, sem flag)', () => {
    expect(isVectorPathClosed({
      path: [['M', 0, 0], ['L', 10, 10]]
    })).toBe(false)
  })

  it('rejeita null/sem path', () => {
    expect(isVectorPathClosed(null)).toBe(false)
    expect(isVectorPathClosed({})).toBe(false)
  })

  it('path com elementos invalidos cai em segments=[]', () => {
    expect(isVectorPathClosed({ path: 'not-array' })).toBe(false)
  })
})

describe('hasObjectMaskApplied', () => {
  it('aceita quando tem clipPath + objectMaskEnabled + sem _frameClipOwner', () => {
    expect(hasObjectMaskApplied({
      clipPath: { type: 'rect' },
      objectMaskEnabled: true
    })).toBe(true)
  })

  it('rejeita sem clipPath', () => {
    expect(hasObjectMaskApplied({ objectMaskEnabled: true })).toBe(false)
    expect(hasObjectMaskApplied({})).toBe(false)
  })

  it('rejeita com _frameClipOwner (clip de frame, nao mask)', () => {
    expect(hasObjectMaskApplied({
      clipPath: { type: 'rect' },
      objectMaskEnabled: true,
      _frameClipOwner: { id: 'frame-1' }
    })).toBe(false)
  })

  it('rejeita sem flag objectMaskEnabled', () => {
    expect(hasObjectMaskApplied({
      clipPath: { type: 'rect' }
    })).toBe(false)
  })

  it('rejeita null/undefined/primitivo', () => {
    expect(hasObjectMaskApplied(null)).toBe(false)
    expect(hasObjectMaskApplied(undefined)).toBe(false)
    expect(hasObjectMaskApplied('foo')).toBe(false)
  })
})

describe('isActiveSelectionObject', () => {
  it('aceita type=activeSelection (case insensitive)', () => {
    expect(isActiveSelectionObject({ type: 'activeSelection' })).toBe(true)
    expect(isActiveSelectionObject({ type: 'activeselection' })).toBe(true)
    expect(isActiveSelectionObject({ type: 'ACTIVESELECTION' })).toBe(true)
  })

  it('rejeita outros tipos', () => {
    expect(isActiveSelectionObject({ type: 'group' })).toBe(false)
    expect(isActiveSelectionObject({ type: 'rect' })).toBe(false)
    expect(isActiveSelectionObject(null)).toBe(false)
    expect(isActiveSelectionObject({})).toBe(false)
  })
})

describe('hasParentZoneBinding', () => {
  it('aceita parentZoneId nao-vazio', () => {
    expect(hasParentZoneBinding({ parentZoneId: 'zone-1' })).toBe(true)
    expect(hasParentZoneBinding({ parentZoneId: '  zone-1  ' })).toBe(true)
  })

  it('rejeita parentZoneId vazio/whitespace/missing', () => {
    expect(hasParentZoneBinding({ parentZoneId: '' })).toBe(false)
    expect(hasParentZoneBinding({ parentZoneId: '   ' })).toBe(false)
    expect(hasParentZoneBinding({})).toBe(false)
    expect(hasParentZoneBinding(null)).toBe(false)
  })
})

describe('isCardLikeForZoneBinding', () => {
  it('rejeita objetos triviais e nao-grupos', () => {
    expect(isCardLikeForZoneBinding(null)).toBe(false)
    expect(isCardLikeForZoneBinding({ type: 'rect' })).toBe(false)
    expect(isCardLikeForZoneBinding({ type: 'group', isFrame: true })).toBe(false)
    expect(isCardLikeForZoneBinding({ type: 'group', excludeFromExport: true })).toBe(false)
  })

  it('aceita por flag isSmartObject/isProductCard', () => {
    expect(isCardLikeForZoneBinding({ type: 'group', isSmartObject: true })).toBe(true)
    expect(isCardLikeForZoneBinding({ type: 'group', isProductCard: true })).toBe(true)
  })

  it('aceita por prefixo "product-card" no name', () => {
    expect(isCardLikeForZoneBinding({ type: 'group', name: 'product-card-1' })).toBe(true)
  })

  it('aceita por _cardWidth/_cardHeight legacy', () => {
    expect(isCardLikeForZoneBinding({
      type: 'group',
      _cardWidth: 100,
      _cardHeight: 200
    })).toBe(true)
  })

  it('aceita por smartGridId / priceMode legacy', () => {
    expect(isCardLikeForZoneBinding({ type: 'group', smartGridId: 'g1' })).toBe(true)
    expect(isCardLikeForZoneBinding({ type: 'group', priceMode: 'unit' })).toBe(true)
  })

  it('aceita por parentZoneId / _zoneSlot.zoneId direto', () => {
    expect(isCardLikeForZoneBinding({ type: 'group', parentZoneId: 'z1' })).toBe(true)
    expect(isCardLikeForZoneBinding({
      type: 'group',
      _zoneSlot: { zoneId: 'z1' }
    })).toBe(true)
  })

  it('rejeita group sem nenhum sinal', () => {
    expect(isCardLikeForZoneBinding({ type: 'group' })).toBe(false)
  })
})
