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
 *  - se ha cropX/cropY > 0 ou marker de trim (crop ativo): usa width/height correntes do
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
    const hasTrimMarker = Number(img?.__productImageTrimVersion || 0) > 0
    if (hasCrop || hasTrimMarker) {
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
    trimBounds: { left: number; top: number; width: number; height: number } | null,
    opts: { preserveVisualPosition?: boolean } = {}
): { left: number; top: number; width: number; height: number } | null => {
    if (!img || !trimBounds) return null
    const preserveVisualPosition = opts.preserveVisualPosition === true
    const oldCropX = Number(img.cropX ?? 0) || 0
    const oldCropY = Number(img.cropY ?? 0) || 0
    const oldWidth = Math.max(1, Number(img.width || 0) || 1)
    const oldHeight = Math.max(1, Number(img.height || 0) || 1)
    const oldCenterX = Number(img.left || 0)
    const oldCenterY = Number(img.top || 0)
    const originX = String(img.originX || 'left')
    const originY = String(img.originY || 'top')
    const canPreserveCenter =
        preserveVisualPosition &&
        originX === 'center' &&
        originY === 'center' &&
        Number.isFinite(oldCenterX) &&
        Number.isFinite(oldCenterY)

    img.set?.({
        cropX: trimBounds.left,
        cropY: trimBounds.top,
        width: trimBounds.width,
        height: trimBounds.height,
        dirty: true
    })
    if (canPreserveCenter) {
        // Compare source-space centers. This keeps re-trimming an already
        // cropped image idempotent instead of moving it on every pass.
        const localDx = (trimBounds.left + trimBounds.width / 2) - (oldCropX + oldWidth / 2)
        const localDy = (trimBounds.top + trimBounds.height / 2) - (oldCropY + oldHeight / 2)
        const scaleX = Number(img.scaleX ?? 1) || 1
        const scaleY = Number(img.scaleY ?? 1) || 1
        const flipX = img.flipX === true ? -1 : 1
        const flipY = img.flipY === true ? -1 : 1
        const angle = (Number(img.angle || 0) * Math.PI) / 180
        const dx = localDx * scaleX * flipX
        const dy = localDy * scaleY * flipY
        const worldDx = (dx * Math.cos(angle)) - (dy * Math.sin(angle))
        const worldDy = (dx * Math.sin(angle)) + (dy * Math.cos(angle))
        img.set?.({
            left: oldCenterX + worldDx,
            top: oldCenterY + worldDy
        })
    }
    img.setCoords?.()
    return trimBounds
}

export type ImageTrimDetectOptions = {
    alphaThreshold?: number
    padding?: number
    maxDim?: number
    colorTolerance?: number
    /**
     * Remove uma borda opaca uniforme/preta/branca somente quando isso for
     * solicitado de forma explicita. Por padrao, todo pixel opaco faz parte
     * da imagem e precisa ser preservado.
     */
    trimOpaqueBackground?: boolean
}

export type InspectedImageTrimBounds = {
    bounds: { left: number; top: number; width: number; height: number } | null
    hasContent: boolean
}

const clampNumber = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value))

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

const EMPTY_TRIM: InspectedImageTrimBounds = { bounds: null, hasContent: false }

const pixelChannelDelta = (a: number[], b: number[]): number =>
    Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!), Math.abs(a[2]! - b[2]!))

const inspectImageDataTrimBounds = (
    data: Uint8ClampedArray | Uint8Array,
    sw: number,
    sh: number,
    sourceWidth: number,
    sourceHeight: number,
    opts: ImageTrimDetectOptions = {}
): InspectedImageTrimBounds => {
    if (!data || sw < 1 || sh < 1 || sourceWidth < 2 || sourceHeight < 2) return EMPTY_TRIM
    const scaleX = sw / sourceWidth
    const scaleY = sh / sourceHeight
    const alphaThreshold = clampNumber(Math.round(Number(opts.alphaThreshold ?? 8) || 0), 0, 254)
    const padding = Math.max(0, Math.round(Number(opts.padding ?? 0) || 0))
    const colorTolerance = clampNumber(Math.round(Number(opts.colorTolerance ?? 28) || 0), 0, 255)
    const trimOpaqueBackground = opts.trimOpaqueBackground === true

    const readPixel = (x: number, y: number): number[] => {
        const i = (y * sw + x) * 4
        return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!]
    }
    const isLowAlpha = (pixel: number[]) => (pixel[3] || 0) <= alphaThreshold
    const isNearBlack = (pixel: number[]) =>
        !isLowAlpha(pixel) && (pixel[0] || 0) <= 32 && (pixel[1] || 0) <= 32 && (pixel[2] || 0) <= 32
    const isNearWhite = (pixel: number[]) =>
        !isLowAlpha(pixel) && (pixel[0] || 0) >= 223 && (pixel[1] || 0) >= 223 && (pixel[2] || 0) >= 223

    let edgeCount = 0
    let transparentEdge = 0
    let blackEdge = 0
    let whiteEdge = 0
    const tallyEdge = (x: number, y: number) => {
        const pixel = readPixel(x, y)
        edgeCount += 1
        if (isLowAlpha(pixel)) transparentEdge += 1
        else if (isNearBlack(pixel)) blackEdge += 1
        else if (isNearWhite(pixel)) whiteEdge += 1
    }
    for (let x = 0; x < sw; x++) {
        tallyEdge(x, 0)
        if (sh > 1) tallyEdge(x, sh - 1)
    }
    for (let y = 1; y < sh - 1; y++) {
        tallyEdge(0, y)
        if (sw > 1) tallyEdge(sw - 1, y)
    }
    const edgeRatio = (count: number) => (edgeCount > 0 ? count / edgeCount : 0)
    const trimBlack = trimOpaqueBackground && edgeRatio(blackEdge) >= 0.55
    const trimWhite = trimOpaqueBackground && !trimBlack && edgeRatio(whiteEdge) >= 0.55
    const corners = [
        readPixel(0, 0),
        readPixel(sw - 1, 0),
        readPixel(0, sh - 1),
        readPixel(sw - 1, sh - 1)
    ]
    const reference = corners[0]!
    const matchingCorners = corners.filter((pixel) => {
        if (isLowAlpha(pixel) && isLowAlpha(reference)) return true
        if (isLowAlpha(pixel) || isLowAlpha(reference)) return false
        return pixelChannelDelta(pixel, reference) <= colorTolerance
    }).length
    const useUniformBackground = trimOpaqueBackground
        && colorTolerance > 0
        && matchingCorners >= 3
        && !isLowAlpha(reference)

    const isBackground = (i: number) => {
        const pixel = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!]
        if (isLowAlpha(pixel)) return true
        if (trimBlack && isNearBlack(pixel)) return true
        if (trimWhite && isNearWhite(pixel)) return true
        if (!useUniformBackground) return false
        return pixelChannelDelta([pixel[0]!, pixel[1]!, pixel[2]!], reference) <= colorTolerance
    }

    let minX = sw
    let minY = sh
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const i = (y * sw + x) * 4
            if (isBackground(i)) continue
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }
    }

    if (maxX < minX || maxY < minY) return EMPTY_TRIM

    const finalLeft = Math.max(0, Math.floor(minX / scaleX) - padding)
    const finalTop = Math.max(0, Math.floor(minY / scaleY) - padding)
    const finalRight = Math.min(sourceWidth, Math.ceil((maxX + 1) / scaleX) + padding)
    const finalBottom = Math.min(sourceHeight, Math.ceil((maxY + 1) / scaleY) + padding)
    const finalWidth = Math.max(1, finalRight - finalLeft)
    const finalHeight = Math.max(1, finalBottom - finalTop)

    if (finalLeft === 0 && finalTop === 0 && finalWidth >= sourceWidth && finalHeight >= sourceHeight) {
        return { bounds: null, hasContent: true }
    }

    return {
        hasContent: true,
        bounds: {
            left: finalLeft,
            top: finalTop,
            width: finalWidth,
            height: finalHeight
        }
    }
}

const sampleElementImageData = (
    el: any,
    sourceWidth: number,
    sourceHeight: number,
    maxDim: number
): { data: Uint8ClampedArray; sw: number; sh: number } | null => {
    if (!el || typeof document === 'undefined') return null
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight))
    const sw = Math.max(1, Math.ceil(sourceWidth * scale))
    const sh = Math.max(1, Math.ceil(sourceHeight * scale))
    const oc = document.createElement('canvas')
    oc.width = sw
    oc.height = sh
    const ctx = oc.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.clearRect(0, 0, sw, sh)
    ctx.drawImage(el, 0, 0, sw, sh)
    return { data: ctx.getImageData(0, 0, sw, sh).data, sw, sh }
}

/**
 * Detecta os bounds do conteudo visivel de uma imagem Fabric.
 * Por padrao, corta apenas transparencia; pixels opacos pertencem a imagem.
 * O recorte de uma borda opaca uniforme exige `trimOpaqueBackground: true`.
 *
 * `hasContent: false` significa que os pixels ainda nao puderam ser lidos
 * (decode pendente, canvas vazio ou CORS). Nesse caso o caller NAO deve
 * marcar a imagem como ja aparada.
 */
export const inspectImageTrimBounds = (
    fabricImg: any,
    opts: ImageTrimDetectOptions = {}
): InspectedImageTrimBounds => {
    try {
        const el = fabricImg?.getElement?.() || fabricImg?._element || fabricImg?._originalElement
        if (!el) return EMPTY_TRIM
        const w = Number((el as any).naturalWidth || el.width || fabricImg.width || 0)
        const h = Number((el as any).naturalHeight || el.height || fabricImg.height || 0)
        if (!w || !h || w < 2 || h < 2) return EMPTY_TRIM
        const maxDim = clampNumber(Math.round(Number(opts.maxDim ?? 512) || 512), 64, 2048)
        const sampled = sampleElementImageData(el, w, h, maxDim)
        if (!sampled) return EMPTY_TRIM
        return inspectImageDataTrimBounds(sampled.data, sampled.sw, sampled.sh, w, h, opts)
    } catch {
        return EMPTY_TRIM
    }
}

export const detectImageTrimBounds = (
    fabricImg: any,
    opts: ImageTrimDetectOptions = {}
): { left: number; top: number; width: number; height: number } | null =>
    inspectImageTrimBounds(fabricImg, opts).bounds

const DEFAULT_AUTO_TRIM_OPTS: ImageTrimDetectOptions = {
    alphaThreshold: 8,
    padding: 0,
    colorTolerance: 28
}

const applyDetectedTrim = (
    img: any,
    inspected: InspectedImageTrimBounds,
    opts: ImageTrimDetectOptions & { preserveVisualPosition?: boolean }
): { applied: boolean; undecodable: boolean } => {
    if (!inspected.hasContent) return { applied: false, undecodable: true }
    if (!inspected.bounds) return { applied: false, undecodable: false }
    const applied = applyImageTrimBounds(img, inspected.bounds, {
        preserveVisualPosition: opts.preserveVisualPosition !== false
    })
    if (applied) {
        img.cropX = inspected.bounds.left
        img.cropY = inspected.bounds.top
        img.width = inspected.bounds.width
        img.height = inspected.bounds.height
        img.dirty = true
        img.objectCaching = false
        img.set?.({
            cropX: inspected.bounds.left,
            cropY: inspected.bounds.top,
            width: inspected.bounds.width,
            height: inspected.bounds.height,
            dirty: true,
            objectCaching: false
        })
        img.setCoords?.()
        img.canvas?.requestRenderAll?.()
    }
    return { applied: !!applied, undecodable: false }
}

export const autoTrimFabricImage = (
    img: any,
    opts: ImageTrimDetectOptions & { preserveVisualPosition?: boolean } = {}
): { applied: boolean; undecodable: boolean } => {
    if (!img || String(img.type || '').toLowerCase() !== 'image') {
        return { applied: false, undecodable: false }
    }
    const merged = { ...DEFAULT_AUTO_TRIM_OPTS, ...opts }
    return applyDetectedTrim(img, inspectImageTrimBounds(img, merged), merged)
}

export const waitForImageElementDecoded = async (el: any, timeoutMs = 4000): Promise<void> => {
    if (!el) return
    try {
        if (typeof el.decode === 'function') {
            await el.decode()
            return
        }
    } catch {
        // decode() pode rejeitar; cai para complete/onload.
    }
    if (el.complete && (el.naturalWidth || el.width)) return
    await new Promise<void>((resolve) => {
        let settled = false
        const done = () => {
            if (settled) return
            settled = true
            resolve()
        }
        try {
            el.addEventListener?.('load', done, { once: true })
            el.addEventListener?.('error', done, { once: true })
        } catch {
            done()
            return
        }
        setTimeout(done, Math.max(250, Number(timeoutMs) || 4000))
    })
}

const inspectImageTrimBoundsFromBlob = async (
    blob: Blob,
    opts: ImageTrimDetectOptions = {}
): Promise<InspectedImageTrimBounds> => {
    if (typeof createImageBitmap !== 'function') return EMPTY_TRIM
    let bitmap: ImageBitmap | null = null
    try {
        bitmap = await createImageBitmap(blob)
        const w = bitmap.width
        const h = bitmap.height
        if (!w || !h || w < 2 || h < 2) return EMPTY_TRIM
        const maxDim = clampNumber(Math.round(Number(opts.maxDim ?? 512) || 512), 64, 2048)
        const sampled = sampleElementImageData(bitmap, w, h, maxDim)
        if (!sampled) return EMPTY_TRIM
        return inspectImageDataTrimBounds(sampled.data, sampled.sw, sampled.sh, w, h, opts)
    } catch {
        return EMPTY_TRIM
    } finally {
        try { bitmap?.close() } catch { /* ignore */ }
    }
}

export const inspectImageTrimBoundsAsync = async (
    fabricImg: any,
    opts: ImageTrimDetectOptions = {}
): Promise<InspectedImageTrimBounds> => {
    const merged = { ...DEFAULT_AUTO_TRIM_OPTS, ...opts }
    const el = fabricImg?.getElement?.() || fabricImg?._element || fabricImg?._originalElement
    if (el) await waitForImageElementDecoded(el)
    const sync = inspectImageTrimBounds(fabricImg, merged)
    if (sync.hasContent || sync.bounds) return sync

    const src = String(
        (el as any)?.src
        || fabricImg?.src
        || (typeof fabricImg?.getSrc === 'function' ? fabricImg.getSrc() : '')
        || ''
    ).trim()
    if (!src || src.startsWith('data:') || typeof fetch !== 'function') return EMPTY_TRIM
    try {
        const response = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
        if (!response.ok) return EMPTY_TRIM
        const blob = await response.blob()
        if (!blob || !String(blob.type || '').startsWith('image/')) return EMPTY_TRIM
        return await inspectImageTrimBoundsFromBlob(blob, merged)
    } catch {
        return EMPTY_TRIM
    }
}

export const autoTrimFabricImageAsync = async (
    img: any,
    opts: ImageTrimDetectOptions & { preserveVisualPosition?: boolean } = {}
): Promise<{ applied: boolean; undecodable: boolean }> => {
    if (!img || String(img.type || '').toLowerCase() !== 'image') {
        return { applied: false, undecodable: false }
    }
    const merged = { ...DEFAULT_AUTO_TRIM_OPTS, ...opts }
    const inspected = await inspectImageTrimBoundsAsync(img, merged)
    return applyDetectedTrim(img, inspected, merged)
}

export const trimImageFile = async (
    file: File,
    opts: ImageTrimDetectOptions = {}
): Promise<File> => {
    if (!file || !String(file.type || '').startsWith('image/') || typeof document === 'undefined') {
        return file
    }
    const merged = { ...DEFAULT_AUTO_TRIM_OPTS, ...opts }
    const objectUrl = URL.createObjectURL(file)
    try {
        const image = new window.Image()
        image.src = objectUrl
        await waitForImageElementDecoded(image)
        const dummy = {
            type: 'image',
            getElement: () => image,
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height
        }
        const inspected = inspectImageTrimBounds(dummy, merged)
        if (!inspected.bounds) return file
        const output = document.createElement('canvas')
        output.width = Math.max(1, Math.round(inspected.bounds.width))
        output.height = Math.max(1, Math.round(inspected.bounds.height))
        const context = output.getContext('2d')
        if (!context) return file
        context.clearRect(0, 0, output.width, output.height)
        context.drawImage(
            image,
            inspected.bounds.left,
            inspected.bounds.top,
            inspected.bounds.width,
            inspected.bounds.height,
            0,
            0,
            output.width,
            output.height
        )
        const blob = await new Promise<Blob | null>((resolve) => {
            output.toBlob((next) => resolve(next), 'image/png')
        })
        if (!blob) return file
        const baseName = String(file.name || 'imagem').replace(/\.[^.]+$/, '') || 'imagem'
        return new File([blob], `${baseName}.png`, { type: 'image/png' })
    } catch {
        return file
    } finally {
        try { URL.revokeObjectURL(objectUrl) } catch { /* ignore */ }
    }
}

export const fetchAndTrimImageFile = async (
    source: string,
    opts: ImageTrimDetectOptions = {}
): Promise<File | null> => {
    const src = String(source || '').trim()
    if (!src || typeof fetch !== 'function') return null
    try {
        const response = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
        if (!response.ok) return null
        const blob = await response.blob()
        if (!blob || blob.size < 8) return null
        const type = String(blob.type || 'image/png').toLowerCase()
        if (!type.startsWith('image/') || type.includes('svg')) return null
        const file = new File([blob], 'asset.png', { type: type || 'image/png' })
        const trimmed = await trimImageFile(file, opts)
        if (trimmed === file) return null
        return trimmed
    } catch {
        return null
    }
}

export const waitForFabricImagesDecoded = async (root: any, timeoutMs = 4000): Promise<void> => {
    if (!root) return
    const elements: any[] = []
    const seenEls = new Set<any>()
    const seenObjs = new Set<any>()
    const visit = (obj: any) => {
        if (!obj || seenObjs.has(obj)) return
        seenObjs.add(obj)
        if (String(obj.type || '').toLowerCase() === 'image') {
            const el = obj.getElement?.() || obj._element || obj._originalElement
            if (el && !seenEls.has(el)) {
                seenEls.add(el)
                elements.push(el)
            }
        }
        if (typeof obj.getObjects === 'function') {
            (obj.getObjects() || []).forEach(visit)
        }
    }
    visit(root)
    if (!elements.length) return
    await Promise.all(elements.map((el) => waitForImageElementDecoded(el, timeoutMs)))
}

/**
 * Cria uma versao PNG aparada pelo alpha visivel de uma imagem raster.
 *
 * Usado nas previsualizacoes HTML que nao passam por um fabric.Image
 * (por exemplo, a imagem de referencia da configuracao dos cards). Em
 * imagens cross-origin sem CORS ou em fontes opacas, retorna a origem sem
 * alterar o asset.
 */
export const trimImageSourceToDataUrl = async (
    source: string,
    opts: ImageTrimDetectOptions = {}
): Promise<string> => {
    const normalizedSource = String(source || '').trim()
    if (!normalizedSource || typeof window === 'undefined' || typeof document === 'undefined') {
        return normalizedSource
    }

    return await new Promise<string>((resolve) => {
        const image = new window.Image()
        image.crossOrigin = 'anonymous'

        const finish = (value: string) => {
            image.onload = null
            image.onerror = null
            resolve(value)
        }

        image.onload = () => {
            try {
                const width = Number(image.naturalWidth || image.width || 0)
                const height = Number(image.naturalHeight || image.height || 0)
                if (width < 2 || height < 2) {
                    finish(normalizedSource)
                    return
                }

                const bounds = detectImageTrimBounds({
                    getElement: () => image,
                    width,
                    height
                }, opts)
                if (!bounds) {
                    finish(normalizedSource)
                    return
                }

                const output = document.createElement('canvas')
                output.width = Math.max(1, Math.round(bounds.width))
                output.height = Math.max(1, Math.round(bounds.height))
                const context = output.getContext('2d')
                if (!context) {
                    finish(normalizedSource)
                    return
                }

                context.clearRect(0, 0, output.width, output.height)
                context.drawImage(
                    image,
                    bounds.left,
                    bounds.top,
                    bounds.width,
                    bounds.height,
                    0,
                    0,
                    output.width,
                    output.height
                )
                finish(output.toDataURL('image/png'))
            } catch {
                finish(normalizedSource)
            }
        }
        image.onerror = () => finish(normalizedSource)
        image.src = normalizedSource
    })
}
