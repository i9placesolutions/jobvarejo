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
