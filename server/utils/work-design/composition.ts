import { createError } from 'h3'
import { WORK_FORMATS, type WorkJob, type WorkLayout } from '../../../shared/work-design'
import { normalizeBusinessProfile } from '../../../utils/businessProfile'
import { createEditableLabelTemplateGroup } from '../../../utils/labelTemplateFactory'

export type WorkBinding = { id: string; value: string; kind: 'text' | 'image' }
export function workBindings(job: Pick<WorkJob, 'business' | 'request'>): WorkBinding[] {
  const profile = normalizeBusinessProfile(job.business)
  const values: WorkBinding[] = [
    { id: 'companyName', value: profile.companyName, kind: 'text' },
    { id: 'logo', value: profile.logo, kind: 'image' },
    { id: 'validity', value: job.request.validity, kind: 'text' },
    { id: 'conditions', value: job.request.conditions, kind: 'text' },
    ...profile.addresses.map(a => ({ id: `address:${a.id}`, value: [a.label, a.value].filter(Boolean).join(' — '), kind: 'text' as const })),
    ...profile.whatsappNumbers.map(a => ({ id: `whatsapp:${a.id}`, value: [a.label, a.value].filter(Boolean).join(' — '), kind: 'text' as const })),
    ...(['phone', 'instagram', 'facebook', 'website', 'slogan', 'hours', 'paymentNotes'] as const)
      .map(id => ({ id, value: profile[id], kind: 'text' as const }))
  ]
  return values.filter(v => v.value)
}
const intersects = (a: any, b: any) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 &&
  a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1

export function validateWorkLayout(job: Pick<WorkJob, 'business' | 'request'>, layout: WorkLayout) {
  const bindings = workBindings(job)
  const formats = job.request.formats
  for (const page of layout.pages) {
    if (!formats.includes(page.format)) throw createError({ statusCode: 422, statusMessage: 'Formato não solicitado.' })
    const size = WORK_FORMATS[page.format]
    const boxes = [...page.fields.map(f => f.box), ...page.slots.map(s => s.box), ...(page.heading ? [page.heading.box] : [])]
    for (const box of [...boxes, ...page.decorations.map(d => d.box)])
      if (box.x + box.width > size.width || box.y + box.height > size.height)
        throw createError({ statusCode: 422, statusMessage: 'Objeto fora da página.' })
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
      if (intersects(boxes[i], boxes[j])) throw createError({ statusCode: 422, statusMessage: 'Dados e produtos sobrepostos.' })
    if (page.slots.some(s => s.box.width < size.width * .12 || s.box.height < size.height * .08))
      throw createError({ statusCode: 422, statusMessage: 'Área de produto insuficiente.' })
    const fieldIds = page.fields.map(f => f.binding)
    if (new Set(fieldIds).size !== fieldIds.length || bindings.some(b => !fieldIds.includes(b.id)) || fieldIds.some(id => !bindings.some(b => b.id === id)))
      throw createError({ statusCode: 422, statusMessage: 'Todos os dados da loja devem estar presentes em blocos separados.' })
    for (const decoration of page.decorations)
      if ((decoration.kind === 'image' && !decoration.assetKey) || (decoration.kind === 'rect' && !decoration.color))
        throw createError({ statusCode: 422, statusMessage: 'Decoração sem recurso ou cor.' })
    // O motor nativo ordena as zonas por posição. Exigir a mesma ordem evita trocar produtos.
    const ordered = [...page.slots].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    if (ordered.some((slot, i) => slot.productId !== page.slots[i]?.productId))
      throw createError({ statusCode: 422, statusMessage: 'Organize os produtos na ordem da leitura.' })
    const limit = page.format === 'stories' ? 9 : 16
    if (page.slots.length > limit) throw createError({ statusCode: 422, statusMessage: 'Divida os produtos em mais páginas.' })
  }
  for (const format of formats) {
    const ids = layout.pages.filter(p => p.format === format).flatMap(p => p.slots.map(s => s.productId))
    if (ids.join('|') !== job.request.products.map(p => p.id).join('|'))
      throw createError({ statusCode: 422, statusMessage: 'Preserve todos os produtos, uma vez, na ordem enviada em cada formato.' })
  }
}

/** Template declarativo. Apenas peças permitidas e valores do pedido viram objetos Fabric. */
export async function compileWorkPage(job: Pick<WorkJob, 'id' | 'business' | 'request'>,
  page: WorkLayout['pages'][number], image: (ref: string) => Promise<{ dataUrl: string; width: number; height: number }>) {
  const size = WORK_FORMATS[page.format], frameId = `${job.id}:${page.format}:frame`
  const priceTemplateId = `work-price-${job.id}-${page.format}`
  const priceTemplate = createEditableLabelTemplateGroup()
  for (const node of priceTemplate.objects) {
    const background = node.name === 'price_bg'
    node.fill = background ? page.cardStyle.priceBackground : page.cardStyle.priceColor
    node.__originalFill = node.fill
    node.strokeWidth = 0; node.shadow = null
    if (node.fontFamily) node.fontFamily = 'Barlow'
    for (const key of ['__priceRichIntegerStyle', '__priceRichDecimalStyle']) {
      if (node[key]) node[key] = { ...node[key], fill: page.cardStyle.priceColor, shadow: null, fontFamily: 'Barlow' }
    }
    for (const line of Object.values(node.styles || {}) as any[]) for (const character of Object.values(line) as any[]) {
      character.fill = page.cardStyle.priceColor; character.shadow = null
      if (character.fontFamily) character.fontFamily = 'Barlow'
    }
  }
  const objects: any[] = [{ type: 'Rect', left: 0, top: 0, width: size.width, height: size.height, fill: page.background,
    strokeWidth: 0, originX: 'left', originY: 'top', isFrame: true, clipContent: true, _customId: frameId, name: 'FRAMER', layerName: 'FRAMER' }]
  const base = (box: any, id: string) => ({ left: box.x, top: box.y, width: box.width, height: box.height,
    originX: 'left', originY: 'top', strokeWidth: 0, _customId: `${frameId}:${id}`, parentFrameId: frameId })
  const addImage = async (box: any, ref: string, id: string) => {
    const asset = await image(ref), scale = Math.min(box.width / asset.width, box.height / asset.height)
    objects.push({ ...base(box, id), type: 'Image', src: asset.dataUrl, __originalSrc: ref,
      width: asset.width, height: asset.height, scaleX: scale, scaleY: scale,
      left: box.x + (box.width - asset.width * scale) / 2, top: box.y + (box.height - asset.height * scale) / 2,
      name: `work-${id}`, data: { workBinding: id }, ...(id === 'logo' ? { quickLogoSource: ref, quickLogoSlot: true } : {}) })
  }
  const addText = (box: any, style: any, text: string, id: string) => objects.push({ ...base(box, id), type: 'Textbox',
    text, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.bold ? 800 : 400,
    fill: style.color, textAlign: style.align, lineHeight: 1.08, name: `work-${id}`, data: { workBinding: id } })
  for (const [index, d] of page.decorations.entries()) {
    if (d.kind === 'image') await addImage(d.box, d.assetKey!, `decoration-${index}`)
    else objects.push({ ...base(d.box, `decoration-${index}`), type: 'Rect', fill: d.color, rx: d.radius, ry: d.radius })
  }
  if (page.heading) addText(page.heading.box, page.heading.style, page.heading.text, 'heading')
  const bindings = workBindings(job)
  for (const field of page.fields) {
    const binding = bindings.find(b => b.id === field.binding)!
    if (binding.kind === 'image') await addImage(field.box, binding.value, binding.id)
    else addText(field.box, field.style, binding.value, binding.id)
  }
  for (const [index, slot] of page.slots.entries()) objects.push({ ...base(slot.box, `zone-${index}`),
    type: 'Rect', name: 'productZoneContainer', fill: 'transparent', isProductZone: true, isGridZone: true,
    _zoneWidth: slot.box.width, _zoneHeight: slot.box.height, _zonePadding: 0, contentStatus: 'empty',
    _zoneGlobalStyles: { isProdBgTransparent: false, cardColorMode: 'manual', cardColor: page.cardStyle.background,
      splashTemplateId: priceTemplateId,
      prodNameColor: page.cardStyle.nameColor, prodNameFont: 'Barlow', splashColor: page.cardStyle.priceBackground,
      splashFill: page.cardStyle.priceBackground, splashTextColor: page.cardStyle.priceColor, priceTextColor: page.cardStyle.priceColor,
      productPalette: { cardColor: page.cardStyle.background, prodNameColor: page.cardStyle.nameColor } } })
  return { version: '7.1.0', width: size.width, height: size.height, objects,
    __labelTemplates: [{ id: priceTemplateId, name: 'Preço da campanha', group: priceTemplate }] }
}
