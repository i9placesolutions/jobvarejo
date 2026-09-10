import { paymentBrandSvg } from './paymentBrandSvg'
import { isBusinessPaymentCardId } from './paymentCards'

export const MAX_FOOTER_PAYMENT_IMAGES = 5
export const normalizeFooterPaymentImages = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(v => v && v.length < 2048 && !/^(data:|blob:|javascript:)/i.test(v)))].slice(0, MAX_FOOTER_PAYMENT_IMAGES)
  : []
export const footerPaymentImageUrl = (value: string): string => {
  if (value.startsWith('brand:')) {
    const id = value.slice(6)
    if (isBusinessPaymentCardId(id)) return `/cartoes/${id}.png`
    const svg = paymentBrandSvg[id === 'amex' ? 'americanexpress' : id]
    return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}` : ''
  }
  return /^(https?:\/\/|\/)/i.test(value) ? value : `/api/storage/p?key=${encodeURIComponent(value)}`
}

/** Rebuild only the image row; the saved slot geometry stays stable. */
export async function createFooterPaymentGroup(fabric: any, slot: any, values: unknown) {
  const width = Number(slot.footerPaymentWidth || slot.width)
  const height = Number(slot.footerPaymentHeight || slot.height)
  const objects: any[] = [new fabric.Rect({ left: 0, top: 0, width, height, fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' })]
  const images = normalizeFooterPaymentImages(values)
  const gap = width * .025
  const cell = (width - gap * 4) / 5
  for (const [index, source] of images.entries()) {
    const url = footerPaymentImageUrl(source)
    if (!url) continue
    const image = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const scale = Math.min(cell / image.width, height / image.height)
    image.set({ left: index * (cell + gap) + cell / 2, top: height / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale })
    image.__originalSrc = url
    objects.push(image)
  }
  const group = new fabric.Group(objects, { left: slot.left, top: slot.top, originX: slot.originX || 'left', originY: slot.originY || 'top', scaleX: slot.scaleX || 1, scaleY: slot.scaleY || 1, angle: slot.angle || 0, objectCaching: false })
  Object.assign(group, { _customId: slot._customId, parentFrameId: slot.parentFrameId, name: 'footer-payment-images', layerName: 'Cartões aceitos', businessProfileField: 'footerPaymentImages', quickFieldEnabled: slot.quickFieldEnabled !== false, footerPaymentWidth: width, footerPaymentHeight: height })
  return group
}
