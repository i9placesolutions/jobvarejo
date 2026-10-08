export { createManualProductCard } from './native-card'
export { createWorkProductCard } from '../work-design/product-card'
export { calculateManualProductSlots } from './native-grid'
export { layoutManualFlyerComposition } from './native-composition'
// Shared layout rules used by the Quick Editor. This entry is bundled for the
// isolated Chromium renderer so it does not maintain another copy of the grid,
// typography, or validity calculations.
export { calculateGridLayout } from '../../utils/product-zone-helpers'
export { resolveProductZoneStructure } from '../../utils/product-zone-structure'
export { fitResponsiveProductTypography, harmonizeProductCardTypography } from '../../utils/productCardResponsiveTypography'
export { layoutHeaderInstagram } from '../../utils/referenceFlyerLayout'
export { layoutInlineFooterValidity } from '../../utils/inlineFooterValidityLayout'
// Distribuição das ofertas entre várias zonas (setores) da mesma página.
export { assignProductsToZones } from '../../utils/flyerStructure'

import { createProductCardConfigurationLayout } from '../../utils/editorProductCardConfiguration'
import { normalizePriceGroupPlacementInCard } from '../../utils/fabricMeasure'
import { createDefaultProductCardConfiguration, normalizeProductCardConfiguration, resolveProductCardConfigurationProfile } from '../../utils/product-card-configuration'
import { autoTrimFabricImage } from '../../utils/fabricImageHelpers'
import { planAutomaticProductImageFill } from '../../utils/automaticProductImageFill'

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
  fabric: any, image: any, cardWidth: number, cardHeight: number, cardLayout: any,
  requestedCount?: number
): any[] => {
  if (!image) return []
  autoTrimFabricImage(image, { preserveVisualPosition: false })
  const configuration = normalizeProductCardConfiguration(cardLayout || createDefaultProductCardConfiguration())
  const imageLayout = resolveProductCardConfigurationProfile(configuration, cardWidth, cardHeight).elements.image
  const areaWidth = cardWidth * Math.min(imageLayout.width, 2 * Math.min(imageLayout.x, 100 - imageLayout.x)) / 100
  const areaHeight = cardHeight * Math.min(imageLayout.height, 2 * Math.min(imageLayout.y, 100 - imageLayout.y)) / 100
  const count = planAutomaticProductImageFill(areaWidth, areaHeight, Number(image.width), Number(image.height), requestedCount).length
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


export { createManualDefaultPriceGroup, createManualSavedPriceGroup, layoutManualPriceGroup } from './native-price-groups'
