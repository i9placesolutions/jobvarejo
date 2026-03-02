import type { BuilderAllowedField, BuilderProductInput, BuilderTemplateConfig } from '~/types/builder'
import { resolvePrimaryPrice, splitBuilderPrice } from './builder'

type FabricLikeObject = Record<string, any>

const TEXT_NODE_TYPES = new Set(['text', 'textbox', 'itext'])
const PRICE_INTEGER_NAMES = new Set([
  'price_main_int_text',
  'price_integer_text',
  'price_int_text',
  'price_main_text'
])
const PRICE_DECIMAL_NAMES = new Set([
  'price_cents_text',
  'price_decimal_text',
  'price_decimals_text',
  'price_fraction_text'
])
const PRICE_FULL_NAMES = new Set([
  'smart_price',
  'price_value_text',
  'price_text'
])
const UNIT_NAMES = new Set([
  'price_unit_text',
  'price_unit_suffix_text'
])
const CONDITION_NAMES = new Set([
  'price_condition_text',
  'price_special_condition_text',
  'special_condition_text'
])
const TITLE_NAMES = new Set([
  'smart_title',
  'product_title',
  'product_name_text'
])
const BRAND_NAMES = new Set([
  'smart_brand',
  'product_brand_text'
])
const LIMIT_NAMES = new Set([
  'smart_limit',
  'limitText',
  'product_limit'
])
const IMAGE_NAMES = new Set([
  'smart_image',
  'product_image',
  'productImage'
])

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const normalizeText = (value: unknown, maxLen = 280): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const inferUnitLabel = (product: BuilderProductInput): string => {
  const fromPack = normalizeText(product?.packUnit, 12).toUpperCase()
  if (fromPack) return fromPack
  const fromLabel = normalizeText(product?.packageLabel, 12).toUpperCase()
  if (fromLabel) return fromLabel
  return 'UN'
}

const isTextNode = (node: FabricLikeObject): boolean =>
  TEXT_NODE_TYPES.has(String(node?.type || '').toLowerCase())

const toNodeName = (node: FabricLikeObject): string =>
  normalizeText(node?.name || node?.data?.smartType, 120)

const updateCardMeta = (
  card: FabricLikeObject,
  product: BuilderProductInput,
  allowedFields: Set<BuilderAllowedField>
) => {
  const setMeta = (key: BuilderAllowedField | string, value: unknown) => {
    ;(card as any)[key] = value
  }

  if (allowedFields.has('name')) setMeta('nameText', normalizeText(product?.name, 240))
  if (allowedFields.has('brand')) setMeta('brand', normalizeText(product?.brand, 160))
  if (allowedFields.has('priceUnit')) setMeta('priceUnit', normalizeText(product?.priceUnit, 40))
  if (allowedFields.has('pricePack')) setMeta('pricePack', normalizeText(product?.pricePack, 40))
  if (allowedFields.has('priceSpecialUnit')) setMeta('priceSpecialUnit', normalizeText(product?.priceSpecialUnit, 40))
  if (allowedFields.has('priceSpecial')) setMeta('priceSpecial', normalizeText(product?.priceSpecial, 40))
  if (allowedFields.has('specialCondition')) setMeta('specialCondition', normalizeText(product?.specialCondition, 120))
  if (allowedFields.has('packageLabel')) setMeta('packageLabel', normalizeText(product?.packageLabel, 24))
  if (allowedFields.has('packQuantity')) setMeta('packQuantity', product?.packQuantity ?? null)
  if (allowedFields.has('packUnit')) setMeta('packUnit', normalizeText(product?.packUnit, 20))
  if (allowedFields.has('imageUrl')) setMeta('imageUrl', normalizeText(product?.imageUrl, 4000))
  setMeta('_builderProductId', normalizeText(product?.id, 120) || null)
  setMeta('_builderUpdatedAt', new Date().toISOString())
}

const updateCardNodes = (
  node: FabricLikeObject,
  product: BuilderProductInput,
  allowedFields: Set<BuilderAllowedField>
) => {
  const nodeName = toNodeName(node)
  const priceFull = resolvePrimaryPrice(product)
  const priceParts = splitBuilderPrice(priceFull)
  const unit = inferUnitLabel(product)

  if (isTextNode(node)) {
    if (allowedFields.has('name') && TITLE_NAMES.has(nodeName)) {
      node.text = normalizeText(product?.name, 240)
    } else if (allowedFields.has('brand') && BRAND_NAMES.has(nodeName)) {
      node.text = normalizeText(product?.brand, 160)
    } else if (PRICE_FULL_NAMES.has(nodeName)) {
      node.text = priceFull
    } else if (PRICE_INTEGER_NAMES.has(nodeName)) {
      node.text = priceParts.integer
    } else if (PRICE_DECIMAL_NAMES.has(nodeName)) {
      node.text = priceParts.decimal
    } else if (UNIT_NAMES.has(nodeName)) {
      node.text = unit
    } else if (allowedFields.has('specialCondition') && CONDITION_NAMES.has(nodeName)) {
      node.text = normalizeText(product?.specialCondition, 120)
    } else if (LIMIT_NAMES.has(nodeName)) {
      node.text = ''
    }
  }

  if (allowedFields.has('imageUrl')) {
    const asImage = String(node?.type || '').toLowerCase() === 'image'
    if (asImage && IMAGE_NAMES.has(nodeName)) {
      const src = normalizeText(product?.imageUrl, 4000)
      if (src) {
        node.src = src
        node.crossOrigin = 'anonymous'
      }
    }
  }

  const children = Array.isArray(node?.objects) ? node.objects : []
  if (children.length > 0) {
    children.forEach((child: FabricLikeObject) => updateCardNodes(child, product, allowedFields))
  }
}

const isTemplateZone = (obj: FabricLikeObject, zoneId: string): boolean => {
  const id = normalizeText(obj?._customId, 120)
  if (id && id === zoneId) return true
  if (!obj || typeof obj !== 'object') return false
  const name = normalizeText(obj?.name, 120)
  return !!(name === 'productZoneContainer' && normalizeText(obj?.id, 120) === zoneId)
}

const isProductCardForZone = (obj: FabricLikeObject, zoneId: string): boolean => {
  if (!obj || typeof obj !== 'object') return false
  const type = String(obj?.type || '').toLowerCase()
  if (type !== 'group') return false
  const parentZoneId = normalizeText(obj?.parentZoneId, 120)
  const looksLikeCard =
    obj?.isProductCard === true ||
    obj?.isSmartObject === true ||
    String(obj?.name || '').startsWith('product-card')
  return looksLikeCard && parentZoneId === zoneId
}

const compareCards = (a: FabricLikeObject, b: FabricLikeObject): number => {
  const aOrder = Number(a?._zoneOrder)
  const bOrder = Number(b?._zoneOrder)
  if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) {
    return aOrder - bOrder
  }
  const aTop = Number(a?.top || 0)
  const bTop = Number(b?.top || 0)
  if (aTop !== bTop) return aTop - bTop
  const aLeft = Number(a?.left || 0)
  const bLeft = Number(b?.left || 0)
  return aLeft - bLeft
}

export const applyBuilderSubmissionToCanvasPage = (params: {
  pageCanvasData: any
  template: BuilderTemplateConfig
  products: BuilderProductInput[]
  allowedFields: BuilderAllowedField[]
  themeId?: string | null
  labelTemplateId?: string | null
}) => {
  const pageCanvasData = deepClone(params.pageCanvasData || {})
  const objects = Array.isArray(pageCanvasData?.objects) ? pageCanvasData.objects : []
  const zoneId = String(params.template.zoneId || '').trim()
  if (!zoneId) {
    throw createError({ statusCode: 400, statusMessage: 'Template zoneId inválido' })
  }

  const zoneObject = objects.find((obj: FabricLikeObject) => isTemplateZone(obj, zoneId))
  const cards = objects.filter((obj: FabricLikeObject) => isProductCardForZone(obj, zoneId)).sort(compareCards)
  if (!cards.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhum card de produto encontrado na zona do template'
    })
  }

  const allowedSet = new Set(params.allowedFields)
  const totalToApply = Math.min(cards.length, params.products.length)
  for (let i = 0; i < totalToApply; i += 1) {
    const card = cards[i]
    const product = params.products[i] || {}
    updateCardMeta(card, product, allowedSet)
    updateCardNodes(card, product, allowedSet)
  }

  if (zoneObject) {
    zoneObject._builderThemeId = params.themeId || null
    zoneObject._builderLabelTemplateId = params.labelTemplateId || null
    zoneObject._builderLastSubmissionAt = new Date().toISOString()
  }

  return {
    pageCanvasData,
    stats: {
      cardsFound: cards.length,
      productsApplied: totalToApply,
      productsIgnored: Math.max(0, params.products.length - totalToApply)
    }
  }
}
