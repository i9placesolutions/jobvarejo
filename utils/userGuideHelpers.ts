/**
 * Helpers puros para "guides" (linhas-guia) que o usuario adiciona ao canvas.
 *
 * Guides sao objetos especiais (linha vertical/horizontal) marcados com
 * `isUserGuide: true`, prefixo de id `guide-user-` ou `guideAxis: 'x' | 'y'`.
 *
 * Cobertura: tests/utils/userGuideHelpers.test.ts
 */

/**
 * Detecta se um objeto Fabric e' uma user guide. Aceita tres sinais:
 *  - flag explicita `isUserGuide`
 *  - `guideAxis` valido ('x' ou 'y')
 *  - id com prefixo `guide-user-`
 */
export const isUserGuideObject = (o: any): boolean => {
    const id = String(o?.id || '')
    return !!o && (
        o.isUserGuide === true ||
        o.guideAxis === 'x' ||
        o.guideAxis === 'y' ||
        id.startsWith('guide-user-')
    )
}

/**
 * Extrai o eixo (`'x'` ou `'y'`) e a posicao numerica de uma user guide.
 *
 * Estrategia:
 *  1. Se `guideAxis` esta definido e valido, usa ele.
 *  2. Senao infere pelo formato Fabric.Line: x1==x2 → vertical (eixo 'x'),
 *     senao horizontal (eixo 'y').
 *  3. Posicao vem de x1/y1 (Line) ou left/top (fallback).
 *
 * Retorna null se a posicao nao for finita.
 */
export const getUserGuideAxisAndPos = (o: any): { axis: 'x' | 'y'; pos: number } | null => {
    if (!o) return null
    const axis = (o.guideAxis === 'x' || o.guideAxis === 'y')
        ? o.guideAxis
        : (typeof o.x1 === 'number' && typeof o.x2 === 'number' && Math.abs(o.x1 - o.x2) < 1e-6 ? 'x' : 'y')
    const pos = axis === 'x' ? Number(o.x1 ?? o.left ?? 0) : Number(o.y1 ?? o.top ?? 0)
    if (!Number.isFinite(pos)) return null
    return { axis, pos }
}
