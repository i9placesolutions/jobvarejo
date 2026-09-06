/**
 * Gerador puro de outline de "sticker" (contorno suave) para uma imagem.
 * Aplica supersampling 2x e EDT (Euclidean Distance Transform) para
 * produzir uma base continua com bordas anti-aliased.
 *
 * Apenas DOM-canvas (sem deps de Fabric/refs/state). Por usar
 * `document.createElement('canvas')`, testes precisam de jsdom env.
 *
 * Cobertura: tests/utils/stickerOutline.test.ts
 */

export type StickerOutlineMode = 'outside' | 'inside'

export type StickerOutlineSourceRect = {
    left?: number
    top?: number
    width?: number
    height?: number
}

/**
 * Retorna a regiao transparente que realmente esta conectada as bordas da
 * mascara. Pixels transparentes cercados pela arte nao fazem parte do fundo
 * externo e podem ser preenchidos sem criar um segundo contorno.
 *
 * A funcao e' intencionalmente pura para poder ser coberta sem depender de
 * canvas/DOM.
 */
export const floodExteriorMask = (
    barrier: Uint8Array,
    width: number,
    height: number
): Uint8Array<ArrayBuffer> => {
    const w = Math.floor(Number(width))
    const h = Math.floor(Number(height))
    const size = w > 0 && h > 0 ? w * h : 0
    const exterior = new Uint8Array(size)
    if (!size || barrier.length < size) return exterior

    const queue = new Int32Array(size)
    let qh = 0
    let qt = 0
    const tryEnqueue = (idx: number) => {
        if (idx < 0 || idx >= size || exterior[idx] || barrier[idx]) return
        exterior[idx] = 1
        queue[qt++] = idx
    }

    for (let x = 0; x < w; x++) {
        tryEnqueue(x)
        tryEnqueue((h - 1) * w + x)
    }
    for (let y = 1; y < h - 1; y++) {
        tryEnqueue(y * w)
        tryEnqueue(y * w + w - 1)
    }

    while (qh < qt) {
        const idx = queue[qh++]!
        const x = idx % w
        const y = (idx / w) | 0
        if (x > 0) tryEnqueue(idx - 1)
        if (x < w - 1) tryEnqueue(idx + 1)
        if (y > 0) tryEnqueue(idx - w)
        if (y < h - 1) tryEnqueue(idx + w)
    }

    return exterior
}

/** Preenche apenas os vazios fechados de uma mascara binaria. */
export const fillMaskHoles = (
    mask: Uint8Array,
    width: number,
    height: number
): Uint8Array<ArrayBuffer> => {
    const w = Math.floor(Number(width))
    const h = Math.floor(Number(height))
    const size = w > 0 && h > 0 ? w * h : 0
    const result = new Uint8Array(size)
    if (!size || mask.length < size) return result

    result.set(mask.subarray(0, size))
    const exterior = floodExteriorMask(result, w, h)
    for (let i = 0; i < size; i++) {
        if (!result[i] && !exterior[i]) result[i] = 1
    }
    return result
}

/** Cobertura continua do adesivo, com antialias apenas na borda externa. */
export const createStickerCoverage = (
    mask: Uint8Array,
    distanceSq: ArrayLike<number>,
    width: number,
    height: number,
    radius: number,
    antialias: number,
    mode: StickerOutlineMode = 'outside'
): Float32Array => {
    const size = mask.length
    const coverage = new Float32Array(size)
    const expanded = new Uint8Array(size)
    const feather = Math.max(1, antialias)
    for (let i = 0; i < size; i++) {
        if (mode === 'inside' && !mask[i]) continue
        // Distancia entre centros: meia celula aproxima a borda do pixel.
        const distance = Math.max(0, Math.sqrt(distanceSq[i]!) - 0.5)
        const alpha = Math.max(0, Math.min(1, (radius + feather / 2 - distance) / feather))
        coverage[i] = mode === 'outside' && mask[i] ? 1 : alpha
        if (coverage[i]! >= 0.5) expanded[i] = 1
    }
    if (mode === 'outside') {
        const filled = fillMaskHoles(expanded, width, height)
        for (let i = 0; i < size; i++) {
            if (filled[i]) coverage[i] = 1
        }
    }
    return coverage
}

/**
 * Gera um canvas com o outline de uma imagem. Retorna null em casos
 * degenerados (imagem nao-pronta, dimensoes zero, contexto 2d nao
 * disponivel, etc).
 *
 *  - `outlineMode='outside'`: o outline e' desenhado FORA de uma silhueta
 *    externa unica. Vazios fechados sao preenchidos e pequenas separacoes
 *    entre partes da mesma marca sao unidas para evitar contornos picotados
 *    em letras e detalhes do logo.
 *  - `outlineMode='inside'`: o outline e' desenhado DENTRO da silhueta
 *
 * O canvas retornado tem 3 propriedades extras anexadas:
 *  - `__outlinePad` = padding usado para acomodar o outline
 *  - `__outlineSrcW` / `__outlineSrcH` = dimensoes da imagem fonte
 *
 * Esses valores sao usados pelo render patch do Fabric para alinhar
 * o outline pixel-perfeito.
 */
export const generateStickerOutlineCanvas = (
    img: HTMLImageElement | HTMLCanvasElement,
    outlineWidth: number,
    outlineColor: string,
    outlineOpacity: number,
    outlineMode: StickerOutlineMode = 'outside',
    sourceRect?: StickerOutlineSourceRect
): HTMLCanvasElement | null => {
    try {
        if (img && (img as any).tagName === 'IMG') {
            const im = img as HTMLImageElement
            if (!im.complete || (im.naturalWidth || 0) <= 0 || (im.naturalHeight || 0) <= 0) {
                return null
            }
        }

        const elementW = Number((img as any).naturalWidth || img.width || 0)
        const elementH = Number((img as any).naturalHeight || img.height || 0)
        const cropLeft = Math.max(0, Number(sourceRect?.left ?? 0) || 0)
        const cropTop = Math.max(0, Number(sourceRect?.top ?? 0) || 0)
        const availableW = Math.max(1, elementW - cropLeft)
        const availableH = Math.max(1, elementH - cropTop)
        const requestedW = Number(sourceRect?.width)
        const requestedH = Number(sourceRect?.height)
        const srcW = Math.max(1, Math.min(
            availableW,
            Number.isFinite(requestedW) && requestedW > 0 ? requestedW : availableW
        ))
        const srcH = Math.max(1, Math.min(
            availableH,
            Number.isFinite(requestedH) && requestedH > 0 ? requestedH : availableH
        ))
        if (elementW <= 0 || elementH <= 0 || cropLeft >= elementW || cropTop >= elementH || !Number.isFinite(outlineWidth) || outlineWidth <= 0) return null

        let source = img
        const isFullSource = cropLeft === 0 && cropTop === 0 && srcW === elementW && srcH === elementH
        if (!isFullSource) {
            const croppedCanvas = document.createElement('canvas')
            croppedCanvas.width = Math.max(1, Math.round(srcW))
            croppedCanvas.height = Math.max(1, Math.round(srcH))
            const croppedCtx = croppedCanvas.getContext('2d')
            if (!croppedCtx) return null
            croppedCtx.clearRect(0, 0, croppedCanvas.width, croppedCanvas.height)
            croppedCtx.imageSmoothingEnabled = true
            croppedCtx.imageSmoothingQuality = 'high'
            croppedCtx.drawImage(
                img,
                cropLeft,
                cropTop,
                srcW,
                srcH,
                0,
                0,
                croppedCanvas.width,
                croppedCanvas.height
            )
            source = croppedCanvas
        }

        // Padding em pixels inteiros antes do supersampling: o recorte e a
        // borda usam exatamente a mesma escala, sem deslocamento ao reduzir.
        const finalPad = Math.ceil(outlineWidth + 2)
        const rasterW = Math.ceil(srcW)
        const rasterH = Math.ceil(srcH)
        const ssScale = (rasterW + 2 * finalPad) * (rasterH + 2 * finalPad) * 4 > 16_000_000 ? 1 : 2
        const finalSsW = rasterW * ssScale
        const finalSsH = rasterH * ssScale
        const padSs = finalPad * ssScale
        const wScaled = outlineWidth * ssScale
        const cw = finalSsW + padSs * 2
        const ch = finalSsH + padSs * 2
        const size = cw * ch

        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = finalSsW
        srcCanvas.height = finalSsH
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
        if (!srcCtx) return null
        srcCtx.imageSmoothingEnabled = true
        srcCtx.imageSmoothingQuality = 'high'
        srcCtx.drawImage(source, 0, 0, finalSsW, finalSsH)
        const srcData = srcCtx.getImageData(0, 0, finalSsW, finalSsH).data

        const alphaMap = new Float32Array(size)
        for (let y = 0; y < finalSsH; y++) {
            const srcRow = y * finalSsW
            const dstRow = (y + padSs) * cw
            for (let x = 0; x < finalSsW; x++) {
                alphaMap[dstRow + (x + padSs)] = (srcData[(srcRow + x) * 4 + 3] as number) / 255
            }
        }

        const inside = new Uint8Array(size)
        for (let i = 0; i < size; i++) {
            // Ignora apenas residuos quase transparentes da remocao de fundo.
            if (alphaMap[i]! >= 16 / 255) inside[i] = 1
        }

        const INF = 1e20
        const maxN = Math.max(cw, ch)
        const f = new Float64Array(maxN)
        const d = new Float64Array(maxN)
        const v = new Int32Array(maxN)
        const z = new Float64Array(maxN + 1)

        const edt1d = (n: number) => {
            let k = 0
            v[0] = 0
            z[0] = -INF
            z[1] = INF
            for (let q = 1; q < n; q++) {
                let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * (q - v[k]!))
                while (k > 0 && s <= z[k]!) {
                    k--
                    s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * (q - v[k]!))
                }
                k++
                v[k] = q
                z[k] = s
                z[k + 1] = INF
            }
            k = 0
            for (let q = 0; q < n; q++) {
                while (z[k + 1]! < q) k++
                const dx = q - v[k]!
                d[q] = dx * dx + f[v[k]!]!
            }
        }

        const computeDistSq = (initFn: (idx: number) => number) => {
            const rowDT = new Float32Array(size)
            for (let y = 0; y < ch; y++) {
                const row = y * cw
                for (let x = 0; x < cw; x++) f[x] = initFn(row + x)
                edt1d(cw)
                for (let x = 0; x < cw; x++) rowDT[row + x] = d[x] as number
            }
            const distSq = new Float32Array(size)
            for (let x = 0; x < cw; x++) {
                for (let y = 0; y < ch; y++) f[y] = rowDT[y * cw + x] as number
                edt1d(ch)
                for (let y = 0; y < ch; y++) distSq[y * cw + x] = d[y] as number
            }
            return distSq
        }

        const distances = computeDistSq((idx) => (
            outlineMode === 'outside' ? inside[idx] : !inside[idx]
        ) ? 0 : INF)
        const coverage = createStickerCoverage(inside, distances, cw, ch, wScaled, ssScale, outlineMode)

        const ssOutCanvas = document.createElement('canvas')
        ssOutCanvas.width = cw
        ssOutCanvas.height = ch
        const ssOutCtx = ssOutCanvas.getContext('2d')
        if (!ssOutCtx) return null

        const outImgData = ssOutCtx.createImageData(cw, ch)

        const tmpC = document.createElement('canvas')
        tmpC.width = 1
        tmpC.height = 1
        const tmpCtx = tmpC.getContext('2d')!
        tmpCtx.fillStyle = outlineColor || '#000000'
        tmpCtx.fillRect(0, 0, 1, 1)
        const cd = tmpCtx.getImageData(0, 0, 1, 1).data
        const cr = cd[0] as number
        const cg = cd[1] as number
        const cb = cd[2] as number
        const baseAlpha = Math.min(1, Math.max(0, outlineOpacity))

        for (let i = 0; i < size; i++) {
            // O modo externo e uma base continua sob a imagem. Nao subtrair
            // a mascara original: isso criava aneis separados e frestas.
            const alpha = coverage[i]! * baseAlpha * (outlineMode === 'inside' ? alphaMap[i]! : 1)
            const o = i * 4
            outImgData.data[o] = cr
            outImgData.data[o + 1] = cg
            outImgData.data[o + 2] = cb
            outImgData.data[o + 3] = Math.round(alpha * 255)
        }

        ssOutCtx.putImageData(outImgData, 0, 0)

        const finalW = rasterW + finalPad * 2
        const finalH = rasterH + finalPad * 2

        const outCanvas = document.createElement('canvas')
        outCanvas.width = finalW
        outCanvas.height = finalH
        const outCtx = outCanvas.getContext('2d')!
        if (!outCtx) return null
        outCtx.imageSmoothingEnabled = true
        // Reducao 2:1 por interpolacao linear evita halos de filtros cubicos.
        outCtx.imageSmoothingQuality = 'low'
        outCtx.drawImage(ssOutCanvas, 0, 0, cw, ch, 0, 0, finalW, finalH)

        ;(outCanvas as any).__outlinePad = finalPad
        ;(outCanvas as any).__outlineSrcW = rasterW
        ;(outCanvas as any).__outlineSrcH = rasterH

        return outCanvas
    } catch (e) {
        console.error('[StickerOutline] Erro ao gerar outline:', e)
        return null
    }
}
