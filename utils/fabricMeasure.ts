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
 * Detecta o melhor tamanho de geracao de imagem AI para um objeto Fabric
 * baseado na razao largura/altura.
 *  - ar > 1.15 (paisagem)  → '1536x1024'
 *  - ar < 0.87 (retrato)   → '1024x1536'
 *  - quase quadrado        → '1024x1024'
 *
 * Usa getScaledWidth/Height quando disponivel, senao width*scaleX.
 */
export const guessAiSizeFromObject = (obj: any): '1024x1024' | '1024x1536' | '1536x1024' => {
    const w = Math.max(1, Number(obj?.getScaledWidth?.() ?? ((obj?.width || 1) * (obj?.scaleX || 1))) || 1)
    const h = Math.max(1, Number(obj?.getScaledHeight?.() ?? ((obj?.height || 1) * (obj?.scaleY || 1))) || 1)
    const ar = w / h
    if (ar > 1.15) return '1536x1024'
    if (ar < 0.87) return '1024x1536'
    return '1024x1024'
}

/**
 * Extrai a dimensao "base" do card (largura x altura) na arvore Fabric
 * runtime. Tenta na ordem:
 *   1. _cardWidth/_cardHeight (engine signal mais confiavel)
 *   2. offerBackground rect dentro do group
 *   3. card.width/card.height
 *
 * Espelha getCardBaseSizeForContainmentJson de canvasJsonClassifiers,
 * mas opera em objetos Fabric ao vivo (com getObjects()).
 */
export const getCardBaseSizeForContainment = (card: any): { w: number; h: number } | null => {
    if (!card) return null
    const w0 = Number((card as any)._cardWidth)
    const h0 = Number((card as any)._cardHeight)
    if (Number.isFinite(w0) && w0 > 0 && Number.isFinite(h0) && h0 > 0) {
        return { w: w0, h: h0 }
    }
    try {
        if (card.type === 'group' && typeof card.getObjects === 'function') {
            const bg = card.getObjects().find((c: any) =>
                c?.name === 'offerBackground' && (c?.type === 'rect' || c?.type === 'Rect')
            )
            const bw = Number(bg?.width)
            const bh = Number(bg?.height)
            if (Number.isFinite(bw) && bw > 0 && Number.isFinite(bh) && bh > 0) {
                return { w: bw, h: bh }
            }
        }
    } catch {
        // ignore
    }

    const w1 = Number(card?.width)
    const h1 = Number(card?.height)
    if (Number.isFinite(w1) && w1 > 0 && Number.isFinite(h1) && h1 > 0) {
        return { w: w1, h: h1 }
    }
    return null
}

/**
 * Centro absoluto do objeto via Fabric `getCenterPoint()`. Cai para
 * left/top quando getCenterPoint nao disponivel ou retorna NaN.
 *
 * Diferente de getObjectCenterInParentPlane: aqui usamos sempre o
 * centro absoluto (top-level), nao o relativo ao parent group.
 */
export const getObjectAbsoluteCenter = (obj: any): { x: number; y: number } => {
    if (!obj) return { x: 0, y: 0 }
    try {
        const p = obj.getCenterPoint?.()
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            return { x: Number(p.x), y: Number(p.y) }
        }
    } catch {
        // ignore
    }
    return { x: Number(obj.left || 0) || 0, y: Number(obj.top || 0) || 0 }
}

/**
 * Calcula o "centro do envelope" de uma lista de pontos — a media do
 * AABB que envolve todos os centros. Util para alinhar/distribuir
 * grupos de objetos em torno de um pivot comum.
 *
 * Retorna { x: 0, y: 0 } para lista vazia ou pontos invalidos.
 */
export const computeCentersBoundingCenter = (centers: Array<{ x: number; y: number }>): { x: number; y: number } => {
    if (!Array.isArray(centers) || centers.length === 0) return { x: 0, y: 0 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    centers.forEach((p) => {
        const x = Number(p?.x || 0) || 0
        const y = Number(p?.y || 0) || 0
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    })
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return { x: 0, y: 0 }
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * Calcula o centro de um objeto Fabric no plano do PARENT (group/canvas),
 * com 3 caminhos:
 *  1. `getRelativeCenterPoint()` (preferido para objetos em group)
 *  2. derivacao de left/top + origem (fallback puro, sem Fabric)
 *  3. `getCenterPoint()` (top-level, ultimo recurso)
 *
 * Sempre retorna `{ x: 0, y: 0 }` em caso de falha total ou null obj —
 * caller pode confiar que sempre tem ponto valido.
 */
export const getObjectCenterInParentPlane = (obj: any): { x: number; y: number } => {
    if (!obj) return { x: 0, y: 0 }

    try {
        if (typeof obj.getRelativeCenterPoint === 'function') {
            const p = obj.getRelativeCenterPoint()
            if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
                return { x: Number(p.x), y: Number(p.y) }
            }
        }
    } catch {
        // fallback below
    }

    const w = Math.abs((Number(obj.width) || 0) * (Number(obj.scaleX) || 1))
    const h = Math.abs((Number(obj.height) || 0) * (Number(obj.scaleY) || 1))
    const ox = String(obj.originX || 'left')
    const oy = String(obj.originY || 'top')
    let cx = Number(obj.left || 0)
    let cy = Number(obj.top || 0)
    if (ox === 'left') cx += w / 2
    else if (ox === 'right') cx -= w / 2
    if (oy === 'top') cy += h / 2
    else if (oy === 'bottom') cy -= h / 2

    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy }

    try {
        if (typeof obj.getCenterPoint === 'function') {
            const p = obj.getCenterPoint()
            if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) {
                return { x: Number(p.x), y: Number(p.y) }
            }
        }
    } catch {
        // ignore
    }

    return { x: 0, y: 0 }
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

/**
 * Calcula o centro do viewport em coordenadas do mundo (canvas), dado
 * o viewportTransform (matriz 6-array Fabric), zoom, width e height
 * da tela. Usa a equacao inversa: world = (screen - translate) / zoom.
 *
 *   screen_x = world_x * zoom + vpt[4]
 *   screen_y = world_y * zoom + vpt[5]
 *   world_x = (screen_x - vpt[4]) / zoom
 *
 * Centro da tela: (width/2, height/2). Retorna { x, y } ou {0, 0}
 * quando vpt invalido / dimensoes invalidas.
 *
 * Pure: nao acessa canvas/refs.
 */
export const computeViewportCenterInWorld = (
    viewportTransform: number[] | null | undefined,
    width: number,
    height: number,
    zoom: number = 1
): { x: number; y: number } => {
    if (!Array.isArray(viewportTransform) || viewportTransform.length < 6) {
        return { x: 0, y: 0 }
    }
    const w = Number(width) || 0
    const h = Number(height) || 0
    const z = Number(zoom) || 1
    if (!w || !h || !z) return { x: 0, y: 0 }
    const tx = Number(viewportTransform[4]) || 0
    const ty = Number(viewportTransform[5]) || 0
    return {
        x: (w / 2 - tx) / z,
        y: (h / 2 - ty) / z
    }
}

/**
 * Setter pareado com getObjectCenterInParentPlane: aplica um centro
 * (cx, cy) no plano do parent. Pode usar setPositionByOrigin (Fabric)
 * com Point construido pelo factory injetado, ou fallback que ajusta
 * left/top + origin.
 *
 * Caller passa `pointFactory` (geralmente `(x, y) => new fabric.Point(x, y)`).
 * Quando pointFactory ausente OU obj sem setPositionByOrigin, cai no
 * fallback simples.
 *
 * Mutativo. No-op silencioso se obj null.
 */
export const setObjectCenterInParentPlane = (
    obj: any,
    cx: number,
    cy: number,
    pointFactory?: (x: number, y: number) => any
): void => {
    if (!obj) return
    if (pointFactory && typeof obj.setPositionByOrigin === 'function') {
        obj.setPositionByOrigin(pointFactory(cx, cy), 'center', 'center')
    } else {
        obj.set?.({ left: cx, top: cy, originX: 'center', originY: 'center' })
    }
}
