import { Rect, util } from 'fabric'

const PRODUCT_LIMIT_TEXT_COLOR = '#ffffff'
const PRODUCT_LIMIT_BADGE_COLOR = '#b91c1c'

/** O limite acompanha a altura final do nome, inclusive após quebra de linha. */
export const positionProductLimitBelowName = (card: any, width: number, height: number) => {
  const children = card?.getObjects?.() || []
  const title = children.find((node: any) => node.name === 'smart_title')
  const limit = children.find((node: any) => ['smart_limit', 'limitText', 'product_limit'].includes(node.name) || node.data?.smartType === 'product-limit')
  let badge = children.find((node: any) => node.name === 'product_limit_badge')
  if (!limit || !title || title.visible === false) {
    badge?.set?.({ visible: false })
    return
  }
  if (!String(limit.text || '').trim()) {
    limit.set?.({ visible: false })
    badge?.set?.({ visible: false })
    return
  }
  if (limit.visible === false) {
    badge?.set?.({ visible: false })
    return
  }
  const maxWidth = width * 0.84
  const padX = Math.max(3, width * 0.022)
  const padY = Math.max(2, height * 0.007)
  limit.set?.({ backgroundColor: '', fill: PRODUCT_LIMIT_TEXT_COLOR, textBackgroundColor: '', stroke: null, strokeWidth: 0,
    fontFamily: 'Barlow', fontWeight: 700, fontSize: Math.max(1, Math.min(width * 0.05, height * 0.052)),
    scaleX: 1, scaleY: 1, width: maxWidth - padX * 2, textAlign: 'center', lineHeight: 1.05 })
  for (const line of Object.values(limit.styles || {})) {
    for (const style of Object.values(line as any)) {
      if (style && typeof style === 'object') {
        delete (style as any).fontSize
        delete (style as any).fontFamily
        delete (style as any).fontWeight
        delete (style as any).fill
        delete (style as any).textBackgroundColor
      }
    }
  }
  title.initDimensions?.()
  limit.initDimensions?.()
  const titleHeight = Math.abs(Number(title.height || 0) * Number(title.scaleY ?? 1))
  const titleTop = Number(title.top || 0) - titleHeight * (title.originY === 'center' ? 0.5 : title.originY === 'bottom' ? 1 : 0)
  const titleWidth = Math.abs(Number(title.width || width * 0.9) * Number(title.scaleX ?? 1))
  const titleCenter = Number(title.left || 0) + titleWidth * (title.originX === 'left' ? 0.5 : title.originX === 'right' ? -0.5 : 0)
  const measured = Number(limit.calcTextWidth?.())
  if (Number.isFinite(measured) && measured > 0) {
    limit.set?.({ width: Math.min(maxWidth - padX * 2, measured + 2) })
    limit.initDimensions?.()
  }
  const top = titleTop + titleHeight + Math.max(3, height * 0.012)
  limit.set?.({ originX: 'center', originY: 'top', left: titleCenter, top: top + padY })
  const isNewBadge = !badge && !!card.insertAt
  if (isNewBadge) {
    badge = new Rect({ selectable: false, evented: false, strokeWidth: 0 })
    badge.set('name', 'product_limit_badge')
  }
  badge?.set?.({ originX: 'center', originY: 'top', left: titleCenter, top,
    width: Math.min(maxWidth, Number(limit.width) + padX * 2), height: Number(limit.height) + padY * 2,
    rx: Math.max(3, width * 0.015), ry: Math.max(3, width * 0.015),
    fill: PRODUCT_LIMIT_BADGE_COLOR, stroke: PRODUCT_LIMIT_BADGE_COLOR, strokeWidth: Math.max(0.5, width * 0.002),
    scaleX: 1, scaleY: 1, visible: true })
  if (isNewBadge) {
    // insertAt recebe coordenadas do canvas e as converte para o grupo.
    if (card.calcTransformMatrix) util.sendObjectToPlane(badge, card.calcTransformMatrix())
    // Decoração interna não deve recalcular o tamanho/centro do card salvo.
    const manager = card.layoutManager
    const performLayout = manager?.performLayout
    if (manager) manager.performLayout = () => {}
    try {
      card.insertAt(children.indexOf(limit), badge)
    } finally {
      if (manager) manager.performLayout = performLayout
    }
  }
  badge?.setCoords?.()
  limit.dirty = true
  limit.setCoords?.()
  card.dirty = true
}
