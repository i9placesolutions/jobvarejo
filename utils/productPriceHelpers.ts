/**
 * Helpers puros para extrair informacoes de preco/condicao de um
 * produto vindo do storage (Wasabi/parser/api). Sem dependencia de
 * canvas/refs/state.
 *
 * Cobertura: tests/utils/productPriceHelpers.test.ts
 */

import { stripAccents, normalizeSpecialCondition } from './productTextNormalize'
import { formatPriceValue } from './priceTagText'

/**
 * Extrai a "condicao especial" / observacao de um produto, varrendo
 * candidatos canonicos (specialCondition, condition, observation,
 * observations, observacao, observacoes, obs) e fallback heuristico
 * em qualquer chave que contenha OBSERV/CONDI ou seja exatamente OBS.
 *
 * Aplica normalizeSpecialCondition em cada candidato — retorna o
 * primeiro nao-vazio.
 *
 * Pure: sem mutacao no produto.
 */
export const getSpecialConditionFromProduct = (product: any): string | null => {
    if (!product || typeof product !== 'object') return null

    const directCandidates = [
        product.specialCondition,
        product.condition,
        product.observation,
        product.observations,
        product.observacao,
        product.observacoes,
        product.obs
    ]

    for (const c of directCandidates) {
        const normalized = normalizeSpecialCondition(c)
        if (normalized) return normalized
    }

    for (const [k, v] of Object.entries(product)) {
        const nk = stripAccents(String(k || '').toUpperCase())
        if (!nk) continue
        if (!nk.includes('OBSERV') && !nk.includes('CONDI') && nk !== 'OBS') continue
        const normalized = normalizeSpecialCondition(v)
        if (normalized) return normalized
    }

    return null
}

/**
 * Tipo de price entry retornado por getAvailablePrices: cada entry
 * tem o valor formatado, um label opcional (ex: "CX", "FARDO") e
 * um type categorizando se e' o preco principal (main), preco
 * promocional (special) ou preco por embalagem (pack).
 */
export type AvailablePriceEntry = {
    label: string
    value: string
    type: 'main' | 'special' | 'pack'
}

/**
 * Resultado de getAvailablePrices: lista ordenada por prioridade,
 * mais condition + hasSpecial flag e mainPrice (string usada na
 * etiqueta de preco regular).
 */
export type AvailablePricesResult = {
    prices: AvailablePriceEntry[]
    condition: string | null
    hasSpecial: boolean
    mainPrice: string
}

/**
 * Extrai TODOS os precos disponiveis de um produto e os ordena por
 * prioridade de exibicao na etiqueta:
 *
 *   1. priceSpecialUnit (atacado especial, sem label)
 *   2. priceSpecial (atacado embalagem, label CX/packageLabel)
 *   3. priceUnit (varejo unitario - "main")
 *   4. pricePack (embalagem - "main" se nao tem unit, senao "pack")
 *   5. price (legado, fallback final)
 *
 * Tambem retorna a condicao especial e mainPrice — string formatada
 * pronta para a etiqueta. Ordem de fallback do mainPrice:
 * main → pack → special → primeiro da lista → "0,00".
 *
 * Pure: nao muta o produto.
 */
export const getAvailablePrices = (product: any): AvailablePricesResult => {
    const prices: AvailablePriceEntry[] = []
    const condition = getSpecialConditionFromProduct(product)

    const addPrice = (value: any, label: string, type: 'main' | 'special' | 'pack'): boolean => {
        const formatted = formatPriceValue(value)
        if (formatted) {
            prices.push({ label, value: formatted, type })
            return true
        }
        return false
    }

    const hasSpecialUnit = addPrice(product?.priceSpecialUnit, '', 'special')

    if (!hasSpecialUnit) {
        addPrice(product?.priceSpecial, product?.packageLabel || 'CX', 'special')
    }

    const hasSpecial = prices.some(p => p.type === 'special')
    const hasUnitPrice = addPrice(product?.priceUnit, '', 'main')

    if (!hasUnitPrice) {
        addPrice(product?.pricePack, product?.packageLabel || 'CX', hasSpecial ? 'main' : 'pack')
    } else {
        const packFormatted = formatPriceValue(product?.pricePack)
        const unitFormatted = formatPriceValue(product?.priceUnit)
        if (packFormatted && packFormatted !== unitFormatted) {
            addPrice(product?.pricePack, product?.packageLabel || 'CX', 'pack')
        }
    }

    if (prices.length === 0) {
        addPrice(product?.price, '', 'main')
    }

    const pickByType = (type: 'main' | 'special' | 'pack') =>
        prices.find(p => p.type === type)?.value
    const mainPrice = pickByType('main')
        || pickByType('pack')
        || pickByType('special')
        || prices[0]?.value
        || '0,00'

    return {
        prices,
        condition,
        hasSpecial: prices.some(p => p.type === 'special'),
        mainPrice
    }
}
