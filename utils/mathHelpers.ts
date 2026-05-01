/**
 * Helpers matematicos puros usados em multiplas partes do editor.
 * Sem dependencia de canvas/refs/state.
 *
 * Cobertura: tests/utils/mathHelpers.test.ts
 */

/**
 * Limita um numero ao intervalo [min, max]. Comportamento padrao:
 * Math.min(max, Math.max(min, n)). Quando min > max, retorna max
 * (consistente com Math.min/max nesse caso degenerado).
 *
 * Substitui as 15+ definicoes inline de `clamp` no EditorCanvas.
 */
export const clamp = (n: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, n))

/**
 * Coerce um valor desconhecido para um numero finito, com fallback se
 * NaN/Infinity. Aceita clamp opcional via parametros min/max.
 *
 * Uso tipico: parsing de strings/dados externos onde NaN deve cair
 * num default seguro.
 *
 *   toFinite("10", 0) === 10
 *   toFinite("abc", 0) === 0
 *   toFinite(150, 0, 0, 100) === 100
 */
export const toFinite = (
    value: any,
    fallback: number,
    min?: number,
    max?: number
): number => {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    if (typeof min === 'number' && n < min) return min
    if (typeof max === 'number' && n > max) return max
    return n
}
