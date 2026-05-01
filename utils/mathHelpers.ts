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
