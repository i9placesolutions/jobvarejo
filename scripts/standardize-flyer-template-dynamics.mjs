#!/usr/bin/env node
/**
 * Padroniza apenas os blueprints dos modelos de encarte que ainda não têm
 * validade/campos comerciais no formato de referência. O script nunca toca
 * encartes de clientes e preserva os objetos, a arte e as receitas das zonas.
 *
 * Uso:
 *   node --env-file=.env scripts/standardize-flyer-template-dynamics.mjs
 *   node --env-file=.env scripts/standardize-flyer-template-dynamics.mjs --apply
 *   node --env-file=.env scripts/standardize-flyer-template-dynamics.mjs --only=<id>
 */
import { randomUUID, createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

export const OWNER_ID = 'eb847e8e-7c19-4bee-8042-376528ce6192'
export const EXCLUDED_TEMPLATE_IDS = new Set([
  // Canaã: pedido explícito para manter sem alterações.
  'ea0d0789-3081-409c-b830-10739806b065',
  // Mega — Sábado de Ofertas, enviado pelo usuário como modelo que não deve mudar.
  '4f092cdb-138c-4cf1-b2f7-4aacc018a890'
])
export const DEFAULT_DONOR_TEMPLATE_ID = 'f2fcc88f-1d67-486a-b4c8-d0561a47c505'

export const TEMPLATE_FORMATS = [
  ['feed', 'Feed 4:5', 1080, 1350],
  ['square', 'Post 1:1', 1080, 1080],
  ['stories', 'Story 9:16', 1080, 1920],
  ['print', 'A4', 794, 1123],
  ['tv', 'Banner 16:9', 1920, 1080]
]

const requiredFooterFields = ['instagram', 'whatsapp', 'address', 'footerPaymentImages']
const isText = (object) => ['text', 'textbox', 'i-text'].includes(String(object?.type || '').toLowerCase())
const deepCopy = (value) => structuredClone(value)
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export const objectBounds = (object) => {
  const scaleX = Math.abs(num(object?.scaleX, 1)) || 1
  const scaleY = Math.abs(num(object?.scaleY, 1)) || 1
  const width = Math.max(0, num(object?.width) * scaleX)
  const height = Math.max(0, num(object?.height) * scaleY)
  let left = num(object?.left)
  let top = num(object?.top)
  const originX = String(object?.originX || 'left').toLowerCase()
  const originY = String(object?.originY || 'top').toLowerCase()
  if (originX === 'center') left -= width / 2
  else if (originX === 'right') left -= width
  if (originY === 'center') top -= height / 2
  else if (originY === 'bottom') top -= height
  return { left, top, width, height, right: left + width, bottom: top + height }
}

const frameFor = (canvas, page) => {
  const frame = (canvas.objects || []).find((object) => object?.isFrame)
  if (frame) return frame
  return {
    type: 'Rect', _customId: randomUUID(), isFrame: true, name: 'template-frame',
    originX: 'left', originY: 'top', left: 0, top: 0,
    width: num(page?.width, num(canvas?.width, 1080)), height: num(page?.height, num(canvas?.height, 1350)),
    fill: '#0636a7', strokeWidth: 0, scaleX: 1, scaleY: 1, clipContent: true
  }
}

const baseObject = (type, values = {}) => ({
  type,
  version: '7.1.0',
  _customId: randomUUID(),
  originX: 'left',
  originY: 'top',
  left: 0,
  top: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  opacity: 1,
  visible: true,
  objectCaching: true,
  stroke: null,
  strokeWidth: 0,
  fill: 'transparent',
  backgroundColor: '',
  padding: 0,
  ...values
})

const rect = (frameId, values = {}) => baseObject('Rect', { parentFrameId: frameId, rx: 0, ry: 0, ...values })
const text = (frameId, values = {}) => baseObject('Textbox', {
  parentFrameId: frameId,
  width: 100,
  fontFamily: 'Barlow',
  fontWeight: 700,
  fontStyle: 'normal',
  fontSize: 20,
  lineHeight: 1.04,
  textAlign: 'left',
  charSpacing: 0,
  splitByGrapheme: true,
  text: '',
  ...values
})

const objectSet = (object, values) => Object.assign(object, values)
const bringToFront = (objects, object) => {
  const index = objects.indexOf(object)
  if (index >= 0) objects.splice(index, 1)
  objects.push(object)
}

const syncZoneSnapshot = (zone, renderedBounds) => {
  zone._zoneWidth = renderedBounds.width
  zone._zoneHeight = renderedBounds.height
  if (zone._zoneStateSnapshot?.zone) {
    const geometry = zone._zoneStateSnapshot.zone.geometry || {}
    zone._zoneStateSnapshot.zone.geometry = {
      ...geometry,
      x: num(zone.left),
      y: num(zone.top),
      width: renderedBounds.width,
      height: renderedBounds.height,
      scaleX: num(zone.scaleX, 1),
      scaleY: num(zone.scaleY, 1),
      angle: num(zone.angle)
    }
  }
}

/** Encolhe a zona pelo fim, mantendo o topo e a receita de produtos íntegros. */
export const reserveZoneBottom = (zone, bottom, gap = 8) => {
  const current = objectBounds(zone)
  const nextBottom = Math.min(current.bottom, bottom - gap)
  const nextHeight = nextBottom - current.top
  if (!(nextHeight > Math.max(72, current.height * 0.18))) return false
  if (nextHeight >= current.height - 1) return false
  const oldScaleY = num(zone.scaleY, 1) || 1
  const nextScaleY = oldScaleY * nextHeight / current.height
  const originY = String(zone.originY || 'left').toLowerCase()
  const nextTop = originY === 'center' ? current.top + nextHeight / 2
    : originY === 'bottom' ? current.top + nextHeight : current.top
  objectSet(zone, { scaleY: nextScaleY, top: nextTop })
  syncZoneSnapshot(zone, { ...current, height: nextHeight, bottom: current.top + nextHeight })
  return true
}

const reserveZoneTop = (zone, top, gap = 8) => {
  const current = objectBounds(zone)
  const nextTop = Math.max(current.top, top + gap)
  const nextHeight = current.bottom - nextTop
  if (!(nextHeight > Math.max(72, current.height * 0.18))) return false
  if (nextHeight >= current.height - 1) return false
  const oldScaleY = num(zone.scaleY, 1) || 1
  const nextScaleY = oldScaleY * nextHeight / current.height
  const originY = String(zone.originY || 'top').toLowerCase()
  const nextObjectTop = originY === 'center' ? nextTop + nextHeight / 2
    : originY === 'bottom' ? nextTop + nextHeight : nextTop
  objectSet(zone, { scaleY: nextScaleY, top: nextObjectTop })
  syncZoneSnapshot(zone, { ...current, top: nextTop, height: nextHeight, bottom: nextTop + nextHeight })
  return true
}

const findDynamic = (objects, field) => objects.find((object) => String(object?.businessProfileField || '') === field)
const findValidity = (objects) => objects.find((object) => object?.quickDataField === 'validity' || object?.businessProfileField === 'validity')

const standardValidityText = () => 'OFERTA VÁLIDA DE\n14 A 19 DE SETEMBRO\nOU ENQUANTO DURAREM OS ESTOQUES'

const hidePreviousValidityDecorations = (objects, field) => {
  for (const object of objects) {
    if (object === field) continue
    const name = String(object?.name || '').toLowerCase()
    if (name === 'standard-validity-background' || name.startsWith('header-validity-calendar')) continue
    if (object?.quickDynamicIconFor === 'validity' || name.includes('validity')) object.visible = false
  }
}

const hidePreviousFooterDecorations = (objects, frameBounds, footerTop, scale) => {
  const minimumTop = footerTop - 46 * scale
  for (const object of objects) {
    if (!object || object?.isFrame || object?.isProductZone || object?.businessProfileField === 'logo') continue
    const box = objectBounds(object)
    if (box.top < minimumTop || box.bottom > frameBounds.bottom + 3) continue
    const name = String(object?.name || '').toLowerCase()
    const content = String(object?.text || '').toUpperCase()
    const dynamic = String(object?.businessProfileField || '')
    const currentStandard = /^footer-(premium-background|contact-(instagram|whatsapp|address|payments)|title-(instagram|whatsapp|address|footerpaymentimages)|dynamic-(instagram|whatsapp|address)|payment-images|divider-[123])$/.test(name)
    if (currentStandard || dynamic) continue
    const looksLikeFooter = /footer|contact|instagram|whatsapp|address|payment|cart[õo]es|icon-(instagram|whatsapp|address|location)/.test(name)
      || /SIGA NOSSO INSTAGRAM|WHATSAPP|ENDERE[ÇC]O|CART[ÕO]ES ACEITOS/.test(content)
      || (String(object.type || '').toLowerCase() === 'rect' && box.height <= Math.max(80 * scale, frameBounds.height * .16) && box.width >= frameBounds.width * .12)
    if (looksLikeFooter) object.visible = false
  }
}

const makeHeaderCalendar = (objects, frameId, x, y, size, accent) => {
  const outline = rect(frameId, {
    name: 'header-validity-calendar', layerName: 'Calendário da validade',
    left: x, top: y, width: size, height: size, rx: size * 0.14, ry: size * 0.14,
    fill: 'transparent', stroke: accent, strokeWidth: Math.max(2, size * 0.055),
    selectable: false, evented: false
  })
  const bar = rect(frameId, {
    name: 'header-validity-calendar-bar', left: x + size * 0.12, top: y + size * 0.23,
    width: size * 0.76, height: Math.max(2, size * 0.05), fill: accent,
    selectable: false, evented: false
  })
  const dotSize = Math.max(2, size * 0.09)
  const dots = [0, 1, 2, 3, 4, 5].map((index) => rect(frameId, {
    name: 'header-validity-calendar-dot',
    left: x + size * (0.22 + (index % 3) * 0.25), top: y + size * (0.48 + Math.floor(index / 3) * 0.22),
    width: dotSize, height: dotSize, rx: dotSize / 2, ry: dotSize / 2, fill: accent,
    selectable: false, evented: false
  }))
  objects.push(outline, bar, ...dots)
}

/**
 * Reutiliza a própria caixa de validade quando ela existe. Isto evita dois
 * campos concorrentes na edição rápida e preserva a data configurada antes.
 */
export const ensureHeaderValidity = (canvas, page, options = {}) => {
  const objects = canvas.objects || (canvas.objects = [])
  const frame = frameFor(canvas, page)
  if (!objects.includes(frame)) objects.unshift(frame)
  const frameBounds = objectBounds(frame)
  const zone = objects.find((object) => object?.isProductZone)
  const horizontal = options.horizontal === true
  const scale = frameBounds.width / 1080
  // Um banner 16:9 já tem largura suficiente para letras maiores. Limitar a
  // altura ao espaço vertical impede que a data consuma o cabeçalho inteiro.
  const cardHeight = horizontal
    ? Math.round(Math.min(frameBounds.height * 0.13, 76 * scale))
    : Math.round(96 * scale)
  const margin = Math.round(18 * scale)
  const requestedWidth = Math.min(horizontal ? frameBounds.width * 0.38 : frameBounds.width * 0.54, horizontal ? 690 * scale : 590 * scale)
  const width = Math.max(260 * scale, requestedWidth)
  const x = frameBounds.right - width - margin
  const y = frameBounds.top + margin
  const neededBottom = y + cardHeight
  if (zone && objectBounds(zone).top < neededBottom + 8 * scale) reserveZoneTop(zone, neededBottom, 12 * scale)

  const oldBackdrop = objects.find((object) => object?.name === 'validity-backdrop')
  if (oldBackdrop) oldBackdrop.visible = false
  const existingCard = objects.find((object) => object?.name === 'standard-validity-background')
  const card = existingCard || rect(frame._customId, {
    name: 'standard-validity-background', layerName: 'Faixa de validade',
    fill: '#0636a7', stroke: '#ffe500', strokeWidth: Math.max(2, 2.4 * scale), rx: 14 * scale, ry: 14 * scale,
    selectable: false, evented: false
  })
  objectSet(card, { parentFrameId: frame._customId, left: x, top: y, width, height: cardHeight, originX: 'left', originY: 'top', visible: true })
  if (!objects.includes(card)) objects.push(card)

  const field = findValidity(objects) || text(frame._customId, { name: 'header-validity', layerName: 'Validade da oferta' })
  const existingStart = String(field.quickValidityStartDate || '').trim()
  const existingEnd = String(field.quickValidityEndDate || '').trim()
  const calendarWidth = Math.round(cardHeight * 0.61)
  const contentX = x + calendarWidth + 24 * scale
  const contentWidth = Math.max(120, width - calendarWidth - 40 * scale)
  objectSet(field, {
    parentFrameId: frame._customId,
    name: 'header-validity', layerName: 'Validade da oferta',
    originX: 'left', originY: 'top', left: contentX, top: y + 12 * scale, width: contentWidth,
    // O tamanho base precisa acomodar a segunda linha, que é maior e amarela.
    // Se a base for menor do que essa linha, o Fabric calcula o espaçamento
    // vertical com a métrica menor e as três linhas acabam se encostando.
    scaleX: 1, scaleY: 1, fontFamily: 'Barlow', fontWeight: 700, fontSize: Math.max(18, 22 * scale),
    fill: '#ffffff', textAlign: 'left', lineHeight: 1.04, splitByGrapheme: false,
    text: standardValidityText(), __rawText: standardValidityText(),
    quickDataField: 'validity', quickFieldEnabled: true,
    quickValidityStartDate: existingStart || '2026-09-14', quickValidityEndDate: existingEnd || '2026-09-19',
    quickValidityMode: field.quickValidityMode || 'date_range',
    quickValidityWhileStocks: field.quickValidityWhileStocks !== false,
    quickValidityDateFormat: field.quickValidityDateFormat || 'long',
    dynamicFieldKey: 'validity', dynamicFieldResizeMode: 'reflow',
    dynamicFieldBaseFontSize: Math.max(18, 22 * scale), dynamicFieldAutoFitFontSize: Math.max(18, 22 * scale),
    dynamicFieldAutoHeight: true, quickValidityLayout: 'header-card', visible: true,
    styles: {
      0: Object.fromEntries([...('OFERTA VÁLIDA DE')].map((_, index) => [index, { fontSize: Math.max(11, 12 * scale), fontWeight: 700, fill: '#ffffff' }])),
      1: Object.fromEntries([...('14 A 19 DE SETEMBRO')].map((_, index) => [index, { fontSize: Math.max(16, 22 * scale), fontWeight: 900, fill: '#ffe500' }])),
      2: Object.fromEntries([...('OU ENQUANTO DURAREM OS ESTOQUES')].map((_, index) => [index, { fontSize: Math.max(9, 10 * scale), fontWeight: 700, fill: '#ffffff' }]))
    }
  })
  bringToFront(objects, field)
  hidePreviousValidityDecorations(objects, field)

  const existingCalendar = objects.filter((object) => String(object?.name || '').startsWith('header-validity-calendar'))
  if (!existingCalendar.length) makeHeaderCalendar(objects, frame._customId, x + 13 * scale, y + (cardHeight - calendarWidth) / 2, calendarWidth, '#ffe500')
  else {
    // Mantém o ícone já existente: objetos futuros não duplicam o calendário.
    for (const object of existingCalendar) object.parentFrameId = frame._customId
  }
  return { changed: true, field, card, frame, zone: objects.find((object) => object?.isProductZone) }
}

const footerLabel = (field) => ({
  instagram: 'SIGA NOSSO INSTAGRAM',
  whatsapp: 'WHATSAPP DE OFERTAS',
  address: 'ENDEREÇO',
  footerPaymentImages: 'CARTÕES ACEITOS'
}[field] || field)

const footerSample = (field) => ({
  instagram: '@SUALOJA',
  whatsapp: '(64) 99999-9999',
  address: 'Rua Exemplo, 123 · Centro',
  footerPaymentImages: ''
}[field] || '')

const footerFontSize = (field, scale) => field === 'address' ? 16 * scale : field === 'instagram' ? 18 * scale : 20 * scale

const ensureFooterItem = (objects, frameId, field, box, scale) => {
  const boxName = `footer-contact-${field === 'footerPaymentImages' ? 'payments' : field}`
  const existingBox = objects.find((object) => object?.name === boxName)
  const border = existingBox || rect(frameId, { name: boxName, layerName: footerLabel(field), selectable: false, evented: false })
  objectSet(border, {
    parentFrameId: frameId, left: box.left, top: box.top, width: box.width, height: box.height,
    fill: 'transparent', stroke: 'rgba(255,255,255,0.28)', strokeWidth: 0,
    originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, visible: true
  })
  bringToFront(objects, border)

  const titleName = `footer-title-${field}`
  const existingTitle = objects.find((object) => object?.name === titleName)
  const title = existingTitle || text(frameId, { name: titleName, layerName: footerLabel(field), selectable: false, evented: false })
  objectSet(title, {
    parentFrameId: frameId, name: titleName, originX: 'left', originY: 'top',
    left: box.left + 12 * scale, top: box.top + 12 * scale, width: box.width - 24 * scale,
    scaleX: 1, scaleY: 1, text: footerLabel(field), fontFamily: 'Barlow', fontWeight: 900,
    fontSize: Math.max(10, 11 * scale), fill: '#ffe500', textAlign: 'left', lineHeight: 1,
    splitByGrapheme: false, visible: true
  })
  bringToFront(objects, title)

  const existing = findDynamic(objects, field)
  if (field === 'footerPaymentImages') {
    const slot = existing || rect(frameId, { name: 'footer-payment-images', layerName: 'Cartões aceitos' })
    objectSet(slot, {
      parentFrameId: frameId, name: 'footer-payment-images', layerName: 'Cartões aceitos',
      originX: 'left', originY: 'top', left: box.left + 12 * scale, top: box.top + 32 * scale,
      width: Math.max(26, box.width - 24 * scale), height: Math.max(18, box.height - 44 * scale),
      scaleX: 1, scaleY: 1, fill: 'transparent', stroke: null, strokeWidth: 0,
      businessProfileField: 'footerPaymentImages', quickFieldEnabled: true,
      footerPaymentWidth: Math.max(26, box.width - 24 * scale), footerPaymentHeight: Math.max(18, box.height - 44 * scale),
      visible: true
    })
    bringToFront(objects, slot)
    return slot
  }

  const dynamic = existing || text(frameId, { name: `footer-dynamic-${field}`, layerName: footerLabel(field) })
  const size = Math.max(12, footerFontSize(field, scale))
  objectSet(dynamic, {
    parentFrameId: frameId, name: `footer-dynamic-${field}`, layerName: footerLabel(field),
    originX: 'left', originY: 'top', left: box.left + 12 * scale, top: box.top + 31 * scale,
    width: Math.max(38, box.width - 24 * scale), scaleX: 1, scaleY: 1,
    text: footerSample(field), __rawText: footerSample(field), fontFamily: 'Barlow', fontWeight: 700,
    fontSize: size, fill: '#ffffff', textAlign: 'left', lineHeight: 1.04,
    splitByGrapheme: field === 'address', visible: true,
    businessProfileField: field, quickFieldEnabled: true,
    dynamicFieldKey: field, dynamicFieldResizeMode: 'reflow', dynamicFieldBaseFontSize: size,
    dynamicFieldAutoFitFontSize: size, dynamicFieldAutoHeight: true
  })
  bringToFront(objects, dynamic)
  return dynamic
}

/** Cria um rodapé único, de quatro colunas, sem deixar os dados sobre os cards. */
export const ensureBusinessFooter = (canvas, page, options = {}) => {
  const objects = canvas.objects || (canvas.objects = [])
  const frame = frameFor(canvas, page)
  if (!objects.includes(frame)) objects.unshift(frame)
  const frameBounds = objectBounds(frame)
  const horizontal = options.horizontal === true
  const scale = frameBounds.width / 1080
  // A tipografia do rodapé cresce pela largura; a área horizontal, porém,
  // deve continuar abaixo dos cards. Esta trava mantém 16:9 equilibrado.
  const footerHeight = horizontal
    ? Math.round(Math.min(frameBounds.height * 0.13, 78 * scale))
    : Math.round(120 * scale)
  const footerTop = frameBounds.bottom - footerHeight
  const zone = objects.find((object) => object?.isProductZone)
  if (zone) reserveZoneBottom(zone, footerTop, 10 * scale)
  hidePreviousFooterDecorations(objects, frameBounds, footerTop, scale)

  const background = objects.find((object) => object?.name === 'footer-premium-background') || rect(frame._customId, {
    name: 'footer-premium-background', layerName: 'Rodapé comercial', selectable: false, evented: false
  })
  objectSet(background, {
    parentFrameId: frame._customId, left: frameBounds.left, top: footerTop, width: frameBounds.width, height: footerHeight,
    originX: 'left', originY: 'top', fill: '#0636a7', stroke: '#ffe500', strokeWidth: Math.max(1, 1.5 * scale),
    scaleX: 1, scaleY: 1, visible: true, opacity: 1, rx: 0, ry: 0
  })
  if (!objects.includes(background)) objects.push(background)

  const columnWidth = frameBounds.width / requiredFooterFields.length
  for (const [index, field] of requiredFooterFields.entries()) {
    const x = frameBounds.left + index * columnWidth
    const box = { left: x, top: footerTop, width: columnWidth, height: footerHeight }
    ensureFooterItem(objects, frame._customId, field, box, scale)
    if (index > 0) {
      const dividerName = `footer-divider-${index}`
      const divider = objects.find((object) => object?.name === dividerName) || rect(frame._customId, { name: dividerName, selectable: false, evented: false })
      objectSet(divider, {
        parentFrameId: frame._customId, left: x, top: footerTop + 10 * scale, width: Math.max(1, scale), height: footerHeight - 20 * scale,
        originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, fill: 'rgba(255,255,255,0.45)', visible: true
      })
      bringToFront(objects, divider)
    }
  }
  return { changed: true, frame, zone: objects.find((object) => object?.isProductZone), footerTop, footerHeight }
}

const chooseBackground = (source) => {
  const objects = source?.objects || []
  const images = objects.filter((object) => String(object?.type || '').toLowerCase() === 'image' && object?.src)
  return images.sort((left, right) => objectBounds(right).width * objectBounds(right).height - objectBounds(left).width * objectBounds(left).height)[0] || null
}

export const cloneZoneForFrame = (sourceZone, frame, box, metadata = {}) => {
  const zone = deepCopy(sourceZone)
  const current = objectBounds(zone)
  const horizontalScale = Math.max(0.01, box.width / Math.max(1, current.width))
  const verticalScale = Math.max(0.01, box.height / Math.max(1, current.height))
  const oldScaleX = num(zone.scaleX, 1) || 1
  const oldScaleY = num(zone.scaleY, 1) || 1
  const originX = String(zone.originX || 'center').toLowerCase()
  const originY = String(zone.originY || 'center').toLowerCase()
  const left = originX === 'center' ? box.left + box.width / 2 : originX === 'right' ? box.left + box.width : box.left
  const top = originY === 'center' ? box.top + box.height / 2 : originY === 'bottom' ? box.top + box.height : box.top
  Object.assign(zone, {
    _customId: randomUUID(), parentFrameId: frame._customId,
    left, top, scaleX: oldScaleX * horizontalScale, scaleY: oldScaleY * verticalScale,
    templateCompositionManaged: true, contentStatus: 'empty', ...metadata
  })
  syncZoneSnapshot(zone, { ...box, right: box.left + box.width, bottom: box.top + box.height })
  return zone
}

const ensureProductZone = (canvas, page, donorZone) => {
  const objects = canvas.objects || (canvas.objects = [])
  const existing = objects.find((object) => object?.isProductZone)
  if (existing) return existing
  if (!donorZone) throw new Error(`Zona-base ausente para ${page?.name || 'página sem nome'}`)
  const frame = frameFor(canvas, page)
  if (!objects.includes(frame)) objects.unshift(frame)
  const frameBounds = objectBounds(frame)
  const horizontal = String(page?.templateFormatId || '') === 'tv' || frameBounds.width > frameBounds.height
  const scale = frameBounds.width / 1080
  const header = Math.max(96 * scale, frameBounds.height * (horizontal ? .16 : .15))
  const footer = horizontal
    ? Math.round(Math.min(frameBounds.height * 0.13, 78 * scale))
    : Math.round(120 * scale)
  const margin = 18 * scale
  const box = {
    left: frameBounds.left + margin,
    top: frameBounds.top + header,
    width: Math.max(120, frameBounds.width - margin * 2),
    height: Math.max(120, frameBounds.height - header - footer - margin * 2)
  }
  const zone = cloneZoneForFrame(donorZone, frame, box, {
    templateFormatId: page?.templateFormatId,
    templateFormatLabel: page?.templateFormatLabel,
    templateModelId: page?.templateModelId,
    templateModelName: page?.templateModelName
  })
  objects.push(zone)
  return zone
}

const titleFor = (name) => String(name || 'OFERTAS DA SEMANA').trim().toLocaleUpperCase('pt-BR').slice(0, 42)

export const hasUsableFrame = (canvas, page) => {
  const objects = canvas?.objects || []
  const frame = objects.find((object) => object?.isFrame)
  if (!frame) return false
  const bounds = objectBounds(frame)
  const width = Math.max(1, num(page?.width, num(canvas?.width, 1080)))
  const height = Math.max(1, num(page?.height, num(canvas?.height, 1350)))
  // Um frame reduzido pela metade ou com uma zona fora dele é uma página
  // parcialmente corrompida. Nela, recriar a composição é mais seguro do que
  // reposicionar objetos soltos e deixar cards invisíveis.
  if (bounds.width < width * .76 || bounds.height < height * .76) return false
  if (bounds.left > width * .2 || bounds.top > height * .2 || bounds.right < width * .8 || bounds.bottom < height * .8) return false
  const zone = objects.find((object) => object?.isProductZone)
  if (zone) {
    const zoneBounds = objectBounds(zone)
    // A validação final aceita somente dois pixels de tolerância. Aplicar a
    // mesma regra aqui faz a página com zona já vazando ser recomposta antes
    // de reservar cabeçalho/rodapé, em vez de falhar no meio da atualização.
    if (zoneBounds.left < bounds.left - 2 || zoneBounds.top < bounds.top - 2 || zoneBounds.right > bounds.right + 2 || zoneBounds.bottom > bounds.bottom + 2) return false
  }
  return true
}

/** Constrói uma página independente para um formato que não existia no modelo. */
export const createMissingFormatCanvas = ({ project, sourceCanvas, donorZone, format }) => {
  const [, formatLabel, width, height] = format
  const frameId = randomUUID()
  const frame = rect(frameId, {
    _customId: frameId, isFrame: true, clipContent: true, name: `template-frame-${String(project?.id || '').slice(0, 8)}-${format[0]}`,
    layerName: `${project?.name || 'Modelo'} · ${formatLabel}`, originX: 'center', originY: 'center',
    left: width / 2, top: height / 2, width, height, fill: '#0636a7', strokeWidth: 0,
    templateModelId: String(project?.template_config?.defaultModelId || 'modelo-padrao'),
    templateModelName: String(project?.name || 'Modelo'), templateFormatId: format[0], templateFormatLabel: formatLabel
  })
  const objects = [frame]
  const background = chooseBackground(sourceCanvas)
  if (background) {
    const clone = deepCopy(background)
    const baseW = Math.max(1, num(clone.width))
    const baseH = Math.max(1, num(clone.height))
    const cover = Math.max(width / baseW, height / baseH)
    Object.assign(clone, {
      _customId: randomUUID(), parentFrameId: frameId, originX: 'center', originY: 'center', left: width / 2, top: height / 2,
      scaleX: cover, scaleY: cover, selectable: false, evented: false, lockMovementX: true, lockMovementY: true,
      lockScalingX: true, lockScalingY: true
    })
    objects.push(clone)
  }
  const headerHeight = Math.round(height * (format[0] === 'tv' ? 0.20 : 0.17))
  objects.push(rect(frameId, { name: 'standard-header-overlay', left: 0, top: 0, width, height: headerHeight, fill: 'rgba(4,38,137,0.92)', selectable: false, evented: false }))
  const scale = width / 1080
  const titleWidth = width * (format[0] === 'tv' ? 0.52 : 0.48)
  objects.push(text(frameId, {
    name: 'standard-template-title', layerName: 'Título da campanha', left: 28 * scale, top: 28 * scale, width: titleWidth,
    text: titleFor(project?.name), fontFamily: 'Barlow', fontWeight: 900, fontSize: Math.max(28, 42 * scale), fill: '#ffe500',
    lineHeight: 0.94, splitByGrapheme: false
  }))
  const logoWidth = Math.min(width * 0.24, 280 * scale)
  objects.push(rect(frameId, {
    name: 'quick-logo-slot', layerName: 'Logo da loja', left: width - logoWidth - 28 * scale, top: 20 * scale,
    width: logoWidth, height: Math.max(58 * scale, headerHeight * 0.54), fill: 'transparent', stroke: 'rgba(255,255,255,0.36)', strokeWidth: 1,
    businessProfileField: 'logo', quickLogoSlot: true, quickFieldEnabled: true, quickLogoBackdropMode: 'none', quickLogoSource: '',
    quickLogoMaxWidth: logoWidth, quickLogoMaxHeight: Math.max(58 * scale, headerHeight * 0.54),
    quickLogoCenterX: width - logoWidth / 2 - 28 * scale, quickLogoCenterY: 20 * scale + Math.max(58 * scale, headerHeight * 0.54) / 2
  }))
  const zoneSource = (sourceCanvas?.objects || []).find((object) => object?.isProductZone) || donorZone
  if (!zoneSource) throw new Error(`Não foi encontrada zona-base para ${project?.name || 'modelo'}`)
  const footerHeight = format[0] === 'tv'
    ? Math.round(Math.min(height * 0.13, 78 * scale))
    : Math.round(120 * scale)
  const zoneBox = { left: 20 * scale, top: headerHeight + 18 * scale, width: width - 40 * scale, height: height - headerHeight - footerHeight - 34 * scale }
  const zone = cloneZoneForFrame(zoneSource, frame, zoneBox, {
    templateFormatId: format[0], templateFormatLabel: formatLabel,
    templateModelId: String(project?.template_config?.defaultModelId || 'modelo-padrao'), templateModelName: String(project?.name || 'Modelo')
  })
  objects.push(zone)
  return { version: '7.1.0', backgroundColor: '', width, height, objects }
}

const insideFrame = (object, frame) => {
  if (!object || !frame) return false
  const box = objectBounds(object)
  const root = objectBounds(frame)
  return box.left >= root.left - 2 && box.top >= root.top - 2 && box.right <= root.right + 2 && box.bottom <= root.bottom + 2
}

const ensureFooterNeeded = (objects, frame, horizontal) => {
  if (horizontal || requiredFooterFields.some((field) => !findDynamic(objects, field))) return true
  const footer = objects.find((object) => object?.name === 'footer-premium-background')
  if (!footer || !insideFrame(footer, frame)) return true
  return requiredFooterFields.some((field) => !insideFrame(findDynamic(objects, field), frame))
}

const ensureValidityNeeded = (objects, frame, horizontal) => horizontal || !findValidity(objects) || !insideFrame(findValidity(objects), frame)

/**
 * @param {{ canvas: any, page: any, donorZone?: any, forceFooter?: boolean, forceValidity?: boolean }} input
 */
export const normalizeTemplateCanvas = ({ canvas, page, donorZone = null, forceFooter = false, forceValidity = false }) => {
  const result = deepCopy(canvas)
  result.objects ||= []
  const frame = frameFor(result, page)
  if (!result.objects.includes(frame)) result.objects.unshift(frame)
  ensureProductZone(result, page, donorZone)
  const frameBounds = objectBounds(frame)
  const horizontal = String(page?.templateFormatId || '') === 'tv' || frameBounds.width > frameBounds.height
  const needsFooter = forceFooter || ensureFooterNeeded(result.objects, frame, horizontal)
  const needsValidity = forceValidity || ensureValidityNeeded(result.objects, frame, horizontal)
  const before = JSON.stringify(result)
  if (needsFooter) ensureBusinessFooter(result, page, { horizontal })
  if (needsValidity) ensureHeaderValidity(result, page, { horizontal })
  const validation = validateTemplateCanvas(result, page)
  if (!validation.ok) throw new Error(`Blueprint inválido (${page?.templateFormatId || page?.name || 'sem formato'}): ${validation.errors.join('; ')}`)
  return { canvas: result, changed: before !== JSON.stringify(result), validation, needsFooter, needsValidity }
}

export const validateTemplateCanvas = (canvas, page) => {
  const objects = canvas?.objects || []
  const frame = objects.find((object) => object?.isFrame)
  if (!frame) return { ok: false, errors: ['frame ausente'] }
  const errors = []
  const frameBounds = objectBounds(frame)
  const zone = objects.find((object) => object?.isProductZone)
  if (!zone) errors.push('zona de produtos ausente')
  const validity = findValidity(objects)
  if (!validity) errors.push('validade dinâmica ausente')
  for (const field of requiredFooterFields) if (!findDynamic(objects, field)) errors.push(`campo ${field} ausente`)
  const footer = objects.find((object) => object?.name === 'footer-premium-background')
  const horizontal = String(page?.templateFormatId || '') === 'tv' || frameBounds.width > frameBounds.height
  if (horizontal && !footer) errors.push('rodapé horizontal ausente')
  for (const object of [zone, validity, footer].filter(Boolean)) {
    const box = objectBounds(object)
    if (box.left < frameBounds.left - 2 || box.top < frameBounds.top - 2 || box.right > frameBounds.right + 2 || box.bottom > frameBounds.bottom + 2) {
      errors.push(`${object.name || object._customId || object.type} fora do frame`)
    }
  }
  if (zone && footer && objectBounds(zone).bottom > objectBounds(footer).top - 1) errors.push('zona invade rodapé')
  return { ok: errors.length === 0, errors }
}

const templateModel = (project) => project?.template_config?.models?.[0] || {
  id: String(project?.template_config?.defaultModelId || 'modelo-padrao'), name: String(project?.name || 'Modelo')
}

const pageMetadata = (project, format) => {
  const [templateFormatId, templateFormatLabel, width, height] = format
  const model = templateModel(project)
  return {
    id: randomUUID(), name: `${project.name} · ${templateFormatLabel}`, type: 'RETAIL_OFFER', width, height,
    canvasSavedAt: new Date().toISOString(), templateModelId: model.id, templateModelName: model.name,
    templateFormatId, templateFormatLabel, templateThemeId: model.id, templateThemeName: model.name,
    templateCompositionManaged: true
  }
}

export const planTemplateStandardization = ({ project, loadedCanvases, donorZone }) => {
  const oldPages = Array.isArray(project.canvas_data) ? project.canvas_data : []
  const formatsPresent = new Set(oldPages.map((page) => String(page.templateFormatId || '')))
  const planned = []
  for (const page of oldPages) {
    const source = loadedCanvases.get(page.id)
    if (!source) throw new Error(`Canvas ausente da página ${page.id}`)
    const repairedSource = hasUsableFrame(source, page)
      ? source
      : createMissingFormatCanvas({
        project,
        sourceCanvas: source,
        donorZone,
        format: TEMPLATE_FORMATS.find(([id]) => id === page.templateFormatId) || ['feed', 'Feed 4:5', page.width, page.height]
      })
    let normalized
    try {
      normalized = normalizeTemplateCanvas({ canvas: repairedSource, page, donorZone, forceFooter: true, forceValidity: true })
    } catch (error) {
      throw new Error(`${project.name} · ${page.templateFormatId}: ${error instanceof Error ? error.message : String(error)}`)
    }
    planned.push({ page: deepCopy(page), canvas: normalized.canvas, changed: normalized.changed || repairedSource !== source, created: false, validation: normalized.validation })
  }
  const sourceCanvas = planned.find((entry) => hasUsableFrame(entry.canvas, entry.page))?.canvas || planned[0]?.canvas || null
  for (const format of TEMPLATE_FORMATS) {
    if (formatsPresent.has(format[0])) continue
    const page = pageMetadata(project, format)
    const canvas = createMissingFormatCanvas({ project, sourceCanvas, donorZone, format })
    const normalized = normalizeTemplateCanvas({ canvas, page, donorZone, forceFooter: true, forceValidity: true })
    planned.push({ page, canvas: normalized.canvas, changed: true, created: true, validation: normalized.validation })
  }
  const ordered = TEMPLATE_FORMATS.flatMap(([formatId]) => planned.filter((entry) => entry.page.templateFormatId === formatId))
  return ordered
}

const s3KeyFromRef = (value) => {
  const source = String(value || '').trim()
  if (!source) return ''
  if (source.startsWith('projects/') || source.startsWith('imagens/')) return source
  try {
    const url = new URL(source, 'http://local')
    return url.searchParams.get('key') || ''
  } catch { return '' }
}

const bodyToBuffer = async (body) => Buffer.from(await body.transformToByteArray())
const hash = (value) => createHash('sha256').update(value).digest('hex')

const mapWithConcurrency = async (values, limit, task) => {
  const result = new Array(values.length)
  let index = 0
  const worker = async () => {
    while (true) {
      const current = index++
      if (current >= values.length) return
      result[current] = await task(values[current], current)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, values.length)) }, worker))
  return result
}

const createClient = () => new S3Client({
  endpoint: process.env.WASABI_ENDPOINT?.startsWith('http') ? process.env.WASABI_ENDPOINT : `https://${process.env.WASABI_ENDPOINT}`,
  region: process.env.WASABI_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY }
})

const createDatabaseClient = () => {
  const client = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL })
  // A conexão de leitura não fica aberta durante os uploads longos. Ainda
  // assim, registrar o evento evita uma exceção não tratada em caso de queda.
  client.on('error', (error) => console.error(`[standardize] conexão do banco encerrada: ${error.message}`))
  return client
}

const readCanvas = async (s3, key) => {
  const response = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }))
  let bytes = await bodyToBuffer(response.Body)
  if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes)
  return JSON.parse(String(bytes))
}

const readThumbnail = async (s3, reference) => {
  const key = s3KeyFromRef(reference)
  if (!key) return null
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }))
    return await bodyToBuffer(response.Body)
  } catch { return null }
}

const svgOverlay = (width, height, horizontal) => {
  const footerH = horizontal ? Math.round(height * .108) : Math.round(height * .089)
  const footerTop = height - footerH
  const dateW = Math.round(width * (horizontal ? .37 : .52))
  const dateH = Math.max(34, Math.round(height * .075))
  const dateX = width - dateW - Math.max(8, Math.round(width * .018))
  const dateY = Math.max(8, Math.round(height * .018))
  const columns = ['INSTAGRAM', 'WHATSAPP', 'ENDEREÇO', 'CARTÕES']
  const text = columns.map((label, index) => {
    const x = Math.round(index * width / columns.length + 8)
    return `<text x="${x}" y="${footerTop + footerH * .30}" fill="#ffe500" font-family="Arial" font-weight="700" font-size="${Math.max(7, width / 86)}">${label}</text><text x="${x}" y="${footerTop + footerH * .67}" fill="white" font-family="Arial" font-weight="700" font-size="${Math.max(8, width / 64)}">${index === 0 ? '@SUALOJA' : index === 1 ? '(64) 99999-9999' : index === 2 ? 'ENDEREÇO DA LOJA' : 'VISA  MASTERCARD'}</text>`
  }).join('')
  const lines = [1, 2, 3].map((index) => `<rect x="${Math.round(index * width / 4)}" y="${footerTop + 5}" width="1" height="${footerH - 10}" fill="rgba(255,255,255,.45)"/>`).join('')
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${dateX}" y="${dateY}" width="${dateW}" height="${dateH}" rx="${Math.round(dateH*.14)}" fill="#0636a7" stroke="#ffe500" stroke-width="2"/><text x="${dateX + dateH*.13}" y="${dateY + dateH*.34}" fill="white" font-family="Arial" font-weight="700" font-size="${Math.max(7,width/96)}">OFERTA VÁLIDA DE</text><text x="${dateX + dateH*.13}" y="${dateY + dateH*.62}" fill="#ffe500" font-family="Arial" font-weight="900" font-size="${Math.max(9,width/67)}">14 A 19 DE SETEMBRO</text><text x="${dateX + dateH*.13}" y="${dateY + dateH*.84}" fill="white" font-family="Arial" font-weight="700" font-size="${Math.max(6,width/118)}">ENQUANTO DURAREM OS ESTOQUES</text><rect x="0" y="${footerTop}" width="${width}" height="${footerH}" fill="#0636a7" stroke="#ffe500" stroke-width="1"/>${lines}${text}</svg>`)
}

const buildThumbnail = async (buffer, width, height, horizontal) => {
  let sharp
  try { sharp = (await import('sharp')).default } catch { return buffer }
  const previewWidth = Math.min(600, Math.max(300, Math.round(width * .46)))
  const previewHeight = Math.max(200, Math.round(previewWidth * height / width))
  const base = buffer ? sharp(buffer).resize(previewWidth, previewHeight, { fit: 'cover' }) : sharp({ create: { width: previewWidth, height: previewHeight, channels: 4, background: '#0636a7' } })
  return base.composite([{ input: svgOverlay(previewWidth, previewHeight, horizontal), top: 0, left: 0 }]).png().toBuffer()
}

const cli = () => {
  const args = new Map(process.argv.slice(2).map((argument) => {
    const [key, value] = argument.split('=', 2)
    return [key, value || true]
  }))
  return { apply: args.has('--apply'), only: typeof args.get('--only') === 'string' ? args.get('--only') : '', output: typeof args.get('--output') === 'string' ? args.get('--output') : '' }
}

export const run = async () => {
  const { apply, only, output } = cli()
  const database = createDatabaseClient()
  await database.connect()
  const { rows } = await database.query(`select id,name,canvas_data,template_config,preview_url,updated_at from projects where user_id=$1 and is_template=true order by name`, [OWNER_ID])
  const candidates = rows.filter((project) => !EXCLUDED_TEMPLATE_IDS.has(project.id) && (!only || project.id === only))
  const s3 = createClient()
  let donorZone = null
  // A página sem formatos também recebe uma zona nativa. Usar um modelo
  // conhecido como doador mantém a receita de cards, sem copiar sua arte.
  const donorProject = rows.find((project) => project.id === DEFAULT_DONOR_TEMPLATE_ID)
  const donorPage = donorProject?.canvas_data?.find((page) => String(page?.canvasDataPath || '').trim())
  if (donorPage) {
    const donorCanvas = await readCanvas(s3, s3KeyFromRef(donorPage.canvasDataPath))
    donorZone = donorCanvas.objects?.find((object) => object?.isProductZone) || null
  }
  const plans = []
  const planningErrors = []
  for (const [projectIndex, project] of candidates.entries()) {
    if (apply) console.error(`[standardize] preparando ${projectIndex + 1}/${candidates.length}: ${project.name}`)
    try {
      const loaded = new Map()
      const templatePages = Array.isArray(project.canvas_data) ? project.canvas_data : []
      await mapWithConcurrency(templatePages, 8, async (page) => {
        const key = s3KeyFromRef(page.canvasDataPath)
        if (!key) return
        const canvas = await readCanvas(s3, key)
        loaded.set(page.id, canvas)
        donorZone ||= canvas.objects?.find((object) => object?.isProductZone) || null
      })
      const entries = planTemplateStandardization({ project, loadedCanvases: loaded, donorZone })
      const changed = entries.some((entry) => entry.changed || entry.created)
      if (changed) plans.push({ project, entries })
    } catch (error) {
      planningErrors.push({ id: project.id, name: project.name, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const summary = {
    mode: apply ? 'apply' : 'dry-run', owner: OWNER_ID,
    excludedTemplateIds: [...EXCLUDED_TEMPLATE_IDS],
    templatesScanned: candidates.length,
    templatesChanged: plans.length,
    pagesChanged: plans.reduce((total, plan) => total + plan.entries.filter((entry) => entry.changed).length, 0),
    pagesCreated: plans.reduce((total, plan) => total + plan.entries.filter((entry) => entry.created).length, 0),
    planningErrors,
    projects: plans.map(({ project, entries }) => ({ id: project.id, name: project.name, changed: entries.filter((entry) => entry.changed).map((entry) => entry.page.templateFormatId), created: entries.filter((entry) => entry.created).map((entry) => entry.page.templateFormatId) }))
  }
  if (!apply) {
    const outputPath = output || '/tmp/jobvarejo-template-standardization-plan.json'
    await writeFile(outputPath, JSON.stringify({ summary, plans: plans.map(({ project, entries }) => ({ project: { id: project.id, name: project.name }, entries: entries.map((entry) => ({ page: entry.page, changed: entry.changed, created: entry.created, validation: entry.validation, canvas: entry.canvas })) })) }, null, 2))
    console.log(JSON.stringify({ ...summary, output: outputPath }, null, 2))
    await database.end()
    s3.destroy()
    return summary
  }
  if (planningErrors.length) {
    await database.end()
    s3.destroy()
    throw new Error(`Há ${planningErrors.length} modelo(s) com validação pendente; execução cancelada antes de qualquer gravação.`)
  }

  // Os uploads podem levar minutos. Fechar a conexão de leitura impede que o
  // provedor encerre uma sessão ociosa antes da transação atômica final.
  await database.end().catch(() => undefined)
  const writeDatabase = createDatabaseClient()
  const revision = Date.now()
  const prepared = []
  try {
    for (const [planIndex, { project, entries }] of plans.entries()) {
      console.error(`[standardize] enviando ${planIndex + 1}/${plans.length}: ${project.name}`)
      const nextPages = await mapWithConcurrency(entries, 4, async (entry) => {
        const raw = Buffer.from(JSON.stringify(entry.canvas))
        const oldReference = Array.isArray(project.canvas_data) ? project.canvas_data.find((page) => page.id === entry.page.id) : null
        const originalThumb = oldReference ? await readThumbnail(s3, oldReference.thumbnailUrl) : null
        const horizontal = entry.page.templateFormatId === 'tv'
        const thumbnail = await buildThumbnail(originalThumb, entry.page.width, entry.page.height, horizontal)
        const prefix = `projects/${OWNER_ID}/${project.id}/standard-layout/${revision}`
        const canvasDataPath = `${prefix}/page_${entry.page.id}.json.gz`
        const thumbnailPath = `${prefix}/thumb_${entry.page.id}.png`
        await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: canvasDataPath, Body: gzipSync(raw), ContentType: 'application/json', ContentEncoding: 'gzip' }))
        await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: thumbnailPath, Body: thumbnail, ContentType: 'image/png' }))
        const stored = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: canvasDataPath }))
        let bytes = await bodyToBuffer(stored.Body)
        if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes)
        if (hash(bytes) !== hash(raw)) throw new Error(`Readback divergente: ${project.name} · ${entry.page.templateFormatId}`)
        return { ...entry.page, canvasDataPath, thumbnailUrl: thumbnailPath, canvasSavedAt: new Date().toISOString() }
      })
      const nextConfig = {
        ...(project.template_config || {}),
        version: 1,
        formatIds: TEMPLATE_FORMATS.map(([id]) => id),
        pageBlueprints: nextPages.map(({ id, ...page }) => ({ ...page, sourcePageId: id }))
      }
      const previewUrl = nextPages.find((page) => page.templateFormatId === 'feed')?.thumbnailUrl || nextPages[0]?.thumbnailUrl || project.preview_url
      prepared.push({ project, nextPages, nextConfig, previewUrl })
    }

    // Os arquivos novos no S3 são versionados e só passam a ser referenciados
    // quando todos os modelos puderem ser gravados juntos. Se alguém editar
    // um modelo durante a execução, a transação inteira é revertida e nenhum
    // modelo fica com uma composição diferente dos demais.
    console.error(`[standardize] vinculando ${prepared.length} modelos no banco`)
    await writeDatabase.connect()
    await writeDatabase.query('begin')
    try {
      for (const { project, nextPages, nextConfig, previewUrl } of prepared) {
        const result = await writeDatabase.query(
          `update projects set canvas_data=$1::jsonb, template_config=$2::jsonb, preview_url=$3, updated_at=now()
           where id=$4 and user_id=$5 and canvas_data=$6::jsonb returning id,name,updated_at`,
          [JSON.stringify(nextPages), JSON.stringify(nextConfig), previewUrl, project.id, OWNER_ID, JSON.stringify(project.canvas_data)]
        )
        if (result.rowCount !== 1) throw new Error(`Modelo alterado durante a atualização: ${project.name}`)
      }
      await writeDatabase.query('commit')
      console.error('[standardize] vínculo concluído')
    } catch (error) {
      await writeDatabase.query('rollback').catch(() => undefined)
      throw error
    }
  } finally {
    await writeDatabase.end().catch(() => undefined)
    s3.destroy()
  }
  const committed = prepared.map(({ project, nextPages }) => ({ id: project.id, name: project.name, pages: nextPages.length }))
  console.log(JSON.stringify({ ...summary, committed }, null, 2))
  return { ...summary, committed }
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  run().catch((error) => { console.error(error.stack || error); process.exitCode = 1 })
}
