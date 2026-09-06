/**
 * Helpers puros para destaque (highlight) de cards em zonas de produto.
 * Sem dependencia de canvas/refs.
 *
 * Cobertura: tests/utils/zoneHighlightHelpers.test.ts
 */

/**
 * Hash FNV-1a 32-bit estavel para uma string. Usado para gerar
 * pseudo-aleatorio determinístico (mesma string sempre devolve o
 * mesmo hash, util para "selecao aleatoria mas estavel" entre
 * relayouts).
 *
 * Pure: sem efeito colateral.
 */
export const stableHash32 = (s: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/**
 * Resultado de getZoneHighlightPredicate: contem o numero de cards a
 * destacar (count), o multiplicador de altura (mult), e um predicate
 * `isHighlighted(card, index) → boolean` para o caller usar no layout.
 */
export type ZoneHighlightPredicate = {
    count: number
    mult: number
    isHighlighted: (card: any, index: number) => boolean
}

/**
 * Constroi um predicate de highlight para os cards de uma zona.
 *
 * Le da zone:
 *  - `highlightCount`: quantos cards destacar (clampado em [0, count])
 *  - `highlightHeight`: multiplicador de altura (clampado em [1, 4])
 *  - `highlightPos`: posicao da area — 'first'/'top' (default),
 *    'last'/'bottom', 'center'
 *  - `highlightSelection`: quais cards entram — 'first', 'last', 'center', 'random' ou 'manual'
 *  - `highlightIndexes`: posicoes 1-based da lista quando a selecao e 'manual'
 *
 * Modo 'random': usa stableHash32(`${zoneId}:${cardId}`) para gerar
 * uma ordem deterministica — relayouts nao reembaralham os destaques.
 *
 * Quando want=0 ou mult<=1, retorna predicate trivial sempre-false.
 */
export const getZoneHighlightPredicate = (zone: any, cards: any[]): ZoneHighlightPredicate => {
    const count = Array.isArray(cards) ? cards.length : 0
    const rawCount = Number((zone as any)?.highlightCount ?? 0)
    const want = Math.max(0, Math.min(count, Math.round(Number.isFinite(rawCount) ? rawCount : 0)))
    const rawMult = Number((zone as any)?.highlightHeight ?? 1)
    const mult = Math.max(1, Math.min(4, Number.isFinite(rawMult) ? rawMult : 1))
    const pos = String((zone as any)?.highlightPos ?? 'first').toLowerCase()
    const selection = String(
        (zone as any)?.highlightSelection ?? (pos === 'bottom' ? 'last' : pos)
    ).toLowerCase()

    if (!want || mult <= 1) {
    return { count: 0, mult: 1, isHighlighted: (_card: any, _index: number) => false }
    }

    if (selection === 'manual') {
        const indexes: number[] = Array.isArray((zone as any)?.highlightIndexes)
            ? ((zone as any).highlightIndexes as unknown[])
                .map((value: unknown) => Number(value))
                .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= count)
            : []
        const picked = Array.from(new Set(indexes)).slice(0, want)
        const pickedSet = new Set<number>(picked)
        return {
            count: picked.length,
            mult,
            isHighlighted: (_card: any, index: number) => pickedSet.has(index + 1)
        }
    }

    if (selection === 'random') {
        const zoneId = String((zone as any)?._customId ?? 'zone')
        const scored = cards.map((c: any, idx: number) => {
            const id = String(c?._customId ?? c?.id ?? idx)
            return { id, score: stableHash32(`${zoneId}:${id}`) }
        })
        scored.sort((a, b) => a.score - b.score)
        const picked = scored.slice(0, want)
        const idSet = new Set<string>(picked.map(p => p.id))
        return {
            count: want,
            mult,
            isHighlighted: (card: any, index: number) =>
                idSet.has(String(card?._customId ?? card?.id ?? index))
        }
    }

    if (selection === 'center') {
        const start = Math.max(0, Math.floor((count - want) / 2))
        const end = Math.min(count, start + want)
        return {
            count: want,
            mult,
            isHighlighted: (_card: any, index: number) => index >= start && index < end
        }
    }

    if (selection === 'last') {
        return {
            count: want,
            mult,
            isHighlighted: (_card: any, index: number) => index >= (count - want)
        }
    }

    return {
        count: want,
        mult,
        isHighlighted: (_card: any, index: number) => index < want
    }
}
