/**
 * Helpers puros para decidir o que pode ser exportado individualmente
 * via "Export Selected Object" e gerar o nome de arquivo.
 *
 * Sao puramente classificadores — sem mutar nada, sem refs reativos.
 *
 * Cobertura: tests/utils/exportSelectionHelpers.test.ts
 */

import { isLikelyProductZone } from './fabricObjectClassifiers'

/**
 * Detecta objetos que NUNCA devem participar do export individual:
 *  - excludeFromExport (overlays, controls)
 *  - isFrame (framers contem outros objetos; export do frame e' outro fluxo)
 *  - product zone (idem; export da zona e' outro fluxo)
 */
export const isBlockedObjectForScopedExport = (obj: any): boolean => {
    if (!obj) return true
    if ((obj as any).excludeFromExport) return true
    if ((obj as any).isFrame) return true
    if (isLikelyProductZone(obj)) return true
    return false
}

/**
 * Detecta se uma selecao (objeto unico ou activeSelection) e' exportavel.
 * Para activeSelection, checa que ha pelo menos 1 child e que NENHUM
 * child e' bloqueado (frame, zone, excludeFromExport).
 */
export const isExportableSelectionObject = (obj: any): boolean => {
    if (!obj) return false
    if (isBlockedObjectForScopedExport(obj)) return false

    if (obj?.type === 'activeSelection' && typeof obj?.getObjects === 'function') {
        const children = (obj.getObjects() || []).filter(Boolean)
        if (!children.length) return false
        if (children.some((child: any) => isBlockedObjectForScopedExport(child))) return false
    }

    return true
}

/**
 * Gera um base-name de arquivo seguro a partir do objeto. Prioriza
 * `layerName` > `name` > `type` > 'objeto'. Aplica slug ASCII (a-z0-9-).
 *
 * Retorna 'objeto' se o slug ficar vazio (defesa contra nomes
 * compostos so de caracteres especiais).
 */
export const getSelectedObjectExportFileBaseName = (obj: any): string => {
    const baseName = String((obj as any)?.layerName || obj?.name || obj?.type || 'objeto')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    return baseName || 'objeto'
}
