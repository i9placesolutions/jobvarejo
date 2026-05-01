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

import { collectObjectsDeep } from './fabricObjectClassifiers'

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
 * Detecta se um valor coerce para Number e e finito. Usado para
 * validar coordenadas, escalas e fontSizes em layouts de preco
 * (snapshot/restore protege contra NaN/Infinity).
 */
export const isFiniteLayoutNumber = (value: any): boolean => {
    const n = Number(value)
    return Number.isFinite(n)
}

/**
 * Sobe pela cadeia `obj.group` ate encontrar um group que parece
 * ser o card host (smartObject, productCard, name `product-card*`,
 * ou contendo offerBackground). Retorna null se nao houver.
 *
 * Usado para resolver o card que contem um price group filho.
 */
export const getCardHostForPriceGroup = (group: any): any | null => {
    let cur: any = group?.group || null
    while (cur) {
        const name = String(cur?.name || '')
        const isCardLike =
            (String(cur?.type || '').toLowerCase() === 'group') &&
            (
                !!cur?.isSmartObject ||
                !!cur?.isProductCard ||
                name.startsWith('product-card') ||
                (typeof cur.getObjects === 'function' && (cur.getObjects() || []).some((o: any) => String(o?.name || '') === 'offerBackground'))
            )
        if (isCardLike) return cur
        cur = cur.group || null
    }
    return null
}

/**
 * Resolve as dimensoes do card host de um price group: prefere
 * `_cardWidth`/`_cardHeight` (manualmente seteadas), senao usa
 * `width`/`height` ou `getScaledWidth/Height`. Retorna null se
 * dimensoes invalidas (NaN, < 20px, sem host).
 */
export const getCardSizeForPriceGroup = (group: any): { width: number; height: number } | null => {
    const host = getCardHostForPriceGroup(group)
    if (!host) return null
    const width = Math.abs(Number(host?._cardWidth ?? host?.width ?? host?.getScaledWidth?.() ?? 0) || 0)
    const height = Math.abs(Number(host?._cardHeight ?? host?.height ?? host?.getScaledHeight?.() ?? 0) || 0)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 20 || height < 20) return null
    return { width, height }
}

/**
 * Detecta um price layout corrompido — coordenadas/escalas NaN/Infinity,
 * escala zero (objeto invisivel mas presente), coordenadas absurdas
 * (>100k px), ou fontSize invalido em texto visivel.
 *
 * Usado como guard antes de salvar snapshot: nao adianta tentar
 * preservar layout de um group que foi corrompido por bug em outra
 * parte do pipeline.
 *
 * Pure: opera apenas sobre o objeto duck-typed.
 */
export const hasCorruptedPriceLayout = (group: any): boolean => {
    if (!group || typeof group.getObjects !== 'function') return false
    if (!isFiniteLayoutNumber(group?.scaleX) || !isFiniteLayoutNumber(group?.scaleY)) return true
    if (Math.abs(Number(group?.scaleX || 0)) < 0.0001 || Math.abs(Number(group?.scaleY || 0)) < 0.0001) return true

    const nodes = collectObjectsDeep(group).filter((o: any) => isPriceLayoutNode(o))
    if (!nodes.length) return false

    for (const node of nodes) {
        if (!isFiniteLayoutNumber(node?.left) || !isFiniteLayoutNumber(node?.top)) return true
        if (!isFiniteLayoutNumber(node?.scaleX) || !isFiniteLayoutNumber(node?.scaleY)) return true
        if (Math.abs(Number(node?.left || 0)) > 100000 || Math.abs(Number(node?.top || 0)) > 100000) return true

        const hidden = node?.visible === false
        if (!hidden) {
            if (Math.abs(Number(node?.scaleX || 0)) < 0.0001 || Math.abs(Number(node?.scaleY || 0)) < 0.0001) return true
        }

        const tt = String(node?.type || '').toLowerCase()
        const isText = tt === 'text' || tt === 'i-text' || tt === 'itext' || tt === 'textbox'
        if (isText && !hidden) {
            if (!isFiniteLayoutNumber(node?.fontSize) || Number(node?.fontSize || 0) <= 0) return true
        }
    }

    return false
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

/**
 * Helper: heuristica para detectar se um group "parece" um priceGroup
 * mesmo que nao tenha `name === 'priceGroup'`. Usa estrutura: pelo
 * menos um rect (background) + pelo menos 1 text ou circle/ellipse
 * (currency).
 *
 * Tambem aceita se algum filho passa `isPriceLayoutNode` (sinal forte).
 *
 * Rejeita se o group e' um card container (`isCardContainerLikeGroup`).
 *
 * Pure: sem efeito colateral.
 */
const looksLikePriceGroup = (g: any): boolean => {
    if (!g || g.type !== 'group' || typeof g.getObjects !== 'function') return false
    if (isCardContainerLikeGroup(g)) return false
    const kids = g.getObjects() || []
    if (kids.length < 2 || kids.length > 10) return false

    if (kids.some((k: any) => isPriceLayoutNode(k))) return true

    let hasRect = false
    let textCount = 0
    let hasCircleOrEllipse = false

    for (const k of kids) {
        const t = String(k?.type || '').toLowerCase()
        if (t === 'rect') hasRect = true
        if (t === 'text' || t === 'i-text' || t === 'itext' || t === 'textbox') textCount++
        if (t === 'circle' || t === 'ellipse') hasCircleOrEllipse = true
    }

    return hasRect && (textCount >= 1 || hasCircleOrEllipse)
}

/**
 * Encontra o priceGroup associado a `obj`, percorrendo:
 *  1. Direct: obj e' um group com name === 'priceGroup'
 *  2. Heuristic direct: obj e' um group sem name mas com estrutura de priceGroup
 *     (e' renomeado para 'priceGroup' como side-effect — repair)
 *  3. Walk-up: percorre obj.group ate achar um priceGroup (com mesmo repair)
 *  4. Walk-down: se obj for um card group, BFS ate achar o priceGroup interno
 *
 * Retorna null se nao encontrar.
 *
 * SIDE EFFECT: pode setar `name = 'priceGroup'` em groups misnomeados —
 * facilita operacoes futuras pelas duas partes (caller e a heuristica).
 */
export const getPriceGroupFromAny = (obj: any): any | null => {
    if (!obj) return null

    if (obj.type === 'group' && obj.name === 'priceGroup') {
        if (!isMisnamedProductCardGroup(obj)) return obj
    }

    if (obj.type === 'group' && !obj.name && looksLikePriceGroup(obj)) {
        obj.name = 'priceGroup'
        return obj
    }

    let cur: any = obj
    while (cur && cur.group) {
        if (cur.group.type === 'group' && cur.group.name === 'priceGroup') {
            if (!isMisnamedProductCardGroup(cur.group)) return cur.group
        }
        if (cur.group.type === 'group' && !cur.group.name && looksLikePriceGroup(cur.group)) {
            cur.group.name = 'priceGroup'
            return cur.group
        }
        cur = cur.group
    }

    if (obj.type === 'group' && typeof obj.getObjects === 'function') {
        const queue: any[] = [...(obj.getObjects() || [])]
        while (queue.length) {
            const node = queue.shift()
            if (!node) continue
            if (node.type === 'group' && node.name === 'priceGroup') {
                if (!isMisnamedProductCardGroup(node)) return node
            }
            if (node.type === 'group' && !node.name && looksLikePriceGroup(node)) {
                node.name = 'priceGroup'
                return node
            }
            if (node.type === 'group' && typeof node.getObjects === 'function') {
                const kids = node.getObjects() || []
                for (const k of kids) queue.push(k)
            }
        }
    }

    return null
}

/**
 * Encontra o card group (smartObject ou productCard) associado a `obj`:
 *  - Direct: `obj` ja e' um card group
 *  - Walk-up: percorre `obj.group` ate achar um
 *
 * Retorna null se nao encontrar.
 */
export const getCardGroupFromAny = (obj: any): any | null => {
    if (!obj) return null
    if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard)) return obj
    let cur: any = obj
    while (cur && cur.group) {
        if (cur.group.type === 'group' && (cur.group.isSmartObject || cur.group.isProductCard)) return cur.group
        cur = cur.group
    }
    return null
}
