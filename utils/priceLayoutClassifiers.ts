/**
 * Classificadores e helpers puros para layout de preco/etiqueta:
 * detectar nodos de price layout (texto, unidade, simbolo) por nome,
 * detectar containers de card produto, e gerar chaves estaveis para
 * mapear nodos de uma render para a proxima.
 *
 * Sem dependencia de canvas/refs. Operam apenas sobre o objeto
 * Fabric duck-typed.
 *
 * Cobertura: tests/utils/priceLayoutClassifiers.test.ts
 */

/**
 * Prefixos de nome que identificam um nodo de price layout. Cada
 * prefixo cobre uma variante de etiqueta (regular, varejo, atacado).
 */
export const PRICE_LAYOUT_NODE_PREFIXES = ['price_', 'retail_', 'wholesale_', 'atac_']

/**
 * Names exatos que identificam um nodo de price layout. Mantido como
 * Set para lookup O(1).
 */
export const PRICE_LAYOUT_NODE_EXACT = new Set<string>([
    'priceGroup',
    'priceSymbol',
    'price_currency',
    'priceInteger',
    'priceDecimal',
    'priceUnit',
    'smart_price',
    'price_value_text'
])

/**
 * Detecta um nodo de price layout pelo seu name. Combina lookup exato
 * (PRICE_LAYOUT_NODE_EXACT) e prefix match (PRICE_LAYOUT_NODE_PREFIXES).
 * Trim defensivo no input.
 */
export const isPriceLayoutNode = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    const name = String(obj?.name || '').trim()
    if (!name) return false
    if (PRICE_LAYOUT_NODE_EXACT.has(name)) return true
    return PRICE_LAYOUT_NODE_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/**
 * Detecta um group que e' container de card produto (smartObject,
 * productCard, parentZoneId, smartGridId, ou contem children com
 * names canonicos do card como `offerBackground`, `smart_title`,
 * `smart_image`, etc).
 *
 * Usa group.getObjects() para inspecionar children.
 */
export const isCardContainerLikeGroup = (group: any): boolean => {
    if (!group || String(group?.type || '').toLowerCase() !== 'group') return false
    if (group?.isSmartObject || group?.isProductCard) return true
    if (String(group?.name || '').startsWith('product-card')) return true
    if (String((group as any)?.parentZoneId || '').trim()) return true
    if (String((group as any)?.smartGridId || '').trim()) return true
    if (typeof group.getObjects !== 'function') return false
    const children = group.getObjects() || []
    if (!children.length) return false
    return children.some((child: any) => {
        const n = String(child?.name || '')
        return n === 'offerBackground'
            || n === 'smart_title'
            || n === 'smart_limit'
            || n === 'smart_image'
            || n === 'product_image'
            || n === 'productImage'
    })
}

/**
 * Detecta o caso erro: um group com name "priceGroup" mas que e
 * na verdade um card container (children sao card content, nao
 * apenas price tag). Usado para evitar falso-positivos em
 * isLikelyPriceGroupObject.
 */
export const isMisnamedProductCardGroup = (group: any): boolean => {
    if (!group || String(group?.type || '').toLowerCase() !== 'group') return false
    if (String(group?.name || '') !== 'priceGroup') return false
    return isCardContainerLikeGroup(group)
}

/**
 * Cria uma factory de chaves para mapear nodos por (name|type) +
 * indice de ocorrencia. Usado para correlacionar nodos antes/depois
 * de uma re-renderizacao do template (preserva metadata/runtime).
 *
 * Comportamento:
 *  - mantem contador interno por base (Map fechado no closure)
 *  - cada chamada incrementa o indice da base usada
 *  - retorna `${base}#${idx}` (ex: `priceInteger#0`, `priceInteger#1`)
 *
 * Uso tipico:
 *   const buildKey = makePriceLayoutKeyBuilder()
 *   const keys = nodes.map(buildKey)
 */
export const makePriceLayoutKeyBuilder = (): (obj: any) => string => {
    const counters = new Map<string, number>()
    return (obj: any): string => {
        const base = String(obj?.name || obj?.type || 'node')
        const idx = counters.get(base) ?? 0
        counters.set(base, idx + 1)
        return `${base}#${idx}`
    }
}
