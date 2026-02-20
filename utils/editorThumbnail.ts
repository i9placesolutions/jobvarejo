type GenerateThumbnailFromCanvasJsonOptions = {
  sourceJson: any
  staticCanvasCtor: any
  pageWidth?: number
  pageHeight?: number
  defaultWidth?: number
  defaultHeight?: number
}

const stripClipPathsRecursively = (node: any): void => {
  if (!node || typeof node !== 'object') return
  if (Object.prototype.hasOwnProperty.call(node, 'clipPath')) {
    delete node.clipPath
  }
  if (Object.prototype.hasOwnProperty.call(node, '_frameClipOwner')) {
    delete node._frameClipOwner
  }
  Object.values(node).forEach((value: any) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach((item: any) => stripClipPathsRecursively(item))
      return
    }
    if (typeof value === 'object') {
      stripClipPathsRecursively(value)
    }
  })
}

export const generateThumbnailFromCanvasJson = async (
  opts: GenerateThumbnailFromCanvasJsonOptions
): Promise<string> => {
  if (!opts.staticCanvasCtor || typeof document === 'undefined') return ''

  const width = Math.max(1, Math.round(Number(opts.pageWidth || opts.defaultWidth || 1080)))
  const height = Math.max(1, Math.round(Number(opts.pageHeight || opts.defaultHeight || 1920)))
  const el = document.createElement('canvas')
  el.width = width
  el.height = height

  const sc = new opts.staticCanvasCtor(el, {
    width,
    height,
    backgroundColor: '#ffffff',
    renderOnAddRemove: false
  })

  try {
    const thumbJson = JSON.parse(JSON.stringify(opts.sourceJson || {}))
    stripClipPathsRecursively(thumbJson)
    await sc.loadFromJSON(thumbJson)
    sc.renderAll()
    return sc.toDataURL({
      format: 'jpeg',
      quality: 0.5,
      multiplier: 0.1
    })
  } catch (err) {
    console.warn('[Thumbnail] Falha ao gerar thumbnail em canvas offscreen:', err)
    return ''
  } finally {
    try {
      sc.dispose?.()
    } catch {
      // ignore
    }
  }
}
