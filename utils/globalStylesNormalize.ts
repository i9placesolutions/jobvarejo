/**
 * Helper puro para normalizar `GlobalStyles` — preenche defaults,
 * coerce numeros para ranges validos, valida cores hex, normaliza
 * enums (align, transform, fontStyle).
 *
 * Sem dependencia de canvas/Fabric/refs. Caller passa
 * `DEFAULT_GLOBAL_STYLES` para evitar import circular.
 *
 * Cobertura: tests/utils/globalStylesNormalize.test.ts
 */

import type { GlobalStyles } from '~/types/product-zone'
import { normalizeHexColor } from './colorHelpers'
import { toFinite } from './mathHelpers'

/**
 * Normaliza um objeto parcial de GlobalStyles para o tipo completo:
 *
 *  1. Merge com defaults (incoming > defaults)
 *  2. Cores: passar por `normalizeHexColor` (com fallback dos defaults)
 *  3. Numeros: clamp via `toFinite(value, default, min, max)`:
 *     - cardBorderRadius: 0..120
 *     - cardBorderWidth: 0..24
 *     - prodNameScale: 0.5..2.5
 *     - prodNameLineHeight: 0.7..2.2
 *     - prodNameOffsetY: -300..300
 *     - splashScale: 0.35..3
 *     - splashTextScale: 0.4..2.8
 *     - splashRoundness: 0..1
 *     - splashOffsetY: -300..300
 *     - priceFontSize: 24..160
 *     - splashStrokeWidth: 0..24 (preserva undefined explicito)
 *  4. Enums:
 *     - prodNameAlign: 'left'/'center'/'right'
 *     - prodNameTransform: 'none'/'upper'/'lower'
 *     - priceFontStyle: 'italic' OR 'normal'
 *  5. Fonts: fallback default se string vazia/invalida
 *  6. Allow-undefined: priceTextColor, priceCurrencyColor, priceFontWeight
 *     mantem `undefined` em vez de fallback.
 */
export const normalizeGlobalStyles = (
    styles: Partial<GlobalStyles> | null | undefined,
    defaults: GlobalStyles
): GlobalStyles => {
    const source = (styles && typeof styles === 'object') ? styles : {}
    const merged = { ...defaults, ...source }

    const defaultColor = {
        cardColor: defaults.cardColor || '#ffffff',
        cardBorderColor: defaults.cardBorderColor || '#000000',
        accentColor: defaults.accentColor || '#dc2626',
        prodNameColor: defaults.prodNameColor || '#000000',
        limitColor: defaults.limitColor || '#ef4444',
        splashColor: defaults.splashColor || '#dc2626',
        splashTextColor: defaults.splashTextColor || '#ffffff',
        splashFill: defaults.splashFill || '#000000'
    }
    const defaultNumber = {
        cardBorderRadius: defaults.cardBorderRadius ?? 8,
        cardBorderWidth: defaults.cardBorderWidth ?? 0,
        prodNameScale: defaults.prodNameScale ?? 1,
        prodNameLineHeight: defaults.prodNameLineHeight ?? 1.05,
        prodNameOffsetY: defaults.prodNameOffsetY ?? 0,
        splashScale: defaults.splashScale ?? 1,
        splashTextScale: defaults.splashTextScale ?? 1,
        splashRoundness: defaults.splashRoundness ?? 1,
        splashOffsetY: defaults.splashOffsetY ?? 0,
        priceFontSize: defaults.priceFontSize ?? 60,
        splashStrokeWidth: defaults.splashStrokeWidth ?? 0
    }

    const normalized: GlobalStyles = {
        ...merged,
        cardColor: normalizeHexColor(merged.cardColor, defaultColor.cardColor, { allowTransparent: true }) as string,
        cardBorderColor: normalizeHexColor(merged.cardBorderColor, defaultColor.cardBorderColor) as string,
        accentColor: normalizeHexColor(merged.accentColor, defaultColor.accentColor) as string,
        prodNameColor: normalizeHexColor(merged.prodNameColor, defaultColor.prodNameColor) as string,
        limitColor: normalizeHexColor(merged.limitColor, defaultColor.limitColor) as string,
        splashColor: normalizeHexColor(merged.splashColor, defaultColor.splashColor) as string,
        splashTextColor: normalizeHexColor(merged.splashTextColor, defaultColor.splashTextColor) as string,
        splashFill: normalizeHexColor(merged.splashFill, defaultColor.splashFill) as string,
        isProdBgTransparent: !!merged.isProdBgTransparent,
        cardBorderRadius: toFinite(merged.cardBorderRadius, defaultNumber.cardBorderRadius, 0, 120),
        cardBorderWidth: toFinite(merged.cardBorderWidth, defaultNumber.cardBorderWidth, 0, 24),
        prodNameScale: toFinite(merged.prodNameScale, defaultNumber.prodNameScale, 0.5, 2.5),
        prodNameLineHeight: toFinite(merged.prodNameLineHeight, defaultNumber.prodNameLineHeight, 0.7, 2.2),
        prodNameOffsetY: toFinite(merged.prodNameOffsetY, defaultNumber.prodNameOffsetY, -300, 300),
        splashScale: toFinite(merged.splashScale, defaultNumber.splashScale, 0.35, 3),
        splashTextScale: toFinite(merged.splashTextScale, defaultNumber.splashTextScale, 0.4, 2.8),
        splashRoundness: toFinite(merged.splashRoundness, defaultNumber.splashRoundness, 0, 1),
        splashOffsetY: toFinite(merged.splashOffsetY, defaultNumber.splashOffsetY, -300, 300),
        priceFontSize: toFinite(merged.priceFontSize, defaultNumber.priceFontSize, 24, 160),
        splashStrokeWidth: merged.splashStrokeWidth === undefined || merged.splashStrokeWidth === null
            ? undefined
            : toFinite(merged.splashStrokeWidth, defaultNumber.splashStrokeWidth, 0, 24),
        priceTextColor: normalizeHexColor(merged.priceTextColor, defaultColor.splashTextColor, { allowUndefined: true }),
        priceCurrencyColor: normalizeHexColor(merged.priceCurrencyColor, defaultColor.splashTextColor, { allowUndefined: true }),
        priceFontWeight: merged.priceFontWeight === '' || merged.priceFontWeight === null ? undefined : merged.priceFontWeight,
        priceFontStyle: String(merged.priceFontStyle ?? defaults.priceFontStyle ?? 'normal').trim().toLowerCase() === 'italic'
            ? 'italic'
            : 'normal'
    }

    const align = String(normalized.prodNameAlign || '').toLowerCase()
    if (align !== 'left' && align !== 'center' && align !== 'right') {
        normalized.prodNameAlign = defaults.prodNameAlign
    }
    const transform = String(normalized.prodNameTransform || '').toLowerCase()
    if (transform !== 'none' && transform !== 'upper' && transform !== 'lower') {
        normalized.prodNameTransform = defaults.prodNameTransform
    }
    if (typeof normalized.priceFont !== 'string' || !normalized.priceFont.trim()) {
        normalized.priceFont = defaults.priceFont
    }
    if (typeof normalized.prodNameFont !== 'string' || !normalized.prodNameFont.trim()) {
        normalized.prodNameFont = defaults.prodNameFont
    }
    if (normalized.priceFontStyle !== 'italic') {
        normalized.priceFontStyle = 'normal'
    }

    return normalized
}
