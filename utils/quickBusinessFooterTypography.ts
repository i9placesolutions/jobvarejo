import { getDynamicBusinessField, fitDynamicBusinessTextObject } from './dynamicBusinessFields'

/** Reflow contacts while preserving all typography defined by the template. */
export const normalizeQuickBusinessFooter = (object: any): boolean => {
  const field = getDynamicBusinessField(object)
  if (!['address', 'instagram', 'whatsapp'].includes(field) || typeof object?.set !== 'function') return false
  const before = JSON.stringify([object.text, object.fontSize, object.styles, object.textAlign, object.lineHeight])
  const anchor = object.getPointByOrigin?.('left', 'top')
  fitDynamicBusinessTextObject(object)
  if (field === 'address' && !object.__manualTypography && (object.textLines?.length || 0) > 1 && !String(object.text).includes('\n')) {
    const text = String(object.text)
    // Prefer the separation between street/number and neighborhood/city.
    const candidates = [...text.matchAll(/,\s*/g)].map(match => match.index! + match[0].length)
      .filter(index => index > text.length * 0.3 && index < text.length * 0.7)
      .sort((a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2))
    const split = candidates[0]
    if (split) {
      const width = object.width
      object.set('text', text.slice(0, split).trimEnd() + '\n' + text.slice(split).trimStart())
      fitDynamicBusinessTextObject(object, { maxWidth: width })
      // Do not turn a two-line address into three lines just to balance it.
      if (object.textLines?.length > 2) {
        object.set('text', text)
        fitDynamicBusinessTextObject(object, { maxWidth: width })
      }
    }
  }
  if (anchor) object.setPositionByOrigin?.(anchor, 'left', 'top')
  object.setCoords?.()
  return before !== JSON.stringify([object.text, object.fontSize, object.styles, object.textAlign, object.lineHeight])
}
