import { makeId } from './makeId'

type IdFactory = () => string

const PAGE_DUPLICATE_REF_KEYS = new Set([
  'parentFrameId',
  'parentZoneId',
  '_frameClipOwner',
  'objectMaskSourceId',
  'zoneId',
  'zoneInstanceId',
  'parentId',
  'groupId',
  'linkedProductId',
  'sourceObjectId',
  'sourceZoneId',
  'targetObjectId',
  'targetZoneId'
])

const PAGE_DUPLICATE_INSTANCE_ID_KEYS = new Set([
  '_customId',
  'objectId',
  'canvasObjectId'
])

const PAGE_DUPLICATE_GROUP_ID_KEYS = new Set([
  'gridGroupId',
  'smartGridId',
  'groupId'
])

// Esses blocos carregam metadados, não novos objetos Fabric. Eles são
// remapeados de forma controlada abaixo e não podem passar pela visita
// genérica uma segunda vez (o que criaria um terceiro ID para a mesma zona).
const PAGE_DUPLICATE_METADATA_CHILD_KEYS = new Set([
  '_productData',
  'productData',
  'product',
  '_zoneSlot',
  'zone'
])

const PAGE_DUPLICATE_OBJECT_REF_KEYS = Array.from(PAGE_DUPLICATE_REF_KEYS)
  .filter((key) => !PAGE_DUPLICATE_GROUP_ID_KEYS.has(key))

const clonePlainJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const getOrCreateMappedId = (
  map: Map<string, string>,
  raw: unknown,
  factory: IdFactory = makeId
): string => {
  const id = String(raw || '').trim()
  if (!id) return ''
  const existing = map.get(id)
  if (existing) return existing

  let next = factory()
  while (!next || next === id || Array.from(map.values()).includes(next)) {
    next = factory()
  }
  map.set(id, next)
  return next
}

const shouldRegenerateSerializedId = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false
  const id = String(node.id || '').trim()
  if (!id || id === 'artboard-bg' || id.startsWith('guide-')) return false
  return Boolean(
    node._customId ||
    node.type ||
    node.isFrame ||
    node.isGridZone ||
    node.isProductZone ||
    node.isSmartObject ||
    node.isProductCard ||
    node.parentZoneId ||
    node.parentFrameId
  )
}

/**
 * Duplica o JSON serializado de uma página, trocando toda identidade que pode
 * ligar objetos, zones, cards e frames à página de origem. O resultado é
 * visualmente idêntico, mas seguro para persistir em outro projeto/página.
 */
export const clonePageCanvasDataWithFreshIds = (
  sourceCanvasData: any,
  options: { makeId?: IdFactory } = {}
): any => {
  const idFactory = options.makeId || makeId
  const clonedJson = clonePlainJson(sourceCanvasData)
  const objectIdMap = new Map<string, string>()
  const groupIdMap = new Map<string, string>()

  const remapObjectRef = (value: unknown): string => {
    const id = String(value || '').trim()
    if (!id) return ''
    return objectIdMap.get(id) || groupIdMap.get(id) || getOrCreateMappedId(objectIdMap, id, idFactory)
  }

  const normalizeProductIdentity = (node: any) => {
    if (!node || typeof node !== 'object') return
    const hasProductMetadata = Boolean(
      node._productData ||
      node.productData ||
      node.isProductCard ||
      node.isSmartObject ||
      node.parentZoneId
    )
    if (!hasProductMetadata) return

    const pdSource = node._productData && typeof node._productData === 'object'
      ? node._productData
      : (node.productData && typeof node.productData === 'object' ? node.productData : {})
    const productId = String(
      pdSource.productId ||
      pdSource.product_id ||
      pdSource.catalogProductId ||
      pdSource.id ||
      node.productId ||
      ''
    ).trim()
    const productInstanceId = `item_${idFactory()}`
    const zoneInstanceId = String(node.parentZoneId || pdSource.zoneInstanceId || node.zoneInstanceId || '').trim()

    if (node._productData && typeof node._productData === 'object') {
      node._productData = {
        ...node._productData,
        ...(productId ? { productId } : {}),
        id: productInstanceId,
        productInstanceId,
        ...(zoneInstanceId ? { zoneInstanceId } : {})
      }
    }
    if (node.productData && typeof node.productData === 'object') {
      node.productData = {
        ...node.productData,
        ...(productId ? { productId } : {}),
        id: productInstanceId,
        productInstanceId,
        ...(zoneInstanceId ? { zoneInstanceId } : {})
      }
    }
    if (node.product && typeof node.product === 'object') {
      node.product = {
        ...node.product,
        ...(productId ? { productId } : {}),
        id: productInstanceId,
        productInstanceId,
        ...(zoneInstanceId ? { zoneInstanceId } : {})
      }
    }
    node.productInstanceId = productInstanceId
    if (productId) node.productId = productId
    else delete node.productId
    if (zoneInstanceId) node.zoneInstanceId = zoneInstanceId
    else delete node.zoneInstanceId
  }

  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    PAGE_DUPLICATE_INSTANCE_ID_KEYS.forEach((key) => {
      const current = String(value[key] || '').trim()
      if (current) value[key] = getOrCreateMappedId(objectIdMap, current, idFactory)
    })

    if (shouldRegenerateSerializedId(value)) {
      value.id = getOrCreateMappedId(objectIdMap, value.id, idFactory)
    }

    PAGE_DUPLICATE_GROUP_ID_KEYS.forEach((key) => {
      const current = String(value[key] || '').trim()
      if (current) {
        value[key] = getOrCreateMappedId(
          groupIdMap,
          current,
          () => `${key.replace(/Id$/, '').toLowerCase()}_${idFactory()}`
        )
      }
    })

    PAGE_DUPLICATE_OBJECT_REF_KEYS.forEach((key) => {
      const current = String(value[key] || '').trim()
      if (current) value[key] = remapObjectRef(current)
    })

    if (value._zoneSlot && typeof value._zoneSlot === 'object') {
      const slotZoneId = String(value._zoneSlot.zoneId || '').trim()
      if (slotZoneId) value._zoneSlot = { ...value._zoneSlot, zoneId: remapObjectRef(slotZoneId) }
    }

    if (value.zone && typeof value.zone === 'object') {
      const zoneId = String(value.zone.id || '').trim()
      if (zoneId) value.zone.id = remapObjectRef(zoneId)
      const zoneFrameId = String(value.zone.parentFrameId || '').trim()
      if (zoneFrameId) value.zone.parentFrameId = remapObjectRef(zoneFrameId)
    }

    normalizeProductIdentity(value)
    Object.entries(value).forEach(([key, entry]) => {
      if (PAGE_DUPLICATE_METADATA_CHILD_KEYS.has(key)) return
      visit(entry)
    })
  }

  visit(clonedJson)
  return clonedJson
}

export const createUniqueDuplicatedPageId = (
  usedIds: Set<string>,
  makePageId: IdFactory = makeId
): string => {
  let next = makePageId()
  while (!next || usedIds.has(next)) next = makePageId()
  usedIds.add(next)
  return next
}
