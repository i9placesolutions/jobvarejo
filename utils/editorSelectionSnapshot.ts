export const isTextStyleObject = (obj: any): boolean => {
  const t = String(obj?.type || '').toLowerCase()
  return t === 'i-text' || t === 'textbox' || t === 'text'
}

export const TEXT_OBJECT_STYLE_PROPS = new Set<string>([
  'fill',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'underline',
  'linethrough',
  'textAlign',
  'lineHeight',
  'charSpacing',
  'textBackgroundColor',
  'stroke',
  'strokeWidth'
])

export const TEXT_SELECTION_STYLE_PROPS = new Set<string>([
  'fill',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'underline',
  'linethrough',
  'stroke',
  'strokeWidth'
])

export const getTextSelectionRange = (
  obj: any
): { start: number; end: number; length: number } | null => {
  if (!isTextStyleObject(obj)) return null
  const startRaw = Number(obj?.selectionStart)
  const endRaw = Number(obj?.selectionEnd)
  const textLength = String(obj?.text ?? '').length
  const start = Number.isFinite(startRaw) ? Math.max(0, Math.min(Math.floor(startRaw), textLength)) : 0
  const end = Number.isFinite(endRaw) ? Math.max(0, Math.min(Math.floor(endRaw), textLength)) : start
  if (end <= start) return null
  return { start, end, length: end - start }
}

export const getTextSelectionSnapshotMeta = (obj: any): Record<string, any> => {
  if (!isTextStyleObject(obj)) {
    return {
      __textSelectionActive: false,
      __textSelectionStart: null,
      __textSelectionEnd: null,
      __textFillValue: null,
      __textFillMixed: false,
      __textFontSizeValue: null,
      __textFontSizeMixed: false
    }
  }

  const range = getTextSelectionRange(obj)
  const resolveFill = (input: any, fallback: string): string => {
    if (typeof input === 'string' && input.trim().length > 0) return input.trim()
    if (input && typeof input === 'object') {
      const stops = Array.isArray((input as any).colorStops) ? (input as any).colorStops : []
      if (stops.length > 0) {
        const first = stops.find((stop: any) => Number(stop?.offset) === 0) || stops[0]
        const color = typeof first?.color === 'string' ? first.color.trim() : ''
        if (color) return color
      }
    }
    return fallback
  }

  const baseFill = resolveFill(obj?.fill, '#000000')
  const baseFontSize = Number(obj?.fontSize)
  const defaultFontSize = Number.isFinite(baseFontSize) && baseFontSize > 0 ? baseFontSize : 20

  const meta = {
    __textSelectionActive: !!range,
    __textSelectionStart: range?.start ?? null,
    __textSelectionEnd: range?.end ?? null,
    __textFillValue: baseFill,
    __textFillMixed: false,
    __textFontSizeValue: defaultFontSize,
    __textFontSizeMixed: false
  } as Record<string, any>

  if (!range || typeof obj?.getSelectionStyles !== 'function') return meta

  let styles: any[] = []
  try {
    styles = obj.getSelectionStyles(range.start, range.end, true) || []
  } catch {
    styles = []
  }
  if (!Array.isArray(styles) || styles.length === 0) return meta

  const normalizeFill = (input: any): string => resolveFill(input, baseFill)
  const normalizeFontSize = (input: any): number => {
    const n = Number(input)
    if (Number.isFinite(n) && n > 0) return n
    return defaultFontSize
  }

  const fills = styles.map((style: any) => normalizeFill(style?.fill))
  const fontSizes = styles.map((style: any) => normalizeFontSize(style?.fontSize))
  const firstFill = fills[0]
  const firstFontSize = fontSizes[0]

  meta.__textFillMixed = fills.some((value) => value !== firstFill)
  meta.__textFillValue = firstFill
  meta.__textFontSizeMixed = fontSizes.some((value) => value !== firstFontSize)
  meta.__textFontSizeValue = firstFontSize
  return meta
}

export const snapshotForPropertiesPanel = (obj: any, extra?: Record<string, any>) => {
  if (!obj) return obj
  const snap: any = { ...obj }
  snap.type = obj.type
  snap.name = obj.name
  snap.layerName = obj.layerName
  snap._customId = obj._customId
  snap.id = obj.id

  if (obj.isGridZone != null) snap.isGridZone = obj.isGridZone
  if (obj.isProductZone != null) snap.isProductZone = obj.isProductZone
  if (obj._zoneGlobalStyles != null) snap._zoneGlobalStyles = obj._zoneGlobalStyles
  if (obj._zonePadding != null) snap._zonePadding = obj._zonePadding
  if (obj._zoneWidth != null) snap._zoneWidth = obj._zoneWidth
  if (obj._zoneHeight != null) snap._zoneHeight = obj._zoneHeight
  if (obj.columns != null) snap.columns = obj.columns
  if (obj.rows != null) snap.rows = obj.rows
  if (obj.gapHorizontal != null) snap.gapHorizontal = obj.gapHorizontal
  if (obj.gapVertical != null) snap.gapVertical = obj.gapVertical
  if (obj.layoutDirection != null) snap.layoutDirection = obj.layoutDirection
  if (obj.cardAspectRatio != null) snap.cardAspectRatio = obj.cardAspectRatio
  if (obj.lastRowBehavior != null) snap.lastRowBehavior = obj.lastRowBehavior
  if (obj.verticalAlign != null) snap.verticalAlign = obj.verticalAlign
  if (obj.highlightCount != null) snap.highlightCount = obj.highlightCount
  if (obj.highlightPos != null) snap.highlightPos = obj.highlightPos
  if (obj.highlightHeight != null) snap.highlightHeight = obj.highlightHeight
  if (obj.backgroundColor != null) snap.backgroundColor = obj.backgroundColor

  if (obj.isSmartObject != null) snap.isSmartObject = obj.isSmartObject
  if (obj.isProductCard != null) snap.isProductCard = obj.isProductCard
  if (obj.parentZoneId != null) snap.parentZoneId = obj.parentZoneId

  if (obj.lockMovementX != null) snap.lockMovementX = obj.lockMovementX
  if (obj.lockMovementY != null) snap.lockMovementY = obj.lockMovementY
  if (obj.lockScalingX != null) snap.lockScalingX = obj.lockScalingX
  if (obj.lockScalingY != null) snap.lockScalingY = obj.lockScalingY
  if (obj.objectMaskEnabled != null) snap.objectMaskEnabled = obj.objectMaskEnabled

  if (obj._objects != null) snap._objects = obj._objects
  if (typeof obj.getObjects === 'function') snap.getObjects = () => obj.getObjects()

  Object.assign(snap, getTextSelectionSnapshotMeta(obj))

  if (!snap.isGridZone && !snap.isProductZone) {
    const looksLikeZone = obj.name === 'gridZone' || obj.name === 'productZoneContainer'
      || (typeof obj._zonePadding === 'number')
      || (typeof obj._zoneWidth === 'number' && typeof obj._zoneHeight === 'number')
      || (obj.type === 'group' && typeof obj.getObjects === 'function' && (() => {
        try {
          const rect = (obj.getObjects() || []).find((o: any) => (
            o?.type === 'rect' && Array.isArray(o.strokeDashArray)
          ))
          return !!rect
        } catch {
          return false
        }
      })())
    if (looksLikeZone) {
      snap.isGridZone = true
      obj.isGridZone = true
    }
  }

  return extra ? { ...snap, ...extra } : snap
}
