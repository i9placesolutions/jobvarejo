export const toWasabiProxyUrl = (input?: string | null): string | null => {
  if (!input) return input ?? null
  if (input.startsWith('/api/storage/proxy')) return input

  // If caller already has a raw storage key, proxy it directly.
  // Common keys in this project: `projects/...`, `imagens/...`, `logo/...`.
  const trimmed = input.trim()
  const keyLike = trimmed.replace(/^\/+/, '')
  if (
    keyLike.startsWith('projects/') ||
    keyLike.startsWith('imagens/') ||
    keyLike.startsWith('uploads/') ||
    keyLike.startsWith('logo/')
  ) {
    return `/api/storage/proxy?key=${encodeURIComponent(keyLike)}`
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
    return `/api/storage/proxy?key=${encodeURIComponent(key)}`
  } catch {
    return input
  }
}
