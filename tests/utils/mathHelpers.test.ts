import { describe, it, expect } from 'vitest'
import { clamp } from '~/utils/mathHelpers'

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
