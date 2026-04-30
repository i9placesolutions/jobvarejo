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
