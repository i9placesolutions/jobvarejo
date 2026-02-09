type ProxyUrlOptions = {
  version?: string | number | Date | null
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

const buildProxyUrl = (key: string, version?: string | null): string => {
  const params = new URLSearchParams()
  params.set('key', key)
  if (version) params.set('v', version)
  return `/api/storage/proxy?${params.toString()}`
}

export const toWasabiProxyUrl = (input?: string | null, options?: ProxyUrlOptions): string | null => {
  if (!input) return input ?? null

  // If caller already has a raw storage key, proxy it directly.
  // Common keys in this project: `projects/...`, `imagens/...`, `logo/...`.
  const trimmed = input.trim()
  const version = normalizeVersion(options?.version) || extractVersionFromUrl(trimmed)
  if (trimmed.startsWith('/api/storage/proxy')) {
    try {
      const existing = new URL(trimmed, 'http://local')
      const key = existing.searchParams.get('key')
      if (!key) return trimmed
      const existingV = existing.searchParams.get('v')
      return buildProxyUrl(key, existingV || version)
    } catch {
      return trimmed
    }
  }
  const keyLike = trimmed.replace(/^\/+/, '')
  if (
    keyLike.startsWith('projects/') ||
    keyLike.startsWith('imagens/') ||
    keyLike.startsWith('uploads/') ||
    keyLike.startsWith('logo/')
  ) {
    return buildProxyUrl(keyLike, version)
  }

  const cfg = useRuntimeConfig?.()?.public?.wasabi || {}
  const endpoint = (cfg.endpoint || 's3.wasabisys.com').toString()
  const bucket = (cfg.bucket || 'jobvarejo').toString()

  const isMaybeWasabi = trimmed.includes('wasabisys.com') || (endpoint && trimmed.includes(endpoint))
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
    return buildProxyUrl(key, version)
  } catch {
    return input
  }
}
