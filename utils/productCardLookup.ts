/**
 * Helpers puros de lookup dentro de um product card (Fabric Group).
 * Resolvem children canonicos (background, title, limit) por name +
 * heuristicas de fallback (tipo + posicao).
 *
 * Sem dependencia de canvas/refs. Operam apenas sobre o card
 * duck-typed via getObjects().
 *
 * Cobertura: tests/utils/productCardLookup.test.ts
 */

/**
 * Encontra o rect de fundo de um card. Estrategia em 3 passos:
 *
 *  1. Busca por name === 'offerBackground' (canonico)
 *  2. Busca por name matching /offerBackground|background|bg/i (legacy)
 *  3. Fallback: maior rect por area (largura * altura * escalas)
 *
 * Retorna null se card invalido ou sem children rect.
 */
export const getCardBackgroundRect = (card: any): any | null => {
    if (!card || typeof card.getObjects !== 'function') return null
    const objects = card.getObjects() || []
    const byName = objects.find((o: any) =>
        String(o?.name || '') === 'offerBackground' &&
        String(o?.type || '').toLowerCase() === 'rect'
    )
    if (byName) return byName
    const byPattern = objects.find((o: any) =>
        String(o?.type || '').toLowerCase() === 'rect' &&
        /(offerBackground|background|bg)/i.test(String(o?.name || ''))
    )
    if (byPattern) return byPattern
    let largestRect: any = null
    let largestArea = -1
    objects.forEach((o: any) => {
        if (String(o?.type || '').toLowerCase() !== 'rect') return
        const area = Number(o?.width || 0) * Number(o?.height || 0) *
                     Number(o?.scaleX || 1) * Number(o?.scaleY || 1)
        if (area > largestArea) {
            largestArea = area
            largestRect = o
        }
    })
    return largestRect
}

/**
 * Encontra o text do titulo do card. Prefere name === 'smart_title';
 * fallback: text mais alto (menor `top`) entre os tipos text/i-text/
 * textbox. Retorna null se card invalido ou sem children text.
 */
export const getCardTitleText = (card: any): any | null => {
    if (!card || typeof card.getObjects !== 'function') return null
    const objects = card.getObjects() || []
    const named = objects.find((o: any) => String(o?.name || '') === 'smart_title')
    if (named) return named
    let topMostText: any = null
    let topMost = Number.POSITIVE_INFINITY
    objects.forEach((o: any) => {
        const t = String(o?.type || '').toLowerCase()
        const isText = t === 'text' || t === 'i-text' || t === 'textbox'
        if (!isText) return
        const top = Number.isFinite(Number(o?.top)) ? Number(o.top) : Number.POSITIVE_INFINITY
        if (top <= topMost) {
            topMost = top
            topMostText = o
        }
    })
    return topMostText
}

/**
 * Encontra o text do limite (LIMITE 3UN) do card. Aceita os names
 * canonicos `smart_limit`, `limitText`, `product_limit`, ou children
 * com `data.smartType === 'product-limit'`. Retorna null se card
 * invalido ou sem limit.
 */
export const getCardLimitText = (card: any): any | null => {
    if (!card || typeof card.getObjects !== 'function') return null
    const objects = card.getObjects() || []
    return objects.find((o: any) =>
        String(o?.name || '') === 'smart_limit' ||
        String(o?.name || '') === 'limitText' ||
        String(o?.name || '') === 'product_limit' ||
        String(o?.data?.smartType || '') === 'product-limit'
    ) || null
}
