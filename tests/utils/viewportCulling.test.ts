import { describe, it, expect } from 'vitest'
import {
  isObjectIntersectingCullRect,
  shouldSkipViewportCullObject,
  computeViewportCullRect,
  VIEWPORT_CULL_PADDING,
  restoreViewportCulledObjects
} from '~/utils/viewportCulling'

describe('isObjectIntersectingCullRect', () => {
  const rect = { left: 0, top: 0, right: 100, bottom: 100 }
  const obj = (b: { left: number; top: number; width: number; height: number }) => ({
    getBoundingRect: () => b
  })

  it('intersecta totalmente: true', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: 10, top: 10, width: 20, height: 20 }),
      rect
    )).toBe(true)
  })

  it('totalmente fora a direita: false', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: 200, top: 0, width: 50, height: 50 }),
      rect
    )).toBe(false)
  })

  it('totalmente fora a esquerda: false', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: -200, top: 0, width: 50, height: 50 }),
      rect
    )).toBe(false)
  })

  it('totalmente fora acima: false', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: 0, top: -200, width: 50, height: 50 }),
      rect
    )).toBe(false)
  })

  it('totalmente fora abaixo: false', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: 0, top: 200, width: 50, height: 50 }),
      rect
    )).toBe(false)
  })

  it('intersecao parcial: true', () => {
    expect(isObjectIntersectingCullRect(
      obj({ left: 80, top: 80, width: 50, height: 50 }),
      rect
    )).toBe(true)
  })

  it('REGRESSAO: null/sem getBoundingRect retorna TRUE (nao culla por engano)', () => {
    expect(isObjectIntersectingCullRect(null, rect)).toBe(true)
    expect(isObjectIntersectingCullRect({}, rect)).toBe(true)
    expect(isObjectIntersectingCullRect({ getBoundingRect: 'not-fn' }, rect)).toBe(true)
  })

  it('REGRESSAO: getBoundingRect que retorna null retorna TRUE', () => {
    expect(isObjectIntersectingCullRect({
      getBoundingRect: () => null
    }, rect)).toBe(true)
  })

  it('REGRESSAO: getBoundingRect que joga erro retorna TRUE', () => {
    expect(isObjectIntersectingCullRect({
      getBoundingRect: () => { throw new Error('boom') }
    }, rect)).toBe(true)
  })

  it('rect null retorna TRUE', () => {
    expect(isObjectIntersectingCullRect(obj({ left: 0, top: 0, width: 50, height: 50 }), null as any)).toBe(true)
  })
})

describe('shouldSkipViewportCullObject', () => {
  const activeSet = new Set([{ id: 'active-1' }])

  it('null/non-object: true (skip)', () => {
    expect(shouldSkipViewportCullObject(null, activeSet)).toBe(true)
    expect(shouldSkipViewportCullObject(undefined, activeSet)).toBe(true)
    expect(shouldSkipViewportCullObject('str', activeSet)).toBe(true)
  })

  it('filho de group: skip (parent decide)', () => {
    expect(shouldSkipViewportCullObject({
      type: 'rect',
      group: { id: 'parent' }
    }, activeSet)).toBe(true)
  })

  it('em activeSet: skip (selecao ativa nao pode ser oculta)', () => {
    const o = { id: 'foo' }
    const set = new Set([o])
    expect(shouldSkipViewportCullObject(o, set)).toBe(true)
  })

  it('em modo de edicao (isEditing): skip', () => {
    expect(shouldSkipViewportCullObject({
      type: 'i-text',
      isEditing: true
    }, new Set())).toBe(true)
  })

  it('artboard-bg: skip', () => {
    expect(shouldSkipViewportCullObject({
      type: 'rect',
      id: 'artboard-bg'
    }, new Set())).toBe(true)
  })

  it('control-like (path_node): skip', () => {
    expect(shouldSkipViewportCullObject({
      name: 'path_node'
    }, new Set())).toBe(true)
  })

  it('transient (circle pequeno excluido): skip', () => {
    expect(shouldSkipViewportCullObject({
      type: 'circle',
      radius: 4,
      excludeFromExport: true
    }, new Set())).toBe(true)
  })

  it('content normal NAO e skipped', () => {
    expect(shouldSkipViewportCullObject({
      type: 'rect',
      _customId: 'rect-1'
    }, new Set())).toBe(false)
  })
})

describe('VIEWPORT_CULL_PADDING', () => {
  it('e 240px (paddng default)', () => {
    expect(VIEWPORT_CULL_PADDING).toBe(240)
  })
})

describe('computeViewportCullRect', () => {
  it('viewportTransform identidade + zoom 1: rect = [0,0, w, h] + padding', () => {
    const r = computeViewportCullRect({
      viewportTransform: [1, 0, 0, 1, 0, 0],
      zoom: 1,
      width: 1000,
      height: 800
    })
    // Sem deslocamento, left/top = -PADDING (cobertura world maior que canvas)
    expect(r.left).toBe(-VIEWPORT_CULL_PADDING)
    expect(r.top).toBe(-VIEWPORT_CULL_PADDING)
    expect(r.right).toBe(1000 + VIEWPORT_CULL_PADDING)
    expect(r.bottom).toBe(800 + VIEWPORT_CULL_PADDING)
  })

  it('viewportTransform com pan: rect descolocado em world coords', () => {
    // Pan -100 em x e -50 em y (canvas mostra (100, 50) em diante).
    const r = computeViewportCullRect({
      viewportTransform: [1, 0, 0, 1, -100, -50],
      zoom: 1,
      width: 800,
      height: 600
    })
    expect(r.left).toBe(100 - VIEWPORT_CULL_PADDING)
    expect(r.top).toBe(50 - VIEWPORT_CULL_PADDING)
  })

  it('zoom 2: world width e' + ' metade de canvas width', () => {
    const r = computeViewportCullRect({
      viewportTransform: [2, 0, 0, 2, 0, 0],
      zoom: 2,
      width: 1000,
      height: 800
    })
    // canvas mostra 500x400 em world coords (pixels / zoom)
    expect(r.right - r.left).toBe(500 + (VIEWPORT_CULL_PADDING * 2))
    expect(r.bottom - r.top).toBe(400 + (VIEWPORT_CULL_PADDING * 2))
  })

  it('zoom 0.5: world width e' + ' o dobro de canvas width', () => {
    const r = computeViewportCullRect({
      viewportTransform: [0.5, 0, 0, 0.5, 0, 0],
      zoom: 0.5,
      width: 1000,
      height: 800
    })
    expect(r.right - r.left).toBe(2000 + (VIEWPORT_CULL_PADDING * 2))
    expect(r.bottom - r.top).toBe(1600 + (VIEWPORT_CULL_PADDING * 2))
  })

  it('zoom invalido (0/negativo) e' + ' clampado para 0.0001', () => {
    const r = computeViewportCullRect({
      viewportTransform: [1, 0, 0, 1, 0, 0],
      zoom: 0,
      width: 1000,
      height: 800
    })
    // 1000 / 0.0001 = 10_000_000 (mas funcao deve produzir valor finito)
    expect(Number.isFinite(r.right - r.left)).toBe(true)
  })

  it('viewportTransform null/missing: usa identidade', () => {
    const r = computeViewportCullRect({
      viewportTransform: null as any,
      zoom: 1,
      width: 100,
      height: 100
    })
    expect(r.left).toBe(-VIEWPORT_CULL_PADDING)
    expect(r.top).toBe(-VIEWPORT_CULL_PADDING)
  })

  it('padding customizavel via opt', () => {
    const r = computeViewportCullRect({
      viewportTransform: [1, 0, 0, 1, 0, 0],
      zoom: 1,
      width: 100,
      height: 100,
      padding: 50
    })
    expect(r.left).toBe(-50)
    expect(r.right).toBe(100 + 50)
  })
})

describe('restoreViewportCulledObjects', () => {
  const makeObj = (overrides: any = {}) => {
    const o: any = {
      visible: false,
      evented: false,
      selectable: false,
      __viewportCulled: true,
      __viewportCullPrevVisible: true,
      __viewportCullPrevEvented: true,
      __viewportCullPrevSelectable: true,
      ...overrides
    }
    o.set = (k: string, v: any) => { (o as any)[k] = v }
    return o
  }

  it('restaura objeto cullado para estado pre-cull', () => {
    const o = makeObj()
    const restored = restoreViewportCulledObjects([o])
    expect(restored).toBe(1)
    expect(o.visible).toBe(true)
    expect(o.evented).toBe(true)
    expect(o.selectable).toBe(true)
    expect(o.dirty).toBe(true)
    expect(o.__viewportCulled).toBeUndefined()
    expect(o.__viewportCullPrevVisible).toBeUndefined()
    expect(o.__viewportCullPrevEvented).toBeUndefined()
    expect(o.__viewportCullPrevSelectable).toBeUndefined()
  })

  it('ignora objetos sem flag __viewportCulled', () => {
    const o = makeObj({ __viewportCulled: false })
    const restored = restoreViewportCulledObjects([o])
    expect(restored).toBe(0)
    expect(o.visible).toBe(false) // intacto
  })

  it('backups undefined defaultam para true', () => {
    const o = makeObj({
      __viewportCullPrevVisible: undefined,
      __viewportCullPrevEvented: undefined,
      __viewportCullPrevSelectable: undefined
    })
    restoreViewportCulledObjects([o])
    expect(o.visible).toBe(true)
    expect(o.evented).toBe(true)
    expect(o.selectable).toBe(true)
  })

  it('backups false sao restaurados como false (preservados)', () => {
    const o = makeObj({
      __viewportCullPrevVisible: false,
      __viewportCullPrevEvented: false,
      __viewportCullPrevSelectable: false
    })
    restoreViewportCulledObjects([o])
    expect(o.visible).toBe(false)
    expect(o.evented).toBe(false)
    expect(o.selectable).toBe(false)
  })

  it('lista vazia: 0 restaurados', () => {
    expect(restoreViewportCulledObjects([])).toBe(0)
  })

  it('null/undefined em lista nao quebra', () => {
    const o = makeObj()
    const restored = restoreViewportCulledObjects([null, o, undefined])
    expect(restored).toBe(1)
  })

  it('multiplos objetos restaurados independentemente', () => {
    const a = makeObj()
    const b = makeObj({ __viewportCulled: false }) // sera ignorado
    const c = makeObj()
    expect(restoreViewportCulledObjects([a, b, c])).toBe(2)
  })
})
