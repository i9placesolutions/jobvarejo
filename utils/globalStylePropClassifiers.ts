/**
 * Classificadores puros de props de globalStyles. Usados pelo pipeline
 * de save (debounce) e fast-path (apply leve sem rerender total).
 *
 * Sem dependencia de canvas/refs/storage. Operam apenas sobre o nome
 * da prop como string.
 *
 * Cobertura: tests/utils/globalStylePropClassifiers.test.ts
 */

/**
 * Conjunto de props de globalStyles que devem ser persistidas com
 * debounce — sao props com sliders/range inputs que disparam muitos
 * "change" em sequencia (raio de canto, escalas, offsets).
 *
 * Props nao-debounced sao salvas imediatamente (cores, fonts, toggles).
 */
export const DEBOUNCED_GLOBAL_STYLE_PROPS = new Set<string>([
    'cardBorderRadius',
    'cardBorderWidth',
    'splashScale',
    'splashTextScale',
    'splashRoundness',
    'splashOffsetY',
    'prodNameScale',
    'prodNameLineHeight',
    'prodNameOffsetY'
])

/**
 * Detecta se uma prop de globalStyles deve ser persistida com debounce.
 * Trim defensivo no input (vazio/null tratados como nao-debounce).
 */
export const isDebouncedGlobalStyleProp = (prop: any): boolean =>
    DEBOUNCED_GLOBAL_STYLE_PROPS.has(String(prop || ''))

/**
 * Conjunto de props "leves" — props que podem ser aplicadas via
 * fast-path (mutacao direta no objeto Fabric) em vez do reflow
 * completo do template. Inclui cores, fonts, weights, escalas,
 * raios, transforms.
 *
 * Props NAO listadas aqui forcam reflow completo do template.
 */
export const LIGHTWEIGHT_GLOBAL_STYLE_PROPS = new Set<string>([
    'cardColor',
    'isProdBgTransparent',
    'cardBorderColor',
    'cardBorderWidth',
    'cardBorderRadius',
    'prodNameFont',
    'prodNameColor',
    'prodNameWeight',
    'prodNameAlign',
    'prodNameTransform',
    'prodNameLineHeight',
    'prodNameScale',
    'prodNameOffsetY',
    'limitFont',
    'limitColor',
    'splashColor',
    'accentColor',
    'splashTextColor',
    'priceTextColor',
    'priceCurrencyColor',
    'priceFont',
    'priceFontWeight',
    'priceFontStyle',
    'splashTextScale',
    'splashFill',
    'splashScale',
    'splashOffsetY',
    'splashRoundness',
    'currencySymbol',
    'priceFontSize',
    'splashStrokeWidth'
])

/**
 * Detecta se uma prop de globalStyles pode ser aplicada via fast-path
 * (sem reflow completo). Trim defensivo no input.
 */
export const isLightweightGlobalStyleProp = (prop: any): boolean =>
    LIGHTWEIGHT_GLOBAL_STYLE_PROPS.has(String(prop || '').trim())

/**
 * Conjunto de props de globalStyles que podem ter valor `undefined`
 * (significa "nao especificado, usar default da zona/template"). A
 * maioria das outras props requer valor concreto (cor, fonte, etc).
 */
export const ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS = new Set<string>([
    'splashTemplateId',
    'priceTextColor',
    'priceCurrencyColor',
    'priceFontWeight'
])

/**
 * Detecta se uma prop de globalStyles aceita valor undefined.
 */
export const allowsUndefinedGlobalStyleProp = (prop: any): boolean =>
    ALLOW_UNDEFINED_GLOBAL_STYLE_PROPS.has(String(prop || '').trim())
