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

  const THUMB_MULTIPLIER = 0.1
  const fullWidth = Math.max(1, Math.round(Number(opts.pageWidth || opts.defaultWidth || 1080)))
  const fullHeight = Math.max(1, Math.round(Number(opts.pageHeight || opts.defaultHeight || 1920)))
  // FIX: create the offscreen canvas already at thumbnail resolution instead of
  // rendering at full size and downscaling via multiplier. This avoids allocating
  // and rendering a full 1080×1920 canvas only to produce a ~108×192 JPEG.
  const width = Math.max(1, Math.round(fullWidth * THUMB_MULTIPLIER))
  const height = Math.max(1, Math.round(fullHeight * THUMB_MULTIPLIER))
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
    // multiplier: 1 because the canvas is already at thumbnail dimensions
    return sc.toDataURL({
      format: 'jpeg',
      quality: 0.5,
      multiplier: 1
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
