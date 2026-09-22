/** Conteúdo do cliente atravessa formatos; geometria pertence ao destino. */
export const captureFormatDynamicContent = (objects: any[]): any[] => {
  const result: any[] = []
  const visit = (items: any[]) => items.forEach(object => {
    if (object.dynamicUserTextSource === 'quick-user') result.push({
      name: object.name,
      field: object.businessProfileField || object.quickDataField,
      dynamicUserText: object.dynamicUserText ?? object.text ?? '',
      dynamicUserTextSource: 'quick-user',
      quickFieldEnabled: object.quickFieldEnabled
    })
    visit(object.getObjects?.() || object.objects || [])
  })
  visit(objects)
  return result
}

export const restoreFormatDynamicContent = (objects: any[], content: any[]) => {
  const visit = (items: any[]) => items.forEach(object => {
    const field = object.businessProfileField || object.quickDataField
    const match = content.find(item => item.name && item.name === object.name)
      || content.find(item => item.field && item.field === field)
    if (match) {
      const values = { dynamicUserText: match.dynamicUserText, dynamicUserTextSource: 'quick-user',
        ...(match.quickFieldEnabled !== undefined ? { quickFieldEnabled: match.quickFieldEnabled } : {}) }
      if (object.set) object.set(values)
      else Object.assign(object, values)
    }
    visit(object.getObjects?.() || object.objects || [])
  })
  visit(objects)
}

const productImages = (card: any) => (card.getObjects?.() || []).filter((object: any) =>
  String(object.type || '').toLowerCase() === 'image' &&
  (object.data?.smartType === 'product-image' || /^(smart_image|product_image|extra_image)(_|$)/.test(object.name || '')))

/** Reencaixa a composição de imagens sem perder cópias nem suas proporções. */
export const fitFormatProductImages = (card: any, target: any) => {
  const images = productImages(card)
  const targets = productImages(target)
  if (!images.length || !targets.length) return
  const bounds = (items: any[]) => {
    const boxes = items.map(object => {
      const center = object.getRelativeCenterPoint()
      const width = Math.abs(object.getScaledWidth())
      const height = Math.abs(object.getScaledHeight())
      return { left: center.x - width / 2, top: center.y - height / 2, right: center.x + width / 2, bottom: center.y + height / 2 }
    })
    const left = Math.min(...boxes.map(b => b.left)), top = Math.min(...boxes.map(b => b.top))
    const width = Math.max(...boxes.map(b => b.right)) - left, height = Math.max(...boxes.map(b => b.bottom)) - top
    return { x: left + width / 2, y: top + height / 2, width, height }
  }
  const source = bounds(images), destination = bounds(targets)
  const scale = Math.min(destination.width / source.width, destination.height / source.height)
  if (!Number.isFinite(scale) || scale <= 0) return
  images.forEach((object: any) => {
    const center = object.getRelativeCenterPoint()
    object.set({ scaleX: object.scaleX * scale, scaleY: object.scaleY * scale })
    object.setPositionByOrigin({ x: destination.x + (center.x - source.x) * scale,
      y: destination.y + (center.y - source.y) * scale }, 'center', 'center')
    if (object.__manualTransform) {
      object.__manualTransformCardW = card._cardWidth || card.width
      object.__manualTransformCardH = card._cardHeight || card.height
    }
    object.setCoords?.()
  })
  card.dirty = true
}
