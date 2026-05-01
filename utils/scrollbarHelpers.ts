/**
 * Helpers puros para scrollbars do canvas.
 *
 * Cobertura: tests/utils/scrollbarHelpers.test.ts
 */

import { isValidFabricCanvasObject } from './canvasValidation'

/**
 * IDs de objetos que NUNCA devem afetar scrollbar bounds:
 *  - artboard-bg: background da pagina (sempre cobre tudo)
 *  - guide-vertical/horizontal: guides de drag (efemeros)
 */
export const SCROLLBAR_IGNORED_IDS: ReadonlySet<string> = new Set([
    'artboard-bg',
    'guide-vertical',
    'guide-horizontal'
])

/**
 * Padding default em pixels world adicionado aos bounds para
 * evitar scrollbar tocando exatamente nas bordas.
 */
export const SCROLLBAR_PADDING = 100

/**
 * Intervalo padrao em ms entre passes de sanitize do stack do canvas
 * acionados por scrollbar bounds.
 */
export const SCROLLBAR_SANITIZE_INTERVAL_MS = 1200

/**
 * Calcula intervalo adaptativo de sanitize baseado em objectCount.
 * Projetos grandes pagam mais para sanitizar — usamos intervalo maior
 * para nao gastar CPU repetidamente.
 *  - > 600 objetos: 5000ms
 *  - > 250: 2500ms
 *  - <= 250: SCROLLBAR_SANITIZE_INTERVAL_MS (1200ms default)
 */
export const getScrollbarSanitizeIntervalMs = (objectCount: number): number => {
    const n = Number(objectCount) || 0
    if (n > 600) return 5000
    if (n > 250) return 2500
    return SCROLLBAR_SANITIZE_INTERVAL_MS
}

/**
 * Detecta se um objeto Fabric deve ser considerado no calculo dos
 * scrollbar bounds:
 *  - precisa ser fabric.Object valido
 *  - nao pode ter excludeFromExport
 *  - nao pode estar em SCROLLBAR_IGNORED_IDS (artboard-bg, guides)
 */
export const isScrollbarRelevantObject = (obj: any): boolean => {
    if (!isValidFabricCanvasObject(obj)) return false
    if (obj.excludeFromExport) return false
    if (SCROLLBAR_IGNORED_IDS.has(String(obj.id || ''))) return false
    return true
}

/**
 * Resultado agregado de bounds de objetos: union dos bbox de todos
 * os objetos "relevantes" (filtrados pelo predicate). Quando nao
 * ha nenhum relevante: hasAny=false e os 4 valores ficam em
 * Infinity/-Infinity (caller decide o fallback).
 */
export type AggregatedRelevantBounds = {
    minX: number
    minY: number
    maxX: number
    maxY: number
    hasAny: boolean
}

/**
 * Calcula a uniao 2D dos bbox de objetos que passam pelo predicate
 * `isRelevant`. Pure: nao acessa canvas/refs.
 *
 *  - Filtra objetos sem getBoundingRect ou bounds invalidos
 *  - bounds invalidos (NaN/Infinity em qualquer dimensao) sao pulados
 *  - Quando nada passa: hasAny=false, valores em Infinity/-Infinity
 *
 * Caller decide aplicar fallback (page dimensions, etc) quando
 * hasAny=false.
 */
export const computeAggregatedRelevantBounds = (
    objects: ReadonlyArray<any>,
    isRelevant: (obj: any) => boolean
): AggregatedRelevantBounds => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasAny = false

    for (const obj of (objects || [])) {
        if (!isRelevant(obj)) continue
        if (typeof obj?.getBoundingRect !== 'function') continue
        const bounds = obj.getBoundingRect(true, true)
        if (
            !bounds ||
            !Number.isFinite(bounds.left) ||
            !Number.isFinite(bounds.top) ||
            !Number.isFinite(bounds.width) ||
            !Number.isFinite(bounds.height)
        ) continue

        hasAny = true
        const oMinX = bounds.left
        const oMinY = bounds.top
        const oMaxX = bounds.left + bounds.width
        const oMaxY = bounds.top + bounds.height
        if (oMinX < minX) minX = oMinX
        if (oMinY < minY) minY = oMinY
        if (oMaxX > maxX) maxX = oMaxX
        if (oMaxY > maxY) maxY = oMaxY
    }

    return { minX, minY, maxX, maxY, hasAny }
}
