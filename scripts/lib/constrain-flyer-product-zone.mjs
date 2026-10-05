const EPSILON = 0.000001

const finite = value => value == null || typeof value === 'string' && value.trim() === ''
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null
const normalized = value => String(value || '').toLowerCase()
const factor = (origin, start, middle, end) => {
  const value = normalized(origin || start)
  if (value === middle) return 0.5
  if (value === end) return 1
  if (value === start) return 0
  return null
}

function geometry(object) {
  const left = finite(object?.left)
  const top = finite(object?.top)
  const width = finite(object?.width)
  const height = finite(object?.height)
  const scaleX = finite(object?.scaleX ?? 1)
  const scaleY = finite(object?.scaleY ?? 1)
  const originX = object?.originX || 'left'
  const originY = object?.originY || 'top'
  const xFactor = factor(originX, 'left', 'center', 'right')
  const yFactor = factor(originY, 'top', 'center', 'bottom')
  const angle = finite(object?.angle ?? 0)

  if ([left, top, width, height, scaleX, scaleY, xFactor, yFactor, angle].some(value => value == null)
      || width <= 0 || height <= 0 || scaleX <= 0 || scaleY <= 0 || Math.abs(angle) > EPSILON) return null

  const renderedWidth = width * scaleX
  const renderedHeight = height * scaleY
  return {
    left: left - renderedWidth * xFactor,
    top: top - renderedHeight * yFactor,
    right: left + renderedWidth * (1 - xFactor),
    bottom: top + renderedHeight * (1 - yFactor),
    width: renderedWidth,
    height: renderedHeight,
    localWidth: width,
    localHeight: height,
    scaleX,
    scaleY,
    xFactor,
    yFactor
  }
}

const skip = (canvas, reason) => ({ canvas, changes: [], skipped: true, idempotent: false, skipReason: reason })

function isBoundToZone(object, zoneId) {
  const direct = String(object?.parentZoneId || '').trim()
  const slot = String(object?._zoneSlot?.zoneId || '').trim()
  return direct === zoneId || slot === zoneId
}

function findInnerRect(zone) {
  if (normalized(zone?.type) === 'rect') return zone
  if (normalized(zone?.type) !== 'group' || !Array.isArray(zone?.objects)) return null
  const rects = zone.objects.filter(object => normalized(object?.type) === 'rect')
  return rects.length === 1 ? rects[0] : null
}

function setAnchor(object, box, width, height) {
  const xFactor = factor(object?.originX, 'left', 'center', 'right')
  const yFactor = factor(object?.originY, 'top', 'center', 'bottom')
  if (xFactor == null || yFactor == null) return false
  object.left = box.left + width * xFactor
  object.top = box.top + height * yFactor
  return true
}

/**
 * Contracts an empty Fabric product-zone canvas object to caller-provided safe bounds.
 * Bounds are explicit because raster artwork cannot reliably be inferred from canvas JSON.
 */
export function constrainFlyerProductZone(source, zoneId, safeBounds) {
  let canvas
  try {
    canvas = structuredClone(source)
  } catch {
    return skip(source, 'Fonte inválida para clonagem.')
  }

  if (!Array.isArray(canvas?.objects)) return skip(canvas, 'Canvas sem lista de objetos Fabric.')
  const id = String(zoneId || '').trim()
  if (!id) return skip(canvas, 'ID da zona obrigatório.')
  const zones = canvas.objects.filter(object => object?.isProductZone && String(object?._customId || '').trim() === id)
  if (zones.length !== 1) return skip(canvas, 'A zona indicada não foi encontrada de forma única.')
  const zone = zones[0]

  const left = finite(safeBounds?.left)
  const top = finite(safeBounds?.top)
  const width = finite(safeBounds?.width)
  const height = finite(safeBounds?.height)
  if ([left, top, width, height].some(value => value == null) || width <= 0 || height <= 0) {
    return skip(canvas, 'Limites seguros inválidos.')
  }

  const current = geometry(zone)
  if (!current) return skip(canvas, 'Zona rotacionada ou com geometria incompatível.')

  const snapshotCards = zone?._zoneStateSnapshot?.cards
  if (Array.isArray(snapshotCards) && snapshotCards.length > 0) return skip(canvas, 'Snapshot da zona contém cartões vinculados.')
  const zoneStatuses = [zone?.contentStatus, zone?._zoneStateSnapshot?.zone?.contentStatus]
    .map(status => String(status || '').trim().toLowerCase())
    .filter(Boolean)
  if (zoneStatuses.some(status => status !== 'empty')) return skip(canvas, 'Zona marcada como preenchida ou com conteúdo pendente.')
  const linkedCards = canvas.objects.filter(object => object !== zone && (
    (object?.isProductCard && (isBoundToZone(object, id) || (!object?.parentZoneId && !object?._zoneSlot?.zoneId)))
    || (object?.isSmartObject && isBoundToZone(object, id))
    || (object?.isProduct && isBoundToZone(object, id))
  ))
  if (linkedCards.length > 0) return skip(canvas, 'Há cartões ou produtos vinculados à zona.')

  const innerRect = findInnerRect(zone)
  const innerGeometry = innerRect && geometry(innerRect)
  if (!innerRect || !innerGeometry) return skip(canvas, 'Retângulo interno ausente, ambíguo ou inválido.')

  const safeRight = left + width
  const safeBottom = top + height
  const next = {
    left: Math.max(current.left, left),
    top: Math.max(current.top, top),
    right: Math.min(current.right, safeRight),
    bottom: Math.min(current.bottom, safeBottom)
  }
  next.width = next.right - next.left
  next.height = next.bottom - next.top
  if (!(next.width > 0 && next.height > 0)) return skip(canvas, 'A interseção com os limites seguros é vazia.')

  const noChange = Math.abs(next.left - current.left) <= EPSILON
    && Math.abs(next.top - current.top) <= EPSILON
    && Math.abs(next.width - current.width) <= EPSILON
    && Math.abs(next.height - current.height) <= EPSILON
  if (noChange) return { canvas, changes: [], skipped: false, idempotent: true }

  const nextLocalWidth = next.width / current.scaleX
  const nextLocalHeight = next.height / current.scaleY
  if (!(nextLocalWidth > 0 && nextLocalHeight > 0)) return skip(canvas, 'Dimensões locais resultantes inválidas.')

  const rectScaleX = finite(innerRect.scaleX ?? 1)
  const rectScaleY = finite(innerRect.scaleY ?? 1)
  const rectOriginX = factor(innerRect.originX, 'left', 'center', 'right')
  const rectOriginY = factor(innerRect.originY, 'top', 'center', 'bottom')
  if (!(rectScaleX > 0 && rectScaleY > 0) || rectOriginX == null || rectOriginY == null) {
    return skip(canvas, 'Retângulo interno tem escala ou origem incompatível.')
  }

  const zoneWidth = nextLocalWidth
  const zoneHeight = nextLocalHeight
  const rectWidth = zoneWidth / rectScaleX
  const rectHeight = zoneHeight / rectScaleY
  const rectLocalLeft = -zoneWidth / 2 + zoneWidth * rectOriginX
  const rectLocalTop = -zoneHeight / 2 + zoneHeight * rectOriginY
  const old = { left: current.left, top: current.top, width: current.width, height: current.height }

  zone.width = zoneWidth
  zone.height = zoneHeight
  if (!setAnchor(zone, next, next.width, next.height)) return skip(canvas, 'Origem da zona incompatível.')
  zone._zoneWidth = next.width
  zone._zoneHeight = next.height

  if (innerRect !== zone) {
    Object.assign(innerRect, {
      width: rectWidth,
      height: rectHeight,
      left: rectLocalLeft,
      top: rectLocalTop
    })
  }

  if (zone._zoneStateSnapshot?.zone) {
    const snapshot = zone._zoneStateSnapshot.zone
    const previous = snapshot.geometry || {}
    snapshot.geometry = {
      ...previous,
      x: finite(zone.left),
      y: finite(zone.top),
      left: finite(zone.left),
      top: finite(zone.top),
      width: zone.width,
      height: zone.height,
      scaleX: current.scaleX,
      scaleY: current.scaleY
    }
  }

  return {
    canvas,
    changes: [{ object: zone.name || id, before: old, after: next }],
    skipped: false,
    idempotent: false
  }
}
