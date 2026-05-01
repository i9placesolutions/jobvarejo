import { describe, it, expect } from 'vitest'
import {
  isCanvasContextError,
  isValidFabricCanvasObject,
  isValidClipPath
} from '~/utils/canvasValidation'

describe('isCanvasContextError', () => {
  it('detecta clearRect', () => {
    expect(isCanvasContextError(new Error('Failed to clearRect'))).toBe(true)
    expect(isCanvasContextError({ message: 'clearRect issue' })).toBe(true)
  })

  it('detecta contextContainer', () => {
    expect(isCanvasContextError(new Error('contextContainer is null'))).toBe(true)
  })

  it('detecta getContext', () => {
    expect(isCanvasContextError(new Error('Cannot getContext'))).toBe(true)
  })

  it('case insensitive', () => {
    expect(isCanvasContextError(new Error('CLEARRECT failed'))).toBe(true)
    expect(isCanvasContextError(new Error('GetContext error'))).toBe(true)
  })

  it('rejeita erros nao-relacionados', () => {
    expect(isCanvasContextError(new Error('TypeError: foo'))).toBe(false)
    expect(isCanvasContextError({ message: 'network error' })).toBe(false)
    expect(isCanvasContextError(null)).toBe(false)
    expect(isCanvasContextError(undefined)).toBe(false)
  })

  it('aceita string direta', () => {
    expect(isCanvasContextError('clearRect failed')).toBe(true)
    expect(isCanvasContextError('something else')).toBe(false)
  })
})

describe('isValidFabricCanvasObject', () => {
  const validObj = () => ({
    render: () => {},
    setCoords: () => {},
    set: () => {},
    toObject: () => ({})
  })

  it('aceita objeto com toda a API basica', () => {
    expect(isValidFabricCanvasObject(validObj())).toBe(true)
  })

  it('rejeita null/undefined/primitivos', () => {
    expect(isValidFabricCanvasObject(null)).toBe(false)
    expect(isValidFabricCanvasObject(undefined)).toBe(false)
    expect(isValidFabricCanvasObject('str')).toBe(false)
    expect(isValidFabricCanvasObject(42)).toBe(false)
  })

  it('rejeita objeto sem render', () => {
    const o: any = validObj()
    delete o.render
    expect(isValidFabricCanvasObject(o)).toBe(false)
  })

  it('rejeita objeto sem setCoords', () => {
    const o: any = validObj()
    delete o.setCoords
    expect(isValidFabricCanvasObject(o)).toBe(false)
  })

  it('rejeita objeto sem set', () => {
    const o: any = validObj()
    delete o.set
    expect(isValidFabricCanvasObject(o)).toBe(false)
  })

  it('rejeita objeto sem toObject', () => {
    const o: any = validObj()
    delete o.toObject
    expect(isValidFabricCanvasObject(o)).toBe(false)
  })

  it('rejeita quando render e' + ' propriedade nao-funcao', () => {
    const o: any = validObj()
    o.render = 'string'
    expect(isValidFabricCanvasObject(o)).toBe(false)
  })
})

describe('isValidClipPath', () => {
  const validClip = (overrides: any = {}) => ({
    type: 'rect',
    render: () => {},
    ...overrides
  })

  it('rejeita null/undefined', () => {
    expect(isValidClipPath(null)).toBe(false)
    expect(isValidClipPath(undefined)).toBe(false)
  })

  it('rejeita primitivos e arrays', () => {
    expect(isValidClipPath('str')).toBe(false)
    expect(isValidClipPath(42)).toBe(false)
    expect(isValidClipPath([])).toBe(false)
  })

  it('rejeita objeto sem type', () => {
    expect(isValidClipPath({ render: () => {} })).toBe(false)
  })

  it('rejeita objeto sem render', () => {
    expect(isValidClipPath({ type: 'rect' })).toBe(false)
  })

  it('aceita rect simples valido', () => {
    expect(isValidClipPath(validClip())).toBe(true)
  })

  it('REGRESSAO: _objects deve ser array (nunca undefined em group)', () => {
    expect(isValidClipPath(validClip({ type: 'group' }))).toBe(false) // sem _objects
    expect(isValidClipPath(validClip({ type: 'activeSelection' }))).toBe(false)
    expect(isValidClipPath(validClip({ type: 'group', _objects: [] }))).toBe(true)
  })

  it('REGRESSAO: _objects nao-array em qualquer tipo e invalido', () => {
    expect(isValidClipPath(validClip({ _objects: 'not-array' }))).toBe(false)
    expect(isValidClipPath(validClip({ _objects: {} }))).toBe(false)
  })

  it('valida clipPath aninhado recursivamente', () => {
    const inner = validClip({ type: 'rect' })
    expect(isValidClipPath(validClip({ clipPath: inner }))).toBe(true)

    const invalidInner = { type: 'rect' } // sem render
    expect(isValidClipPath(validClip({ clipPath: invalidInner }))).toBe(false)
  })

  it('valida children dentro de _objects (rejeita se algum tem _objects invalido)', () => {
    const validChild = { type: 'rect', _objects: [] }
    const invalidChild = { type: 'group', _objects: 'bad' }
    expect(isValidClipPath(validClip({
      type: 'group',
      _objects: [validChild, invalidChild]
    }))).toBe(false)
  })

  it('valida clipPath aninhado dentro de child', () => {
    const childWithBadClip = { type: 'rect', clipPath: { type: 'rect' } } // clipPath child sem render
    expect(isValidClipPath(validClip({
      type: 'group',
      _objects: [childWithBadClip]
    }))).toBe(false)
  })
})
