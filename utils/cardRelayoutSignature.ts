/**
 * Build de signature de cache para resizeSmartObject — string JSON
 * estavel que muda quando width/height/styles/pricing mudam,
 * permitindo skip do relayout completo quando nada mudou.
 *
 * Sem dependencia de canvas/refs. Pure: dado group + dimensions +
 * styles, devolve sempre a mesma string.
 *
 * Cobertura: tests/utils/cardRelayoutSignature.test.ts
 */

import type { GlobalStyles } from '~/types/product-zone'

/**
 * Coerce numerico com precisao limitada (default 3 casas) — null
 * se nao-finito. Usado para signatures: floats com precisao identica
 * batem string-equal.
 */
const num = (v: any, precision = 3): number | null => {
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    return Number(n.toFixed(precision))
}

/**
 * Coerce para string. null/undefined → "". Usado em signatures para
 * normalizar valores opcionais.
 */
const txt = (v: any): string => {
    if (v === null || v === undefined) return ''
    return String(v)
}

/**
 * Constroi uma string-signature do estado de relayout de um card.
 * Inclui:
 *  - width/height (clampados a 3 casas decimais)
 *  - styleSig: TODOS os styles visuais que afetam render
 *  - pricingSig: dados de preco/produto que afetam layout interno
 *    (title height, badge visibility, etc)
 *
 * Caller compara com __lastCardRelayoutSignature para skip do
 * relayout quando a signature bate.
 */
export const buildCardRelayoutSignature = (
    group: any,
    w: number,
    h: number,
    styles?: Partial<GlobalStyles>
): string => {
    const productData = ((group as any)?._productData && typeof (group as any)._productData === 'object')
        ? ((group as any)._productData as Record<string, any>)
        : {}
    const s = (styles && typeof styles === 'object') ? styles : ({} as Partial<GlobalStyles>)

    const styleSig = {
        __refCellW: num((s as any).__refCellW),
        __refCellH: num((s as any).__refCellH),
        splashTemplateId: txt((s as any).splashTemplateId),
        splashScale: num((s as any).splashScale),
        splashOffsetY: num((s as any).splashOffsetY),
        splashTextScale: num((s as any).splashTextScale),
        splashFill: txt((s as any).splashFill),
        splashColor: txt((s as any).splashColor ?? (s as any).accentColor),
        splashTextColor: txt((s as any).splashTextColor),
        splashStrokeWidth: num((s as any).splashStrokeWidth),
        priceTextColor: txt((s as any).priceTextColor),
        priceCurrencyColor: txt((s as any).priceCurrencyColor),
        priceFont: txt((s as any).priceFont),
        priceFontSize: num((s as any).priceFontSize),
        priceFontWeight: txt((s as any).priceFontWeight),
        priceFontStyle: txt((s as any).priceFontStyle),
        currencySymbol: txt((s as any).currencySymbol),
        prodNameScale: num((s as any).prodNameScale),
        prodNameTransform: txt((s as any).prodNameTransform),
        prodNameLineHeight: num((s as any).prodNameLineHeight),
        prodNameOffsetY: num((s as any).prodNameOffsetY),
        cardBorderRadius: num((s as any).cardBorderRadius),
        cardColor: txt((s as any).cardColor),
        isProdBgTransparent: !!(s as any).isProdBgTransparent,
        cardBorderColor: txt((s as any).cardBorderColor),
        cardBorderWidth: num((s as any).cardBorderWidth),
        prodNameColor: txt((s as any).prodNameColor),
        prodNameFont: txt((s as any).prodNameFont),
        prodNameWeight: txt((s as any).prodNameWeight),
        prodNameAlign: txt((s as any).prodNameAlign),
        limitColor: txt((s as any).limitColor),
        limitFont: txt((s as any).limitFont)
    }

    const pricingSig = {
        price: txt((group as any)?.price ?? productData.price),
        pricePack: txt((group as any)?.pricePack ?? productData.pricePack),
        priceUnit: txt((group as any)?.priceUnit ?? productData.priceUnit),
        priceSpecial: txt((group as any)?.priceSpecial ?? productData.priceSpecial),
        priceSpecialUnit: txt((group as any)?.priceSpecialUnit ?? productData.priceSpecialUnit),
        priceWholesale: txt((group as any)?.priceWholesale ?? productData.priceWholesale),
        wholesaleTrigger: txt((group as any)?.wholesaleTrigger ?? productData.wholesaleTrigger),
        wholesaleTriggerUnit: txt((group as any)?.wholesaleTriggerUnit ?? productData.wholesaleTriggerUnit),
        packQuantity: txt((group as any)?.packQuantity ?? productData.packQuantity),
        packUnit: txt((group as any)?.packUnit ?? productData.packUnit),
        packageLabel: txt((group as any)?.packageLabel ?? productData.packageLabel),
        specialCondition: txt((group as any)?.specialCondition ?? productData.specialCondition),
        imageUrl: txt((group as any)?.imageUrl ?? productData.imageUrl ?? productData.image),
        name: txt(productData.name),
        limitText: txt(productData.limitText || productData.limit)
    }

    return JSON.stringify({
        w: num(w),
        h: num(h),
        styleSig,
        pricingSig
    })
}

/**
 * Resolve a escala base de um price group em um eixo (x|y), levando
 * em conta:
 *  1. __originalScaleX/Y (escala "manual" do template original)
 *  2. zoneScale (escala atual da zona, para inferir base = current / zone)
 *  3. fallback: scale atual do priceGroup
 *
 * Tudo clampado em > 0.02 (escalas menores sao tratadas como invalidas
 * — provavelmente colapso por bug). Math.abs() sempre aplicado para
 * preservar magnitude mesmo com flip horizontal/vertical.
 *
 * Pure: opera sobre o priceGroup duck-typed.
 */
export const resolvePriceGroupBaseScale = (
    priceGroup: any,
    axis: 'x' | 'y',
    zoneScale: number
): number => {
    const originalKey = axis === 'x' ? '__originalScaleX' : '__originalScaleY'
    const scaleKey = axis === 'x' ? 'scaleX' : 'scaleY'
    const originalScale = Math.abs(Number((priceGroup as any)?.[originalKey]))
    if (Number.isFinite(originalScale) && originalScale > 0.02) {
        return originalScale
    }

    const currentScale = Math.abs(Number((priceGroup as any)?.[scaleKey]))
    const safeCurrentScale = Number.isFinite(currentScale) && currentScale > 0.02 ? currentScale : 1
    const safeZoneScale = Math.abs(Number(zoneScale))
    if (Number.isFinite(safeZoneScale) && safeZoneScale > 0.02) {
        const inferredBase = safeCurrentScale / safeZoneScale
        if (Number.isFinite(inferredBase) && inferredBase > 0.02) {
            return inferredBase
        }
    }

    return safeCurrentScale
}
