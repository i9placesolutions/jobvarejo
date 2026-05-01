import { describe, it, expect } from 'vitest'
import {
  isRectObject,
  clampCornerRadii,
  isTransparentPaint,
  toggleFill,
  toggleStroke,
  applyRectCornerRadiiPatch,
  snapshotTextShadow,
  computeLinearGradientCoords
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

describe('applyRectCornerRadiiPatch', () => {
  const makeRect = (overrides: any = {}) => {
    const calls: Array<{ k: any; v: any }> = []
    const r: any = {
      type: 'rect',
      width: 100,
      height: 50,
      cornerRadii: null,
      _render: function () {},
      _renderPaintInOrder: function () {},
      ...overrides
    }
    r.set = (k: any, v?: any) => {
      if (typeof k === 'string') {
        calls.push({ k, v })
        ;(r as any)[k] = v
      } else {
        Object.entries(k).forEach(([key, val]) => {
          calls.push({ k: key, v: val })
          ;(r as any)[key] = val
        })
      }
    }
    r._calls = calls
    return r
  }

  it('null/non-rect/sem _renderPaintInOrder: no-op', () => {
    expect(() => applyRectCornerRadiiPatch(null)).not.toThrow()
    expect(() => applyRectCornerRadiiPatch({ type: 'image', _renderPaintInOrder: () => {} })).not.toThrow()
    expect(() => applyRectCornerRadiiPatch({ type: 'rect' })).not.toThrow() // sem _renderPaintInOrder
  })

  it('sem cornerRadii: restaura _render original quando havia patch', () => {
    const r = makeRect()
    const original = r._render
    ;(r as any).__origRender = original
    r._render = function () { /* patched */ } // simula que ja foi patched
    applyRectCornerRadiiPatch(r)
    expect(r._render).toBe(original)
    expect((r as any).__origRender).toBeUndefined()
    expect(r.dirty).toBe(true)
  })

  it('sem cornerRadii e sem patch previo: no-op (mantem _render como esta)', () => {
    const r = makeRect()
    const orig = r._render
    applyRectCornerRadiiPatch(r)
    expect(r._render).toBe(orig)
  })

  it('com cornerRadii: salva _render original e patcha', () => {
    const original = function () {}
    const r = makeRect({
      _render: original,
      cornerRadii: { tl: 10, tr: 10, br: 10, bl: 10 }
    })
    applyRectCornerRadiiPatch(r)
    expect((r as any).__origRender).toBe(original)
    expect(r._render).not.toBe(original)
    expect(r.rx).toBe(0)
    expect(r.ry).toBe(0)
    expect(r.dirty).toBe(true)
  })

  it('com cornerRadii e __origRender ja existente: nao sobrescreve original', () => {
    const truelyOriginal = function () { /* original */ }
    const r = makeRect({
      _render: function () { /* already patched */ },
      cornerRadii: { tl: 5 }
    })
    ;(r as any).__origRender = truelyOriginal
    applyRectCornerRadiiPatch(r)
    expect((r as any).__origRender).toBe(truelyOriginal) // preservado
  })

  it('cornerRadii nao-objeto e tratado como ausente', () => {
    const r = makeRect({ cornerRadii: 'invalid' })
    const orig = r._render
    applyRectCornerRadiiPatch(r)
    expect(r._render).toBe(orig)
  })
})

describe('snapshotTextShadow', () => {
  it('null/undefined retornam null', () => {
    expect(snapshotTextShadow(null)).toBeNull()
    expect(snapshotTextShadow(undefined)).toBeNull()
    expect(snapshotTextShadow(0)).toBeNull()
  })

  it('normaliza shadow completo', () => {
    expect(snapshotTextShadow({
      color: '#ff0000',
      blur: 10,
      offsetX: 5,
      offsetY: -3
    })).toEqual({
      color: '#ff0000',
      blur: 10,
      offsetX: 5,
      offsetY: -3
    })
  })

  it('aplica defaults para campos ausentes', () => {
    expect(snapshotTextShadow({})).toEqual({
      color: 'rgba(0,0,0,0.5)',
      blur: 0,
      offsetX: 0,
      offsetY: 0
    })
  })

  it('coerce string para numero em blur/offsets', () => {
    expect(snapshotTextShadow({
      color: 'red',
      blur: '5',
      offsetX: '10',
      offsetY: '-2'
    })).toEqual({
      color: 'red',
      blur: 5,
      offsetX: 10,
      offsetY: -2
    })
  })

  it('coerce color para string', () => {
    expect(snapshotTextShadow({ color: 123, blur: 0 })).toEqual({
      color: '123',
      blur: 0,
      offsetX: 0,
      offsetY: 0
    })
  })
})

describe('computeLinearGradientCoords', () => {
  const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

  it('retorna 4 numeros finitos', () => {
    const c = computeLinearGradientCoords(100, 50, 90)
    expect(Number.isFinite(c.x1)).toBe(true)
    expect(Number.isFinite(c.y1)).toBe(true)
    expect(Number.isFinite(c.x2)).toBe(true)
    expect(Number.isFinite(c.y2)).toBe(true)
  })

  it('angle 0: gradient horizontal (eixo X varia, Y constante = h/2)', () => {
    const c = computeLinearGradientCoords(100, 60, 0)
    expect(approx(c.y1, 30)).toBe(true)
    expect(approx(c.y2, 30)).toBe(true)
    // x1 = 50 - 1*50 = 0; x2 = 50 + 1*50 = 100 (radius=max(100,60)/2=50)
    expect(approx(c.x1, 0)).toBe(true)
    expect(approx(c.x2, 100)).toBe(true)
  })

  it('angle 90: gradient vertical (eixo Y varia, X constante = w/2)', () => {
    const c = computeLinearGradientCoords(100, 60, 90)
    expect(approx(c.x1, 50)).toBe(true)
    expect(approx(c.x2, 50)).toBe(true)
    // sin(90)=1, radius=50: y1 = 30 - 50 = -20, y2 = 30 + 50 = 80
    expect(approx(c.y1, -20)).toBe(true)
    expect(approx(c.y2, 80)).toBe(true)
  })

  it('angle 180: inverte x1/x2 vs angle 0', () => {
    const c = computeLinearGradientCoords(100, 60, 180)
    expect(approx(c.y1, 30)).toBe(true)
    expect(approx(c.y2, 30)).toBe(true)
    // cos(180)=-1, radius=50: x1 = 50 - (-1)*50 = 100; x2 = 50 + (-1)*50 = 0
    expect(approx(c.x1, 100)).toBe(true)
    expect(approx(c.x2, 0)).toBe(true)
  })

  it('angle default 90 (sem argumento)', () => {
    const a = computeLinearGradientCoords(100, 50)
    const b = computeLinearGradientCoords(100, 50, 90)
    expect(a).toEqual(b)
  })

  it('width/height invalidos viram 1 (defesa)', () => {
    const c1 = computeLinearGradientCoords(0, 0, 90)
    expect(Number.isFinite(c1.x1)).toBe(true)
    expect(Number.isFinite(c1.y1)).toBe(true)
    const c2 = computeLinearGradientCoords(NaN as any, NaN as any, 90)
    expect(Number.isFinite(c2.x1)).toBe(true)
    expect(Number.isFinite(c2.y2)).toBe(true)
    // Com w=h=1, halfW=halfH=0.5, radius=0.5
    expect(approx(c1.x1, 0.5)).toBe(true)
    expect(approx(c1.y1, 0)).toBe(true)
    expect(approx(c1.y2, 1)).toBe(true)
  })

  it('angle NaN/null tratado como 0', () => {
    const c = computeLinearGradientCoords(100, 60, NaN as any)
    // NaN || 0 → 0, mesmo resultado que angle 0
    const ref = computeLinearGradientCoords(100, 60, 0)
    expect(c).toEqual(ref)
  })

  it('radius cobre a maior dimensao (square ou wide)', () => {
    // wide: w=200, h=50, radius = max/2 = 100
    const c = computeLinearGradientCoords(200, 50, 0)
    expect(approx(c.x1, 0)).toBe(true)   // 100 - 100
    expect(approx(c.x2, 200)).toBe(true) // 100 + 100
    expect(approx(c.y1, 25)).toBe(true)
    expect(approx(c.y2, 25)).toBe(true)
  })
})
