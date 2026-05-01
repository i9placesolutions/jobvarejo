import { describe, it, expect } from 'vitest'
import {
  stripAccents,
  normalizeLimitText,
  normalizeSpecialCondition
} from '~/utils/productTextNormalize'

describe('stripAccents', () => {
  it('remove acentos preservando o restante', () => {
    expect(stripAccents('Café')).toBe('Cafe')
    expect(stripAccents('Açúcar')).toBe('Acucar')
    expect(stripAccents('Atenção: pão')).toBe('Atencao: pao')
  })

  it('preserva strings ja sem acentos', () => {
    expect(stripAccents('hello world')).toBe('hello world')
    expect(stripAccents('123 abc')).toBe('123 abc')
  })

  it('vazio retorna vazio', () => {
    expect(stripAccents('')).toBe('')
  })
})

describe('normalizeLimitText', () => {
  it('vazio/null retorna null', () => {
    expect(normalizeLimitText('')).toBeNull()
    expect(normalizeLimitText(null)).toBeNull()
    expect(normalizeLimitText(undefined)).toBeNull()
    expect(normalizeLimitText('   ')).toBeNull()
  })

  it('"LIMITE" sozinho (sem quantidade) retorna null', () => {
    expect(normalizeLimitText('LIMITE')).toBeNull()
    expect(normalizeLimitText('limite')).toBeNull()
  })

  it('numero sem prefixo: adiciona LIMITE', () => {
    expect(normalizeLimitText('3')).toBe('LIMITE 3')
    expect(normalizeLimitText('5UN')).toBe('LIMITE 5 UN')
  })

  it('com prefixo "limite": preserva e formata', () => {
    expect(normalizeLimitText('limite 3UN')).toBe('LIMITE 3 UN')
    expect(normalizeLimitText('limite 2 KG')).toBe('LIMITE 2 KG')
  })

  it('separa digito de UN/KG', () => {
    expect(normalizeLimitText('3UN')).toBe('LIMITE 3 UN')
    expect(normalizeLimitText('LIMITE 10KG')).toBe('LIMITE 10 KG')
  })

  it('colapsa whitespace multiplo', () => {
    expect(normalizeLimitText('LIMITE    3   UN')).toBe('LIMITE 3 UN')
  })
})

describe('normalizeSpecialCondition', () => {
  it('vazio/null retorna null', () => {
    expect(normalizeSpecialCondition(null)).toBeNull()
    expect(normalizeSpecialCondition('')).toBeNull()
    expect(normalizeSpecialCondition('   ')).toBeNull()
  })

  it('colapsa whitespace', () => {
    expect(normalizeSpecialCondition('texto    com   espacos')).toBe('texto com espacos')
  })

  it('remove pontuacao/whitespace das pontas', () => {
    expect(normalizeSpecialCondition('- texto -')).toBe('texto')
    expect(normalizeSpecialCondition(': texto :')).toBe('texto')
    expect(normalizeSpecialCondition(',,,texto,,,')).toBe('texto')
    expect(normalizeSpecialCondition('  ;-;texto;-;  ')).toBe('texto')
  })

  it('strip de pontuacao tornando vazio retorna null', () => {
    expect(normalizeSpecialCondition('---')).toBeNull()
    expect(normalizeSpecialCondition(',.;:- ')).toBeNull()
  })

  it('preserva pontuacao no meio', () => {
    expect(normalizeSpecialCondition('na compra de 3, leve 4'))
      .toBe('na compra de 3, leve 4')
  })
})
