// Pure mask helpers mirrored from utils/stickerOutline.ts; no DOM dependency in Nitro.
type StickerOutlineMode = 'outside' | 'inside'
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
            // Preencher apenas novos vazios internos. A borda que ja existia
            // em expanded deve manter sua cobertura fracionaria: arredonda-la
            // para 1 corta metade do antialias e deixa curvas serrilhadas.
            if (filled[i] && !expanded[i]) coverage[i] = 1
        }
    }
    return coverage
}


// Mesmo EDT e cobertura contínua usados pelo contorno das ofertas.
export const artStickerCoverage = (inside: Uint8Array, cw: number, ch: number, radius: number, antialias: number) => {
 const size=cw*ch
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
            inside[idx]
        ) ? 0 : INF)
        return createStickerCoverage(inside, distances, cw, ch, radius, antialias, 'outside')

}
