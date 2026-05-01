/**
 * Helpers puros para inferir partes do "header" (titulo + unidade) de
 * uma label de preco a partir de um produto. Sao usados no pipeline
 * de geracao automatica de labels (ex: Red Burst, Black Yellow) onde
 * o header precisa ser composto a partir do nome/peso do produto.
 *
 * Sem dependencia de canvas/Fabric/refs.
 *
 * Cobertura: tests/utils/priceTagHeaderHelpers.test.ts
 */

import { extractLimitFromName } from './productTextNormalize'
import { inferUnitLabelFromProduct } from './priceTagText'

/**
 * Extrai um token de peso ("500G", "1KG", "12X1L", etc) do nome ou
 * peso do produto. Normaliza:
 *  - X/× → X
 *  - GRS/GR/G → G
 *  - KGS → KG
 *  - MLS → ML
 *  - LTS → L
 *
 * Retorna string vazia se nao encontrar token de peso.
 */
export const extractWeightTokenForHeader = (product: any): string => {
    const nameRaw = String(product?.name || '').toUpperCase()
    const weightRaw = String(product?.weight || '').toUpperCase()
    const probe = `${nameRaw} ${weightRaw}`
    const match = probe.match(/(\d+\s*[Xx×]\s*\d+(?:[.,]\d+)?\s*(?:KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)\b|\d+(?:[.,]\d+)?\s*(?:KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)\b)/i)
    if (!match) return ''
    return String(match[1] || '')
        .toUpperCase()
        .replace(/\s*[Xx×]\s*/g, 'X')
        .replace(/\s+/g, '')
        .replace(/GRS?\b/g, 'G')
        .replace(/KGS\b/g, 'KG')
        .replace(/MLS\b/g, 'ML')
        .replace(/LTS\b/g, 'L')
}

/**
 * Normaliza um token de peso ja extraido — aplica as mesmas regras de
 * minusculas/whitespace/sufixos do `extractWeightTokenForHeader` mas
 * sem fazer regex match. Util para comparar tokens entre si (e.g.
 * "ja contem o peso?").
 */
export const normalizeHeaderWeightToken = (value: string): string => {
    return String(value || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/GRS?\b/g, 'G')
        .replace(/KGS\b/g, 'KG')
        .replace(/MLS\b/g, 'ML')
        .replace(/LTS\b/g, 'L')
}

export type HeaderPartsOptions = {
    preferFullNameWithWeight?: boolean
    splitUnitIntoDedicatedField?: boolean
}

export type HeaderParts = {
    title: string
    unit: string
}

/**
 * Compoe `{ title, unit }` para preencher header de label a partir
 * de um produto. Aplica:
 *
 *  - extractLimitFromName: remove "LIMITE 2 UN" etc do nome
 *  - title em UPPERCASE, sem "R$ XX.XX", sem espacos extra
 *  - se preferFullNameWithWeight: anexa weight token (ou KG se unit=='KG')
 *  - se splitUnitIntoDedicatedField: remove sufixo do title (KG/UN no final)
 *  - clamp por tamanho maximo (36 com weight, 26 sem) com truncate inteligente
 *  - fallback "OFERTA" (ou customizado) se title final for vazio
 */
export const inferHeaderPartsFromProduct = (
    product: any,
    fallback?: string,
    opts: HeaderPartsOptions = {}
): HeaderParts => {
    const fallbackText = String(fallback || 'OFERTA').trim() || 'OFERTA'
    const rawName = String(product?.name || '').replace(/\s+/g, ' ').trim()
    const { cleanedName } = extractLimitFromName(rawName)
    const inferredUnit = inferUnitLabelFromProduct(product)
    const unit = inferredUnit === 'KG' ? 'KG' : (inferredUnit === 'UN' ? 'UN' : '')
    const splitUnitIntoDedicatedField = opts.splitUnitIntoDedicatedField !== false

    let title = String(cleanedName || fallbackText).toUpperCase()
    title = title
        .replace(/\bR\$\s*[\d\.,]+\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    const weightToken = extractWeightTokenForHeader(product)
    if (opts.preferFullNameWithWeight && weightToken && !normalizeHeaderWeightToken(title).includes(normalizeHeaderWeightToken(weightToken))) {
        title = `${title} ${weightToken}`.replace(/\s+/g, ' ').trim()
    }
    if (opts.preferFullNameWithWeight && !weightToken && unit === 'KG' && !/\bKG\b/i.test(title)) {
        title = `${title} KG`.replace(/\s+/g, ' ').trim()
    }

    if (splitUnitIntoDedicatedField && unit && new RegExp(`\\b${unit}\\b$`, 'i').test(title)) {
        title = title.replace(new RegExp(`\\b${unit}\\b$`, 'i'), '').trim()
    }

    if (!title) title = fallbackText.toUpperCase()
    const maxLen = opts.preferFullNameWithWeight ? 36 : 26
    if (title.length > maxLen) {
        if (opts.preferFullNameWithWeight && weightToken && maxLen > weightToken.length + 6) {
            const prefixMax = maxLen - (weightToken.length + 1)
            const withoutWeight = title.replace(weightToken, '').replace(/\s+/g, ' ').trim()
            title = `${withoutWeight.slice(0, prefixMax).trim()} ${weightToken}`.trim()
        } else {
            title = `${title.slice(0, maxLen).trim()}...`
        }
    }
    return { title, unit: splitUnitIntoDedicatedField ? unit : '' }
}
