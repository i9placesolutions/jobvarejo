import { paymentBrandSvg } from './paymentBrandSvg'
import { isBusinessPaymentCardId } from './paymentCards'

export const MAX_FOOTER_PAYMENT_IMAGES = 6
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

/** Compara fontes e tamanho no Fabric e no JSON, sem baixar as imagens novamente. */
export const isFooterPaymentGroupCurrent = (slot: any, values: unknown): boolean => {
  if (String(slot?.type || '').toLowerCase() !== 'group') return false
  const children = slot.getObjects?.() || slot.objects || []
  const bounds = children.find((child: any) => String(child?.type || '').toLowerCase() === 'rect')
  if (!bounds || Number(bounds.width) !== Number(slot.footerPaymentWidth || slot.width)
    || Number(bounds.height) !== Number(slot.footerPaymentHeight || slot.height)) return false
  const expected = normalizeFooterPaymentImages(values).map(footerPaymentImageUrl).filter(Boolean)
  const imageChildren = children.filter((child: any) => String(child?.type || '').toLowerCase() === 'image')
  const actual = imageChildren.map((child: any) => String(child.__originalSrc || child.getSrc?.() || child.src || ''))
  const grid = Number(slot.footerPaymentColumns) === 3
  if (slot.footerPaymentColumns != null && !grid) return false
  const tiles = children.filter((child: any) => String(child?.type || '').toLowerCase() === 'rect').length - 1
  if (tiles !== (slot.footerPaymentTile ? expected.length : 0)) return false
  // Um grupo salvo em grade tem duas faixas quando há mais de três marcas;
  // o fluxo legado em linha mantém todas as imagens na mesma faixa.
  const tops = imageChildren.map((child: any) => Number(child.top ?? child.y)).filter(Number.isFinite)
  if (tops.length === imageChildren.length && tops.length > 1) {
    const rows = [...tops].sort((a, b) => a - b).reduce((values, top) => {
      if (!values.length || Math.abs(top - values[values.length - 1]!) > 1) values.push(top)
      return values
    }, [] as number[])
    const expectsTwoRows = grid && expected.length > 3
    if (expectsTwoRows !== (rows.length > 1)) return false
  } else if (grid && expected.length > 3) return false
  return expected.length === actual.length && expected.every((source, index) => source === actual[index])
}

/** Rebuild only the image row; the saved slot geometry stays stable. */
export async function createFooterPaymentGroup(fabric: any, slot: any, values: unknown) {
  const width = Number(slot.footerPaymentWidth || slot.width)
  const height = Number(slot.footerPaymentHeight || slot.height)
  const objects: any[] = [new fabric.Rect({ left: 0, top: 0, width, height, fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' })]
  const images = normalizeFooterPaymentImages(values)
  const grid = Number(slot.footerPaymentColumns) === 3
  const columns = grid ? 3 : Math.max(1, images.length)
  const rows = grid ? Math.max(1, Math.ceil(images.length / 3)) : 1
  const gapX = width * .025
  const gapY = height * .06
  const cellWidth = (width - gapX * Math.max(0, columns - 1)) / columns
  const cellHeight = (height - gapY * Math.max(0, rows - 1)) / rows
  // Bandeiras com fundo transparente precisam de um azulejo próprio em rodapés escuros.
  const tile = typeof slot.footerPaymentTile === 'string' && slot.footerPaymentTile.trim() ? slot.footerPaymentTile.trim() : ''
  const tileHeight = Math.min(cellHeight, cellWidth * .68)
  const tileWidth = Math.min(cellWidth, tileHeight * 1.7)
  for (const [index, source] of images.entries()) {
    const url = footerPaymentImageUrl(source)
    if (!url) continue
    const image = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    const column = grid ? index % 3 : index
    const row = grid ? Math.floor(index / 3) : 0
    const centerX = column * (cellWidth + gapX) + cellWidth / 2
    const centerY = row * (cellHeight + gapY) + cellHeight / 2
    if (tile) objects.push(new fabric.Rect({ left: centerX, top: centerY, width: tileWidth, height: tileHeight, rx: tileHeight * .16, ry: tileHeight * .16, fill: tile, strokeWidth: 0, originX: 'center', originY: 'center' }))
    const scale = tile ? Math.min(tileWidth * .86 / image.width, tileHeight * .8 / image.height) : Math.min(cellWidth / image.width, cellHeight / image.height)
    image.set({ left: centerX, top: centerY, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale })
    image.__originalSrc = url
    objects.push(image)
  }
  const group = new fabric.Group(objects, { left: slot.left, top: slot.top, originX: slot.originX || 'left', originY: slot.originY || 'top', scaleX: slot.scaleX || 1, scaleY: slot.scaleY || 1, angle: slot.angle || 0, objectCaching: false })
  Object.assign(group, { _customId: slot._customId, parentFrameId: slot.parentFrameId, name: 'footer-payment-images', layerName: 'Cartões aceitos', businessProfileField: 'footerPaymentImages', quickFieldEnabled: slot.quickFieldEnabled !== false, footerPaymentWidth: width, footerPaymentHeight: height, ...(grid ? { footerPaymentColumns: 3 } : {}), ...(tile ? { footerPaymentTile: tile } : {}) })
  return group
}
