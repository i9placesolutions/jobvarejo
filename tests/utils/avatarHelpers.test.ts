import { describe, it, expect } from 'vitest'
import { getColorFromString, getInitial } from '~/utils/avatarHelpers'

describe('getColorFromString', () => {
  it('retorna uma classe Tailwind valida', () => {
    expect(getColorFromString('Joao')).toMatch(/^bg-[a-z]+-500$/)
  })

  it('mesma string sempre retorna mesma cor (deterministico)', () => {
    const a = getColorFromString('Maria Silva')
    const b = getColorFromString('Maria Silva')
    expect(a).toBe(b)
  })

  it('strings diferentes podem retornar cores diferentes', () => {
    const a = getColorFromString('aaa')
    const b = getColorFromString('zzz')
    // Nao garantido que sao diferentes, mas geralmente sao
    // Pelo menos verifica que ambas sao validas
    expect(a).toMatch(/^bg-/)
    expect(b).toMatch(/^bg-/)
  })

  it('string vazia retorna a primeira cor (hash=0)', () => {
    expect(getColorFromString('')).toBe('bg-green-500')
  })

  it('aceita unicode/acentos', () => {
    expect(getColorFromString('José')).toMatch(/^bg-/)
  })
})

describe('getInitial', () => {
  it('null/undefined retorna "?"', () => {
    expect(getInitial(null)).toBe('?')
    expect(getInitial(undefined)).toBe('?')
    expect(getInitial('')).toBe('?')
  })

  it('1 palavra: retorna primeira letra maiuscula', () => {
    expect(getInitial('joao')).toBe('J')
    expect(getInitial('Maria')).toBe('M')
  })

  it('2+ palavras: combina primeira e ultima', () => {
    expect(getInitial('joao silva')).toBe('JS')
    expect(getInitial('Maria Helena Santos')).toBe('MS')
  })

  it('whitespace e tratado: 2+ palavras usa trim, 1 palavra cai no name[0] sem trim', () => {
    // 2+ palavras: parts vem de trim().split(), entao funciona
    expect(getInitial('  Joao Silva  ')).toBe('JS')
    // 1 palavra: cai no fallback name[0] (sem trim no original)
    // documentado para evitar regressao acidental
    expect(getInitial('  Joao  ')).toBe(' ')
  })

  it('nome com apenas espacos: name[0] e space', () => {
    expect(getInitial('   ')).toBe(' ')
  })

  it('caracteres unicode/acentos', () => {
    expect(getInitial('Ágatha')).toBe('Á')
    expect(getInitial('José Maria')).toBe('JM')
  })
})
