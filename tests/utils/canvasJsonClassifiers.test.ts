import { describe, it, expect, vi } from 'vitest'
import {
  walkCanvasObjects,
  getJsonGroupChildren,
  isStandalonePriceGroupJson,
  isLikelyProductCardJson,
  getCardBaseSizeForContainmentJson,
  cloneTemplateGroupJson,
  getJsonObjectSize,
  getJsonObjectCenterInParentPlane,
  setJsonObjectCenterInParentPlane,
  collectJsonDescendantsWithParent,
  collectTemplateJsonNodes,
  isTemplateGroupJsonRenderable,
  isAtacarejoTemplateGroupJson,
  isRedBurstTemplateGroupJson
} from '~/utils/canvasJsonClassifiers'

// Mocks JSON-style: nodos com `objects` em vez de getObjects().
const node = (overrides: any = {}, children?: any[]) => ({
  type: 'group',
  ...overrides,
  ...(children !== undefined ? { objects: children } : {})
})

describe('walkCanvasObjects — DFS no JSON serializado', () => {
  it('root null/undefined nao quebra', () => {
    const visitor = vi.fn()
    expect(() => walkCanvasObjects(null, visitor)).not.toThrow()
    expect(() => walkCanvasObjects(undefined, visitor)).not.toThrow()
    expect(visitor).not.toHaveBeenCalled()
  })

  it('root sem objects nao chama visitor', () => {
    const visitor = vi.fn()
    walkCanvasObjects({}, visitor)
    expect(visitor).not.toHaveBeenCalled()
  })

  it('visita todos os filhos diretos do root', () => {
    // Documenta comportamento atual: stack LIFO sem reversao no root,
    // entao a ordem e' inversa para children diretos do root. Filhos de
    // groups internos ja' sao reverenciados (preservam ordem natural).
    const a = { id: 'a', type: 'rect' }
    const b = { id: 'b', type: 'i-text' }
    const visited: any[] = []
    walkCanvasObjects({ objects: [a, b] }, (n: any) => visited.push(n.id))
    expect(visited).toContain('a')
    expect(visited).toContain('b')
    expect(visited.length).toBe(2)
  })

  it('desce em groups aninhados', () => {
    const leaf = { id: 'leaf' }
    const inner = { id: 'inner', type: 'group', objects: [leaf] }
    const root = { objects: [inner] }
    const visited: any[] = []
    walkCanvasObjects(root, (n: any) => visited.push(n.id))
    expect(visited).toContain('inner')
    expect(visited).toContain('leaf')
  })

  it('ignora entradas null/string dentro de objects', () => {
    const a = { id: 'a' }
    const visitor = vi.fn()
    walkCanvasObjects({ objects: [null, 'str' as any, a, undefined] }, visitor)
    expect(visitor).toHaveBeenCalledTimes(1)
  })

  it('iterativo — niveis profundos nao causam stack overflow', () => {
    let deepest: any = { id: 'leaf' }
    for (let i = 0; i < 1000; i += 1) {
      deepest = { id: `n${i}`, type: 'group', objects: [deepest] }
    }
    const visited: string[] = []
    walkCanvasObjects({ objects: [deepest] }, (n: any) => visited.push(n.id))
    // n0..n999 + leaf = 1001 visitas
    expect(visited.length).toBe(1001)
    expect(visited[visited.length - 1]).toBe('leaf')
  })
})

describe('getJsonGroupChildren', () => {
  it('retorna [] quando obj null/sem objects', () => {
    expect(getJsonGroupChildren(null)).toEqual([])
    expect(getJsonGroupChildren({})).toEqual([])
    expect(getJsonGroupChildren({ objects: 'not-array' })).toEqual([])
  })

  it('retorna apenas children que sao objetos validos', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const result = getJsonGroupChildren({ objects: [a, null, 'str', b, 42, undefined] })
    expect(result).toEqual([a, b])
  })
})

describe('isStandalonePriceGroupJson', () => {
  const validStandalone = node({ name: 'priceGroup' }, [
    { name: 'price_integer_text', type: 'text' },
    { name: 'price_decimal_text', type: 'text' }
  ])

  it('aceita priceGroup sem offerBg/imagem como standalone', () => {
    expect(isStandalonePriceGroupJson(validStandalone)).toBe(true)
  })

  it('rejeita quando tem offerBackground (e card embutido, nao standalone)', () => {
    const withBg = node({ name: 'priceGroup' }, [
      { name: 'offerBackground', type: 'rect' }
    ])
    expect(isStandalonePriceGroupJson(withBg)).toBe(false)
  })

  it('rejeita quando tem imagem do card', () => {
    const withImage = node({ name: 'priceGroup' }, [
      { name: 'smart_image', type: 'image' }
    ])
    expect(isStandalonePriceGroupJson(withImage)).toBe(false)
  })

  it('rejeita quando esta marcado como smart object/card', () => {
    expect(isStandalonePriceGroupJson(node({ name: 'priceGroup', isSmartObject: true }, []))).toBe(false)
    expect(isStandalonePriceGroupJson(node({ name: 'priceGroup', isProductCard: true }, []))).toBe(false)
  })

  it('rejeita quando tem parentZoneId / smartGridId', () => {
    expect(isStandalonePriceGroupJson(node({ name: 'priceGroup', parentZoneId: 'z1' }, []))).toBe(false)
    expect(isStandalonePriceGroupJson(node({ name: 'priceGroup', smartGridId: 'g1' }, []))).toBe(false)
  })

  it('rejeita group sem name=priceGroup', () => {
    expect(isStandalonePriceGroupJson(node({ name: 'priceTag' }, []))).toBe(false)
    expect(isStandalonePriceGroupJson(node({ name: '' }, []))).toBe(false)
  })

  it('rejeita null/nao-group', () => {
    expect(isStandalonePriceGroupJson(null)).toBe(false)
    expect(isStandalonePriceGroupJson({ type: 'rect' })).toBe(false)
  })
})

describe('isLikelyProductCardJson', () => {
  it('rejeita null/nao-group/excludeFromExport/isFrame', () => {
    expect(isLikelyProductCardJson(null)).toBe(false)
    expect(isLikelyProductCardJson({ type: 'rect' })).toBe(false)
    expect(isLikelyProductCardJson(node({ excludeFromExport: true }, []))).toBe(false)
    expect(isLikelyProductCardJson(node({ isFrame: true }, []))).toBe(false)
  })

  it('rejeita standalone priceGroup', () => {
    const pg = node({ name: 'priceGroup' }, [
      { name: 'price_integer_text', type: 'text' }
    ])
    expect(isLikelyProductCardJson(pg)).toBe(false)
  })

  it('aceita por parentZoneId direto', () => {
    expect(isLikelyProductCardJson(node({ parentZoneId: 'z1' }, [{ type: 'text' }]))).toBe(true)
  })

  it('aceita por _cardWidth/_cardHeight', () => {
    expect(isLikelyProductCardJson(node({
      _cardWidth: 200, _cardHeight: 280
    }, [{ type: 'text' }]))).toBe(true)
  })

  it('aceita por smartGridId / priceMode / isSmartObject', () => {
    expect(isLikelyProductCardJson(node({ smartGridId: 'g1' }, []))).toBe(true)
    expect(isLikelyProductCardJson(node({ priceMode: 'unit' }, []))).toBe(true)
    expect(isLikelyProductCardJson(node({ isSmartObject: true }, []))).toBe(true)
    expect(isLikelyProductCardJson(node({ isProductCard: true }, []))).toBe(true)
  })

  it('aceita por offerBackground (sinal forte)', () => {
    expect(isLikelyProductCardJson(node({}, [
      { name: 'offerBackground', type: 'rect' },
      { name: 'smart_title', type: 'text' }
    ]))).toBe(true)
  })

  it('aceita priceGroup embutido + title + imagem', () => {
    expect(isLikelyProductCardJson(node({}, [
      { name: 'priceGroup', type: 'group' },
      { name: 'smart_title', type: 'text' },
      { name: 'smart_image', type: 'image' }
    ]))).toBe(true)
  })

  it('rejeita group vazio', () => {
    expect(isLikelyProductCardJson(node({}, []))).toBe(false)
  })

  it('rejeita group so com texto sem visual', () => {
    expect(isLikelyProductCardJson(node({}, [
      { type: 'text' }, { type: 'text' }
    ]))).toBe(false)
  })
})

describe('getCardBaseSizeForContainmentJson', () => {
  it('null retorna null', () => {
    expect(getCardBaseSizeForContainmentJson(null)).toBeNull()
  })

  it('prioridade 1: _cardWidth/_cardHeight quando validos', () => {
    expect(getCardBaseSizeForContainmentJson({
      _cardWidth: 200,
      _cardHeight: 280,
      width: 999, // ignorado
      height: 999
    })).toEqual({ w: 200, h: 280 })
  })

  it('prioridade 2: offerBackground quando _cardWidth nao serve', () => {
    expect(getCardBaseSizeForContainmentJson({
      objects: [
        { name: 'offerBackground', type: 'rect', width: 150, height: 200 }
      ]
    })).toEqual({ w: 150, h: 200 })
  })

  it('prioridade 3: card.width/card.height fallback', () => {
    expect(getCardBaseSizeForContainmentJson({
      width: 100,
      height: 130
    })).toEqual({ w: 100, h: 130 })
  })

  it('retorna null quando nada disponivel', () => {
    expect(getCardBaseSizeForContainmentJson({})).toBeNull()
    expect(getCardBaseSizeForContainmentJson({ width: 0, height: 0 })).toBeNull()
    expect(getCardBaseSizeForContainmentJson({ _cardWidth: -1, _cardHeight: -1 })).toBeNull()
  })

  it('valores invalidos (NaN/Infinity) sao descartados', () => {
    expect(getCardBaseSizeForContainmentJson({
      _cardWidth: NaN,
      _cardHeight: NaN,
      width: Infinity,
      height: 200
    })).toBeNull()
  })
})

describe('cloneTemplateGroupJson — clone profundo de template', () => {
  it('null/undefined/nao-objeto retornam null', () => {
    expect(cloneTemplateGroupJson(null)).toBeNull()
    expect(cloneTemplateGroupJson(undefined)).toBeNull()
    expect(cloneTemplateGroupJson('str')).toBeNull()
    expect(cloneTemplateGroupJson(42)).toBeNull()
  })

  it('clone basico preserva todos os campos', () => {
    const tpl = { id: 't1', type: 'group', name: 'priceGroup', __preserveManualLayout: true }
    const cloned = cloneTemplateGroupJson(tpl)
    expect(cloned).toEqual(tpl)
    expect(cloned).not.toBe(tpl) // referencia diferente
  })

  it('clone profundo desconecta nested objects', () => {
    const original = {
      type: 'group',
      objects: [
        { id: 'a', type: 'i-text', text: 'old' },
        { id: 'b', type: 'group', objects: [{ id: 'leaf' }] }
      ]
    }
    const cloned = cloneTemplateGroupJson(original)
    cloned.objects[0].text = 'modified-clone'
    cloned.objects[1].objects[0].id = 'modified-leaf'
    expect(original.objects[0].text).toBe('old') // original intacto
    expect(original.objects[1].objects[0].id).toBe('leaf')
  })

  it('REGRESSAO: arrays e objetos aninhados nao sao compartilhados por ref', () => {
    // Bug historico: __atacValueVariants era atribuido por referencia,
    // editar variantes na copia mutava o template original.
    const original = {
      type: 'group',
      __atacValueVariants: {
        tiny: { intDecimalGap: 1 },
        normal: { intDecimalGap: 2 }
      }
    }
    const cloned = cloneTemplateGroupJson(original)
    cloned.__atacValueVariants.tiny.intDecimalGap = 99
    expect(original.__atacValueVariants.tiny.intDecimalGap).toBe(1)
  })

  it('preserva valores complexos via structuredClone (Date, RegExp etc.)', () => {
    const date = new Date(2026, 0, 1)
    const original = { type: 'group', _createdAt: date }
    const cloned = cloneTemplateGroupJson(original)
    expect(cloned._createdAt).toBeInstanceOf(Date)
    expect(cloned._createdAt.getTime()).toBe(date.getTime())
    expect(cloned._createdAt).not.toBe(date) // clone, nao mesma ref
  })

  it('fallback funciona quando structuredClone falha (valor nao-clonavel)', () => {
    // Funcoes nao sao clonaveis por structuredClone E nao por JSON.stringify
    // (sao silenciosamente removidas na 2a passada). Mas o objeto base
    // ainda e' clonado.
    const original: any = {
      type: 'group',
      onClick: () => 'fn', // nao clonavel
      keep: 'this-stays'
    }
    const cloned = cloneTemplateGroupJson(original)
    expect(cloned).toBeTruthy()
    expect(cloned.keep).toBe('this-stays')
  })

  it('clone vazio retorna objeto vazio', () => {
    const cloned = cloneTemplateGroupJson({})
    expect(cloned).toEqual({})
  })

  it('clone preserva estrutura objects[] mesmo apos clone raso', () => {
    const original = {
      type: 'group',
      objects: [
        { id: 'a' },
        { id: 'b', objects: [{ id: 'leaf' }] }
      ]
    }
    const cloned = cloneTemplateGroupJson(original)
    expect(Array.isArray(cloned.objects)).toBe(true)
    expect(cloned.objects.length).toBe(2)
    expect(cloned.objects[1].objects[0].id).toBe('leaf')
  })
})

describe('getJsonObjectSize', () => {
  it('basico: width*scaleX, height*scaleY', () => {
    expect(getJsonObjectSize({ width: 100, height: 50 })).toEqual({ width: 100, height: 50 })
    expect(getJsonObjectSize({ width: 100, height: 50, scaleX: 2, scaleY: 0.5 })).toEqual({ width: 200, height: 25 })
  })

  it('opts sobrescreve scale do objeto', () => {
    const obj = { width: 100, height: 50, scaleX: 5, scaleY: 5 }
    expect(getJsonObjectSize(obj, { scaleX: 1, scaleY: 1 })).toEqual({ width: 100, height: 50 })
  })

  it('aplica abs em scale negativo (flip)', () => {
    expect(getJsonObjectSize({ width: 100, height: 50, scaleX: -2, scaleY: -1 })).toEqual({ width: 200, height: 50 })
  })

  it('width/height invalidos retornam null', () => {
    expect(getJsonObjectSize({ width: 0, height: 100 })).toBeNull()
    expect(getJsonObjectSize({ width: 100, height: 0 })).toBeNull()
    expect(getJsonObjectSize({})).toBeNull()
  })

  it('width negativo e tomado em abs (defensivo)', () => {
    expect(getJsonObjectSize({ width: -10, height: 100 })).toEqual({ width: 10, height: 100 })
  })

  it('scale=0 cai para fallback 1', () => {
    // Math.abs(0) || 1 = 1, entao tamanho fica width*1
    expect(getJsonObjectSize({ width: 100, height: 50, scaleX: 0 })).toEqual({ width: 100, height: 50 })
  })
})

describe('getJsonObjectCenterInParentPlane', () => {
  it('originX=left/originY=top: centro = topo-esquerdo + half', () => {
    expect(getJsonObjectCenterInParentPlane({
      left: 10, top: 20, width: 100, height: 50
    })).toEqual({ x: 60, y: 45 })
  })

  it('originX=center/originY=center: centro = (left, top) literal', () => {
    expect(getJsonObjectCenterInParentPlane({
      left: 100, top: 100, width: 50, height: 50, originX: 'center', originY: 'center'
    })).toEqual({ x: 100, y: 100 })
  })

  it('originX=right: centro = left - half', () => {
    expect(getJsonObjectCenterInParentPlane({
      left: 100, top: 0, width: 50, height: 20, originX: 'right'
    })).toEqual({ x: 75, y: 10 })
  })

  it('size invalido retorna null', () => {
    expect(getJsonObjectCenterInParentPlane({})).toBeNull()
  })

  it('left/top NaN retorna null', () => {
    expect(getJsonObjectCenterInParentPlane({
      left: 'abc', top: 0, width: 100, height: 50
    })).toBeNull()
  })
})

describe('setJsonObjectCenterInParentPlane', () => {
  it('originX=left/top default: define left/top de modo que center bata', () => {
    const obj: any = { width: 100, height: 50 }
    expect(setJsonObjectCenterInParentPlane(obj, 100, 100)).toBe(true)
    expect(obj.left).toBe(50)
    expect(obj.top).toBe(75)
  })

  it('originX=center/originY=center: left/top = centro literal', () => {
    const obj: any = { width: 100, height: 50, originX: 'center', originY: 'center' }
    setJsonObjectCenterInParentPlane(obj, 200, 200)
    expect(obj.left).toBe(200)
    expect(obj.top).toBe(200)
  })

  it('roundtrip: set + get retorna o centro original', () => {
    const obj: any = { width: 80, height: 40 }
    setJsonObjectCenterInParentPlane(obj, 250, 100)
    const center = getJsonObjectCenterInParentPlane(obj)
    expect(center).toEqual({ x: 250, y: 100 })
  })

  it('size invalido nao muta o objeto e retorna false', () => {
    const obj: any = { left: 5, top: 5 }
    expect(setJsonObjectCenterInParentPlane(obj, 100, 100)).toBe(false)
    expect(obj.left).toBe(5) // intacto
  })
})

describe('collectJsonDescendantsWithParent', () => {
  it('coleta descendentes diretos com parent', () => {
    const root = { type: 'group', objects: [
      { id: 'a' },
      { id: 'b' }
    ]}
    const r = collectJsonDescendantsWithParent(root)
    expect(r.length).toBe(2)
    expect(r.every((e) => e.parent === root)).toBe(true)
  })

  it('descobre niveis aninhados, parent muda corretamente', () => {
    const leaf = { id: 'leaf' }
    const inner = { id: 'inner', type: 'group', objects: [leaf] }
    const root = { type: 'group', objects: [inner] }
    const r = collectJsonDescendantsWithParent(root)
    const innerEntry = r.find((e) => e.node.id === 'inner')
    const leafEntry = r.find((e) => e.node.id === 'leaf')
    expect(innerEntry?.parent).toBe(root)
    expect(leafEntry?.parent).toBe(inner) // parent imediato, nao root
  })

  it('group sem children retorna []', () => {
    expect(collectJsonDescendantsWithParent({ type: 'group' })).toEqual([])
    expect(collectJsonDescendantsWithParent({})).toEqual([])
  })
})

describe('collectTemplateJsonNodes', () => {
  it('lista vazia para input invalido', () => {
    expect(collectTemplateJsonNodes(null)).toEqual([])
    expect(collectTemplateJsonNodes({})).toEqual([])
    expect(collectTemplateJsonNodes({ objects: 'not-array' })).toEqual([])
  })

  it('coleta filhos diretos e descendentes profundos', () => {
    const leaf = { id: 'leaf' }
    const inner = { id: 'inner', type: 'group', objects: [leaf] }
    const root = { type: 'group', objects: [inner, { id: 'sibling' }] }
    const ids = collectTemplateJsonNodes(root).map((n: any) => n.id).sort()
    expect(ids).toEqual(['inner', 'leaf', 'sibling'])
  })

  it('ignora null/non-object dentro de objects', () => {
    const r = collectTemplateJsonNodes({
      objects: [null, 'str' as any, { id: 'a' }, undefined]
    })
    expect(r.length).toBe(1)
    expect(r[0]).toEqual({ id: 'a' })
  })
})

describe('isAtacarejoTemplateGroupJson', () => {
  it('aceita por nome atac_retail_bg', () => {
    expect(isAtacarejoTemplateGroupJson({
      type: 'group',
      objects: [{ name: 'atac_retail_bg', type: 'rect' }]
    })).toBe(true)
  })

  it('aceita atac_retail_bg em qualquer profundidade', () => {
    expect(isAtacarejoTemplateGroupJson({
      type: 'group',
      objects: [{ type: 'group', objects: [{ name: 'atac_retail_bg' }] }]
    })).toBe(true)
  })

  it('rejeita templates sem atac_retail_bg', () => {
    expect(isAtacarejoTemplateGroupJson({
      objects: [{ name: 'price_bg' }, { name: 'price_integer_text' }]
    })).toBe(false)
    expect(isAtacarejoTemplateGroupJson({})).toBe(false)
    expect(isAtacarejoTemplateGroupJson(null)).toBe(false)
  })
})

describe('isRedBurstTemplateGroupJson', () => {
  it('aceita quando todos os 6 nomes estao presentes', () => {
    const tpl = {
      objects: [
        { name: 'price_bg' },
        { name: 'price_header_bg' },
        { name: 'price_header_text' },
        { name: 'price_burst_line_a' },
        { name: 'price_integer_text' },
        { name: 'price_decimal_text' }
      ]
    }
    expect(isRedBurstTemplateGroupJson(tpl)).toBe(true)
  })

  it('rejeita quando algum nome esta faltando', () => {
    const partial = {
      objects: [
        { name: 'price_bg' },
        { name: 'price_header_bg' },
        { name: 'price_header_text' },
        // falta price_burst_line_a
        { name: 'price_integer_text' },
        { name: 'price_decimal_text' }
      ]
    }
    expect(isRedBurstTemplateGroupJson(partial)).toBe(false)
  })

  it('rejeita null/template vazio', () => {
    expect(isRedBurstTemplateGroupJson(null)).toBe(false)
    expect(isRedBurstTemplateGroupJson({})).toBe(false)
    expect(isRedBurstTemplateGroupJson({ objects: [] })).toBe(false)
  })
})

describe('isTemplateGroupJsonRenderable', () => {
  it('rejeita null/template vazio/sem children', () => {
    expect(isTemplateGroupJsonRenderable(null)).toBe(false)
    expect(isTemplateGroupJsonRenderable({})).toBe(false)
    expect(isTemplateGroupJsonRenderable({ objects: [] })).toBe(false)
  })

  it('aceita template atacarejo (3 backgrounds)', () => {
    expect(isTemplateGroupJsonRenderable({
      objects: [
        { name: 'atac_retail_bg', type: 'rect' },
        { name: 'atac_banner_bg', type: 'rect' },
        { name: 'atac_wholesale_bg', type: 'rect' }
      ]
    })).toBe(true)
  })

  it('aceita single-price com price_bg + texto principal', () => {
    expect(isTemplateGroupJsonRenderable({
      objects: [
        { name: 'price_bg', type: 'rect' },
        { name: 'price_integer_text', type: 'text' }
      ]
    })).toBe(true)
    expect(isTemplateGroupJsonRenderable({
      objects: [
        { name: 'price_bg', type: 'rect' },
        { name: 'smart_price', type: 'text' }
      ]
    })).toBe(true)
  })

  it('aceita fallback generico (rect + texto)', () => {
    expect(isTemplateGroupJsonRenderable({
      objects: [
        { type: 'rect', name: 'random' },
        { type: 'i-text', name: 'qualquer' }
      ]
    })).toBe(true)
  })

  it('rejeita templates so com texto OU so com rect', () => {
    expect(isTemplateGroupJsonRenderable({
      objects: [{ type: 'text' }, { type: 'text' }]
    })).toBe(false)
    expect(isTemplateGroupJsonRenderable({
      objects: [{ type: 'rect' }, { type: 'rect' }]
    })).toBe(false)
  })
})
