/**
 * Helpers puros para inspecao de snapshots de template (price tag).
 * Detectam estruturas de variantes (atacarejo) e flags de forcado.
 *
 * Sem dependencia de canvas/refs. Operam sobre snapshot JSON ou
 * objeto Fabric.
 *
 * Cobertura: tests/utils/templateSnapshotHelpers.test.ts
 */

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
