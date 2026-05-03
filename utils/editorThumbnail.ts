type GenerateThumbnailFromCanvasJsonOptions = {
  sourceJson: any
  staticCanvasCtor: any
  pageWidth?: number
  pageHeight?: number
  defaultWidth?: number
  defaultHeight?: number
}

type ThumbnailBounds = {
  left: number
  top: number
  width: number
  height: number
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

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const isVisibleThumbnailObject = (obj: any): boolean => {
  if (!obj) return false
  if (obj.visible === false) return false
  if (toFiniteNumber(obj.opacity, 1) <= 0) return false

  const name = String(obj.name || '').trim()
  if (
    obj.isFrameLabel ||
    obj.__isFrameClip ||
    obj._frameClipOwner ||
    name === '__frame_clip__' ||
    name === 'frame-label' ||
    name.startsWith('__control')
  ) {
    return false
  }

  return true
}

const getObjectBounds = (obj: any): ThumbnailBounds | null => {
  if (!isVisibleThumbnailObject(obj)) return null

  try {
    if (typeof obj.setCoords === 'function') obj.setCoords()
    if (typeof obj.getBoundingRect === 'function') {
      const rect = obj.getBoundingRect()
      const left = toFiniteNumber(rect?.left, NaN)
      const top = toFiniteNumber(rect?.top, NaN)
      const width = toFiniteNumber(rect?.width, NaN)
      const height = toFiniteNumber(rect?.height, NaN)
      if ([left, top, width, height].every(Number.isFinite) && width > 1 && height > 1) {
        return { left, top, width, height }
      }
    }
  } catch {
    // Fall through to property-based bounds.
  }

  const scaleX = Math.abs(toFiniteNumber(obj.scaleX, 1)) || 1
  const scaleY = Math.abs(toFiniteNumber(obj.scaleY, 1)) || 1
  const width = Math.abs(toFiniteNumber(obj.width, 0) * scaleX)
  const height = Math.abs(toFiniteNumber(obj.height, 0) * scaleY)
  const left = toFiniteNumber(obj.left, NaN)
  const top = toFiniteNumber(obj.top, NaN)
  if ([left, top, width, height].every(Number.isFinite) && width > 1 && height > 1) {
    return { left, top, width, height }
  }
  return null
}

const unionBounds = (bounds: ThumbnailBounds[]): ThumbnailBounds | null => {
  if (!bounds.length) return null
  const left = Math.min(...bounds.map((b) => b.left))
  const top = Math.min(...bounds.map((b) => b.top))
  const right = Math.max(...bounds.map((b) => b.left + b.width))
  const bottom = Math.max(...bounds.map((b) => b.top + b.height))
  const width = right - left
  const height = bottom - top
  if (![left, top, width, height].every(Number.isFinite) || width <= 1 || height <= 1) return null
  return { left, top, width, height }
}

const isFrameLikeThumbnailObject = (obj: any): boolean => {
  if (!obj) return false
  if (obj.isFrame === true || obj.clipContent === true) return true

  const name = String(obj.name || obj.layerName || '').toLowerCase()
  return name.includes('frame') || name.includes('artboard')
}

const resolveThumbnailBounds = (
  objects: any[],
  fallbackWidth: number,
  fallbackHeight: number
): ThumbnailBounds => {
  const frameBounds = objects
    .filter((obj) => isVisibleThumbnailObject(obj) && isFrameLikeThumbnailObject(obj))
    .map((obj) => {
      const bounds = getObjectBounds(obj)
      const area = bounds ? bounds.width * bounds.height : 0
      return { bounds, area }
    })
    .filter((entry): entry is { bounds: ThumbnailBounds; area: number } => !!entry.bounds && entry.area > 1)
    .sort((a, b) => b.area - a.area)

  if (frameBounds[0]?.bounds) {
    return frameBounds[0].bounds
  }

  const objectBounds = objects
    .filter(isVisibleThumbnailObject)
    .map((obj) => getObjectBounds(obj))
    .filter((bounds): bounds is ThumbnailBounds => !!bounds)

  return unionBounds(objectBounds) || {
    left: 0,
    top: 0,
    width: fallbackWidth,
    height: fallbackHeight
  }
}

const setStaticCanvasSize = (canvas: any, width: number, height: number): void => {
  if (typeof canvas.setDimensions === 'function') {
    canvas.setDimensions({ width, height })
    return
  }
  if (typeof canvas.setWidth === 'function') canvas.setWidth(width)
  else canvas.width = width
  if (typeof canvas.setHeight === 'function') canvas.setHeight(height)
  else canvas.height = height
}

export const generateThumbnailFromCanvasJson = async (
  opts: GenerateThumbnailFromCanvasJsonOptions
): Promise<string> => {
  if (!opts.staticCanvasCtor || typeof document === 'undefined') return ''

  const THUMB_MAX_DIMENSION = 480
  const fullWidth = Math.max(1, Math.round(Number(opts.pageWidth || opts.defaultWidth || 1080)))
  const fullHeight = Math.max(1, Math.round(Number(opts.pageHeight || opts.defaultHeight || 1920)))
  const scale = Math.min(THUMB_MAX_DIMENSION / fullWidth, THUMB_MAX_DIMENSION / fullHeight)
  const initialWidth = Math.max(1, Math.round(fullWidth * scale))
  const initialHeight = Math.max(1, Math.round(fullHeight * scale))

  const el = document.createElement('canvas')
  el.width = initialWidth
  el.height = initialHeight

  const sc = new opts.staticCanvasCtor(el, {
    width: initialWidth,
    height: initialHeight,
    backgroundColor: '#ffffff',
    renderOnAddRemove: false
  })

  try {
    const thumbJson = JSON.parse(JSON.stringify(opts.sourceJson || {}))
    stripClipPathsRecursively(thumbJson)
    thumbJson.background = undefined
    thumbJson.backgroundColor = '#ffffff'
    // Timeout reduzido de 10s para 4s: loadFromJSON offscreen so refaz o canvas
    // em memoria; o gargalo e o download de imagens do proxy. Se o proxy esta
    // lento/504 (caso de dev tunnels), nao adianta esperar 10s — melhor falhar
    // rapido e nao travar o fluxo de save.
    const THUMBNAIL_TIMEOUT_MS = 4_000
    const loadPromise = sc.loadFromJSON(thumbJson)
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Thumbnail generation timed out')), THUMBNAIL_TIMEOUT_MS)
    })
    try {
      await Promise.race([loadPromise, timeoutPromise])
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
    if (typeof sc.setZoom === 'function') {
      sc.setZoom(1)
    }

    const objects = typeof sc.getObjects === 'function' ? (sc.getObjects() || []) : []
    const bounds = resolveThumbnailBounds(objects, fullWidth, fullHeight)
    const fitScale = Math.min(
      THUMB_MAX_DIMENSION / Math.max(1, bounds.width),
      THUMB_MAX_DIMENSION / Math.max(1, bounds.height)
    )
    const outputWidth = Math.max(1, Math.round(bounds.width * fitScale))
    const outputHeight = Math.max(1, Math.round(bounds.height * fitScale))

    setStaticCanvasSize(sc, outputWidth, outputHeight)
    if (typeof sc.set === 'function') {
      sc.set('backgroundColor', '#ffffff')
    } else {
      sc.backgroundColor = '#ffffff'
    }

    sc.viewportTransform = [
      fitScale,
      0,
      0,
      fitScale,
      -bounds.left * fitScale,
      -bounds.top * fitScale
    ]
    sc.renderAll()
    return sc.toDataURL({
      format: 'png',
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
