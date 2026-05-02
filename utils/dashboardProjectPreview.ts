import { toWasabiProxyUrl } from './storageProxy'

const DASHBOARD_IMAGE_FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
  'linear-gradient(135deg, #0f766e 0%, #14532d 100%)',
  'linear-gradient(135deg, #b45309 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #6d28d9 0%, #7e22ce 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1f2937 100%)',
  'linear-gradient(135deg, #9f1239 0%, #831843 100%)'
]

const STORAGE_KEY_PREFIX_RE = /^(projects|imagens|uploads|logo)\//i
const IMAGE_FILE_RE = /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i

export const hashDashboardPreviewText = (input: string): number => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getDashboardProjectInitials = (project: any): string => {
  const name = String(project?.name || '').trim()
  if (!name) return 'JV'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = words.map((word) => (word[0] || '').toUpperCase()).join('')
  return initials || 'JV'
}

export const getDashboardProjectThumbStyle = (project: any) => {
  const seed = `${String(project?.id || '')}:${String(project?.name || '')}`
  const idx = hashDashboardPreviewText(seed) % DASHBOARD_IMAGE_FALLBACK_GRADIENTS.length
  return {
    background: DASHBOARD_IMAGE_FALLBACK_GRADIENTS[idx] || DASHBOARD_IMAGE_FALLBACK_GRADIENTS[0]
  }
}

const pickImageLikeValue = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return (
    record.url ??
    record.publicUrl ??
    record.public_url ??
    record.preview_url ??
    record.previewUrl ??
    record.thumbnailUrl ??
    record.thumbnail_url ??
    record.path ??
    record.key ??
    record.src ??
    ''
  )
}

export const normalizeDashboardImageSource = (value: unknown): string => {
  const picked = pickImageLikeValue(value)
  if (typeof picked !== 'string') return ''

  const raw = picked.trim()
  if (!raw) return ''

  const lower = raw.toLowerCase()
  if (lower === 'data:,' || lower === 'about:blank') return ''
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return ''
  if (lower.startsWith('blob:null')) return ''
  if (lower.startsWith('data:') && !lower.startsWith('data:image/')) return ''

  if (lower.startsWith('data:image/') || lower.startsWith('blob:')) return raw

  const proxied = toWasabiProxyUrl(raw)
  if (proxied && proxied !== raw) return proxied

  if (
    raw.startsWith('/') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    STORAGE_KEY_PREFIX_RE.test(raw) ||
    IMAGE_FILE_RE.test(raw)
  ) {
    return proxied || raw
  }

  return ''
}

export const getProjectPreviewSource = (project: any): string => {
  return normalizeDashboardImageSource(
    project?.preview_url ??
    project?.previewUrl ??
    project?.thumbnailUrl ??
    project?.thumbnail_url ??
    project?.thumbnail ??
    ''
  )
}

export const hasUsableDashboardImageSource = (value: unknown): boolean => {
  return !!normalizeDashboardImageSource(value)
}
