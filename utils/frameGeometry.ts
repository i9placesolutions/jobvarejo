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
import { makeId } from './makeId'

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

export type ViewportSignatureInput = {
    viewportTransform: number[]
    width: number
    height: number
    zoom: number
}

/**
 * Constroi assinatura de viewport para deteccao de mudancas relevantes
 * que requerem re-render dos labels de frame. Combina os 6 valores do
 * viewportTransform + zoom + width + height em string estavel.
 *
 * Cada valor passa por `serializeFrameLabelMetric` (3 casas, fallback 0).
 * Mudancas sub-pixel sao ignoradas — render so ocorre quando ha
 * diferenca real perceptivel.
 */
export const buildFrameLabelViewportSignature = (input: ViewportSignatureInput): string => {
    const vpt = input.viewportTransform || [1, 0, 0, 1, 0, 0]
    const width = Number(input.width) || 0
    const height = Number(input.height) || 0
    const zoom = Number(input.zoom) || 1
    return [
        serializeFrameLabelMetric(vpt[0]),
        serializeFrameLabelMetric(vpt[1]),
        serializeFrameLabelMetric(vpt[2]),
        serializeFrameLabelMetric(vpt[3]),
        serializeFrameLabelMetric(vpt[4]),
        serializeFrameLabelMetric(vpt[5]),
        serializeFrameLabelMetric(zoom),
        String(width),
        String(height)
    ].join('|')
}

/**
 * Constroi assinatura da selecao para deteccao de mudancas relevantes.
 *
 *  - sem selecao → 'selection:none'
 *  - activeSelection → 'selection:multi:<ids ordenados>'
 *  - objeto unico → 'selection:<type>:<id>:<frame|object>'
 *
 * Recebe o objeto ativo ja resolvido (caller obtem de canvas.getActiveObject()).
 */
export const buildFrameLabelSelectionSignature = (active: any): string => {
    if (!active) return 'selection:none'
    if (active.type === 'activeSelection' && typeof active.getObjects === 'function') {
        const ids = (active.getObjects() || [])
            .map((entry: any) => String(entry?._customId || entry?.id || ''))
            .filter(Boolean)
            .sort()
        return ids.length ? `selection:multi:${ids.join(',')}` : 'selection:multi:none'
    }
    const id = String(active?._customId || active?.id || '')
    return `selection:${String(active?.type || 'unknown')}:${id}:${active?.isFrame ? 'frame' : 'object'}`
}

/**
 * Serializa uma metrica numerica de frame label (viewport transform,
 * zoom, dimensoes) para string com 3 casas decimais. Retorna '0'
 * para valores nao-finitos.
 *
 * Usado para gerar "fingerprint" estavel de viewport e detectar
 * mudancas que requerem re-render dos labels de frame.
 */
export const serializeFrameLabelMetric = (value: any): string => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '0'
    return numeric.toFixed(3)
}

/**
 * Gera nome amigavel para frame em export. Prioridade:
 *  1. layerName especifico (NAO generico tipo "FRAME"/"FRAMER N")
 *  2. runtime name (se diferente)
 *  3. layerName generico
 *  4. fallback "Frame N+1"
 */
export const getFrameDisplayNameForExport = (frame: any, index: number): string => {
    const layerName = String(frame?.layerName || '').trim()
    const runtimeName = String(frame?.name || '').trim()
    const isGenericLayerName =
        !layerName ||
        /^FRAMER(?:\s+\d+)?$/i.test(layerName) ||
        /^FRAME(?:\s+\d+)?$/i.test(layerName)

    if (!isGenericLayerName) return layerName
    if (runtimeName) return runtimeName
    if (layerName) return layerName
    return `Frame ${index + 1}`
}

/**
 * Gap default em pixels entre frames quando geramos um novo frame
 * proximo a um frame de referencia. Mantem visual de "pagina" separada.
 */
export const FRAME_SPAWN_GAP = 48

/**
 * Calcula posicao de spawn (centro) para um novo frame, posicionando-o
 * a direita do frame de referencia. Quando nao ha referencia disponivel,
 * cai no centro do nextFrame (left=width/2, top=height/2).
 */
export const getFrameSpawnPosition = (
    referenceFrame: any,
    nextFrameWidth: number,
    nextFrameHeight: number
): { left: number; top: number } => {
    const fallback = {
        left: nextFrameWidth / 2,
        top: nextFrameHeight / 2
    }
    const bounds = getFrameBounds(referenceFrame)
    if (!bounds) return fallback

    return {
        left: bounds.left + bounds.width + FRAME_SPAWN_GAP + nextFrameWidth / 2,
        top: bounds.top + bounds.height / 2
    }
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

/**
 * Estrutura de um label de frame renderizado (badge de nome + dimensoes
 * sobre o frame). Coordenadas ja em screen space (apos transformPoint).
 */
export type FrameLabel = {
    id: string
    name: string
    x: number
    y: number
    dimX: number
    dimY: number
    dims: string
    isSelected: boolean
    frameRef: any
}

export type ComputeFrameLabelsInput = {
    frames: ReadonlyArray<any>
    viewportTransform: number[]
    viewportBounds: { left: number; top: number; right: number; bottom: number } | null
    zoom: number
    activeObj: any | null
    transformPoint: (p: { x: number; y: number }, m: number[]) => { x: number; y: number }
    formatDimension: (n: number) => string
}

/**
 * Calcula as labels de frames a partir dos dados pre-resolvidos
 * pelo caller. Pure: nao acessa canvas/refs/fabric global.
 *
 * Para cada frame visivel:
 *  - skip se invisivel
 *  - skip se totalmente fora do viewport (com margem worldMargin)
 *  - posiciona badge de nome em top-left (clampado em x>=4, y>=4)
 *  - posiciona badge de dimensoes em center-bottom
 *  - dims formatado como "WxH" via formatDimension callback
 *
 * worldMargin: margem em pixels do mundo (default Math.max(48, 140/zoom))
 * para nao culling de frames quase no viewport.
 *
 * Try/catch absorve erros em frames com getBoundingRect quebrado.
 */
export const computeFrameLabels = (input: ComputeFrameLabelsInput): FrameLabel[] => {
    const {
        frames,
        viewportTransform,
        viewportBounds,
        zoom,
        activeObj,
        transformPoint,
        formatDimension
    } = input
    const worldMargin = Math.max(48, 140 / Math.max(zoom, 0.01))
    const labels: FrameLabel[] = []
    for (const frame of (frames || [])) {
        if (frame?.visible === false) continue
        try {
            const bounds = typeof frame.getBoundingRect === 'function'
                ? frame.getBoundingRect(true, true)
                : null
            if (!bounds) continue
            if (viewportBounds) {
                const boundsRight = Number(bounds.left || 0) + Number(bounds.width || 0)
                const boundsBottom = Number(bounds.top || 0) + Number(bounds.height || 0)
                if (
                    boundsRight < viewportBounds.left - worldMargin ||
                    Number(bounds.left || 0) > viewportBounds.right + worldMargin ||
                    boundsBottom < viewportBounds.top - worldMargin ||
                    Number(bounds.top || 0) > viewportBounds.bottom + worldMargin
                ) {
                    continue
                }
            }
            const pTl = transformPoint({ x: bounds.left, y: bounds.top }, viewportTransform)
            const w = Number(frame.width || 0) * Number(frame.scaleX || 1)
            const h = Number(frame.height || 0) * Number(frame.scaleY || 1)
            const center = typeof frame.getCenterPoint === 'function' ? frame.getCenterPoint() : null
            if (!center) continue
            const pBc = transformPoint({ x: center.x, y: center.y + (h / 2) }, viewportTransform)
            labels.push({
                id: frame._customId || '',
                name: (frame.layerName || frame.name || 'Frame').toString(),
                x: Math.max(4, pTl.x),
                y: Math.max(4, pTl.y - 22),
                dimX: pBc.x,
                dimY: pBc.y + 8,
                dims: `${formatDimension(w)} × ${formatDimension(h)}`,
                isSelected: activeObj === frame,
                frameRef: frame
            })
        } catch {
            // skip invalid frame
        }
    }
    return labels
}

/**
 * Resultado de prepareJsonObjectsForLazyFrameLoad: contem o JSON
 * preparado (subset de objects) + um Map de filhos diferidos (por
 * frameId) para criacao posterior quando o frame ficar visivel.
 */
export type PrepareJsonForLazyFrameLoadResult = {
    objects: any[]
    deferredByFrameId: Map<string, any[]>
    totalDeferred: number
    invisibleFrameCount: number
}

/**
 * Pre-processa o array de `objects` de um canvas JSON antes do load:
 * detecta frames com visible=false (e filhos de frames invisíveis,
 * via BFS) e separa os children em um Map `deferredByFrameId` para
 * criacao tardia (quando o usuario ligar a visibilidade do frame).
 *
 * Reduz drasticamente o tempo de carregamento em projetos grandes
 * com muitas paginas/frames ocultos.
 *
 * Pure: nao muta o array de input. O Map retornado e novo.
 */
export const prepareJsonObjectsForLazyFrameLoad = (
    objects: ReadonlyArray<any>
): PrepareJsonForLazyFrameLoadResult => {
    const deferredByFrameId = new Map<string, any[]>()
    if (!Array.isArray(objects) || objects.length === 0) {
        return { objects: [], deferredByFrameId, totalDeferred: 0, invisibleFrameCount: 0 }
    }

    const invisibleFrameIds = new Set<string>()
    for (const obj of objects) {
        if (obj?.isFrame && obj.visible === false) {
            const id = String(obj._customId || obj.customId || '').trim()
            if (id) invisibleFrameIds.add(id)
        }
    }
    if (invisibleFrameIds.size === 0) {
        return {
            objects: objects.slice(),
            deferredByFrameId,
            totalDeferred: 0,
            invisibleFrameCount: 0
        }
    }

    let changed = true
    while (changed) {
        changed = false
        for (const obj of objects) {
            if (!obj?.isFrame) continue
            const id = String(obj._customId || obj.customId || '').trim()
            const parentId = String(obj.parentFrameId || '').trim()
            if (id && !invisibleFrameIds.has(id) && parentId && invisibleFrameIds.has(parentId)) {
                invisibleFrameIds.add(id)
                changed = true
            }
        }
    }

    const kept: any[] = []
    for (const obj of objects) {
        const parentId = String(obj?.parentFrameId || '').trim()
        if (parentId && invisibleFrameIds.has(parentId)) {
            if (!deferredByFrameId.has(parentId)) deferredByFrameId.set(parentId, [])
            deferredByFrameId.get(parentId)!.push(obj)
        } else {
            kept.push(obj)
        }
    }

    return {
        objects: kept,
        deferredByFrameId,
        totalDeferred: objects.length - kept.length,
        invisibleFrameCount: invisibleFrameIds.size
    }
}

/**
 * Encontra o frame mais "interno" (menor area) que contem o objeto
 * `obj` na lista `frames`. Pure: dado obj + frames + thresholds.
 *
 * Regras de match:
 *  - obj.isFrame: frames nao podem aninhar — retorna null
 *  - center inside frame bbox → match
 *  - overlap >= minOverlapRatio do area do obj → match (fallback)
 *
 * Quando ha multiplos frames-hit, escolhe o de menor area (frame mais
 * interno em aninhamento).
 *
 * minOverlapRatio default 0.6.
 */
export const findFrameUnderObjectInList = (
    obj: any,
    frames: any[],
    minOverlapRatio: number = 0.6
): any | null => {
    if (!obj) return null
    if (obj.isFrame) return null
    if (!Array.isArray(frames) || !frames.length) return null

    const objBounds = typeof obj.getBoundingRect === 'function' ? obj.getBoundingRect(true) : null
    const objArea = objBounds ? Math.max(1, objBounds.width * objBounds.height) : 1
    const center = typeof obj.getCenterPoint === 'function'
        ? obj.getCenterPoint()
        : (objBounds ? { x: objBounds.left + (objBounds.width / 2), y: objBounds.top + (objBounds.height / 2) } : null)

    const hits = frames.filter((f: any) => {
        if (f === obj) return false
        const fb = typeof f.getBoundingRect === 'function' ? f.getBoundingRect(true) : null
        if (!fb) return false

        const centerInside = !!(center &&
            center.x >= fb.left &&
            center.x <= (fb.left + fb.width) &&
            center.y >= fb.top &&
            center.y <= (fb.top + fb.height))
        if (centerInside) return true

        if (!objBounds) return false
        const ix = Math.max(0, Math.min(objBounds.left + objBounds.width, fb.left + fb.width) - Math.max(objBounds.left, fb.left))
        const iy = Math.max(0, Math.min(objBounds.top + objBounds.height, fb.top + fb.height) - Math.max(objBounds.top, fb.top))
        const overlapArea = ix * iy
        const overlapRatio = overlapArea / objArea
        return overlapRatio >= minOverlapRatio
    })

    if (!hits.length) return null

    hits.sort((a: any, b: any) => {
        const aw = typeof a.getScaledWidth === 'function' ? Number(a.getScaledWidth()) : Number(a.width || 0)
        const ah = typeof a.getScaledHeight === 'function' ? Number(a.getScaledHeight()) : Number(a.height || 0)
        const bw = typeof b.getScaledWidth === 'function' ? Number(b.getScaledWidth()) : Number(b.width || 0)
        const bh = typeof b.getScaledHeight === 'function' ? Number(b.getScaledHeight()) : Number(b.height || 0)
        return (aw * ah) - (bw * bh)
    })
    return hits[0]
}

/**
 * Normaliza props de runtime de um objeto Frame: garante _customId,
 * isFrame=true, clipContent boolean (default true) e layerName.
 *
 * Mutativo. Retorna o proprio obj se ele e' frame-like (apos normalizar);
 * null caso contrario. Pure no sentido de nao acessar canvas/refs.
 *
 * Util na carga inicial do canvas para garantir que frames serializados
 * sem flags voltem ao estado canonico.
 */
export const normalizeFrameRuntimeProps = (obj: any): any | null => {
    if (!obj || !isFrameLikeObject(obj)) return null
    if (!obj._customId) obj._customId = makeId()
    if (!obj.isFrame) obj.isFrame = true
    if (typeof obj.clipContent !== 'boolean') obj.clipContent = true
    if (!obj.layerName) obj.layerName = 'FRAMER'
    return obj
}
