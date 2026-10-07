import type { WorkProductDesign } from '../../shared/work-design'
import { workDecorationObject } from '../../utils/workDesignGeometry'
import { createRichPriceTextDefinition } from '../../utils/priceRichText'
import { autoTrimFabricImageAsync } from '../../utils/fabricImageHelpers'

/** Objetos Fabric comuns, nas posições desenhadas pelo consumidor. Sem receita do editor rápido. */
export async function createWorkProductCard(fabric: any, product: any, slot: { left: number; top: number; width: number; height: number },
  design: WorkProductDesign, styles: any, zoneId: string) {
  const w = slot.width, h = slot.height
  const children: any[] = []
  const positioned = (box: any) => ({ left: box.x - w / 2, top: box.y - h / 2,
    originX: 'left', originY: 'top', strokeWidth: 0, selectable: false, evented: false, __manualTransform: true })
  children.push(new fabric.Rect({ ...positioned({ x: 0, y: 0 }), width: w, height: h,
    fill: design.surface?.color || 'transparent', rx: design.surface?.radius || 0, ry: design.surface?.radius || 0, name: 'card_bg' }))
  for (const decoration of design.decorations) {
    if (decoration.kind === 'image') {
      const image = await fabric.FabricImage.fromURL(decoration.assetKey)
      const scale = Math.min(decoration.box.width / image.width, decoration.box.height / image.height)
      image.set({ ...positioned(decoration.box), scaleX: scale, scaleY: scale, opacity: decoration.opacity ?? 1 })
      children.push(image)
    } else {
      const node = workDecorationObject(decoration)
      const [object] = await fabric.util.enlivenObjects([node])
      object.set({ ...positioned(decoration.box), strokeWidth: decoration.strokeWidth || 0 }); children.push(object)
    }
  }
  const photo = await fabric.FabricImage.fromURL(product.imageDataUrl || product.imageUrl)
  await autoTrimFabricImageAsync(photo, { preserveVisualPosition: false })
  const imageScale = Math.min(design.image.width / photo.width, design.image.height / photo.height)
  photo.set({ ...positioned(design.image), left: design.image.x - w / 2 + (design.image.width - photo.width * imageScale) / 2,
    top: design.image.y - h / 2 + (design.image.height - photo.height * imageScale) / 2,
    scaleX: imageScale, scaleY: imageScale, name: 'smart_image', data: { smartType: 'product-image' } })
  children.push(photo)
  const name = new fabric.Textbox(product.name, { ...positioned(design.name.box), width: design.name.box.width,
    fontFamily: design.name.style.fontFamily, fontSize: design.name.style.fontSize,
    fill: design.name.style.color, fontWeight: design.name.style.bold ? 800 : 400,
    textAlign: design.name.style.align, lineHeight: 1.02, name: 'smart_title', __manualTypography: true })
  if (name.height > design.name.box.height + 2) throw new Error(`O nome ${product.name} precisa de mais espaço no card.`)
  children.push(name)
  const price = design.price, priceChildren: any[] = []
  const labelWidth = price.box.width, labelHeight = price.box.height
  priceChildren.push(new fabric.Rect({ width: labelWidth, height: labelHeight,
    originX: 'center', originY: 'center', fill: price.background || 'transparent', rx: price.radius, ry: price.radius, strokeWidth: 0, name: 'price_bg' }))
  const currency = new fabric.Text('R$', { fontFamily: price.style.fontFamily, fontSize: price.style.fontSize * price.currencyScale,
    fontWeight: price.style.bold ? 800 : 400, fill: price.style.color, originX: 'left', originY: 'center', name: 'price_currency_text' })
  const definition = createRichPriceTextDefinition({ text: String(product.price).replace('.', ','), fontSize: price.style.fontSize,
    integerStyle: { fontFamily: price.style.fontFamily, fontSize: price.style.fontSize, fontWeight: price.style.bold ? '900' : '400', fill: price.style.color },
    decimalStyle: { fontFamily: price.style.fontFamily, fontSize: price.style.fontSize * price.decimalScale, fontWeight: price.style.bold ? '800' : '400', fill: price.style.color } })
  const [value] = await fabric.util.enlivenObjects([definition])
  value.set({ originX: 'left', originY: 'center', __manualTypography: true })
  const gap = labelHeight * .08, padding = Math.min(12, labelWidth * .04)
  const textWidth = currency.width + gap + value.width
  const unitSpace = product.unit ? Math.max(12, labelHeight * .14) + 4 : 0
  const textScale = Math.min(1, (labelWidth - padding * 2) / textWidth, (labelHeight - padding - unitSpace) / Math.max(value.height, currency.height))
  if (price.style.fontSize * textScale < 16) throw new Error(`Preço de ${product.name} pequeno demais para leitura.`)
  const textLeft = price.style.align === 'left' ? -labelWidth / 2 + padding
    : price.style.align === 'right' ? labelWidth / 2 - padding - textWidth * textScale : -textWidth * textScale / 2
  currency.set({ left: textLeft, top: labelHeight * .12 - unitSpace / 2, scaleX: textScale, scaleY: textScale })
  value.set({ left: textLeft + (currency.width + gap) * textScale, top: -unitSpace / 2, scaleX: textScale, scaleY: textScale })
  priceChildren.push(currency, value)
  if (product.unit) priceChildren.push(new fabric.Text(product.unit, { name: 'price_unit_text',
    fontFamily: price.style.fontFamily, fontSize: Math.max(12, labelHeight * .14), fill: price.style.color,
    left: labelWidth / 2 - padding, top: labelHeight / 2 - padding, originX: 'right', originY: 'bottom' }))
  const priceGroup = new fabric.Group(priceChildren, { name: 'priceGroup', originX: 'center', originY: 'center',
    left: price.box.x - w / 2 + labelWidth / 2, top: price.box.y - h / 2 + labelHeight / 2,
    selectable: false, evented: false, __isCustomTemplate: true, __preserveManualLayout: true,
    __manualTransform: true, __manualTypography: true })
  children.push(priceGroup)
  const metadata = { ...product }; delete metadata.imageDataUrl
  return new fabric.Group(children, { left: slot.left + w / 2, top: slot.top + h / 2,
    originX: 'center', originY: 'center', width: w, height: h, name: 'productCard',
    isSmartObject: true, isProductCard: true, _customId: crypto.randomUUID(),
    _cardWidth: w, _cardHeight: h, _productData: metadata, parentZoneId: zoneId, productZoneId: zoneId,
    productItemId: product.id, subTargetCheck: true, interactive: true, objectCaching: false })
}
