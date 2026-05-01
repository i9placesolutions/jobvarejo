import { describe, it, expect } from 'vitest'
import {
  clamp,
  toFinite,
  formatDisplayNumber,
  constrainCenterAxisInsideContainer,
  normalizeVisibleScale
} from '~/utils/mathHelpers'

describe('clamp', () => {
  it('valor dentro do intervalo: retorna o valor', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('valor abaixo do min: retorna min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(-100, -50, 50)).toBe(-50)
  })

  it('valor acima do max: retorna max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(100, 0, 50)).toBe(50)
  })

  it('intervalo negativo', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-15, -10, -1)).toBe(-10)
    expect(clamp(0, -10, -1)).toBe(-1)
  })

  it('decimais preservados', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5)
    expect(clamp(1.5, 0, 1)).toBe(1)
    expect(clamp(0.0001, 0.001, 0.01)).toBe(0.001)
  })

  it('NaN: NaN', () => {
    expect(clamp(NaN, 0, 10)).toBeNaN()
  })

  it('Infinity clampado', () => {
    expect(clamp(Infinity, 0, 10)).toBe(10)
    expect(clamp(-Infinity, 0, 10)).toBe(0)
  })

  it('min > max degenerate: comportamento determinado por Math.min/max', () => {
    // Max(min, n) sempre retorna min ou n; Min(max, ...) trava em max.
    // Quando min > max, Math.max(min, n) = max(min, n) e Math.min(max, ...) = max.
    // Resultado: sempre max quando min > max e n <= min.
    expect(clamp(5, 10, 0)).toBe(0)
  })
})

describe('toFinite', () => {
  it('numero finito → retorna o numero', () => {
    expect(toFinite(5, 0)).toBe(5)
    expect(toFinite(-3.14, 0)).toBe(-3.14)
    expect(toFinite(0, 99)).toBe(0)
  })

  it('string parseavel → retorna numero', () => {
    expect(toFinite('42', 0)).toBe(42)
    expect(toFinite('-1.5', 0)).toBe(-1.5)
  })

  it('NaN → fallback', () => {
    expect(toFinite(NaN, 99)).toBe(99)
    expect(toFinite('abc', 7)).toBe(7)
  })

  it('Infinity → fallback', () => {
    expect(toFinite(Infinity, 0)).toBe(0)
    expect(toFinite(-Infinity, -1)).toBe(-1)
  })

  it('null → fallback (Number(null)=0 e finito, retorna 0)', () => {
    expect(toFinite(null, 99)).toBe(0)
  })

  it('undefined → fallback (Number(undefined)=NaN)', () => {
    expect(toFinite(undefined, 99)).toBe(99)
  })

  it('clamp em [min, max] aplicado', () => {
    expect(toFinite(150, 0, 0, 100)).toBe(100)
    expect(toFinite(-10, 0, 0, 100)).toBe(0)
    expect(toFinite(50, 0, 0, 100)).toBe(50)
  })

  it('clamp apenas min', () => {
    expect(toFinite(-5, 0, 0)).toBe(0)
    expect(toFinite(5, 0, 0)).toBe(5)
  })

  it('clamp apenas max', () => {
    expect(toFinite(150, 0, undefined, 100)).toBe(100)
    expect(toFinite(50, 0, undefined, 100)).toBe(50)
  })

  it('NaN ainda cai em fallback (nao cap por min/max)', () => {
    expect(toFinite(NaN, 7, 0, 100)).toBe(7)
  })
})

describe('formatDisplayNumber', () => {
  it('inteiros sem casas decimais', () => {
    expect(formatDisplayNumber(0)).toBe('0')
    expect(formatDisplayNumber(123)).toBe('123')
    expect(formatDisplayNumber(-50)).toBe('-50')
  })

  it('quase-inteiros (diff < 0.01) viram int', () => {
    expect(formatDisplayNumber(123.005)).toBe('123')
    expect(formatDisplayNumber(99.999)).toBe('100')
  })

  it('decimais com diff >= 0.01: 2 casas', () => {
    expect(formatDisplayNumber(123.45)).toBe('123.45')
    expect(formatDisplayNumber(123.456)).toBe('123.46') // round
    expect(formatDisplayNumber(0.5)).toBe('0.50')
  })

  it('NaN/Infinity → "0"', () => {
    expect(formatDisplayNumber(NaN)).toBe('0')
    expect(formatDisplayNumber(Infinity)).toBe('0')
    expect(formatDisplayNumber(-Infinity)).toBe('0')
  })

  it('zero exato: "0"', () => {
    expect(formatDisplayNumber(0)).toBe('0')
  })

  it('negativos com decimais', () => {
    expect(formatDisplayNumber(-3.14)).toBe('-3.14')
    expect(formatDisplayNumber(-3.001)).toBe('-3')
  })
})

describe('constrainCenterAxisInsideContainer', () => {
  it('card dentro do container: nao muda centro', () => {
    // container [0, 100], card 20px com center=50 → permanece
    expect(constrainCenterAxisInsideContainer(50, 20, 0, 100)).toBe(50)
  })

  it('card excede pela esquerda: encosta na borda esquerda', () => {
    // card 20px com center=5 → cardLeft=-5 (fora) → encosta com center=10
    expect(constrainCenterAxisInsideContainer(5, 20, 0, 100)).toBe(10)
  })

  it('card excede pela direita: encosta na borda direita', () => {
    // card 20px com center=95 → cardRight=105 (fora) → encosta com center=90
    expect(constrainCenterAxisInsideContainer(95, 20, 0, 100)).toBe(90)
  })

  it('card MAIOR que container: centra no container', () => {
    // card 200px com center qualquer → vai pra centro do container
    expect(constrainCenterAxisInsideContainer(0, 200, 50, 100)).toBe(100) // 50 + 100/2
    expect(constrainCenterAxisInsideContainer(999, 200, 50, 100)).toBe(100)
  })

  it('card == container: centra (>=, nao >)', () => {
    expect(constrainCenterAxisInsideContainer(0, 100, 0, 100)).toBe(50)
  })

  it('container deslocado (start != 0): respeita start', () => {
    // container [100, 200], card 20px com center=110 → cardLeft=100 (ok) → permanece 110
    expect(constrainCenterAxisInsideContainer(110, 20, 100, 100)).toBe(110)
    // card center=105 → cardLeft=95 (< 100) → encosta com center = 100 + 10 = 110
    expect(constrainCenterAxisInsideContainer(105, 20, 100, 100)).toBe(110)
  })

  it('container negativo (mundo Fabric com left negativo)', () => {
    // container [-50, 50], card 10px com center=-100 → encosta com center=-45
    expect(constrainCenterAxisInsideContainer(-100, 10, -50, 100)).toBe(-45)
  })

  it('cardSize 0: degenera mas nao crasha', () => {
    expect(constrainCenterAxisInsideContainer(50, 0, 0, 100)).toBe(50)
  })
})

describe('normalizeVisibleScale', () => {
  it('escala valida no range: passa', () => {
    expect(normalizeVisibleScale(1, 1)).toBe(1)
    expect(normalizeVisibleScale(2, 1)).toBe(2)
    expect(normalizeVisibleScale(0.5, 1)).toBe(0.5)
  })

  it('clampa em [0.08, 3.2] (defaults)', () => {
    expect(normalizeVisibleScale(99, 1)).toBe(3.2)
    expect(normalizeVisibleScale(0.001, 1)).toBe(0.08)
  })

  it('preserva sinal negativo (flip)', () => {
    expect(normalizeVisibleScale(-2, 1)).toBe(-2)
    expect(normalizeVisibleScale(-99, 1)).toBe(-3.2)
    expect(normalizeVisibleScale(-0.001, 1)).toBe(-0.08)
  })

  it('zero → fallback', () => {
    expect(normalizeVisibleScale(0, 1.5)).toBe(1.5)
    expect(normalizeVisibleScale(0, -0.5)).toBe(-0.5)
  })

  it('NaN/Infinity → fallback', () => {
    expect(normalizeVisibleScale(NaN, 1.5)).toBe(1.5)
    expect(normalizeVisibleScale(Infinity, 1.5)).toBe(1.5)
    expect(normalizeVisibleScale('abc', 1.5)).toBe(1.5)
  })

  it('fallback invalido → 1', () => {
    expect(normalizeVisibleScale(0, NaN)).toBe(1)
    expect(normalizeVisibleScale(0, 0)).toBe(1)
    expect(normalizeVisibleScale(0, undefined)).toBe(1)
  })

  it('min/max customizados', () => {
    expect(normalizeVisibleScale(99, 1, 0.5, 2)).toBe(2)
    expect(normalizeVisibleScale(0.001, 1, 0.5, 2)).toBe(0.5)
  })

  it('strings parseaveis: viram numero', () => {
    expect(normalizeVisibleScale('1.5', 1)).toBe(1.5)
  })

  it('null fallback usa 1 como safe default', () => {
    expect(normalizeVisibleScale(0, null as any)).toBe(1)
  })
})
