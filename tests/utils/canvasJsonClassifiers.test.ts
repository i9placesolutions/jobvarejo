import { describe, it, expect, vi } from 'vitest'
import {
  walkCanvasObjects,
  getJsonGroupChildren,
  isStandalonePriceGroupJson,
  isLikelyProductCardJson,
  getCardBaseSizeForContainmentJson,
  cloneTemplateGroupJson,
  clonePlainMetadata,
  getJsonObjectSize,
  getJsonObjectCenterInParentPlane,
  setJsonObjectCenterInParentPlane,
  collectJsonDescendantsWithParent,
  collectTemplateJsonNodes,
  isTemplateGroupJsonRenderable,
  isAtacarejoTemplateGroupJson,
  isRedBurstTemplateGroupJson,
  PRICE_GROUP_TEXT_TYPES,
  isTinyPlaceholderImageSrc,
  isPriceGroupTemplateImageNode,
  isRenderablePriceGroupTemplateImageNode,
  isPriceGroupVisualShellNode,
  isDeferredProductImageCandidateSrc,
  isProductCardImageSelectionCandidateJson,
  normalizePreparedCanvasLoadCacheKey,
  cloneCanvasDataForLoad,
  getCanvasLoadCacheToken,
  decodeContaboUrls,
  removeImageObjectsDeep,
  getPreferredProductImageFromCardJson,
  countCanvasJsonObjectsAndImages,
  buildPreparedCanvasDataCacheKey,
  getLegacyProductCardImageRepairMode,
  collectContaboImageNodes,
  isPotentiallyBrokenRemoteImageSrc,
  replaceContaboImagesWithPlaceholder,
  isLikelyPlaceholderImageSrc,
  CANVAS_IMAGE_PLACEHOLDER_DATA_URL,
  restoreNamesFromJson,
  collectTemplateJsonNodesDeep,
  PREPARED_CANVAS_LOAD_CACHE_LIMIT,
  DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD,
  DEFERRED_PRODUCT_IMAGE_LOAD_MAX,
  repairHiddenPriceGroupTexts,
  sanitizeFabricJsonTreeForLoad
} from '~/utils/canvasJsonClassifiers'

describe('PREPARED_CANVAS_LOAD_CACHE_LIMIT', () => {
  it('e numero positivo (LRU cap)', () => {
    expect(PREPARED_CANVAS_LOAD_CACHE_LIMIT).toBe(24)
    expect(PREPARED_CANVAS_LOAD_CACHE_LIMIT).toBeGreaterThan(0)
  })
})

describe('DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD / MAX', () => {
  it('threshold = 24, max = 72 (max maior que threshold)', () => {
    expect(DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD).toBe(24)
    expect(DEFERRED_PRODUCT_IMAGE_LOAD_MAX).toBe(72)
    expect(DEFERRED_PRODUCT_IMAGE_LOAD_MAX).toBeGreaterThanOrEqual(DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD)
  })
})

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

describe('PRICE_GROUP_TEXT_TYPES', () => {
  it('contem text/textbox/i-text', () => {
    expect(PRICE_GROUP_TEXT_TYPES.has('text')).toBe(true)
    expect(PRICE_GROUP_TEXT_TYPES.has('textbox')).toBe(true)
    expect(PRICE_GROUP_TEXT_TYPES.has('i-text')).toBe(true)
  })

  it('rejeita outros types', () => {
    expect(PRICE_GROUP_TEXT_TYPES.has('rect')).toBe(false)
    expect(PRICE_GROUP_TEXT_TYPES.has('image')).toBe(false)
    expect(PRICE_GROUP_TEXT_TYPES.has('group')).toBe(false)
  })
})

describe('isTinyPlaceholderImageSrc', () => {
  it('aceita data URLs pequenos (< 200 chars)', () => {
    expect(isTinyPlaceholderImageSrc('data:image/png;base64,AAAA')).toBe(true)
    expect(isTinyPlaceholderImageSrc('data:image/jpeg;base64,iVBORw0K')).toBe(true)
  })

  it('rejeita data URLs grandes (>= 200 chars)', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(200)
    expect(isTinyPlaceholderImageSrc(big)).toBe(false)
  })

  it('rejeita URLs nao-data', () => {
    expect(isTinyPlaceholderImageSrc('https://example.com/img.png')).toBe(false)
    expect(isTinyPlaceholderImageSrc('blob:foo')).toBe(false)
  })

  it('rejeita vazio/null', () => {
    expect(isTinyPlaceholderImageSrc('')).toBe(false)
    expect(isTinyPlaceholderImageSrc(null as any)).toBe(false)
    expect(isTinyPlaceholderImageSrc(undefined as any)).toBe(false)
  })

  it('case insensitive no prefixo data:image/', () => {
    expect(isTinyPlaceholderImageSrc('DATA:IMAGE/PNG;base64,AA')).toBe(true)
  })
})

describe('isPriceGroupTemplateImageNode', () => {
  it('aceita nodes com type=image (case insensitive)', () => {
    expect(isPriceGroupTemplateImageNode({ type: 'image' })).toBe(true)
    expect(isPriceGroupTemplateImageNode({ type: 'IMAGE' })).toBe(true)
  })

  it('rejeita outros types', () => {
    expect(isPriceGroupTemplateImageNode({ type: 'rect' })).toBe(false)
    expect(isPriceGroupTemplateImageNode({ type: 'text' })).toBe(false)
    expect(isPriceGroupTemplateImageNode(null)).toBe(false)
    expect(isPriceGroupTemplateImageNode({})).toBe(false)
  })
})

describe('isRenderablePriceGroupTemplateImageNode', () => {
  it('aceita imagem com src valido', () => {
    expect(isRenderablePriceGroupTemplateImageNode({
      type: 'image',
      src: 'https://example.com/img.png'
    })).toBe(true)
  })

  it('rejeita quando src e vazio', () => {
    expect(isRenderablePriceGroupTemplateImageNode({ type: 'image', src: '' })).toBe(false)
    expect(isRenderablePriceGroupTemplateImageNode({ type: 'image' })).toBe(false)
  })

  it('rejeita quando src foi stripado (__srcStripped=true)', () => {
    expect(isRenderablePriceGroupTemplateImageNode({
      type: 'image',
      src: 'https://example.com/img.png',
      __srcStripped: true
    })).toBe(false)
  })

  it('rejeita placeholder data URL pequeno', () => {
    expect(isRenderablePriceGroupTemplateImageNode({
      type: 'image',
      src: 'data:image/png;base64,AAAA'
    })).toBe(false)
  })

  it('rejeita nao-imagens', () => {
    expect(isRenderablePriceGroupTemplateImageNode({ type: 'rect' })).toBe(false)
  })
})

describe('isPriceGroupVisualShellNode', () => {
  it('aceita rect/image (shells visuais)', () => {
    expect(isPriceGroupVisualShellNode({ type: 'rect' })).toBe(true)
    expect(isPriceGroupVisualShellNode({ type: 'image' })).toBe(true)
    expect(isPriceGroupVisualShellNode({ type: 'circle' })).toBe(true)
  })

  it('rejeita textos (text/textbox/i-text)', () => {
    expect(isPriceGroupVisualShellNode({ type: 'text' })).toBe(false)
    expect(isPriceGroupVisualShellNode({ type: 'textbox' })).toBe(false)
    expect(isPriceGroupVisualShellNode({ type: 'i-text' })).toBe(false)
  })

  it('rejeita group (deve descer recursivamente, nao tratar como shell)', () => {
    expect(isPriceGroupVisualShellNode({ type: 'group' })).toBe(false)
  })

  it('rejeita price_currency_bg (intencionalmente oculto em alguns templates)', () => {
    expect(isPriceGroupVisualShellNode({
      type: 'circle',
      name: 'price_currency_bg'
    })).toBe(false)
  })

  it('rejeita null/sem type', () => {
    expect(isPriceGroupVisualShellNode(null)).toBe(false)
    expect(isPriceGroupVisualShellNode({})).toBe(false)
    expect(isPriceGroupVisualShellNode({ type: '' })).toBe(false)
  })
})

describe('clonePlainMetadata', () => {
  it('null/undefined retornam o proprio valor', () => {
    expect(clonePlainMetadata(null)).toBeNull()
    expect(clonePlainMetadata(undefined)).toBeUndefined()
  })

  it('primitivos passam direto', () => {
    expect(clonePlainMetadata('foo')).toBe('foo')
    expect(clonePlainMetadata(42)).toBe(42)
    expect(clonePlainMetadata(true)).toBe(true)
  })

  it('objetos sao deep-cloned', () => {
    const original: any = { a: 1, b: { c: 2 } }
    const cloned = clonePlainMetadata(original)
    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    cloned.b.c = 999
    expect(original.b.c).toBe(2) // intacto
  })

  it('arrays sao deep-cloned', () => {
    const original = [{ a: 1 }, { b: 2 }]
    const cloned = clonePlainMetadata(original)
    expect(cloned).toEqual(original)
    cloned[0].a = 999
    expect(original[0].a).toBe(1)
  })

  it('fallback descarta funcoes (nao-serializavel)', () => {
    // JSON.stringify ignora funcoes silenciosamente, entao no caminho
    // feliz a funcao some. No fallback (refs circulares) tambem some.
    const obj: any = { keep: 'this', cb: () => 42 }
    const cloned = clonePlainMetadata(obj)
    expect(cloned.keep).toBe('this')
    expect(cloned.cb).toBeUndefined()
  })
})

describe('isDeferredProductImageCandidateSrc', () => {
  it('aceita HTTP(S) urls remotas', () => {
    expect(isDeferredProductImageCandidateSrc('https://example.com/x.png')).toBe(true)
    expect(isDeferredProductImageCandidateSrc('http://example.com/x.png')).toBe(true)
    expect(isDeferredProductImageCandidateSrc('//cdn.example.com/x.png')).toBe(true)
  })

  it('rejeita data: URLs', () => {
    expect(isDeferredProductImageCandidateSrc('data:image/png;base64,AAAA')).toBe(false)
  })

  it('rejeita blob: URLs (efemeros)', () => {
    expect(isDeferredProductImageCandidateSrc('blob:https://example.com/abc')).toBe(false)
  })

  it('rejeita vazio/whitespace', () => {
    expect(isDeferredProductImageCandidateSrc('')).toBe(false)
    expect(isDeferredProductImageCandidateSrc('   ')).toBe(false)
    expect(isDeferredProductImageCandidateSrc(null as any)).toBe(false)
  })
})

describe('isProductCardImageSelectionCandidateJson', () => {
  it('aceita imagem com smartType=product-image', () => {
    expect(isProductCardImageSelectionCandidateJson({
      type: 'image',
      data: { smartType: 'product-image' }
    })).toBe(true)
  })

  it('aceita imagens com nomes conhecidos', () => {
    expect(isProductCardImageSelectionCandidateJson({ type: 'image', name: 'smart_image' })).toBe(true)
    expect(isProductCardImageSelectionCandidateJson({ type: 'image', name: 'product_image' })).toBe(true)
    expect(isProductCardImageSelectionCandidateJson({ type: 'image', name: 'productImage' })).toBe(true)
  })

  it('aceita imagens com prefixo extra_image_', () => {
    expect(isProductCardImageSelectionCandidateJson({
      type: 'image',
      name: 'extra_image_1'
    })).toBe(true)
  })

  it('rejeita imagens estruturais (price_bg_image, splash_image)', () => {
    expect(isProductCardImageSelectionCandidateJson({
      type: 'image',
      name: 'price_bg_image'
    })).toBe(false)
    expect(isProductCardImageSelectionCandidateJson({
      type: 'image',
      name: 'splash_image'
    })).toBe(false)
  })

  it('rejeita nao-imagens', () => {
    expect(isProductCardImageSelectionCandidateJson({ type: 'rect' })).toBe(false)
    expect(isProductCardImageSelectionCandidateJson(null)).toBe(false)
  })

  it('aceita imagem generica (fallback true)', () => {
    expect(isProductCardImageSelectionCandidateJson({
      type: 'image',
      name: 'random'
    })).toBe(true)
  })
})

describe('normalizePreparedCanvasLoadCacheKey', () => {
  it('aplica trim', () => {
    expect(normalizePreparedCanvasLoadCacheKey('  abc  ')).toBe('abc')
    expect(normalizePreparedCanvasLoadCacheKey('foo')).toBe('foo')
  })

  it('null/undefined/whitespace viram string vazia', () => {
    expect(normalizePreparedCanvasLoadCacheKey(null)).toBe('')
    expect(normalizePreparedCanvasLoadCacheKey(undefined)).toBe('')
    expect(normalizePreparedCanvasLoadCacheKey('   ')).toBe('')
  })
})

describe('cloneCanvasDataForLoad', () => {
  it('clone profundo via structuredClone', () => {
    const original = { objects: [{ id: 'a' }, { id: 'b' }], version: '1' }
    const cloned = cloneCanvasDataForLoad(original)
    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    cloned.objects[0].id = 'modified'
    expect(original.objects[0].id).toBe('a') // intacto
  })

  it('aceita primitivos sem quebrar', () => {
    expect(cloneCanvasDataForLoad(null)).toBeNull()
    expect(cloneCanvasDataForLoad('str')).toBe('str')
    expect(cloneCanvasDataForLoad(42)).toBe(42)
  })
})

describe('getCanvasLoadCacheToken', () => {
  it('"empty" para input invalido', () => {
    expect(getCanvasLoadCacheToken(null)).toBe('empty')
    expect(getCanvasLoadCacheToken(undefined)).toBe('empty')
    expect(getCanvasLoadCacheToken('str')).toBe('empty')
  })

  it('combina savedAt + objectCount + version', () => {
    expect(getCanvasLoadCacheToken({
      __savedAt: 1234,
      objects: [{}, {}, {}],
      version: '5.2.0'
    })).toBe('1234:3:5.2.0')
  })

  it('aceita savedAt em multiplas chaves (alias)', () => {
    expect(getCanvasLoadCacheToken({ _savedAt: 100, version: '1' })).toBe('100:0:1')
    expect(getCanvasLoadCacheToken({ savedAt: 200, version: '1' })).toBe('200:0:1')
    expect(getCanvasLoadCacheToken({ updatedAt: 300, version: '1' })).toBe('300:0:1')
  })

  it('cai para meta.savedAt como fallback', () => {
    expect(getCanvasLoadCacheToken({
      meta: { savedAt: 999 },
      version: '1'
    })).toBe('999:0:1')
  })

  it('directSavedAt tem prioridade sobre meta', () => {
    expect(getCanvasLoadCacheToken({
      __savedAt: 100,
      meta: { savedAt: 999 },
      version: '1'
    })).toBe('100:0:1')
  })

  it('savedAt invalido vira 0', () => {
    expect(getCanvasLoadCacheToken({
      __savedAt: 'not-a-number',
      objects: [],
      version: ''
    })).toBe('0:0:')
  })

  it('mesmo input gera mesmo token (estabilidade)', () => {
    const data = { __savedAt: 100, objects: [{}], version: '1' }
    expect(getCanvasLoadCacheToken(data)).toBe(getCanvasLoadCacheToken(data))
  })

  it('input diferente gera token diferente', () => {
    expect(getCanvasLoadCacheToken({ __savedAt: 100, objects: [], version: '1' }))
      .not.toBe(getCanvasLoadCacheToken({ __savedAt: 200, objects: [], version: '1' }))
  })
})

describe('decodeContaboUrls', () => {
  it('decodifica %3A em src de imagem Contabo', () => {
    const input = {
      objects: [
        { type: 'image', src: 'https://eu2.contabostorage.com/tenant%3Abucket/key.png' }
      ]
    }
    const out = decodeContaboUrls(input)
    expect(out.objects[0].src).toContain('tenant:bucket')
    expect(out.objects[0].src).not.toContain('%3A')
  })

  it('preserva URLs nao-Contabo', () => {
    const input = {
      objects: [
        { type: 'image', src: 'https://example.com/x%3Ay.png' }
      ]
    }
    const out = decodeContaboUrls(input)
    expect(out.objects[0].src).toBe('https://example.com/x%3Ay.png')
  })

  it('preserva URLs Contabo sem %3A', () => {
    const input = {
      objects: [
        { type: 'image', src: 'https://eu2.contabostorage.com/already-decoded/key.png' }
      ]
    }
    expect(decodeContaboUrls(input).objects[0].src).toBe('https://eu2.contabostorage.com/already-decoded/key.png')
  })

  it('desce em groups aninhados', () => {
    const input = {
      objects: [{
        type: 'group',
        objects: [
          { type: 'image', src: 'https://eu2.contabostorage.com/t%3Ab/k.png' }
        ]
      }]
    }
    const out = decodeContaboUrls(input)
    expect(out.objects[0].objects[0].src).toContain('t:b')
  })

  it('retorna copia (nao muta input)', () => {
    const input = {
      objects: [
        { type: 'image', src: 'https://eu2.contabostorage.com/x%3Ay/k.png' }
      ]
    }
    const originalSrc = input.objects[0].src
    decodeContaboUrls(input)
    expect(input.objects[0].src).toBe(originalSrc)
  })

  it('canvasData sem objects retorna copia', () => {
    expect(decodeContaboUrls({ version: '1' })).toEqual({ version: '1' })
  })
})

describe('removeImageObjectsDeep', () => {
  it('remove imagens do nivel raiz', () => {
    const node: any = {
      objects: [
        { type: 'rect' },
        { type: 'image' },
        { type: 'text' }
      ]
    }
    removeImageObjectsDeep(node)
    expect(node.objects).toHaveLength(2)
    expect(node.objects.every((o: any) => o.type !== 'image')).toBe(true)
  })

  it('remove imagens em groups aninhados', () => {
    const node: any = {
      objects: [{
        type: 'group',
        objects: [
          { type: 'image' },
          { type: 'rect' }
        ]
      }]
    }
    removeImageObjectsDeep(node)
    expect(node.objects[0].objects).toHaveLength(1)
    expect(node.objects[0].objects[0].type).toBe('rect')
  })

  it('aceita primitivos/null sem quebrar', () => {
    expect(removeImageObjectsDeep(null)).toBeNull()
    expect(removeImageObjectsDeep('str')).toBe('str')
    expect(removeImageObjectsDeep(42)).toBe(42)
  })

  it('case insensitive (IMAGE tambem e removido)', () => {
    const node: any = { objects: [{ type: 'IMAGE' }, { type: 'rect' }] }
    removeImageObjectsDeep(node)
    expect(node.objects).toHaveLength(1)
  })

  it('node sem objects nao quebra', () => {
    const node: any = { type: 'rect' }
    expect(removeImageObjectsDeep(node)).toBe(node)
  })
})

describe('getPreferredProductImageFromCardJson', () => {
  it('null/sem objects retorna null', () => {
    expect(getPreferredProductImageFromCardJson(null)).toBeNull()
    expect(getPreferredProductImageFromCardJson({})).toBeNull()
    expect(getPreferredProductImageFromCardJson({ objects: [] })).toBeNull()
  })

  it('prioriza smart_image', () => {
    const smart = { type: 'image', name: 'smart_image' }
    const random = { type: 'image', name: 'random' }
    const card = { objects: [random, smart] }
    expect(getPreferredProductImageFromCardJson(card)).toBe(smart)
  })

  it('prioriza product_image quando nao tem smart_image', () => {
    const prod = { type: 'image', name: 'product_image' }
    const random = { type: 'image', name: 'foo' }
    expect(getPreferredProductImageFromCardJson({ objects: [random, prod] })).toBe(prod)
  })

  it('prioriza smartType=product-image em data', () => {
    const smart = { type: 'image', data: { smartType: 'product-image' } }
    const random = { type: 'image', name: 'foo' }
    expect(getPreferredProductImageFromCardJson({ objects: [random, smart] })).toBe(smart)
  })

  it('fallback: primeira imagem candidata qualquer', () => {
    const generic = { type: 'image', name: 'random' }
    expect(getPreferredProductImageFromCardJson({ objects: [
      { type: 'rect' }, generic
    ] })).toBe(generic)
  })

  it('rejeita imagens estruturais (price_bg_image)', () => {
    expect(getPreferredProductImageFromCardJson({
      objects: [{ type: 'image', name: 'price_bg_image' }]
    })).toBeNull()
  })
})

describe('countCanvasJsonObjectsAndImages', () => {
  it('null/undefined: { 0, 0 }', () => {
    expect(countCanvasJsonObjectsAndImages(null)).toEqual({ objects: 0, images: 0 })
    expect(countCanvasJsonObjectsAndImages(undefined)).toEqual({ objects: 0, images: 0 })
  })

  it('canvas vazio: 0 objetos', () => {
    expect(countCanvasJsonObjectsAndImages({ objects: [] })).toEqual({ objects: 0, images: 0 })
  })

  it('canvas root sem type: 0 mas conta filhos', () => {
    expect(countCanvasJsonObjectsAndImages({
      objects: [{ type: 'rect' }, { type: 'image' }, { type: 'text' }]
    })).toEqual({ objects: 3, images: 1 })
  })

  it('groups aninhados sao contados (DFS)', () => {
    expect(countCanvasJsonObjectsAndImages({
      objects: [
        { type: 'group', objects: [
          { type: 'rect' },
          { type: 'image' },
          { type: 'group', objects: [{ type: 'image' }] }
        ]}
      ]
    })).toEqual({ objects: 5, images: 2 })
  })

  it('clipPath conta como objeto', () => {
    expect(countCanvasJsonObjectsAndImages({
      objects: [{ type: 'rect', clipPath: { type: 'rect' } }]
    })).toEqual({ objects: 2, images: 0 })
  })

  it('referencia circular nao causa loop infinito', () => {
    const a: any = { type: 'group', objects: [] }
    a.objects.push(a)
    expect(countCanvasJsonObjectsAndImages({ objects: [a] })).toEqual({ objects: 1, images: 0 })
  })
})

describe('buildPreparedCanvasDataCacheKey', () => {
  it('canvasDataPath tem prioridade absoluta', () => {
    expect(buildPreparedCanvasDataCacheKey({
      canvasDataPath: '/storage/abc/page1.json',
      id: 'page-1'
    }, 'proj-1')).toBe('path:/storage/abc/page1.json')
  })

  it('sem path: project + page id', () => {
    expect(buildPreparedCanvasDataCacheKey({ id: 'page-1' }, 'proj-1'))
      .toBe('project:proj-1:page:page-1')
  })

  it('sem projectId: apenas page id', () => {
    expect(buildPreparedCanvasDataCacheKey({ id: 'page-1' }))
      .toBe('page:page-1')
    expect(buildPreparedCanvasDataCacheKey({ id: 'page-1' }, ''))
      .toBe('page:page-1')
    expect(buildPreparedCanvasDataCacheKey({ id: 'page-1' }, null))
      .toBe('page:page-1')
  })

  it('sem nada disponivel: null', () => {
    expect(buildPreparedCanvasDataCacheKey(null)).toBeNull()
    expect(buildPreparedCanvasDataCacheKey({})).toBeNull()
    expect(buildPreparedCanvasDataCacheKey({ id: '' })).toBeNull()
    expect(buildPreparedCanvasDataCacheKey({ id: '   ' })).toBeNull()
  })

  it('aplica trim em todos os campos', () => {
    expect(buildPreparedCanvasDataCacheKey({
      canvasDataPath: '  /path  '
    })).toBe('path:/path')
    expect(buildPreparedCanvasDataCacheKey({ id: '  page-1  ' }, '  proj-1  '))
      .toBe('project:proj-1:page:page-1')
  })

  it('mesma entrada gera mesma chave (estabilidade)', () => {
    const page = { id: 'p1' }
    expect(buildPreparedCanvasDataCacheKey(page, 'proj-1'))
      .toBe(buildPreparedCanvasDataCacheKey(page, 'proj-1'))
  })
})

describe('getLegacyProductCardImageRepairMode', () => {
  it('null/undefined retornam "auto" (sem dados)', () => {
    expect(getLegacyProductCardImageRepairMode(null)).toBe('auto')
    expect(getLegacyProductCardImageRepairMode(undefined)).toBe('auto')
  })

  it('needsPostLoadRepair=true → force', () => {
    expect(getLegacyProductCardImageRepairMode({
      cardsScanned: 5,
      imagesScanned: 5,
      imagesRepaired: 2,
      needsPostLoadRepair: true
    })).toBe('force')
  })

  it('needsPostLoadRepair=false → skip', () => {
    expect(getLegacyProductCardImageRepairMode({
      cardsScanned: 5,
      imagesScanned: 5,
      imagesRepaired: 0,
      needsPostLoadRepair: false
    })).toBe('skip')
  })

  it('stats minimo: 0 cards/0 imagens com needsPostLoadRepair=false → skip', () => {
    expect(getLegacyProductCardImageRepairMode({
      cardsScanned: 0,
      imagesScanned: 0,
      imagesRepaired: 0,
      needsPostLoadRepair: false
    })).toBe('skip')
  })
})

describe('collectContaboImageNodes', () => {
  it('coleta imagens com URL Contabo', () => {
    const data = {
      objects: [
        { type: 'image', src: 'https://eu2.contabostorage.com/bucket/key.png' },
        { type: 'image', src: 'https://other.com/x.png' },
        { type: 'rect', src: 'irrelevant' },
        { type: 'image', src: 'https://usc1.contabostorage.com/k.png' }
      ]
    }
    const r = collectContaboImageNodes(data)
    expect(r.length).toBe(2)
    // Ordem do walk e LIFO no root — verifica conjunto, nao indices
    const srcs = r.map((n: any) => n.src).sort()
    expect(srcs[0]).toContain('eu2.contabostorage.com')
    expect(srcs[1]).toContain('usc1.contabostorage.com')
  })

  it('lista vazia: []', () => {
    expect(collectContaboImageNodes(null)).toEqual([])
    expect(collectContaboImageNodes({})).toEqual([])
    expect(collectContaboImageNodes({ objects: [] })).toEqual([])
  })

  it('aninhado em group: encontra recursivamente', () => {
    const data = {
      objects: [{
        type: 'group',
        objects: [
          { type: 'image', src: 'https://eu2.contabostorage.com/k.png' }
        ]
      }]
    }
    expect(collectContaboImageNodes(data).length).toBe(1)
  })

  it('ignora imagens sem src', () => {
    expect(collectContaboImageNodes({
      objects: [{ type: 'image', src: '' }, { type: 'image' }]
    })).toEqual([])
  })

  it('ignora nao-imagens com URL Contabo no src (improvavel mas defensivo)', () => {
    expect(collectContaboImageNodes({
      objects: [{ type: 'rect', src: 'https://eu2.contabostorage.com/x.png' }]
    })).toEqual([])
  })
})

describe('isPotentiallyBrokenRemoteImageSrc', () => {
  it('vazio retorna false', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('')).toBe(false)
    expect(isPotentiallyBrokenRemoteImageSrc('   ')).toBe(false)
  })

  it('data: URL retorna false (inline, nunca quebra)', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('data:image/png;base64,AAAA')).toBe(false)
  })

  it('blob: URL retorna true (efemero)', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('blob:https://example.com/abc')).toBe(true)
  })

  it('URLs Contabo/Wasabi retornam true', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('https://eu2.contabostorage.com/x.png')).toBe(true)
    expect(isPotentiallyBrokenRemoteImageSrc('https://s3.wasabisys.com/x.png')).toBe(true)
  })

  it('URLs do proxy interno retornam true', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('/api/storage/proxy?key=x')).toBe(true)
    expect(isPotentiallyBrokenRemoteImageSrc('/api/storage/p?key=x')).toBe(true)
  })

  it('http(s) generico retorna true', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('https://example.com/x.png')).toBe(true)
    expect(isPotentiallyBrokenRemoteImageSrc('http://example.com/x.png')).toBe(true)
  })

  it('case insensitive', () => {
    expect(isPotentiallyBrokenRemoteImageSrc('HTTPS://EXAMPLE.COM/X.PNG')).toBe(true)
    expect(isPotentiallyBrokenRemoteImageSrc('Data:image/png')).toBe(false)
  })
})

describe('replaceContaboImagesWithPlaceholder', () => {
  it('substitui src remota por placeholder e preserva __originalSrc', () => {
    const data = {
      objects: [
        { type: 'image', src: 'https://eu2.contabostorage.com/k.png' },
        { type: 'image', src: 'data:image/png;base64,AAAA' } // inline, nao toca
      ]
    }
    const result = replaceContaboImagesWithPlaceholder(data)
    expect(result.objects[0].src).toContain('data:image/png;base64,')
    expect(result.objects[0].src).not.toContain('contabostorage.com')
    expect(result.objects[0].__originalSrc).toBe('https://eu2.contabostorage.com/k.png')
    // imagem inline preservada
    expect(result.objects[1].src).toBe('data:image/png;base64,AAAA')
  })

  it('clona por default (nao muta input)', () => {
    const data = { objects: [{ type: 'image', src: 'https://example.com/x.png' }] }
    const original = data.objects[0].src
    replaceContaboImagesWithPlaceholder(data)
    expect(data.objects[0].src).toBe(original) // intacto
  })

  it('opts.clone=false: mutacao in-place', () => {
    const data = { objects: [{ type: 'image', src: 'https://example.com/x.png' }] }
    replaceContaboImagesWithPlaceholder(data, { clone: false })
    expect(data.objects[0].src).not.toBe('https://example.com/x.png')
    expect((data.objects[0] as any).__originalSrc).toBe('https://example.com/x.png')
  })

  it('preserva __originalSrc se ja existir (nao sobrescreve)', () => {
    const data = {
      objects: [{
        type: 'image',
        src: 'https://eu2.contabostorage.com/k.png',
        __originalSrc: 'https://original.com/file.png'
      }]
    }
    const result = replaceContaboImagesWithPlaceholder(data)
    expect(result.objects[0].__originalSrc).toBe('https://original.com/file.png')
  })

  it('sem objects: retorna o canvasData', () => {
    expect(replaceContaboImagesWithPlaceholder({ version: '1' })).toEqual({ version: '1' })
  })

  it('aninhado em group: recursivo', () => {
    const data = {
      objects: [{
        type: 'group',
        objects: [
          { type: 'image', src: 'https://eu2.contabostorage.com/k.png' }
        ]
      }]
    }
    const result = replaceContaboImagesWithPlaceholder(data)
    expect(result.objects[0].objects[0].src).not.toContain('contabostorage.com')
  })
})

describe('isLikelyPlaceholderImageSrc', () => {
  it('null/undefined/empty → true', () => {
    expect(isLikelyPlaceholderImageSrc(null)).toBe(true)
    expect(isLikelyPlaceholderImageSrc(undefined)).toBe(true)
    expect(isLikelyPlaceholderImageSrc('')).toBe(true)
    expect(isLikelyPlaceholderImageSrc('   ')).toBe(true)
  })

  it('exatamente igual ao placeholder padrao → true', () => {
    expect(isLikelyPlaceholderImageSrc(CANVAS_IMAGE_PLACEHOLDER_DATA_URL)).toBe(true)
  })

  it('placeholder com whitespace ao redor → true (trim aplicado)', () => {
    expect(isLikelyPlaceholderImageSrc(`  ${CANVAS_IMAGE_PLACEHOLDER_DATA_URL}  `)).toBe(true)
  })

  it('URL real → false', () => {
    expect(isLikelyPlaceholderImageSrc('https://example.com/image.png')).toBe(false)
    expect(isLikelyPlaceholderImageSrc('blob:abc123')).toBe(false)
    expect(isLikelyPlaceholderImageSrc('data:image/png;base64,differentdata')).toBe(false)
  })

  it('numero/objeto → stringificado e comparado', () => {
    expect(isLikelyPlaceholderImageSrc(0 as any)).toBe(true)  // String(0||'')=String('')='' → trim '' → true
    expect(isLikelyPlaceholderImageSrc({} as any)).toBe(false)  // '[object Object]' nao bate
  })
})

describe('restoreNamesFromJson', () => {
  it('arrays vazios: no-op', () => {
    expect(() => restoreNamesFromJson([], [])).not.toThrow()
  })

  it('restaura name quando obj.name vazio', () => {
    const obj: any = {}
    restoreNamesFromJson([obj], [{ name: 'foo' }])
    expect(obj.name).toBe('foo')
  })

  it('NAO sobrescreve name pre-existente', () => {
    const obj: any = { name: 'existing' }
    restoreNamesFromJson([obj], [{ name: 'fromJson' }])
    expect(obj.name).toBe('existing')
  })

  it('restaura visible=false quando obj.visible nao false', () => {
    const obj: any = { visible: true }
    restoreNamesFromJson([obj], [{ visible: false }])
    expect(obj.visible).toBe(false)
  })

  it('NAO altera visible quando JSON tem visible=true', () => {
    const obj: any = { visible: true }
    restoreNamesFromJson([obj], [{ visible: true }])
    expect(obj.visible).toBe(true)
  })

  it('restaura props com _ prefix quando obj nao tem', () => {
    const obj: any = {}
    restoreNamesFromJson([obj], [{
      _customId: 'abc',
      _zoneSlot: { col: 0 },
      _cardWidth: 200
    }])
    expect(obj._customId).toBe('abc')
    expect(obj._zoneSlot).toEqual({ col: 0 })
    expect(obj._cardWidth).toBe(200)
  })

  it('NAO sobrescreve props com _ prefix existentes', () => {
    const obj: any = { _customId: 'preserved' }
    restoreNamesFromJson([obj], [{ _customId: 'fromJson' }])
    expect(obj._customId).toBe('preserved')
  })

  it('descend recursivamente em groups com getObjects', () => {
    const innerObj: any = {}
    const rootObj: any = {
      getObjects: () => [innerObj]
    }
    restoreNamesFromJson(
      [rootObj],
      [{
        objects: [{ name: 'innerName', _customId: 'inner-id' }]
      }]
    )
    expect(innerObj.name).toBe('innerName')
    expect(innerObj._customId).toBe('inner-id')
  })

  it('null/undefined entries pulados', () => {
    expect(() => restoreNamesFromJson([null, undefined], [{ name: 'a' }, { name: 'b' }]))
      .not.toThrow()
  })

  it('arrays de tamanhos diferentes: para no menor', () => {
    const obj1: any = {}
    const obj2: any = {}
    restoreNamesFromJson([obj1, obj2], [{ name: 'first' }])
    expect(obj1.name).toBe('first')
    expect(obj2.name).toBeUndefined()
  })

  it('JSON sem _ props: nada e copiado', () => {
    const obj: any = { existing: true }
    restoreNamesFromJson([obj], [{ name: 'ok', other: 'noUnderscore' }])
    expect(obj.name).toBe('ok')
    expect(obj.other).toBeUndefined()
  })
})

describe('collectTemplateJsonNodesDeep', () => {
  it('null/undefined → []', () => {
    expect(collectTemplateJsonNodesDeep(null)).toEqual([])
    expect(collectTemplateJsonNodesDeep(undefined)).toEqual([])
  })

  it('non-object → []', () => {
    expect(collectTemplateJsonNodesDeep('string')).toEqual([])
    expect(collectTemplateJsonNodesDeep(42)).toEqual([])
  })

  it('inclui o root no resultado', () => {
    const root = { id: 'root', objects: [] }
    expect(collectTemplateJsonNodesDeep(root)).toEqual([root])
  })

  it('flat: root + children diretos', () => {
    const c1 = { id: 'c1' }
    const c2 = { id: 'c2' }
    const root = { id: 'root', objects: [c1, c2] }
    const result = collectTemplateJsonNodesDeep(root)
    expect(result).toContain(root)
    expect(result).toContain(c1)
    expect(result).toContain(c2)
    expect(result).toHaveLength(3)
  })

  it('descend recursivamente em groups aninhados', () => {
    const leaf = { id: 'leaf' }
    const inner = { id: 'inner', objects: [leaf] }
    const root = { id: 'root', objects: [inner] }
    const result = collectTemplateJsonNodesDeep(root)
    expect(result).toHaveLength(3)
    expect(result.map((n: any) => n.id)).toContain('root')
    expect(result.map((n: any) => n.id)).toContain('inner')
    expect(result.map((n: any) => n.id)).toContain('leaf')
  })

  it('niveis profundos (1000) sem stack overflow', () => {
    let deepest: any = { id: 'leaf' }
    for (let i = 0; i < 1000; i += 1) {
      deepest = { id: `n${i}`, objects: [deepest] }
    }
    const result = collectTemplateJsonNodesDeep({ id: 'root', objects: [deepest] })
    // root + n0..n999 + leaf = 1002
    expect(result).toHaveLength(1002)
  })

  it('null/non-object children pulados', () => {
    const valid = { id: 'valid' }
    const root = { id: 'root', objects: [null, 'string', valid, undefined] }
    const result = collectTemplateJsonNodesDeep(root)
    expect(result).toHaveLength(2) // root + valid
  })

  it('node sem objects → so o root', () => {
    expect(collectTemplateJsonNodesDeep({ id: 'lonely' })).toEqual([{ id: 'lonely' }])
  })
})

describe('repairHiddenPriceGroupTexts', () => {
  it('null/non-object: 0', () => {
    expect(repairHiddenPriceGroupTexts(null)).toBe(0)
    expect(repairHiddenPriceGroupTexts({})).toBe(0)
    expect(repairHiddenPriceGroupTexts({ objects: 'not-array' as any })).toBe(0)
  })

  it('json sem product cards: 0', () => {
    expect(repairHiddenPriceGroupTexts({ objects: [{ type: 'Rect' }] })).toBe(0)
  })

  it('repara textos ocultos em priceGroup com nome', () => {
    const json = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' }, // top-level text → produto card
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'Rect', name: 'price_bg', visible: true },
                { type: 'IText', name: 'price_integer_text', visible: false }
              ]
            }
          ]
        }
      ]
    }
    const repaired = repairHiddenPriceGroupTexts(json)
    expect(repaired).toBeGreaterThan(0)
    const pg = json.objects[0].objects[1] as any
    expect(pg.objects[1].visible).toBe(true)
  })

  it('repara backgrounds ocultos quando ha textos visiveis', () => {
    const json = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' },
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'Rect', name: 'price_bg', visible: false },
                { type: 'IText', name: 'price_integer_text', visible: true, text: '99' }
              ]
            }
          ]
        }
      ]
    }
    repairHiddenPriceGroupTexts(json)
    const pg = json.objects[0].objects[1] as any
    expect(pg.objects[0].visible).toBe(true)
  })

  it('repara recursivamente sub-grupos (atacarejo)', () => {
    const json = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' },
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'Rect', name: 'atac_retail_bg', visible: true },
                {
                  type: 'Group',
                  name: 'retail_group',
                  objects: [
                    { type: 'IText', name: 'atac_retail_price', visible: false }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
    repairHiddenPriceGroupTexts(json)
    const retail = (json.objects[0] as any).objects[1].objects[1]
    expect(retail.objects[0].visible).toBe(true)
  })

  it('repara price_bg com fill transparent', () => {
    const json: any = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' },
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'Rect', name: 'price_bg', fill: 'transparent' }
              ]
            }
          ]
        }
      ]
    }
    repairHiddenPriceGroupTexts(json)
    const pg = json.objects[0].objects[1]
    expect(pg.objects[0].fill).toBe('#000000')
  })

  it('preserva fill de price_bg quando NAO transparent', () => {
    const json: any = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' },
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'Rect', name: 'price_bg', fill: '#abcdef' }
              ]
            }
          ]
        }
      ]
    }
    repairHiddenPriceGroupTexts(json)
    const pg = json.objects[0].objects[1]
    expect(pg.objects[0].fill).toBe('#abcdef')
  })

  it('NAO toca em price_currency_bg (intencionalmente oculto)', () => {
    const json = {
      objects: [
        {
          type: 'Group',
          objects: [
            { type: 'Textbox', text: 'Title' },
            {
              type: 'Group',
              name: 'priceGroup',
              objects: [
                { type: 'IText', name: 'price_integer_text', visible: true, text: '99' },
                { type: 'Circle', name: 'price_currency_bg', visible: false }
              ]
            }
          ]
        }
      ]
    }
    repairHiddenPriceGroupTexts(json)
    const pg = json.objects[0].objects[1] as any
    expect(pg.objects[1].visible).toBe(false)
  })
})

describe('sanitizeFabricJsonTreeForLoad', () => {
  it('null/non-object: { 0, 0 }', () => {
    expect(sanitizeFabricJsonTreeForLoad(null)).toEqual({ removed: 0, fixedGroupTypes: 0 })
    expect(sanitizeFabricJsonTreeForLoad('str')).toEqual({ removed: 0, fixedGroupTypes: 0 })
  })

  it('forca type=group em node sem type mas com objects[]', () => {
    const root = { objects: [{ type: 'rect' }] }
    const stats = sanitizeFabricJsonTreeForLoad(root as any)
    expect((root as any).type).toBe('group')
    expect(stats.fixedGroupTypes).toBe(1)
  })

  it('com allowRootWithoutType: nao toca no type do root', () => {
    const root: any = { objects: [{ type: 'rect' }] }
    const stats = sanitizeFabricJsonTreeForLoad(root, { allowRootWithoutType: true })
    expect(root.type).toBeUndefined()
    expect(stats.fixedGroupTypes).toBe(0)
  })

  it('remove children invalidos (null, sem type, type vazio)', () => {
    const root = {
      type: 'group',
      objects: [
        { type: 'rect' },
        null,
        { type: '' },
        { type: 'undefined' },
        { type: 'unknown' },
        'string-not-object'
      ]
    }
    const stats = sanitizeFabricJsonTreeForLoad(root as any)
    expect(stats.removed).toBe(5)
    expect((root as any).objects.length).toBe(1)
  })

  it('recursivo em sub-groups', () => {
    const root: any = {
      type: 'group',
      objects: [
        {
          objects: [{ type: 'rect' }, { type: '' }] // sub-group sem type, com 1 invalido
        }
      ]
    }
    const stats = sanitizeFabricJsonTreeForLoad(root)
    expect(stats.fixedGroupTypes).toBe(1) // sub-group recebeu type
    expect(stats.removed).toBe(1) // child com type vazio removido
    expect(root.objects[0].type).toBe('group')
    expect(root.objects[0].objects.length).toBe(1)
  })

  it('recursivo em clipPath', () => {
    const root: any = {
      type: 'rect',
      clipPath: { objects: [{ type: 'rect' }, null] }
    }
    sanitizeFabricJsonTreeForLoad(root)
    expect(root.clipPath.type).toBe('group')
    expect(root.clipPath.objects.length).toBe(1)
  })

  it('preserva arvore quando tudo e' + ' valido (no-op)', () => {
    const root: any = {
      type: 'group',
      objects: [
        { type: 'rect', name: 'a' },
        { type: 'group', objects: [{ type: 'text' }] }
      ]
    }
    const stats = sanitizeFabricJsonTreeForLoad(root)
    expect(stats).toEqual({ removed: 0, fixedGroupTypes: 0 })
  })

  it('case-insensitive type check', () => {
    const root: any = {
      type: 'group',
      objects: [
        { type: 'RECT' }, { type: 'Group', objects: [] }
      ]
    }
    const stats = sanitizeFabricJsonTreeForLoad(root)
    expect(stats.removed).toBe(0)
  })

  it('nao reescreve objects[] quando nada mudou', () => {
    const root: any = {
      type: 'group',
      objects: [{ type: 'rect' }]
    }
    const before = root.objects
    sanitizeFabricJsonTreeForLoad(root)
    expect(root.objects).toBe(before)
  })
})
