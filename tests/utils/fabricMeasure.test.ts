import { describe, it, expect } from 'vitest'
import {
  isObjectShownForBounds,
  getObjectHorizontalBoundsLocal,
  measureHorizontalBoundsLocal,
  getObjectVerticalBoundsLocal,
  measureContentBoundsLocal,
  getObjectCenterInParentPlane,
  getCardBaseSizeForContainment,
  getObjectAbsoluteCenter,
  computeCentersBoundingCenter,
  guessAiSizeFromObject,
  setObjectCenterInParentPlane
} from '~/utils/fabricMeasure'

// Mock minimal de fabric.Object — duck-typed.
const obj = (overrides: Record<string, any> = {}) => ({
  visible: true,
  scaleX: 1,
  scaleY: 1,
  width: 100,
  height: 100,
  left: 0,
  top: 0,
  originX: 'left' as 'left' | 'center' | 'right',
  originY: 'top' as 'top' | 'center' | 'bottom',
  ...overrides
})

describe('isObjectShownForBounds', () => {
  it('null/undefined retornam false', () => {
    expect(isObjectShownForBounds(null)).toBe(false)
    expect(isObjectShownForBounds(undefined)).toBe(false)
  })

  it('visible=false retorna false', () => {
    expect(isObjectShownForBounds(obj({ visible: false }))).toBe(false)
  })

  it('scale=0 conta como invisivel (colapsado)', () => {
    expect(isObjectShownForBounds(obj({ scaleX: 0 }))).toBe(false)
    expect(isObjectShownForBounds(obj({ scaleY: 0 }))).toBe(false)
  })

  it('default visible+scale=1 retorna true', () => {
    expect(isObjectShownForBounds(obj({}))).toBe(true)
  })

  it('scale negativo (flip) ainda conta como visivel', () => {
    expect(isObjectShownForBounds(obj({ scaleX: -1 }))).toBe(true)
    expect(isObjectShownForBounds(obj({ scaleY: -2 }))).toBe(true)
  })
})

describe('getObjectHorizontalBoundsLocal — bbox horizontal por origem', () => {
  it('originX=left: left=x, right=x+width', () => {
    const b = getObjectHorizontalBoundsLocal(obj({ left: 50, width: 100 }))
    expect(b).toEqual({ left: 50, right: 150 })
  })

  it('originX=center: bbox simetrico ao redor de x', () => {
    const b = getObjectHorizontalBoundsLocal(obj({ left: 50, width: 100, originX: 'center' }))
    expect(b).toEqual({ left: 0, right: 100 })
  })

  it('originX=right: bbox termina em x', () => {
    const b = getObjectHorizontalBoundsLocal(obj({ left: 100, width: 100, originX: 'right' }))
    expect(b).toEqual({ left: 0, right: 100 })
  })

  it('aplica scaleX (e abs para flip negativo)', () => {
    const b = getObjectHorizontalBoundsLocal(obj({ left: 0, width: 100, scaleX: 1.5 }))
    expect(b).toEqual({ left: 0, right: 150 })
    const flipped = getObjectHorizontalBoundsLocal(obj({ left: 0, width: 100, scaleX: -2 }))
    expect(flipped).toEqual({ left: 0, right: 200 })
  })

  it('width=0 retorna null', () => {
    expect(getObjectHorizontalBoundsLocal(obj({ width: 0 }))).toBeNull()
  })

  it('objeto invisivel retorna null', () => {
    expect(getObjectHorizontalBoundsLocal(obj({ visible: false }))).toBeNull()
  })
})

describe('measureHorizontalBoundsLocal — uniao horizontal de varios', () => {
  it('uniao basica', () => {
    const r = measureHorizontalBoundsLocal([
      obj({ left: 0, width: 100 }),
      obj({ left: 200, width: 50 })
    ])
    expect(r).toEqual({ left: 0, right: 250, width: 250 })
  })

  it('ignora objetos invisiveis', () => {
    const r = measureHorizontalBoundsLocal([
      obj({ left: 0, width: 100 }),
      obj({ left: 1000, width: 50, visible: false })
    ])
    expect(r).toEqual({ left: 0, right: 100, width: 100 })
  })

  it('lista vazia / nenhum medivel retorna null', () => {
    expect(measureHorizontalBoundsLocal([])).toBeNull()
    expect(measureHorizontalBoundsLocal([obj({ visible: false })])).toBeNull()
  })

  it('aceita undefined como argumento', () => {
    expect(measureHorizontalBoundsLocal(undefined as any)).toBeNull()
  })
})

describe('getObjectVerticalBoundsLocal — bbox vertical por origem', () => {
  it('originY=top default', () => {
    const b = getObjectVerticalBoundsLocal(obj({ top: 50, height: 100 }))
    expect(b).toEqual({ top: 50, bottom: 150 })
  })

  it('originY=center', () => {
    const b = getObjectVerticalBoundsLocal(obj({ top: 50, height: 100, originY: 'center' }))
    expect(b).toEqual({ top: 0, bottom: 100 })
  })

  it('originY=bottom', () => {
    const b = getObjectVerticalBoundsLocal(obj({ top: 100, height: 100, originY: 'bottom' }))
    expect(b).toEqual({ top: 0, bottom: 100 })
  })

  it('aplica scaleY (abs)', () => {
    const b = getObjectVerticalBoundsLocal(obj({ top: 0, height: 100, scaleY: 2 }))
    expect(b).toEqual({ top: 0, bottom: 200 })
  })
})

describe('measureContentBoundsLocal — bbox 2D combinado', () => {
  it('uniao 2D de varios objetos', () => {
    const r = measureContentBoundsLocal([
      obj({ left: 0, top: 0, width: 50, height: 50 }),
      obj({ left: 100, top: 100, width: 50, height: 50 })
    ])
    expect(r).toEqual({
      left: 0,
      right: 150,
      top: 0,
      bottom: 150,
      width: 150,
      height: 150
    })
  })

  it('ignora objetos invisiveis em ambos os eixos', () => {
    const r = measureContentBoundsLocal([
      obj({ left: 0, top: 0, width: 50, height: 50 }),
      obj({ left: 999, top: 999, width: 50, height: 50, visible: false })
    ])
    expect(r).toEqual({
      left: 0,
      right: 50,
      top: 0,
      bottom: 50,
      width: 50,
      height: 50
    })
  })

  it('lista vazia retorna null', () => {
    expect(measureContentBoundsLocal([])).toBeNull()
    expect(measureContentBoundsLocal([obj({ visible: false })])).toBeNull()
  })

  it('preserva width/height ≥ 0 mesmo se bounds estranhos', () => {
    const r = measureContentBoundsLocal([
      obj({ left: 100, top: 100, width: 50, height: 50 })
    ])
    expect(r?.width).toBeGreaterThanOrEqual(0)
    expect(r?.height).toBeGreaterThanOrEqual(0)
  })
})

describe('getObjectCenterInParentPlane', () => {
  it('null retorna { 0, 0 }', () => {
    expect(getObjectCenterInParentPlane(null)).toEqual({ x: 0, y: 0 })
    expect(getObjectCenterInParentPlane(undefined)).toEqual({ x: 0, y: 0 })
  })

  it('prioriza getRelativeCenterPoint quando disponivel', () => {
    const o = {
      getRelativeCenterPoint: () => ({ x: 50, y: 75 }),
      // dados secundarios que NAO devem ser usados
      left: 999, top: 999, width: 100, height: 100
    }
    expect(getObjectCenterInParentPlane(o)).toEqual({ x: 50, y: 75 })
  })

  it('fallback derivado de left/top + origem (originX=left default)', () => {
    expect(getObjectCenterInParentPlane({
      left: 0, top: 0, width: 100, height: 50
    })).toEqual({ x: 50, y: 25 })
  })

  it('originX=center: cx = left literal', () => {
    expect(getObjectCenterInParentPlane({
      left: 100, top: 100, width: 50, height: 50,
      originX: 'center', originY: 'center'
    })).toEqual({ x: 100, y: 100 })
  })

  it('originX=right: cx = left - width/2', () => {
    expect(getObjectCenterInParentPlane({
      left: 100, top: 0, width: 50, height: 50, originX: 'right', originY: 'top'
    })).toEqual({ x: 75, y: 25 })
  })

  it('getRelativeCenterPoint que joga erro cai no fallback', () => {
    expect(getObjectCenterInParentPlane({
      getRelativeCenterPoint: () => { throw new Error('boom') },
      left: 0, top: 0, width: 100, height: 50
    })).toEqual({ x: 50, y: 25 })
  })

  it('aplica abs em scale negativo', () => {
    expect(getObjectCenterInParentPlane({
      left: 0, top: 0, width: 100, height: 100, scaleX: -1, scaleY: -1
    })).toEqual({ x: 50, y: 50 })
  })
})

describe('getCardBaseSizeForContainment', () => {
  it('null retorna null', () => {
    expect(getCardBaseSizeForContainment(null)).toBeNull()
  })

  it('prioridade 1: _cardWidth/_cardHeight', () => {
    expect(getCardBaseSizeForContainment({
      _cardWidth: 200,
      _cardHeight: 280,
      width: 999, height: 999
    })).toEqual({ w: 200, h: 280 })
  })

  it('prioridade 2: offerBackground via getObjects', () => {
    const card = {
      type: 'group',
      getObjects: () => [
        { type: 'rect', name: 'offerBackground', width: 150, height: 200 }
      ]
    }
    expect(getCardBaseSizeForContainment(card)).toEqual({ w: 150, h: 200 })
  })

  it('prioridade 3: card.width/card.height', () => {
    expect(getCardBaseSizeForContainment({ width: 100, height: 130 }))
      .toEqual({ w: 100, h: 130 })
  })

  it('null quando nada disponivel', () => {
    expect(getCardBaseSizeForContainment({})).toBeNull()
    expect(getCardBaseSizeForContainment({ width: 0, height: 0 })).toBeNull()
  })

  it('getObjects que joga erro nao quebra', () => {
    expect(getCardBaseSizeForContainment({
      type: 'group',
      getObjects: () => { throw new Error('boom') },
      width: 50, height: 50
    })).toEqual({ w: 50, h: 50 })
  })
})

describe('getObjectAbsoluteCenter', () => {
  it('null retorna { 0, 0 }', () => {
    expect(getObjectAbsoluteCenter(null)).toEqual({ x: 0, y: 0 })
  })

  it('usa getCenterPoint quando disponivel', () => {
    expect(getObjectAbsoluteCenter({
      getCenterPoint: () => ({ x: 100, y: 50 })
    })).toEqual({ x: 100, y: 50 })
  })

  it('fallback para left/top', () => {
    expect(getObjectAbsoluteCenter({ left: 50, top: 75 })).toEqual({ x: 50, y: 75 })
  })

  it('getCenterPoint que joga erro cai em fallback', () => {
    expect(getObjectAbsoluteCenter({
      getCenterPoint: () => { throw new Error('boom') },
      left: 10, top: 20
    })).toEqual({ x: 10, y: 20 })
  })

  it('NaN/missing left/top viram 0', () => {
    expect(getObjectAbsoluteCenter({})).toEqual({ x: 0, y: 0 })
    expect(getObjectAbsoluteCenter({ left: 'abc' })).toEqual({ x: 0, y: 0 })
  })
})

describe('computeCentersBoundingCenter', () => {
  it('lista vazia retorna { 0, 0 }', () => {
    expect(computeCentersBoundingCenter([])).toEqual({ x: 0, y: 0 })
    expect(computeCentersBoundingCenter(null as any)).toEqual({ x: 0, y: 0 })
  })

  it('um ponto retorna o proprio', () => {
    expect(computeCentersBoundingCenter([{ x: 50, y: 75 }])).toEqual({ x: 50, y: 75 })
  })

  it('multiplos pontos retornam o centro do AABB', () => {
    expect(computeCentersBoundingCenter([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 50 }
    ])).toEqual({ x: 50, y: 50 })
  })

  it('AABB assimetrico', () => {
    expect(computeCentersBoundingCenter([
      { x: 10, y: 20 },
      { x: 90, y: 80 }
    ])).toEqual({ x: 50, y: 50 })
  })
})

describe('guessAiSizeFromObject', () => {
  it('quadrado → 1024x1024', () => {
    expect(guessAiSizeFromObject({ width: 100, height: 100 })).toBe('1024x1024')
  })

  it('paisagem (ar > 1.15) → 1536x1024', () => {
    expect(guessAiSizeFromObject({ width: 200, height: 100 })).toBe('1536x1024')
  })

  it('retrato (ar < 0.87) → 1024x1536', () => {
    expect(guessAiSizeFromObject({ width: 100, height: 200 })).toBe('1024x1536')
  })

  it('quase-quadrado dentro do limiar permanece 1024x1024', () => {
    expect(guessAiSizeFromObject({ width: 100, height: 90 })).toBe('1024x1024')   // ar=1.11
    expect(guessAiSizeFromObject({ width: 90, height: 100 })).toBe('1024x1024')   // ar=0.9
  })

  it('aplica scaleX/Y quando getScaledWidth nao disponivel', () => {
    expect(guessAiSizeFromObject({ width: 100, height: 100, scaleX: 2, scaleY: 1 }))
      .toBe('1536x1024')
  })

  it('prefere getScaledWidth/Height quando disponivel', () => {
    expect(guessAiSizeFromObject({
      width: 999, height: 999,
      getScaledWidth: () => 200,
      getScaledHeight: () => 100
    })).toBe('1536x1024')
  })

  it('null/undefined cai em ar=1 → 1024x1024', () => {
    expect(guessAiSizeFromObject(null)).toBe('1024x1024')
    expect(guessAiSizeFromObject({})).toBe('1024x1024')
  })
})

describe('setObjectCenterInParentPlane', () => {
  const makeObj = (overrides: any = {}) => {
    const o: any = {
      left: 0, top: 0, originX: 'left', originY: 'top',
      setPositionByOrigin(point: any, ox: string, oy: string) {
        this.lastPositionCall = { point, ox, oy }
      },
      set(props: any) { Object.assign(this, props) },
      ...overrides
    }
    return o
  }

  it('null/undefined: no-op', () => {
    expect(() => setObjectCenterInParentPlane(null, 100, 200)).not.toThrow()
    expect(() => setObjectCenterInParentPlane(undefined, 100, 200)).not.toThrow()
  })

  it('com pointFactory: usa setPositionByOrigin com Point construido', () => {
    const obj = makeObj()
    const factory = (x: number, y: number) => ({ x, y, _isPoint: true })
    setObjectCenterInParentPlane(obj, 50, 75, factory)
    expect(obj.lastPositionCall).toEqual({
      point: { x: 50, y: 75, _isPoint: true },
      ox: 'center',
      oy: 'center'
    })
  })

  it('sem pointFactory: fallback set({left, top, origin})', () => {
    const obj = makeObj()
    setObjectCenterInParentPlane(obj, 50, 75)
    expect(obj.left).toBe(50)
    expect(obj.top).toBe(75)
    expect(obj.originX).toBe('center')
    expect(obj.originY).toBe('center')
    expect(obj.lastPositionCall).toBeUndefined() // nao chamou
  })

  it('obj sem setPositionByOrigin: fallback mesmo com factory', () => {
    const obj = { left: 0, top: 0, set(props: any) { Object.assign(this, props) } } as any
    const factory = (x: number, y: number) => ({ x, y })
    setObjectCenterInParentPlane(obj, 100, 200, factory)
    expect(obj.left).toBe(100)
    expect(obj.top).toBe(200)
  })

  it('obj sem .set tampouco: nao crasha', () => {
    const obj: any = { left: 0, top: 0 }
    expect(() => setObjectCenterInParentPlane(obj, 50, 75)).not.toThrow()
  })
})
