// Shared layout rules used by the Quick Editor. This entry is bundled for the
// isolated Chromium renderer so it does not maintain another copy of the grid,
// typography, or validity calculations.
export { calculateGridLayout } from '../../utils/product-zone-helpers'
export { resolveProductZoneStructure } from '../../utils/product-zone-structure'
export { fitResponsiveProductTypography, harmonizeProductCardTypography } from '../../utils/productCardResponsiveTypography'
export { layoutInlineFooterValidity } from '../../utils/inlineFooterValidityLayout'

import { createPriceGroupBuilders } from '../../utils/priceGroupBuilders'
import { createPriceGroupLayout } from '../../utils/priceGroupLayout'
import { createProductCardConfigurationLayout } from '../../utils/editorProductCardConfiguration'
import { normalizePriceGroupPlacementInCard } from '../../utils/fabricMeasure'
import { createDefaultProductCardConfiguration, normalizeProductCardConfiguration, resolveProductCardConfigurationProfile } from '../../utils/product-card-configuration'
import { autoTrimFabricImage } from '../../utils/fabricImageHelpers'
import { planAutomaticProductImageFill } from '../../utils/automaticProductImageFill'
import { layoutPrice } from '../../utils/priceTagLayout'
import { PRICE_INTEGER_DECIMAL_GAP_PX, normalizeUnitForLabel } from '../../utils/priceTagText'
import { getSinglePriceCurrencyTextCandidate } from '../../utils/priceLayoutClassifiers'
import {
  isRichPriceTextObject,
  migratePriceGroupToRichText,
  positionRichPriceUnit,
  setRichPriceBaseFontSize,
  setRichPriceSegmentStyle
} from '../../utils/priceRichText'

// The Quick Editor uses this builder when a blank model has no chosen label
// or donor card. The WhatsApp renderer must take that same fallback path.
export const createManualDefaultPriceGroup = (
  fabric: any, price: string, cardWidth: number, cardHeight: number, unit = ''
): any => {
  const collect = (object: any): any[] => [object, ...(object.getObjects?.() || []).flatMap(collect)]
  const noop = () => undefined
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value))
  const layout = createPriceGroupLayout({
    getFabric: () => fabric,
    migratePriceGroupToRichText: group => migratePriceGroupToRichText(group, fabric),
    collectObjectsDeep: collect,
    findByName: (objects, name) => objects.find((object: any) => object?.name === name),
    repairAtacarejoTextNames: noop,
    resolveFardoSpecialPricePalette: value => value,
    clamp,
    priceIntegerDecimalGapPx: PRICE_INTEGER_DECIMAL_GAP_PX,
    setVisible: (object, visible) => object?.set?.('visible', visible),
    setText: (object, text) => object?.set?.('text', text),
    isRichPriceTextObject,
    setRichPriceBaseFontSize,
    setRichPriceSegmentStyle,
    positionRichPriceUnit,
    layoutPrice,
    measureHorizontalBoundsLocal: noop,
    shouldPreserveManualTemplateVisual: () => false,
    fitManualAtacarejoValuesIntoTemplate: noop,
    layoutManualTemplateGroup: noop,
    rememberPriceLayoutSnapshot: () => false,
    fitManualSinglePriceValuesIntoTemplate: noop,
    layoutCustomPriceGroup: noop,
    getSinglePriceCurrencyTextCandidate,
    ensureSinglePriceCurrencyCircleAnchor: (_group, objects) =>
      (objects || []).find((object: any) => object?.name === 'price_currency_bg'),
    normalizeUnitForLabel
  })
  const builders = createPriceGroupBuilders({
    fabric: () => fabric,
    layoutPriceGroup: layout.layoutPriceGroup,
    applyAtacarejoPricingToPriceGroup: noop,
    safeAddWithUpdate: noop
  })
  return builders.buildDefaultPriceGroupForCard(price, cardWidth, cardHeight, 0, unit)
}

// Apply the same account-level Cards recipe that simulateSmartGrid loads before
// creating a card in the Quick Editor. The recipe owns the image and price
// geometry, including the configured automatic image fill count.
export const applyManualCardConfiguration = (
  fabric: any, card: any, cardWidth: number, cardHeight: number, styles: any
): void => {
  const priceGroup = (group: any) => group?.getObjects?.().find((object: any) => object?.name === 'priceGroup') || null
  const layout = createProductCardConfigurationLayout({
    fabric: () => fabric,
    enableCardElementRotationControl: () => undefined,
    safeRequestRenderAll: () => undefined,
    getPriceGroupFromAny: priceGroup,
    normalizePriceGroupPlacementInCard: (group, width, height, placement, options) =>
      normalizePriceGroupPlacementInCard(group, width, height, placement, () => false, options)
  })
  layout.applyProductCardConfigurationLayout(card, cardWidth, cardHeight, {
    ...styles,
    cardLayout: normalizeProductCardConfiguration(styles?.cardLayout || createDefaultProductCardConfiguration())
  })
}

export const prepareManualCardImages = (
  fabric: any, image: any, cardWidth: number, cardHeight: number, cardLayout: any
): any[] => {
  if (!image) return []
  autoTrimFabricImage(image, { preserveVisualPosition: false })
  const configuration = normalizeProductCardConfiguration(cardLayout || createDefaultProductCardConfiguration())
  const imageLayout = resolveProductCardConfigurationProfile(configuration, cardWidth, cardHeight).elements.image
  const areaWidth = cardWidth * Math.min(imageLayout.width, 2 * Math.min(imageLayout.x, 100 - imageLayout.x)) / 100
  const areaHeight = cardHeight * Math.min(imageLayout.height, 2 * Math.min(imageLayout.y, 100 - imageLayout.y)) / 100
  const count = planAutomaticProductImageFill(areaWidth, areaHeight, Number(image.width), Number(image.height)).length
  return [image, ...Array.from({ length: count - 1 }, (_, index) => {
    const props = image.toObject()
    delete props.type
    delete props.version
    return new fabric.FabricImage(image.getElement(), {
      ...props,
      name: `extra_image_${index + 1}`,
      data: { ...image.data, smartType: 'product-image' },
      objectCaching: false
    })
  })]
}
