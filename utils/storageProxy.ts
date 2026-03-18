import { extractStorageKeyFromRef } from './storageRef'

type ProxyUrlOptions = {
  version?: string | number | Date | null
  bucket?: string | null
}

// Guard against useRuntimeConfig not being available (Nitro context / standalone scripts).
const getWasabiConfig = (): any => {
  try {
    return useRuntimeConfig?.()?.public?.wasabi || {}
  } catch {
    return {}
  }
}

const WASABI_PROXY_CACHE_LIMIT = 2048
const wasabiProxyUrlCache = new Map<string, string | null>()

const getWasabiProxyCacheKey = (input: string, options?: ProxyUrlOptions): string => {
  const version = options?.version instanceof Date
    ? String(options.version.getTime())
    : String(options?.version ?? '')
  const bucket = String(options?.bucket ?? '')
  return `${bucket}\u0000${version}\u0000${input}`
}

const readWasabiProxyUrlCache = (key: string): string | null | undefined => {
  const cached = wasabiProxyUrlCache.get(key)
  if (cached === undefined) return undefined
  wasabiProxyUrlCache.delete(key)
  wasabiProxyUrlCache.set(key, cached)
  return cached
}

const writeWasabiProxyUrlCache = (key: string, value: string | null): string | null => {
  wasabiProxyUrlCache.set(key, value)
  if (wasabiProxyUrlCache.size > WASABI_PROXY_CACHE_LIMIT) {
    const oldestKey = wasabiProxyUrlCache.keys().next().value
    if (oldestKey) wasabiProxyUrlCache.delete(oldestKey)
  }
  return value
}

const normalizeVersion = (value?: string | number | Date | null): string | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return String(value.getTime())
  const raw = String(value).trim()
  if (!raw) return null
  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) return String(asDate)
  return raw
}

const extractVersionFromUrl = (value: string): string | null => {
  try {
    const target = value.startsWith('http://') || value.startsWith('https://')
      ? new URL(value)
      : new URL(value, 'http://local')
    const picks = ['v', 'version', 'versionId', 'X-Amz-Version-Id', 'x-amz-version-id', 'etag', 'X-Amz-Signature', 'X-Amz-Date']
    for (const key of picks) {
      const found = target.searchParams.get(key)
      if (found) return found
    }
    return null
  } catch {
    return null
  }
}

const buildProxyUrl = (key: string, version?: string | null, bucket?: string | null): string => {
  const params = new URLSearchParams()
  params.set('key', key)
  const cleanBucket = String(bucket || '').trim()
  if (cleanBucket) params.set('bucket', cleanBucket)
  if (version) params.set('v', version)
  // Prefer the alias `/api/storage/p` to avoid adblock rules matching "proxy".
  return `/api/storage/p?${params.toString()}`
}

const normalizeProxyLikeInput = (value: string): string[] => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return []

  const candidates = [trimmed]

  if (trimmed.startsWith('proxy?')) {
    candidates.push(`http://local/${trimmed}`)
  } else if (
    trimmed.startsWith('/proxy?') ||
    trimmed.startsWith('/api/storage/proxy?') ||
    trimmed.startsWith('/api/storage/p?') ||
    trimmed.startsWith('/p?')
  ) {
    candidates.push(`http://local${trimmed}`)
  }

  // Legacy malformed absolute without protocol, e.g. "localhost:3000/api/storage/proxy?..."
  if (/^[a-z0-9.-]+:\d+\/.+/i.test(trimmed) && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    candidates.push(`http://${trimmed}`)
  }

  return [...new Set(candidates)]
}

const toRelativeStorageProxyUrl = (
  value: string,
  options?: ProxyUrlOptions,
  fallbackVersion?: string | null
): string | null => {
  for (const candidate of normalizeProxyLikeInput(value)) {
    try {
      const parsed = candidate.startsWith('http://') || candidate.startsWith('https://')
        ? new URL(candidate)
        : new URL(candidate, 'http://local')
      const pathname = String(parsed.pathname || '')
      // FIX: tightened path matching — previously `pathname.endsWith('/p')` was
      // too broad and would match any URL whose path ended in `/p` (e.g.
      // `/help`, `/api/something/p`).  Now we only match the exact known
      // storage proxy paths.
      const isStorageProxyPath =
        pathname === '/api/storage/proxy' ||
        pathname === '/api/storage/p' ||
        pathname === '/proxy' ||
        pathname === '/p' ||
        pathname.endsWith('/api/storage/proxy') ||
        pathname.endsWith('/api/storage/p')
      if (!isStorageProxyPath) continue

      const key = parsed.searchParams.get('key')
      if (!key) continue

      const bucket = options?.bucket ?? parsed.searchParams.get('bucket')
      const existingV = parsed.searchParams.get('v')
      const version = normalizeVersion(options?.version) || existingV || fallbackVersion || null
      return buildProxyUrl(key, version, bucket)
    } catch {
      // try next candidate
    }
  }
  return null
}

export const toWasabiProxyUrl = (input?: string | null, options?: ProxyUrlOptions): string | null => {
  if (!input) return input ?? null
  const cacheKey = getWasabiProxyCacheKey(input, options)
  const cached = readWasabiProxyUrlCache(cacheKey)
  if (cached !== undefined) return cached

  // If caller already has a raw storage key, proxy it directly.
  // Common keys in this project: `projects/...`, `imagens/...`, `logo/...`.
  const trimmed = input.trim()
  const version = normalizeVersion(options?.version) || extractVersionFromUrl(trimmed)
  const proxiedFromLegacy = toRelativeStorageProxyUrl(trimmed, options, version)
  if (proxiedFromLegacy) return writeWasabiProxyUrlCache(cacheKey, proxiedFromLegacy)

  const keyLike = trimmed.replace(/^\/+/, '')
  if (
    keyLike.startsWith('projects/') ||
    keyLike.startsWith('imagens/') ||
    keyLike.startsWith('uploads/') ||
    keyLike.startsWith('logo/')
  ) {
    return writeWasabiProxyUrlCache(cacheKey, buildProxyUrl(keyLike, version, options?.bucket))
  }
  if (/^[^/]+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(keyLike)) {
    return writeWasabiProxyUrlCache(cacheKey, buildProxyUrl(keyLike, version, options?.bucket))
  }

  const cfg = getWasabiConfig()
  const endpoint = (cfg.endpoint || 's3.wasabisys.com').toString()
  const bucket = (cfg.bucket || 'jobvarejo').toString()

  const isMaybeWasabi =
    trimmed.includes('wasabisys.com') ||
    (endpoint && trimmed.includes(endpoint))
  if (!isMaybeWasabi) return writeWasabiProxyUrlCache(cacheKey, input)

  try {
    const u = new URL(trimmed)
    const host = (u.hostname || '').toLowerCase()
    const pathname = decodeURIComponent(u.pathname || '')
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return input

    const hostHasBucket = bucket && host.includes(`${bucket.toLowerCase()}.`)
    const keyParts = (!hostHasBucket && parts[0] === bucket) ? parts.slice(1) : parts
    const key = keyParts.join('/')
    if (!key) return writeWasabiProxyUrlCache(cacheKey, input)
    return writeWasabiProxyUrlCache(cacheKey, buildProxyUrl(key, version, options?.bucket))
  } catch {
    return writeWasabiProxyUrlCache(cacheKey, input)
  }
}

export const toWasabiDirectUrl = (
  input?: string | null,
  options?: { bucket?: string | null; endpoint?: string | null }
): string | null => {
  if (!input) return input ?? null
  const trimmed = String(input || '').trim()
  if (!trimmed) return null

  // FIX: reject potentially dangerous URLs — `javascript:` and `about:` can
  // lead to XSS if the returned URL is used in <img src> or <a href>.
  // blob: and data: are safe for images but should not be converted.
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('about:')) {
    return null
  }
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed
  }

  const cfg2 = getWasabiConfig()
  const endpoint = String(options?.endpoint || cfg2.endpoint || 's3.wasabisys.com').trim()
  const bucket = String(options?.bucket || cfg2.bucket || 'jobvarejo').trim()
  if (!endpoint || !bucket) return trimmed

  const fallbackProxyUrl = toWasabiProxyUrl(trimmed, { bucket })

  // Presigned URLs contain X-Amz-* parameters and expire after a short time.
  // Extract the S3 key and convert to a persistent proxy URL instead.
  if (
    trimmed.includes('X-Amz-Algorithm=') ||
    trimmed.includes('X-Amz-Signature=') ||
    trimmed.includes('X-Amz-Credential=')
  ) {
    const presignedKey = extractStorageKeyFromRef(trimmed, { bucket, endpoint })
    if (presignedKey) {
      const isPublicKey =
        presignedKey.startsWith('imagens/') ||
        presignedKey.startsWith('uploads/') ||
        presignedKey.startsWith('logo/')
      if (isPublicKey) {
        return buildProxyUrl(presignedKey, null, bucket)
      }
    }
    // Non-public keys: return presigned URL as-is (private project files need signed access)
    return trimmed
  }

  const key = extractStorageKeyFromRef(trimmed, { bucket, endpoint })
  if (!key) return fallbackProxyUrl || trimmed

  const isPublicScopedKey =
    key.startsWith('imagens/') ||
    key.startsWith('uploads/') ||
    key.startsWith('logo/')

  if (!isPublicScopedKey) return trimmed

  const proxied = fallbackProxyUrl
  if (proxied && proxied !== trimmed) return proxied

  if (
    key === trimmed.replace(/^\/+/, '') ||
    trimmed.startsWith('/api/storage/p?') ||
    trimmed.startsWith('/api/storage/proxy?')
  ) {
    return buildProxyUrl(key, null, bucket)
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed)
      const host = String(parsed.hostname || '').toLowerCase()
      const hostLooksLikeWasabi =
        host.includes('wasabisys.com') ||
        (endpoint ? host.includes(endpoint.toLowerCase()) : false)
      if (hostLooksLikeWasabi) {
        return buildProxyUrl(key, null, bucket)
      }
    } catch {
      return buildProxyUrl(key, null, bucket)
    }
  }

  return buildProxyUrl(key, null, bucket)
}
