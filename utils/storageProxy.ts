type ProxyUrlOptions = {
  version?: string | number | Date | null
  bucket?: string | null
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
      const isStorageProxyPath =
        pathname.endsWith('/api/storage/proxy') ||
        pathname === '/api/storage/proxy' ||
        pathname.endsWith('/api/storage/p') ||
        pathname === '/api/storage/p' ||
        pathname.endsWith('/proxy') ||
        pathname === '/proxy' ||
        pathname.endsWith('/p') ||
        pathname === '/p'
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

  // If caller already has a raw storage key, proxy it directly.
  // Common keys in this project: `projects/...`, `imagens/...`, `logo/...`.
  const trimmed = input.trim()
  const version = normalizeVersion(options?.version) || extractVersionFromUrl(trimmed)
  const proxiedFromLegacy = toRelativeStorageProxyUrl(trimmed, options, version)
  if (proxiedFromLegacy) return proxiedFromLegacy

  const keyLike = trimmed.replace(/^\/+/, '')
  if (
    keyLike.startsWith('projects/') ||
    keyLike.startsWith('imagens/') ||
    keyLike.startsWith('uploads/') ||
    keyLike.startsWith('logo/')
  ) {
    return buildProxyUrl(keyLike, version, options?.bucket)
  }
  if (/^[^/]+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(keyLike)) {
    return buildProxyUrl(keyLike, version, options?.bucket)
  }

  const cfg = useRuntimeConfig?.()?.public?.wasabi || {}
  const endpoint = (cfg.endpoint || 's3.wasabisys.com').toString()
  const bucket = (cfg.bucket || 'jobvarejo').toString()

  const isMaybeWasabi =
    trimmed.includes('wasabisys.com') ||
    (endpoint && trimmed.includes(endpoint))
  if (!isMaybeWasabi) return input

  try {
    const u = new URL(trimmed)
    const host = (u.hostname || '').toLowerCase()
    const pathname = decodeURIComponent(u.pathname || '')
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return input

    const hostHasBucket = bucket && host.includes(`${bucket.toLowerCase()}.`)
    const keyParts = (!hostHasBucket && parts[0] === bucket) ? parts.slice(1) : parts
    const key = keyParts.join('/')
    if (!key) return input
    return buildProxyUrl(key, version, options?.bucket)
  } catch {
    return input
  }
}
