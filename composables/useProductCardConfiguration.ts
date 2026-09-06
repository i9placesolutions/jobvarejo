import { computed, ref } from 'vue'
import type { ProductCardConfiguration } from '~/types/product-zone'
import {
  createDefaultProductCardConfiguration,
  normalizeProductCardConfiguration
} from '~/utils/product-card-configuration'

const cloneConfiguration = (value: ProductCardConfiguration): ProductCardConfiguration => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductCardConfiguration
  } catch {
    return normalizeProductCardConfiguration(value)
  }
}

const configuration = ref<ProductCardConfiguration>(createDefaultProductCardConfiguration())
const isLoading = ref(false)
const isLoaded = ref(false)
const lastError = ref<string | null>(null)
const updatedAt = ref<string | null>(null)
let loadPromise: Promise<ProductCardConfiguration> | null = null
let liveSyncInitialized = false
let liveSyncChannel: BroadcastChannel | null = null
let liveChangeVersion = 0

const LIVE_SYNC_CHANNEL = 'jobvarejo:product-card-configuration'
const LIVE_SYNC_STORAGE_KEY = 'jobvarejo:product-card-configuration:live'
const liveSourceId = `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`

type LiveCardConfigurationMessage = {
  type: 'product-card-configuration:live'
  sourceId: string
  updatedAt: string
  configuration: unknown
}

const notifyUpdated = (detail: Record<string, unknown> = {}) => {
  if (!import.meta.client) return
  window.dispatchEvent(new CustomEvent('product-card-configuration:updated', { detail }))
}

const applyConfiguration = (
  nextConfiguration: unknown,
  nextUpdatedAt: string | null = new Date().toISOString(),
  origin: 'local' | 'remote' = 'local'
) => {
  const normalized = normalizeProductCardConfiguration(nextConfiguration as Partial<ProductCardConfiguration>)
  configuration.value = normalized
  updatedAt.value = nextUpdatedAt
  isLoaded.value = true
  liveChangeVersion += 1
  notifyUpdated({ configuration: normalized, updatedAt: nextUpdatedAt, origin })
  return normalized
}

const acceptIncomingLiveMessage = (value: unknown) => {
  if (!value || typeof value !== 'object') return
  const message = value as Partial<LiveCardConfigurationMessage>
  if (message.type !== 'product-card-configuration:live') return
  if (message.sourceId === liveSourceId) return

  const messageUpdatedAt = typeof message.updatedAt === 'string'
    ? message.updatedAt
    : new Date().toISOString()
  if (updatedAt.value && messageUpdatedAt < updatedAt.value) return
  applyConfiguration(message.configuration, messageUpdatedAt, 'remote')
}

const ensureLiveSync = () => {
  if (!import.meta.client || liveSyncInitialized) return
  liveSyncInitialized = true

  window.addEventListener('storage', (event) => {
    if (event.key !== LIVE_SYNC_STORAGE_KEY || !event.newValue) return
    try {
      acceptIncomingLiveMessage(JSON.parse(event.newValue))
    } catch {
      // Uma mensagem transiente invalida nao pode interromper o editor.
    }
  })

  if (typeof window.BroadcastChannel === 'function') {
    liveSyncChannel = new window.BroadcastChannel(LIVE_SYNC_CHANNEL)
    liveSyncChannel.addEventListener('message', (event: MessageEvent) => {
      acceptIncomingLiveMessage(event.data)
    })
  }
}

const broadcastConfiguration = (normalized: ProductCardConfiguration, timestamp: string) => {
  if (!import.meta.client) return
  ensureLiveSync()

  const message: LiveCardConfigurationMessage = {
    type: 'product-card-configuration:live',
    sourceId: liveSourceId,
    updatedAt: timestamp,
    configuration: normalized
  }

  try {
    liveSyncChannel?.postMessage(message)
  } catch {
    // localStorage abaixo e o fallback para browsers sem BroadcastChannel.
  }

  try {
    window.localStorage.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(message))
  } catch {
    // O editor continua funcional se o storage estiver indisponivel/cheio.
  }
}

export const useProductCardConfiguration = () => {
  const { getApiAuthHeaders } = useApiAuth()
  ensureLiveSync()

  const load = async (force = false): Promise<ProductCardConfiguration> => {
    if (!force && isLoaded.value) return configuration.value
    if (loadPromise && !force) return loadPromise

    isLoading.value = true
    lastError.value = null
    const liveVersionAtStart = liveChangeVersion
    loadPromise = (async () => {
      try {
        const headers = await getApiAuthHeaders()
        const response = await $fetch<{ configuration?: unknown; updatedAt?: string | null }>(
          '/api/product-card-configuration',
          { headers }
        )
        if (liveChangeVersion !== liveVersionAtStart && isLoaded.value) {
          return configuration.value
        }

        const normalized = normalizeProductCardConfiguration(response?.configuration as Partial<ProductCardConfiguration>)
        configuration.value = normalized
        updatedAt.value = response?.updatedAt ?? null
        isLoaded.value = true
        notifyUpdated({ configuration: normalized, updatedAt: updatedAt.value, origin: 'load' })
        return normalized
      } catch (error: any) {
        lastError.value = String(
          error?.data?.statusMessage || error?.message || 'Nao foi possivel carregar a configuracao dos cards.'
        )
        isLoaded.value = false
        return configuration.value
      } finally {
        isLoading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  const save = async (nextConfiguration: unknown): Promise<ProductCardConfiguration> => {
    isLoading.value = true
    lastError.value = null
    try {
      const normalized = normalizeProductCardConfiguration(nextConfiguration as Partial<ProductCardConfiguration>)
      const headers = await getApiAuthHeaders()
      const response = await $fetch<{ configuration?: unknown; updatedAt?: string | null }>(
        '/api/product-card-configuration',
        {
          method: 'PUT',
          headers,
          body: { configuration: normalized }
        }
      )
      const timestamp = response?.updatedAt ?? new Date().toISOString()
      const committed = applyConfiguration(response?.configuration ?? normalized, timestamp)
      broadcastConfiguration(committed, timestamp)
      return committed
    } catch (error: any) {
      lastError.value = String(
        error?.data?.statusMessage || error?.message || 'Nao foi possivel salvar a configuracao dos cards.'
      )
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const reset = async () => save(createDefaultProductCardConfiguration())

  const publishLive = (nextConfiguration: unknown) => {
    const timestamp = new Date().toISOString()
    const normalized = applyConfiguration(nextConfiguration, timestamp)
    broadcastConfiguration(normalized, timestamp)
    return normalized
  }

  return {
    configuration,
    configurationSnapshot: computed(() => cloneConfiguration(configuration.value)),
    isLoading,
    isLoaded,
    lastError,
    updatedAt,
    load,
    save,
    reset,
    publishLive
  }
}
