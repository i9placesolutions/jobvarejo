import { describe, it, expect } from 'vitest'
import {
  getPreferredProductImageFromGroup,
  getImageTrimmedDimensions,
  getImageSourceFromObject,
  findImageTargetInSelection,
  applyImageTrimBounds,
  fitImageIntoSlot
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

describe('findImageTargetInSelection', () => {
  it('null retorna null', () => {
    expect(findImageTargetInSelection(null)).toBeNull()
    expect(findImageTargetInSelection(undefined)).toBeNull()
  })

  it('image direta: retorna { img, parent: null }', () => {
    const img = { type: 'image' }
    expect(findImageTargetInSelection(img)).toEqual({ img, parent: null })
  })

  it('group com imagem dentro: retorna { img, parent: group }', () => {
    const img = { type: 'image' }
    const group = {
      type: 'group',
      getObjects: () => [{ type: 'rect' }, img]
    }
    expect(findImageTargetInSelection(group)).toEqual({ img, parent: group })
  })

  it('activeSelection com imagem dentro funciona', () => {
    const img = { type: 'image' }
    const sel = {
      type: 'activeSelection',
      getObjects: () => [img]
    }
    expect(findImageTargetInSelection(sel)).toEqual({ img, parent: sel })
  })

  it('group sem imagem retorna null', () => {
    expect(findImageTargetInSelection({
      type: 'group',
      getObjects: () => [{ type: 'rect' }, { type: 'text' }]
    })).toBeNull()
  })

  it('outros tipos (rect, text) retornam null', () => {
    expect(findImageTargetInSelection({ type: 'rect' })).toBeNull()
    expect(findImageTargetInSelection({ type: 'text' })).toBeNull()
  })

  it('case insensitive no type', () => {
    expect(findImageTargetInSelection({ type: 'IMAGE' })?.parent).toBeNull()
  })
})

describe('applyImageTrimBounds', () => {
  const makeImg = () => {
    const setCalls: any[] = []
    return {
      cropX: 0, cropY: 0, width: 0, height: 0, dirty: false,
      _calls: setCalls,
      set(props: any) { Object.assign(this, props); setCalls.push(props) }
    } as any
  }

  it('img null/trimBounds null: retorna null sem mutar', () => {
    expect(applyImageTrimBounds(null, { left: 0, top: 0, width: 1, height: 1 })).toBeNull()
    const img = makeImg()
    expect(applyImageTrimBounds(img, null)).toBeNull()
    expect(img._calls).toHaveLength(0)
  })

  it('aplica cropX/cropY/width/height + dirty', () => {
    const img = makeImg()
    const trim = { left: 10, top: 20, width: 100, height: 80 }
    expect(applyImageTrimBounds(img, trim)).toBe(trim)
    expect(img.cropX).toBe(10)
    expect(img.cropY).toBe(20)
    expect(img.width).toBe(100)
    expect(img.height).toBe(80)
    expect(img.dirty).toBe(true)
  })
})

describe('fitImageIntoSlot', () => {
  const makeImg = (overrides: any = {}) => {
    const setCalls: any[] = []
    let coords = 0
    return {
      width: 100,
      height: 100,
      cropX: 0,
      cropY: 0,
      _calls: setCalls,
      _setCoords: () => coords,
      set(props: any) { Object.assign(this, props); setCalls.push(props) },
      setCoords() { coords += 1 },
      ...overrides
    } as any
  }

  it('img null: no-op', () => {
    expect(() => fitImageIntoSlot(null, { width: 100, height: 100 })).not.toThrow()
  })

  it('escala proporcional para caber no slot', () => {
    const img = makeImg({ width: 200, height: 100 })
    fitImageIntoSlot(img, { width: 100, height: 100 })
    // trimmed 200x100 → scale = min(100/200, 100/100, 3) = 0.5
    expect(img.scaleX).toBe(0.5)
    expect(img.scaleY).toBe(0.5)
  })

  it('clamp em maxScale (default 3)', () => {
    const img = makeImg({ width: 10, height: 10 })
    fitImageIntoSlot(img, { width: 1000, height: 1000 })
    // 1000/10 = 100 mas clamp em 3
    expect(img.scaleX).toBe(3)
  })

  it('aceita maxScale customizado', () => {
    const img = makeImg({ width: 10, height: 10 })
    fitImageIntoSlot(img, { width: 100, height: 100 }, { maxScale: 5 })
    // 100/10 = 10 → clamp em 5
    expect(img.scaleX).toBe(5)
  })

  it('aplica origin/left/top/name + defaults seguros', () => {
    const img = makeImg()
    fitImageIntoSlot(img, { width: 100, height: 100, left: 50, top: 25, name: 'custom' })
    expect(img.left).toBe(50)
    expect(img.top).toBe(25)
    expect(img.originX).toBe('center')
    expect(img.originY).toBe('center')
    expect(img.name).toBe('custom')
    expect(img.visible).toBe(true)
    expect(img.opacity).toBe(1)
    expect(img.lockScalingFlip).toBe(true)
  })

  it('originX/Y customizado', () => {
    const img = makeImg()
    fitImageIntoSlot(img, { width: 100, height: 100, originX: 'left', originY: 'top' })
    expect(img.originX).toBe('left')
    expect(img.originY).toBe('top')
  })

  it('slot dimensions invalidas (0/NaN) tratadas como 1', () => {
    const img = makeImg({ width: 100, height: 100 })
    fitImageIntoSlot(img, { width: 0, height: NaN as any })
    // slotWidth/Height fallback 1, scale = min(1/100, 1/100, 3) = 0.01
    expect(img.scaleX).toBeCloseTo(0.01)
  })
})
