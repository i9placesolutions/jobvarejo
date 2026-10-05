// Shared layout rules used by the Quick Editor. This entry is bundled for the
// isolated Chromium renderer so it does not maintain another copy of the grid,
// typography, or validity calculations.
export { calculateGridLayout } from '../../utils/product-zone-helpers'
export { resolveProductZoneStructure } from '../../utils/product-zone-structure'
export { fitResponsiveProductTypography, harmonizeProductCardTypography } from '../../utils/productCardResponsiveTypography'
export { layoutInlineFooterValidity } from '../../utils/inlineFooterValidityLayout'
