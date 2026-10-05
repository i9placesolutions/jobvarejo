type PointLike = { x?: unknown; y?: unknown } | null | undefined

export interface QuickLogoSlotCenter {
  centerX: number
  centerY: number
}

const finiteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const normalizeOrigin = (value: unknown): string => String(value || '').trim().toLowerCase()

const getRenderedDimension = (dimension: unknown, scale: unknown): number | null => {
  const size = finiteNumber(dimension)
  if (size === null || size < 0) return null

  const rawScale = finiteNumber(scale)
  const normalizedScale = rawScale === null ? 1 : Math.abs(rawScale)
  return size * normalizedScale
}

const centerFromSerializedGeometry = (sourceObject: any): QuickLogoSlotCenter | null => {
  const left = finiteNumber(sourceObject?.left)
  const top = finiteNumber(sourceObject?.top)
  const renderedWidth = getRenderedDimension(sourceObject?.width, sourceObject?.scaleX)
  const renderedHeight = getRenderedDimension(sourceObject?.height, sourceObject?.scaleY)
  if (left === null || top === null || renderedWidth === null || renderedHeight === null) return null

  const originX = normalizeOrigin(sourceObject?.originX)
  const originY = normalizeOrigin(sourceObject?.originY)
  if (!['left', 'center', 'right'].includes(originX) || !['top', 'center', 'bottom'].includes(originY)) return null

  let offsetX = originX === 'left' ? renderedWidth / 2 : originX === 'right' ? -renderedWidth / 2 : 0
  let offsetY = originY === 'top' ? renderedHeight / 2 : originY === 'bottom' ? -renderedHeight / 2 : 0

  const angle = finiteNumber(sourceObject?.angle)
  if (angle !== null && angle !== 0) {
    const radians = angle * Math.PI / 180
    const rotatedX = offsetX * Math.cos(radians) - offsetY * Math.sin(radians)
    const rotatedY = offsetX * Math.sin(radians) + offsetY * Math.cos(radians)
    offsetX = rotatedX
    offsetY = rotatedY
  }

  return { centerX: left + offsetX, centerY: top + offsetY }
}

/**
 * Resolves the center of a dynamic logo slot. Fabric instances provide the
 * authoritative transformed center; serialized JSON uses its origin and
 * rendered dimensions. Metadata and layout defaults remain the fallback for
 * placeholders, missing objects, and incomplete geometry.
 */
export const resolveQuickLogoSlotCenter = (
  sourceObject: any,
  storedCenterX: unknown,
  storedCenterY: unknown,
  defaultCenterX: number,
  defaultCenterY: number
): QuickLogoSlotCenter => {
  const isImage = normalizeOrigin(sourceObject?.type) === 'image'

  if (isImage && typeof sourceObject?.getCenterPoint === 'function') {
    try {
      const center = sourceObject.getCenterPoint() as PointLike
      const x = finiteNumber(center?.x)
      const y = finiteNumber(center?.y)
      if (x !== null && y !== null) return { centerX: x, centerY: y }
    } catch {
      // Serialized geometry and metadata still provide a safe fallback.
    }
  }

  if (isImage) {
    const serializedCenter = centerFromSerializedGeometry(sourceObject)
    if (serializedCenter) return serializedCenter
  }

  const metadataX = finiteNumber(storedCenterX)
  const metadataY = finiteNumber(storedCenterY)
  return {
    centerX: metadataX ?? defaultCenterX,
    centerY: metadataY ?? defaultCenterY
  }
}
