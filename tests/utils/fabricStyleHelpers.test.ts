import { describe, it, expect } from 'vitest'
import {
  isRectObject,
  clampCornerRadii,
  isTransparentPaint,
  toggleFill,
  toggleStroke
} from '~/utils/fabricStyleHelpers'

describe('isRectObject', () => {
  it('aceita type=rect (case insensitive)', () => {
    expect(isRectObject({ type: 'rect' })).toBe(true)
    expect(isRectObject({ type: 'Rect' })).toBe(true)
    expect(isRectObject({ type: 'RECT' })).toBe(true)
  })

  it('rejeita outros types e null/undefined', () => {
    expect(isRectObject({ type: 'image' })).toBe(false)
    expect(isRectObject({ type: 'group' })).toBe(false)
    expect(isRectObject(null)).toBe(false)
    expect(isRectObject(undefined)).toBe(false)
    expect(isRectObject({})).toBe(false)
  })
})

describe('clampCornerRadii', () => {
  it('clampa cada raio em [0, w/2] e [0, h/2]', () => {
    expect(clampCornerRadii({ tl: 100, tr: 100, br: 100, bl: 100 }, 50, 50))
      .toEqual({ tl: 25, tr: 25, br: 25, bl: 25 })
  })

  it('valores negativos viram 0', () => {
    expect(clampCornerRadii({ tl: -10, tr: -1, br: -100, bl: -0.1 }, 100, 100))
      .toEqual({ tl: 0, tr: 0, br: 0, bl: 0 })
  })

  it('NaN/null/undefined viram 0', () => {
    expect(clampCornerRadii({ tl: NaN, tr: null, br: undefined }, 100, 100))
      .toEqual({ tl: 0, tr: 0, br: 0, bl: 0 })
  })

  it('aceita strings parseaveis (Number coerce)', () => {
    expect(clampCornerRadii({ tl: '10', tr: '20' }, 100, 100))
      .toEqual({ tl: 10, tr: 20, br: 0, bl: 0 })
  })

  it('w/h muito pequenos limitam todos os raios', () => {
    expect(clampCornerRadii({ tl: 50, tr: 50, br: 50, bl: 50 }, 4, 6))
      .toEqual({ tl: 2, tr: 2, br: 2, bl: 2 })
  })

  it('aceita radii nulo/undefined', () => {
    expect(clampCornerRadii(null, 100, 100)).toEqual({ tl: 0, tr: 0, br: 0, bl: 0 })
    expect(clampCornerRadii(undefined, 100, 100)).toEqual({ tl: 0, tr: 0, br: 0, bl: 0 })
  })
})

describe('isTransparentPaint', () => {
  it('null/undefined sao transparentes', () => {
    expect(isTransparentPaint(null)).toBe(true)
    expect(isTransparentPaint(undefined)).toBe(true)
  })

  it('strings vazias / "transparent" sao transparentes', () => {
    expect(isTransparentPaint('')).toBe(true)
    expect(isTransparentPaint('transparent')).toBe(true)
  })

  it('rgba(...,0) e variantes com whitespace sao transparentes', () => {
    expect(isTransparentPaint('rgba(0,0,0,0)')).toBe(true)
    expect(isTransparentPaint('rgba(255, 0, 0, 0)')).toBe(true)
    expect(isTransparentPaint('rgba( 100 , 100 , 100 , 0 )')).toBe(true)
  })

  it('rgba com alpha > 0 NAO e transparente', () => {
    expect(isTransparentPaint('rgba(0,0,0,0.1)')).toBe(false)
    expect(isTransparentPaint('rgba(0,0,0,1)')).toBe(false)
  })

  it('hex e rgb solido NAO sao transparentes', () => {
    expect(isTransparentPaint('#ffffff')).toBe(false)
    expect(isTransparentPaint('#000')).toBe(false)
    expect(isTransparentPaint('rgb(255,255,255)')).toBe(false)
  })

  it('valores nao-string nao-null retornam false', () => {
    expect(isTransparentPaint(0)).toBe(false)
    expect(isTransparentPaint({})).toBe(false)
  })
})

describe('toggleFill', () => {
  const makeObj = (fill: any) => {
    const o: any = { fill }
    o.set = (k: string, v: any) => { (o as any)[k] = v }
    return o
  }

  it('null/undefined no-op silencioso', () => {
    expect(() => toggleFill(null, true)).not.toThrow()
    expect(() => toggleFill(undefined, false)).not.toThrow()
  })

  it('disable: salva fill atual em __fillBackup e aplica rgba transparente', () => {
    const o = makeObj('#ff0000')
    toggleFill(o, false)
    expect(o.__fillBackup).toBe('#ff0000')
    expect(o.fill).toBe('rgba(0,0,0,0)')
    expect(o.__fillEnabled).toBe(false)
  })

  it('enable apos disable: restaura backup', () => {
    const o = makeObj('#ff0000')
    toggleFill(o, false)
    toggleFill(o, true)
    expect(o.fill).toBe('#ff0000')
    expect(o.__fillEnabled).toBe(true)
  })

  it('enable sem backup valido + fill atual valido: usa fill atual', () => {
    const o = makeObj('#abc')
    toggleFill(o, true)
    expect(o.fill).toBe('#abc')
  })

  it('enable sem backup nem fill validos: cai para #ffffff', () => {
    const o = makeObj('rgba(0,0,0,0)')
    o.__fillBackup = ''
    toggleFill(o, true)
    expect(o.fill).toBe('#ffffff')
  })

  it('roundtrip enable→disable→enable preserva cor original', () => {
    const o = makeObj('#123456')
    toggleFill(o, true)
    toggleFill(o, false)
    toggleFill(o, true)
    expect(o.fill).toBe('#123456')
  })
})

describe('toggleStroke', () => {
  const makeObj = (overrides: any = {}) => {
    const o: any = {
      stroke: '#000000',
      strokeWidth: 2,
      strokeDashArray: null,
      ...overrides
    }
    o.set = (k: any, v?: any) => {
      if (typeof k === 'string') {
        ;(o as any)[k] = v
      } else {
        Object.assign(o, k)
      }
    }
    return o
  }

  it('null/undefined no-op', () => {
    expect(() => toggleStroke(null, true)).not.toThrow()
    expect(() => toggleStroke(undefined, false)).not.toThrow()
  })

  it('disable: salva backups e zera stroke/width/dash', () => {
    const o = makeObj({ stroke: '#ff0000', strokeWidth: 4, strokeDashArray: [5, 5] })
    toggleStroke(o, false)
    expect(o.__strokeBackup).toBe('#ff0000')
    expect(o.__strokeWidthBackup).toBe(4)
    expect(o.__strokeDashBackup).toEqual([5, 5])
    expect(o.stroke).toBe('rgba(0,0,0,0)')
    expect(o.strokeWidth).toBe(0)
    expect(o.strokeDashArray).toBeNull()
    expect(o.__strokeEnabled).toBe(false)
  })

  it('enable apos disable: restaura backups', () => {
    const o = makeObj({ stroke: '#ff0000', strokeWidth: 4, strokeDashArray: [10, 10] })
    toggleStroke(o, false)
    toggleStroke(o, true)
    expect(o.stroke).toBe('#ff0000')
    expect(o.strokeWidth).toBe(4)
    expect(o.strokeDashArray).toEqual([10, 10])
    expect(o.__strokeEnabled).toBe(true)
  })

  it('enable sem backups validos: defaults #000000 / strokeWidth 1', () => {
    const o = makeObj({ stroke: '', strokeWidth: 0 })
    toggleStroke(o, true)
    expect(o.stroke).toBe('#000000')
    expect(o.strokeWidth).toBe(1)
  })

  it('roundtrip preserva valores originais', () => {
    const o = makeObj({ stroke: '#abc', strokeWidth: 3, strokeDashArray: [2, 2] })
    toggleStroke(o, true)
    toggleStroke(o, false)
    toggleStroke(o, true)
    expect(o.stroke).toBe('#abc')
    expect(o.strokeWidth).toBe(3)
    expect(o.strokeDashArray).toEqual([2, 2])
  })
})
