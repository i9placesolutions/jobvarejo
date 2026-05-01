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
 * Calcula o viewport rect em coordenadas do mundo a partir do
 * viewportTransform + dimensoes raw + zoom. Diferente de
 * computeViewportBoundsInWorld (em fabricMeasure), este nao precisa
 * de invertTransform/transformPoint do Fabric — usa formula direta:
 *
 *   width_world = width_screen / zoom
 *   left_world = -vpt[4] / zoom
 *
 * Pure: nao depende de fabric.util.
 *
 * Retorna null se canvas/dimensoes invalidos. zoom clampado em
 * 0.0001 minimo (evita divisao por zero).
 */
export const computeMissingProductImageRecoveryViewportRect = (
    viewportTransform: number[] | null | undefined,
    canvasWidth: number,
    canvasHeight: number,
    zoom: number
): MissingProductImageRecoveryViewportRect | null => {
    const vpt = Array.isArray(viewportTransform) && viewportTransform.length >= 6
        ? viewportTransform
        : [1, 0, 0, 1, 0, 0]
    const z = Math.max(0.0001, Number(zoom) || 1)
    const cw = Number(canvasWidth) || 0
    const ch = Number(canvasHeight) || 0
    if (!cw || !ch) return null
    const width = cw / z
    const height = ch / z
    const left = -Number(vpt[4] || 0) / z
    const top = -Number(vpt[5] || 0) / z
    const right = left + width
    const bottom = top + height
    return {
        left,
        top,
        right,
        bottom,
        centerX: left + (width / 2),
        centerY: top + (height / 2)
    }
}

/**
 * Calcula a prioridade de recovery de um card. Recebe:
 *  - card duck-typed (precisa de getBoundingRect)
 *  - viewportRect (calculado via computeViewportBoundsInWorld)
 *  - activeCard (atual selecao)
 *
 * Pure: nao acessa canvas/refs.
 *
 * Regras:
 *  - selected = activeCard === card
 *  - culled = card.visible === false || card.__viewportCulled
 *  - quando viewportRect ausente: inView = selected; distanceSq = 0
 *    se selected senao MAX_SAFE_INTEGER
 *  - coverage = areaVisivel / areaTotal (0 se nao intersecta)
 *  - distanceSq = (dx² + dy²) do centro do card ao centro do viewport
 *
 * Try/catch absorve erros do getBoundingRect e cai em defaults seguros.
 */
export const measureMissingProductImageRecoveryPriority = (
    card: any,
    viewportRect: MissingProductImageRecoveryViewportRect | null,
    activeCard: any | null
): MissingProductImageRecoveryPriority => {
    const selected = !!(activeCard && activeCard === card)
    const culled = card?.visible === false || !!(card as any)?.__viewportCulled
    if (!viewportRect || typeof card?.getBoundingRect !== 'function') {
        return {
            selected,
            inView: selected,
            coverage: 0,
            distanceSq: selected ? 0 : Number.MAX_SAFE_INTEGER,
            culled
        }
    }

    try {
        const bounds = card.getBoundingRect(true, true)
        const left = Number(bounds?.left || 0)
        const top = Number(bounds?.top || 0)
        const width = Math.max(0, Number(bounds?.width || 0))
        const height = Math.max(0, Number(bounds?.height || 0))
        const right = left + width
        const bottom = top + height
        const intersectWidth = Math.max(0, Math.min(right, viewportRect.right) - Math.max(left, viewportRect.left))
        const intersectHeight = Math.max(0, Math.min(bottom, viewportRect.bottom) - Math.max(top, viewportRect.top))
        const visibleArea = intersectWidth * intersectHeight
        const area = Math.max(1, width * height)
        const coverage = visibleArea > 0 ? visibleArea / area : 0
        const centerX = left + (width / 2)
        const centerY = top + (height / 2)
        const dx = centerX - viewportRect.centerX
        const dy = centerY - viewportRect.centerY
        return {
            selected,
            inView: visibleArea > 0 && !culled,
            coverage,
            distanceSq: (dx * dx) + (dy * dy),
            culled
        }
    } catch {
        return {
            selected,
            inView: selected,
            coverage: 0,
            distanceSq: selected ? 0 : Number.MAX_SAFE_INTEGER,
            culled
        }
    }
}

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
