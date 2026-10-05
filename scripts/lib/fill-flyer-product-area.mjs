const finite = value => Number.isFinite(Number(value)) ? Number(value) : null
const positiveScale = value => {
  const parsed = finite(value)
  return parsed != null && parsed > 0 ? parsed : null
}
const originFactor = (origin, start, middle, end) => {
  const value = String(origin || start).toLowerCase()
  if (value === middle) return 0.5
  if (value === end) return 1
  return 0
}

function bounds(object) {
  const left = finite(object?.left)
  const top = finite(object?.top)
  const width = finite(object?.width)
  const height = finite(object?.height)
  const scaleX = positiveScale(object?.scaleX ?? 1)
  const scaleY = positiveScale(object?.scaleY ?? 1)
  if ([left, top, width, height, scaleX, scaleY].some(value => value == null)) return null
  if (Math.abs(finite(object.angle) ?? 0) > 0.000001) return null
  const renderedWidth = width * scaleX
  const renderedHeight = height * scaleY
  const x = left - renderedWidth * originFactor(object.originX, 'left', 'center', 'right')
  const y = top - renderedHeight * originFactor(object.originY, 'top', 'center', 'bottom')
  return { left: x, top: y, right: x + renderedWidth, bottom: y + renderedHeight, width: renderedWidth, height: renderedHeight, scaleX, scaleY }
}

function setVerticalBounds(object, top, bottom, preserveIntrinsicHeight = false) {
  const geometry = bounds(object)
  if (!geometry || !(bottom > top)) return false
  const origin = String(object.originY || 'top').toLowerCase()
  const preserveShape = preserveIntrinsicHeight && String(object.type || '').toLowerCase() !== 'rect'
  if (preserveShape) {
    const intrinsicHeight = finite(object.height)
    if (!(intrinsicHeight > 0)) return false
    object.scaleY = (bottom - top) / intrinsicHeight
  } else {
    object.height = (bottom - top) / geometry.scaleY
  }
  object.top = top + (bottom - top) * originFactor(origin, 'top', 'center', 'bottom')
  return true
}

function isVisible(object) {
  return object?.visible !== false && finite(object?.opacity) !== 0
}

function isLargeBackground(object, frameBounds) {
  const name = String(object?.name || '').toLowerCase()
  const type = String(object?.type || '').toLowerCase()
  if (object?.businessProfileField || object?.quickLogoSlot || object?.quickDataField
      || /seal|selo|logo|instagram/.test(name)) return false
  if (/^product-section-surface$/.test(name)) return true
  const geometry = bounds(object)
  if (!geometry || !frameBounds) return false
  const frameArea = frameBounds.width * frameBounds.height
  const objectArea = geometry.width * geometry.height
  return ['image', 'rect', 'path'].includes(type)
    && objectArea >= frameArea * 0.14
    && geometry.width >= frameBounds.width * 0.55
    && (/background|bg|fundo|surface/.test(name) || (objectArea >= frameArea * 0.45 && geometry.width >= frameBounds.width * 0.72))
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function skip(canvas, reason) {
  return { canvas, changes: [], skipReason: reason }
}

/**
 * Pull an empty flyer product area toward its validity band while preserving
 * the existing footer position and foreground artwork.
 */
export function fillFlyerProductArea(source) {
  let canvas
  try {
    canvas = structuredClone(source)
  } catch {
    return { canvas: source, changes: [], skipReason: 'Fonte inválida para clonagem.' }
  }
  const objects = Array.isArray(canvas?.objects) ? canvas.objects : null
  if (!objects) return skip(canvas, 'Canvas sem lista de objetos Fabric.')

  const frames = objects.filter(object => object?.isFrame)
  const zones = objects.filter(object => object?.isProductZone)
  if (frames.length !== 1) return skip(canvas, 'É necessário haver exatamente um frame.')
  if (zones.length !== 1) return skip(canvas, 'Ajuste automático exige exatamente uma zona de produtos.')

  const frame = frames[0]
  const zone = zones[0]
  const frameBounds = bounds(frame)
  const zoneBounds = bounds(zone)
  if (!frameBounds) return skip(canvas, 'Frame rotacionado ou com geometria inválida.')
  if (!zoneBounds || zone.angle && Math.abs(Number(zone.angle)) > 0.000001) {
    return skip(canvas, 'Zona rotacionada ou com escala/geometria inválida.')
  }
  if (zoneBounds.width <= 0 || zoneBounds.height <= 0) return skip(canvas, 'Zona sem dimensões renderizadas positivas.')

  const band = objects.find(object => object?.name === 'retail-validity-visual-band' && isVisible(object))
  const fallbackBand = !band
    ? objects.find(object => object?.name === 'standard-validity-background' && isVisible(object))
    : null
  const panel = objects.find(object => object?.name === 'product-area-background')
  const bandBounds = bounds(band || fallbackBand)
  const panelBounds = bounds(panel)
  if (band && !bandBounds) return skip(canvas, 'Faixa retail-validity-visual-band tem geometria inválida.')
  if (!band && (!fallbackBand || !bandBounds)) return skip(canvas, 'Faixas de validade conhecidas não encontradas ou inválidas.')
  if (panel && !panelBounds) return skip(canvas, 'Fundo product-area-background com geometria inválida.')
  if (frameBounds.width / frameBounds.height > 1.5) return skip(canvas, 'Modelos horizontais estão fora do escopo deste ajuste.')
  if (!Array.isArray(zone.objects) || zone.objects.length !== 1 || String(zone.objects[0]?.type).toLowerCase() !== 'rect') {
    return skip(canvas, 'A zona precisa conter somente um retângulo interno.')
  }
  const innerRect = zone.objects[0]
  if (Math.abs(finite(innerRect.angle) ?? 0) > 0.000001
      || positiveScale(innerRect.scaleX ?? 1) == null
      || positiveScale(innerRect.scaleY ?? 1) == null) {
    return skip(canvas, 'O retângulo interno da zona tem geometria incompatível.')
  }

  const zoneId = String(zone._customId || '')
  const populated = objects.some(object => object !== zone && (
    object?.isProductCard
    || (object?.isSmartObject && object?.parentZoneId && (!zoneId || object.parentZoneId === zoneId))
    || object?.parentZoneId && (!zoneId || object.parentZoneId === zoneId) && object?.isProduct
  ))
  const snapshotCards = zone._zoneStateSnapshot?.cards
  if (populated || (Array.isArray(snapshotCards) && snapshotCards.length > 0)) {
    return skip(canvas, 'Zona ou snapshot contém produtos; ajuste automático aceita somente zonas vazias.')
  }

  const frameScale = frameBounds.width / 1080
  let validityBottom = bandBounds.bottom
  if (!band) {
    const visibleValidity = objects.filter(object => /validity/i.test(String(object?.name || '')) && isVisible(object))
      .map(object => bounds(object))
      .filter(geometry => geometry && geometry.bottom <= zoneBounds.top)
    if (!visibleValidity.length) return skip(canvas, 'Nenhuma faixa de validade visível termina acima da zona.')
    validityBottom = Math.max(...visibleValidity.map(geometry => geometry.bottom))
  }
  const targetTop = validityBottom + 8 * frameScale
  const currentGap = zoneBounds.top - validityBottom
  if (currentGap <= 16 * frameScale) return skip(canvas, 'O espaço acima da zona já está dentro do limite.')
  if (!(targetTop < zoneBounds.top && targetTop < zoneBounds.bottom)) {
    return skip(canvas, 'Não há altura suficiente para aproximar a zona da faixa de validade.')
  }

  const corridor = { left: zoneBounds.left, right: zoneBounds.right, top: targetTop, bottom: zoneBounds.top }
  for (const object of objects) {
    if (object === frame || object === zone || object === panel || !isVisible(object) || isLargeBackground(object, frameBounds)) continue
    const geometry = bounds(object)
    if (!geometry || !overlaps(geometry, corridor)) continue
    return skip(canvas, `Ajuste bloqueado por elemento visível no corredor: ${object.name || object.type || 'objeto sem nome'}.`)
  }

  const localWidth = finite(zone.width)
  if (localWidth == null || localWidth <= 0) return skip(canvas, 'Largura local da zona inválida.')
  const nextHeight = zoneBounds.bottom - targetTop
  const nextLocalHeight = nextHeight / zoneBounds.scaleY
  const panelInset = panelBounds ? zoneBounds.top - panelBounds.top : 0
  const nextPanelTop = panelBounds ? targetTop - panelInset : null
  if (panelBounds && !(nextPanelTop < panelBounds.bottom)) return skip(canvas, 'Painel de fundo sem altura disponível para expansão.')

  const oldZoneTop = zoneBounds.top
  if (!setVerticalBounds(zone, targetTop, zoneBounds.bottom)) return skip(canvas, 'Não foi possível atualizar a geometria da zona.')
  zone._zoneWidth = zoneBounds.width
  zone._zoneHeight = nextHeight
  Object.assign(innerRect, {
    originX: 'center', originY: 'center', left: 0, top: 0,
    width: localWidth, height: nextLocalHeight, scaleX: 1, scaleY: 1, angle: 0
  })

  if (zone._zoneStateSnapshot?.zone) {
    const snapshotZone = zone._zoneStateSnapshot.zone
    const geometry = snapshotZone.geometry || {}
    snapshotZone.geometry = {
      ...geometry,
      x: finite(zone.left) ?? 0,
      y: finite(zone.top) ?? 0,
      left: finite(zone.left) ?? 0,
      top: finite(zone.top) ?? 0,
      width: finite(zone.width) ?? 0,
      height: nextLocalHeight,
      scaleX: zoneBounds.scaleX,
      scaleY: zoneBounds.scaleY,
      angle: finite(zone.angle) ?? 0
    }
  }

  if (panelBounds && !setVerticalBounds(panel, nextPanelTop, panelBounds.bottom, true)) {
    return skip(canvas, 'Não foi possível ampliar o painel de fundo.')
  }

  const changes = [{ object: zone.name || zoneId || 'product-zone', top: oldZoneTop, nextTop: targetTop, bottom: zoneBounds.bottom }]
  if (panelBounds) changes.push({ object: panel.name || 'product-area-background', top: panelBounds.top, nextTop: nextPanelTop, bottom: panelBounds.bottom })
  return { canvas, changes }
}
