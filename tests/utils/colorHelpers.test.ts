import { describe, it, expect } from 'vitest'
import { normalizeHexColor } from '~/utils/colorHelpers'

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
