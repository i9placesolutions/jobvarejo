import { createEditorProductGridController } from '../../utils/editorProductGridController'
import { createProductCardConfigurationLayout } from '../../utils/editorProductCardConfiguration'
import { collectObjectsDeep, isTextLikeObject } from '../../utils/fabricObjectClassifiers'
import { normalizeGlobalStyles } from '../../utils/globalStylesNormalize'
import { DEFAULT_GLOBAL_STYLES } from '../../types/product-zone'
import { isProductLabelTemplateCompatible } from '../../utils/productLabelCompatibility'
import { normalizeProductCardIdentity } from '../../utils/productCardLookup'
import { resolveProductCardColor } from '../../utils/productCardColors'
import { extractLimitFromName, normalizeLimitText } from '../../utils/productTextNormalize'
import { getAvailablePrices, getSpecialConditionFromProduct } from '../../utils/productPriceHelpers'
import { formatPriceValue, inferUnitLabelFromProduct } from '../../utils/priceTagText'
import { inferHeaderPartsFromProduct } from '../../utils/priceTagHeaderHelpers'
import { resolveProductImageRef } from '../../utils/productImageRef'
import { isAtacarejoTemplateGroupJson } from '../../utils/canvasJsonClassifiers'
import { autoTrimFabricImageAsync, fitImageIntoSlot } from '../../utils/fabricImageHelpers'
import { isRedBurstPriceGroup } from '../../utils/redBurstTemplateRevive'
import { normalizePriceGroupPlacementInCard } from '../../utils/fabricMeasure'
import { applyRichPriceTextValue, isRichPriceTextObject, migratePriceGroupToRichText } from '../../utils/priceRichText'
import {
  createManualDefaultPriceGroup,
  createManualSavedPriceGroup,
  layoutManualPriceGroup
} from './native-layout'

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

  // A implementação manual atualmente cobre cartões de preço único. Produtos
  // multi-preço precisam de um template atacarejo real para preservar os tiers.
  if (needsMultiPriceTemplate(hydratedProduct)) {
    throw new Error(`Produto multi-preço "${String(product.name || 'sem nome')}" ainda não é suportado por esta fábrica manual.`)
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

  const context: Record<string, any> = {
    BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID: '__unsupported_atacarejo__',
    BUILTIN_FARDO_SPECIAL_LABEL_TEMPLATE_ID: '__unsupported_fardo__',
    FARDO_SPECIAL_PRICE_PALETTE: {},
    activePage: { value: { width, height } },
    applyAtacarejoPricingToPriceGroup: noop,
    autoTrimFabricImageAsync,
    buildAtacarejoPriceGroupForCard: () => {
      throw new Error('A criação de etiquetas atacarejo sem template salvo não está disponível neste renderizador.')
    },
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
      layoutManualPriceGroup(fabric, group, cardWidth, cardHeight),
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
    tuneRedBurstPriceGroupLayout: () => {
      throw new Error('Etiquetas Red Burst ainda não têm o ajuste de layout compartilhado disponível neste renderizador.')
    },
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
