export type ExportImageFormat = 'png' | 'jpg'
export type ExportQualityPreset = 'print-300' | 'ultra-600'

export const HIGH_RES_EXPORT_SCALE = 6
export const HIGH_RES_EXPORT_QUALITY = 1
export const EXPORT_COLOR_SATURATION = 1.12
export const EXPORT_COLOR_CONTRAST = 1.08
export const EXPORT_COLOR_BRIGHTNESS = 1.02
export const DEFAULT_EXPORT_QUALITY_PRESET: ExportQualityPreset = 'ultra-600'
export const DEFAULT_MULTI_FILE_MODE: 'zip' | 'separate' = 'zip'

const EXPORT_MAX_CANVAS_DIMENSION = 16384
const EXPORT_MAX_CANVAS_AREA = 140_000_000

export const normalizeExportImageFormat = (format: any): ExportImageFormat => (
  String(format) === 'jpeg' || String(format) === 'jpg' ? 'jpg' : 'png'
)

export const normalizeExportQualityPreset = (value: any): ExportQualityPreset => (
  String(value) === 'print-300' ? 'print-300' : 'ultra-600'
)

export const roundExportMultiplier = (value: number): number => {
  if (!Number.isFinite(value)) return 1
  return Number(Math.max(1, value).toFixed(3))
}

export const clampExportMinPositive = (value: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, parsed)
}

export const getRequestedMultiplier = (
  qualityPreset: ExportQualityPreset,
  width: number,
  height: number
): number => {
  if (qualityPreset !== 'ultra-600') return 1

  const safeWidth = clampExportMinPositive(width)
  const safeHeight = clampExportMinPositive(height)
  const maxSide = Math.max(safeWidth, safeHeight)

  if (maxSide <= 1400) return 4
  if (maxSide <= 2200) return 3
  if (maxSide <= 3000) return 2.5
  return 2
}

export const getSafeMultiplier = (
  width: number,
  height: number,
  requested: number
): number => {
  const safeWidth = clampExportMinPositive(width)
  const safeHeight = clampExportMinPositive(height)
  const sourceArea = safeWidth * safeHeight
  const requestedScale = clampExportMinPositive(requested)

  const maxByDimension = Math.min(
    EXPORT_MAX_CANVAS_DIMENSION / safeWidth,
    EXPORT_MAX_CANVAS_DIMENSION / safeHeight
  )
  const maxByArea = Math.sqrt(EXPORT_MAX_CANVAS_AREA / Math.max(1, sourceArea))
  const hardLimit = Math.max(1, Math.min(maxByDimension, maxByArea))

  return roundExportMultiplier(Math.min(requestedScale, hardLimit))
}

export const sanitizeExportFileToken = (value: string, fallback = 'arquivo'): string => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return token || fallback
}

export const formatExportTimestampToken = (date = new Date()): string => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}
