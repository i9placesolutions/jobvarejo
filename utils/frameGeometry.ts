/**
 * Geometria pura de frames e relacao objeto-frame.
 *
 * Frames sao "lousas" que delimitam areas do canvas (ex: paginas de
 * encarte, slides). Estas funcoes ajudam a:
 *  - obter bounds confiaveis do frame mesmo com angle/scale aplicados
 *  - detectar se um objeto e' um frame (por flag/name/heuristica)
 *  - decidir se um objeto pertence a um frame (centro/overlap/maioria)
 *
 * Tudo duck-typed (precisa de `getBoundingRect`, `getCenterPoint`, etc).
 * Sem refs reativos / canvas global.
 *
 * Cobertura: tests/utils/frameGeometry.test.ts
 */

import { isRectObject } from './fabricStyleHelpers'

export type FrameBounds = {
    left: number
    top: number
    width: number
    height: number
}

/**
 * Bounds do frame com 2 caminhos:
 *  - rotacionado: usa getBoundingRect(true) que ja retorna AABB pos-angle
 *  - sem rotacao: width/height * scaleX/Y, centrado em getCenterPoint
 *
 * Retorna null se dimensoes invalidas (zero/negativo/NaN).
 */
export const getFrameBounds = (frame: any): FrameBounds | null => {
    if (!frame) return null
    const angle = Math.abs(Number(frame.angle || 0)) % 360
    if (angle > 0.001) {
        try {
            const rotatedBounds = frame.getBoundingRect?.(true)
            if (
                rotatedBounds &&
                Number.isFinite(rotatedBounds.left) &&
                Number.isFinite(rotatedBounds.top) &&
                Number.isFinite(rotatedBounds.width) &&
                Number.isFinite(rotatedBounds.height) &&
                rotatedBounds.width > 0 &&
                rotatedBounds.height > 0
            ) {
                return rotatedBounds
            }
        } catch {
            // fallback below
        }
    }

    const width = Math.abs((Number(frame.width) || 0) * (Number(frame.scaleX) || 1))
    const height = Math.abs((Number(frame.height) || 0) * (Number(frame.scaleY) || 1))
    const center = typeof frame.getCenterPoint === 'function'
        ? frame.getCenterPoint()
        : { x: Number(frame.left) || 0, y: Number(frame.top) || 0 }
    const left = Number(center.x || 0) - (width / 2)
    const top = Number(center.y || 0) - (height / 2)
    if (!Number.isFinite(left) || !Number.isFinite(top) || width <= 0 || height <= 0) return null
    return { left, top, width, height }
}

/**
 * Detecta um frame ("lousa" do canvas). 4 sinais:
 *  - flag explicita `isFrame`
 *  - layerName/name "FRAME"/"FRAMER" (com indice opcional)
 *  - rect com flag isGridCell ou gridGroupId (cell de um grid de frames)
 */
export const isFrameLikeObject = (obj: any): boolean => {
    if (!obj) return false
    if (obj.isFrame) return true

    const layerName = String(obj.layerName || '').trim().toUpperCase()
    const name = String(obj.name || '').trim()
    if (layerName === 'FRAMER' || layerName === 'FRAME' || /^FRAMER?\s+\d+\s*$/i.test(layerName)) return true
    if (/^FRAMER(?:\s+\d+)?$/i.test(name) || /^FRAME(?:\s+\d+)?\s*$/i.test(name)) return true

    const isRect = isRectObject(obj) || String(obj.type || '').toLowerCase() === 'rect'
    if (isRect && (obj.isGridCell === true || String(obj.gridGroupId || '').trim().length > 0)) return true

    return false
}

/**
 * Verifica se o CENTRO do bbox de `obj` cai dentro do bbox de `frame`.
 * Mais permissivo que intersection: aceita objeto cujo centro esta no
 * frame mesmo que estoure as bordas (uso comum: splash/decoracao).
 */
export const isObjectCenterInsideFrame = (obj: any, frame: any): boolean => {
    if (!obj || !frame || typeof obj.getBoundingRect !== 'function' || typeof frame.getBoundingRect !== 'function') {
        return false
    }
    const objBounds = obj.getBoundingRect(true)
    const frameBounds = frame.getBoundingRect(true)
    if (!objBounds || !frameBounds) return false
    const cx = objBounds.left + (objBounds.width / 2)
    const cy = objBounds.top + (objBounds.height / 2)
    const minX = frameBounds.left
    const maxX = frameBounds.left + frameBounds.width
    const minY = frameBounds.top
    const maxY = frameBounds.top + frameBounds.height
    return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY
}

/**
 * Heuristica "visualmente dentro": center inside OU pelo menos 20% do
 * area do objeto overlapping o frame. Bom para decidir se um titulo/
 * imagem que estoura levemente ainda pertence ao frame.
 */
export const isObjectVisuallyInsideFrame = (obj: any, frame: any): boolean => {
    if (!obj || !frame || typeof obj.getBoundingRect !== 'function' || typeof frame.getBoundingRect !== 'function') {
        return false
    }

    if (isObjectCenterInsideFrame(obj, frame)) return true

    const objBounds = obj.getBoundingRect(true)
    const frameBounds = frame.getBoundingRect(true)
    if (!objBounds || !frameBounds) return false

    const left = Math.max(objBounds.left, frameBounds.left)
    const top = Math.max(objBounds.top, frameBounds.top)
    const right = Math.min(objBounds.left + objBounds.width, frameBounds.left + frameBounds.width)
    const bottom = Math.min(objBounds.top + objBounds.height, frameBounds.top + frameBounds.height)
    const overlapW = Math.max(0, right - left)
    const overlapH = Math.max(0, bottom - top)
    const overlapArea = overlapW * overlapH
    const objArea = Math.max(1, objBounds.width * objBounds.height)

    return overlapArea / objArea >= 0.2
}

/**
 * Detecta qualquer interseccao (area > 0) entre obj e frame. Tenta usar
 * `frame.intersectsWithObject(obj)` quando disponivel; cai em bbox
 * intersection puro como fallback.
 */
export const isObjectIntersectingFrame = (obj: any, frame: any): boolean => {
    if (!obj || !frame) return false

    if (isObjectCenterInsideFrame(obj, frame)) return true

    try {
        if (typeof frame.intersectsWithObject === 'function' && frame.intersectsWithObject(obj)) return true
    } catch {
        // ignore intersection API failures
    }

    if (typeof obj.getBoundingRect !== 'function' || typeof frame.getBoundingRect !== 'function') {
        return false
    }

    const objBounds = obj.getBoundingRect(true)
    const frameBounds = frame.getBoundingRect(true)
    if (!objBounds || !frameBounds) return false

    const left = Math.max(objBounds.left, frameBounds.left)
    const top = Math.max(objBounds.top, frameBounds.top)
    const right = Math.min(objBounds.left + objBounds.width, frameBounds.left + frameBounds.width)
    const bottom = Math.min(objBounds.top + objBounds.height, frameBounds.top + frameBounds.height)
    const overlapW = Math.max(0, right - left)
    const overlapH = Math.max(0, bottom - top)
    const overlapArea = overlapW * overlapH

    return overlapArea > 0
}

/**
 * Heuristica "majoritariamente dentro": center inside OU overlap >=
 * `minOverlapRatio` da area do objeto. Default 0.6 (60%).
 *
 * Useful para decidir o frame "dono" de um objeto durante reparo de
 * binding. Decoracoes (splash, titulo) que estouram a borda mas tem
 * centro no frame ainda sao consideradas "dentro" — preserva o clip.
 */
export const isObjectMostlyInsideFrame = (obj: any, frame: any, minOverlapRatio = 0.6): boolean => {
    if (!obj || !frame || typeof obj.getBoundingRect !== 'function' || typeof frame.getBoundingRect !== 'function') {
        return false
    }

    const objBounds = obj.getBoundingRect(true)
    const frameBounds = frame.getBoundingRect(true)
    if (!objBounds || !frameBounds) return false

    const cx = objBounds.left + objBounds.width / 2
    const cy = objBounds.top + objBounds.height / 2
    const centerInside =
        cx >= frameBounds.left &&
        cx <= frameBounds.left + frameBounds.width &&
        cy >= frameBounds.top &&
        cy <= frameBounds.top + frameBounds.height
    if (centerInside) return true

    const left = Math.max(objBounds.left, frameBounds.left)
    const top = Math.max(objBounds.top, frameBounds.top)
    const right = Math.min(objBounds.left + objBounds.width, frameBounds.left + frameBounds.width)
    const bottom = Math.min(objBounds.top + objBounds.height, frameBounds.top + frameBounds.height)
    const overlapW = Math.max(0, right - left)
    const overlapH = Math.max(0, bottom - top)
    const overlapArea = overlapW * overlapH
    const objArea = Math.max(1, objBounds.width * objBounds.height)

    return (overlapArea / objArea) >= minOverlapRatio
}
