/**
 * Operacoes pequenas e seguras sobre objetos Fabric — wrappers que
 * tratam casos degenerados (objeto null, set/initDimensions ausente,
 * scale=0 mascarando visivel) sem acessar o canvas global.
 *
 * Cobertura: tests/utils/fabricObjectOps.test.ts
 */

import { makeId } from './makeId'
import { isTextStyleObject } from './editorSelectionSnapshot'
import { isLikelyProductCard } from './fabricObjectClassifiers'

/**
 * Reseta estado de runtime de um objeto Fabric clonado/duplicado:
 * - Limpa _activeObjects/_activeObject (selecao stale do original)
 * - Remove __corner (cache de manipulador hover)
 * - Sai de modo isEditing (texto ainda editando)
 * - Desabilita caching (objectCaching/noScaleCache/statefullCache)
 * - Marca como selectable/evented/hasControls (no root)
 * - Reinicializa text dimensions se for texto
 * - Recursao em getObjects() e clipPath
 * - setCoords no fim
 *
 * Para product cards: alem disso aplica subTargetCheck e desabilita
 * selecao individual de offerBackground/price_bg.
 *
 * Usado apos paste/duplicate/import — o root vem com estado de runtime
 * (selecao, edit, cache) que precisa ser limpo antes de reusar.
 */
export const resetDuplicatedObjectRuntime = (root: any): void => {
    const visit = (node: any, isRoot = false) => {
        if (!node || typeof node !== 'object') return

        try {
            if (Array.isArray((node as any)._activeObjects)) {
                ;(node as any)._activeObjects = []
            }
            if ((node as any)._activeObject) {
                delete (node as any)._activeObject
            }
            if ((node as any).__corner) {
                delete (node as any).__corner
            }
            if ((node as any).isEditing && typeof (node as any).exitEditing === 'function') {
                try { (node as any).exitEditing() } catch { /* ignore */ }
            }
        } catch {
            // ignore runtime cleanup failures
        }

        if (typeof (node as any).set === 'function') {
            const nextState: Record<string, any> = {
                objectCaching: false,
                noScaleCache: false,
                statefullCache: false,
                dirty: true
            }
            if (isRoot) {
                nextState.selectable = true
                nextState.evented = true
                nextState.hasControls = true
                nextState.hasBorders = true
            }
            try { (node as any).set(nextState) } catch { /* ignore */ }
        }

        if (isTextStyleObject(node) && typeof (node as any).initDimensions === 'function') {
            try { (node as any).initDimensions() } catch { /* ignore */ }
        }

        if (typeof (node as any).getObjects === 'function') {
            try {
                ;((node as any).getObjects() || []).forEach((child: any) => visit(child, false))
            } catch {
                // ignore child traversal failures
            }
        }
        if ((node as any).clipPath && typeof (node as any).clipPath === 'object') {
            visit((node as any).clipPath, false)
        }

        try { (node as any).setCoords?.() } catch { /* ignore */ }
    }

    visit(root, true)

    if (
        root &&
        String((root as any)?.type || '').toLowerCase() === 'group' &&
        ((root as any).isSmartObject || (root as any).isProductCard || isLikelyProductCard(root))
    ) {
        try {
            ;(root as any).set({ subTargetCheck: true, interactive: true, dirty: true })
            ;((root as any).getObjects?.() || []).forEach((child: any) => {
                const isBackground = child?.name === 'offerBackground' || child?.name === 'price_bg'
                child?.set?.({
                    selectable: !isBackground,
                    evented: !isBackground,
                    hasControls: !isBackground,
                    hasBorders: !isBackground,
                    objectCaching: false,
                    noScaleCache: false,
                    statefullCache: false,
                    dirty: true
                })
                child?.setCoords?.()
            })
            ;(root as any).setCoords?.()
        } catch {
            // ignore product-card specific cleanup failures
        }
    }
}

/**
 * Atribui novos `_customId`s recursivamente em todos os descendentes do
 * objeto (Fabric Group). Usado apos clone/duplicate para garantir que
 * cada copia tenha identidade unica.
 *
 * Preserva o id original em `__duplicateSourceCustomId` para que callers
 * possam construir mapeamentos antigo→novo (necessario para remap de
 * `parentZoneId`, `_zoneSlot.zoneId`, etc).
 *
 * Recursao desce somente em objetos com `getObjects()` — outros tipos
 * nao tem hierarquia interna a regenerar.
 */
export const assignNewCustomIdsDeep = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return
    ;(obj as any).__duplicateSourceCustomId = String((obj as any)._customId || '').trim()
    obj._customId = makeId()
    if (typeof obj.getObjects === 'function') {
        ;(obj.getObjects() || []).forEach((child: any) => assignNewCustomIdsDeep(child))
    }
}

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
