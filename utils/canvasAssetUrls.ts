import { useRuntimeConfig } from '#imports'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

export const CANVAS_ASSET_URLS_NORMALIZED_KEY = '__assetUrlsNormalized' as const
const CANVAS_ASSET_URLS_NORMALIZED_VERSION = 1
export const CANVAS_IMAGE_PLACEHOLDER_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

type NormalizeCanvasAssetUrlsOptions = {
  clone?: boolean
  silent?: boolean
  placeholderDataUrl?: string | null
}

type NormalizeCanvasAssetUrlsResult = {
  data: any
  blobCount: number
  contaboCount: number
  wasabiCount: number
}

const cloneCanvasData = (canvasData: any): any => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(canvasData)
    }
    return JSON.parse(JSON.stringify(canvasData))
  } catch {
    // FIX: previously returned the original reference on clone failure, causing
    // the caller to silently mutate the original data when it expected a clone.
    // Use a manual shallow-deep copy as a last resort.
    try {
      return JSON.parse(JSON.stringify(canvasData))
    } catch {
      // If even JSON round-trip fails (circular refs), log and return a new
      // object so the caller at least does not mutate the original.
      console.warn('[canvasAssetUrls] Failed to clone canvas data — returning empty wrapper')
      return { objects: [], version: canvasData?.version }
    }
  }
}

const walkCanvasObjects = (root: any, visitor: (obj: any) => void): void => {
  if (!root || typeof root !== 'object') return
  const stack: any[] = Array.isArray(root.objects) ? [...root.objects] : []
  const visited = new WeakSet<object>()
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    if (visited.has(node)) continue
    visited.add(node)
    visitor(node)
    if (Array.isArray(node.objects) && node.objects.length > 0) {
      for (let i = node.objects.length - 1; i >= 0; i--) {
        stack.push(node.objects[i])
      }
    }
    // FIX: also traverse clipPath sub-objects — image URLs inside clipPaths
    // were previously not normalized, leaving expired presigned/Contabo URLs
    // that cause CORS errors and broken renders on reload.
    if (node.clipPath && typeof node.clipPath === 'object') {
      stack.push(node.clipPath)
    }
  }
}

const extractContaboBucketAndKey = (url: string): { bucket: string | null; key: string | null } => {
  try {
    // FIX: do NOT double-decode.  Previously the URL was decoded with
    // decodeURIComponent before being passed to new URL(), which then decoded
    // the pathname again.  This broke URLs with percent-encoded characters
    // (e.g. %20 for spaces) because the first decode turned %20 into a literal
    // space, making the URL invalid for `new URL()`.
    const urlObj = new URL(url)
    const decodedPathname = decodeURIComponent(urlObj.pathname)
    const pathParts = decodedPathname.split('/').filter(Boolean)

    if (pathParts.length === 0) {
      return { bucket: null, key: null }
    }

    const cfg = (useRuntimeConfig()?.public?.contabo as any) || {}
    const configuredBucket = (cfg.bucket || '475a29e42e55430abff00915da2fa4bc:jobupload').toString()
    const candidates = new Set<string>()
    if (configuredBucket) candidates.add(configuredBucket)

    const first = pathParts[0] ?? ''
    const firstLooksLikeBucket = first.includes(':') || candidates.has(first)
    const hostLooksLikeVirtualHost = [...candidates].some((bucket) => (
      bucket && urlObj.hostname.startsWith(`${bucket.toLowerCase()}.`)
    ))

    let bucket: string | null = null
    let keyParts: string[]

    if (firstLooksLikeBucket && !hostLooksLikeVirtualHost) {
      bucket = first
      keyParts = pathParts.slice(1)
    } else if (hostLooksLikeVirtualHost) {
      const hostParts = urlObj.hostname.split('.')
      bucket = hostParts[0] || null
      keyParts = pathParts
    } else {
      bucket = null
      keyParts = pathParts
    }

    const key = keyParts.join('/')
    if (!key) {
      return { bucket: null, key: null }
    }

    return { bucket, key }
  } catch {
    return { bucket: null, key: null }
  }
}

export const isCanvasAssetUrlsNormalized = (canvasData: any): boolean => (
  Number(canvasData?.[CANVAS_ASSET_URLS_NORMALIZED_KEY] || 0) >= CANVAS_ASSET_URLS_NORMALIZED_VERSION
)

const markCanvasAssetUrlsNormalized = (canvasData: any): void => {
  if (!canvasData || typeof canvasData !== 'object') return
  canvasData[CANVAS_ASSET_URLS_NORMALIZED_KEY] = CANVAS_ASSET_URLS_NORMALIZED_VERSION
}

export const normalizeCanvasAssetUrls = (
  canvasData: any,
  opts: NormalizeCanvasAssetUrlsOptions = {}
): NormalizeCanvasAssetUrlsResult => {
  const normalized = opts.clone === false ? canvasData : cloneCanvasData(canvasData)
  if (!normalized || typeof normalized !== 'object') {
    return { data: normalized, blobCount: 0, contaboCount: 0, wasabiCount: 0 }
  }

  if (isCanvasAssetUrlsNormalized(normalized)) {
    return { data: normalized, blobCount: 0, contaboCount: 0, wasabiCount: 0 }
  }

  let blobCount = 0
  let contaboCount = 0
  let wasabiCount = 0
  const placeholderDataUrl = String(opts.placeholderDataUrl || '').trim() || null

  walkCanvasObjects(normalized, (node) => {
    const objType = String(node?.type || '').toLowerCase()
    if (objType === 'image' && !node.crossOrigin) {
      node.crossOrigin = 'anonymous'
    }

    if (typeof node?.src !== 'string' || !node.src.trim()) return
    // FIX: only process image objects — previously any object with a `src`
    // property (e.g. Pattern, custom objects) would get __originalSrc metadata
    // polluting non-image objects and potentially confusing serialization.
    if (objType !== 'image') return
    const src = String(node.src || '')

    if (!node.__originalSrc) {
      node.__originalSrc = src
    }

    if (placeholderDataUrl && src.startsWith('blob:')) {
      node.src = placeholderDataUrl
      blobCount++
      return
    }

    const wasabiProxy = toWasabiProxyUrl(src)
    if (wasabiProxy && wasabiProxy !== src) {
      node.src = wasabiProxy
      wasabiCount++
      return
    }

    if (src.includes('contabostorage.com')) {
      const { bucket, key } = extractContaboBucketAndKey(src)
      if (!key) return
      if (bucket) node.src = `/api/storage/p?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
      else node.src = `/api/storage/p?key=${encodeURIComponent(key)}`
      contaboCount++
    }
  })

  markCanvasAssetUrlsNormalized(normalized)

  if (!opts.silent) {
    if (blobCount > 0) console.warn(`⚠️ Substituindo ${blobCount} imagem(ns) blob por placeholder (URL temporária)`)
    if (contaboCount > 0) console.log(`🔄 Convertido ${contaboCount} URL(s) da Contabo para proxy local`)
    if (wasabiCount > 0) console.log(`🔄 Convertido ${wasabiCount} URL(s) do Wasabi para proxy local`)
  }

  return {
    data: normalized,
    blobCount,
    contaboCount,
    wasabiCount
  }
}
