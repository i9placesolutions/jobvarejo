/**
 * Tipos e helpers puros para o pipeline de recovery de imagens de
 * produto (quando uma imagem do card esta quebrada/expirada). Este
 * modulo cobre:
 *  - tipos canonicos (RecoveryLookupResult, viewport rect, priority,
 *    candidate)
 *  - constantes de batch size
 *  - comparator de candidatos
 *  - calculo do limite de batch
 *
 * Sem dependencia de canvas/refs/state.
 *
 * Cobertura: tests/utils/missingProductImageRecovery.test.ts
 */

export type RecoveryLookupResult = {
    status: 'ok' | 'empty' | 'auth' | 'error'
    url: string | null
}

export type MissingProductImageRecoveryViewportRect = {
    left: number
    top: number
    right: number
    bottom: number
    centerX: number
    centerY: number
}

export type MissingProductImageRecoveryPriority = {
    selected: boolean
    inView: boolean
    coverage: number
    distanceSq: number
    culled: boolean
}

export type MissingProductImageRecoveryCandidate = {
    card: any
    imageObj: any
    hasImageObject: boolean
    triedMap: Record<string, true>
    normalizedCandidates: string[]
    needsRemoteLookup: boolean
    priority: MissingProductImageRecoveryPriority
}

/**
 * Tamanho minimo de batch — sempre processa pelo menos N cards por
 * rodada (mesmo quando ha poucos visiveis no viewport, processa um
 * "buffer" para suavizar visualmente).
 */
export const MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH = 8

/**
 * Tamanho maximo absoluto de batch. Acima disso o pipeline divide
 * em rodadas para nao bloquear o canvas.
 */
export const MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH = 16

/**
 * Comparator para ordenar candidatos por prioridade de recovery:
 *  1. selected (prioridade absoluta) — usuario clicou ou viu o card
 *  2. inView — visivel no viewport atual
 *  3. nao-culled (renderizado, mesmo se fora da view atual)
 *  4. coverage decrescente — quanto maior o card visivel, mais critico
 *  5. distancia quadratica do centro do viewport — mais perto = mais
 *     prioritario
 *
 * Diferencas de coverage sub-0.0001 sao tratadas como empate (ruido
 * numerico).
 */
export const compareMissingProductImageRecoveryCandidates = (
    a: MissingProductImageRecoveryCandidate,
    b: MissingProductImageRecoveryCandidate
): number => {
    if (a.priority.selected !== b.priority.selected) return a.priority.selected ? -1 : 1
    if (a.priority.inView !== b.priority.inView) return a.priority.inView ? -1 : 1
    if (a.priority.culled !== b.priority.culled) return a.priority.culled ? 1 : -1
    if (Math.abs(a.priority.coverage - b.priority.coverage) > 0.0001) return b.priority.coverage - a.priority.coverage
    if (a.priority.distanceSq !== b.priority.distanceSq) return a.priority.distanceSq - b.priority.distanceSq
    return 0
}

/**
 * Calcula o tamanho de batch a processar nesta rodada:
 *  - se total <= MAX: processa todos
 *  - se ha visiveis no viewport: target = visibleCount + 4 (pequeno
 *    buffer para criar transicao suave entre rodadas)
 *  - senao: target = MIN_BATCH
 *
 * Resultado clampado em [MIN_BATCH, MAX_BATCH, candidates.length].
 *
 * Pure: sem efeito colateral.
 */
export const getMissingProductImageRecoveryBatchLimit = (
    candidates: MissingProductImageRecoveryCandidate[]
): number => {
    if (!Array.isArray(candidates) || candidates.length <= MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH) {
        return Array.isArray(candidates) ? candidates.length : 0
    }
    const visibleCount = candidates.filter((candidate) =>
        candidate.priority.selected || candidate.priority.inView
    ).length
    const target = visibleCount > 0 ? visibleCount + 4 : MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH
    return Math.max(
        MISSING_PRODUCT_IMAGE_RECOVERY_MIN_BATCH,
        Math.min(MISSING_PRODUCT_IMAGE_RECOVERY_MAX_BATCH, target, candidates.length)
    )
}
