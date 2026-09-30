export interface VideoCatalogAsset {
  key: string
  sha256: string
  bytes: number
  contentType: string
}

export interface VideoCatalogManifest {
  version: 1
  assets: Record<string, VideoCatalogAsset>
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const MIME_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

/** Accept only the public, manifest-listed paths served by the Video Studio. */
export function normalizeVideoCatalogPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 512) return null
  if (value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f?#%]/.test(value)) return null
  if (!value.startsWith('audio/') && !value.startsWith('templates/')) return null

  const segments = value.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null
  return value
}

export function resolveVideoCatalogAsset(
  manifest: VideoCatalogManifest,
  path: string
): VideoCatalogAsset | null {
  const normalized = normalizeVideoCatalogPath(path)
  if (!normalized || manifest?.version !== 1 || !manifest.assets) return null

  const asset = manifest.assets[normalized]
  if (!asset || typeof asset !== 'object') return null
  if (!SHA256_PATTERN.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0) return null
  if (!MIME_PATTERN.test(asset.contentType)) return null
  if (asset.key !== `video-studio/catalog/${asset.sha256}/${normalized}`) return null

  return asset
}

export interface ByteRange {
  start: number
  end: number
}

/** Parse a single RFC 9110 byte range against the known object length. */
export function parseVideoCatalogRange(value: string, size: number): ByteRange | null | 'invalid' {
  if (!value.startsWith('bytes=') || value.includes(',')) return 'invalid'
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2]) || size <= 0) return 'invalid'

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid'
    return { start: Math.max(0, size - suffixLength), end: size - 1 }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) return 'invalid'
  return { start, end: Math.min(requestedEnd, size - 1) }
}

export function videoCatalogEtag(sha256: string): string {
  return `"${sha256}"`
}

// Não combinar trechos antigos com bytes de uma nova versão do catálogo.
export function shouldHonorVideoCatalogRange(ifRange: string | undefined, etag: string): boolean {
  return !ifRange || ifRange.trim() === etag
}

export function matchesVideoCatalogEtag(header: string | undefined, etag: string): boolean {
  if (!header) return false
  return header.split(',').some(candidate => {
    const value = candidate.trim()
    return value === '*' || value === etag || value === `W/${etag}`
  })
}
