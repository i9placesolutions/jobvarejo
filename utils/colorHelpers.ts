/**
 * Helpers puros de validacao/normalizacao de cores. Sem dependencia
 * de canvas/refs/state.
 *
 * Cobertura: tests/utils/colorHelpers.test.ts
 */

export type NormalizeHexColorOptions = {
    allowTransparent?: boolean
    allowUndefined?: boolean
}

/**
 * Normaliza um valor de cor hex para o formato canonico `#rrggbb`
 * (lowercase, 6 digitos). Aceita varias formas de input:
 *
 *  - "#abc" → "#aabbcc" (short → long form)
 *  - "abc" sem # → "#aabbcc" (adiciona #)
 *  - "#aabbcc" → "#aabbcc" (lowercase)
 *  - "ABC" / "AABBCC" → minusculas
 *  - "transparent" → "transparent" (apenas se allowTransparent: true)
 *
 * Falha → fallback (ou undefined se allowUndefined: true). Considera
 * falha:
 *  - vazio / null / undefined / whitespace → fallback (ou undefined)
 *  - hex de 4/5/8 digitos (com alpha) ou nao-hex → fallback
 *  - "transparent" sem allowTransparent → fallback
 *
 * Pure: sem efeito colateral.
 */
export const normalizeHexColor = (
    value: any,
    fallback: string,
    opts: NormalizeHexColorOptions = {}
): string | undefined => {
    if (value === undefined || value === null || value === '') {
        return opts.allowUndefined ? undefined : fallback
    }
    const raw = String(value).trim()
    if (!raw) return opts.allowUndefined ? undefined : fallback
    if (opts.allowTransparent && raw.toLowerCase() === 'transparent') return 'transparent'

    const prefixed = raw.startsWith('#') ? raw : `#${raw}`
    const short = /^#([0-9a-f]{3})$/i.exec(prefixed)
    if (short) {
        const shortToken = String(short[1] || '')
        const expanded = shortToken.split('').map((ch) => ch + ch).join('').toLowerCase()
        return `#${expanded}`
    }
    if (/^#[0-9a-f]{6}$/i.test(prefixed)) {
        return prefixed.toLowerCase()
    }
    return opts.allowUndefined ? undefined : fallback
}
