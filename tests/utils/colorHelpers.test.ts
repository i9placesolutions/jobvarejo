import { describe, it, expect } from 'vitest'
import {
  normalizeHexColor,
  parseTemplateColorRgba,
  isTransparentLikeTemplateColor
} from '~/utils/colorHelpers'

describe('normalizeHexColor', () => {
  it('hex 6 digitos: lowercase', () => {
    expect(normalizeHexColor('#FFAA00', '#000')).toBe('#ffaa00')
    expect(normalizeHexColor('#abc123', '#000')).toBe('#abc123')
  })

  it('hex 3 digitos: expande para 6', () => {
    expect(normalizeHexColor('#abc', '#000')).toBe('#aabbcc')
    expect(normalizeHexColor('#FFF', '#000')).toBe('#ffffff')
    expect(normalizeHexColor('#000', '#fff')).toBe('#000000')
  })

  it('sem # prefix: aceita e adiciona', () => {
    expect(normalizeHexColor('abc', '#000')).toBe('#aabbcc')
    expect(normalizeHexColor('FFAA00', '#000')).toBe('#ffaa00')
  })

  it('null/undefined/empty: fallback', () => {
    expect(normalizeHexColor(null, '#fff')).toBe('#fff')
    expect(normalizeHexColor(undefined, '#fff')).toBe('#fff')
    expect(normalizeHexColor('', '#fff')).toBe('#fff')
    expect(normalizeHexColor('   ', '#fff')).toBe('#fff')
  })

  it('null/undefined/empty + allowUndefined: undefined', () => {
    expect(normalizeHexColor(null, '#fff', { allowUndefined: true })).toBeUndefined()
    expect(normalizeHexColor('', '#fff', { allowUndefined: true })).toBeUndefined()
  })

  it('valores invalidos (RGB, names, alpha): fallback', () => {
    expect(normalizeHexColor('rgb(255,0,0)', '#000')).toBe('#000')
    expect(normalizeHexColor('red', '#000')).toBe('#000')
    expect(normalizeHexColor('#abcd', '#000')).toBe('#000') // 4 digitos com alpha
    expect(normalizeHexColor('#aabbccdd', '#000')).toBe('#000') // 8 digitos
    expect(normalizeHexColor('xyz', '#000')).toBe('#000')
  })

  it('"transparent" + allowTransparent: retorna "transparent"', () => {
    expect(normalizeHexColor('transparent', '#000', { allowTransparent: true })).toBe('transparent')
    expect(normalizeHexColor('TRANSPARENT', '#000', { allowTransparent: true })).toBe('transparent')
  })

  it('"transparent" sem allowTransparent: fallback', () => {
    expect(normalizeHexColor('transparent', '#fff')).toBe('#fff')
  })

  it('whitespace ao redor: trim aplicado', () => {
    expect(normalizeHexColor('  #abc  ', '#000')).toBe('#aabbcc')
    expect(normalizeHexColor('  abc  ', '#000')).toBe('#aabbcc')
  })

  it('mix-case 3 digit: expande lowercase', () => {
    expect(normalizeHexColor('#aBc', '#000')).toBe('#aabbcc')
  })

  it('numero "123" tratado como hex 3-digit valido (1,2,3)', () => {
    // String("123") tem 3 chars hex validos, vira #112233
    expect(normalizeHexColor(123, '#000')).toBe('#112233')
  })

  it('numero (12345 stringificado): 5 digitos invalido → fallback', () => {
    expect(normalizeHexColor(12345, '#000')).toBe('#000')
  })

  it('valor vazio com allowTransparent + allowUndefined: undefined precede transparent', () => {
    expect(normalizeHexColor('', '#000', {
      allowTransparent: true,
      allowUndefined: true
    })).toBeUndefined()
  })
})

describe('parseTemplateColorRgba', () => {
  it('hex 6 digitos: parsing correto', () => {
    expect(parseTemplateColorRgba('#ff8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
    expect(parseTemplateColorRgba('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  it('hex 8 digitos: alpha extraido', () => {
    expect(parseTemplateColorRgba('#ff880080')).toEqual({
      r: 255, g: 136, b: 0, a: 128 / 255
    })
  })

  it('hex 3 digitos: expandido + alpha 1', () => {
    expect(parseTemplateColorRgba('#abc')).toEqual({
      r: 0xaa, g: 0xbb, b: 0xcc, a: 1
    })
  })

  it('hex 4 digitos: expandido com alpha', () => {
    expect(parseTemplateColorRgba('#abcd')).toEqual({
      r: 0xaa, g: 0xbb, b: 0xcc, a: 0xdd / 255
    })
  })

  it('rgb(...) → alpha=1', () => {
    expect(parseTemplateColorRgba('rgb(255, 100, 50)')).toEqual({
      r: 255, g: 100, b: 50, a: 1
    })
  })

  it('rgba(...) → alpha do 4o componente', () => {
    expect(parseTemplateColorRgba('rgba(0, 0, 0, 0.5)')).toEqual({
      r: 0, g: 0, b: 0, a: 0.5
    })
  })

  it('case-insensitive em RGBA/RGB', () => {
    expect(parseTemplateColorRgba('RGBA(10, 20, 30, 0.7)')?.a).toBe(0.7)
    expect(parseTemplateColorRgba('Rgb(10, 20, 30)')?.r).toBe(10)
  })

  it('clampa RGB > 255 e alpha > 1', () => {
    expect(parseTemplateColorRgba('rgba(999, 1000, 1001, 99)')).toEqual({
      r: 255, g: 255, b: 255, a: 1
    })
  })

  it('clampa valores negativos em 0', () => {
    expect(parseTemplateColorRgba('rgba(-50, -10, -1, -1)')).toEqual({
      r: 0, g: 0, b: 0, a: 0
    })
  })

  it('non-string → null', () => {
    expect(parseTemplateColorRgba(null)).toBeNull()
    expect(parseTemplateColorRgba(undefined)).toBeNull()
    expect(parseTemplateColorRgba(123)).toBeNull()
    expect(parseTemplateColorRgba({})).toBeNull()
  })

  it('hex de tamanho invalido → null', () => {
    expect(parseTemplateColorRgba('#abcde')).toBeNull()
    expect(parseTemplateColorRgba('#aabbcc77ee')).toBeNull()
  })

  it('rgba malformado → null', () => {
    expect(parseTemplateColorRgba('rgba(255, 100)')).toBeNull()  // < 3 partes
    expect(parseTemplateColorRgba('foo(255, 100, 0)')).toBeNull()
  })

  it('rgba com NaN → null', () => {
    expect(parseTemplateColorRgba('rgba(abc, def, ghi)')).toBeNull()
  })

  it('whitespace ao redor: trim', () => {
    expect(parseTemplateColorRgba('  #ff0000  ')?.r).toBe(255)
  })
})

describe('isTransparentLikeTemplateColor', () => {
  it('null/undefined → true', () => {
    expect(isTransparentLikeTemplateColor(null)).toBe(true)
    expect(isTransparentLikeTemplateColor(undefined)).toBe(true)
  })

  it('non-string → false', () => {
    expect(isTransparentLikeTemplateColor(123)).toBe(false)
    expect(isTransparentLikeTemplateColor({})).toBe(false)
  })

  it('alpha <= 0.12 → true', () => {
    expect(isTransparentLikeTemplateColor('rgba(0, 0, 0, 0)')).toBe(true)
    expect(isTransparentLikeTemplateColor('rgba(255, 0, 0, 0.1)')).toBe(true)
    expect(isTransparentLikeTemplateColor('rgba(255, 0, 0, 0.12)')).toBe(true)
  })

  it('alpha > 0.12 → false', () => {
    expect(isTransparentLikeTemplateColor('rgba(0, 0, 0, 0.13)')).toBe(false)
    expect(isTransparentLikeTemplateColor('rgba(0, 0, 0, 0.5)')).toBe(false)
    expect(isTransparentLikeTemplateColor('#ff0000')).toBe(false)  // alpha=1
  })

  it('hex sem alpha (alpha=1) → false', () => {
    expect(isTransparentLikeTemplateColor('#abc')).toBe(false)
    expect(isTransparentLikeTemplateColor('#aabbcc')).toBe(false)
  })

  it('cor invalida → false (parseTemplateColorRgba retorna null)', () => {
    expect(isTransparentLikeTemplateColor('not-a-color')).toBe(false)
  })
})
