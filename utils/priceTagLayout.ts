/**
 * priceTagLayout — funcao pura de layout horizontal da etiqueta de preco.
 *
 * Posiciona o trio "inteiro + centavos + unidade" usando largura RENDERIZADA
 * (getScaledWidth) — nao usa offset fixo. Quando o preco nao cabe em
 * `maxWidth`, encolhe inteiro+decimal proporcionalmente para preservar a
 * hierarquia visual (sem isso, em precos com 2+ digitos como 47,99/129,99
 * o decimal ficava grande perto do inteiro reduzido).
 *
 * Depende apenas da API duck-typed do Fabric (set, getScaledWidth,
 * initDimensions). Sem refs reativos / state global → seguro para testar
 * com mocks e usar em qualquer contexto (EditorCanvas, MiniEditor, preview).
 */
import { PRICE_INTEGER_DECIMAL_GAP_PX, normalizeUnitForLabel } from '~/utils/priceTagText'

export type LayoutPriceOptions = {
    priceInteger: any
    priceDecimal: any
    priceUnit?: any
    intX: number
    intY: number
    decY: number
    unitY: number
    maxWidth?: number
    gapPx?: number
    minGapPx?: number
    maxGapPx?: number
    targetCenterX?: number
}

export type LayoutPriceResult = {
    intX: number
    centsX: number
    intW: number
    decW: number
    gap: number
} | null

const getW = (t: any): number =>
    (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0)

export const layoutPrice = (opts: LayoutPriceOptions): LayoutPriceResult => {
    const integer = opts.priceInteger
    const decimal = opts.priceDecimal
    if (!integer || !decimal) return null

    const minGap = Number.isFinite(Number(opts.minGapPx)) ? Number(opts.minGapPx) : PRICE_INTEGER_DECIMAL_GAP_PX
    const maxGap = Number.isFinite(Number(opts.maxGapPx)) ? Number(opts.maxGapPx) : PRICE_INTEGER_DECIMAL_GAP_PX
    const autoGap = PRICE_INTEGER_DECIMAL_GAP_PX
    let gap = Number.isFinite(Number(opts.gapPx)) ? Number(opts.gapPx) : autoGap
    gap = Math.min(maxGap, Math.max(minGap, gap))

    integer.set?.({ originX: 'left', originY: 'center' })
    decimal.set?.({ originX: 'left', originY: 'center' })

    const unitObj = opts.priceUnit
    const rawUnit = String(unitObj?.text || '').trim()
    const hasUnit = !!(unitObj && rawUnit.length > 0)
    if (unitObj) {
        if (unitObj.visible === false) {
            unitObj.set?.({ visible: false })
        } else if (hasUnit) {
            const unitNorm = normalizeUnitForLabel(rawUnit)
            if (unitNorm !== rawUnit.toUpperCase().replace(/\s+/g, '')) {
                unitObj.set?.('text', unitNorm)
                unitObj.initDimensions?.()
            }
            unitObj.set?.({ visible: true })
        } else {
            unitObj.set?.({ visible: false })
        }
    }

    const maxWidth = Number.isFinite(Number(opts.maxWidth)) ? Number(opts.maxWidth) : 0
    let intW = getW(integer)
    const decWInitial = getW(decimal)

    if (maxWidth > 0 && intW > 0) {
        // FIX: calcular shrink baseado na largura TOTAL da cadeia (inteiro + decimal + gap),
        // nao apenas no inteiro. Isso evita subestimar o espaco disponivel e encolher
        // mais do que necessario — o decimal ficava microscopico em precos como 129,99.
        const totalW = intW + decWInitial + gap
        if (totalW > maxWidth) {
            const allowedTotalW = Math.max(8, maxWidth - gap)
            const shrink = Math.min(1, Math.max(0.35, allowedTotalW / (intW + decWInitial)))
            const baseIntSx = Number(integer.scaleX || 1)
            const baseIntSy = Number(integer.scaleY || 1)
            integer.set?.({
                scaleX: baseIntSx * shrink,
                scaleY: baseIntSy * shrink
            })
            integer.initDimensions?.()
            intW = getW(integer)

            const baseDecSx = Number(decimal.scaleX || 1)
            const baseDecSy = Number(decimal.scaleY || 1)
            decimal.set?.({
                scaleX: baseDecSx * shrink,
                scaleY: baseDecSy * shrink
            })
            decimal.initDimensions?.()
        }
    }

    integer.set?.({ left: opts.intX, top: opts.intY })

    const centsX = opts.intX + intW + gap
    decimal.set?.({ left: centsX, top: opts.decY })

    const decW = getW(decimal)
    if (unitObj && unitObj.visible !== false) {
        const decCenterX = centsX + (decW / 2)
        unitObj.set?.({
            originX: 'center',
            originY: 'center',
            left: decCenterX,
            top: opts.unitY
        })

        const unitW = getW(unitObj)
        if (decW > 0 && unitW > decW) {
            const s = decW / unitW
            unitObj.set?.({ scaleX: s, scaleY: s })
            unitObj.set?.({ left: decCenterX })
        } else {
            unitObj.set?.({ scaleX: 1, scaleY: 1 })
            unitObj.set?.({ left: decCenterX })
        }
    }

    // Centraliza o bloco (inteiro + centavos + unidade) em targetCenterX.
    const toFinite = (v: any) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    const edgeLR = (obj: any): { left: number; right: number } | null => {
        if (!obj) return null
        const w = getW(obj)
        if (!Number.isFinite(w) || w <= 0) return null
        const x = Number(obj.left || 0)
        const ox = String(obj.originX || 'left')
        if (ox === 'center') return { left: x - (w / 2), right: x + (w / 2) }
        if (ox === 'right') return { left: x - w, right: x }
        return { left: x, right: x + w }
    }
    const targetCenterX = toFinite(opts.targetCenterX)
    if (targetCenterX !== null) {
        const edges = [edgeLR(integer), edgeLR(decimal), (unitObj?.visible !== false ? edgeLR(unitObj) : null)]
            .filter(Boolean) as Array<{ left: number; right: number }>
        if (edges.length > 0) {
            const minX = Math.min(...edges.map((e) => e.left))
            const maxX = Math.max(...edges.map((e) => e.right))
            const currentCenter = (minX + maxX) / 2
            const dx = targetCenterX - currentCenter
            if (Math.abs(dx) > 0.001) {
                integer.set?.({ left: Number(integer.left || 0) + dx })
                decimal.set?.({ left: Number(decimal.left || 0) + dx })
                if (unitObj && unitObj.visible !== false) {
                    unitObj.set?.({ left: Number(unitObj.left || 0) + dx })
                }
            }
        }
    }

    return {
        intX: opts.intX,
        centsX,
        intW,
        decW,
        gap
    }
}
