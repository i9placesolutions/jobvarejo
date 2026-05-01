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
