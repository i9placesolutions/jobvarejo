/**
 * Helper puro para normalizar o payload de updateZone — aceita
 * 3 formas de input:
 *
 *   1. (prop: string, value: any) — forma simples
 *   2. (payload: { prop: string, value: any }) — wrapper objeto
 *   3. (payload: Record<string, any>) — multiplas props de uma vez
 *
 * Retorna sempre um Record<string, any> uniforme para o caller
 * iterar entries.
 *
 * Cobertura: tests/utils/zoneUpdatesPayload.test.ts
 */

export const resolveZoneUpdatesPayload = (
    propOrPayload: any,
    val: any
): Record<string, any> => {
    if (typeof propOrPayload === 'string' && propOrPayload.trim()) {
        return { [propOrPayload]: val }
    }
    if (propOrPayload && typeof propOrPayload === 'object' && !Array.isArray(propOrPayload)) {
        const payload = propOrPayload as Record<string, any>
        if (typeof payload.prop === 'string' && payload.prop.trim()) {
            return { [payload.prop]: payload.value }
        }
        return { ...payload }
    }
    return {}
}

/**
 * Variante de resolveZoneUpdatesPayload que retorna `{ prop, value }`
 * (forma escalar) em vez de um Record. Usado por
 * handleUpdateGlobalStyles que processa uma prop por vez. Aceita as
 * mesmas 3 formas de input mas:
 *
 *   - {a: 1, b: 2}: aceita APENAS quando ha 1 chave (escalar);
 *     multiplas chaves retorna null (caller decide como tratar).
 *
 * Retorna null em casos invalidos (string vazia, null, array,
 * payload com prop vazio + multiplas chaves).
 */
export const resolveScalarUpdatePayload = (
    propOrPayload: any,
    val: any
): { prop: string; value: any } | null => {
    if (typeof propOrPayload === 'string' && propOrPayload.trim()) {
        return { prop: propOrPayload, value: val }
    }
    if (propOrPayload && typeof propOrPayload === 'object' && !Array.isArray(propOrPayload)) {
        const payload = propOrPayload as Record<string, any>
        if (typeof payload.prop === 'string' && payload.prop.trim()) {
            return { prop: payload.prop, value: payload.value }
        }
        const keys = Object.keys(payload)
        if (keys.length === 1 && keys[0]) {
            return { prop: keys[0], value: payload[keys[0]] }
        }
    }
    return null
}
