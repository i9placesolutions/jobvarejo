/**
 * Helpers de medicao para objetos Fabric. Trabalham com objetos duck-typed
 * (precisa de width/height/scaleX/scaleY/left/top/originX/originY/visible),
 * SEM precisar do canvas — uteis para layoutPrice, snapping, alinhamento
 * e qualquer calculo de bbox local.
 *
 * Funcoes 100% puras. Cobertura: tests/utils/fabricMeasure.test.ts
 */

export type HorizontalBounds = { left: number; right: number }
export type VerticalBounds = { top: number; bottom: number }
export type ContentBounds = HorizontalBounds & VerticalBounds & {
    width: number
    height: number
}
export type HorizontalBoundsWithWidth = HorizontalBounds & { width: number }

/**
 * Retorna `false` quando o objeto e' nulo, invisivel ou tem scale=0.
 * Util para excluir do calculo de bbox elementos que nao aparecem
 * (visible=false ou colapsados via scale=0 — comum em tiers atacarejo).
 */
export const isObjectShownForBounds = (obj: any): boolean => {
    if (!obj) return false
    if (obj.visible === false) return false
    const sx = Number(obj.scaleX ?? 1)
    const sy = Number(obj.scaleY ?? 1)
    return sx !== 0 && sy !== 0
}

/**
 * Calcula bounds horizontais de um objeto Fabric considerando origem
 * (left/center/right). Retorna null para objetos invisiveis ou width<=0.
 */
export const getObjectHorizontalBoundsLocal = (obj: any): HorizontalBounds | null => {
    if (!isObjectShownForBounds(obj)) return null
    const widthRaw = Number(obj?.width ?? 0)
    const scaleX = Math.abs(Number(obj?.scaleX ?? 1)) || 1
    const width = widthRaw * scaleX
    if (!Number.isFinite(width) || width <= 0) return null
    const x = Number(obj?.left ?? 0)
    const ox = String(obj?.originX || 'left')
    if (ox === 'center') return { left: x - (width / 2), right: x + (width / 2) }
    if (ox === 'right') return { left: x - width, right: x }
    return { left: x, right: x + width }
}

/**
 * Bbox horizontal de um conjunto de objetos (uniao). Retorna null se
 * nenhum objeto for visivel/medivel.
 */
export const measureHorizontalBoundsLocal = (objects: any[]): HorizontalBoundsWithWidth | null => {
    const bounds = (objects || [])
        .map((o) => getObjectHorizontalBoundsLocal(o))
        .filter(Boolean) as HorizontalBounds[]
    if (!bounds.length) return null
    const left = Math.min(...bounds.map((b) => b.left))
    const right = Math.max(...bounds.map((b) => b.right))
    return { left, right, width: Math.max(0, right - left) }
}

/**
 * Calcula bounds verticais de um objeto Fabric considerando origem
 * (top/center/bottom). Retorna null para objetos invisiveis ou height<=0.
 */
export const getObjectVerticalBoundsLocal = (obj: any): VerticalBounds | null => {
    if (!isObjectShownForBounds(obj)) return null
    const heightRaw = Number(obj?.height ?? 0)
    const scaleY = Math.abs(Number(obj?.scaleY ?? 1)) || 1
    const height = heightRaw * scaleY
    if (!Number.isFinite(height) || height <= 0) return null
    const y = Number(obj?.top ?? 0)
    const oy = String(obj?.originY || 'top')
    if (oy === 'center') return { top: y - (height / 2), bottom: y + (height / 2) }
    if (oy === 'bottom') return { top: y - height, bottom: y }
    return { top: y, bottom: y + height }
}

/**
 * Bbox completo (uniao 2D) de um conjunto de objetos. Retorna null se
 * nao houver objetos medivel em ambos os eixos.
 */
export const measureContentBoundsLocal = (objects: any[]): ContentBounds | null => {
    const h = (objects || [])
        .map((o) => getObjectHorizontalBoundsLocal(o))
        .filter(Boolean) as HorizontalBounds[]
    const v = (objects || [])
        .map((o) => getObjectVerticalBoundsLocal(o))
        .filter(Boolean) as VerticalBounds[]
    if (!h.length || !v.length) return null
    const left = Math.min(...h.map((b) => b.left))
    const right = Math.max(...h.map((b) => b.right))
    const top = Math.min(...v.map((b) => b.top))
    const bottom = Math.max(...v.map((b) => b.bottom))
    return {
        left,
        right,
        top,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
    }
}
