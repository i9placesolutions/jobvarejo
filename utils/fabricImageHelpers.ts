/**
 * Helpers puros relacionados a imagens em groups Fabric.
 *
 * Operam apenas no objeto duck-typed (precisam de getObjects/getElement,
 * crop/width/height/type/name). Sem dependencia de canvas, refs reativos
 * ou estado global.
 *
 * Cobertura: tests/utils/fabricImageHelpers.test.ts
 */

/**
 * Encontra a primeira imagem dentro de uma selecao Fabric (objeto unico
 * ou activeSelection/group). Retorna a imagem + parent quando aplicavel.
 *
 *  - Se obj e' image: retorna { img: obj, parent: null }
 *  - Se obj e' group/activeSelection com imagem dentro: retorna
 *    { img, parent: obj }
 *  - Caso contrario: null
 */
export const findImageTargetInSelection = (obj: any): { img: any; parent: any | null } | null => {
    if (!obj) return null
    const t = String(obj.type || '').toLowerCase()
    if (t === 'image') return { img: obj, parent: null }
    if (t === 'group' || t === 'activeselection') {
        const list = typeof obj.getObjects === 'function' ? obj.getObjects() : []
        const img = (list || []).find((o: any) => String(o?.type || '').toLowerCase() === 'image')
        return img ? { img, parent: obj } : null
    }
    return null
}

/**
 * Busca a imagem "preferida" dentro de um group (tipicamente um card
 * de produto). Prioriza nomes conhecidos do engine (smart_image,
 * product_image, productImage) e cai para a primeira imagem qualquer.
 *
 * Retorna null se group nao for groupable ou nao contiver imagens.
 */
export const getPreferredProductImageFromGroup = (group: any): any | null => {
    if (!group || typeof group.getObjects !== 'function') return null
    const list = group.getObjects() || []
    const preferred = list.find((o: any) => {
        if (String(o?.type || '').toLowerCase() !== 'image') return false
        const n = String(o?.name || '').trim()
        return n === 'smart_image' || n === 'product_image' || n === 'productImage'
    })
    if (preferred) return preferred
    return list.find((o: any) => String(o?.type || '').toLowerCase() === 'image') || null
}

/**
 * Extrai a URL de origem de uma fabric.Image, tentando 3 caminhos:
 *  1. `img.src` direto (mais comum)
 *  2. `img.getSrc()` (Fabric API oficial)
 *  3. `img._element.src` (HTMLImageElement subjacente)
 *
 * Retorna string vazia quando nada disponivel.
 */
export const getImageSourceFromObject = (img: any): string => {
    const direct = String((img as any)?.src || '').trim()
    if (direct) return direct
    const fromGetter = typeof (img as any)?.getSrc === 'function'
        ? String((img as any).getSrc() || '').trim()
        : ''
    if (fromGetter) return fromGetter
    const fromEl = String((img as any)?._element?.src || '').trim()
    return fromEl
}

/**
 * Calcula dimensoes "uteis" de uma imagem Fabric considerando se ja
 * existe um crop aplicado:
 *  - se ha cropX/cropY > 0 (crop ativo): usa width/height correntes do
 *    objeto (que ja' refletem a area visivel pos-crop)
 *  - senao: cai para naturalWidth/naturalHeight da `getElement()` quando
 *    disponivel (HTMLImageElement subjacente), com fallback para width
 *    /height correntes
 *
 * Sempre retorna numeros >= 1 para evitar divisao por zero em downstream
 * (ex: fitProductImageIntoSlot).
 */
export const getImageTrimmedDimensions = (img: any): { width: number; height: number } => {
    const currentWidth = Math.max(1, Number(img?.width || 0) || 1)
    const currentHeight = Math.max(1, Number(img?.height || 0) || 1)
    const hasCrop = Number(img?.cropX ?? 0) > 0 || Number(img?.cropY ?? 0) > 0
    if (hasCrop) {
        return { width: currentWidth, height: currentHeight }
    }
    const naturalWidth = Math.max(1, Number(img?.getElement?.()?.naturalWidth || 0) || currentWidth)
    const naturalHeight = Math.max(1, Number(img?.getElement?.()?.naturalHeight || 0) || currentHeight)
    return { width: naturalWidth, height: naturalHeight }
}

/**
 * Aplica trim bounds (detectImageTrimBounds resultado) a uma imagem Fabric:
 *  - cropX/cropY: posicao do crop dentro da textura
 *  - width/height: dimensoes do crop
 *  - dirty=true para forcar re-render
 *
 * Mutativo. No-op silencioso se img null ou trimBounds null.
 */
export const applyImageTrimBounds = (
    img: any,
    trimBounds: { left: number; top: number; width: number; height: number } | null
): { left: number; top: number; width: number; height: number } | null => {
    if (!img || !trimBounds) return null
    img.set?.({
        cropX: trimBounds.left,
        cropY: trimBounds.top,
        width: trimBounds.width,
        height: trimBounds.height,
        dirty: true
    })
    return trimBounds
}

/**
 * Encaixa uma imagem dentro de um slot retangular (proporcional, sem
 * deformar). Calcula a escala necessaria para que a imagem caiba no
 * slot mantendo aspect ratio (clampada em opts.maxScale, default 3).
 *
 * Le getImageTrimmedDimensions(img) para considerar crop ja aplicado.
 * Posiciona em slot.left/top com originX/Y configuraveis (default
 * center/center). Tambem aplica defaults seguros: visible=true,
 * opacity=1, lock flips/skews para evitar drift visual.
 *
 * Mutativo. No-op se img null.
 */
export const fitImageIntoSlot = (
    img: any,
    slot: {
        width?: number
        height?: number
        left?: number
        top?: number
        originX?: string
        originY?: string
        name?: string
    },
    opts: { maxScale?: number } = {}
): void => {
    if (!img) return
    const slotWidth = Math.max(1, Number(slot?.width || 0) || 1)
    const slotHeight = Math.max(1, Number(slot?.height || 0) || 1)
    const trimmed = getImageTrimmedDimensions(img)
    const scale = Math.min(
        slotWidth / trimmed.width,
        slotHeight / trimmed.height,
        Math.max(1, Number(opts.maxScale ?? 3) || 3)
    )

    img.set?.({
        scaleX: scale,
        scaleY: scale,
        originX: slot?.originX || 'center',
        originY: slot?.originY || 'center',
        left: Number(slot?.left || 0),
        top: Number(slot?.top || 0),
        name: slot?.name || 'smart_image',
        visible: true,
        opacity: 1,
        lockScalingFlip: true,
        lockSkewingX: true,
        lockSkewingY: true,
        dirty: true
    })
    img.setCoords?.()
}

/**
 * Detecta se uma imagem (HTMLImageElement ou HTMLCanvasElement) tem
 * algum pixel transparente (alpha < 250). Usa sampling reduzida (256px
 * max) para performance.
 *
 * Retorna false em caso de erro ou imagem invalida.
 */
export const imageHasTransparency = (img: HTMLImageElement | HTMLCanvasElement): boolean => {
    try {
        const oc = document.createElement('canvas')
        const w = (img as any).naturalWidth || img.width
        const h = (img as any).naturalHeight || img.height
        if (!w || !h) return false
        const maxDim = 256
        const scale = Math.min(1, maxDim / Math.max(w, h))
        oc.width = Math.ceil(w * scale)
        oc.height = Math.ceil(h * scale)
        const octx = oc.getContext('2d', { willReadFrequently: true })
        if (!octx) return false
        octx.drawImage(img, 0, 0, oc.width, oc.height)
        const data = octx.getImageData(0, 0, oc.width, oc.height).data
        for (let i = 3; i < data.length; i += 4) {
            if (data[i]! < 250) return true
        }
        return false
    } catch { return false }
}

/**
 * Detecta os bounds do conteudo visivel de uma imagem Fabric (alpha > 0),
 * cortando whitespace e transparencia.
 *
 * Retorna `{ left, top, width, height }` em pixels da imagem original
 * (nao samplada). Retorna null se:
 *  - imagem nao tem element
 *  - dimensoes < 2px
 *  - contexto 2d nao disponivel
 *  - bounds detectados cobrem a imagem inteira (no-op)
 *
 * Usa sampling 512px max para performance.
 */
export const detectImageTrimBounds = (
    fabricImg: any
): { left: number; top: number; width: number; height: number } | null => {
    try {
        const el = fabricImg?.getElement?.() || fabricImg?._element
        if (!el) return null
        const w = (el as any).naturalWidth || el.width || fabricImg.width
        const h = (el as any).naturalHeight || el.height || fabricImg.height
        if (!w || !h || w < 2 || h < 2) return null

        const maxDim = 512
        const scale = Math.min(1, maxDim / Math.max(w, h))
        const sw = Math.max(1, Math.ceil(w * scale))
        const sh = Math.max(1, Math.ceil(h * scale))

        const oc = document.createElement('canvas')
        oc.width = sw
        oc.height = sh
        const ctx = oc.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null

        ctx.clearRect(0, 0, sw, sh)
        ctx.drawImage(el, 0, 0, sw, sh)
        const data = ctx.getImageData(0, 0, sw, sh).data

        const isContent = (i: number) => data[i + 3]! > 0

        let minX = sw
        let minY = sh
        let maxX = -1
        let maxY = -1
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const i = (y * sw + x) * 4
                if (!isContent(i)) continue
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
            }
        }

        if (maxX < minX || maxY < minY) return null

        const finalLeft = Math.max(0, Math.floor(minX / scale))
        const finalTop = Math.max(0, Math.floor(minY / scale))
        const finalRight = Math.min(w, Math.ceil((maxX + 1) / scale))
        const finalBottom = Math.min(h, Math.ceil((maxY + 1) / scale))
        const finalWidth = Math.max(1, finalRight - finalLeft)
        const finalHeight = Math.max(1, finalBottom - finalTop)

        if (finalLeft === 0 && finalTop === 0 && finalWidth >= w && finalHeight >= h) {
            return null
        }

        return {
            left: finalLeft,
            top: finalTop,
            width: finalWidth,
            height: finalHeight
        }
    } catch {
        return null
    }
}
