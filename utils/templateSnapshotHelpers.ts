/**
 * Helpers puros para inspecao de snapshots de template (price tag).
 * Detectam estruturas de variantes (atacarejo) e flags de forcado.
 *
 * Sem dependencia de canvas/refs. Operam sobre snapshot JSON ou
 * objeto Fabric.
 *
 * Cobertura: tests/utils/templateSnapshotHelpers.test.ts
 */

import { collectObjectsDeep, findByName, isTextLikeObject } from './fabricObjectClassifiers'

/**
 * Detecta se um snapshot (JSON ou objeto Fabric) contem um node com
 * name 'atac_retail_bg' em qualquer profundidade. Tradicionalmente
 * sinaliza que o template segue layout atacarejo (varejo + atacado
 * lado a lado).
 *
 * Lida tanto com `objects` (formato JSON) quanto `_objects` /
 * `getObjects()` (objeto Fabric instanciado).
 */
export const templateSnapshotHasAtacStructure = (snapshot: any): boolean => {
    if (!snapshot || typeof snapshot !== 'object') return false
    if (String((snapshot as any).name || '') === 'atac_retail_bg') return true
    const stack: any[] = []
    const rootJsonChildren = Array.isArray((snapshot as any).objects)
        ? (snapshot as any).objects : []
    const rootFabricChildren = Array.isArray((snapshot as any)._objects)
        ? (snapshot as any)._objects
        : (typeof (snapshot as any).getObjects === 'function' ? (snapshot as any).getObjects() : [])
    if (rootJsonChildren.length) stack.push(...rootJsonChildren)
    if (rootFabricChildren.length) stack.push(...rootFabricChildren)
    while (stack.length) {
        const obj = stack.pop()
        if (!obj || typeof obj !== 'object') continue
        if (String((obj as any).name || '') === 'atac_retail_bg') return true
        const nestedJson = Array.isArray((obj as any).objects) ? (obj as any).objects : []
        const nestedFabric = Array.isArray((obj as any)._objects)
            ? (obj as any)._objects
            : (typeof (obj as any).getObjects === 'function' ? (obj as any).getObjects() : [])
        if (nestedJson.length) stack.push(...nestedJson)
        if (nestedFabric.length) stack.push(...nestedFabric)
    }
    return false
}

/**
 * Apenas honra o flag explicito __forceAtacarejoCanonical. A
 * presenca de estrutura atacarejo NAO forca o reflow canonico
 * (templates do Mini Editor precisam persistir como foram criados).
 */
export const shouldForceCanonicalAtacForTemplateJson = (snapshot: any): boolean => {
    return !!(snapshot && typeof snapshot === 'object'
        && (snapshot as any).__forceAtacarejoCanonical === true)
}

/**
 * Layout atacarejo fixo: nao selecionar snapshots por variante em
 * runtime. Sempre retorna false.
 *
 * Existe para documentar a decisao no codigo (em vez de remover a
 * abstracao). Pure: sem efeito colateral.
 */
export const shouldUseAtacVariantSnapshotsForTemplate = (_snapshot: any): boolean => {
    return false
}

/**
 * Decide se um priceGroup tem layout "manual" customizado que deve
 * ser preservado durante re-renders/syncs (em vez de regenerar o
 * layout default).
 *
 * Heuristicas em ordem (primeira que casa decide):
 *  1. Flag explicita `__preserveManualLayout=true` ou `__isCustomTemplate=true` → true
 *  2. Flag explicita `__forceAtacarejoCanonical=true` → false (forca layout atac default)
 *  3. Tem estrutura Red Burst (via `isRedBurstCheck` injetado) → true
 *  4. Tem node `atac_retail_bg` (estrutura atacarejo padrao) → false
 *  5. Tem `price_header_bg` ou `price_header_text` → true (custom header)
 *  6. Algum filho tem `__originalLeft/Top/FontSize/Width/Height` finitos → true
 *  7. Default → false
 *
 * Caller injeta `isRedBurstCheck` para evitar dependencia circular
 * entre `templateSnapshotHelpers` e `redBurstTemplateRevive`.
 */
export const shouldPreserveManualTemplateVisual = (
    priceGroup: any,
    isRedBurstCheck: (g: any) => boolean
): boolean => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
    if ((priceGroup as any).__preserveManualLayout === true || (priceGroup as any).__isCustomTemplate === true) return true
    if ((priceGroup as any).__forceAtacarejoCanonical === true) return false

    if (isRedBurstCheck(priceGroup)) return true

    const all = collectObjectsDeep(priceGroup)
    if (!all.length) return false

    const hasAtacStructure = !!findByName(all, 'atac_retail_bg')
    if (hasAtacStructure) return false

    if (findByName(all, 'price_header_bg') || findByName(all, 'price_header_text')) return true

    const hasTemplateMetrics = all.some((obj: any) => (
        Number.isFinite(Number((obj as any)?.__originalLeft)) ||
        Number.isFinite(Number((obj as any)?.__originalTop)) ||
        Number.isFinite(Number((obj as any)?.__originalFontSize)) ||
        Number.isFinite(Number((obj as any)?.__originalWidth)) ||
        Number.isFinite(Number((obj as any)?.__originalHeight))
    ))
    return hasTemplateMetrics
}

/**
 * Restaura flags `__preserveManualLayout` / `__isCustomTemplate` /
 * `__manualTemplateBaseW/H` em um priceGroup quando faltarem.
 *
 * Roda APENAS se `shouldPreserveCheck` retorna true (ja e' manual).
 * Calcula baseW/baseH a partir de width*scaleX (raw) ou getScaledWidth/scaleX
 * como fallback.
 *
 * Mutates o priceGroup. Retorna `true` se algo foi alterado.
 */
export const restoreMissingManualTemplateFlags = (
    priceGroup: any,
    shouldPreserveCheck: (g: any) => boolean
): boolean => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
    if (!shouldPreserveCheck(priceGroup)) return false

    let changed = false
    if ((priceGroup as any).__preserveManualLayout !== true) {
        (priceGroup as any).__preserveManualLayout = true
        changed = true
    }
    if ((priceGroup as any).__isCustomTemplate !== true) {
        (priceGroup as any).__isCustomTemplate = true
        changed = true
    }

    const hasBaseW = Number.isFinite(Number((priceGroup as any).__manualTemplateBaseW))
    const hasBaseH = Number.isFinite(Number((priceGroup as any).__manualTemplateBaseH))
    if (!hasBaseW || !hasBaseH) {
        const rawW = Number(priceGroup.width || 0)
        const rawH = Number(priceGroup.height || 0)
        const sx = Math.abs(Number(priceGroup.scaleX ?? 1)) || 1
        const sy = Math.abs(Number(priceGroup.scaleY ?? 1)) || 1
        const scaledW = Number(priceGroup.getScaledWidth?.() || 0)
        const scaledH = Number(priceGroup.getScaledHeight?.() || 0)
        const baseW = rawW > 0 ? rawW : (scaledW > 0 ? (scaledW / sx) : 0)
        const baseH = rawH > 0 ? rawH : (scaledH > 0 ? (scaledH / sy) : 0)
        if (!hasBaseW && Number.isFinite(baseW) && baseW > 0) {
            (priceGroup as any).__manualTemplateBaseW = baseW
            changed = true
        }
        if (!hasBaseH && Number.isFinite(baseH) && baseH > 0) {
            (priceGroup as any).__manualTemplateBaseH = baseH
            changed = true
        }
    }

    return changed
}

/**
 * Aplica `restoreMissingManualTemplateFlags` em todos os priceGroups
 * de um canvas (recursivo). Usa `isPriceGroupCheck` injetado para
 * detectar candidatos.
 *
 * Mutates os objetos. Retorna numero de groups que tiveram flags
 * restauradas.
 */
export const restoreMissingManualTemplateFlagsInCanvas = (
    canvasInstance: any,
    isPriceGroupCheck: (obj: any) => boolean,
    shouldPreserveCheck: (g: any) => boolean
): number => {
    if (!canvasInstance || typeof canvasInstance.getObjects !== 'function') return 0

    const roots = canvasInstance.getObjects() || []
    const stack = [...roots]
    let restored = 0
    while (stack.length) {
        const obj = stack.pop()
        if (!obj) continue
        if (isPriceGroupCheck(obj) && restoreMissingManualTemplateFlags(obj, shouldPreserveCheck)) {
            restored += 1
        }
        if (typeof obj.getObjects === 'function') {
            (obj.getObjects() || []).forEach((child: any) => stack.push(child))
        }
    }

    return restored
}

/**
 * Escolhe o melhor groupJson renderavel de um label template.
 *
 * Estrategia:
 *  - Se nao usa variants: prefere baseGroupJson; senao tenta variants
 *    em ordem de recovery: normal → tiny → large → qualquer outro
 *  - Se usa variants: prefere `variantMap[preferredVariantKey]`,
 *    depois baseGroupJson, depois recovery
 *
 * Considera renderavel se passar `isRenderableCheck` OU tiver objects[].
 *
 * `isRenderableCheck` e `useVariantSnapshotsCheck` injetados.
 */
export const pickRenderableTemplateGroupJson = (
    tpl: any,
    preferredVariantKey: string | undefined,
    isRenderableCheck: (groupJson: any) => boolean,
    useVariantSnapshotsCheck: (groupJson: any) => boolean
): any => {
    const baseGroupJson: any = (tpl as any)?.group
    const variantMap = ((baseGroupJson as any)?.__atacVariantGroups || {}) as Record<string, any>
    const useVariantSnapshots = useVariantSnapshotsCheck(baseGroupJson)

    const hasAnyObjects = (groupJson: any): boolean => {
        const objs = Array.isArray(groupJson?.objects) ? groupJson.objects : []
        return objs.length > 0
    }

    if (!useVariantSnapshots) {
        if (isRenderableCheck(baseGroupJson) || hasAnyObjects(baseGroupJson)) return baseGroupJson
        const orderedRecoveryKeys = ['normal', 'tiny', 'large']
        for (const k of orderedRecoveryKeys) {
            const snap = (variantMap as any)?.[k]
            if (isRenderableCheck(snap) || hasAnyObjects(snap)) return snap
        }
        for (const snap of Object.values(variantMap || {})) {
            if (isRenderableCheck(snap) || hasAnyObjects(snap)) return snap
        }
        return null
    }

    const preferredVariant =
        preferredVariantKey && variantMap && typeof variantMap === 'object'
            ? variantMap[String(preferredVariantKey)]
            : null

    if (isRenderableCheck(preferredVariant) || hasAnyObjects(preferredVariant)) {
        return preferredVariant
    }
    if (isRenderableCheck(baseGroupJson) || hasAnyObjects(baseGroupJson)) {
        return baseGroupJson
    }

    if (variantMap && typeof variantMap === 'object') {
        const orderedKeys = preferredVariantKey
            ? [String(preferredVariantKey), 'normal', 'tiny', 'large']
            : ['normal', 'tiny', 'large']
        for (const k of orderedKeys) {
            const snap = (variantMap as any)?.[k]
            if (isRenderableCheck(snap) || hasAnyObjects(snap)) return snap
        }
        for (const snap of Object.values(variantMap || {})) {
            if (isRenderableCheck(snap) || hasAnyObjects(snap)) return snap
        }
    }

    return null
}

/**
 * Inicializa metricas "original*" em um priceGroup manual: serve como
 * snapshot ground-truth para reverter o layout apos manipulacoes do
 * usuario (scale, fontSize, etc).
 *
 * Para cada filho do group, garante que existem (sem sobrescrever):
 *  - __originalLeft / Top / OriginX / OriginY
 *  - __originalScaleX/Y (clampados para [0.08, 3.2])
 *  - __originalStrokeWidth
 *  - Para texts: __originalFontSize / Family / Width / Height
 *  - Para rects: __originalWidth / Height / Rx / Ry
 *  - Para circles: __originalRadius
 *
 * Mutates os children do group in place.
 */
export const seedManualTemplateOriginalMetrics = (group: any): void => {
    if (!group || typeof group.getObjects !== 'function') return
    const all = collectObjectsDeep(group)
    const clampScale = (raw: any, fallback: any, min = 0.08, max = 3.2) => {
        const fb = Number(fallback)
        const safeFallback = Number.isFinite(fb) && Math.abs(fb) > 0 ? fb : 1
        const n = Number(raw)
        if (!Number.isFinite(n) || n === 0) return safeFallback
        const sign = n < 0 ? -1 : 1
        const mag = Math.min(max, Math.max(min, Math.abs(n)))
        return sign * mag
    }
    all.forEach((obj: any) => {
        if (!obj) return

        const asNum = (v: any) => {
            const n = Number(v)
            return Number.isFinite(n) ? n : undefined
        }

        if (asNum(obj.__originalLeft) == null) obj.__originalLeft = asNum(obj.left) ?? 0
        if (asNum(obj.__originalTop) == null) obj.__originalTop = asNum(obj.top) ?? 0
        if (!obj.__originalOriginX) obj.__originalOriginX = obj.originX ?? 'center'
        if (!obj.__originalOriginY) obj.__originalOriginY = obj.originY ?? 'center'
        obj.__originalScaleX = clampScale(
            asNum(obj.__originalScaleX),
            asNum(obj.scaleX) ?? 1
        )
        obj.__originalScaleY = clampScale(
            asNum(obj.__originalScaleY),
            asNum(obj.scaleY) ?? 1
        )
        if (asNum(obj.__originalStrokeWidth) == null) obj.__originalStrokeWidth = asNum(obj.strokeWidth) ?? 0

        if (isTextLikeObject(obj)) {
            if (typeof obj.initDimensions === 'function') obj.initDimensions()
            if (asNum(obj.__originalFontSize) == null) obj.__originalFontSize = asNum(obj.fontSize) ?? 14
            if (typeof obj.__originalFontFamily !== 'string' && typeof obj.fontFamily === 'string') {
                obj.__originalFontFamily = obj.fontFamily
            }
            if (asNum(obj.__originalWidth) == null) {
                const w = asNum(obj.width) ?? asNum(obj.getScaledWidth?.())
                obj.__originalWidth = Math.max(1, w ?? 1)
            }
            if (asNum(obj.__originalHeight) == null) {
                const h = asNum(obj.height) ?? asNum(obj.getScaledHeight?.())
                obj.__originalHeight = Math.max(1, h ?? (asNum(obj.fontSize) ?? 14))
            }
            return
        }

        if (obj.type === 'rect') {
            if (asNum(obj.__originalWidth) == null) obj.__originalWidth = Math.max(1, asNum(obj.width) ?? 1)
            if (asNum(obj.__originalHeight) == null) obj.__originalHeight = Math.max(1, asNum(obj.height) ?? 1)
            if (asNum(obj.__originalRx) == null) obj.__originalRx = asNum(obj.rx) ?? 0
            if (asNum(obj.__originalRy) == null) obj.__originalRy = asNum(obj.ry) ?? 0
            return
        }

        if (obj.type === 'circle' && asNum(obj.__originalRadius) == null) {
            obj.__originalRadius = Math.max(1, asNum(obj.radius) ?? 1)
        }
    })
}
