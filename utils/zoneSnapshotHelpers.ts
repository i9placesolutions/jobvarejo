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
