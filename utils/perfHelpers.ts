/**
 * Helpers puros de medicao de performance — wrappers defensivos sobre
 * APIs de tempo, sem dependencia de canvas/Fabric/Vue.
 *
 * Cobertura: tests/utils/perfHelpers.test.ts
 */

/**
 * Retorna timestamp de alta resolucao em milissegundos. Prefere
 * `performance.now()` (subms-precision), cai para `Date.now()` quando
 * Performance API nao disponivel (SSR, ambientes restritos).
 */
export const getEditorPerfNow = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()

/**
 * Parse defensivo da preference de "perf metrics enabled" armazenada
 * em localStorage. Convencao:
 *  - null (chave nao existe): default true (enabled)
 *  - '0': false (disabled)
 *  - qualquer outro valor: true
 *
 * Pure: recebe o raw string ja lido pelo caller.
 */
export const parseEditorPerfPreference = (raw: string | null | undefined): boolean => {
    if (raw === null || raw === undefined) return true
    return raw !== '0'
}

/**
 * Serializa preference para storage. true → '1', false → '0'.
 */
export const serializeEditorPerfPreference = (enabled: boolean): string =>
    enabled ? '1' : '0'

/**
 * Arredonda valor numerico para 2 casas decimais defensivamente:
 *  - Number/finite: toFixed(2) → number
 *  - NaN/Infinity/null/undefined: 0
 *
 * Usado para formatar metricas de perf (FPS, latencia, etc) em UI
 * onde precisao alem de 2 casas e' ruido.
 */
export const roundEditorPerf = (value: number): number =>
    Number(Number.isFinite(value) ? value.toFixed(2) : '0')
