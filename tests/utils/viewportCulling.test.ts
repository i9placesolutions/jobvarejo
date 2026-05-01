import { describe, it, expect } from 'vitest'
import {
  isObjectIntersectingCullRect,
  shouldSkipViewportCullObject
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
