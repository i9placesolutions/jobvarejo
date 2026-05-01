/**
 * Helpers puros para tracking/contagem de URLs de imagem em
 * canvas data (JSON serializado). Usado por prewarmCanvasImages
 * para reportar progresso e detectar duplicatas.
 *
 * Sem dependencia de canvas/refs/network.
 *
 * Cobertura: tests/utils/canvasImageTracking.test.ts
 */

/**
 * Detecta se uma URL e' "trackable" — vale a pena reportar progresso
 * de carregamento. Excluimos data URLs (instantaneos) e blob URLs
 * (locais, sem latencia visivel) — eles spammariam o counter sem
 * informacao util.
 */
export const isTrackableImageSrc = (src: any): boolean => {
    const s = String(src || '').trim()
    if (!s) return false
    if (s.startsWith('data:')) return false
    if (s.startsWith('blob:')) return false
    return true
}

/**
 * Varre canvasData recursivamente (objects + clipPath em qualquer
 * profundidade) e retorna um Map<src, count> com a contagem de
 * referencias por URL trackable.
 *
 * Usado pelo pipeline de prewarm para:
 *  - reportar progresso ("X/Y imagens carregadas")
 *  - detectar duplicatas (mesma URL em N cards)
 *  - skip de URLs locais (data:/blob:) que nao precisam de prewarm
 *
 * Pure: nao acessa canvas/refs/network. WeakSet de visited evita
 * loops infinitos em referencias circulares.
 */
export const collectTrackableImageSrcCounts = (canvasData: any): Map<string, number> => {
    const counts = new Map<string, number>()
    const visited = new Set<any>()

    const walk = (node: any) => {
        if (!node) return
        if (typeof node === 'object') {
            if (visited.has(node)) return
            visited.add(node)
        }

        if (Array.isArray(node)) {
            node.forEach(walk)
            return
        }

        if (typeof node !== 'object') return

        const t = String((node as any).type || '').toLowerCase()
        if (t === 'image') {
            const src = String((node as any).src || (node as any).__originalSrc || '').trim()
            if (src && isTrackableImageSrc(src)) {
                counts.set(src, (counts.get(src) || 0) + 1)
            }
        }

        const children = (node as any).objects
        if (Array.isArray(children)) walk(children)
        const clip = (node as any).clipPath
        if (clip && typeof clip === 'object') walk(clip)
    }

    walk(canvasData)
    return counts
}
