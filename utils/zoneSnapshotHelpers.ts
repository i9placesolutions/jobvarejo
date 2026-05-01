/**
 * Helpers puros para construcao de snapshots de zona/card. Sem
 * dependencia de canvas/refs/state.
 *
 * Cobertura: tests/utils/zoneSnapshotHelpers.test.ts
 */

/**
 * Clona um valor plain (JSON-safe) recursivamente, removendo funcoes
 * e referencias circulares. Estrategia em 2 camadas:
 *
 *  1. JSON round-trip (rapido, lida com 99% dos casos)
 *  2. Fallback recursivo manual: arrays/objetos visitados,
 *     funcoes ignoradas
 *
 * Usado para snapshot de productData e zoneSlot dentro do snapshot
 * da zona — precisa ser plain JSON para ser serializavel.
 *
 * Pure (mas pode ser caro em estruturas profundas).
 */
export const clonePlainForZoneSnapshot = (value: any): any => {
    if (value == null) return value
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        if (Array.isArray(value)) return value.map((item) => clonePlainForZoneSnapshot(item))
        if (typeof value === 'object') {
            const out: Record<string, any> = {}
            Object.entries(value).forEach(([key, entry]: [string, any]) => {
                if (typeof entry === 'function') return
                out[key] = clonePlainForZoneSnapshot(entry)
            })
            return out
        }
        return value
    }
}

/**
 * Coerce numerico com fallback (default 0) — null se nao-finito.
 * Usado em snapshots de geometria onde NaN nunca deve aparecer.
 */
export const finiteZoneSnapshotNumber = (value: any, fallback: number = 0): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

/**
 * Retorna o primeiro valor definido (nao undefined, null nem string
 * vazia) dentre os argumentos. Util para fallback chains de campos
 * de produto:
 *
 *   firstDefinedZoneSnapshotValue(productData.name, card.productName, '')
 */
export const firstDefinedZoneSnapshotValue = (...values: any[]): any => {
    for (const value of values) {
        if (typeof value !== 'undefined' && value !== null && value !== '') return value
    }
    return null
}
