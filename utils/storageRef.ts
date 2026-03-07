const STORAGE_KEY_PREFIXES = ['projects/', 'imagens/', 'uploads/', 'logo/'] as const

export type StorageRefOptions = {
  bucket?: string | null
  endpoint?: string | null
}

const isStorageProxyPath = (pathname: string): boolean => {
  return (
    pathname === '/api/storage/proxy' ||
    pathname.endsWith('/api/storage/proxy') ||
    pathname === '/api/storage/p' ||
    pathname.endsWith('/api/storage/p') ||
    pathname === '/proxy' ||
    pathname.endsWith('/proxy') ||
    pathname === '/p' ||
    pathname.endsWith('/p')
  )
}

const isStorageKeyLike = (value: string): boolean => {
  return STORAGE_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))
}

const normalizeKeyCandidate = (value: string): string | null => {
  const trimmed = String(value || '').trim().replace(/^\/+/, '')
  if (!trimmed) return null
  if (isStorageKeyLike(trimmed)) return trimmed
  return null
}

export const extractStorageKeyFromRef = (
  rawValue: unknown,
  opts: StorageRefOptions = {}
): string | null => {
  const value = String(rawValue || '').trim()
  if (!value) return null

  const directKey = normalizeKeyCandidate(value)
  if (directKey) return directKey

  const maybeRelativePath = normalizeKeyCandidate(value.split('?')[0]?.split('#')[0] || '')
  if (maybeRelativePath) return maybeRelativePath

  const urlCandidates = [value]
  if (
    value.startsWith('/api/storage/proxy?') ||
    value.startsWith('/api/storage/p?') ||
    value.startsWith('/proxy?') ||
    value.startsWith('/p?') ||
    value.startsWith('/projects/')
  ) {
    urlCandidates.push(`http://local${value}`)
  }

  for (const candidate of [...new Set(urlCandidates)]) {
    try {
      const parsed = candidate.startsWith('http://') || candidate.startsWith('https://')
        ? new URL(candidate)
        : new URL(candidate, 'http://local')

      if (isStorageProxyPath(parsed.pathname || '')) {
        const proxiedKey = parsed.searchParams.get('key')
        const normalizedProxyKey = normalizeKeyCandidate(decodeURIComponent(String(proxiedKey || '')))
        if (normalizedProxyKey) return normalizedProxyKey
      }

      const fromProjectsRoute = normalizeKeyCandidate(parsed.pathname || '')
      if (fromProjectsRoute) return fromProjectsRoute

      const host = String(parsed.hostname || '').toLowerCase()
      const pathname = decodeURIComponent(parsed.pathname || '')
      const pathParts = pathname.split('/').filter(Boolean)
      if (pathParts.length === 0) continue

      const bucket = String(opts.bucket || '').trim().toLowerCase()
      const endpoint = String(opts.endpoint || '').trim().toLowerCase()
      const firstPath = String(pathParts[0] || '').toLowerCase()

      if (bucket && firstPath === bucket && pathParts.length > 1) {
        const key = normalizeKeyCandidate(pathParts.slice(1).join('/'))
        if (key) return key
      }

      if (bucket && host.startsWith(`${bucket}.`) && pathParts.length > 0) {
        const key = normalizeKeyCandidate(pathParts.join('/'))
        if (key) return key
      }

      const hostLooksLikeWasabi =
        host.includes('wasabisys.com') ||
        (endpoint ? host.includes(endpoint) : false)
      if (hostLooksLikeWasabi) {
        const key = normalizeKeyCandidate(pathParts.join('/'))
        if (key) return key
      }

      const pathKey = normalizeKeyCandidate(pathParts.join('/'))
      if (pathKey) return pathKey
    } catch {
      continue
    }
  }

  return null
}
