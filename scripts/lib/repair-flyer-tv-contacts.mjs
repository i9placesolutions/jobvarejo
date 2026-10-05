const CONTACT_FIELDS = new Set(['instagram', 'whatsapp', 'address', 'footerpaymentimages', 'phone', 'facebook'])
const CONTACT_ICONS = new Set(['instagram', 'whatsapp', 'address', 'phone', 'facebook', 'footerpaymentimages'])

const finite = value => {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const originFactor = (value, start, middle, end) => {
  const origin = String(value || start).toLowerCase()
  if (origin === middle) return 0.5
  if (origin === end) return 1
  return 0
}

const geometry = object => {
  const left = finite(object?.left)
  const top = finite(object?.top)
  const width = finite(object?.width)
  const height = finite(object?.height)
  const scaleX = finite(object?.scaleX ?? 1)
  const scaleY = finite(object?.scaleY ?? 1)
  if ([left, top, width, height, scaleX, scaleY].some(value => value === null)
    || width < 0 || height < 0 || Math.abs(scaleX) < 0.000001 || Math.abs(scaleY) < 0.000001
    || Math.abs(finite(object?.angle) ?? 0) > 0.000001) return null
  const renderedWidth = width * Math.abs(scaleX)
  const renderedHeight = height * Math.abs(scaleY)
  const x = left - renderedWidth * originFactor(object.originX, 'left', 'center', 'right')
  const y = top - renderedHeight * originFactor(object.originY, 'top', 'center', 'bottom')
  return { left: x, top: y, right: x + renderedWidth, bottom: y + renderedHeight, width: renderedWidth, height: renderedHeight, scaleX, scaleY }
}

const walk = (objects, visit, path = []) => {
  for (const object of objects || []) {
    if (!object || typeof object !== 'object') continue
    visit(object, path)
    if (Array.isArray(object.objects)) walk(object.objects, visit, [...path, object])
  }
}

const isValidity = object => /validity/i.test([
  object?.name,
  object?.layerName,
  object?.businessProfileField,
  object?.quickDataField,
  object?.quickDynamicIconFor
].filter(Boolean).join(' '))

const fieldName = object => String(object?.businessProfileField || object?.quickDataField || '').trim().toLowerCase()
const dynamicIcon = object => String(object?.quickDynamicIconFor || '').trim().toLowerCase()
const names = object => `${String(object?.name || '')} ${String(object?.layerName || '')}`.toLowerCase()

const isContact = object => {
  if (!object || isValidity(object) || /(^|[^a-z])(logo|seal|selo)([^a-z]|$)/i.test(names(object))) return false
  if (CONTACT_FIELDS.has(fieldName(object))) return true
  if (CONTACT_ICONS.has(dynamicIcon(object))) return true
  const name = names(object)
  return /(?:^|[-_ ])(?:icon|footer|header)[-_ ](?:instagram|whatsapp|address|phone|facebook|payment|contact|contacts|telefone|endereco|endere[cç]o)(?:[-_ ]|$)/i.test(name)
    || /footer[-_ ](?:reference[-_ ])?(?:whatsapp|address|instagram|phone|facebook|payment|contact|contacts|telefone|endereco|endere[cç]o)(?:[-_ ]|$)/i.test(name)
    || /footer[-_ ].*(?:label|caption|divider|inner-highlight)/i.test(name)
    || /^footer-column-divider(?:[-_ ].*)?$/i.test(String(object.name || ''))
}

const setHidden = object => {
  let changed = false
  const set = (key, value) => {
    if (object[key] !== value) { object[key] = value; changed = true }
  }
  set('visible', false)
  set('opacity', 0)
  set('quickFieldEnabled', false)

  for (const key of ['businessProfileField', 'quickDataField', 'quickDynamicIconFor']) {
    const value = String(object[key] || '').trim().toLowerCase()
    if (CONTACT_FIELDS.has(value) || CONTACT_ICONS.has(value)) {
      delete object[key]
      changed = true
    }
  }
  return changed
}

const hideVisual = object => {
  let changed = false
  if (object.visible !== false) { object.visible = false; changed = true }
  if (object.opacity !== 0) { object.opacity = 0; changed = true }
  return changed
}

const warning = (warnings, message) => { if (!warnings.includes(message)) warnings.push(message) }

const findFrame = objects => {
  const candidates = objects.filter(object => object?.isFrame || /^template-frame(?:-|$)/i.test(String(object?.name || '')))
  return candidates.length === 1 ? candidates[0] : null
}

const updateValidityBand = (objects, frameBounds, warnings) => {
  const candidates = objects.filter(object => {
    const name = String(object?.name || '').toLowerCase()
    if (!/^(retail-validity-visual-band|standard-validity-background)$/.test(name)) return false
    if (!['rect', 'path', 'image', 'group'].includes(String(object?.type || '').toLowerCase())) return false
    const box = geometry(object)
    return !!box && box.width >= frameBounds.width * 0.55
  }).map(object => ({ object, box: geometry(object) }))

  const visible = candidates.filter(({ object }) => object.visible !== false && (finite(object.opacity) ?? 1) > 0)
  if (!visible.length) {
    if (candidates.length) warning(warnings, 'Faixa nativa de validade encontrada, mas está invisível; não foi redimensionada.')
    return []
  }

  const bottommost = visible.slice().sort((a, b) => b.box.bottom - a.box.bottom)[0]
  const { object: anchor, box: anchorBox } = bottommost
  const minTop = frameBounds.top + frameBounds.height * 0.68
  if (anchorBox.top < minTop) {
    warning(warnings, `Faixa de validade ${anchor.name} não está na região inferior; geometria preservada.`)
    return []
  }

  const unit = frameBounds.width / 1920
  const bottomTarget = frameBounds.bottom - 8 * unit
  if (!(bottomTarget > anchorBox.top)) {
    warning(warnings, `Faixa de validade ${anchor.name} não possui altura final válida; geometria preservada.`)
    return []
  }
  if (anchorBox.bottom >= bottomTarget - 0.5 * unit) return []

  const matching = candidates.filter(({ box }) => Math.abs(box.top - anchorBox.top) <= Math.max(10 * unit, 8)
    && box.bottom <= bottomTarget + 2 * unit)
  const changes = []
  const nextBottom = Math.max(bottomTarget, anchorBox.bottom)
  for (const { object, box } of matching) {
    if (box.bottom >= nextBottom - 0.5 * unit) continue
    const objectType = String(object?.type || '').toLowerCase()
    const renderedHeight = nextBottom - box.top
    const preservesIntrinsicSize = ['path', 'image', 'group'].includes(objectType)
    const originY = String(object.originY || 'top').toLowerCase()
    const nextTop = box.top + renderedHeight * originFactor(originY, 'top', 'center', 'bottom')
    if (preservesIntrinsicSize) object.scaleY = renderedHeight / Number(object.height)
    else object.height = renderedHeight / Math.abs(box.scaleY)
    object.top = nextTop
    changes.push({ object: object.name, from: { top: box.top, bottom: box.bottom }, to: { top: box.top, bottom: nextBottom } })
  }

  if (!changes.length) return changes
  const localDateHeight = nextBottom - anchorBox.top
  walk(objects, object => {
    if (!isValidity(object) || String(object?.quickDataField || '').toLowerCase() !== 'validity'
      || object.visible === false || (finite(object.opacity) ?? 1) <= 0) return
    const savedHeight = finite(object.dynamicFieldHeight)
    if (savedHeight === null) return
    const scaleY = Math.abs(finite(object.scaleY ?? 1) ?? 1) || 1
    const nextHeight = localDateHeight / scaleY
    if (Math.abs(savedHeight - nextHeight) <= 0.5 * unit) return
    object.dynamicFieldHeight = nextHeight
    changes.push({ object: object.name || 'validity-date-metadata', field: 'dynamicFieldHeight', from: savedHeight, to: nextHeight })
  })
  return changes
}

/**
 * Hides dynamic contact material on landscape TV flyers while preserving the
 * logo, product zone and any validity band. The source remains untouched.
 */
export function repairFlyerTvContacts(source) {
  let canvas
  try { canvas = structuredClone(source) }
  catch { return { canvas: source, changes: [], warnings: [], skipReason: 'Fonte inválida para clonagem.' } }

  const objects = Array.isArray(canvas?.objects) ? canvas.objects : null
  if (!objects) return { canvas, changes: [], warnings: [], skipReason: 'Canvas sem lista de objetos Fabric.' }

  const frame = findFrame(objects)
  if (!frame) return { canvas, changes: [], warnings: [], skipReason: 'É necessário exatamente um frame identificável.' }
  const frameBounds = geometry(frame)
  if (!frameBounds || frameBounds.width / frameBounds.height <= 1.5) {
    return { canvas, changes: [], warnings: [], skipReason: 'Modelo fora do formato TV horizontal.' }
  }

  const changes = []
  const warnings = []
  let instagramContactExists = false
  let footerContactExists = false
  walk(objects, object => {
    if (!isContact(object)) return
    const name = names(object)
    const field = fieldName(object) || dynamicIcon(object)
    if (field === 'instagram' || /instagram/.test(name)) instagramContactExists = true
    if (/footer/.test(name) || ['whatsapp', 'address', 'phone', 'facebook', 'footerpaymentimages'].includes(field)) footerContactExists = true
    if (setHidden(object)) changes.push({ object: object.name || object.type || 'contact', action: 'hide-contact-and-remove-dynamic-binding' })
  })

  if (instagramContactExists) {
    for (const object of objects) {
      if (String(object?.name || '').toLowerCase() === 'header-instagram-background' && setHidden(object)) {
        changes.push({ object: object.name, action: 'hide-contact-background' })
      }
    }
  }

  for (const object of objects) {
    if (String(object?.name || '').trim().toLowerCase() !== 'reference background footer') continue
    if (String(object?.type || '').toLowerCase() !== 'image') continue
    if (hideVisual(object)) changes.push({ object: object.name, action: 'hide-footer-reference-slice' })
  }

  if (footerContactExists) {
    for (const object of objects) {
      const name = String(object?.name || '').toLowerCase()
      const isContactBackdrop = name === 'footer-premium-background'
        && /^(reference-contacts|contacts-address)$/i.test(String(object.footerLayout || ''))
      const isContactDecoration = name === 'reference-footer-inner-highlight'
        || name === 'reference background footer'
        || isContactBackdrop
      if ((isContactBackdrop || isContactDecoration) && hideVisual(object)) {
        changes.push({ object: object.name, action: 'hide-contact-background' })
      }
    }
  }

  changes.push(...updateValidityBand(objects, frameBounds, warnings))
  return { canvas, changes, warnings }
}
