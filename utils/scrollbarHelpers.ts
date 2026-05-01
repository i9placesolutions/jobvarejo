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
