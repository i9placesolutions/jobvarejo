/**
 * Operacoes pequenas e seguras sobre objetos Fabric — wrappers que
 * tratam casos degenerados (objeto null, set/initDimensions ausente,
 * scale=0 mascarando visivel) sem acessar o canvas global.
 *
 * Cobertura: tests/utils/fabricObjectOps.test.ts
 */

/**
 * Atualiza o `text` de um objeto Fabric e reinicializa as dimensoes
 * para que o bbox/largura sejam recomputados imediatamente.
 *
 * No-op silencioso se o objeto nao tem `.set()` (ex: rect, image).
 * Tolera ausencia de `.initDimensions()` em versoes mais antigas do Fabric.
 */
export const setText = (obj: any, text: string): void => {
    if (!obj || typeof obj.set !== 'function') return
    obj.set('text', text)
    if (typeof obj.initDimensions === 'function') obj.initDimensions()
}

/**
 * Alterna visibilidade de um objeto Fabric preservando a escala visual
 * "real" para futuro restore.
 *
 * Por que nao usar apenas `visible: true/false`? No Fabric, `visible=false`
 * dentro de um group ainda contribui para o bbox em alguns caminhos do
 * render — usuarios viam handles de selecao "saltando" para rectangulos
 * gigantes. Escalar para 0 colapsa o objeto, eliminando o problema.
 *
 * Logica:
 *  - hide: salva a scaleX/Y atual em __visibleScaleX/Y, depois aplica
 *    scaleX=0/scaleY=0 + visible=false.
 *  - show: restaura escala salva (com fallback __originalScaleX/Y e
 *    clamp [0.08, 3.2]) e aplica visible=true.
 *
 * Tolerante a entradas degeneradas: scale corrompido vira 1 via fallback.
 */
export const setVisible = (obj: any, visible: boolean): void => {
    if (!obj || typeof obj.set !== 'function') return
    const clampScale = (raw: any, fallback: any, min = 0.08, max = 3.2): number => {
        const fb = Number(fallback)
        const safeFallback = Number.isFinite(fb) && Math.abs(fb) > 0 ? fb : 1
        const n = Number(raw)
        if (!Number.isFinite(n) || n === 0) return safeFallback
        const sign = n < 0 ? -1 : 1
        const mag = Math.min(max, Math.max(min, Math.abs(n)))
        return sign * mag
    }
    const toFinite = (v: any): number | undefined => {
        const n = Number(v)
        return Number.isFinite(n) ? n : undefined
    }

    if (visible) {
        const fallbackX = (toFinite(obj.scaleX) && Math.abs(Number(obj.scaleX)) > 0) ? Number(obj.scaleX) : 1
        const fallbackY = (toFinite(obj.scaleY) && Math.abs(Number(obj.scaleY)) > 0) ? Number(obj.scaleY) : 1
        const restoreScaleX = clampScale(
            toFinite((obj as any).__visibleScaleX) ?? toFinite((obj as any).__originalScaleX),
            fallbackX
        )
        const restoreScaleY = clampScale(
            toFinite((obj as any).__visibleScaleY) ?? toFinite((obj as any).__originalScaleY),
            fallbackY
        )
        obj.set({ visible: true, scaleX: restoreScaleX, scaleY: restoreScaleY })
        return
    }

    // Preserve a escala visual atual para que a proxima chamada com
    // visible=true nao perca edicoes manuais.
    const sx = toFinite(obj.scaleX)
    const sy = toFinite(obj.scaleY)
    if (sx != null && Math.abs(sx) > 0) (obj as any).__visibleScaleX = sx
    if (sy != null && Math.abs(sy) > 0) (obj as any).__visibleScaleY = sy

    // visible=false sozinho pode afetar bounds do group em Fabric;
    // scale-to-zero colapsa o objeto e evita selecao gigante.
    obj.set({ visible: false, scaleX: 0, scaleY: 0 })
}
