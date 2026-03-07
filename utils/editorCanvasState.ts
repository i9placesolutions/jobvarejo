export const CANVAS_VIEWPORT_JSON_KEY = '__canvasViewport' as const

export const fastHashString = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash |= 0
  }
  return `h${(hash >>> 0).toString(16)}`
}

const getCanvasSavedAt = (canvasData: unknown): number => {
  const root = asRecord(canvasData)
  if (!root) return 0

  const direct = [
    root.__savedAt,
    root._savedAt,
    root.savedAt,
    root.updatedAt
  ]
  for (const value of direct) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const meta = asRecord(root.meta)
  const metaSavedAt = Number(meta?.savedAt)
  if (Number.isFinite(metaSavedAt) && metaSavedAt > 0) return metaSavedAt

  return 0
}

const getCanvasObjectCount = (canvasData: unknown): number => {
  const root = asRecord(canvasData)
  const count = Number(root?.objects && Array.isArray(root.objects) ? root.objects.length : 0)
  return Number.isFinite(count) ? count : 0
}

const FINGERPRINT_IGNORED_KEYS = new Set([
  '__savedAt',
  '_savedAt',
  'savedAt',
  'updatedAt',
  '__assetUrlsNormalized',
  'crossOrigin',
  '__originalSrc',
  'objectCaching',
  'statefullCache',
  'lockScalingFlip',
  'lockSkewingX',
  'lockSkewingY'
])

const FINGERPRINT_PROXY_SRC_PATTERN = /\/api\/storage\/(?:proxy|p)(?:\?|$)/i
const FINGERPRINT_DATA_URL_PATTERN = /^data:image\//i

const stripVolatileCanvasMeta = (canvasData: unknown): unknown => {
  const root = asRecord(canvasData)
  if (!root) return canvasData

  const normalized: Record<string, unknown> = { ...root }
  delete normalized.__savedAt
  delete normalized._savedAt
  delete normalized.savedAt
  delete normalized.updatedAt
  delete normalized.__assetUrlsNormalized

  const meta = asRecord(normalized.meta)
  if (meta) {
    const nextMeta: Record<string, unknown> = { ...meta }
    delete nextMeta.savedAt
    if (Object.keys(nextMeta).length > 0) normalized.meta = nextMeta
    else delete normalized.meta
  }

  return normalized
}

export const computeCanvasFingerprint = (canvasData: unknown): string => {
  try {
    if (!canvasData || typeof canvasData !== 'object') return 'empty'
    const normalized = stripVolatileCanvasMeta(canvasData)
    return fastHashString(JSON.stringify(normalized, function (key, value) {
      if (FINGERPRINT_IGNORED_KEYS.has(key)) return undefined
      if (key === 'src') {
        const rawSrc = String(value || '').trim()
        const originalSrc = String((this as Record<string, unknown> | null)?.__originalSrc || '').trim()
        if (rawSrc && originalSrc && (FINGERPRINT_PROXY_SRC_PATTERN.test(rawSrc) || rawSrc.startsWith('blob:'))) {
          return originalSrc
        }
        if (rawSrc && originalSrc && FINGERPRINT_DATA_URL_PATTERN.test(rawSrc)) {
          return originalSrc
        }
      }
      return value
    }))
  } catch {
    return `fallback:${getCanvasObjectCount(canvasData)}:${getCanvasSavedAt(canvasData)}`
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

const normalizeVpt = (raw: unknown): number[] | null => {
  if (!Array.isArray(raw) || raw.length < 6) return null
  const out: number[] = []
  for (let i = 0; i < 6; i++) {
    const n = Number(raw[i])
    if (!Number.isFinite(n)) return null
    out.push(n)
  }
  return out
}

export const getSavedViewportTransform = (data: unknown): number[] | null => {
  const root = asRecord(data)
  if (!root) return null
  const viewportData = asRecord(root[CANVAS_VIEWPORT_JSON_KEY])
  if (!viewportData) return null
  return normalizeVpt(viewportData.vpt)
}

export const setSavedViewportTransform = (
  target: Record<string, unknown>,
  vpt: unknown,
  zoom?: unknown
): void => {
  const normalized = normalizeVpt(vpt)
  if (!normalized) return

  const payload: Record<string, unknown> = {
    vpt: normalized
  }
  const z = Number(zoom)
  if (Number.isFinite(z) && z > 0) payload.zoom = z

  target[CANVAS_VIEWPORT_JSON_KEY] = payload
}
