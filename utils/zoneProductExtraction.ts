/**
 * Helpers puros para extracao de "produtos" a partir de cards de uma
 * zona de produtos. Usado quando o usuario abre o modal de revisao
 * com cards ja existentes (replace mode).
 *
 * Sem dependencia de canvas/refs. Recebe card + zoneId + index e
 * resolve dados (nome, brand, precos, imagem) com fallbacks.
 *
 * Cobertura: tests/utils/zoneProductExtraction.test.ts
 */

import { getCardTitleText } from './productCardLookup'

/**
 * Estrutura do produto exibido no modal de revisao. Subset de Product
 * com defaults seguros aplicados (string vazia em vez de null para
 * compatibilidade com inputs).
 */
export type ZoneReviewProduct = {
    id: string
    productId?: string
    productInstanceId?: string
    zoneInstanceId?: string
    name: string
    brand: string
    weight: string
    price: any
    pricePack: any
    priceUnit: any
    priceSpecial: any
    priceSpecialUnit: any
    specialCondition: any
    priceWholesale: any
    wholesaleTrigger: any
    wholesaleTriggerUnit: any
    packQuantity: any
    packUnit: any
    packageLabel: any
    price_mode: string
    limit: any
    flavor: string
    imageUrl: string | null
    status: 'done' | 'pending'
    error?: undefined | string
    raw: any
}

/**
 * Mapeia um card duck-typed para a struct ZoneReviewProduct, com
 * fallback chain:
 *  - name: text do titulo > productData.name > card.layerName > "Produto N"
 *  - imageUrl: productData.imageUrl > productData.image > card.imageUrl
 *  - productInstanceId: productData.productInstanceId > card.productInstanceId > card._customId
 *  - zoneInstanceId: card.parentZoneId > productData.zoneInstanceId > zone._customId
 *
 * Pure: nao acessa canvas/refs.
 */
export const mapCardToZoneReviewProduct = (
    card: any,
    zone: any,
    index: number
): ZoneReviewProduct => {
    const base = (((card as any)?._productData && typeof (card as any)._productData === 'object')
        ? { ...(card as any)._productData }
        : {}) as any

    const titleObj = getCardTitleText(card)
    const titleText = String((titleObj as any)?.text ?? '').replace(/\r\n?/g, '\n')
    const fallbackName = `Produto ${index + 1}`
    const rawName = titleText || String(base.name ?? (card as any)?.layerName ?? '')
    const name = /\S/.test(rawName) ? rawName : fallbackName
    const imageUrlRaw = base.imageUrl ?? base.image ?? (card as any)?.imageUrl ?? null
    const imageUrl = imageUrlRaw == null ? null : String(imageUrlRaw).trim() || null

    const productId = String(base.productId || base.product_id || base.id || (card as any)?.productId || '').trim()
    const productInstanceId = String(base.productInstanceId || (card as any)?.productInstanceId || (card as any)?._customId || '').trim()
    const zoneInstanceId = String((card as any)?.parentZoneId || base.zoneInstanceId || (zone as any)?._customId || '').trim()

    return {
        id: productInstanceId || `zone-product-${index + 1}`,
        productId: productId || undefined,
        productInstanceId: productInstanceId || undefined,
        zoneInstanceId: zoneInstanceId || undefined,
        name,
        brand: base.brand ?? '',
        weight: base.weight ?? '',
        price: base.price ?? (card as any)?.price ?? '',
        pricePack: base.pricePack ?? (card as any)?.pricePack ?? '',
        priceUnit: base.priceUnit ?? (card as any)?.priceUnit ?? '',
        priceSpecial: base.priceSpecial ?? (card as any)?.priceSpecial ?? '',
        priceSpecialUnit: base.priceSpecialUnit ?? (card as any)?.priceSpecialUnit ?? '',
        specialCondition: base.specialCondition ?? (card as any)?.specialCondition ?? '',
        priceWholesale: base.priceWholesale ?? (card as any)?.priceWholesale ?? '',
        wholesaleTrigger: base.wholesaleTrigger ?? (card as any)?.wholesaleTrigger ?? null,
        wholesaleTriggerUnit: base.wholesaleTriggerUnit ?? (card as any)?.wholesaleTriggerUnit ?? '',
        packQuantity: base.packQuantity ?? (card as any)?.packQuantity ?? null,
        packUnit: base.packUnit ?? (card as any)?.packUnit ?? '',
        packageLabel: base.packageLabel ?? (card as any)?.packageLabel ?? '',
        price_mode: base.price_mode ?? 'retail',
        limit: base.limit ?? (card as any)?.limit ?? '',
        flavor: base.flavor ?? '',
        imageUrl,
        status: imageUrl ? 'done' : 'pending',
        error: undefined,
        raw: base.raw ?? base
    }
}

/**
 * Ordena cards por _zoneOrder (numerico) — cards sem _zoneOrder vao
 * pro fim. Ordenacao estavel preservada via slice().
 */
export const sortCardsByZoneOrder = (cards: any[]): any[] => {
    return (cards || [])
        .filter((card: any) => !!card)
        .slice()
        .sort((a: any, b: any) => {
            const ao = Number((a as any)?._zoneOrder)
            const bo = Number((b as any)?._zoneOrder)
            if (Number.isFinite(ao) && Number.isFinite(bo)) return ao - bo
            if (Number.isFinite(ao)) return -1
            if (Number.isFinite(bo)) return 1
            return 0
        })
}
