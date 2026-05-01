/**
 * Helpers puros para viewport culling — decidir se um objeto Fabric
 * intersecta a regiao visivel do canvas e se deve ou nao ser ocultado
 * por culling.
 *
 * Sem dependencia de canvas, refs reativos ou estado global.
 *
 * Cobertura: tests/utils/viewportCulling.test.ts
 */

import { isControlLikeObject, isTransientCanvasObject } from './controlObjectClassifiers'

export type CullRect = {
    left: number
    top: number
    right: number
    bottom: number
}

/**
 * Padding extra (em pixels world) ao redor do viewport — objetos um
 * pouco fora da tela ainda sao mantidos visiveis para evitar
 * re-rendering quando o usuario faz pequeno pan.
 */
export const VIEWPORT_CULL_PADDING = 240

export type ViewportRectInput = {
    /** viewportTransform [a,b,c,d,e,f] — matrix 2x3 do canvas */
    viewportTransform: number[]
    /** Zoom atual (resultado de canvas.getZoom()) */
    zoom: number
    /** Largura do canvas em pixels (canvas.getWidth()) */
    width: number
    /** Altura do canvas em pixels (canvas.getHeight()) */
    height: number
    /** Padding extra em pixels world (default VIEWPORT_CULL_PADDING) */
    padding?: number
}

/**
 * Calcula o retangulo de cull (regiao visivel + padding) em
 * coordenadas WORLD do canvas.
 *
 * Aplica o `viewportTransform[4]` e `[5]` (tx,ty) inversamente
 * ao zoom para mapear o que esta na tela para coordenadas world.
 *
 * Recebe input ja resolvido — caller (canvasManager) injeta os valores
 * do canvas.value. Permite testar sem instanciar Fabric.
 */
export const computeViewportCullRect = (input: ViewportRectInput): CullRect => {
    const vpt = input.viewportTransform || [1, 0, 0, 1, 0, 0]
    const zoom = Math.max(0.0001, Number(input.zoom) || 1)
    const padding = Number.isFinite(Number(input.padding)) ? Number(input.padding) : VIEWPORT_CULL_PADDING
    const widthWorld = Number(input.width || 0) / zoom
    const heightWorld = Number(input.height || 0) / zoom
    const left = (-Number(vpt[4] || 0) / zoom) - padding
    const top = (-Number(vpt[5] || 0) / zoom) - padding
    return {
        left,
        top,
        right: left + widthWorld + (padding * 2),
        bottom: top + heightWorld + (padding * 2)
    }
}

/**
 * Detecta se um objeto Fabric intersecta um retangulo de cull (visible
 * area). Retorna `true` quando intersecta OU quando nao da pra medir
 * (defesa: melhor exibir do que cull falsamente).
 *
 * Usa `getBoundingRect(true, true)` (com viewport transform aplicado).
 * Erros sao tratados retornando `true` (nao culla por engano).
 */
export const isObjectIntersectingCullRect = (obj: any, rect: CullRect): boolean => {
    if (!obj || !rect || typeof obj.getBoundingRect !== 'function') return true
    try {
        const b = obj.getBoundingRect(true, true)
        if (!b) return true
        const right = b.left + b.width
        const bottom = b.top + b.height
        if (right < rect.left) return false
        if (b.left > rect.right) return false
        if (bottom < rect.top) return false
        if (b.top > rect.bottom) return false
        return true
    } catch {
        return true
    }
}

/**
 * Detecta se um objeto deve ser PULADO no viewport culling — ou seja,
 * NUNCA pode ser cullado independente de intersecao com o viewport.
 *
 * Skip em:
 *  - obj invalido (null/non-object)
 *  - filho de group (obj.group existe — controlado pelo parent)
 *  - presente em `activeSet` (selecao ativa)
 *  - em modo de edicao de texto (isEditing)
 *  - artboard-bg (background do canvas)
 *  - control-like ou transient (handles, drag guides, path nodes)
 *
 * Caller deve EXIBIR o objeto sem checar intersecao quando esta funcao
 * retorna `true`.
 */
export const shouldSkipViewportCullObject = (obj: any, activeSet: Set<any>): boolean => {
    if (!obj || typeof obj !== 'object') return true
    if (obj.group) return true
    if (activeSet.has(obj)) return true
    if (obj.isEditing) return true
    if (obj.id === 'artboard-bg') return true
    if (isControlLikeObject(obj) || isTransientCanvasObject(obj)) return true
    return false
}
