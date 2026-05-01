/**
 * Helper puro para construir o payload de busca de imagem de produto
 * em recovery (quando uma imagem do card esta quebrada/expirada).
 *
 * Sem dependencia de canvas/refs. Le do card via duck-typing.
 *
 * Cobertura: tests/utils/cardRecoveryPayload.test.ts
 */

import { getCardTitleText } from './productCardLookup'

/**
 * Constroi o payload de busca para recovery de imagem de produto.
 * Combina campos de _productData (canonico) + fallback para
 * card.layerName e text do titulo.
 *
 *  - Term = name + brand + flavor + weight (sem duplicar termos
 *    que ja aparecem no name)
 *  - Apenas inclui brand/flavor/weight no return se nao-vazios
 *
 * Retorna null se name nao puder ser determinado.
 */
export const buildCardRecoverySearchPayload = (card: any): {
    term: string
    brand?: string
    flavor?: string
    weight?: string
} | null => {
    const pd = ((card as any)?._productData && typeof (card as any)._productData === 'object')
        ? (card as any)._productData
        : {}
    const titleObj = getCardTitleText(card)
    const titleText = String((titleObj as any)?.text || '').trim()
    const name = String(pd?.name || titleText || (card as any)?.layerName || '').trim()
    const brand = String(pd?.brand || '').trim()
    const flavor = String(pd?.flavor || '').trim()
    const weight = String(pd?.weight || '').trim()
    if (!name) return null

    const parts = [name]
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) parts.push(brand)
    if (flavor && !name.toLowerCase().includes(flavor.toLowerCase())) parts.push(flavor)
    if (weight && !name.toLowerCase().includes(weight.toLowerCase())) parts.push(weight)

    const term = parts.join(' ').trim()
    if (!term) return null
    return {
        term,
        ...(brand ? { brand } : {}),
        ...(flavor ? { flavor } : {}),
        ...(weight ? { weight } : {})
    }
}
