import { describe, it, expect } from 'vitest'
import {
  TRANSIENT_CONTROL_NAMES,
  isControlLikeObject,
  isTransientCanvasObject
} from '~/utils/controlObjectClassifiers'

describe('TRANSIENT_CONTROL_NAMES', () => {
  it('contem todos os nomes esperados', () => {
    expect(TRANSIENT_CONTROL_NAMES.has('path_node')).toBe(true)
    expect(TRANSIENT_CONTROL_NAMES.has('bezier_handle')).toBe(true)
    expect(TRANSIENT_CONTROL_NAMES.has('control_point')).toBe(true)
    expect(TRANSIENT_CONTROL_NAMES.has('handle_line')).toBe(true)
  })

  it('rejeita nomes nao-control', () => {
    expect(TRANSIENT_CONTROL_NAMES.has('priceGroup')).toBe(false)
    expect(TRANSIENT_CONTROL_NAMES.has('smart_image')).toBe(false)
  })
})

describe('isControlLikeObject', () => {
  it('aceita objetos com name em TRANSIENT_CONTROL_NAMES', () => {
    expect(isControlLikeObject({ name: 'path_node' })).toBe(true)
    expect(isControlLikeObject({ name: 'bezier_handle' })).toBe(true)
    expect(isControlLikeObject({ name: 'control_point' })).toBe(true)
    expect(isControlLikeObject({ name: 'handle_line' })).toBe(true)
  })

  it('aceita id "guide-vertical" / "guide-horizontal" (drag guides)', () => {
    expect(isControlLikeObject({ id: 'guide-vertical' })).toBe(true)
    expect(isControlLikeObject({ id: 'guide-horizontal' })).toBe(true)
  })

  it('aceita data.parentPath / data.parentObj (overlay path edit)', () => {
    expect(isControlLikeObject({ data: { parentPath: {} } })).toBe(true)
    expect(isControlLikeObject({ data: { parentObj: {} } })).toBe(true)
  })

  it('rejeita objetos comuns', () => {
    expect(isControlLikeObject({ name: 'smart_image' })).toBe(false)
    expect(isControlLikeObject({ name: 'priceGroup' })).toBe(false)
    expect(isControlLikeObject({ id: 'frame-1' })).toBe(false)
    expect(isControlLikeObject({ data: {} })).toBe(false)
    expect(isControlLikeObject({})).toBe(false)
  })

  it('rejeita null/undefined/primitivos', () => {
    expect(isControlLikeObject(null)).toBe(false)
    expect(isControlLikeObject(undefined)).toBe(false)
    expect(isControlLikeObject('str')).toBe(false)
    expect(isControlLikeObject(42)).toBe(false)
  })

  it('REGRESSAO: outras user guides (guide-user-*) NAO sao control-like', () => {
    // Apenas as drag-guides (vertical/horizontal) sao control;
    // user guides (guide-user-N) sao persistidas, nao transient.
    expect(isControlLikeObject({ id: 'guide-user-1' })).toBe(false)
  })
})

describe('isTransientCanvasObject', () => {
  it('com _customId valido nunca e transient', () => {
    expect(isTransientCanvasObject({
      _customId: 'abc',
      excludeFromExport: true
    })).toBe(false)
  })

  it('control-like sem _customId e transient', () => {
    expect(isTransientCanvasObject({ name: 'path_node' })).toBe(true)
  })

  it('circle pequeno com excludeFromExport e transient', () => {
    expect(isTransientCanvasObject({
      type: 'circle',
      radius: 5,
      excludeFromExport: true
    })).toBe(true)
  })

  it('circle grande NAO e transient', () => {
    expect(isTransientCanvasObject({
      type: 'circle',
      radius: 50,
      excludeFromExport: true
    })).toBe(false)
  })

  it('line/path com excludeFromExport sao transient', () => {
    expect(isTransientCanvasObject({ type: 'line', excludeFromExport: true })).toBe(true)
    expect(isTransientCanvasObject({ type: 'path', excludeFromExport: true })).toBe(true)
  })

  it('vector path NAO e transient mesmo com excludeFromExport', () => {
    expect(isTransientCanvasObject({
      type: 'path',
      isVectorPath: true,
      excludeFromExport: true
    })).toBe(false)
  })

  it('content persistente com excludeFromExport NAO e transient', () => {
    expect(isTransientCanvasObject({ type: 'group', isFrame: true, excludeFromExport: true })).toBe(false)
    expect(isTransientCanvasObject({ type: 'group', isProductZone: true, excludeFromExport: true })).toBe(false)
    expect(isTransientCanvasObject({ id: 'artboard-bg', excludeFromExport: true })).toBe(false)
  })

  it('null/objeto sem sinais especiais nao e transient', () => {
    expect(isTransientCanvasObject(null)).toBe(false)
    expect(isTransientCanvasObject({})).toBe(false)
    expect(isTransientCanvasObject({ type: 'rect' })).toBe(false)
  })
})
