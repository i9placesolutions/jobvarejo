import { splitPriceParts } from './priceTagText'

export type RichPriceSegment = 'integer' | 'decimal'
export type RichPriceAxis = 'x' | 'y'
export type RichPriceTextStyle = Record<string, any>
export type RichPriceSegmentHorizontalBounds = {
  left: number
  right: number
  width: number
  center: number
}

export const PRICE_RICH_TEXT_NAME = 'price_value_text'

const RICH_PRICE_OFFSET_STYLE_KEYS = {
  x: '__priceRichOffsetX',
  y: '__priceRichOffsetY'
} as const
const RICH_PRICE_BOUNDARY_EPSILON = 0.0001
const RICH_PRICE_RENDER_PATCH_KEY = '__jobvarejoRichPriceRenderPatch'

export const PRICE_RICH_TEXT_OFFSET_PROPS = [
  '__priceRichIntegerOffsetX',
  '__priceRichIntegerOffsetY',
  '__priceRichDecimalOffsetX',
  '__priceRichDecimalOffsetY'
] as const

export const PRICE_RICH_TEXT_PROPS = [
  '__priceRichText',
  '__priceRichIntegerStyle',
  '__priceRichDecimalStyle',
  '__priceRichIntegerScale',
  '__priceRichDecimalScale',
  ...PRICE_RICH_TEXT_OFFSET_PROPS
] as const

const cloneStyle = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') return value
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value))
  } catch {
    if (Array.isArray(value)) return value.slice() as T
    return { ...(value as Record<string, unknown>) } as T
  }
}

const resolveFontFamily = (value: unknown, fallback = 'Inter'): string =>
  typeof value === 'string' && value.trim() ? value : fallback

const resolveFontStyle = (value: unknown, fallback = 'normal'): string =>
  typeof value === 'string' && value.trim() ? value : fallback

const resolveFontWeight = (value: unknown, fallback: string | number = '400'): string | number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

const normalizeTextStyle = (
  value: unknown,
  fallback: { fontFamily?: unknown; fontStyle?: unknown; fontWeight?: unknown } = {}
): RichPriceTextStyle => {
  const next = value && typeof value === 'object' && !Array.isArray(value)
    ? cloneStyle(value as RichPriceTextStyle)
    : {}
  const fallbackFontFamily = resolveFontFamily(fallback.fontFamily)
  const fallbackFontStyle = resolveFontStyle(fallback.fontStyle)
  const fallbackFontWeight = resolveFontWeight(fallback.fontWeight)

  if ('fontFamily' in next) next.fontFamily = resolveFontFamily(next.fontFamily, fallbackFontFamily)
  if ('fontStyle' in next) next.fontStyle = resolveFontStyle(next.fontStyle, fallbackFontStyle)
  if ('fontWeight' in next) next.fontWeight = resolveFontWeight(next.fontWeight, fallbackFontWeight)
  return next
}

const getOffsetProp = (segment: RichPriceSegment, axis: RichPriceAxis): string => {
  const segmentName = segment === 'integer' ? 'Integer' : 'Decimal'
  const axisName = axis === 'x' ? 'X' : 'Y'
  return `__priceRich${segmentName}Offset${axisName}`
}

const getOffsetStyleKey = (axis: RichPriceAxis): string => RICH_PRICE_OFFSET_STYLE_KEYS[axis]

const getFiniteNumber = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const stripBoundaryMarker = (style: RichPriceTextStyle): RichPriceTextStyle => {
  if (style.__priceRichBoundaryMarker !== true) return style
  const deltaY = getFiniteNumber(style.deltaY)
  if (deltaY !== null) style.deltaY = deltaY - RICH_PRICE_BOUNDARY_EPSILON
  delete style.__priceRichBoundaryMarker
  return style
}

const getStyleAt = (object: any, index: number): RichPriceTextStyle => {
  const lineStyles = object?.styles?.[0]
  if (!lineStyles || typeof lineStyles !== 'object') return {}
  return stripBoundaryMarker(normalizeTextStyle(lineStyles[index] || {}, object))
}

const getTextParts = (text: unknown) => {
  const value = String(text ?? '')
  const commaIndex = value.indexOf(',')
  if (commaIndex < 0) {
    return {
      value,
      integerStart: 0,
      integerEnd: value.length,
      decimalStart: value.length,
      decimalEnd: value.length
    }
  }

  return {
    value,
    integerStart: 0,
    integerEnd: commaIndex,
    decimalStart: commaIndex,
    decimalEnd: value.length
  }
}

const getStoredStyle = (object: any, segment: RichPriceSegment): RichPriceTextStyle => {
  const key = segment === 'integer' ? '__priceRichIntegerStyle' : '__priceRichDecimalStyle'
  const stored = object?.[key]
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return normalizeTextStyle(stored, object)
  }

  const parts = getTextParts(object?.text)
  const index = segment === 'integer'
    ? parts.integerStart
    : Math.min(parts.decimalStart, Math.max(0, parts.value.length - 1))
  return getStyleAt(object, index)
}

const resolveSegmentOffset = (
  object: any,
  segment: RichPriceSegment,
  axis: RichPriceAxis,
  style?: RichPriceTextStyle
): number => {
  const objectValue = getFiniteNumber(object?.[getOffsetProp(segment, axis)])
  if (objectValue !== null) return objectValue
  const styleValue = getFiniteNumber(style?.[getOffsetStyleKey(axis)])
  return styleValue ?? 0
}

const applySegmentOffsetsToStyle = (
  object: any,
  segment: RichPriceSegment,
  style: RichPriceTextStyle
): RichPriceTextStyle => {
  const next = cloneStyle(style)
  next[getOffsetStyleKey('x')] = resolveSegmentOffset(object, segment, 'x', next)
  next[getOffsetStyleKey('y')] = resolveSegmentOffset(object, segment, 'y', next)
  return next
}

const resolveScale = (object: any, segment: RichPriceSegment, style: RichPriceTextStyle): number => {
  const key = segment === 'integer' ? '__priceRichIntegerScale' : '__priceRichDecimalScale'
  const stored = Number(object?.[key])
  if (Number.isFinite(stored) && stored > 0) return stored

  const objectFontSize = Number(object?.fontSize)
  const segmentFontSize = Number(style?.fontSize)
  if (Number.isFinite(objectFontSize) && objectFontSize > 0 && Number.isFinite(segmentFontSize) && segmentFontSize > 0) {
    return segmentFontSize / objectFontSize
  }
  return segment === 'integer' ? 1 : 0.55
}

const setLineStyle = (styles: Record<string, any>, index: number, style: RichPriceTextStyle) => {
  if (index < 0) return
  styles[0] ||= {}
  styles[0][index] = cloneStyle(style)
}

export const isRichPriceTextObject = (object: any): boolean =>
  !!object && (
    object.__priceRichText === true ||
    (
      object.name === PRICE_RICH_TEXT_NAME &&
      object.__priceRichText !== false &&
      !!object.__priceRichIntegerStyle &&
      !!object.__priceRichDecimalStyle
    )
  )

export const getRichPriceSegmentStyle = (
  object: any,
  segment: RichPriceSegment
): RichPriceTextStyle => applySegmentOffsetsToStyle(object, segment, getStoredStyle(object, segment))

export const getRichPriceSegmentOffset = (
  object: any,
  segment: RichPriceSegment,
  axis: RichPriceAxis
): number => resolveSegmentOffset(object, segment, axis, getStoredStyle(object, segment))

export const getRichPriceSegmentFontSize = (
  object: any,
  segment: RichPriceSegment,
  fallback: number
): number => {
  const style = getRichPriceSegmentStyle(object, segment)
  const value = Number(style?.fontSize)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const buildRichPriceStyles = (
  text: string,
  integerStyle: RichPriceTextStyle,
  decimalStyle: RichPriceTextStyle
): Record<string, Record<string, RichPriceTextStyle>> => {
  const parts = getTextParts(text)
  const styles: Record<string, Record<string, RichPriceTextStyle>> = { 0: {} }
  const makeRenderedStyle = (style: RichPriceTextStyle, segment: RichPriceSegment) => {
    const next = normalizeTextStyle(style)
    if (segment === 'decimal') {
      const deltaY = getFiniteNumber(next.deltaY) ?? 0
      // Fabric groups adjacent characters using a small set of native style
      // fields. Keep an invisible deltaY distinction so custom X offsets are
      // also honored when both segments otherwise share identical typography.
      next.deltaY = deltaY + RICH_PRICE_BOUNDARY_EPSILON
      next.__priceRichBoundaryMarker = true
    }
    return next
  }

  for (let index = parts.integerStart; index < parts.integerEnd; index++) {
    setLineStyle(styles, index, makeRenderedStyle(integerStyle, 'integer'))
  }
  for (let index = parts.decimalStart; index < parts.decimalEnd; index++) {
    setLineStyle(styles, index, makeRenderedStyle(decimalStyle, 'decimal'))
  }

  return styles
}

export const applyRichPriceTextValue = (object: any, rawPrice: unknown): string | null => {
  if (!object || typeof object !== 'object') return null

  const parts = splitPriceParts(rawPrice)
  const text = `${parts.integer},${parts.dec}`
  const integerStyle = getRichPriceSegmentStyle(object, 'integer')
  const decimalStyle = getRichPriceSegmentStyle(object, 'decimal')
  const integerScale = resolveScale(object, 'integer', integerStyle)
  const decimalScale = resolveScale(object, 'decimal', decimalStyle)

  object.__priceRichText = true
  object.name ||= PRICE_RICH_TEXT_NAME
  object.__priceRichIntegerStyle = cloneStyle(integerStyle)
  object.__priceRichDecimalStyle = cloneStyle(decimalStyle)
  object.__priceRichIntegerOffsetX = resolveSegmentOffset(object, 'integer', 'x', integerStyle)
  object.__priceRichIntegerOffsetY = resolveSegmentOffset(object, 'integer', 'y', integerStyle)
  object.__priceRichDecimalOffsetX = resolveSegmentOffset(object, 'decimal', 'x', decimalStyle)
  object.__priceRichDecimalOffsetY = resolveSegmentOffset(object, 'decimal', 'y', decimalStyle)
  object.__priceRichIntegerScale = integerScale
  object.__priceRichDecimalScale = decimalScale
  object.text = text
  object.styles = buildRichPriceStyles(text, integerStyle, decimalStyle)
  object.initDimensions?.()
  object.setCoords?.()
  return text
}

export const setRichPriceSegmentStyle = (
  object: any,
  segment: RichPriceSegment,
  patch: RichPriceTextStyle
): boolean => {
  if (!isRichPriceTextObject(object)) return false

  const current = getRichPriceSegmentStyle(object, segment)
  const next = { ...current, ...cloneStyle(patch) }
  const key = segment === 'integer' ? '__priceRichIntegerStyle' : '__priceRichDecimalStyle'
  object[key] = next

  ;(['x', 'y'] as const).forEach((axis) => {
    const styleKey = getOffsetStyleKey(axis)
    const value = getFiniteNumber(next[styleKey])
    if (value !== null) object[getOffsetProp(segment, axis)] = value
  })

  const fontSize = Number(next.fontSize)
  const objectFontSize = Number(object.fontSize)
  const scaleKey = segment === 'integer' ? '__priceRichIntegerScale' : '__priceRichDecimalScale'
  if (Number.isFinite(fontSize) && fontSize > 0 && Number.isFinite(objectFontSize) && objectFontSize > 0) {
    object[scaleKey] = fontSize / objectFontSize
  }

  object.__priceRichText = true
  object.styles = buildRichPriceStyles(String(object.text || ''),
    getRichPriceSegmentStyle(object, 'integer'),
    getRichPriceSegmentStyle(object, 'decimal'))
  object.initDimensions?.()
  object.setCoords?.()
  return true
}

export const setRichPriceSegmentOffset = (
  object: any,
  segment: RichPriceSegment,
  axis: RichPriceAxis,
  rawValue: unknown
): boolean => {
  if (!isRichPriceTextObject(object)) return false
  const value = getFiniteNumber(rawValue)
  if (value === null) return false

  const objectKey = getOffsetProp(segment, axis)
  const styleKey = getOffsetStyleKey(axis)
  const styleKeyName = segment === 'integer' ? '__priceRichIntegerStyle' : '__priceRichDecimalStyle'
  const style = getRichPriceSegmentStyle(object, segment)
  style[styleKey] = value
  object[objectKey] = value
  object[styleKeyName] = style
  object.styles = buildRichPriceStyles(
    String(object.text || ''),
    getRichPriceSegmentStyle(object, 'integer'),
    getRichPriceSegmentStyle(object, 'decimal')
  )
  object.initDimensions?.()
  object.setCoords?.()
  object.dirty = true
  return true
}

export const setRichPriceBaseFontSize = (object: any, fontSize: number): boolean => {
  if (!isRichPriceTextObject(object)) return false
  const nextFontSize = Number(fontSize)
  if (!Number.isFinite(nextFontSize) || nextFontSize <= 0) return false

  const integerStyle = getRichPriceSegmentStyle(object, 'integer')
  const decimalStyle = getRichPriceSegmentStyle(object, 'decimal')
  const integerScale = resolveScale(object, 'integer', integerStyle)
  const decimalScale = resolveScale(object, 'decimal', decimalStyle)

  object.set?.('fontSize', nextFontSize)
  object.__priceRichIntegerScale = integerScale
  object.__priceRichDecimalScale = decimalScale
  object.__priceRichIntegerStyle = { ...integerStyle, fontSize: nextFontSize * integerScale }
  object.__priceRichDecimalStyle = { ...decimalStyle, fontSize: nextFontSize * decimalScale }
  object.styles = buildRichPriceStyles(String(object.text || ''), object.__priceRichIntegerStyle, object.__priceRichDecimalStyle)
  object.initDimensions?.()
  object.setCoords?.()
  return true
}

export const createRichPriceTextDefinition = (options: {
  text?: string
  fontSize: number
  integerStyle?: RichPriceTextStyle
  decimalStyle?: RichPriceTextStyle
  integerOffsetX?: number
  integerOffsetY?: number
  decimalOffsetX?: number
  decimalOffsetY?: number
}): Record<string, any> => {
  const fontSize = Number.isFinite(Number(options.fontSize)) && Number(options.fontSize) > 0
    ? Number(options.fontSize)
    : 48
  const integerStyle: RichPriceTextStyle = {
    fontSize,
    ...(options.integerStyle || {}),
    __priceRichOffsetX: getFiniteNumber(options.integerOffsetX) ?? getFiniteNumber(options.integerStyle?.__priceRichOffsetX) ?? 0,
    __priceRichOffsetY: getFiniteNumber(options.integerOffsetY) ?? getFiniteNumber(options.integerStyle?.__priceRichOffsetY) ?? 0
  }
  const decimalStyle: RichPriceTextStyle = {
    fontSize: fontSize * 0.55,
    ...(options.decimalStyle || {}),
    __priceRichOffsetX: getFiniteNumber(options.decimalOffsetX) ?? getFiniteNumber(options.decimalStyle?.__priceRichOffsetX) ?? 0,
    __priceRichOffsetY: getFiniteNumber(options.decimalOffsetY) ?? getFiniteNumber(options.decimalStyle?.__priceRichOffsetY) ?? 0
  }
  const text = String(options.text || '10,99')

  return {
    type: 'i-text',
    version: '7.1.0',
    text,
    styles: buildRichPriceStyles(text, integerStyle, decimalStyle),
    fontSize,
    fontFamily: String(integerStyle.fontFamily || 'Inter'),
    fontWeight: integerStyle.fontWeight || '900',
    fill: integerStyle.fill || '#ffffff',
    originX: 'left',
    originY: 'center',
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    visible: true,
    selectable: true,
    evented: true,
    name: PRICE_RICH_TEXT_NAME,
    __priceRichText: true,
    __priceRichIntegerStyle: integerStyle,
    __priceRichDecimalStyle: decimalStyle,
    __priceRichIntegerOffsetX: integerStyle.__priceRichOffsetX,
    __priceRichIntegerOffsetY: integerStyle.__priceRichOffsetY,
    __priceRichDecimalOffsetX: decimalStyle.__priceRichOffsetX,
    __priceRichDecimalOffsetY: decimalStyle.__priceRichOffsetY,
    __priceRichIntegerScale: Number(integerStyle.fontSize) / fontSize,
    __priceRichDecimalScale: Number(decimalStyle.fontSize) / fontSize
  }
}

const getObjectWidth = (object: any): number => {
  const measured = Number(object?.getScaledWidth?.())
  if (Number.isFinite(measured) && measured > 0) return measured
  return Math.abs(Number(object?.width || 0) * (Number(object?.scaleX ?? 1) || 1))
}

const getObjectHeight = (object: any): number => {
  const measured = Number(object?.getScaledHeight?.())
  if (Number.isFinite(measured) && measured > 0) return measured
  return Math.abs(Number(object?.height || 0) * (Number(object?.scaleY ?? 1) || 1))
}

const getObjectHorizontalBounds = (object: any) => {
  const width = getObjectWidth(object)
  if (!width) return null
  const x = Number(object?.left || 0)
  const origin = String(object?.originX || 'left')
  if (origin === 'center') return { left: x - (width / 2), right: x + (width / 2) }
  if (origin === 'right') return { left: x - width, right: x }
  return { left: x, right: x + width }
}

/**
 * Returns the rendered horizontal bounds of a rich-price segment.
 * Fabric stores character bounds in the text object's local coordinate space;
 * converting them here keeps unit placement consistent across layouts.
 */
export const getRichPriceSegmentHorizontalBounds = (
  object: any,
  segment: RichPriceSegment
): RichPriceSegmentHorizontalBounds | null => {
  if (!isRichPriceTextObject(object)) return null

  const parts = getTextParts(object.text)
  const start = segment === 'integer' ? parts.integerStart : parts.decimalStart
  const end = segment === 'integer' ? parts.integerEnd : parts.decimalEnd
  if (end <= start) return null

  object.initDimensions?.()
  const lineBounds = object?.__charBounds?.[0]
  if (!Array.isArray(lineBounds)) return null

  const segmentBounds = lineBounds
    .slice(start, end)
    .map((item: any) => {
      const left = Number(item?.left)
      const width = Number(item?.width)
      if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return null
      return { left, right: left + width }
    })
    .filter(Boolean) as Array<{ left: number; right: number }>
  if (!segmentBounds.length) return null

  const objectBounds = getObjectHorizontalBounds(object)
  if (!objectBounds) return null

  const localLeft = Math.min(...segmentBounds.map((bounds) => bounds.left))
  const localRight = Math.max(...segmentBounds.map((bounds) => bounds.right))
  const scaleX = Math.abs(Number(object.scaleX ?? 1)) || 1
  const offsetX = getRichPriceSegmentOffset(object, segment, 'x')
  const left = objectBounds.left + ((localLeft + offsetX) * scaleX)
  const right = objectBounds.left + ((localRight + offsetX) * scaleX)
  return {
    left,
    right,
    width: Math.max(0, right - left),
    center: (left + right) / 2
  }
}

/**
 * Places a separate unit label below the decimal segment of a rich price.
 * It mirrors `layoutPrice` for legacy split text while preserving the unit's
 * vertical anchor supplied by the calling template.
 */
export const positionRichPriceUnit = (richPrice: any, unit: any, top: number): boolean => {
  if (!richPrice || !unit || unit.visible === false || !String(unit.text || '').trim()) return false

  const decimalBounds = getRichPriceSegmentHorizontalBounds(richPrice, 'decimal')
  if (!decimalBounds || decimalBounds.width <= 0) return false

  const unitWidth = getObjectWidth(unit)
  if (unitWidth > decimalBounds.width && unitWidth > 0) {
    const scale = decimalBounds.width / unitWidth
    unit.set?.({ scaleX: scale, scaleY: scale })
  } else {
    unit.set?.({ scaleX: 1, scaleY: 1 })
  }
  unit.set?.({
    originX: 'center',
    originY: 'center',
    left: decimalBounds.center,
    top
  })
  unit.initDimensions?.()
  unit.setCoords?.()
  return true
}

const getObjectVerticalCenter = (object: any): number => {
  const height = getObjectHeight(object)
  const y = Number(object?.top || 0)
  const origin = String(object?.originY || 'top')
  if (origin === 'center') return y
  if (origin === 'bottom') return y - (height / 2)
  return y + (height / 2)
}

const pickTextStyle = (
  object: any,
  fontSizeOverride?: number,
  fallback: { fontFamily?: unknown; fontStyle?: unknown; fontWeight?: unknown } = {}
): RichPriceTextStyle => {
  const style: RichPriceTextStyle = {}
  ;[
    'fill',
    'stroke',
    'strokeWidth',
    'fontFamily',
    'fontWeight',
    'fontStyle',
    'underline',
    'linethrough',
    'overline',
    'textBackgroundColor',
    'shadow'
  ].forEach((key) => {
    if (object?.[key] !== undefined) style[key] = cloneStyle(object[key])
  })
  const fontSize = getFiniteNumber(fontSizeOverride) ?? getFiniteNumber(object?.fontSize)
  if (fontSize !== null && fontSize > 0) style.fontSize = fontSize
  return normalizeTextStyle(style, {
    fontFamily: fallback.fontFamily ?? object?.fontFamily,
    fontStyle: fallback.fontStyle ?? object?.fontStyle,
    fontWeight: fallback.fontWeight ?? object?.fontWeight
  })
}

export const createRichPriceTextFromSplit = (
  fabricModule: any,
  integerObject: any,
  decimalObject: any,
  name = PRICE_RICH_TEXT_NAME
): any | null => {
  const RichTextClass = fabricModule?.IText || fabricModule?.Text || fabricModule?.FabricText
  if (!RichTextClass || !integerObject || !decimalObject) return null

  integerObject.initDimensions?.()
  decimalObject.initDimensions?.()

  const integerBounds = getObjectHorizontalBounds(integerObject)
  const decimalBounds = getObjectHorizontalBounds(decimalObject)
  const integerWidth = getObjectWidth(integerObject)
  const integerScaleX = Math.abs(Number(integerObject?.scaleX ?? 1)) || 1
  const integerScaleY = Math.abs(Number(integerObject?.scaleY ?? 1)) || 1
  const decimalScaleY = Math.abs(Number(decimalObject?.scaleY ?? 1)) || 1
  const baseLeft = integerBounds?.left ?? Number(integerObject?.left || 0)
  const baseTop = getObjectVerticalCenter(integerObject)
  const text = `${String(integerObject?.text || '0')}${String(decimalObject?.text || ',00')}`
  const integerFontSize = getFiniteNumber(integerObject?.fontSize) ?? 48
  const decimalFontSize = (getFiniteNumber(decimalObject?.fontSize) ?? (integerFontSize * 0.55)) * (decimalScaleY / integerScaleY)
  const integerFontFamily = resolveFontFamily(integerObject?.fontFamily)
  const integerFontStyle = resolveFontStyle(integerObject?.fontStyle)
  const integerFontWeight = resolveFontWeight(integerObject?.fontWeight, '900')
  const integerStyle = pickTextStyle(integerObject, integerFontSize, {
    fontFamily: integerFontFamily,
    fontStyle: integerFontStyle,
    fontWeight: integerFontWeight
  })
  const decimalStyle = pickTextStyle(decimalObject, decimalFontSize, {
    fontFamily: resolveFontFamily(decimalObject?.fontFamily, integerFontFamily),
    fontStyle: resolveFontStyle(decimalObject?.fontStyle, integerFontStyle),
    fontWeight: resolveFontWeight(decimalObject?.fontWeight, integerFontWeight)
  })
  const rich = new RichTextClass(text, {
    fill: integerObject?.fill,
    stroke: integerObject?.stroke,
    strokeWidth: integerObject?.strokeWidth,
    fontFamily: integerFontFamily,
    fontWeight: integerFontWeight,
    fontStyle: integerFontStyle,
    underline: integerObject?.underline,
    linethrough: integerObject?.linethrough,
    overline: integerObject?.overline,
    shadow: cloneStyle(integerObject?.shadow),
    charSpacing: integerObject?.charSpacing || 0,
    originX: 'left',
    originY: 'center',
    left: baseLeft,
    top: baseTop,
    scaleX: integerScaleX,
    scaleY: integerScaleY,
    visible: integerObject?.visible !== false,
    selectable: integerObject?.selectable !== false,
    evented: integerObject?.evented !== false,
    name,
    __priceRichText: true,
    __priceRichIntegerStyle: integerStyle,
    __priceRichDecimalStyle: decimalStyle,
    __fontScale: integerObject?.__fontScale,
    __fontScaleBase: integerObject?.__fontScaleBase,
    __yOffsetRatio: integerObject?.__yOffsetRatio
  })

  ;[
    '__originalFontSize',
    '__originalScaleX',
    '__originalScaleY',
    '__visibleScaleX',
    '__visibleScaleY',
    '__fontSizeBase',
    '__fontScale',
    '__fontScaleBase',
    '__yOffsetRatio'
  ].forEach((key) => {
    if (integerObject?.[key] !== undefined) {
      const value = integerObject[key]
      rich[key] = value && typeof value === 'object' ? cloneStyle(value) : value
    }
  })

  applyRichPriceTextValue(rich, text)
  const richIntegerWidth = (() => {
    const bounds = rich?.__charBounds?.[0]
    if (Array.isArray(bounds) && bounds.length > 0) {
      const commaIndex = String(rich.text || '').indexOf(',')
      const chars = bounds.slice(0, commaIndex < 0 ? bounds.length - 1 : commaIndex)
      if (chars.length) {
        const left = Math.min(...chars.map((item: any) => Number(item?.left || 0)))
        const right = Math.max(...chars.map((item: any) => Number(item?.left || 0) + Number(item?.width || 0)))
        return Math.max(0, right - left)
      }
    }
    return integerWidth / integerScaleX
  })()
  const desiredDecimalLeft = decimalBounds?.left ?? (baseLeft + integerWidth)
  const decimalOffsetX = (desiredDecimalLeft - (baseLeft + (richIntegerWidth * integerScaleX))) / integerScaleX
  const decimalOffsetY = (getObjectVerticalCenter(decimalObject) - baseTop) / integerScaleY
  setRichPriceSegmentOffset(rich, 'integer', 'x', 0)
  setRichPriceSegmentOffset(rich, 'integer', 'y', 0)
  setRichPriceSegmentOffset(rich, 'decimal', 'x', decimalOffsetX)
  setRichPriceSegmentOffset(rich, 'decimal', 'y', decimalOffsetY)
  rich.setCoords?.()
  return rich
}

const getDirectChildren = (parent: any): any[] => {
  if (!parent) return []
  if (Array.isArray(parent?._objects)) return parent._objects
  return typeof parent?.getObjects === 'function' ? (parent.getObjects() || []) : []
}

const findDirectChildByNames = (children: any[], names: string[]): any | null => {
  for (const name of names) {
    const found = children.find((child: any) => String(child?.name || '') === name)
    if (found) return found
  }
  return null
}

const replaceSplitPair = (
  parent: any,
  fabricModule: any,
  integer: any,
  decimal: any,
  richName: string
): any | null => {
  const rich = createRichPriceTextFromSplit(fabricModule, integer, decimal, richName)
  if (!rich) return null
  const children = getDirectChildren(parent)
  const index = Math.max(0, Math.min(children.indexOf(integer), children.indexOf(decimal)))
  parent.remove?.(integer, decimal)
  if (typeof parent.insertAt === 'function') parent.insertAt(index, rich)
  else parent.add?.(rich)
  parent.triggerLayout?.()
  parent.setCoords?.()
  parent.dirty = true
  return rich
}

const normalizeExistingRichText = (object: any, name?: string): any => {
  if (!object) return object
  if (name) object.name = name
  if (!isRichPriceTextObject(object)) {
    object.__priceRichText = true
    applyRichPriceTextValue(object, object.text)
  } else {
    applyRichPriceTextValue(object, object.text)
  }
  return object
}

export const migratePriceGroupToRichText = (
  priceGroup: any,
  fabricModule: any
): { changed: boolean; richObjects: any[] } => {
  if (!priceGroup || typeof priceGroup !== 'object') return { changed: false, richObjects: [] }
  let changed = false
  const richObjects: any[] = []
  const visited = new Set<any>()

  const visit = (parent: any) => {
    if (!parent || visited.has(parent)) return
    visited.add(parent)
    const children = getDirectChildren(parent).slice()
    const migratePair = (integerNames: string[], decimalNames: string[], richName: string) => {
      const integer = findDirectChildByNames(children, integerNames)
      const decimal = findDirectChildByNames(children, decimalNames)
      const existing = findDirectChildByNames(children, [richName])
      if (existing) {
        normalizeExistingRichText(existing, richName)
        richObjects.push(existing)
        if (integer && integer !== existing) parent.remove?.(integer)
        if (decimal && decimal !== existing) parent.remove?.(decimal)
        if (integer || decimal) changed = true
        return
      }
      if (integer && decimal) {
        const rich = replaceSplitPair(parent, fabricModule, integer, decimal, richName)
        if (rich) {
          richObjects.push(rich)
          changed = true
        }
      }
    }

    migratePair(
      ['price_integer_text', 'priceInteger', 'price_integer'],
      ['price_decimal_text', 'priceDecimal', 'price_decimal'],
      PRICE_RICH_TEXT_NAME
    )
    migratePair(['retail_integer_text'], ['retail_decimal_text'], 'retail_price_text')
    migratePair(['wholesale_integer_text'], ['wholesale_decimal_text'], 'wholesale_price_text')

    const refreshedChildren = getDirectChildren(parent)
    ;[
      [PRICE_RICH_TEXT_NAME, PRICE_RICH_TEXT_NAME],
      ['smart_price', PRICE_RICH_TEXT_NAME],
      ['retail_price_text', 'retail_price_text'],
      ['wholesale_price_text', 'wholesale_price_text']
    ].forEach(([sourceName, targetName]) => {
      const object = refreshedChildren.find((child: any) => String(child?.name || '') === sourceName)
      if (!object) return
      normalizeExistingRichText(object, targetName)
      if (!richObjects.includes(object)) richObjects.push(object)
    })

    refreshedChildren.forEach((child: any) => {
      if (child && typeof child === 'object' && typeof child.getObjects === 'function') visit(child)
    })
  }

  visit(priceGroup)
  if (changed) {
    priceGroup.triggerLayout?.()
    priceGroup.setCoords?.()
    priceGroup.dirty = true
  }
  return { changed, richObjects }
}

export const installRichPriceTextRenderer = (fabricModule: any): boolean => {
  const TextClass = fabricModule?.Text || fabricModule?.FabricText || fabricModule?.IText
  const prototype = TextClass?.prototype
  const originalRenderChar = prototype?._renderChar
  if (!prototype || typeof originalRenderChar !== 'function') return false
  if (prototype[RICH_PRICE_RENDER_PATCH_KEY]) return true

  prototype._renderChar = function (...args: any[]) {
    if (this?.__priceRichText === true) {
      const lineIndex = Number(args[2]) || 0
      const charIndex = Number(args[3]) || 0
      const style = this?._getStyleDeclaration?.(lineIndex, charIndex) || {}
      const offsetX = getFiniteNumber(style?.[RICH_PRICE_OFFSET_STYLE_KEYS.x])
      const offsetY = getFiniteNumber(style?.[RICH_PRICE_OFFSET_STYLE_KEYS.y])
      if (offsetX !== null) args[5] = Number(args[5] || 0) + offsetX
      if (offsetY !== null) args[6] = Number(args[6] || 0) + offsetY
    }
    return originalRenderChar.apply(this, args)
  }
  prototype[RICH_PRICE_RENDER_PATCH_KEY] = true
  return true
}
