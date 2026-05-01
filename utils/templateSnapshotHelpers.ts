/**
 * Helpers puros para inspecao de snapshots de template (price tag).
 * Detectam estruturas de variantes (atacarejo) e flags de forcado.
 *
 * Sem dependencia de canvas/refs. Operam sobre snapshot JSON ou
 * objeto Fabric.
 *
 * Cobertura: tests/utils/templateSnapshotHelpers.test.ts
 */

import { collectObjectsDeep, findByName } from './fabricObjectClassifiers'

/**
 * Detecta se um snapshot (JSON ou objeto Fabric) contem um node com
 * name 'atac_retail_bg' em qualquer profundidade. Tradicionalmente
 * sinaliza que o template segue layout atacarejo (varejo + atacado
 * lado a lado).
 *
 * Lida tanto com `objects` (formato JSON) quanto `_objects` /
 * `getObjects()` (objeto Fabric instanciado).
 */
export const templateSnapshotHasAtacStructure = (snapshot: any): boolean => {
    if (!snapshot || typeof snapshot !== 'object') return false
    if (String((snapshot as any).name || '') === 'atac_retail_bg') return true
    const stack: any[] = []
    const rootJsonChildren = Array.isArray((snapshot as any).objects)
        ? (snapshot as any).objects : []
    const rootFabricChildren = Array.isArray((snapshot as any)._objects)
        ? (snapshot as any)._objects
        : (typeof (snapshot as any).getObjects === 'function' ? (snapshot as any).getObjects() : [])
    if (rootJsonChildren.length) stack.push(...rootJsonChildren)
    if (rootFabricChildren.length) stack.push(...rootFabricChildren)
    while (stack.length) {
        const obj = stack.pop()
        if (!obj || typeof obj !== 'object') continue
        if (String((obj as any).name || '') === 'atac_retail_bg') return true
        const nestedJson = Array.isArray((obj as any).objects) ? (obj as any).objects : []
        const nestedFabric = Array.isArray((obj as any)._objects)
            ? (obj as any)._objects
            : (typeof (obj as any).getObjects === 'function' ? (obj as any).getObjects() : [])
        if (nestedJson.length) stack.push(...nestedJson)
        if (nestedFabric.length) stack.push(...nestedFabric)
    }
    return false
}

/**
 * Apenas honra o flag explicito __forceAtacarejoCanonical. A
 * presenca de estrutura atacarejo NAO forca o reflow canonico
 * (templates do Mini Editor precisam persistir como foram criados).
 */
export const shouldForceCanonicalAtacForTemplateJson = (snapshot: any): boolean => {
    return !!(snapshot && typeof snapshot === 'object'
        && (snapshot as any).__forceAtacarejoCanonical === true)
}

/**
 * Layout atacarejo fixo: nao selecionar snapshots por variante em
 * runtime. Sempre retorna false.
 *
 * Existe para documentar a decisao no codigo (em vez de remover a
 * abstracao). Pure: sem efeito colateral.
 */
export const shouldUseAtacVariantSnapshotsForTemplate = (_snapshot: any): boolean => {
    return false
}

/**
 * Decide se um priceGroup tem layout "manual" customizado que deve
 * ser preservado durante re-renders/syncs (em vez de regenerar o
 * layout default).
 *
 * Heuristicas em ordem (primeira que casa decide):
 *  1. Flag explicita `__preserveManualLayout=true` ou `__isCustomTemplate=true` → true
 *  2. Flag explicita `__forceAtacarejoCanonical=true` → false (forca layout atac default)
 *  3. Tem estrutura Red Burst (via `isRedBurstCheck` injetado) → true
 *  4. Tem node `atac_retail_bg` (estrutura atacarejo padrao) → false
 *  5. Tem `price_header_bg` ou `price_header_text` → true (custom header)
 *  6. Algum filho tem `__originalLeft/Top/FontSize/Width/Height` finitos → true
 *  7. Default → false
 *
 * Caller injeta `isRedBurstCheck` para evitar dependencia circular
 * entre `templateSnapshotHelpers` e `redBurstTemplateRevive`.
 */
export const shouldPreserveManualTemplateVisual = (
    priceGroup: any,
    isRedBurstCheck: (g: any) => boolean
): boolean => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
    if ((priceGroup as any).__preserveManualLayout === true || (priceGroup as any).__isCustomTemplate === true) return true
    if ((priceGroup as any).__forceAtacarejoCanonical === true) return false

    if (isRedBurstCheck(priceGroup)) return true

    const all = collectObjectsDeep(priceGroup)
    if (!all.length) return false

    const hasAtacStructure = !!findByName(all, 'atac_retail_bg')
    if (hasAtacStructure) return false

    if (findByName(all, 'price_header_bg') || findByName(all, 'price_header_text')) return true

    const hasTemplateMetrics = all.some((obj: any) => (
        Number.isFinite(Number((obj as any)?.__originalLeft)) ||
        Number.isFinite(Number((obj as any)?.__originalTop)) ||
        Number.isFinite(Number((obj as any)?.__originalFontSize)) ||
        Number.isFinite(Number((obj as any)?.__originalWidth)) ||
        Number.isFinite(Number((obj as any)?.__originalHeight))
    ))
    return hasTemplateMetrics
}
