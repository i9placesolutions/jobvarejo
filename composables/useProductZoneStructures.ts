import { computed, ref } from 'vue'
import type {
  ProductZone,
  ProductZonePreviewFormat,
  ProductZoneStructure,
  ProductZoneStructureMap,
  ProductZoneStructureMapByPreviewFormat,
  ProductZoneStructureVariantMap,
  ProductZoneStructureVariantMapByPreviewFormat
} from '~/types/product-zone'
import {
  createDefaultProductZoneStructureMapByPreviewFormat,
  createDefaultProductZoneStructureVariantMapByPreviewFormat,
  DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT,
  normalizeProductZoneStructure,
  normalizeProductZoneStructureMap,
  normalizeProductZoneStructureMapByPreviewFormat,
  normalizeProductZoneStructureVariantMap,
  normalizeProductZoneStructureVariantMapByPreviewFormat
} from '~/utils/product-zone-structure'

const cloneStructureMap = (value: ProductZoneStructureMap): ProductZoneStructureMap => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureMap
  } catch {
    return normalizeProductZoneStructureMap(value)
  }
}

const cloneVariantMap = (value: ProductZoneStructureVariantMap): ProductZoneStructureVariantMap => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureVariantMap
  } catch {
    return normalizeProductZoneStructureVariantMap(value)
  }
}

const cloneStructureMapsByPreviewFormat = (
  value: ProductZoneStructureMapByPreviewFormat
): ProductZoneStructureMapByPreviewFormat => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureMapByPreviewFormat
  } catch {
    return normalizeProductZoneStructureMapByPreviewFormat(value)
  }
}

const cloneVariantMapsByPreviewFormat = (
  value: ProductZoneStructureVariantMapByPreviewFormat
): ProductZoneStructureVariantMapByPreviewFormat => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductZoneStructureVariantMapByPreviewFormat
  } catch {
    return normalizeProductZoneStructureVariantMapByPreviewFormat(value)
  }
}

const structureMapsByPreviewFormat = ref<ProductZoneStructureMapByPreviewFormat>(
  createDefaultProductZoneStructureMapByPreviewFormat()
)
const structureVariantsByPreviewFormat = ref<ProductZoneStructureVariantMapByPreviewFormat>(
  createDefaultProductZoneStructureVariantMapByPreviewFormat({}, structureMapsByPreviewFormat.value)
)
// The flat refs are compatibility views for the editor and older consumers.
// New code should use the format-scoped refs above.
const structureMap = computed<ProductZoneStructureMap>(() =>
  structureMapsByPreviewFormat.value[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
)
const structureVariants = computed<ProductZoneStructureVariantMap>(() =>
  structureVariantsByPreviewFormat.value[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
)
const isLoading = ref(false)
const isLoaded = ref(false)
const lastError = ref<string | null>(null)
const updatedAt = ref<string | null>(null)
let loadPromise: Promise<ProductZoneStructureMapByPreviewFormat> | null = null
let liveSyncInitialized = false
let liveSyncChannel: BroadcastChannel | null = null
let liveChangeVersion = 0

const LIVE_SYNC_CHANNEL = 'jobvarejo:product-zone-structures'
const LIVE_SYNC_STORAGE_KEY = 'jobvarejo:product-zone-structures:live'
const liveSourceId = `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`

type LiveStructureMessage = {
  type: 'product-zone-structures:live'
  sourceId: string
  updatedAt: string
  structures: unknown
  variants?: unknown
  structuresByPreviewFormat?: unknown
  variantsByPreviewFormat?: unknown
}

const notifyUpdated = (detail: Record<string, unknown> = {}) => {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('product-zone-structures:updated', { detail }))
}

const applyStructureLibrary = (
  nextMaps: unknown,
  nextUpdatedAt: string | null = new Date().toISOString(),
  origin: 'local' | 'remote' = 'local',
  nextVariants?: unknown,
  legacyMap?: unknown,
  legacyVariants?: unknown
): ProductZoneStructureMapByPreviewFormat => {
  const normalized = normalizeProductZoneStructureMapByPreviewFormat(
    nextMaps,
    {},
    legacyMap
  )
  const normalizedVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
    nextVariants,
    {},
    normalized,
    legacyVariants
  )
  structureMapsByPreviewFormat.value = normalized
  structureVariantsByPreviewFormat.value = normalizedVariants
  updatedAt.value = nextUpdatedAt
  isLoaded.value = true
  liveChangeVersion += 1
  notifyUpdated({
    structures: normalized[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    variants: normalizedVariants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    structuresByPreviewFormat: normalized,
    variantsByPreviewFormat: normalizedVariants,
    updatedAt: nextUpdatedAt,
    origin
  })
  return normalized
}

const acceptIncomingLiveMessage = (value: unknown) => {
  if (!value || typeof value !== 'object') return
  const message = value as Partial<LiveStructureMessage>
  if (message.type !== 'product-zone-structures:live') return
  if (message.sourceId === liveSourceId) return

  const messageUpdatedAt = typeof message.updatedAt === 'string'
    ? message.updatedAt
    : new Date().toISOString()
  if (updatedAt.value && messageUpdatedAt < updatedAt.value) return

  applyStructureLibrary(
    message.structuresByPreviewFormat ?? message.structures,
    messageUpdatedAt,
    'remote',
    message.variantsByPreviewFormat ?? message.variants,
    message.structures,
    message.variants
  )
}

const ensureLiveSync = () => {
  if (!import.meta.client || liveSyncInitialized) return
  liveSyncInitialized = true

  window.addEventListener('storage', (event) => {
    if (event.key !== LIVE_SYNC_STORAGE_KEY || !event.newValue) return
    try {
      acceptIncomingLiveMessage(JSON.parse(event.newValue))
    } catch {
      // A corrupted transient message must not break the editor.
    }
  })

  if (typeof window.BroadcastChannel === 'function') {
    liveSyncChannel = new window.BroadcastChannel(LIVE_SYNC_CHANNEL)
    liveSyncChannel.addEventListener('message', (event: MessageEvent) => {
      acceptIncomingLiveMessage(event.data)
    })
  }
}

const broadcastLiveLibrary = (
  normalized: ProductZoneStructureMapByPreviewFormat,
  timestamp: string,
  variants: ProductZoneStructureVariantMapByPreviewFormat = structureVariantsByPreviewFormat.value
) => {
  if (!import.meta.client) return
  ensureLiveSync()

  const message: LiveStructureMessage = {
    type: 'product-zone-structures:live',
    sourceId: liveSourceId,
    updatedAt: timestamp,
    structures: normalized[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    variants: variants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
    structuresByPreviewFormat: normalized,
    variantsByPreviewFormat: variants
  }

  try {
    liveSyncChannel?.postMessage(message)
  } catch {
    // localStorage below remains the fallback for browsers without a channel.
  }

  try {
    window.localStorage.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(message))
  } catch {
    // The live editor must continue working when storage is unavailable/full.
  }
}

export const useProductZoneStructures = () => {
  const { getApiAuthHeaders } = useApiAuth()
  ensureLiveSync()

  const load = async (force = false): Promise<ProductZoneStructureMapByPreviewFormat> => {
    if (!force && isLoaded.value) return structureMapsByPreviewFormat.value
    // A forced refresh must still join an existing request. Starting a second
    // request here would make the page race its own boot load and could expose
    // defaults before the authoritative response arrives.
    if (loadPromise) return loadPromise

    isLoading.value = true
    lastError.value = null
    const liveVersionAtStart = liveChangeVersion
    loadPromise = (async () => {
      try {
        const headers = await getApiAuthHeaders()
        const response = await $fetch<{
          structures?: unknown
          variants?: unknown
          structuresByPreviewFormat?: unknown
          variantsByPreviewFormat?: unknown
          updatedAt?: string | null
        }>(
          '/api/product-zone-structures',
          { headers }
        )
        // Do not let a slower API response erase a live edit received while
        // the request was in flight.
        if (liveChangeVersion !== liveVersionAtStart && isLoaded.value) {
          return structureMapsByPreviewFormat.value
        }
        const next = normalizeProductZoneStructureMapByPreviewFormat(
          response?.structuresByPreviewFormat,
          {},
          response?.structures
        )
        const nextVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
          response?.variantsByPreviewFormat,
          {},
          next,
          response?.variants
        )
        structureMapsByPreviewFormat.value = next
        structureVariantsByPreviewFormat.value = nextVariants
        updatedAt.value = response?.updatedAt ?? null
        isLoaded.value = true
        notifyUpdated({
          structures: next[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
          variants: nextVariants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
          structuresByPreviewFormat: next,
          variantsByPreviewFormat: nextVariants,
          updatedAt: updatedAt.value,
          origin: 'load'
        })
        return next
      } catch (error: any) {
        lastError.value = String(
          error?.data?.statusMessage || error?.message || 'Nao foi possivel carregar as estruturas.'
        )
        // Keep the deterministic defaults in memory so the editor remains
        // usable while the account endpoint is unavailable.
        isLoaded.value = false
        return structureMapsByPreviewFormat.value
      } finally {
        isLoading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  const save = async (
    nextMaps: unknown,
    nextVariants?: unknown
  ): Promise<ProductZoneStructureMapByPreviewFormat> => {
    isLoading.value = true
    lastError.value = null
    try {
      const normalized = normalizeProductZoneStructureMapByPreviewFormat(nextMaps)
      const normalizedVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
        nextVariants,
        {},
        normalized
      )
      const headers = await getApiAuthHeaders()
      const response = await $fetch<{
        structures?: unknown
        variants?: unknown
        structuresByPreviewFormat?: unknown
        variantsByPreviewFormat?: unknown
        updatedAt?: string | null
      }>(
        '/api/product-zone-structures',
        {
          method: 'PUT',
          headers,
          body: {
            structures: normalized[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
            variants: normalizedVariants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
            structuresByPreviewFormat: normalized,
            variantsByPreviewFormat: normalizedVariants
          }
        }
      )
      const timestamp = response?.updatedAt ?? new Date().toISOString()
      const committed = applyStructureLibrary(
        response?.structuresByPreviewFormat ?? normalized,
        timestamp,
        'local',
        response?.variantsByPreviewFormat ?? normalizedVariants,
        response?.structures ?? normalized[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT],
        response?.variants ?? normalizedVariants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
      )
      broadcastLiveLibrary(committed, timestamp, structureVariantsByPreviewFormat.value)
      return committed
    } catch (error: any) {
      lastError.value = String(
        error?.data?.statusMessage || error?.message || 'Nao foi possivel salvar as estruturas.'
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const reset = async (): Promise<ProductZoneStructureMapByPreviewFormat> => {
    const defaults = createDefaultProductZoneStructureMapByPreviewFormat()
    return save(defaults, createDefaultProductZoneStructureVariantMapByPreviewFormat({}, defaults))
  }

  const publishLive = (
    nextMaps: unknown,
    nextVariants?: unknown
  ): ProductZoneStructureMapByPreviewFormat => {
    const timestamp = new Date().toISOString()
    const normalized = applyStructureLibrary(nextMaps, timestamp, 'local', nextVariants)
    broadcastLiveLibrary(normalized, timestamp, structureVariantsByPreviewFormat.value)
    return normalized
  }

  const getStructureForCount = (
    count: number,
    baseZone: Partial<ProductZone> = {},
    previewFormat: ProductZonePreviewFormat = DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT
  ): ProductZoneStructure => {
    const safeCount = Math.min(24, Math.max(1, Math.round(Number(count) || 1)))
    return normalizeProductZoneStructure(
      structureMapsByPreviewFormat.value[previewFormat]?.[String(safeCount)],
      safeCount,
      baseZone
    )
  }

  return {
    structureMap,
    structureMapSnapshot: computed(() => cloneStructureMap(structureMap.value)),
    structureVariants,
    structureVariantsSnapshot: computed(() => cloneVariantMap(structureVariants.value)),
    structureMapsByPreviewFormat,
    structureMapsByPreviewFormatSnapshot: computed(() =>
      cloneStructureMapsByPreviewFormat(structureMapsByPreviewFormat.value)
    ),
    structureVariantsByPreviewFormat,
    structureVariantsByPreviewFormatSnapshot: computed(() =>
      cloneVariantMapsByPreviewFormat(structureVariantsByPreviewFormat.value)
    ),
    isLoading,
    isLoaded,
    lastError,
    updatedAt,
    load,
    save,
    reset,
    publishLive,
    getStructureForCount
  }
}
