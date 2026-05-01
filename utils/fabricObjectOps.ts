/**
 * Operacoes pequenas e seguras sobre objetos Fabric — wrappers que
 * tratam casos degenerados (objeto null, set/initDimensions ausente,
 * scale=0 mascarando visivel) sem acessar o canvas global.
 *
 * Cobertura: tests/utils/fabricObjectOps.test.ts
 */

/**
 * Numero minimo de objetos selecionados para o object-mask flow estar
 * disponivel. Mascarar 1 objeto sozinho nao faz sentido (precisa de
 * pelo menos 2: o "mask" e o objeto que sera mascarado).
 */
export const OBJECT_MASK_MIN_SELECTION = 2

import { makeId } from './makeId'
import { isTextStyleObject } from './editorSelectionSnapshot'
import {
    isLikelyProductCard,
    isLikelyProductZone,
    isProductCardContainer
} from './fabricObjectClassifiers'
import { isValidClipPath } from './canvasValidation'
import {
    isControlLikeObject,
    isTransientCanvasObject
} from './controlObjectClassifiers'
import { isUserGuideObject } from './userGuideHelpers'
import { isFrameLikeObject } from './frameGeometry'

/**
 * Adiciona um objeto a um group Fabric com fallback compatibilidade
 * v6/v7. Em Fabric v7+, addWithUpdate foi removido em favor de
 * LayoutManager + triggerLayout(). Esta funcao tenta na ordem:
 *   1. group.addWithUpdate(object) (Fabric v6 ou compat shim)
 *   2. group.add(object) + group.triggerLayout() (Fabric v7+)
 *   3. fallback _calcBounds + _updateObjectsCoords (Fabric internals)
 *
 * Tambem valida que `object` tem setCoords antes de adicionar — bloqueia
 * objetos invalidos que quebrariam o canvas em runtime.
 *
 * Sem object: chama apenas a operacao de "update" do group (recalcular
 * bounds apos modificacoes manuais nos children).
 */
export const safeAddWithUpdate = (group: any, object?: any): void => {
    if (!group) return

    if (object) {
        const isValid = object && typeof object === 'object' && typeof object.setCoords === 'function'
        if (!isValid) {
            console.error('[safeAddWithUpdate] Objeto invalido bloqueado', {
                objectType: typeof object,
                hasSetCoords: typeof object?.setCoords === 'function',
                groupId: group._customId || group.id
            })
            return
        }
    }

    if (typeof group.addWithUpdate === 'function') {
        if (object) group.addWithUpdate(object)
        else group.addWithUpdate()
        return
    }
    if (object && typeof group.add === 'function') {
        group.add(object)
    }
    if (typeof group.triggerLayout === 'function') {
        group.triggerLayout()
    } else {
        if (typeof group._calcBounds === 'function') group._calcBounds()
        if (typeof group._updateObjectsCoords === 'function') group._updateObjectsCoords()
    }
    if (typeof group.setCoords === 'function') group.setCoords()
    group.dirty = true
}

/**
 * Aplica visibilidade a um objeto Fabric, salvando estado evented/
 * selectable em backups (`__prevEventedBeforeEyeToggle`/
 * `__prevSelectableBeforeEyeToggle`) ao esconder, e restaurando ao mostrar.
 *
 * Reduz custo de interacao enquanto invisivel: evented=false impede
 * hit-tests e mouse events. Defaults true ao mostrar quando backup
 * estiver ausente.
 *
 * Usado pelo "olho" da camadas para esconder/mostrar objetos sem
 * perder o estado de interacao original.
 */
export const applyObjectVisibility = (entry: any, visible: boolean): void => {
    if (!entry) return

    entry.set?.('visible', visible)
    entry.visible = visible

    if (!visible) {
        if ((entry as any).__prevEventedBeforeEyeToggle === undefined) {
            ;(entry as any).__prevEventedBeforeEyeToggle = entry.evented
        }
        if ((entry as any).__prevSelectableBeforeEyeToggle === undefined) {
            ;(entry as any).__prevSelectableBeforeEyeToggle = entry.selectable
        }
        entry.set?.('evented', false)
        entry.set?.('selectable', false)
        entry.evented = false
        entry.selectable = false
    } else {
        const prevEvented = (entry as any).__prevEventedBeforeEyeToggle
        const prevSelectable = (entry as any).__prevSelectableBeforeEyeToggle
        if (prevEvented !== undefined) {
            entry.set?.('evented', prevEvented)
            entry.evented = prevEvented
            delete (entry as any).__prevEventedBeforeEyeToggle
        } else {
            entry.set?.('evented', true)
            entry.evented = true
        }
        if (prevSelectable !== undefined) {
            entry.set?.('selectable', prevSelectable)
            entry.selectable = prevSelectable
            delete (entry as any).__prevSelectableBeforeEyeToggle
        } else {
            entry.set?.('selectable', true)
            entry.selectable = true
        }
    }

    entry.dirty = true
    entry.setCoords?.()
}

/**
 * Sanitiza recursivamente clipPaths corrompidos em um objeto Fabric.
 * Critico apos desserializacao para evitar "forEach of undefined" no
 * fabric.js createClipPathLayer.
 *
 * Estrategia em 3 camadas:
 *  1. Tenta consertar `_objects` undefined/null → array vazio
 *  2. Se `_objects` nao e' array, remove clipPath inteiro + _frameClipOwner
 *  3. Se passa em isValidClipPath, deixa como esta; senao remove
 *
 * Tambem normaliza _objects do proprio objeto (nao so do clipPath) e
 * desce em groups quando `recursive=true`.
 *
 * Captura erros silenciosamente — nao quebra render se falhar.
 */
export const clearInvalidClipPath = (obj: any, recursive: boolean = false): void => {
    if (!obj) return

    try {
        if (obj.clipPath) {
            const clip = obj.clipPath
            if (clip._objects === undefined || clip._objects === null) {
                clip._objects = []
            } else if (!Array.isArray(clip._objects)) {
                obj.set('clipPath', null)
                if (obj._frameClipOwner) {
                    delete obj._frameClipOwner
                }
                return
            }
            if (clip.clipPath) {
                if (clip.clipPath._objects === undefined || clip.clipPath._objects === null) {
                    clip.clipPath._objects = []
                } else if (!Array.isArray(clip.clipPath._objects)) {
                    obj.set('clipPath', null)
                    if (obj._frameClipOwner) {
                        delete obj._frameClipOwner
                    }
                    return
                }
            }
        }

        if (obj.clipPath && !isValidClipPath(obj.clipPath)) {
            obj.set('clipPath', null)
            if (obj._frameClipOwner) {
                delete obj._frameClipOwner
            }
        }

        if (obj._objects !== undefined && !Array.isArray(obj._objects)) {
            obj._objects = []
        }

        if (recursive && obj._objects && Array.isArray(obj._objects)) {
            obj._objects.forEach((child: any) => {
                clearInvalidClipPath(child, true)
            })
        }

        if (recursive && typeof obj.getObjects === 'function') {
            const children = obj.getObjects()
            if (Array.isArray(children)) {
                children.forEach((child: any) => {
                    clearInvalidClipPath(child, true)
                })
            }
        }
    } catch {
        // Silently handle errors during clipPath clearing
    }
}

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
 * Garante que o objeto tem `_customId` (identidade persistente como
 * camada). NO-OP em:
 *  - objetos null/nao-object
 *  - objetos que ja tem _customId
 *  - control-like (path nodes, bezier handles, drag guides)
 *  - user guides (persistidas por `id`, nunca devem virar camadas)
 *
 * Quando aplicavel, atribui um novo id via makeId().
 */
export const ensureObjectPersistentId = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return
    if (obj._customId) return
    if (isControlLikeObject(obj)) return
    try { if (isUserGuideObject(obj)) return } catch { /* ignore */ }
    obj._customId = makeId()
}

/**
 * Garante flags persistentes para objetos que sao "content" do projeto
 * (frame/smart object/product card/zone/priceGroup/etc):
 *  1. ensureObjectPersistentId — atribui _customId se faltando
 *  2. Se for content explicito mas tem excludeFromExport=true, remove
 *     a flag (corrige estado inconsistente apos legacy/migration)
 */
export const ensurePersistentContentFlags = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return
    ensureObjectPersistentId(obj)
    const name = String(obj.name || '')
    const isPersistentContent =
        !!obj.isFrame ||
        !!obj.isSmartObject ||
        !!obj.isProductCard ||
        !!obj.isGridZone ||
        !!obj.isProductZone ||
        !!obj.parentZoneId ||
        name === 'gridZone' ||
        name === 'productZoneContainer' ||
        name.startsWith('product-card')
    if (isPersistentContent && obj.excludeFromExport) {
        obj.excludeFromExport = false
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

/**
 * Detecta se um objeto pode receber uma mascara (clipPath custom):
 * exclui artboard, transients, frames, product zones, product cards
 * e objetos dentro de groups (exceto activeselection efêmero).
 *
 * Pure: depende apenas dos classifiers ja-extraidos.
 */
export const isObjectMaskCandidate = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    if (obj.id === 'artboard-bg') return false
    if (isTransientCanvasObject(obj)) return false
    if (obj.isFrame || isFrameLikeObject(obj)) return false
    if (isLikelyProductZone(obj)) return false
    if (isProductCardContainer(obj)) return false
    const parentGroup = (obj as any).group
    if (parentGroup && String(parentGroup?.type || '').toLowerCase() !== 'activeselection') return false
    return true
}

/**
 * Recalcula dimensions de todos os textos descendentes de um objeto
 * Fabric (recursivo). Usado apos mudanca de fonte ou clearFontCache
 * para garantir que textos re-renderizem com metrics atualizadas.
 *
 * Mutativo. Para cada text/i-text/textbox descobertos:
 *  - chama initDimensions (Fabric recalcula textLines, height, etc)
 *  - marca dirty
 *  - setCoords
 *
 * Para groups (que tem getObjects):
 *  - desce recursivamente
 *  - tambem marca dirty
 *
 * Pure no sentido de nao acessar canvas/refs globais.
 */
export const recalcAllTextMetrics = (obj: any): void => {
    if (!obj) return
    const t = String(obj.type || '').toLowerCase()
    if (t === 'i-text' || t === 'textbox' || t === 'text') {
        if (typeof obj.initDimensions === 'function') obj.initDimensions()
        obj.set?.('dirty', true)
        if (typeof obj.setCoords === 'function') obj.setCoords()
    }
    if (typeof obj.getObjects === 'function') {
        obj.getObjects().forEach((child: any) => recalcAllTextMetrics(child))
        obj.set?.('dirty', true)
    }
}

/**
 * Limpa metadata de mascara aplicada em um objeto Fabric:
 *  - clipPath = null
 *  - delete __objectMaskEnabled / __objectMaskSourceId / _frameClipOwner
 *  - setCoords + dirty
 *
 * Pure: nao re-aplica clipPath de frame (responsabilidade do caller).
 * Retorna true se houve cleanup, false se nada foi feito (sem mascara
 * aplicada).
 *
 * Caller deve passar `hasMaskApplied` (predicate injetado) — geralmente
 * `hasObjectMaskApplied` de fabricObjectClassifiers.
 */
export const clearObjectMaskMetadata = (
    obj: any,
    hasMaskApplied: (o: any) => boolean
): boolean => {
    if (!hasMaskApplied(obj)) return false
    try { obj.set?.('clipPath', null) } catch { obj.clipPath = null }
    try { delete (obj as any).objectMaskEnabled } catch { obj.objectMaskEnabled = false }
    try { delete (obj as any).objectMaskSourceId } catch { obj.objectMaskSourceId = undefined }
    try { delete (obj as any)._frameClipOwner } catch {}
    obj.setCoords?.()
    obj.dirty = true
    return true
}

/**
 * Encontra o vizinho de baixo (no z-order) que pode ser usado como
 * mascara para um target. Pure: recebe array de objetos + target +
 * predicate isCandidate, varre de target.indexOf - 1 ate 0,
 * retornando o primeiro candidato no MESMO frame (parentFrameId).
 *
 * Retorna null se target nao esta no array, esta no topo (idx <= 0)
 * ou nao ha candidato abaixo no mesmo frame.
 */
export const findNearestMaskSourceBelowTarget = (
    objects: any[],
    target: any,
    isCandidate: (obj: any) => boolean
): any | null => {
    if (!Array.isArray(objects) || !target) return null
    const targetIndex = objects.indexOf(target)
    if (targetIndex <= 0) return null

    const targetFrameId = String((target as any)?.parentFrameId || '').trim()

    for (let i = targetIndex - 1; i >= 0; i--) {
        const candidate = objects[i]
        if (!candidate || candidate === target) continue

        const candidateFrameId = String((candidate as any)?.parentFrameId || '').trim()
        if (candidateFrameId !== targetFrameId) continue
        if (!isCandidate(candidate)) continue
        return candidate
    }

    return null
}

/**
 * Remove `_customId` e `id` do nodo e descendentes recursivamente,
 * incluindo clipPath aninhado. Usado quando um objeto e clonado para
 * uso como mascara/decoracao para evitar colisao de IDs persistentes
 * com o objeto original.
 *
 * Mutativo. Usa try/catch em cada delete (alguns objetos Fabric
 * congelam props readonly).
 */
export const stripPersistentIdsRecursive = (node: any): void => {
    if (!node || typeof node !== 'object') return
    try { delete node._customId } catch {}
    try { delete node.id } catch {}

    const children = typeof node.getObjects === 'function'
        ? (node.getObjects() || [])
        : (Array.isArray(node._objects) ? node._objects : [])
    children.forEach((child: any) => stripPersistentIdsRecursive(child))

    const nestedClip = (node as any).clipPath
    if (nestedClip && typeof nestedClip === 'object') {
        stripPersistentIdsRecursive(nestedClip)
    }
}

/**
 * Normaliza o scale de um retangulo Fabric: converte scaleX/scaleY em
 * width/height reais (preserva dimensoes apos resize) e ajusta o
 * border-radius proporcionalmente, limitando-o a metade da menor
 * dimensao final.
 *
 * Critico para evitar:
 *  - cantos quebrados (rx > width/2)
 *  - drift de aparencia ao redimensionar (escala dupla)
 *  - flips persistentes (flipX/Y resetados)
 *
 * Mutativo. No-op silencioso se obj null ou nao-rect ou ja com scale=1.
 * Retorna { width, height, rx, ry } final ou void.
 */
export const normalizeRectScale = (
    obj: any,
    minSize: number = 1
): { width: number; height: number; rx: number; ry: number } | void => {
    if (!obj) return
    if (obj.type !== 'rect') return
    if (obj.scaleX === 1 && obj.scaleY === 1) return

    const newWidth = Math.max(minSize, Math.abs(obj.getScaledWidth?.() ?? (obj.width * obj.scaleX)))
    const newHeight = Math.max(minSize, Math.abs(obj.getScaledHeight?.() ?? (obj.height * obj.scaleY)))

    const originalRx = obj.rx || 0
    const scaleFatorX = newWidth / obj.width
    const scaleFatorY = newHeight / obj.height

    const newRadius = Math.min(
        (originalRx * Math.max(scaleFatorX, scaleFatorY)),
        newWidth / 2,
        newHeight / 2
    )

    obj.set({
        width: newWidth,
        height: newHeight,
        rx: newRadius,
        ry: newRadius,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false
    })

    obj.setCoords?.()
    return { width: newWidth, height: newHeight, rx: newRadius, ry: newRadius }
}

/**
 * Aplica normalizeRectScale recursivamente em um group e seus
 * descendentes. Percorre via getObjects(), descendo em groups
 * aninhados. No-op silencioso se group null ou nao-group.
 */
export const normalizeGroupRects = (group: any): void => {
    if (!group || !group.getObjects || group.type !== 'group') return
    const objects = group.getObjects()
    if (!Array.isArray(objects)) return
    objects.forEach((obj: any) => {
        if (obj.type === 'rect') {
            normalizeRectScale(obj)
        } else if (obj.type === 'group') {
            normalizeGroupRects(obj)
        }
    })
}
