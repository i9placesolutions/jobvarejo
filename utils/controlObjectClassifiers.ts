/**
 * Classificadores de objetos "transient" / "control-like" — elementos
 * adicionados temporariamente ao canvas para edicao (path nodes, bezier
 * handles, guides), que NUNCA devem ser persistidos ou exportados.
 *
 * Cobertura: tests/utils/controlObjectClassifiers.test.ts
 */

/**
 * Nomes de objetos Fabric criados como controles temporarios de edicao
 * (pen tool, node editor). Devem sempre ser tratados como transient.
 */
export const TRANSIENT_CONTROL_NAMES: ReadonlySet<string> = new Set([
    'path_node',
    'bezier_handle',
    'control_point',
    'handle_line'
])

/**
 * Detecta um "control-like object" — qualquer objeto que serve apenas
 * para suportar UI de edicao do canvas e nao deve ser persistido:
 *  - Nome em TRANSIENT_CONTROL_NAMES (path_node, bezier_handle, etc)
 *  - id especial 'guide-vertical'/'guide-horizontal' (guides do drag)
 *  - data com parentPath/parentObj (overlay de path editing)
 */
export const isControlLikeObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const name = String(obj.name || '')
    const id = String(obj.id || '')
    if (TRANSIENT_CONTROL_NAMES.has(name)) return true
    if (id === 'guide-vertical' || id === 'guide-horizontal') return true
    if (obj.data && (obj.data.parentPath || obj.data.parentObj)) return true
    return false
}

/**
 * Detecta se um objeto Fabric e' "transient" — adicionado temporariamente
 * ao canvas e NUNCA deve ser persistido em saves nem copiado em
 * duplicacao/clipboard.
 *
 * Estrategia em camadas:
 *  1. Sem _customId: bloqueia tudo o que parece controle ou auxiliar
 *     (control-like, circle pequeno com excludeFromExport, line/path
 *     sem isVectorPath e excludeFromExport)
 *  2. Com excludeFromExport=true: aceita como persistente apenas se
 *     for content explicito (isFrame/isSmartObject/isProductCard/zone/
 *     parentZoneId/priceGroup/product-card/artboard-bg) — caso contrario
 *     trata como control-like
 *
 * Tem _customId: nao e' transient (e' content do usuario).
 */
export const isTransientCanvasObject = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const name = String(obj.name || '')
    const id = String(obj.id || '')
    const hasCustomId = typeof obj._customId === 'string' && obj._customId.trim().length > 0

    if (hasCustomId) return false
    if (isControlLikeObject(obj)) return true
    if (obj.type === 'circle' && obj.radius && obj.radius <= 10 && !hasCustomId && !!obj.excludeFromExport) return true
    if (obj.type === 'line' && !hasCustomId && !!obj.excludeFromExport) return true
    if (obj.type === 'path' && !hasCustomId && !obj.isVectorPath && !!obj.excludeFromExport) return true

    if (obj.excludeFromExport === true) {
        const isPersistentContent =
            !!obj.isFrame ||
            !!obj.isSmartObject ||
            !!obj.isProductCard ||
            !!obj.isGridZone ||
            !!obj.isProductZone ||
            !!obj.parentZoneId ||
            name === 'gridZone' ||
            name === 'productZoneContainer' ||
            name === 'priceGroup' ||
            name.startsWith('product-card') ||
            id === 'artboard-bg'
        if (isPersistentContent) return false
        return isControlLikeObject(obj)
    }

    return false
}
