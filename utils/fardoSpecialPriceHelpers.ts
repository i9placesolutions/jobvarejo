import {
    formatCentsToPrice,
    formatPriceValue,
    inferUnitLabelFromProduct,
    normalizeUnitForLabel,
    parsePriceToCents
} from './priceTagText'
import { getSpecialConditionFromProduct } from './productPriceHelpers'

export type FardoSpecialPriceTier = {
    price: string | null
    unitText: string
    packLine: string | null
    hasValue: boolean
}

export type FardoSpecialPriceState = {
    retail: FardoSpecialPriceTier
    special: FardoSpecialPriceTier
    conditionText: string | null
    showRetail: boolean
    showSpecial: boolean
    showBanner: boolean
    autoCollapseMissingPrices: boolean
}

export type FardoSpecialPricePalette = {
    retailBg: string
    bannerBg: string
    wholesaleBg: string
    retailText: string
    bannerText: string
    wholesaleText: string
}

export const FARDO_SPECIAL_PRICE_PALETTE: FardoSpecialPricePalette = {
    retailBg: '#123B8F',
    bannerBg: '#F4C400',
    wholesaleBg: '#C91C12',
    retailText: '#FFFFFF',
    bannerText: '#111827',
    wholesaleText: '#FFFFFF'
}

export const resolveFardoSpecialPricePalette = (value: any): FardoSpecialPricePalette => ({
    retailBg: String(value?.retailBg || FARDO_SPECIAL_PRICE_PALETTE.retailBg),
    bannerBg: String(value?.bannerBg || FARDO_SPECIAL_PRICE_PALETTE.bannerBg),
    wholesaleBg: String(value?.wholesaleBg || FARDO_SPECIAL_PRICE_PALETTE.wholesaleBg),
    retailText: String(value?.retailText || FARDO_SPECIAL_PRICE_PALETTE.retailText),
    bannerText: String(value?.bannerText || FARDO_SPECIAL_PRICE_PALETTE.bannerText),
    wholesaleText: String(value?.wholesaleText || FARDO_SPECIAL_PRICE_PALETTE.wholesaleText)
})

export type FardoSpecialPriceOptions = {
    autoCollapseMissingPrices?: boolean
    displayUnit?: string
    compactPackLine?: boolean
    derivePackPrice?: boolean
    keepBannerWhenNoCondition?: boolean
}

const toFormattedPrice = (value: any): string | null => {
    const formatted = formatPriceValue(value)
    return formatted ? formatted : null
}

const toPositiveInteger = (value: any): number | null => {
    const parsed = Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const normalizePackLabel = (value: any): string => {
    const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
    if (!raw) return ''
    const compact = raw.replace(/\s+/g, '')
    const aliases: Record<string, string> = {
        FD: 'FARDO',
        FARDOS: 'FARDO',
        CX: 'CAIXA',
        CAIXAS: 'CAIXA',
        PCT: 'PACOTE',
        PACOTES: 'PACOTE'
    }
    return aliases[compact] || raw
}

const isPackagingLabel = (label: string): boolean => {
    const compact = String(label || '').replace(/\s+/g, '')
    return new Set([
        'FD', 'FARDO', 'FARDOS',
        'CX', 'CAIXA', 'CAIXAS',
        'PCT', 'PACOTE', 'PACOTES',
        'SIXPACK', 'PACK'
    ]).has(compact)
}

const normalizeConditionUnit = (value: string): string => {
    const compact = String(value || '').trim().toUpperCase().replace(/\s+/g, '')
    const aliases: Record<string, string> = {
        UNIDADES: 'UN',
        UNIDADE: 'UN',
        UND: 'UND',
        UN: 'UN',
        FARDOS: 'FD',
        FARDO: 'FD',
        FD: 'FD',
        CAIXAS: 'CX',
        CAIXA: 'CX',
        CX: 'CX',
        PACOTES: 'PCT',
        PACOTE: 'PCT',
        PCT: 'PCT'
    }
    return aliases[compact] || String(value || '').trim().toUpperCase()
}

const normalizeConditionText = (value: any): string | null => {
    const raw = String(value ?? '').trim()
    if (!raw) return null

    const compact = raw.replace(/[.;,]+$/, '').trim()
    const match = compact.match(/^(?:ACIMA\s+DE|ACIMA|A\s+PARTIR\s+DE|MIN\.?)[\s:]+(\d+)\s+(.+)$/i)
    if (!match) return compact.toUpperCase()

    const quantity = match[1]
    const unit = normalizeConditionUnit(match[2] || '')
    return unit ? `ACIMA DE ${quantity} ${unit}` : `ACIMA DE ${quantity}`
}

const formatPackLine = (opts: {
    label: string
    quantity: number | null
    price: string | null
    compact: boolean
}): string | null => {
    const { label, quantity, price, compact } = opts
    if (!label || !price || !quantity) return null

    if (quantity === 1) return `${label} R$ ${price}`
    return compact
        ? `${label} C/${quantity} R$ ${price}`
        : `${label} C/${quantity}: R$ ${price}`
}

const buildTier = (
    product: any,
    unitValue: any,
    packValue: any,
    fallbackValue: any,
    options: Required<Pick<FardoSpecialPriceOptions, 'compactPackLine' | 'derivePackPrice' | 'displayUnit'>>
): FardoSpecialPriceTier => {
    const unitPrice = toFormattedPrice(unitValue)
    const explicitPackPrice = toFormattedPrice(packValue)
    const fallbackPrice = toFormattedPrice(fallbackValue)
    const price = unitPrice || explicitPackPrice || fallbackPrice
    const quantity = toPositiveInteger(product?.packQuantity)
    const packLabel = normalizePackLabel(product?.packageLabel || product?.packUnit)
    const shouldDerivePack = options.derivePackPrice && !!unitPrice && !!quantity && quantity > 1 && isPackagingLabel(packLabel)
    const derivedPackCents = shouldDerivePack
        ? (() => {
            const cents = parsePriceToCents(unitPrice)
            return cents === null || quantity === null ? null : formatCentsToPrice(cents * quantity)
        })()
        : null
    const packPrice = explicitPackPrice || derivedPackCents
    const shouldShowPackLine = !!packPrice && (!!explicitPackPrice || (quantity !== null && quantity > 1 && isPackagingLabel(packLabel)))
    const unitText = unitPrice ? options.displayUnit : ''

    return {
        price,
        unitText,
        packLine: shouldShowPackLine
            ? formatPackLine({
                label: packLabel,
                quantity,
                price: packPrice,
                compact: options.compactPackLine
            })
            : null,
        hasValue: !!price
    }
}

/**
 * Resolve the two commercial tiers used by the fardo/pack special label.
 * The unit and pack values remain distinct: an explicit pack price wins over
 * a calculated value, while the calculated line is only allowed for real
 * packaging labels with quantity greater than one.
 */
export const resolveFardoSpecialPriceState = (
    product: any,
    options: FardoSpecialPriceOptions = {}
): FardoSpecialPriceState => {
    const autoCollapseMissingPrices = options.autoCollapseMissingPrices !== false
    const compactPackLine = options.compactPackLine !== false
    const derivePackPrice = options.derivePackPrice !== false
    const inferredUnit = inferUnitLabelFromProduct(product)
    const displayUnit = String(options.displayUnit ?? inferredUnit ?? '').trim()

    const retail = buildTier(product, product?.priceUnit, product?.pricePack, product?.price, {
        compactPackLine,
        derivePackPrice,
        displayUnit
    })
    const special = buildTier(product, product?.priceSpecialUnit, product?.priceSpecial, product?.priceWholesale, {
        compactPackLine,
        derivePackPrice,
        displayUnit
    })
    const explicitCondition = getSpecialConditionFromProduct(product)
    const triggerValue = toPositiveInteger(product?.wholesaleTrigger)
    const triggerUnit = normalizeConditionUnit(product?.wholesaleTriggerUnit || product?.packageLabel || '')
    const conditionText = normalizeConditionText(explicitCondition)
        || (triggerValue && triggerUnit ? `ACIMA DE ${triggerValue} ${triggerUnit}` : null)

    const showRetail = autoCollapseMissingPrices ? retail.hasValue : true
    const showSpecial = autoCollapseMissingPrices ? special.hasValue : true
    const showBanner = autoCollapseMissingPrices
        ? !!conditionText || (retail.hasValue && special.hasValue)
        : !!conditionText || options.keepBannerWhenNoCondition === true

    return {
        retail,
        special,
        conditionText,
        showRetail,
        showSpecial,
        showBanner,
        autoCollapseMissingPrices
    }
}
