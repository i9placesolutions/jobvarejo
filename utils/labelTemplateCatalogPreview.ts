import { toWasabiProxyUrl } from './storageProxy'

/** Renderiza a própria arte Fabric quando o catálogo ainda não tem miniatura. */
export const renderLabelTemplateCatalogPreview = async (serializedGroup: any): Promise<string | null> => {
  if (!import.meta.client || !serializedGroup || typeof serializedGroup !== 'object') return null

  const fabric = await import('fabric')
  const groupJson = JSON.parse(JSON.stringify(serializedGroup))
  const normalizeImages = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (String(node.type || '').toLowerCase() === 'image' && typeof node.src === 'string') {
      node.src = toWasabiProxyUrl(node.__originalSrc || node.src) || node.src
      node.crossOrigin = 'anonymous'
    }
    if (Array.isArray(node.objects)) node.objects.forEach(normalizeImages)
  }
  normalizeImages(groupJson)

  const canvasElement = document.createElement('canvas')
  const preview = new fabric.StaticCanvas(canvasElement, {
    width: 320,
    height: 160,
    backgroundColor: 'transparent',
    enableRetinaScaling: false
  })
  try {
    const [group] = await fabric.util.enlivenObjects([groupJson]) as any[]
    if (!group || typeof group.getBoundingRect !== 'function') return null
    preview.add(group)
    group.setCoords()
    const bounds = group.getBoundingRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null
    const fit = Math.min(288 / bounds.width, 128 / bounds.height)
    group.scaleX *= fit
    group.scaleY *= fit
    group.setCoords()
    const fitted = group.getBoundingRect()
    group.set({
      left: Number(group.left || 0) + 160 - (fitted.left + fitted.width / 2),
      top: Number(group.top || 0) + 80 - (fitted.top + fitted.height / 2)
    })
    group.setCoords()
    preview.renderAll()
    return preview.toDataURL({ format: 'png', multiplier: 1 })
  } finally {
    await preview.dispose()
  }
}
