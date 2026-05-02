/**
 * Gerador puro de outline de "sticker" (contorno suave) para uma imagem.
 * Aplica supersampling 2x, EDT (Euclidean Distance Transform) e smoothstep
 * quintico para produzir bordas anti-aliased sem stair-stepping.
 *
 * Apenas DOM-canvas (sem deps de Fabric/refs/state). Por usar
 * `document.createElement('canvas')`, testes precisam de jsdom env.
 *
 * Cobertura: tests/utils/stickerOutline.test.ts
 */

export type StickerOutlineMode = 'outside' | 'inside'

/**
 * Gera um canvas com o outline de uma imagem. Retorna null em casos
 * degenerados (imagem nao-pronta, dimensoes zero, contexto 2d nao
 * disponivel, etc).
 *
 *  - `outlineMode='outside'`: o outline e' desenhado FORA da silhueta
 *    (preenche tudo que nao e' opaco, incluindo buracos internos de letras)
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
    outlineMode: StickerOutlineMode = 'outside'
): HTMLCanvasElement | null => {
    try {
        if (img && (img as any).tagName === 'IMG') {
            const im = img as HTMLImageElement
            if (!im.complete || (im.naturalWidth || 0) <= 0 || (im.naturalHeight || 0) <= 0) {
                return null
            }
        }

        const srcW = (img as any).naturalWidth || img.width
        const srcH = (img as any).naturalHeight || img.height
        if (!srcW || !srcH || outlineWidth <= 0) return null

        let ssScale = 2
        const ssW = srcW * ssScale
        const ssH = srcH * ssScale
        const wSs = outlineWidth * ssScale
        const softSs = Math.max(1.5 * ssScale, wSs * 0.35)
        let padSs = Math.ceil(wSs + softSs + ssScale * 3)
        const gridW = ssW + padSs * 2
        const gridH = ssH + padSs * 2
        if (gridW * gridH > 16_000_000) {
            ssScale = 1
        }

        const finalSsW = srcW * ssScale
        const finalSsH = srcH * ssScale
        const wScaled = outlineWidth * ssScale
        const softScaled = Math.max(1.5 * ssScale, wScaled * 0.35)
        padSs = Math.ceil(wScaled + softScaled + ssScale * 3)
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
        srcCtx.drawImage(img, 0, 0, finalSsW, finalSsH)
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
            if (alphaMap[i]! > 0) inside[i] = 1
        }

        const barrier = new Uint8Array(size)
        const barrierThreshold = 16 / 255
        for (let i = 0; i < size; i++) {
            if (alphaMap[i]! >= barrierThreshold) barrier[i] = 1
        }
        const barrierDilated = new Uint8Array(size)
        for (let i = 0; i < size; i++) {
            if (!barrier[i]) continue
            barrierDilated[i] = 1
            const x = i % cw
            const y = (i / cw) | 0
            for (let dy = -1; dy <= 1; dy++) {
                const yy = y + dy
                if (yy < 0 || yy >= ch) continue
                const row = yy * cw
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx
                    if (xx < 0 || xx >= cw) continue
                    barrierDilated[row + xx] = 1
                }
            }
        }

        const outside = new Uint8Array(size)
        const queue = new Int32Array(size)
        let qh = 0
        let qt = 0
        const tryEnqueue = (idx: number) => {
            if (idx < 0 || idx >= size || outside[idx] || barrierDilated[idx]) return
            outside[idx] = 1
            queue[qt++] = idx
        }
        for (let x = 0; x < cw; x++) { tryEnqueue(x); tryEnqueue((ch - 1) * cw + x) }
        for (let y = 1; y < ch - 1; y++) { tryEnqueue(y * cw); tryEnqueue(y * cw + cw - 1) }
        while (qh < qt) {
            const idx = queue[qh++]!
            const x = idx % cw
            const y = (idx / cw) | 0
            if (x > 0) tryEnqueue(idx - 1)
            if (x < cw - 1) tryEnqueue(idx + 1)
            if (y > 0) tryEnqueue(idx - cw)
            if (y < ch - 1) tryEnqueue(idx + cw)
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

        const distSqToInside = computeDistSq((idx) => {
            const a = alphaMap[idx]!
            if (a >= 0.99) return 0
            if (a > 0.01) return (1 - a) * (1 - a)
            return INF
        })

        const distSqToOutside = outlineMode === 'inside'
            ? computeDistSq((idx) => outside[idx] ? 0 : INF)
            : null

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

        const maxDist = wScaled + softScaled
        const maxDistSq = maxDist * maxDist

        for (let i = 0; i < size; i++) {
            const isIn = !!inside[i]

            if (outlineMode === 'outside') {
                if (isIn) continue
            } else {
                if (!isIn) continue
            }

            const dsq = outlineMode === 'inside'
                ? (distSqToOutside ? distSqToOutside[i]! : INF)
                : distSqToInside[i]!
            if (dsq > maxDistSq) continue

            const dist = Math.sqrt(dsq)
            const raw = (maxDist - dist) / softScaled
            const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw
            const smoothT = t * t * t * (t * (t * 6 - 15) + 10)
            const a = Math.round(baseAlpha * smoothT * 255)
            if (a <= 0) continue

            const o = i * 4
            outImgData.data[o] = cr
            outImgData.data[o + 1] = cg
            outImgData.data[o + 2] = cb
            outImgData.data[o + 3] = a
        }

        ssOutCtx.putImageData(outImgData, 0, 0)

        const finalPad = Math.ceil(padSs / ssScale)
        const finalW = srcW + finalPad * 2
        const finalH = srcH + finalPad * 2

        const outCanvas = document.createElement('canvas')
        outCanvas.width = finalW
        outCanvas.height = finalH
        const outCtx = outCanvas.getContext('2d')!
        if (!outCtx) return null
        outCtx.imageSmoothingEnabled = true
        outCtx.imageSmoothingQuality = 'high'
        outCtx.drawImage(ssOutCanvas, 0, 0, cw, ch, 0, 0, finalW, finalH)

        ;(outCanvas as any).__outlinePad = finalPad
        ;(outCanvas as any).__outlineSrcW = srcW
        ;(outCanvas as any).__outlineSrcH = srcH

        return outCanvas
    } catch (e) {
        console.error('[StickerOutline] Erro ao gerar outline:', e)
        return null
    }
}
