/**
 * Classificadores e walkers de objetos Fabric usados pelo editor.
 *
 * Funcoes 100% puras: recebem um objeto Fabric (duck-typed) e retornam
 * um boolean ou um valor derivado, sem depender de refs reativos, do
 * canvas global ou de imports do componente.
 *
 * Cobertura: tests/utils/fabricObjectClassifiers.test.ts
 */

/**
 * Retorna o rect "moldura" de uma zona de produtos. Aceita um proprio
 * fabric.Rect, um group contendo zoneRect/zone-border, ou um group
 * contendo qualquer rect (fallback).
 */
export const getZoneRect = (zone: any): any | null => {
    if (!zone) return null
    if (zone.type === 'rect') return zone
    if (typeof zone.getObjects !== 'function') return null
    const objs = zone.getObjects() || []
    return (
        objs.find((o: any) =>
            o.type === 'rect' &&
            (o.name === 'zoneRect' || o.name === 'zone-border' || Array.isArray(o.strokeDashArray))
        ) ||
        objs.find((o: any) => o.type === 'rect') ||
        null
    )
}

/**
 * Detecta se um objeto Fabric e' uma zona de produtos. Aceita varios
 * sinais (flags isGridZone/isProductZone, name, propriedades _zone*) com
 * fallback para "moldura tracejada + sinais zone-specific" para artes
 * legadas onde as flags nao foram serializadas.
 *
 * IMPORTANTE: stroke dashed sozinho NAO e' suficiente — muitos grupos
 * (setas, anotacoes) podem conter rects tracejados. Exigimos sinal extra
 * para evitar falsos positivos que corrompem comportamento do canvas.
 */
export const isLikelyProductZone = (obj: any): boolean => {
    if (!obj) return false
    if (obj.type !== 'group') return false
    if (obj.isGridZone || obj.isProductZone) return true
    if (obj.name === 'gridZone' || obj.name === 'productZoneContainer') return true
    if (
        typeof obj._zonePadding === 'number' &&
        typeof obj._zoneWidth === 'number' &&
        typeof obj._zoneHeight === 'number'
    ) return true
    const rect = getZoneRect(obj)
    if (rect && Array.isArray(rect.strokeDashArray)) {
        return !!(obj._zoneGlobalStyles || obj.zoneName || obj._zoneTemplateSnapshotId || obj.role)
    }
    return false
}

/**
 * Detecta um active selection (selecao multipla provisoria do Fabric).
 */
export const isActiveSelectionObject = (obj: any): boolean =>
    String(obj?.type || '').toLowerCase() === 'activeselection'

/**
 * Conta total de objetos e imagens em um Fabric Canvas runtime.
 *
 * Walks recursivo via `getObjects()` + `clipPath`, com proteção contra
 * referencias circulares via Set visited. Conta TODOS os nodos com
 * `type` (incluindo groups). Erros em getObjects sao silenciosamente
 * ignorados — contagem parcial e' aceitavel para metricas.
 */
export const countFabricObjectsAndImages = (fabricCanvas: any): { objects: number; images: number } => {
    let objects = 0
    let images = 0
    const visited = new Set<any>()

    const walk = (obj: any) => {
        if (!obj) return
        if (visited.has(obj)) return
        visited.add(obj)

        const t = String(obj.type || '').toLowerCase()
        if (t) objects++
        if (t === 'image') images++

        if (typeof obj.getObjects === 'function') {
            try {
                const kids = obj.getObjects() || []
                kids.forEach(walk)
            } catch {
                // ignore
            }
        }
        const clip = (obj as any).clipPath
        if (clip && typeof clip === 'object') walk(clip)
    }

    try {
        const top = fabricCanvas?.getObjects?.() || []
        top.forEach(walk)
    } catch {
        // ignore
    }

    return { objects, images }
}

/**
 * Detecta se um objeto tem binding direto a uma zona via parentZoneId.
 * Util para filtrar cards que ja estao "presos" a uma zona durante
 * fluxos de relayout/contenção.
 */
export const hasParentZoneBinding = (obj: any): boolean => {
    return String((obj as any)?.parentZoneId || '').trim().length > 0
}

/**
 * Heuristica para "card-like" durante reparo de bindings zone↔card.
 * Mais permissiva que isLikelyProductCard: aceita por flag, prefixo,
 * legacy size (_cardWidth/_cardHeight), legacy grid signals (smartGridId/
 * priceMode), parentZoneId direto, ou _zoneSlot.zoneId.
 *
 * Usado por repairLooseZoneCardBindings para encontrar cards que
 * perderam o binding e re-vincular contra a zona apropriada.
 */
export const isCardLikeForZoneBinding = (obj: any): boolean => {
    if (!obj || obj.excludeFromExport || obj.isFrame) return false
    if (obj.type !== 'group') return false
    const hasLegacyCardSize =
        Number.isFinite(Number((obj as any)?._cardWidth)) &&
        Number((obj as any)?._cardWidth) > 0 &&
        Number.isFinite(Number((obj as any)?._cardHeight)) &&
        Number((obj as any)?._cardHeight) > 0
    const hasLegacyGridSignals =
        String((obj as any)?.smartGridId || '').trim().length > 0 ||
        String((obj as any)?.priceMode || '').trim().length > 0
    return !!(
        obj.isSmartObject ||
        obj.isProductCard ||
        String(obj.name || '').startsWith('product-card') ||
        hasLegacyCardSize ||
        hasLegacyGridSignals ||
        String((obj as any)?.parentZoneId || '').trim().length > 0 ||
        String((obj as any)?._zoneSlot?.zoneId || '').trim().length > 0
    )
}

/**
 * Detecta se o objeto E' o priceGroup ou esta DENTRO dele (filho direto).
 * Usado em pipelines de export/seleção que precisam tratar o conjunto da
 * etiqueta como uma unidade (ex: ocultar parts, transformar grupo todo).
 */
export const isPriceGroupOrPriceChild = (obj: any): boolean => {
    if (!obj) return false
    if (String(obj?.name || '') === 'priceGroup') return true
    if (String((obj as any)?.group?.name || '') === 'priceGroup') return true
    return false
}

/**
 * Detecta uma "etiqueta de preco solta" (priceGroup standalone) — um group
 * nomeado priceGroup que NAO esta dentro de um card de produto e nao tem
 * imagem/background de card. Usado para evitar tratar essas etiquetas
 * soltas como cards completos em loops do editor.
 */
export const isStandalonePriceGroup = (obj: any): boolean => {
    if (!obj) return false
    if (obj.type !== 'group' || typeof obj.getObjects !== 'function') return false
    if (String(obj.name || '') !== 'priceGroup') return false

    if (obj.isSmartObject || obj.isProductCard) return false
    if (String((obj as any).parentZoneId || '').trim()) return false
    if (String((obj as any).smartGridId || '').trim()) return false

    const children = obj.getObjects() || []
    const hasOfferBg = children.some((c: any) => String(c?.name || '') === 'offerBackground')
    const hasSmartImage = children.some((c: any) => {
        const t = String(c?.type || '').toLowerCase()
        const n = String(c?.name || '')
        return t === 'image' || ['smart_image', 'product_image', 'productImage'].includes(n)
    })

    return !hasOfferBg && !hasSmartImage
}

/**
 * Detecta se um group e' um "container de card de produto" — qualquer
 * group com flag explicita (isSmartObject/isProductCard), prefixo "product-card"
 * no name, ou que passe na heuristica de isLikelyProductCard.
 *
 * Mais permissivo que isLikelyProductCard: aceita ate cards "vazios"
 * com so a flag, util em loops de seleção que nao querem reanalisar
 * a estrutura interna toda hora.
 */
export const isProductCardContainer = (group: any): boolean => {
    if (!group) return false
    if (String(group.type || '').toLowerCase() !== 'group') return false
    return !!(
        group.isSmartObject ||
        group.isProductCard ||
        String(group.name || '').startsWith('product-card') ||
        isLikelyProductCard(group)
    )
}

/**
 * Detecta um card de produto. Combina sinais fortes (offerBackground,
 * priceGroup embutido, smartGridId, _cardWidth/_cardHeight) com heuristica
 * mais permissiva para cards montados manualmente. A funcao precisa ser
 * tolerante a formatos legados E rejeitar elementos que NAO sao cards
 * (etiquetas soltas, frames, zones, anotacoes).
 */
export const isLikelyProductCard = (obj: any): boolean => {
    if (!obj) return false
    if (obj.excludeFromExport) return false
    if (obj.isFrame) return false
    if (isLikelyProductZone(obj)) return false
    if (obj.type !== 'group' || typeof obj.getObjects !== 'function') return false
    if (isStandalonePriceGroup(obj)) return false

    const pz = String((obj as any).parentZoneId || '').trim()
    if (pz) return true

    const cw = Number((obj as any)._cardWidth)
    const ch = Number((obj as any)._cardHeight)
    if (Number.isFinite(cw) && cw > 0 && Number.isFinite(ch) && ch > 0) return true
    if (String((obj as any).smartGridId || '').trim()) return true
    if (String((obj as any).priceMode || '').trim()) return true

    const children = obj.getObjects() || []
    if (!children.length) return false

    const isText = (o: any) => String(o?.type || '').toLowerCase().includes('text')
    const hasOfferBg = children.some((c: any) => String(c?.name || '') === 'offerBackground')
    const hasBg =
        hasOfferBg ||
        children.some(
            (c: any) =>
                String(c?.type || '').toLowerCase() === 'rect' &&
                /(offerBackground|background|bg)/i.test(String(c?.name || ''))
        )
    const hasPriceGroup = children.some(
        (c: any) =>
            String(c?.type || '').toLowerCase() === 'group' &&
            String(c?.name || '') === 'priceGroup'
    )
    const hasAnyPriceText = children.some((c: any) =>
        /price_(integer|decimal|value|currency|unit)_text/i.test(String(c?.name || ''))
    )
    const hasImage = children.some((c: any) => {
        const t = String(c?.type || '').toLowerCase()
        const n = String(c?.name || '')
        return t === 'image' || ['smart_image', 'product_image', 'productImage'].includes(n)
    })
    const hasTitle = children.some(
        (c: any) => isText(c) && /(^smart_title$|^title$|title)/i.test(String(c?.name || ''))
    )
    const textCount = children.filter((c: any) => isText(c)).length
    const nonTextCount = children.length - textCount

    if (hasOfferBg) return true
    if (hasPriceGroup && (hasImage || hasTitle || textCount >= 1)) return true
    if (textCount >= 1 && nonTextCount >= 1 && (hasImage || hasBg || hasAnyPriceText)) return true

    const signals = [hasPriceGroup, hasImage, hasTitle, hasBg, hasAnyPriceText].filter(Boolean).length
    if (hasAnyPriceText && hasImage && textCount >= 1) return true
    return signals >= 3 || (hasAnyPriceText && textCount >= 2)
}

/**
 * Detecta se o objeto e' do tipo "text-like" do Fabric.
 */
export const isTextLikeObject = (obj: any): boolean => {
    const t = String(obj?.type || '').toLowerCase()
    return t === 'text' || t === 'i-text' || t === 'textbox'
}

/**
 * Walk em profundidade na arvore Fabric. Retorna lista plana com TODOS
 * os descendentes (sem incluir o root). Util para coletar todas as
 * partes de um priceGroup, card ou zone.
 */
export const collectObjectsDeep = (root: any): any[] => {
    const out: any[] = []
    const isGroupLike = (obj: any): boolean => {
        const t = String(obj?.type || '').toLowerCase()
        return t === 'group' && typeof obj.getObjects === 'function'
    }
    const walk = (obj: any) => {
        if (!obj) return
        out.push(obj)
        if (isGroupLike(obj)) {
            const children = obj.getObjects() || []
            children.forEach(walk)
        }
    }
    if (root && typeof root.getObjects === 'function') {
        root.getObjects().forEach(walk)
    }
    return out
}

/**
 * Helper de busca por name dentro de um array (priceGroup, card etc).
 * Funcao tao usada que vale ser explicitamente exportada.
 */
export const findByName = (objects: any[], name: string): any =>
    objects.find((o: any) => o?.name === name)

/**
 * Detecta se um objeto tem mascara aplicada via "object mask" (clipPath
 * com flag `objectMaskEnabled`, distinto do clip de frame que tem
 * `_frameClipOwner`).
 */
export const hasObjectMaskApplied = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    if (!obj.clipPath) return false
    if (obj._frameClipOwner) return false
    return !!obj.objectMaskEnabled
}

/**
 * Detecta um segmento "close path" (Z) num path SVG. Aceita tanto
 * formato array (`['Z']`) quanto string (`'Z'`), ambos case-insensitive.
 */
export const isPathCloseCommand = (segment: any): boolean => {
    if (Array.isArray(segment)) {
        return String(segment[0] || '').toLowerCase() === 'z'
    }
    return String(segment || '').toLowerCase() === 'z'
}

/**
 * Verifica se um fabric.Path tem o caminho fechado:
 *  - flag `isClosedPath: true` (definida quando criado pelo pen tool)
 *  - OU pelo menos um segmento Z em `path[]`
 */
export const isVectorPathClosed = (pathObj: any): boolean => {
    if (!pathObj) return false
    if (pathObj.isClosedPath === true) return true
    const segments = Array.isArray(pathObj.path) ? pathObj.path : []
    return segments.some(isPathCloseCommand)
}

/**
 * Detecta se um objeto deve ser submetido a containment constraints
 * (manter dentro do bounding rect do parent zone/group):
 *
 *  - image: sim, apenas se estiver dentro de um group
 *  - group: sim, apenas se tiver parentZoneId binding
 *  - outros: nao
 */
export const shouldApplyContainmentConstraints = (obj: any): boolean => {
    if (!obj) return false
    if (obj.type === 'image') return !!obj.group
    if (obj.type === 'group') return hasParentZoneBinding(obj)
    return false
}

/**
 * Detecta se um `transformTarget` (alvo do gesture atual) e' relacionado
 * ao `source` (objeto inicialmente clicado). Usado em alt+drag para
 * decidir se um clique em group filho/parent ainda deve continuar
 * duplicando o source escolhido.
 *
 * Relacao positiva:
 *  - source === transformTarget (mesmo objeto)
 *  - source e' group e transformTarget e' filho dele (transformTarget.group === source)
 *  - source.group existe e transformTarget e o parent (=== sourceParent)
 *    ou um sibling (transformTarget.group === sourceParent)
 *
 * Pure: nao acessa refs/canvas.
 */
export const isTransformRelatedToSource = (source: any, transformTarget: any): boolean => {
    if (!source || !transformTarget) return false
    if (transformTarget === source) return true
    const sourceType = String(source?.type || '').toLowerCase()
    if (sourceType === 'group' && transformTarget.group === source) return true
    const sourceParent = source?.group
    if (sourceParent && (transformTarget === sourceParent || transformTarget.group === sourceParent)) return true
    return false
}

/**
 * Encontra o group imediato que contem `obj` em uma lista de objetos
 * do canvas. Pure: dado allObjects + target, faz busca DFS:
 *
 *  1. Se obj.group ja esta setado, retorna direto
 *  2. Varre interactive groups primeiro (subTargetCheck / interactive=true)
 *     que sao os "ativos" de edicao
 *  3. Fallback: varre todos os groups
 *
 * Match por identidade (===) ou por _customId quando disponivel.
 * Retorna o group imediato (mais profundo) que contem o target —
 * nao o root.
 */
export const findParentGroupForObjectInList = (allObjects: any[], obj: any): any => {
    if (!obj) return null
    if (obj.group) return obj.group
    if (!Array.isArray(allObjects)) return null

    const searchInGroup = (group: any): { group: any; depth: number } | null => {
        if (!group || typeof group.getObjects !== 'function') return null
        const children = group.getObjects() || []
        for (const child of children) {
            if (child === obj || (obj._customId && child._customId === obj._customId)) {
                return { group, depth: 0 }
            }
            const t = String(child?.type || '').toLowerCase()
            if (t === 'group') {
                const deeper = searchInGroup(child)
                if (deeper) return deeper
            }
        }
        return null
    }

    for (const canvasObj of allObjects) {
        const t = String(canvasObj?.type || '').toLowerCase()
        if (t !== 'group') continue
        const isInteractive = canvasObj.interactive === true || canvasObj.subTargetCheck === true
        if (isInteractive) {
            const result = searchInGroup(canvasObj)
            if (result) return result.group
        }
    }

    for (const canvasObj of allObjects) {
        const t = String(canvasObj?.type || '').toLowerCase()
        if (t !== 'group') continue
        const result = searchInGroup(canvasObj)
        if (result) return result.group
    }

    return null
}
