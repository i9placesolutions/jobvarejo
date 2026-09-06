/**
 * Assinatura somente visual de uma etiqueta de preço.
 *
 * A etiqueta no canvas carrega dados dinâmicos (preço, unidade, escala e
 * posição) que naturalmente divergem do modelo da biblioteca. Para decidir
 * se um card herdado precisa ser reconstruído, comparamos apenas a estrutura
 * e os estilos que definem a aparência do modelo.
 */

const DYNAMIC_TEXT_NAMES = new Set([
    'price_currency_text',
    'price_integer_text',
    'price_decimal_text',
    'price_value_text',
    'price_unit_text',
    'retail_currency_text',
    'retail_integer_text',
    'retail_decimal_text',
    'retail_price_text',
    'retail_unit_text',
    'wholesale_currency_text',
    'wholesale_integer_text',
    'wholesale_decimal_text',
    'wholesale_price_text',
    'wholesale_unit_text',
    'price_header_text',
    'price_header_unit_text'
])

// A parte do preço mudou de dois Texts independentes para um IText rico.
// Essa é uma diferença de serialização, não de aparência: comparar os dois
// nós literalmente fazia todo card antigo parecer divergente em cada carga.
const PRICE_SPLIT_GROUPS = [
    { integer: 'price_integer_text', decimal: 'price_decimal_text', rich: 'price_value_text' },
    { integer: 'retail_integer_text', decimal: 'retail_decimal_text', rich: 'retail_price_text' },
    { integer: 'wholesale_integer_text', decimal: 'wholesale_decimal_text', rich: 'wholesale_price_text' }
] as const

const canonicalNodeName = (name: string): string => {
    const normalized = String(name || '').trim().toLowerCase()
    for (const group of PRICE_SPLIT_GROUPS) {
        if (normalized === group.integer || normalized === group.decimal || normalized === group.rich) {
            return group.rich
        }
    }
    return normalized
}

const finite = (value: any, precision = 4): number | null => {
    const n = Number(value)
    return Number.isFinite(n) ? Number(n.toFixed(precision)) : null
}

/** Normaliza hex/rgb(a) para não tratar formatos equivalentes como drift. */
const color = (value: any): string => {
    const raw = String(value ?? '').trim().toLowerCase()
    if (!raw || raw === 'none') return ''
    if (raw === 'transparent') return '000000:0'

    const hex = raw.match(/^#([0-9a-f]{3,8})$/i)?.[1]
    if (hex) {
        const expanded = hex.length === 3 || hex.length === 4
            ? hex.split('').map(char => char + char).join('')
            : hex
        const hasAlpha = expanded.length === 8
        const rgb = expanded.slice(0, 6)
        const alpha = hasAlpha ? Number.parseInt(expanded.slice(6), 16) / 255 : 1
        return `${rgb}:${Number(alpha.toFixed(4))}`
    }

    const rgb = raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i)
    if (rgb) {
        const alphaRaw = rgb[4]
        const alpha = alphaRaw?.endsWith('%')
            ? Number.parseFloat(alphaRaw) / 100
            : (alphaRaw === undefined ? 1 : Number.parseFloat(alphaRaw))
        return `${[
            Number(rgb[1]),
            Number(rgb[2]),
            Number(rgb[3])
        ].join(',')}:${Number((Number.isFinite(alpha) ? alpha : 1).toFixed(4))}`
    }

    return raw.replace(/\s+/g, ' ')
}

const textStyle = (object: any): Record<string, any> => ({
    fontFamily: String(object?.fontFamily ?? '').trim().toLowerCase(),
    fontWeight: String(object?.fontWeight ?? '').trim().toLowerCase(),
    fontStyle: String(object?.fontStyle ?? '').trim().toLowerCase(),
    textAlign: String(object?.textAlign ?? '').trim().toLowerCase(),
    lineHeight: finite(object?.lineHeight),
    charSpacing: finite(object?.charSpacing),
    underline: object?.underline === true,
    linethrough: object?.linethrough === true,
    fill: color(object?.fill),
    stroke: color(object?.stroke),
    opacity: finite(object?.opacity)
})

const nodeVisualData = (object: any): Record<string, any> => {
    const name = canonicalNodeName(String(object?.name || '').trim().toLowerCase())
    const type = String(object?.type || '').trim().toLowerCase()
    const data: Record<string, any> = {
        type,
        name,
        fill: color(object?.fill),
        stroke: color(object?.stroke),
        strokeWidth: finite(object?.strokeWidth),
        opacity: finite(object?.opacity),
        // Text and unit values are product-specific. Their typography and
        // colors remain part of the signature, but visibility is dynamic for
        // the price/unit/header nodes.
        visible: DYNAMIC_TEXT_NAMES.has(name) ? null : object?.visible !== false
    }

    if (type.includes('text')) Object.assign(data, textStyle(object))

    return data
}

const childrenOf = (object: any): any[] => {
    if (Array.isArray(object?.objects)) return object.objects
    if (typeof object?.getObjects === 'function') {
        try {
            const children = object.getObjects()
            return Array.isArray(children) ? children : []
        } catch {
            return []
        }
    }
    return []
}

const flattenVisualNodes = (root: any): Record<string, any>[] => {
    const nodes: Record<string, any>[] = []
    const occurrences = new Map<string, number>()

    const walk = (object: any, isRoot = false) => {
        if (!object || typeof object !== 'object') return
        if (!isRoot) {
            const base = canonicalNodeName(String(object?.name || '').trim().toLowerCase()) || `#${String(object?.type || '').toLowerCase()}`
            const occurrence = occurrences.get(base) || 0
            occurrences.set(base, occurrence + 1)
            nodes.push({ key: `${base}:${occurrence}`, ...nodeVisualData(object) })
        }
        const children = childrenOf(object)
        const childNames = new Set(children.map(child => String(child?.name || '').trim().toLowerCase()))
        const skip = new Set<any>()
        PRICE_SPLIT_GROUPS.forEach(({ integer, decimal, rich }) => {
            // If a rich node exists, it is the canonical representation and
            // any legacy split pair is redundant. Otherwise keep the integer
            // node as the representative and omit only the decimal sibling.
            if (childNames.has(rich)) {
                children.forEach(child => {
                    const name = String(child?.name || '').trim().toLowerCase()
                    if (name === integer || name === decimal) skip.add(child)
                })
            } else if (childNames.has(integer) && childNames.has(decimal)) {
                children.forEach(child => {
                    const name = String(child?.name || '').trim().toLowerCase()
                    if (name === decimal) skip.add(child)
                })
            }
        })
        children.forEach(child => {
            if (!skip.has(child)) walk(child)
        })
    }

    walk(root, true)
    return nodes.sort((a, b) => String(a.key).localeCompare(String(b.key)))
}

/**
 * Retorna uma assinatura estável do visual de um grupo de etiqueta, aceitando
 * tanto JSON serializado quanto objetos Fabric enlivenados.
 */
export const buildLabelTemplateVisualSignature = (group: any): string => {
    try {
        return JSON.stringify(flattenVisualNodes(group))
    } catch {
        return ''
    }
}

export const labelTemplateVisualSignaturesEqual = (left: any, right: any): boolean =>
    buildLabelTemplateVisualSignature(left) === buildLabelTemplateVisualSignature(right)
