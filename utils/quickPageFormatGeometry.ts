import { FLYER_TEMPLATE_FORMATS } from './flyerTemplateApi'

/** The single artboard is authoritative for already-materialized quick pages. */
export const reconcileQuickPageFormatGeometry = (page: any, objects: any[]): boolean => {
  if (!page) return false
  const frames = objects.filter(object => object?.isFrame && !object.parentFrameId && object.visible !== false)
  if (frames.length !== 1) return false
  const frame = frames[0]
  const width = Math.round(Number(frame.width) * Math.abs(Number(frame.scaleX ?? 1)))
  const height = Math.round(Number(frame.height) * Math.abs(Number(frame.scaleY ?? 1)))
  const format = FLYER_TEMPLATE_FORMATS.find(item => item.width === width && item.height === height)
  if (!format) return false
  if (page.width === width && page.height === height && page.templateFormatId === format.id && page.templateFormatLabel === format.label) return false
  Object.assign(page, {
    width, height, templateFormatId: format.id, templateFormatLabel: format.label,
    thumbnail: undefined, thumbnailUrl: undefined, thumbnailDirty: true, dirty: true
  })
  return true
}
