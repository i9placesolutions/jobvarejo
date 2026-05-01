/**
 * Constantes do cache de colaboradores (usuarios com acesso ao projeto).
 *
 * Cobertura: tests/utils/collaboratorsCache.test.ts
 */

/**
 * Tempo de validade (ms) do cache de colaboradores carregados do
 * backend. Apos esse periodo, `loadCollaborators` revalida com a
 * API mesmo que ja tenha lista em memoria.
 *
 * 15s = balanco entre frescor (novos colaboradores aparecem rapido)
 * e custo de fetch (lista raramente muda durante uma sessao de edicao).
 */
export const COLLABORATORS_CACHE_MS = 15_000

/**
 * Decide se o cache de colaboradores ainda e' valido. Considera:
 *  - tem itens no cache atual (length > 0)
 *  - userId nao mudou desde a ultima carga
 *  - tempo decorrido < COLLABORATORS_CACHE_MS
 *
 * `force=true` invalida o cache imediatamente.
 */
export const isCollaboratorsCacheValid = (input: {
    force: boolean
    cacheLength: number
    cachedUserId: string | null
    currentUserId: string | null
    loadedAt: number
    now?: number
}): boolean => {
    if (input.force) return false
    if (input.cacheLength <= 0) return false
    if (input.cachedUserId !== input.currentUserId) return false
    const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now()
    return (now - input.loadedAt) < COLLABORATORS_CACHE_MS
}
