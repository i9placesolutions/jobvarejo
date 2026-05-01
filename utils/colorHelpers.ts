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
/**
 * Faz parse de uma cor (hex ou rgba) para componentes RGBA. Aceita:
 *  - "#abc"      → expande short → long; alpha=1
 *  - "#abcd"     → 4 digitos com alpha (cada digito repetido)
 *  - "#aabbcc"   → 6 digitos
 *  - "#aabbccdd" → 8 digitos com alpha
 *  - "rgb(r, g, b)" / "rgba(r, g, b, a)" — case-insensitive
 *
 * Componentes RGB clampados em [0, 255], alpha em [0, 1].
 *
 * Retorna null para input invalido (non-string, hex de tamanho
 * desconhecido, formato rgba malformado, NaN em algum componente).
 *
 * Pure: sem efeito colateral.
 */
export const parseTemplateColorRgba = (value: any): {
    r: number
    g: number
    b: number
    a: number
} | null => {
    if (typeof value !== 'string') return null
    const raw = value.trim()
    if (!raw) return null

    if (raw.startsWith('#')) {
        const hex = raw.slice(1)
        if (hex.length === 3 || hex.length === 4) {
            const expanded = hex.split('').map((c) => c + c).join('')
            const r = parseInt(expanded.slice(0, 2), 16)
            const g = parseInt(expanded.slice(2, 4), 16)
            const b = parseInt(expanded.slice(4, 6), 16)
            const a = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
            return { r, g, b, a }
        }
        if (hex.length === 6 || hex.length === 8) {
            const r = parseInt(hex.slice(0, 2), 16)
            const g = parseInt(hex.slice(2, 4), 16)
            const b = parseInt(hex.slice(4, 6), 16)
            const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
            return { r, g, b, a }
        }
        return null
    }

    const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/i)
    if (!rgbaMatch) return null
    const parts = rgbaMatch[1]!.split(',').map((part) => part.trim())
    if (parts.length < 3) return null
    const r = Number(parts[0] || 0)
    const g = Number(parts[1] || 0)
    const b = Number(parts[2] || 0)
    const a = parts.length >= 4 ? Number(parts[3] || 1) : 1
    if (![r, g, b, a].every((n) => Number.isFinite(n))) return null
    return {
        r: Math.max(0, Math.min(255, r)),
        g: Math.max(0, Math.min(255, g)),
        b: Math.max(0, Math.min(255, b)),
        a: Math.max(0, Math.min(1, a))
    }
}

/**
 * Detecta se uma cor e' "praticamente transparente" — alpha <= 0.12
 * ou null/undefined. Usado em templates para decidir se um background
 * deve ser tratado como ausente (e.g. fallback para cor solida).
 *
 * Pure: usa parseTemplateColorRgba internamente.
 */
export const isTransparentLikeTemplateColor = (value: any): boolean => {
    if (value === null || value === undefined) return true
    if (typeof value !== 'string') return false
    const rgba = parseTemplateColorRgba(value)
    return !!rgba && rgba.a <= 0.12
}

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
