import { applyLogoPreferenceToFabric, normalizeLogoPreference } from './logoPreference'
import { toWasabiProxyUrl } from './storageProxy'

export type AccountFlyerLogoPreference = {
  backdrop?: string
  outline?: boolean
  outlineColor?: string
  outlineWidth?: number
  outlineOpacity?: number
  outlineMode?: 'inside' | 'outside'
  border?: boolean
  borderColor?: string
  borderWidth?: number
}

export type AccountLogoImageSize = {
  width: number
  height: number
  cropX?: number
  cropY?: number
}

const pendingPreviewTasks: Array<{ key?: string; priority: number; start: () => void }> = []
const previewTaskPromises = new Map<string, Promise<unknown>>()
let activePreviewTasks = 0
const ACCOUNT_PREVIEW_CACHE_DB = 'jobvarejo-account-flyer-previews'
const ACCOUNT_PREVIEW_CACHE_STORE = 'previews'
const ACCOUNT_PREVIEW_CACHE_LIMIT = 256
const accountPreviewMemoryCache = new Map<string, { imageUrl: string; touchedAt: number }>()
let accountPreviewCacheDbPromise: Promise<IDBDatabase | null> | null = null

export const shouldStartAccountFlyerPreview = (options: {
  profileReady: boolean
  hasTemplateId: boolean
  isVisible: boolean
  rendererInProgress: boolean
  hasRenderedPreview: boolean
}): boolean => options.profileReady &&
  options.hasTemplateId &&
  options.isVisible &&
  !options.rendererInProgress &&
  !options.hasRenderedPreview

export const shouldRenderAccountFlyerPreview = (options: {
  hasGalleryPreview: boolean
  personalize: boolean
  accountHasLogo: boolean
}): boolean => !options.hasGalleryPreview || (options.personalize && options.accountHasLogo)

/** The projects API returns page metadata in `canvas_data`; older rows may
 * still use the snake_case storage reference while current saves use camelCase. */
export const getAccountFlyerTemplatePages = (project: any): any[] => {
  const stored = project?.canvas_data ?? project?.canvasData
  if (Array.isArray(stored)) return stored
  if (stored && typeof stored === 'object' && Array.isArray(stored.pages)) return stored.pages
  return []
}

export const getAccountFlyerTemplateCanvasData = (page: any): any => {
  const value = page?.canvasData ?? page?.canvas_data
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const getAccountFlyerTemplateCanvasDataPath = (page: any): string =>
  String(page?.canvasDataPath ?? page?.canvas_data_path ?? '').trim()

/** Clones a serialized canvas and routes storage-backed image sources through
 * the authenticated proxy, matching the editor's canvas load normalization. */
export const normalizeAccountFlyerCanvasImageSources = (sourceJson: any): any => {
  const cloned = JSON.parse(JSON.stringify(sourceJson || {}))
  const visited = new WeakSet<object>()
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object' || visited.has(node)) return
    visited.add(node)
    if (String(node.type || '').toLowerCase() === 'image' && typeof node.src === 'string') {
      node.src = toWasabiProxyUrl(node.src) || node.src
      node.crossOrigin = 'anonymous'
    }
    if (Array.isArray(node.objects)) node.objects.forEach(visit)
    if (node.clipPath && typeof node.clipPath === 'object') visit(node.clipPath)
    if (node.backgroundImage && typeof node.backgroundImage === 'object') visit(node.backgroundImage)
  }
  visit(cloned)
  return cloned
}

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stableSerialize((value as any)[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const buildAccountFlyerPreviewCacheKey = (options: {
  templateId: string
  accountId: string
  logoSource: string
  logoPreference?: AccountFlyerLogoPreference | null
  revision: string
}): string => ['account-preview-v2',
  String(options.templateId || '').trim(),
  String(options.accountId || '').trim(),
  String(options.logoSource || '').trim(),
  stableSerialize(options.logoPreference || null),
  String(options.revision || '').trim()
].join('|')

const openAccountPreviewCacheDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (accountPreviewCacheDbPromise) return accountPreviewCacheDbPromise
  accountPreviewCacheDbPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 300)
    try {
      const request = indexedDB.open(ACCOUNT_PREVIEW_CACHE_DB, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(ACCOUNT_PREVIEW_CACHE_STORE)) {
          db.createObjectStore(ACCOUNT_PREVIEW_CACHE_STORE, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => { clearTimeout(timeout); resolve(request.result) }
      request.onerror = () => { clearTimeout(timeout); resolve(null) }
      request.onblocked = () => { clearTimeout(timeout); resolve(null) }
    } catch {
      clearTimeout(timeout)
      resolve(null)
    }
  })
  return accountPreviewCacheDbPromise
}

export const getCachedAccountFlyerPreview = async (key: string): Promise<string> => {
  const memoryEntry = accountPreviewMemoryCache.get(key)
  if (memoryEntry) {
    memoryEntry.touchedAt = Date.now()
    return memoryEntry.imageUrl
  }
  const db = await openAccountPreviewCacheDb()
  if (!db) return ''
  return await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(''), 300)
    try {
      const request = db.transaction(ACCOUNT_PREVIEW_CACHE_STORE, 'readonly')
        .objectStore(ACCOUNT_PREVIEW_CACHE_STORE)
        .get(key)
      request.onsuccess = () => {
        const imageUrl = String(request.result?.imageUrl || '')
        if (imageUrl) {
          accountPreviewMemoryCache.set(key, { imageUrl, touchedAt: Date.now() })
          while (accountPreviewMemoryCache.size > ACCOUNT_PREVIEW_CACHE_LIMIT) {
            const oldest = [...accountPreviewMemoryCache.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0]
            if (!oldest) break
            accountPreviewMemoryCache.delete(oldest[0])
          }
          clearTimeout(timeout)
          resolve(imageUrl)
        } else { clearTimeout(timeout); resolve('') }
      }
      request.onerror = () => { clearTimeout(timeout); resolve('') }
    } catch {
      clearTimeout(timeout)
      resolve('')
    }
  })
}

export const cacheAccountFlyerPreview = async (key: string, imageUrl: string): Promise<void> => {
  const cleanUrl = String(imageUrl || '').trim()
  if (!key || !cleanUrl) return
  accountPreviewMemoryCache.set(key, { imageUrl: cleanUrl, touchedAt: Date.now() })
  while (accountPreviewMemoryCache.size > ACCOUNT_PREVIEW_CACHE_LIMIT) {
    const oldest = [...accountPreviewMemoryCache.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0]
    if (!oldest) break
    accountPreviewMemoryCache.delete(oldest[0])
  }

  const db = await openAccountPreviewCacheDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(ACCOUNT_PREVIEW_CACHE_STORE, 'readwrite')
      const store = transaction.objectStore(ACCOUNT_PREVIEW_CACHE_STORE)
      store.put({ key, imageUrl: cleanUrl, touchedAt: Date.now() })
      const keysRequest = store.getAllKeys()
      keysRequest.onsuccess = () => {
        const keys = keysRequest.result.map(String)
        if (keys.length > ACCOUNT_PREVIEW_CACHE_LIMIT) {
          const entriesRequest = store.getAll()
          entriesRequest.onsuccess = () => {
            const oldest = entriesRequest.result
              .sort((a: any, b: any) => Number(a?.touchedAt || 0) - Number(b?.touchedAt || 0))
              .slice(0, entriesRequest.result.length - ACCOUNT_PREVIEW_CACHE_LIMIT)
            oldest.forEach((entry: any) => store.delete(String(entry?.key || '')))
          }
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Limits library canvas rendering and project reads across all preview instances. */
const drainAccountPreviewQueue = (): void => {
  while (activePreviewTasks < 2 && pendingPreviewTasks.length) {
    const next = pendingPreviewTasks.shift()
    next?.start()
  }
}

export const runWithAccountFlyerPreviewConcurrency = <T,>(
  task: () => Promise<T>,
  key?: string,
  priority = 0
): Promise<T> => {
  const cleanKey = String(key || '').trim()
  if (cleanKey && previewTaskPromises.has(cleanKey)) return previewTaskPromises.get(cleanKey) as Promise<T>
  if (pendingPreviewTasks.length >= 24 && priority <= 0) {
    return Promise.reject(new Error('A fila de prévias atingiu o limite; a prévia será tentada novamente ao entrar na tela.'))
  }
  const promise = new Promise<T>((resolve, reject) => {
    const start = () => {
      activePreviewTasks += 1
      void task().then(resolve, reject).finally(() => {
        activePreviewTasks = Math.max(0, activePreviewTasks - 1)
        if (cleanKey) previewTaskPromises.delete(cleanKey)
        drainAccountPreviewQueue()
      })
    }
    pendingPreviewTasks.push({ key: cleanKey || undefined, priority, start })
    pendingPreviewTasks.sort((a, b) => b.priority - a.priority)
    drainAccountPreviewQueue()
  })
  if (cleanKey) previewTaskPromises.set(cleanKey, promise)
  return promise
}

const isLogoSlot = (object: any): boolean =>
  String(object?.businessProfileField || '').trim().toLowerCase() === 'logo' || object?.quickLogoSlot === true

const finitePositive = (value: unknown): number => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const getObjectCenter = (object: any): { left: number; top: number } => {
  const width = finitePositive(object?.width) * (finitePositive(object?.scaleX) || 1)
  const height = finitePositive(object?.height) * (finitePositive(object?.scaleY) || 1)
  const left = Number(object?.left || 0)
  const top = Number(object?.top || 0)
  const originX = String(object?.originX || 'left').toLowerCase()
  const originY = String(object?.originY || 'top').toLowerCase()
  return {
    left: left + (originX === 'center' ? 0 : originX === 'right' ? -width / 2 : width / 2),
    top: top + (originY === 'center' ? 0 : originY === 'bottom' ? -height / 2 : height / 2)
  }
}

const getLogoSlotBox = (object: any): { width: number; height: number } => {
  const renderedWidth = finitePositive(object?.width) * (finitePositive(object?.scaleX) || 1)
  const renderedHeight = finitePositive(object?.height) * (finitePositive(object?.scaleY) || 1)
  return {
    width: finitePositive(object?.quickLogoMaxWidth) || renderedWidth,
    height: finitePositive(object?.quickLogoMaxHeight) || renderedHeight
  }
}

/**
 * Clones canvas JSON and binds only explicitly dynamic logo slots to the
 * selected account. Branded/static image objects remain untouched.
 */
export const bindAccountLogoToFlyerCanvas = (
  sourceJson: any,
  options: {
    logoSrc: string
    logoSize?: AccountLogoImageSize | null
    logoPreference?: AccountFlyerLogoPreference | null
  }
): any => {
  const cloned = JSON.parse(JSON.stringify(sourceJson || {}))
  const logoSrc = String(options.logoSrc || '').trim()
  const logoWidth = finitePositive(options.logoSize?.width)
  const logoHeight = finitePositive(options.logoSize?.height)
  const hasLogoDimensions = !!(logoWidth && logoHeight)
  const removedLogoIds = new Set<string>()
  const logoPreference = normalizeLogoPreference(options.logoPreference)

  const visit = (container: any): void => {
    if (!container || typeof container !== 'object' || !Array.isArray(container.objects)) return
    container.objects = container.objects.flatMap((object: any) => {
      if (!object || typeof object !== 'object') return [object]
      if (isLogoSlot(object)) {
        if (!logoSrc || object.quickFieldEnabled === false || !hasLogoDimensions) {
          const id = String(object?._customId || '').trim()
          const backdropId = String(object?.quickLogoBackdropId || '').trim()
          if (id) removedLogoIds.add(id)
          if (backdropId) removedLogoIds.add(backdropId)
          return []
        }

        const { left, top } = getObjectCenter(object)
        const slot = getLogoSlotBox(object)
        const scale = Math.min(slot.width / logoWidth, slot.height / logoHeight)
        if (!Number.isFinite(scale) || scale <= 0) return []
        const image = {
          ...object,
          type: 'Image',
          src: logoSrc,
          __originalSrc: logoSrc,
          originX: 'center',
          originY: 'center',
          left,
          top,
          width: logoWidth,
          height: logoHeight,
          scaleX: scale,
          scaleY: scale,
          cropX: Math.max(0, Number(options.logoSize?.cropX || 0)),
          cropY: Math.max(0, Number(options.logoSize?.cropY || 0)),
          visible: true,
          quickLogoSource: logoSrc,
          quickLogoSlot: true,
          quickLogoCenterX: left,
          quickLogoCenterY: top,
          quickLogoMaxWidth: slot.width,
          quickLogoMaxHeight: slot.height
        }
        delete image.objects
        if (logoPreference) applyLogoPreferenceToFabric(image, logoPreference)
        return [image]
      }
      visit(object)
      return [object]
    })
  }

  visit(cloned)
  const removeAssociatedBackdrops = (container: any): void => {
    if (!container || typeof container !== 'object' || !Array.isArray(container.objects)) return
    container.objects = container.objects.filter((object: any) => {
      if (object?.quickLogoBackdrop !== true) return true
      const ownerId = String(object.quickLogoBackdropOwnerId || '').trim()
      const objectId = String(object._customId || '').trim()
      return !removedLogoIds.has(ownerId) && !removedLogoIds.has(objectId)
    })
    container.objects.forEach(removeAssociatedBackdrops)
  }
  removeAssociatedBackdrops(cloned)
  return cloned
}

export const getAccountFlyerLogoSource = (profile: any): string => {
  const businessProfile = profile?.business_profile && typeof profile.business_profile === 'object'
    ? profile.business_profile
    : profile
  return String(
    businessProfile?.logo ||
    businessProfile?.logoUrl ||
    businessProfile?.logo_url ||
    businessProfile?.custom_logo ||
    businessProfile?.customLogo ||
    ''
  ).trim()
}

export const getAccountFlyerLogoPreference = (profile: any): AccountFlyerLogoPreference | null => {
  const businessProfile = profile?.business_profile && typeof profile.business_profile === 'object'
    ? profile.business_profile
    : profile
  const preference = businessProfile?.logoPreference
  return preference && typeof preference === 'object' && !Array.isArray(preference) ? preference : null
}
