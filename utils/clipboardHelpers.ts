/**
 * Helpers puros para clipboard do editor.
 *
 * Sao normalizadores leves — sem dependencia de canvas, refs reativos
 * ou DOM real.
 *
 * Cobertura: tests/utils/clipboardHelpers.test.ts
 */

/**
 * Normaliza um ponto de clipboard para `{ x, y }` numericos finitos.
 * Defaults para 0 quando algum campo nao for parseavel.
 *
 * Util para garantir que paste-coordinates vindas de window.event ou
 * touch events nunca contenham NaN/Infinity ou undefined.
 */
export const normalizeClipboardPoint = (point: any): { x: number; y: number } => {
    const x = Number(point?.x)
    const y = Number(point?.y)
    return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0
    }
}
