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
