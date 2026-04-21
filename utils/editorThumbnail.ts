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

  const THUMB_MAX_DIMENSION = 480
  const fullWidth = Math.max(1, Math.round(Number(opts.pageWidth || opts.defaultWidth || 1080)))
  const fullHeight = Math.max(1, Math.round(Number(opts.pageHeight || opts.defaultHeight || 1920)))
  const scale = Math.min(THUMB_MAX_DIMENSION / fullWidth, THUMB_MAX_DIMENSION / fullHeight)
  const width = Math.max(1, Math.round(fullWidth * scale))
  const height = Math.max(1, Math.round(fullHeight * scale))

  // Canvas reduzido + setZoom(scale) faz o Fabric renderizar os objetos escalados
  // automaticamente sem tocar em left/top. Antes criavamos o canvas no tamanho
  // reduzido sem zoom, e o JSON carregado em coordenadas originais resultava em
  // um thumbnail que so mostrava o canto superior esquerdo.
  // Tambem evita explodir memoria/CPU com renderAll em canvas full-size (1080x1920+).
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
      sc.setZoom(scale)
    } else if (Array.isArray(sc.viewportTransform)) {
      sc.viewportTransform = [scale, 0, 0, scale, 0, 0]
    }
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
