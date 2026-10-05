const number = (value, fallback = NaN) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = value => String(value || '').toLowerCase()
const image = object => text(object?.type) === 'image'

function bounds(object) {
  const width = number(object?.width) * Math.abs(number(object?.scaleX, 1))
  const height = number(object?.height) * Math.abs(number(object?.scaleY, 1))
  const left = number(object?.left), top = number(object?.top)
  if (![width, height, left, top].every(Number.isFinite) || Math.abs(number(object?.angle, 0)) > 0.000001) return null
  const ox = text(object.originX || 'left'), oy = text(object.originY || 'top')
  const x = left - width * (ox === 'center' ? .5 : ox === 'right' ? 1 : 0)
  const y = top - height * (oy === 'center' ? .5 : oy === 'bottom' ? 1 : 0)
  return { left: x, top: y, right: x + width, bottom: y + height, width, height }
}

function setImageFit(object, box, alpha) {
  const baseWidth = number(object.width), baseHeight = number(object.height)
  if (!(baseWidth > 0 && baseHeight > 0 && box.width > 0 && box.height > 0)) return false
  const crop = alpha || { x: 0, y: 0, width: 1, height: 1 }
  const alphaWidth = baseWidth * crop.width, alphaHeight = baseHeight * crop.height
  if (!(alphaWidth > 0 && alphaHeight > 0)) return false
  const scale = Math.min(box.width / alphaWidth, box.height / alphaHeight)
  const visibleWidth = alphaWidth * scale, visibleHeight = alphaHeight * scale
  const alphaLeft = box.left + (box.width - visibleWidth) / 2
  const alphaTop = box.top + (box.height - visibleHeight) / 2
  object.originX = 'left'; object.originY = 'top'
  object.scaleX = scale; object.scaleY = scale
  object.left = alphaLeft - baseWidth * crop.x * scale
  object.top = alphaTop - baseHeight * crop.y * scale
  return true
}

const same = (a, b) => Math.abs(a - b) < 0.01
const intersects = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const safeFit = (object, box) => {
  const b = bounds(object)
  return b && Math.min(box.width / b.width, box.height / b.height)
}

function frameBounds(frame) {
  return bounds(frame)
}

function assetAlpha(alphaAssets, object) {
  if (!alphaAssets) return null
  const keys = [object._customId, object.src, object.__originalSrc, object.name].filter(Boolean)
  let value
  for (const key of keys) {
    value = alphaAssets instanceof Map ? alphaAssets.get(key) : alphaAssets[key]
    if (value) break
  }
  if (!value) return null
  const x = number(value.x ?? value.left, 0), y = number(value.y ?? value.top, 0)
  const width = number(value.width, 1), height = number(value.height, 1)
  // Alpha bounds are normalized fractions of the image's native dimensions.
  if ([x, y, width, height].some(n => n < 0 || n > 1) || x + width > 1.000001 || y + height > 1.000001) return null
  return { x, y, width, height }
}

/**
 * Repairs only reliably identifiable standalone header seal/logo/Instagram geometry.
 * alphaAssets may map an image id/src/name to normalized {x,y,width,height} alpha bounds.
 */
export function repairFlyerHeaderGeometry(source, { alphaAssets } = {}) {
  let canvas
  try { canvas = structuredClone(source) } catch { return { canvas: source, changes: [], warnings: ['Fonte inválida para clonagem.'] } }
  const objects = Array.isArray(canvas?.objects) ? canvas.objects : null
  if (!objects) return { canvas, changes: [], warnings: ['Canvas sem lista de objetos Fabric.'] }

  const changes = [], warnings = []
  const zoneObjects = objects.filter(o => o?.isProductZone)
  if (zoneObjects.length > 1) warnings.push(`Múltiplas zonas de produtos (${zoneObjects.length}); geometrias das zonas preservadas.`)
  const frames = objects.filter(o => o?.isFrame)
  if (frames.length !== 1) return { canvas, changes, warnings: ['Ajuste geométrico exige exatamente um frame.'] }
  const frame = frames[0], f = frameBounds(frame)
  if (!f || !(f.width > 0 && f.height > 0)) return { canvas, changes, warnings: ['Frame com geometria inválida ou rotacionada.'] }
  const unit = f.width / 1080
  const zones = zoneObjects.map(bounds).filter(Boolean)
  const zoneLeft = zones.length ? Math.min(...zones.map(z => z.left)) : NaN
  const validity = objects.find(o => o?.name === 'retail-validity-visual-band' && o.visible !== false && number(o.opacity, 1) > 0)
    || objects.find(o => o?.name === 'standard-validity-background' && o.visible !== false && number(o.opacity, 1) > 0)
    || objects.find(o => o?.quickDataField === 'validity' || o?.businessProfileField === 'validity')
  const validityBox = validity ? bounds(validity) : null
  const logo = objects.find(o => image(o) && (o.quickLogoSlot || o.businessProfileField === 'logo' || /header-logo-slot/i.test(o.name || '')))
  const tv = f.width / f.height > 1.5
  const scaleNamed = object => number(object?.scaleX, 1) * number(object?.width) > 0

  // Standalone campaign seal. Ambiguous sets may include in-art/background marks.
  const seals = objects.filter(o => image(o) && o.visible !== false && number(o.opacity, 1) > 0 && (o.quickCampaignSeal || /selo|seal/i.test(o.name || '')))
  if (seals.length === 0) warnings.push('Selo separado não identificado; imagens de fundo foram preservadas.')
  if (seals.length > 1) warnings.push('Mais de um selo identificável; nenhum selo foi alterado por ambiguidade.')
  else if (seals.length === 1) {
    const seal = seals[0], b = bounds(seal)
    if (!b || !validityBox) warnings.push('Selo identificado, mas faltam geometrias confiáveis do selo ou da validade.')
    else {
      let box
      if (tv) {
        if (!Number.isFinite(zoneLeft)) warnings.push('Encarte TV sem zona confiável; área segura do selo ignorada.')
        box = { left: f.left + 8 * unit, top: f.top + 8 * unit,
          width: Math.max(0, zoneLeft - 12 * unit - (f.left + 8 * unit)),
          height: Math.max(0, Math.min(f.top + f.height * .48, validityBox.top - 12 * unit) - (f.top + 8 * unit)) }
      } else {
        const instagramPanel = objects.find(o => /header-instagram-panel/i.test(o?.name || '') && o.visible !== false)
        const logoLeft = bounds(instagramPanel)?.left ?? bounds(logo)?.left ?? (Number.isFinite(zoneLeft) ? zoneLeft : f.left + f.width * .55)
        box = { left: f.left + 8 * unit, top: f.top + 8 * unit,
          width: Math.max(0, logoLeft - 12 * unit - (f.left + 8 * unit)),
          height: Math.max(0, validityBox.top - 12 * unit - (f.top + 8 * unit)) }
      }
      const alpha = assetAlpha(alphaAssets, seal)
      const alphaBox = alpha ? { left: b.left + b.width * alpha.x, top: b.top + b.height * alpha.y,
        right: b.left + b.width * (alpha.x + alpha.width), bottom: b.top + b.height * (alpha.y + alpha.height) } : b
      const targetScale = Math.min(box.width / Math.max(1, seal.width * (alpha?.width || 1)), box.height / Math.max(1, seal.height * (alpha?.height || 1)))
      const outside = alphaBox.left < box.left - .01 || alphaBox.right > box.left + box.width + .01 || alphaBox.top < box.top - .01 || alphaBox.bottom > box.top + box.height + .01
      const currentScale = Math.min(Math.abs(number(seal.scaleX, 1)), Math.abs(number(seal.scaleY, 1)))
      const alreadyNearTarget = currentScale >= targetScale * .9
      if (box.width > 0 && box.height > 0 && (outside || !alreadyNearTarget)) {
        // Keep a nearly full-size mark intact; shrink only when it exceeds the safe box.
        if (outside || !alreadyNearTarget) {
          if (setImageFit(seal, box, alpha)) changes.push({ object: seal.name || seal._customId, fields: ['left', 'top', 'scaleX', 'scaleY', 'originX', 'originY'], reason: outside ? 'selo fora da área segura' : 'preenchimento proporcional do selo' })
        }
      }
      if (!(targetScale > 0)) warnings.push('Não foi possível calcular o encaixe proporcional do selo.')
    }
  }

  if (!logo) warnings.push('Logo de cabeçalho não identificada como imagem nativa.')
  else if (!validityBox) warnings.push('Logo identificada, mas não há banda de validade para validar a área do cabeçalho.')
  else {
    const panel = objects.find(o => /header-instagram-panel/i.test(o?.name || '') && o.visible !== false)
    let column
    if (tv) {
      if (!Number.isFinite(zoneLeft)) warnings.push('Encarte TV sem zona confiável; logo mantida sem ajuste de coluna.')
      const seal = seals.length === 1 ? bounds(seals[0]) : null
      const logoTop = Math.max(f.top + f.height * .52, seal ? seal.bottom + 12 * unit : f.top + f.height * .52)
      column = { left: f.left + 8 * unit, top: logoTop,
        width: Math.max(0, zoneLeft - 12 * unit - (f.left + 8 * unit)),
        height: Math.max(0, validityBox.top - 12 * unit - logoTop) }
    } else if (panel) {
      const p = bounds(panel)
      column = p && { left: p.left, top: f.top + 12 * unit, width: p.width, height: Math.max(0, p.top - 12 * unit - (f.top + 12 * unit)) }
    } else {
      const cover = objects.find(o => /^(reference-logo-cover|painel da logo|header-logo-card)$/i.test(text(o?.name)) && o.visible !== false)
      const c = cover && bounds(cover)
      if (c) column = { left: c.left + 8 * unit, top: c.top + 8 * unit, width: Math.max(0, c.width - 16 * unit), height: Math.max(0, c.height - 16 * unit) }
    }
    if (!column || !(column.width > 0 && column.height > 0)) warnings.push('Sem coluna segura para reposicionar a logo; posição preservada.')
    else {
      const b = bounds(logo)
      const fit = safeFit(logo, column)
      const targetScale = Math.min(column.width / Math.max(1, number(logo.width)), column.height / Math.max(1, number(logo.height)))
      const panelTop = panel ? bounds(panel)?.top : null
      const gap = panelTop == null || !b ? 0 : panelTop - b.bottom
      const bad = !b || b.left < column.left - .01 || b.right > column.left + column.width + .01
        || b.top < column.top - .01 || b.bottom > column.top + column.height + .01 || intersects(b, panel ? bounds(panel) : null)
      const currentScale = Math.min(Math.abs(number(logo.scaleX, 1)), Math.abs(number(logo.scaleY, 1)))
      const small = targetScale && currentScale < targetScale * .8
      const geometryRepair = scaleNamed(logo) && (bad || small || gap > 20 * unit)
      if (geometryRepair) {
        const width = column.width, height = column.height
        const scale = Math.min(width / logo.width, height / logo.height)
        const renderW = logo.width * scale, renderH = logo.height * scale
        Object.assign(logo, { originX: 'left', originY: 'top', left: column.left + (width - renderW) / 2,
          top: panel ? column.top + height - renderH : column.top + (height - renderH) / 2, scaleX: scale, scaleY: scale })
        changes.push({ object: logo.name || logo._customId, fields: ['left', 'top', 'scaleX', 'scaleY', 'originX', 'originY'], reason: bad ? 'logo fora da coluna segura' : small ? 'logo menor que a área segura' : 'espaço excessivo até o painel Instagram' })
      }
      const finalBounds = bounds(logo)
      if (finalBounds) {
        const metadata = { quickLogoCenterX: finalBounds.left + finalBounds.width / 2, quickLogoCenterY: finalBounds.top + finalBounds.height / 2,
          quickLogoMaxWidth: column.width, quickLogoMaxHeight: column.height }
        const fields = Object.entries(metadata).filter(([key, value]) => !same(number(logo[key], NaN), value)).map(([key]) => key)
        if (fields.length) {
          Object.assign(logo, metadata)
          changes.push({ object: logo.name || logo._customId, fields, reason: 'metadados do slot sincronizados com a geometria real da logo' })
        }
      }
    }
  }

  const panel = objects.find(o => /header-instagram-panel/i.test(o?.name || '') && o.visible !== false)
  if (!panel) warnings.push('Painel Instagram nativo ausente; guia Instagram não foi criada nem reposicionada.')
  else {
    const p = bounds(panel)
    const guide = objects.find(o => o?.name === 'header-instagram-background' && o.visible !== false)
    const title = objects.find(o => /header-instagram-title|header-social-caption/i.test(o?.name || '') && o.visible !== false)
    if (!p || !guide || !bounds(guide)) warnings.push('Painel Instagram encontrado sem geometria confiável do fundo/guia.')
    else {
      const g = bounds(guide), t = title ? bounds(title) : null
      const titleReserve = t ? Math.max(20 * unit, t.bottom - p.top) : 20 * unit
      const guideHeight = Math.min(g.height, 52 * unit, Math.max(0, p.height - titleReserve))
      const top = p.bottom - guideHeight
      const maxWidth = p.width, centerX = p.left + p.width / 2
      const needs = !same(number(guide.headerInstagramMaxWidth, NaN), maxWidth)
        || !same(number(guide.headerInstagramCenterX, NaN), centerX)
        || !same(g.top, top) || !same(g.height, guideHeight)
      if (needs) {
        Object.assign(guide, { headerInstagramMaxWidth: maxWidth, headerInstagramCenterX: centerX,
          originY: 'top', top, height: guideHeight, scaleY: 1 })
        changes.push({ object: guide.name || guide._customId, fields: ['top', 'height', 'scaleY', 'originY', 'headerInstagramMaxWidth', 'headerInstagramCenterX'], reason: 'fundo/guia alinhado à linha inferior e sincronizado ao painel Instagram' })
      }
    }
  }
  return { canvas, changes, warnings }
}
