import { createPriceGroupBuilders } from '../../utils/priceGroupBuilders'
import { createPriceGroupLayout } from '../../utils/priceGroupLayout'
import { layoutManualTemplateGroup } from '../../utils/priceManualTemplateLayout'
import { layoutPrice } from '../../utils/priceTagLayout'
import { PRICE_INTEGER_DECIMAL_GAP_PX, normalizeUnitForLabel } from '../../utils/priceTagText'
import { getSinglePriceCurrencyTextCandidate } from '../../utils/priceLayoutClassifiers'
import { fitAuthoredPriceTier } from '../../utils/manualPriceFitPolicy'
import { isRedBurstPriceGroup, sanitizeRedBurstTemplateGroupJson } from '../../utils/redBurstTemplateRevive'
import { isTextLikeObject } from '../../utils/fabricObjectClassifiers'
import { restoreLegacyManualPriceNames } from '../../utils/legacyManualPriceNames'
import { collectObjectsDeep } from '../../utils/fabricObjectClassifiers'
import {
  applyRichPriceTextValue,
  isRichPriceTextObject,
  installRichPriceTextRenderer,
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

// Reconstruct a saved price template through Fabric's group loader, then apply
// the same rich-text value update used by the editor. Mutating text in JSON
// before enlivening leaves stale character style indexes when digit counts
// change and skips the renderer patch used for authored segment offsets.
export const createManualSavedPriceGroup = async (
  fabric: any, savedLabel: any, rawPrice: unknown, rawUnit = ''
): Promise<any> => {
  if (!fabric?.Group?.fromObject || !savedLabel || !Array.isArray(savedLabel.objects)) {
    throw new Error('Template de etiqueta inválido para reconstrução.')
  }
  installRichPriceTextRenderer(fabric)

  const clone = (value: any): any => {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(clone)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
  }
  const groupJson = clone(savedLabel)
  sanitizeRedBurstTemplateGroupJson(groupJson)
  const objectsJson = groupJson.objects
  const groupOptions = { ...groupJson }
  delete groupOptions.objects
  delete groupOptions.type
  delete groupOptions.layoutManager
  delete groupOptions.layout

  // Group.fromObject preserves the template's authored local coordinates and
  // avoids running a new FitContent layout over them.
  const group = await fabric.Group.fromObject({ ...groupOptions, objects: objectsJson })
  const restoreTemplateProperties = (live: any, saved: any): void => {
    if (!live || !saved || typeof saved !== 'object') return
    // Fabric 7 may omit names and unregistered custom properties on enliven.
    // Restore every serialized property that Fabric did not materialize, while
    // leaving enlivened built-in paints and runtime objects intact.
    for (const [key, value] of Object.entries(saved)) {
      if (key === 'objects' || key === 'type' || key === 'version' || key === 'layoutManager' || key === 'layout') continue
      if (key === 'name' || !(key in live)) live[key] = clone(value)
    }
    const children = live.getObjects?.() || []
    children.forEach((child: any, index: number) => restoreTemplateProperties(child, saved.objects?.[index]))
  }
  restoreTemplateProperties(group, groupJson)
  restoreLegacyManualPriceNames(group, isTextLikeObject)
  group.__preserveManualLayout = groupJson.__preserveManualLayout !== false
  migratePriceGroupToRichText(group, fabric)

  const all: any[] = []
  const collect = (object: any): void => {
    if (!object) return
    all.push(object)
    ;(object.getObjects?.() || []).forEach(collect)
  }
  collect(group)

  const richPrice = all.find(isRichPriceTextObject)
  const unit = all.find((object: any) =>
    ['price_unit_text', 'priceUnit', 'price_unit'].includes(String(object?.name || '')))
  if (richPrice) {
    applyRichPriceTextValue(richPrice, rawPrice)
    if (unit) {
      const allowsUnit = unit.visible !== false && String(unit.text || '').trim().length > 0
      const value = allowsUnit ? normalizeUnitForLabel(rawUnit) : ''
      unit.set?.({ text: value, visible: !!value })
      unit.initDimensions?.()
    }

    // The editor keeps authored positions and scales when the value fits.
    // This is the same early fitting decision used by its manual template path.
    const background = all.find((object: any) => object?.name === 'price_bg')
    const currency = all.find((object: any) => object?.name === 'price_currency_text')
    const currencyCircle = all.find((object: any) => object?.name === 'price_currency_bg')
    const integer = all.find((object: any) => object?.name === 'price_integer_text' || object?.name === 'priceInteger')
    const decimal = all.find((object: any) => object?.name === 'price_decimal_text' || object?.name === 'priceDecimal')
    if (background) fitAuthoredPriceTier(background, [currencyCircle, currency, richPrice, integer, decimal, unit])
    richPrice.dirty = true
    richPrice.setCoords?.()
  }

  group.set?.({ name: 'priceGroup', originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0 })
  group.__preserveManualLayout = typeof group.__preserveManualLayout === 'boolean'
    ? group.__preserveManualLayout
    : true
  group.__isCustomTemplate = true
  group.dirty = true
  group.setCoords?.()
  return group
}

export const layoutManualPriceGroup = (fabric: any, group: any, cardWidth: number, cardHeight: number, tuneRedBurst: (group: any) => any = () => undefined): any => {
  const collect = (object: any): any[] => [object, ...(object?.getObjects?.() || []).flatMap(collect)]
  const findByName = (objects: any[], name: string) => objects.find((object: any) => object?.name === name)
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
  const layout = createPriceGroupLayout({
    getFabric: () => fabric,
    migratePriceGroupToRichText: object => migratePriceGroupToRichText(object, fabric),
    collectObjectsDeep: collect,
    findByName,
    repairAtacarejoTextNames: () => undefined,
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
    measureHorizontalBoundsLocal: () => null,
    shouldPreserveManualTemplateVisual: object => object?.__preserveManualLayout === true || object?.__isCustomTemplate === true,
    fitManualAtacarejoValuesIntoTemplate: () => undefined,
    layoutManualTemplateGroup: (object, width, height) => layoutManualTemplateGroup(object, width, height, {
      collectObjectsDeep: collect,
      findByName,
      isTextLikeObject,
      isRedBurstPriceGroup,
      tuneRedBurstPriceGroupLayout: tuneRedBurst
    }),
    rememberPriceLayoutSnapshot: () => false,
    fitManualSinglePriceValuesIntoTemplate: object => {
      const all = collect(object)
      const background = all.find((node: any) => node?.name === 'price_bg')
      const currency = getSinglePriceCurrencyTextCandidate(all)
      const currencyCircle = all.find((node: any) => node?.name === 'price_currency_bg')
      const price = all.find((node: any) => isRichPriceTextObject(node))
      const unit = all.find((node: any) => ['price_unit_text', 'priceUnit', 'price_unit'].includes(String(node?.name || '')))
      if (background) fitAuthoredPriceTier(background, [currencyCircle, currency, price, unit])
    },
    layoutCustomPriceGroup: () => null,
    getSinglePriceCurrencyTextCandidate,
    ensureSinglePriceCurrencyCircleAnchor: (_object, objects) =>
      (objects || []).find((node: any) => node?.name === 'price_currency_bg'),
    normalizeUnitForLabel
  })
  return layout.layoutPriceGroup(group, cardWidth, cardHeight)
}
