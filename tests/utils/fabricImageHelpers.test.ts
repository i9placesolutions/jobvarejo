import { describe, it, expect } from 'vitest'
import {
  getPreferredProductImageFromGroup,
  getImageTrimmedDimensions,
  getImageSourceFromObject
} from '~/utils/fabricImageHelpers'

const group = (children: any[]) => ({
  type: 'group',
  getObjects: () => children
})

const image = (overrides: any = {}) => ({
  type: 'image',
  ...overrides
})

describe('getPreferredProductImageFromGroup', () => {
  it('null/sem getObjects retorna null', () => {
    expect(getPreferredProductImageFromGroup(null)).toBeNull()
    expect(getPreferredProductImageFromGroup({})).toBeNull()
    expect(getPreferredProductImageFromGroup({ type: 'group' })).toBeNull()
  })

  it('group vazio retorna null', () => {
    expect(getPreferredProductImageFromGroup(group([]))).toBeNull()
  })

  it('group sem imagem retorna null', () => {
    expect(getPreferredProductImageFromGroup(group([
      { type: 'rect' }, { type: 'i-text' }
    ]))).toBeNull()
  })

  it('prioriza smart_image', () => {
    const smart = image({ name: 'smart_image' })
    const random = image({ name: 'qualquer' })
    expect(getPreferredProductImageFromGroup(group([random, smart]))).toBe(smart)
  })

  it('prioriza product_image quando nao tem smart_image', () => {
    const prod = image({ name: 'product_image' })
    const random = image({ name: 'qualquer' })
    expect(getPreferredProductImageFromGroup(group([random, prod]))).toBe(prod)
  })

  it('prioriza productImage (camelCase) tambem', () => {
    const camel = image({ name: 'productImage' })
    const random = image({ name: 'foo' })
    expect(getPreferredProductImageFromGroup(group([random, camel]))).toBe(camel)
  })

  it('fallback: primeira imagem qualquer quando nada com nome conhecido', () => {
    const generic = image({ name: 'random-name' })
    expect(getPreferredProductImageFromGroup(group([
      { type: 'rect' }, generic, image({ name: 'other' })
    ]))).toBe(generic)
  })

  it('case-insensitive no type, mas case-sensitive no name', () => {
    const upper = { type: 'IMAGE', name: 'smart_image' }
    expect(getPreferredProductImageFromGroup(group([upper]))).toBe(upper)
  })
})

describe('getImageTrimmedDimensions', () => {
  it('com crop ativo: usa width/height correntes (ja pos-crop)', () => {
    expect(getImageTrimmedDimensions({
      width: 200,
      height: 100,
      cropX: 10,
      cropY: 0
    })).toEqual({ width: 200, height: 100 })
  })

  it('sem crop, com getElement().naturalWidth/Height', () => {
    expect(getImageTrimmedDimensions({
      width: 100,
      height: 100,
      getElement: () => ({ naturalWidth: 800, naturalHeight: 600 })
    })).toEqual({ width: 800, height: 600 })
  })

  it('sem crop e sem getElement: cai para width/height correntes', () => {
    expect(getImageTrimmedDimensions({
      width: 100,
      height: 50
    })).toEqual({ width: 100, height: 50 })
  })

  it('garante minimo 1 (evita divisao por zero downstream)', () => {
    expect(getImageTrimmedDimensions(null)).toEqual({ width: 1, height: 1 })
    expect(getImageTrimmedDimensions({})).toEqual({ width: 1, height: 1 })
    expect(getImageTrimmedDimensions({ width: 0, height: 0 })).toEqual({ width: 1, height: 1 })
  })

  it('cropY sozinho ja conta como crop ativo', () => {
    expect(getImageTrimmedDimensions({
      width: 100,
      height: 100,
      cropY: 5,
      getElement: () => ({ naturalWidth: 999, naturalHeight: 999 })
    })).toEqual({ width: 100, height: 100 })
  })

  it('naturalWidth=0 cai para width corrente', () => {
    expect(getImageTrimmedDimensions({
      width: 50,
      height: 75,
      getElement: () => ({ naturalWidth: 0, naturalHeight: 0 })
    })).toEqual({ width: 50, height: 75 })
  })
})

describe('getImageSourceFromObject', () => {
  it('prioriza img.src direto', () => {
    expect(getImageSourceFromObject({ src: 'https://example.com/a.png' }))
      .toBe('https://example.com/a.png')
  })

  it('cai para getSrc() quando img.src vazio', () => {
    expect(getImageSourceFromObject({
      src: '',
      getSrc: () => 'https://example.com/b.png'
    })).toBe('https://example.com/b.png')
  })

  it('cai para _element.src como ultimo recurso', () => {
    expect(getImageSourceFromObject({
      _element: { src: 'https://example.com/c.png' }
    })).toBe('https://example.com/c.png')
  })

  it('retorna string vazia quando nada disponivel', () => {
    expect(getImageSourceFromObject({})).toBe('')
    expect(getImageSourceFromObject(null)).toBe('')
    expect(getImageSourceFromObject(undefined)).toBe('')
  })

  it('aplica trim', () => {
    expect(getImageSourceFromObject({ src: '  https://example.com/x.png  ' }))
      .toBe('https://example.com/x.png')
  })

  it('getSrc nao-funcao e ignorado', () => {
    expect(getImageSourceFromObject({
      src: '',
      getSrc: 'not-a-function',
      _element: { src: 'fallback' }
    })).toBe('fallback')
  })
})
