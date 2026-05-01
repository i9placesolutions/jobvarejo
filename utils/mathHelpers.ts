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

/**
 * Formata um numero para display "limpo": NaN/Infinity → '0',
 * inteiros (ou quase-inteiros, abs(n - round(n)) < 0.01) sem casas
 * decimais, demais com 2 casas. Util para badges de dimensao em
 * labels (`123` em vez de `123.00`, mas `123.45`).
 */
export const formatDisplayNumber = (n: number): string => {
    if (!Number.isFinite(n)) return '0'
    const rounded = Math.round(n)
    if (Math.abs(n - rounded) < 0.01) return String(rounded)
    return n.toFixed(2)
}

/**
 * Constraint 1D: dado o centro atual do objeto (cardCenter), seu
 * tamanho (cardSize) e o range do container [containerStart,
 * containerStart+containerSize], retorna o centro constrained:
 *
 *  - cardSize >= containerSize: centra no container (objeto maior
 *    que o range, fica centralizado)
 *  - card excede pela esquerda/cima: encosta na borda
 *  - card excede pela direita/baixo: encosta na borda
 *  - dentro: retorna o cardCenter inalterado
 *
 * Pure: aritmetica simples, sem efeito colateral.
 */
export const constrainCenterAxisInsideContainer = (
    cardCenter: number,
    cardSize: number,
    containerStart: number,
    containerSize: number
): number => {
    const cardEdgeStart = cardCenter - cardSize / 2
    const cardEdgeEnd = cardCenter + cardSize / 2
    const containerEnd = containerStart + containerSize

    if (cardSize >= containerSize) {
        return containerStart + (containerSize / 2)
    }
    if (cardEdgeStart < containerStart) {
        return containerStart + cardSize / 2
    }
    if (cardEdgeEnd > containerEnd) {
        return containerEnd - cardSize / 2
    }
    return cardCenter
}
