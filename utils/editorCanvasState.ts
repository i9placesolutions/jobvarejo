export const CANVAS_VIEWPORT_JSON_KEY = '__canvasViewport' as const

export const fastHashString = (input: string): string => {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i)
    hash |= 0
  }
  return `h${(hash >>> 0).toString(16)}`
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
