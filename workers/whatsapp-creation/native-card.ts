import { createEditorProductGridController } from '../../utils/editorProductGridController'
import { createProductCardConfigurationLayout } from '../../utils/editorProductCardConfiguration'
import { collectObjectsDeep, findByName, isTextLikeObject } from '../../utils/fabricObjectClassifiers'
import { normalizeGlobalStyles } from '../../utils/globalStylesNormalize'
import { DEFAULT_GLOBAL_STYLES } from '../../types/product-zone'
import { isProductLabelTemplateCompatible } from '../../utils/productLabelCompatibility'
import { normalizeProductCardIdentity } from '../../utils/productCardLookup'
import { resolveProductCardColor } from '../../utils/productCardColors'
import { extractLimitFromName, normalizeLimitText } from '../../utils/productTextNormalize'
import { getAvailablePrices, getSpecialConditionFromProduct } from '../../utils/productPriceHelpers'
import { formatPriceValue, inferUnitLabelFromProduct, splitPriceParts, parsePriceToCents, formatCentsToPrice, computePackLine, normalizeUnitForLabel } from '../../utils/priceTagText'
import { inferHeaderPartsFromProduct } from '../../utils/priceTagHeaderHelpers'
import { resolveProductImageRef } from '../../utils/productImageRef'
import { isAtacarejoTemplateGroupJson } from '../../utils/canvasJsonClassifiers'
import { autoTrimFabricImageAsync, fitImageIntoSlot } from '../../utils/fabricImageHelpers'
import { isRedBurstPriceGroup } from '../../utils/redBurstTemplateRevive'
import { normalizePriceGroupPlacementInCard } from '../../utils/fabricMeasure'
import { applyRichPriceTextValue, getRichPriceSegmentFontSize, isRichPriceTextObject, migratePriceGroupToRichText, positionRichPriceUnit, setRichPriceSegmentStyle } from '../../utils/priceRichText'
import { createPriceGroupPricing } from '../../utils/priceGroupPricing'
import { createPriceGroupBuilders } from '../../utils/priceGroupBuilders'
import { repairAtacarejoTextNames, getSinglePriceBackgroundCandidate, getSinglePriceCurrencyTextCandidate } from '../../utils/priceLayoutClassifiers'
import { FARDO_SPECIAL_PRICE_PALETTE, resolveFardoSpecialPriceState } from '../../utils/fardoSpecialPriceHelpers'
import { resolveWholesalePackPriceState } from '../../utils/wholesalePackOffer'
import { reviveRedBurstObjectNode } from '../../utils/redBurstTemplateRevive'
import { createRedBurstPriceLayout } from '../../utils/redBurstPriceLayout'
import { fitAuthoredPriceTier } from '../../utils/manualPriceFitPolicy'
import { createReadSingleManualPriceAnchors, createEnsureSinglePriceCurrencyCircleAnchor } from '../../utils/manualPriceAnchors'
import { MANUAL_SINGLE_ANCHOR_VERSION } from '../../utils/labelTemplateHelpers'
import { PRICE_INTEGER_DECIMAL_GAP_PX } from '../../utils/priceTagText'
import { isObjectShownForBounds, getObjectHorizontalBoundsLocal, getObjectVerticalBoundsLocal, measureHorizontalBoundsLocal, measureContentBoundsLocal } from '../../utils/fabricMeasure'
import { createManualPriceTemplateHelpers } from '../../utils/manualPriceTemplateHelpers'
import { getSinglePriceCurrencyCircleCandidate as getSinglePriceCurrencyCircleCandidateHelper } from '../../utils/priceLayoutClassifiers'
import { createPriceTemplateFitting } from '../../utils/priceTemplateFitting'
import { layoutPrice } from '../../utils/priceTagLayout'
import { BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID, BUILTIN_FARDO_SPECIAL_LABEL_TEMPLATE_ID } from '../../utils/labelTemplateHelpers'
import { createFardoSpecialPricing } from '../../utils/fardoSpecialPriceGroupPricing'
import { setText, setVisible, safeAddWithUpdate } from '../../utils/fabricObjectOps'
import { shouldPreserveManualTemplateVisual as shouldPreserveManualTemplateVisualShared } from '../../utils/templateSnapshotHelpers'
import { applyWholesaleReferenceProductData, reflowWholesaleReferencePriceLabel, WHOLESALE_REFERENCE_MARKER } from '../../utils/wholesaleReferenceLayout'
import {
  createManualDefaultPriceGroup,
  createManualSavedPriceGroup,
  layoutManualPriceGroup
} from './native-price-groups'

type ManualProduct = Record<string, any>

const noop = () => undefined
const collectDeep = (root: any): any[] => collectObjectsDeep(root)
const needsMultiPriceTemplate = (product: ManualProduct): boolean => {
  if (product?.offerFormat === 'wholesale-pack-v1') return true
  const available = getAvailablePrices(product)
  const hasRetail = available.prices.some((price: any) => price.type === 'main' || price.type === 'pack')
  return !!available.hasSpecial && hasRetail
}
const cloneProductMetadata = (data: any): any => {
  try {
    return typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data))
  } catch {
    return { ...(data || {}) }
  }
}

const getSinglePriceCurrencyCircleCandidate = (objects: any[], currencyText?: any): any =>
  getSinglePriceCurrencyCircleCandidateHelper(objects, currencyText, measureContentBoundsLocal, isObjectShownForBounds, isTextLikeObject)
const ensureSinglePriceCurrencyCircleAnchor = createEnsureSinglePriceCurrencyCircleAnchor({
  collectObjectsDeep: collectDeep,
  getSinglePriceCurrencyTextCandidate,
  getSinglePriceCurrencyCircleCandidate
})
const readSingleManualPriceAnchors = createReadSingleManualPriceAnchors({
  MANUAL_SINGLE_ANCHOR_VERSION,
  collectObjectsDeep: collectDeep,
  getSinglePriceBackgroundCandidate,
  getSinglePriceCurrencyTextCandidate,
  ensureSinglePriceCurrencyCircleAnchor,
  findByName,
  isTextLikeObject,
  isObjectShownForBounds,
  getObjectHorizontalBoundsLocal,
  measureHorizontalBoundsLocal,
  clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
  PRICE_INTEGER_DECIMAL_GAP_PX
})
const manualPriceTemplateHelpers = createManualPriceTemplateHelpers({
  isRedBurstPriceGroup,
  collectObjectsDeep: collectDeep,
  findByName,
  isTextLikeObject,
  reviveRedBurstObjectNode,
  getSinglePriceBackgroundCandidate,
  getSinglePriceCurrencyTextCandidate,
  ensureSinglePriceCurrencyCircleAnchor,
  isObjectShownForBounds,
  getObjectHorizontalBoundsLocal,
  getObjectVerticalBoundsLocal,
  measureHorizontalBoundsLocal,
  clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
})
const shouldPreserveManualTemplateVisual = (group: any) => shouldPreserveManualTemplateVisualShared(group, isRedBurstPriceGroup)
const priceTemplateFitting = createPriceTemplateFitting({
  shouldPreserveManualTemplateVisual,
  collectObjectsDeep: collectDeep,
  findByName,
  getSinglePriceBackgroundCandidate,
  getSinglePriceCurrencyTextCandidate,
  ensureSinglePriceCurrencyCircleAnchor,
  readSingleManualPriceAnchors,
  isObjectShownForBounds,
  getObjectHorizontalBoundsLocal,
  getObjectVerticalBoundsLocal,
  measureHorizontalBoundsLocal,
  layoutPrice,
  isRichPriceTextObject,
  positionRichPriceUnit,
  constrainSinglePriceTextInsideBackground: manualPriceTemplateHelpers.constrainSinglePriceTextInsideBackground,
  clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
  priceIntegerDecimalGapPx: PRICE_INTEGER_DECIMAL_GAP_PX
})
const nativeRedBurstLayout = createRedBurstPriceLayout({
  isRedBurstPriceGroup,
  ensureRedBurstPriceGroupVisibility: manualPriceTemplateHelpers.ensureRedBurstPriceGroupVisibility,
  shouldPreserveManualTemplateVisual,
  collectObjectsDeep: collectDeep,
  findByName,
  isTextLikeObject,
  clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
  readSingleManualPriceAnchors,
  fitManualSinglePriceValuesIntoTemplate: priceTemplateFitting.fitManualSinglePriceValuesIntoTemplate,
  getRichPriceSegmentFontSize,
  setRichPriceSegmentStyle
})


/**
 * Materializa um produto no mesmo caminho de criação de cartão usado pelo
 * editor. O contexto elimina apenas dependências de UI/canvas; os elementos,
 * etiquetas e a geometria vêm dos controladores e helpers compartilhados.
 */
export const createManualProductCard = async (
  fabric: any,
  product: ManualProduct,
  x: number,
  y: number,
  width: number,
  height: number,
  gridId: string,
  labelTemplate?: any,
  styles: Record<string, any> = {}
): Promise<any> => {
  if (!fabric || !product || !(width > 0) || !(height > 0)) {
    throw new Error('Fabric, produto e dimensões válidas são necessários para criar o cartão.')
  }

  // O render Python entrega a imagem hidratada como data URL. Priorize-a para
  // que o editor não tente buscar uma key remota no Chromium isolado.
  const hydratedImageUrl = String(product.imageDataUrl || product.imageUrl || '').trim()
  const hydratedProduct: ManualProduct = {
    ...product,
    ...(hydratedImageUrl.startsWith('data:') ? { imageUrl: hydratedImageUrl } : {}),
    imageDataUrl: undefined
  }

  const effectiveStyles = normalizeGlobalStyles(styles, DEFAULT_GLOBAL_STYLES)
  const cardConfiguration = createProductCardConfigurationLayout({
    fabric: () => fabric,
    enableCardElementRotationControl: noop,
    safeRequestRenderAll: noop,
    getPriceGroupFromAny: (object: any) => object?.getObjects?.().find((child: any) => child?.name === 'priceGroup') || null,
    normalizePriceGroupPlacementInCard: (group: any, cardWidth: number, cardHeight: number, placement?: any, options?: any) =>
      normalizePriceGroupPlacementInCard(group, cardWidth, cardHeight, placement, () => false, options)
  })

  const productCardConfiguration = {
    createProductAlcoholBadgeObject: cardConfiguration.createProductAlcoholBadgeObject,
    applyProductCardConfigurationLayout: (card: any, cardWidth: number, cardHeight: number, cardStyles: any) => {
      // Fabric 7 FitContent reposiciona filhos quando imagens extras entram no
      // grupo. O editor já desliga esse layout antes de aplicar a configuração.
      const manager = card?.layoutManager
      if (manager?.performLayout) manager.performLayout = noop
      return cardConfiguration.applyProductCardConfigurationLayout(card, cardWidth, cardHeight, cardStyles)
    }
  }

  const price = getAvailablePrices(hydratedProduct).mainPrice || formatPriceValue(hydratedProduct.price) || '0,00'
  const unit = inferUnitLabelFromProduct(hydratedProduct as any)
  const setPrice = (group: any, value: unknown, unitText = '') => {
    migratePriceGroupToRichText(group, fabric)
    collectDeep(group).filter(isRichPriceTextObject).forEach((object: any) => applyRichPriceTextValue(object, value))
    const unitObject = collectDeep(group).find((object: any) =>
      ['price_unit_text', 'priceUnit', 'price_unit'].includes(String(object?.name || '')))
    if (unitObject) {
      const visible = String(unitText || '').trim().length > 0 && unitObject.visible !== false
      unitObject.set?.({ text: visible ? String(unitText).trim() : '', visible })
      unitObject.initDimensions?.()
    }
    group.dirty = true
  }

const shouldPreserveTemplate = (group: any) => shouldPreserveManualTemplateVisualShared(group, isRedBurstPriceGroup)
const fitManualAtacarejoPriceTiers = (group: any) => {
  const all = collectDeep(group)
  ;(['retail', 'wholesale'] as const).forEach(prefix => {
    const background = findByName(all, prefix === 'retail' ? 'atac_retail_bg' : 'atac_wholesale_bg')
    const value = findByName(all, `${prefix}_price_text`)
      || findByName(all, `${prefix}_integer_text`)
    fitAuthoredPriceTier(background, [
      findByName(all, `${prefix}_currency_text`), value,
      findByName(all, `${prefix}_decimal_text`), findByName(all, `${prefix}_unit_text`),
      findByName(all, `${prefix}_pack_line_text`)
    ])
  })
}
  const fardoPricing = createFardoSpecialPricing({
    applyWholesaleReferenceProductData,
    collectObjectsDeep: collectDeep,
    repairAtacarejoTextNames,
    findByName,
    inferUnitLabelFromProduct,
    normalizeUnitForLabel,
    resolveWholesalePackPriceState,
    resolveFardoSpecialPriceState,
    WHOLESALE_REFERENCE_MARKER,
    setVisible,
    applyRichPriceTextValue,
    splitPriceParts,
    setText,
    formatPriceValue,
    reflowWholesaleReferencePriceLabel,
    shouldPreserveManualTemplateVisual: shouldPreserveTemplate,
    fitManualAtacarejoValuesIntoTemplate: fitManualAtacarejoPriceTiers,
    safeAddWithUpdate
  })
  const atacarejoPricing = createPriceGroupPricing({
    applyFardoSpecialPricingToPriceGroup: fardoPricing.applyFardoSpecialPricingToPriceGroup,
    migratePriceGroupToRichText: (group: any) => migratePriceGroupToRichText(group, fabric),
    applyRichPriceTextValue,
    collectObjectsDeep: collectDeep,
    repairAtacarejoTextNames,
    findByName,
    setVisible,
    getAvailablePrices,
    formatPriceValue,
    getSpecialConditionFromProduct,
    splitPriceParts,
    setText,
    inferUnitLabelFromProduct,
    parsePriceToCents,
    formatCentsToPrice,
    computePackLine,
    shouldPreserveManualTemplateVisual: shouldPreserveTemplate,
    // The price template's authored objects already carry the editor geometry.
    // Keep that geometry stable and let the editor's price fit policy handle authored tiers.
    fitManualAtacarejoValuesIntoTemplate: fitManualAtacarejoPriceTiers,
    safeAddWithUpdate
  })
  const priceGroupBuilders = createPriceGroupBuilders({
    fabric: () => fabric,
    layoutPriceGroup: (group, cardWidth, cardHeight) =>
      layoutManualPriceGroup(fabric, group, cardWidth, cardHeight, nativeRedBurstLayout.tuneRedBurstPriceGroupLayout),
    applyAtacarejoPricingToPriceGroup: atacarejoPricing.applyAtacarejoPricingToPriceGroup,
    safeAddWithUpdate
  })

  const context: Record<string, any> = {
    BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID,
    BUILTIN_FARDO_SPECIAL_LABEL_TEMPLATE_ID,
    FARDO_SPECIAL_PRICE_PALETTE,
    activePage: { value: { width, height } },
    applyAtacarejoPricingToPriceGroup: atacarejoPricing.applyAtacarejoPricingToPriceGroup,
    autoTrimFabricImageAsync,
    buildAtacarejoPriceGroupForCard: (sample: any, cardWidth: number, cardHeight: number, top: number, options?: any) =>
      priceGroupBuilders.buildAtacarejoPriceGroupForCard(sample, cardWidth, cardHeight, top, options),
    buildDefaultPriceGroupForCard: (value: string, cardWidth: number, cardHeight: number, top: number, unitText: string) =>
      createManualDefaultPriceGroup(fabric, value, cardWidth, cardHeight, unitText),
    canvas: { value: null },
    collectObjectsDeep: collectDeep,
    enableCardElementRotationControl: noop,
    extractLimitFromName,
    fabric,
    fitProductImageIntoSlot: fitImageIntoSlot,
    formatPriceValue,
    getAvailablePrices,
    getSpecialConditionFromProduct,
    inferHeaderPartsFromProduct,
    inferUnitLabelFromProduct,
    instantiatePriceGroupFromTemplate: (template: any) =>
      createManualSavedPriceGroup(fabric, template?.group, price, unit),
    isAtacarejoTemplateGroupJson,
    isProductLabelTemplateCompatible,
    isRedBurstPriceGroup,
    isTextLikeObject,
    labelTemplates: { value: labelTemplate ? [labelTemplate] : [] },
    layoutPriceGroup: (group: any, cardWidth: number, cardHeight: number) =>
      layoutManualPriceGroup(fabric, group, cardWidth, cardHeight, nativeRedBurstLayout.tuneRedBurstPriceGroupLayout),
    makeCanvasObjectId: () => globalThis.crypto?.randomUUID?.() || `whatsapp-card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    markProductImageTrimmed: (image: any) => image?.set?.({ __productImageTrimVersion: 4, dirty: true }),
    normalizeGlobalStyles,
    normalizeLimitText,
    normalizePriceGroupPlacementInCard: (group: any, cardWidth: number, cardHeight: number, placement?: any) =>
      normalizePriceGroupPlacementInCard(group, cardWidth, cardHeight, placement, () => false),
    normalizeProductCardIdentity: (card: any, options: any) =>
      normalizeProductCardIdentity(card, cloneProductMetadata, context.makeCanvasObjectId, options),
    productCardConfiguration,
    // Condição textual isolada continua usando a etiqueta simples; só preços
    // de varejo e especial simultâneos exigem a composição multi-preço.
    productNeedsAtacarejoLabel: needsMultiPriceTemplate,
    resolveProductCardColor,
    resolveProductImageRef,
    setCardLabelTemplateMetadata: (card: any, templateId?: string, explicitOverride = false) => {
      if (templateId) {
        card.__cardLabelTemplateId = String(templateId)
        card.__cardLabelTemplateOverride = explicitOverride === true
      }
    },
    setPriceGroupInteractionMode: noop,
    setPriceOnPriceGroup: setPrice,
    tuneRedBurstPriceGroupLayout: nativeRedBurstLayout.tuneRedBurstPriceGroupLayout,
    toWasabiProxyUrl: (url: string) => url
  }
  context.normalizeGlobalStyles = (value: any) => normalizeGlobalStyles(value, DEFAULT_GLOBAL_STYLES)

  return createEditorProductGridController(context).createSmartObject(
    hydratedProduct,
    x,
    y,
    width,
    height,
    gridId,
    labelTemplate,
    effectiveStyles
  )
}
