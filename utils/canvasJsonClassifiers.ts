/**
 * Classificadores e walkers que operam sobre o JSON serializado do canvas
 * (apos canvas.toJSON()), antes de re-hidratar via loadFromJSON.
 *
 * Espelham os classifiers de runtime em fabricObjectClassifiers.ts mas
 * usam `obj.objects` (campo JSON) em vez de `getObjects()` (metodo Fabric).
 *
 * Util em pre/post-load para reparar/normalizar JSON sem precisar
 * instanciar objetos Fabric reais.
 *
 * Funcoes 100% puras. Cobertura: tests/utils/canvasJsonClassifiers.test.ts
 */

/**
 * DFS no JSON do canvas. Visitor recebe cada nodo (root.objects + descendentes
 * de qualquer profundidade). Implementacao iterativa para evitar stack overflow
 * em projetos com muitos niveis aninhados.
 */
export const walkCanvasObjects = (root: any, visitor: (obj: any) => void): void => {
    if (!root || typeof root !== 'object') return
    const stack: any[] = Array.isArray(root.objects) ? [...root.objects] : []
    while (stack.length > 0) {
        const node = stack.pop()
        if (!node || typeof node !== 'object') continue
        visitor(node)
        if (Array.isArray(node.objects) && node.objects.length) {
            for (let i = node.objects.length - 1; i >= 0; i--) {
                stack.push(node.objects[i])
            }
        }
    }
}

/**
 * Obtem children validos (apenas objetos) de um nodo JSON tipo group.
 * Filtra null/undefined para que callers nao precisem se preocupar.
 */
export const getJsonGroupChildren = (obj: any): any[] =>
    Array.isArray(obj?.objects)
        ? obj.objects.filter((child: any) => !!child && typeof child === 'object')
        : []

/**
 * Versao JSON de isStandalonePriceGroup. Detecta uma etiqueta de preco
 * "solta" em JSON serializado (priceGroup top-level que NAO esta dentro de
 * um card e nao tem imagem/background de card).
 */
export const isStandalonePriceGroupJson = (obj: any): boolean => {
    if (!obj) return false
    if (obj.type !== 'group') return false
    if (String(obj.name || '') !== 'priceGroup') return false
    if (obj.isSmartObject || obj.isProductCard) return false
    if (String((obj as any).parentZoneId || '').trim()) return false
    if (String((obj as any).smartGridId || '').trim()) return false

    const children = getJsonGroupChildren(obj)
    const hasOfferBg = children.some((child: any) => String(child?.name || '') === 'offerBackground')
    const hasSmartImage = children.some((child: any) => {
        const childType = String(child?.type || '').toLowerCase()
        const childName = String(child?.name || '')
        return childType === 'image' || ['smart_image', 'product_image', 'productImage'].includes(childName)
    })

    return !hasOfferBg && !hasSmartImage
}

/**
 * Versao JSON de isLikelyProductCard. Espelha exatamente a heuristica
 * runtime mas opera no JSON serializado.
 */
export const isLikelyProductCardJson = (obj: any): boolean => {
    if (!obj) return false
    if (obj.excludeFromExport || obj.isFrame) return false
    if (obj.type !== 'group') return false
    if (isStandalonePriceGroupJson(obj)) return false

    const parentZoneId = String((obj as any).parentZoneId || '').trim()
    if (parentZoneId) return true

    const cardWidth = Number((obj as any)._cardWidth)
    const cardHeight = Number((obj as any)._cardHeight)
    if (Number.isFinite(cardWidth) && cardWidth > 0 && Number.isFinite(cardHeight) && cardHeight > 0) return true
    if (String((obj as any).smartGridId || '').trim()) return true
    if (String((obj as any).priceMode || '').trim()) return true
    if (obj.isSmartObject || obj.isProductCard) return true

    const children = getJsonGroupChildren(obj)
    if (!children.length) return false

    const isTextLike = (child: any) => String(child?.type || '').toLowerCase().includes('text')
    const hasOfferBg = children.some((child: any) => String(child?.name || '') === 'offerBackground')
    const hasBg =
        hasOfferBg ||
        children.some(
            (child: any) =>
                String(child?.type || '').toLowerCase() === 'rect' &&
                /(offerBackground|background|bg)/i.test(String(child?.name || ''))
        )
    const hasPriceGroup = children.some(
        (child: any) =>
            String(child?.type || '').toLowerCase() === 'group' &&
            String(child?.name || '') === 'priceGroup'
    )
    const hasAnyPriceText = children.some((child: any) =>
        /price_(integer|decimal|value|currency|unit)_text/i.test(String(child?.name || ''))
    )
    const hasImage = children.some((child: any) => {
        const childType = String(child?.type || '').toLowerCase()
        const childName = String(child?.name || '')
        return childType === 'image' || ['smart_image', 'product_image', 'productImage'].includes(childName)
    })
    const hasTitle = children.some(
        (child: any) => isTextLike(child) && /(^smart_title$|^title$|title)/i.test(String(child?.name || ''))
    )
    const textCount = children.filter((child: any) => isTextLike(child)).length
    const nonTextCount = children.length - textCount

    if (hasOfferBg) return true
    if (hasPriceGroup && (hasImage || hasTitle || textCount >= 1)) return true
    if (textCount >= 1 && nonTextCount >= 1 && (hasImage || hasBg || hasAnyPriceText)) return true

    const signals = [hasPriceGroup, hasImage, hasTitle, hasBg, hasAnyPriceText].filter(Boolean).length
    if (hasAnyPriceText && hasImage && textCount >= 1) return true
    return signals >= 3 || (hasAnyPriceText && textCount >= 2)
}

/**
 * Extrai a dimensao "base" do card (largura x altura) a partir do JSON.
 * Tenta na ordem: _cardWidth/_cardHeight > offerBackground > card.width/height.
 * Retorna null se nada estiver disponivel.
 *
 * Usado em containment / collision detection durante post-load.
 */
export const getCardBaseSizeForContainmentJson = (card: any): { w: number; h: number } | null => {
    if (!card) return null
    const storedW = Number((card as any)._cardWidth)
    const storedH = Number((card as any)._cardHeight)
    if (Number.isFinite(storedW) && storedW > 0 && Number.isFinite(storedH) && storedH > 0) {
        return { w: storedW, h: storedH }
    }

    const bg = getJsonGroupChildren(card).find(
        (child: any) =>
            child?.name === 'offerBackground' &&
            String(child?.type || '').toLowerCase() === 'rect'
    )
    const bgW = Number(bg?.width)
    const bgH = Number(bg?.height)
    if (Number.isFinite(bgW) && bgW > 0 && Number.isFinite(bgH) && bgH > 0) {
        return { w: bgW, h: bgH }
    }

    const cardW = Number(card?.width)
    const cardH = Number(card?.height)
    if (Number.isFinite(cardW) && cardW > 0 && Number.isFinite(cardH) && cardH > 0) {
        return { w: cardW, h: cardH }
    }

    return null
}
