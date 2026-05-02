/**
 * Helpers puros para construcao de snapshots de zona/card. Sem
 * dependencia de canvas/refs/state.
 *
 * Cobertura: tests/utils/zoneSnapshotHelpers.test.ts
 */

/**
 * Clona um valor plain (JSON-safe) recursivamente, removendo funcoes
 * e referencias circulares. Estrategia em 2 camadas:
 *
 *  1. JSON round-trip (rapido, lida com 99% dos casos)
 *  2. Fallback recursivo manual: arrays/objetos visitados,
 *     funcoes ignoradas
 *
 * Usado para snapshot de productData e zoneSlot dentro do snapshot
 * da zona — precisa ser plain JSON para ser serializavel.
 *
 * Pure (mas pode ser caro em estruturas profundas).
 */
export const clonePlainForZoneSnapshot = (value: any): any => {
    if (value == null) return value
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        if (Array.isArray(value)) return value.map((item) => clonePlainForZoneSnapshot(item))
        if (typeof value === 'object') {
            const out: Record<string, any> = {}
            Object.entries(value).forEach(([key, entry]: [string, any]) => {
                if (typeof entry === 'function') return
                out[key] = clonePlainForZoneSnapshot(entry)
            })
            return out
        }
        return value
    }
}

/**
 * Coerce numerico com fallback (default 0) — null se nao-finito.
 * Usado em snapshots de geometria onde NaN nunca deve aparecer.
 */
export const finiteZoneSnapshotNumber = (value: any, fallback: number = 0): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

/**
 * Retorna o primeiro valor definido (nao undefined, null nem string
 * vazia) dentre os argumentos. Util para fallback chains de campos
 * de produto:
 *
 *   firstDefinedZoneSnapshotValue(productData.name, card.productName, '')
 */
export const firstDefinedZoneSnapshotValue = (...values: any[]): any => {
    for (const value of values) {
        if (typeof value !== 'undefined' && value !== null && value !== '') return value
    }
    return null
}

/**
 * Constroi snapshot de um card produto dentro de uma zona, capturando:
 *  - identidade (id, order, parentZoneId, parentFrameId)
 *  - slot (posicao reservada na zona)
 *  - geometry (left, top, width, height, scale, angle)
 *  - productData (clonePlain do _productData)
 *  - product (campos top-level do card mais productData merge)
 *  - priceGroup (snapshot serializado via DI `serializePriceGroup`)
 *
 * Caller injeta:
 *  - `findTitleText`: encontra title text node (getCardTitleText)
 *  - `findPriceGroup`: encontra priceGroup do card (getPriceGroupFromAny)
 *  - `serializePriceGroup`: serializa priceGroup para JSON do template
 */
export const buildZoneCardStateSnapshot = (
    card: any,
    index: number,
    findTitleText: (c: any) => any,
    findPriceGroup: (c: any) => any,
    serializePriceGroup: (pg: any) => any
): any => {
    const productData = card?._productData && typeof card._productData === 'object' ? card._productData : {}
    const titleText = findTitleText(card)
    let priceGroupSnapshot: any = null
    try {
        priceGroupSnapshot = serializePriceGroup(findPriceGroup(card))
    } catch {
        // best-effort
    }

    return {
        id: String(card?._customId || '').trim(),
        order: finiteZoneSnapshotNumber(card?._zoneOrder, index),
        parentZoneId: String(card?.parentZoneId || '').trim(),
        parentFrameId: String(card?.parentFrameId || '').trim() || null,
        slot: clonePlainForZoneSnapshot(card?._zoneSlot || null),
        geometry: {
            left: finiteZoneSnapshotNumber(card?.left),
            top: finiteZoneSnapshotNumber(card?.top),
            width: finiteZoneSnapshotNumber(card?._cardWidth ?? card?.width),
            height: finiteZoneSnapshotNumber(card?._cardHeight ?? card?.height),
            scaleX: finiteZoneSnapshotNumber(card?.scaleX, 1),
            scaleY: finiteZoneSnapshotNumber(card?.scaleY, 1),
            angle: finiteZoneSnapshotNumber(card?.angle)
        },
        productData: clonePlainForZoneSnapshot(productData),
        product: {
            name: String(firstDefinedZoneSnapshotValue(productData?.name, productData?.title, card?.productName, titleText?.text) || '').trim(),
            description: String(firstDefinedZoneSnapshotValue(productData?.description, productData?.subtitle, '') || '').trim(),
            imageUrl: firstDefinedZoneSnapshotValue(card?.imageUrl, productData?.imageUrl, productData?.image),
            priceMode: firstDefinedZoneSnapshotValue(productData?.priceMode, productData?.price_mode),
            price: firstDefinedZoneSnapshotValue(productData?.price, card?.price),
            pricePack: firstDefinedZoneSnapshotValue(productData?.pricePack, card?.pricePack),
            priceUnit: firstDefinedZoneSnapshotValue(productData?.priceUnit, card?.priceUnit),
            priceSpecial: firstDefinedZoneSnapshotValue(productData?.priceSpecial, card?.priceSpecial),
            priceSpecialUnit: firstDefinedZoneSnapshotValue(productData?.priceSpecialUnit, card?.priceSpecialUnit),
            priceWholesale: firstDefinedZoneSnapshotValue(productData?.priceWholesale, card?.priceWholesale),
            wholesaleTrigger: firstDefinedZoneSnapshotValue(productData?.wholesaleTrigger, card?.wholesaleTrigger),
            wholesaleTriggerUnit: firstDefinedZoneSnapshotValue(productData?.wholesaleTriggerUnit, card?.wholesaleTriggerUnit),
            packQuantity: firstDefinedZoneSnapshotValue(productData?.packQuantity, card?.packQuantity),
            packUnit: firstDefinedZoneSnapshotValue(productData?.packUnit, card?.packUnit),
            packageLabel: firstDefinedZoneSnapshotValue(productData?.packageLabel, card?.packageLabel),
            specialCondition: firstDefinedZoneSnapshotValue(productData?.specialCondition, card?.specialCondition),
            unit: firstDefinedZoneSnapshotValue(productData?.unit, card?.unit),
            unitLabel: firstDefinedZoneSnapshotValue(productData?.unitLabel, card?.unitLabel),
            limit: firstDefinedZoneSnapshotValue(productData?.limit, card?.limit),
            titleText: titleText?.text ?? null
        },
        priceGroup: clonePlainForZoneSnapshot(priceGroupSnapshot)
    }
}

/**
 * Constroi snapshot completo de uma zona com seus cards. Inclui:
 *  - identidade (id, name, role, source, status)
 *  - geometry, layout, appearance
 *  - globalStyles aplicados
 *  - labelTemplate snapshot
 *  - cards ordenados (via `_zoneOrder`)
 *
 * Caller injeta:
 *  - `getZoneStyles`: retorna globalStyles da zone (getZoneGlobalStyles)
 *  - DIs do `buildZoneCardStateSnapshot`
 */
export const buildZoneStateSnapshot = (
    zone: any,
    zoneCards: any[],
    getZoneStyles: (z: any) => any,
    findTitleText: (c: any) => any,
    findPriceGroup: (c: any) => any,
    serializePriceGroup: (pg: any) => any
): any => {
    const orderedCards = [...(zoneCards || [])].sort((a: any, b: any) => {
        const orderA = finiteZoneSnapshotNumber(a?._zoneOrder, Number.MAX_SAFE_INTEGER)
        const orderB = finiteZoneSnapshotNumber(b?._zoneOrder, Number.MAX_SAFE_INTEGER)
        if (orderA !== orderB) return orderA - orderB
        return String(a?._customId || '').localeCompare(String(b?._customId || ''))
    })
    const globalStyles = getZoneStyles(zone)
    const snapshotTemplateId = String(zone?._zoneTemplateSnapshotId || globalStyles?.splashTemplateId || '').trim()

    return {
        version: 1,
        zone: {
            id: String(zone?._customId || '').trim(),
            name: String(zone?.zoneName || '').trim() || 'Zona de Produtos',
            role: zone?.role || 'grid',
            contentSource: zone?.contentSource || 'manual',
            contentStatus: zone?.contentStatus || 'empty',
            overflowPolicy: zone?.overflowPolicy || 'warn',
            parentFrameId: String(zone?.parentFrameId || '').trim() || null,
            geometry: {
                x: finiteZoneSnapshotNumber(zone?.left),
                y: finiteZoneSnapshotNumber(zone?.top),
                width: finiteZoneSnapshotNumber(zone?._zoneWidth ?? zone?.width, 900),
                height: finiteZoneSnapshotNumber(zone?._zoneHeight ?? zone?.height, 600),
                scaleX: finiteZoneSnapshotNumber(zone?.scaleX, 1),
                scaleY: finiteZoneSnapshotNumber(zone?.scaleY, 1),
                angle: finiteZoneSnapshotNumber(zone?.angle)
            },
            layout: {
                padding: finiteZoneSnapshotNumber(zone?._zonePadding ?? zone?.padding, 15),
                gapHorizontal: finiteZoneSnapshotNumber(zone?.gapHorizontal ?? zone?._zonePadding ?? zone?.padding, 15),
                gapVertical: finiteZoneSnapshotNumber(zone?.gapVertical ?? zone?._zonePadding ?? zone?.padding, 15),
                columns: finiteZoneSnapshotNumber(zone?.columns),
                rows: finiteZoneSnapshotNumber(zone?.rows),
                columnRatio: clonePlainForZoneSnapshot(zone?.columnRatio ?? null),
                rowRatio: clonePlainForZoneSnapshot(zone?.rowRatio ?? null),
                cardAspectRatio: zone?.cardAspectRatio ?? 'fill',
                lastRowBehavior: zone?.lastRowBehavior ?? 'fill',
                layoutDirection: zone?.layoutDirection ?? 'horizontal',
                verticalAlign: zone?.verticalAlign ?? 'stretch',
                highlightCount: finiteZoneSnapshotNumber(zone?.highlightCount),
                highlightPos: zone?.highlightPos ?? 'first',
                highlightHeight: finiteZoneSnapshotNumber(zone?.highlightHeight, 1.5),
                highlightStyle: zone?.highlightStyle ?? null,
                splashOffsetByCol: clonePlainForZoneSnapshot(zone?.splashOffsetByCol ?? null)
            },
            appearance: {
                backgroundColor: zone?.backgroundColor ?? zone?.fill ?? null,
                borderColor: zone?.stroke ?? null,
                borderWidth: finiteZoneSnapshotNumber(zone?.strokeWidth),
                borderRadius: finiteZoneSnapshotNumber(zone?.rx ?? zone?.borderRadius),
                showBorder: zone?.stroke !== 'transparent' && zone?.strokeWidth !== 0
            }
        },
        globalStyles: clonePlainForZoneSnapshot(globalStyles),
        labelTemplate: {
            id: snapshotTemplateId || null,
            snapshot: clonePlainForZoneSnapshot(zone?._zoneTemplateSnapshot || null)
        },
        cards: orderedCards.map((card: any, index: number) =>
            buildZoneCardStateSnapshot(card, index, findTitleText, findPriceGroup, serializePriceGroup)
        )
    }
}

/**
 * Encontra todos os cards de um zone state snapshot (validando version=1).
 * Retorna array vazio se snapshot e' invalido/ausente.
 */
export const getZoneSnapshotCards = (zone: any): any[] => {
    const snapshot = zone?._zoneStateSnapshot
    if (!snapshot || typeof snapshot !== 'object' || Number(snapshot.version || 0) !== 1) return []
    return Array.isArray(snapshot.cards) ? snapshot.cards.filter((card: any) => card && typeof card === 'object') : []
}

/**
 * Reconstroi o objeto productData a partir de um cardSnapshot. Mescla:
 *  - cardSnapshot.productData (clone plain)
 *  - cardSnapshot.product (campos top-level: name, description, imageUrl, prices)
 *
 * Prefere productData.* sobre product.* (mais especifico). Sintetiza
 * `image` e `image_wasabi_key` a partir do imageUrl resolvido.
 */
export const buildProductFromZoneSnapshotCard = (cardSnapshot: any): any => {
    const productData = cardSnapshot?.productData && typeof cardSnapshot.productData === 'object'
        ? clonePlainForZoneSnapshot(cardSnapshot.productData)
        : {}
    const product = cardSnapshot?.product && typeof cardSnapshot.product === 'object'
        ? cardSnapshot.product
        : {}
    const imageUrl = firstDefinedZoneSnapshotValue(product?.imageUrl, productData?.imageUrl, productData?.image, productData?.image_wasabi_key)

    return {
        ...productData,
        name: String(firstDefinedZoneSnapshotValue(productData?.name, product?.name, product?.titleText) || '').trim(),
        description: firstDefinedZoneSnapshotValue(productData?.description, product?.description),
        imageUrl,
        image: firstDefinedZoneSnapshotValue(productData?.image, imageUrl),
        image_wasabi_key: firstDefinedZoneSnapshotValue(productData?.image_wasabi_key, imageUrl),
        priceMode: firstDefinedZoneSnapshotValue(productData?.priceMode, product?.priceMode),
        price: firstDefinedZoneSnapshotValue(productData?.price, product?.price),
        pricePack: firstDefinedZoneSnapshotValue(productData?.pricePack, product?.pricePack),
        priceUnit: firstDefinedZoneSnapshotValue(productData?.priceUnit, product?.priceUnit),
        priceSpecial: firstDefinedZoneSnapshotValue(productData?.priceSpecial, product?.priceSpecial),
        priceSpecialUnit: firstDefinedZoneSnapshotValue(productData?.priceSpecialUnit, product?.priceSpecialUnit),
        priceWholesale: firstDefinedZoneSnapshotValue(productData?.priceWholesale, product?.priceWholesale),
        wholesaleTrigger: firstDefinedZoneSnapshotValue(productData?.wholesaleTrigger, product?.wholesaleTrigger),
        wholesaleTriggerUnit: firstDefinedZoneSnapshotValue(productData?.wholesaleTriggerUnit, product?.wholesaleTriggerUnit),
        packQuantity: firstDefinedZoneSnapshotValue(productData?.packQuantity, product?.packQuantity),
        packUnit: firstDefinedZoneSnapshotValue(productData?.packUnit, product?.packUnit),
        packageLabel: firstDefinedZoneSnapshotValue(productData?.packageLabel, product?.packageLabel),
        specialCondition: firstDefinedZoneSnapshotValue(productData?.specialCondition, product?.specialCondition),
        unit: firstDefinedZoneSnapshotValue(productData?.unit, product?.unit),
        unitLabel: firstDefinedZoneSnapshotValue(productData?.unitLabel, product?.unitLabel),
        limit: firstDefinedZoneSnapshotValue(productData?.limit, product?.limit)
    }
}

/**
 * Reconstroi um label template a partir de um zone+cardSnapshot.
 * Prioriza:
 *  1. cardSnapshot.priceGroup (template especifico do card)
 *  2. zone._zoneStateSnapshot.labelTemplate.snapshot
 *  3. zone._zoneTemplateSnapshot
 *
 * Retorna `undefined` se nenhum template valido encontrado.
 *
 * Caller injeta `makeNewId` (tipicamente `makeId`) para gerar fallback id.
 */
export const buildLabelTemplateFromZoneSnapshot = (
    zone: any,
    cardSnapshot: any,
    makeNewId: () => string
): any | undefined => {
    const cardPriceGroup = cardSnapshot?.priceGroup && typeof cardSnapshot.priceGroup === 'object'
        ? cardSnapshot.priceGroup
        : null
    if (cardPriceGroup) {
        return {
            id: `zone-card-snapshot-${String(cardSnapshot?.id || makeNewId()).trim() || makeNewId()}`,
            name: 'Etiqueta recuperada',
            group: clonePlainForZoneSnapshot(cardPriceGroup)
        }
    }

    const stateSnapshot = zone?._zoneStateSnapshot
    const zoneTemplate = stateSnapshot?.labelTemplate?.snapshot && typeof stateSnapshot.labelTemplate.snapshot === 'object'
        ? stateSnapshot.labelTemplate.snapshot
        : zone?._zoneTemplateSnapshot
    if (!zoneTemplate || typeof zoneTemplate !== 'object') return undefined
    return {
        id: String(stateSnapshot?.labelTemplate?.id || zone?._zoneTemplateSnapshotId || 'zone-snapshot-template'),
        name: 'Etiqueta da zona',
        group: clonePlainForZoneSnapshot(zoneTemplate)
    }
}

/**
 * Extrai um payload diagnostico de um zone com seus cards. Capture
 * para cada card: id, name, imageUrl, status, error, e dados de preco.
 *
 * Caller pode passar `zoneCardsOverride` se ja tem os cards calculados,
 * caso contrario usa `getZoneChildren` injetado.
 */
export const getZoneCardDiagnosticsPayload = (
    zone: any,
    getCards: (z: any) => any[],
    zoneCardsOverride?: any[]
): any[] => {
    const zoneCards = Array.isArray(zoneCardsOverride) ? zoneCardsOverride : getCards(zone)
    return zoneCards.map((card: any) => {
        const productData = (card as any)?._productData && typeof (card as any)._productData === 'object'
            ? (card as any)._productData
            : {}
        return {
            id: String((card as any)?._customId || '').trim(),
            name: String(productData?.name || (card as any)?.productName || '').trim(),
            imageUrl: (card as any)?.imageUrl || productData?.imageUrl || productData?.image || null,
            status: productData?.status || null,
            imageReviewReason: productData?.imageReviewReason || productData?.imageDecisionReason || null,
            error: productData?.error || null,
            priceMode: productData?.priceMode || productData?.price_mode || null,
            pricePack: productData?.pricePack ?? null,
            priceUnit: productData?.priceUnit ?? null,
            priceSpecial: productData?.priceSpecial ?? null,
            priceSpecialUnit: productData?.priceSpecialUnit ?? null,
            specialCondition: productData?.specialCondition || null
        }
    })
}

/**
 * Walk em todos os objetos do canvas e aplica `syncZoneMetadata`
 * em cada zone (filtrado por `isProductZone`). Skip zones com erro
 * (log via `onError`).
 *
 * Mutates as zones via `syncZoneMetadata`. Retorna o numero de zones
 * processadas com sucesso.
 *
 * Caller injeta:
 *  - `isProductZone` (isLikelyProductZone)
 *  - `syncZoneMetadata` (syncZoneDerivedMetadata wrapper)
 */
export const syncAllZoneStateSnapshots = (
    canvasInstance: any,
    isProductZone: (obj: any) => boolean,
    syncZoneMetadata: (zone: any) => void,
    onError?: (zone: any, err: unknown) => void
): number => {
    if (!canvasInstance || typeof canvasInstance.getObjects !== 'function') return 0
    const objects = canvasInstance.getObjects?.() || []
    let processed = 0
    objects.forEach((obj: any) => {
        if (!isProductZone(obj)) return
        try {
            syncZoneMetadata(obj)
            processed++
        } catch (err) {
            if (onError) onError(obj, err)
        }
    })
    return processed
}
