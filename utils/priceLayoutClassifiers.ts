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

import { collectObjectsDeep, findByName } from './fabricObjectClassifiers'

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

/**
 * Encontra o candidato a "background" de um single-price layout entre
 * `objects`. Estrategia:
 *  1. Por nome canonico: `price_bg`, `price_bg_image`, `splash_image`
 *  2. Fallback: maior `image` ou `rect` por area (excluindo currency_bg,
 *     header_bg e nodes com prefixo atac_/retail_/wholesale_)
 *
 * Retorna o objeto Fabric encontrado ou null.
 */
export const getSinglePriceBackgroundCandidate = (objects: any[]): any | null => {
    const named =
        findByName(objects, 'price_bg') ||
        findByName(objects, 'price_bg_image') ||
        findByName(objects, 'splash_image')
    if (named) return named

    const candidates = (objects || []).filter((obj: any) => {
        if (!obj || typeof obj !== 'object') return false
        const type = String(obj?.type || '').toLowerCase()
        if (type !== 'image' && type !== 'rect') return false
        const name = String(obj?.name || '')
        if (name === 'price_currency_bg' || name === 'priceSymbolBg') return false
        if (name === 'price_header_bg') return false
        if (name.startsWith('atac_') || name.startsWith('retail_') || name.startsWith('wholesale_')) return false
        return true
    })
    if (!candidates.length) return null

    const getArea = (obj: any) => {
        const width = Number(obj?.width || 0)
        const height = Number(obj?.height || 0)
        const scaleX = Math.abs(Number(obj?.scaleX ?? (String(obj?.type || '').toLowerCase() === 'image' ? 1 : 0))) || 1
        const scaleY = Math.abs(Number(obj?.scaleY ?? (String(obj?.type || '').toLowerCase() === 'image' ? 1 : 0))) || 1
        const effectiveArea = width * height * scaleX * scaleY
        if (Number.isFinite(effectiveArea) && effectiveArea > 0) return effectiveArea
        return Math.max(1, width) * Math.max(1, height)
    }

    return candidates.sort((a: any, b: any) => getArea(b) - getArea(a))[0] || null
}

/**
 * Versao restritiva de `getSinglePriceBackgroundCandidate` — aceita
 * SOMENTE imagens (nao rect). Usado quando o layout exige fundo
 * raster (e.g. splash_image stripped detection).
 */
export const getSinglePriceBackgroundImageCandidate = (objects: any[]): any | null => {
    const named =
        findByName(objects, 'price_bg_image') ||
        findByName(objects, 'splash_image')
    if (named && String(named?.type || '').toLowerCase() === 'image') return named

    const candidates = (objects || []).filter((obj: any) => {
        if (!obj || typeof obj !== 'object') return false
        if (String(obj?.type || '').toLowerCase() !== 'image') return false
        const name = String(obj?.name || '')
        if (name === 'price_currency_bg' || name === 'priceSymbolBg') return false
        if (name === 'price_header_bg') return false
        if (name.startsWith('atac_') || name.startsWith('retail_') || name.startsWith('wholesale_')) return false
        return true
    })

    const getArea = (obj: any) => {
        const width = Number(obj?.width || 0)
        const height = Number(obj?.height || 0)
        const scaleX = Math.abs(Number(obj?.scaleX ?? 1)) || 1
        const scaleY = Math.abs(Number(obj?.scaleY ?? 1)) || 1
        return Math.max(1, width) * Math.max(1, height) * scaleX * scaleY
    }

    return candidates.sort((a: any, b: any) => getArea(b) - getArea(a))[0] || null
}

/**
 * Encontra o text node do simbolo de moeda (R$) em single-price layout.
 * Ordem de preferencia:
 *   `price_currency_text` → `priceSymbol` → `price_currency`
 */
export const getSinglePriceCurrencyTextCandidate = (objects: any[]): any | null =>
    findByName(objects, 'price_currency_text') ||
    findByName(objects, 'priceSymbol') ||
    findByName(objects, 'price_currency')

/**
 * Detecta se um group "parece" ser um priceGroup. Combina checagens:
 *  1. Tipo deve ser group → caso contrario, false
 *  2. NAO pode ser misnamed product card group
 *  3. Se o nome e' exatamente 'priceGroup': true
 *  4. NAO pode ser um card container
 *  5. Se passa `shouldPreserveManualTemplateVisualCheck` (manual layout): true
 *  6. Tem getObjects + algum filho e' priceLayoutNode: true
 *  7. Caso contrario: false
 *
 * `shouldPreserveManualTemplateVisualCheck` injetado para evitar
 * dependencia direta de `templateSnapshotHelpers`.
 */
export const isLikelyPriceGroupObject = (
    group: any,
    shouldPreserveManualTemplateVisualCheck: (g: any) => boolean
): boolean => {
    if (!group || String(group?.type || '').toLowerCase() !== 'group') return false
    if (isMisnamedProductCardGroup(group)) return false
    if (String(group?.name || '') === 'priceGroup') return true
    if (isCardContainerLikeGroup(group)) return false
    if (shouldPreserveManualTemplateVisualCheck(group)) return true
    if (typeof group.getObjects !== 'function') return false
    return (group.getObjects() || []).some((child: any) => isPriceLayoutNode(child))
}

/**
 * Repara nomes de texts em um group atacarejo quando Fabric v7 droppou
 * os names durante deserializacao. Funciona em 2 fases:
 *
 *  1. Particiona os text nodes em "retail" vs "wholesale" pela posicao
 *     vertical (acima/abaixo do midpoint dos backgrounds)
 *  2. Para cada particao, identifica currency/integer/decimal/unit/pack
 *     pelo conteudo do texto (regex) e atribui o name correspondente
 *     (`retail_currency_text`, etc).
 *
 * Sem-op se nao ha `atac_retail_bg` no array (nao e' atacarejo).
 *
 * Mutates os texts in place. Sem retorno.
 */
export const repairAtacarejoTextNames = (all: any[]): void => {
    const retailBg = findByName(all, 'atac_retail_bg')
    const wholesaleBg = findByName(all, 'atac_wholesale_bg')
    if (!retailBg) return

    const texts = all.filter((o: any) => {
        if (!o || typeof o.set !== 'function') return false
        const t = String(o?.type || '').toLowerCase()
        if (t !== 'text' && t !== 'i-text' && t !== 'textbox') return false
        const n = String(o?.name || '')
        if (n.startsWith('retail_') || n.startsWith('wholesale_') || n === 'wholesale_banner_text') return false
        return true
    })
    if (!texts.length) return

    const getBgCenter = (bg: any) => {
        if (!bg) return null
        const oy = String(bg.originY || 'center')
        const h = (bg.height ?? 0) * (bg.scaleY ?? 1)
        const top = bg.top ?? 0
        if (oy === 'center') return top
        if (oy === 'top') return top + h / 2
        return top - h / 2
    }

    const retailCY = getBgCenter(retailBg)
    const wholesaleCY = getBgCenter(wholesaleBg)

    const assignNames = (tierTexts: any[], prefix: 'retail' | 'wholesale') => {
        let currency: any = null
        let integer: any = null
        let decimal: any = null
        let unit: any = null
        let pack: any = null

        if (findByName(all, `${prefix}_integer_text`)) return

        for (const t of tierTexts) {
            const txt = String(t?.text || '').trim()
            if (!txt) continue
            if (!currency && /^R?\$$/i.test(txt)) { currency = t; continue }
            if (!decimal && /^,\d{1,2}$/.test(txt)) { decimal = t; continue }
            if (!integer && /^\d{1,5}$/.test(txt)) { integer = t; continue }
            if (!unit && /^[\/]?(?:UN[D.]?|KG|LT|ML|G|GR|PCT)\.?$/i.test(txt)) { unit = t; continue }
            if (!pack && txt.length > 5 && /\d/.test(txt)) { pack = t; continue }
        }

        const shouldRename = (obj: any) => !obj.name || String(obj.name).startsWith('price_')
        if (currency && shouldRename(currency)) currency.name = `${prefix}_currency_text`
        if (integer && shouldRename(integer)) integer.name = `${prefix}_integer_text`
        if (decimal && shouldRename(decimal)) decimal.name = `${prefix}_decimal_text`
        if (unit && shouldRename(unit)) unit.name = `${prefix}_unit_text`
        if (pack && shouldRename(pack)) pack.name = `${prefix}_pack_line_text`
    }

    if (retailCY !== null && wholesaleCY !== null) {
        const mid = (retailCY + wholesaleCY) / 2
        const retailTexts = texts.filter((t: any) => (t.top ?? 0) <= mid)
        const wholesaleTexts = texts.filter((t: any) => (t.top ?? 0) > mid)
        assignNames(retailTexts, 'retail')
        assignNames(wholesaleTexts, 'wholesale')
    } else if (retailCY !== null) {
        assignNames(texts, 'retail')
    }
}

/**
 * Detecta se um priceGroup manual ficou com geometry "colapsada":
 *  - manualTemplateBaseW/H <= 2.5 (degenerated)
 *  - bounds totais < 18x10
 *  - background bounds < 18x10
 *  - texts com scale < 0.02 + clusterizados em origin (0,0)
 *
 * Retorna true SOMENTE para templates manuais NAO atacarejo NAO red burst
 * (esses tem propria heuristica). Skip se shouldPreserveCheck retorna false.
 *
 * Caller injeta:
 *  - `shouldPreserveCheck` (shouldPreserveManualTemplateVisual)
 *  - `isRedBurstCheck` (isRedBurstPriceGroup)
 *  - `measureContentBounds` (measureContentBoundsLocal de fabricMeasure)
 *  - `getBackgroundCandidate` (getSinglePriceBackgroundCandidate, ja exportado neste modulo)
 *  - `isShownForBounds` (isObjectShownForBounds de fabricMeasure)
 */
export const hasCollapsedSinglePriceTemplateGeometry = (
    priceGroup: any,
    shouldPreserveCheck: (g: any) => boolean,
    isRedBurstCheck: (g: any) => boolean,
    measureContentBounds: (objs: any[]) => any,
    isShownForBounds: (obj: any) => boolean
): boolean => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false
    if (!shouldPreserveCheck(priceGroup)) return false

    const all = collectObjectsDeep(priceGroup)
    if (findByName(all, 'atac_retail_bg')) return false
    if (isRedBurstCheck(priceGroup)) return false

    const priceText = findByName(all, 'price_value_text') || findByName(all, 'smart_price')
    const integer = findByName(all, 'price_integer_text') || findByName(all, 'priceInteger') || findByName(all, 'price_integer')
    const decimal = findByName(all, 'price_decimal_text') || findByName(all, 'priceDecimal') || findByName(all, 'price_decimal')
    if (!(priceText || (integer && decimal))) return false

    const baseW = Number((priceGroup as any).__manualTemplateBaseW)
    const baseH = Number((priceGroup as any).__manualTemplateBaseH)
    const visibleChildren = all.filter((o: any) => o && o !== priceGroup && isShownForBounds(o))
    const bounds = measureContentBounds(visibleChildren)
    const background = getSinglePriceBackgroundCandidate(all)
    const backgroundBounds = background ? measureContentBounds([background]) : null
    const textNodes = [
        findByName(all, 'price_currency_text') || findByName(all, 'priceSymbol') || findByName(all, 'price_currency'),
        integer,
        decimal,
        findByName(all, 'price_unit_text') || findByName(all, 'priceUnit') || findByName(all, 'price_unit'),
        priceText
    ].filter(Boolean) as any[]
    const tinyScales = textNodes.filter((obj: any) => {
        const sx = Math.abs(Number(obj?.scaleX ?? 1))
        const sy = Math.abs(Number(obj?.scaleY ?? 1))
        return sx > 0 && sy > 0 && (sx < 0.02 || sy < 0.02)
    }).length
    const clusteredAtOrigin = textNodes.length > 0 && textNodes.every((obj: any) =>
        Math.abs(Number(obj?.left || 0)) < 0.02 && Math.abs(Number(obj?.top || 0)) < 0.02
    )

    return (
        (Number.isFinite(baseW) && baseW > 0 && baseW <= 2.5) ||
        (Number.isFinite(baseH) && baseH > 0 && baseH <= 2.5) ||
        (!!bounds && (bounds.width < 18 || bounds.height < 10)) ||
        (!!backgroundBounds && (backgroundBounds.width < 18 || backgroundBounds.height < 10)) ||
        (tinyScales >= Math.max(2, textNodes.length - 1) && clusteredAtOrigin)
    )
}

/**
 * Encontra o "circle" do simbolo de moeda em single-price layout.
 * Tenta primeiro pelo nome canonico (`price_currency_bg`/`priceSymbolBg`),
 * depois por heuristica de scoring:
 *  - Tipo: circle/ellipse/rect
 *  - Aspect ratio quase quadrado (>= 0.72)
 *  - Area significativa (>= 64) mas nao gigante (< 45% do bg area)
 *  - Posicao: contem o centro do currency text OU overlap > 15% OU
 *    distancia < max(width, height) * 0.75
 *
 * Score final favorece: containsCenter (1000), overlapRatio (500),
 * aspectRatio (100) e penaliza distance.
 *
 * `currencyTextOverride` opcional — caller pode passar um text node
 * ja encontrado para evitar relookup.
 *
 * Caller injeta:
 *  - `measureContentBounds` (measureContentBoundsLocal)
 *  - `isShownForBounds` (isObjectShownForBounds)
 *  - `isTextLike` (isTextLikeObject)
 */
export const getSinglePriceCurrencyCircleCandidate = (
    objects: any[],
    currencyTextOverride: any | undefined,
    measureContentBounds: (objs: any[]) => any,
    isShownForBounds: (obj: any) => boolean,
    isTextLike: (obj: any) => boolean
): any | null => {
    const named = findByName(objects, 'price_currency_bg') || findByName(objects, 'priceSymbolBg')
    if (named) return named

    const currencyText = currencyTextOverride || getSinglePriceCurrencyTextCandidate(objects)
    if (!currencyText) return null

    const currencyBounds = measureContentBounds([currencyText])
    if (!currencyBounds) return null

    const currencyCenterX = (currencyBounds.left + currencyBounds.right) / 2
    const currencyCenterY = (currencyBounds.top + currencyBounds.bottom) / 2
    const currencyArea = Math.max(1, currencyBounds.width * currencyBounds.height)
    const bg = getSinglePriceBackgroundCandidate(objects)
    const bgBounds = bg ? measureContentBounds([bg]) : null
    const bgArea = bgBounds ? Math.max(1, bgBounds.width * bgBounds.height) : Number.POSITIVE_INFINITY

    const candidates = (objects || [])
        .map((obj: any) => {
            if (!obj || obj === currencyText || !isShownForBounds(obj)) return null
            if (isTextLike(obj)) return null

            const type = String(obj?.type || '').toLowerCase()
            if (type !== 'circle' && type !== 'ellipse' && type !== 'rect') return null

            const name = String(obj?.name || '')
            if (name === 'price_bg' || name === 'price_bg_image' || name === 'splash_image' || name === 'price_header_bg') return null
            if (name.startsWith('atac_') || name.startsWith('retail_') || name.startsWith('wholesale_')) return null

            const bounds = measureContentBounds([obj])
            if (!bounds) return null

            const area = Math.max(1, bounds.width * bounds.height)
            const aspectRatio = Math.min(bounds.width, bounds.height) / Math.max(bounds.width, bounds.height)
            if (!Number.isFinite(area) || area < 64) return null
            if (!Number.isFinite(aspectRatio) || aspectRatio < 0.72) return null
            if (Number.isFinite(bgArea) && bgArea > 0 && area >= (bgArea * 0.45)) return null

            const centerX = (bounds.left + bounds.right) / 2
            const centerY = (bounds.top + bounds.bottom) / 2
            const overlapW = Math.max(0, Math.min(currencyBounds.right, bounds.right) - Math.max(currencyBounds.left, bounds.left))
            const overlapH = Math.max(0, Math.min(currencyBounds.bottom, bounds.bottom) - Math.max(currencyBounds.top, bounds.top))
            const overlapRatio = (overlapW * overlapH) / currencyArea
            const containsCenter =
                currencyCenterX >= bounds.left &&
                currencyCenterX <= bounds.right &&
                currencyCenterY >= bounds.top &&
                currencyCenterY <= bounds.bottom
            const distance = Math.hypot(centerX - currencyCenterX, centerY - currencyCenterY)
            const maxDistance = Math.max(bounds.width, bounds.height) * 0.75
            if (!containsCenter && overlapRatio < 0.15 && distance > maxDistance) return null

            const score =
                (containsCenter ? 1000 : 0) +
                (overlapRatio * 500) +
                (aspectRatio * 100) -
                distance

            return { obj, score }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))

    return candidates[0]?.obj || null
}

/**
 * Captura snapshot do layout de um priceGroup: dimensoes do grupo +
 * left/top/scale/originX/originY/visible/fontSize/text/fill/stroke de
 * cada price layout node. Usa `makePriceLayoutKeyBuilder` para gerar
 * keys estaveis.
 *
 * Salva em `group.__priceLayoutSnapshot` + `group.__priceLayoutSnapshotAt`.
 *
 * Skip se:
 *  - group invalido / sem getObjects
 *  - nao e' priceGroup-like (via `isPriceGroupCheck`)
 *  - layout corrompido (via `hasCorruptedCheck`)
 *  - sem nodes price layout
 *
 * Caller injeta `isPriceGroupCheck` (isLikelyPriceGroupObject runtime).
 */
export const rememberPriceLayoutSnapshot = (
    group: any,
    isPriceGroupCheck: (g: any) => boolean
): boolean => {
    if (!group || typeof group.getObjects !== 'function') return false
    if (!isPriceGroupCheck(group)) return false
    if (hasCorruptedPriceLayout(group)) return false

    const nodes = collectObjectsDeep(group).filter((o: any) => isPriceLayoutNode(o))
    if (!nodes.length) return false

    const makeKey = makePriceLayoutKeyBuilder()
    const snapshot = {
        version: 1,
        group: {
            width: Number(group?.width || 0),
            height: Number(group?.height || 0),
            scaleX: Number(group?.scaleX || 1),
            scaleY: Number(group?.scaleY || 1)
        },
        nodes: nodes.map((node: any) => ({
            key: makeKey(node),
            name: String(node?.name || ''),
            left: Number(node?.left || 0),
            top: Number(node?.top || 0),
            scaleX: Number(node?.scaleX || 1),
            scaleY: Number(node?.scaleY || 1),
            originX: String(node?.originX || 'left'),
            originY: String(node?.originY || 'top'),
            visible: node?.visible !== false,
            fontSize: Number(node?.fontSize || 0),
            width: Number(node?.width || 0),
            height: Number(node?.height || 0),
            text: typeof node?.text === 'string' ? node.text : undefined,
            fill: typeof node?.fill === 'string' ? node.fill : undefined,
            stroke: typeof node?.stroke === 'string' ? node.stroke : undefined
        }))
    }

    ;(group as any).__priceLayoutSnapshot = snapshot
    ;(group as any).__priceLayoutSnapshotAt = Date.now()
    return true
}

/**
 * Restaura layout de um priceGroup a partir de seu `__priceLayoutSnapshot`.
 * Aplica em cada node: left/top/scale/origin/visible + fontSize/text/fill/stroke
 * (este ultimo so se nao for transparent). Ajusta dimensoes do group tambem.
 *
 * Mutates os nodes. Retorna `true` se restaurou pelo menos 1 node.
 *
 * Skip se:
 *  - group invalido
 *  - sem __priceLayoutSnapshot
 *  - sem nodes price layout no group atual
 */
export const restorePriceLayoutSnapshot = (group: any): boolean => {
    if (!group || typeof group.getObjects !== 'function') return false
    const snapshot = (group as any).__priceLayoutSnapshot
    if (!snapshot || !Array.isArray(snapshot?.nodes)) return false

    const nodes = collectObjectsDeep(group).filter((o: any) => isPriceLayoutNode(o))
    if (!nodes.length) return false

    const makeKey = makePriceLayoutKeyBuilder()
    const nodeByKey = new Map<string, any>()
    nodes.forEach((node: any) => nodeByKey.set(makeKey(node), node))

    let restoredAny = false
    snapshot.nodes.forEach((snap: any) => {
        const node = nodeByKey.get(String(snap?.key || ''))
        if (!node) return
        if (!isFiniteLayoutNumber(snap?.left) || !isFiniteLayoutNumber(snap?.top)) return

        node.set?.({
            left: Number(snap.left),
            top: Number(snap.top),
            scaleX: isFiniteLayoutNumber(snap?.scaleX) ? Number(snap.scaleX) : 1,
            scaleY: isFiniteLayoutNumber(snap?.scaleY) ? Number(snap.scaleY) : 1,
            originX: String(snap?.originX || node.originX || 'left'),
            originY: String(snap?.originY || node.originY || 'top'),
            visible: snap?.visible !== false
        })

        if (typeof snap?.fill === 'string' && snap.fill !== 'transparent') node.set?.('fill', snap.fill)
        if (typeof snap?.stroke === 'string') node.set?.('stroke', snap.stroke)

        const tt = String(node?.type || '').toLowerCase()
        const isText = tt === 'text' || tt === 'i-text' || tt === 'itext' || tt === 'textbox'
        if (isText) {
            if (isFiniteLayoutNumber(snap?.fontSize) && Number(snap.fontSize) > 0) node.set?.('fontSize', Number(snap.fontSize))
            if (typeof snap?.text === 'string' && typeof node?.text === 'string') node.set?.('text', snap.text)
            node.initDimensions?.()
        }
        node.setCoords?.()
        restoredAny = true
    })

    if (snapshot?.group && typeof snapshot.group === 'object') {
        const nextW = Number(snapshot.group.width || 0)
        const nextH = Number(snapshot.group.height || 0)
        const nextScaleX = Number(snapshot.group.scaleX || 1)
        const nextScaleY = Number(snapshot.group.scaleY || 1)
        if (nextW > 0 && nextH > 0) {
            group.set?.({ width: nextW, height: nextH })
        }
        if (Number.isFinite(nextScaleX) && Number.isFinite(nextScaleY)) {
            group.set?.({ scaleX: nextScaleX, scaleY: nextScaleY })
        }
    }

    if (restoredAny) {
        group.dirty = true
        group.setCoords?.()
    }

    return restoredAny
}

/**
 * Walk recursivo em todos os objetos de um canvas procurando por
 * priceGroups (`isPriceGroupCheck`) e aplica `stabilizePriceGroup`
 * em cada um.
 *
 * Usado pelo pipeline de save para garantir que cada etiqueta foi
 * normalizada/snapshot-ada antes de serializar para o banco.
 *
 * Caller injeta `isPriceGroupCheck` e `stabilizePriceGroup` (que retorna
 * `{ fixed, captured }`).
 */
export const stabilizePriceGroupsForPersistence = (
    canvasInstance: any,
    isPriceGroupCheck: (obj: any) => boolean,
    stabilizePriceGroup: (group: any) => { fixed: boolean; captured: boolean }
): { fixed: number; captured: number } => {
    if (!canvasInstance || typeof canvasInstance.getObjects !== 'function') return { fixed: 0, captured: 0 }
    const roots = canvasInstance.getObjects() || []
    const candidates: any[] = []
    const seen = new Set<any>()

    const visit = (node: any) => {
        if (!node || seen.has(node)) return
        seen.add(node)
        if (isPriceGroupCheck(node)) candidates.push(node)
        if (typeof node.getObjects === 'function') {
            (node.getObjects() || []).forEach((child: any) => visit(child))
        }
    }
    roots.forEach((root: any) => visit(root))

    let fixed = 0
    let captured = 0
    candidates.forEach((group: any) => {
        const result = stabilizePriceGroup(group)
        if (result.fixed) fixed += 1
        if (result.captured) captured += 1
    })

    return { fixed, captured }
}
