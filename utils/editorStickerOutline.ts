import {
  generateStickerOutlineCanvas,
  type StickerOutlineMode,
  type StickerOutlineSourceRect
} from './stickerOutline'

type StickerOutlineRuntimeDeps = {
  getCanvas: () => any
  renderNow: () => void
}

export const createStickerOutlineRuntime = (deps: StickerOutlineRuntimeDeps) => {
  const isHiddenByParent = (object: any): boolean => {
    if (!object || object.visible === false || Number(object.opacity ?? 1) <= 0) return true

    let ancestor: any = object.group
    let guard = 0
    while (ancestor && guard++ < 20) {
      if (ancestor.visible === false || Number(ancestor.opacity ?? 1) <= 0) return true
      ancestor = ancestor.group
    }

    const parentFrameId = String(object.parentFrameId || '').trim()
    const canvas = deps.getCanvas()
    if (parentFrameId && canvas) {
      const parentFrame = canvas.getObjects().find((candidate: any) => (
        String(candidate?._customId || '') === parentFrameId
      ))
      if (parentFrame && parentFrame.visible === false) return true
    }

    return false
  }

  /** Apply or remove the sticker outline render patch on a fabric.Image object. */
  const applyStickerOutlinePatch = (obj: any) => {
    if (!obj || String(obj.type || '').toLowerCase() !== 'image') return

    const enabled = !!obj.__stickerOutlineEnabled
    const width = Number(obj.__stickerOutlineWidth) || 4
    const color = obj.__stickerOutlineColor || '#FFFFFF'
    const opacity = obj.__stickerOutlineOpacity ?? 1
    const mode: StickerOutlineMode = obj.__stickerOutlineMode === 'inside' ? 'inside' : 'outside'
    if (!obj.__stickerOutlineMode) obj.__stickerOutlineMode = mode

    // Inclui a versao do algoritmo para descartar caches gerados pela mascara
    // antiga, que contornava cada parte separada da logo individualmente.
    const cacheKey = `v5|${enabled}|${mode}|${width}|${color}|${opacity}|${obj.width}|${obj.height}|${obj.cropX || 0}|${obj.cropY || 0}`
    const sourceElement = obj._element || obj.getElement?.()
    if (obj.__stickerCacheKey !== cacheKey || obj.__stickerSourceElement !== sourceElement) {
      obj.__stickerSourceElement = sourceElement
      obj.__stickerOutlineCache = null
      obj.__stickerCacheKey = cacheKey
      obj.__stickerOutlineGeneration = (Number(obj.__stickerOutlineGeneration) || 0) + 1
    }

    if (!enabled) {
      if (obj.__stickerOrigObjectCaching !== undefined) {
        obj.objectCaching = obj.__stickerOrigObjectCaching
        delete obj.__stickerOrigObjectCaching
      }
      try {
        obj._cacheCanvas = null
        obj._cacheContext = null
      } catch {
        // ignore
      }
      if (obj.__origDrawObjectSticker) {
        obj.drawObject = obj.__origDrawObjectSticker
        delete obj.__origDrawObjectSticker
      }
      if (obj.__origRenderSticker) {
        obj.render = obj.__origRenderSticker
        delete obj.__origRenderSticker
      }
      obj.__stickerOutlineCache = null
      obj.dirty = true
      return
    }

    if (obj.__stickerOrigObjectCaching === undefined) {
      obj.__stickerOrigObjectCaching = obj.objectCaching
    }
    obj.objectCaching = false
    try {
      obj._cacheCanvas = null
      obj._cacheContext = null
    } catch {
      // ignore
    }

    if (!obj.__origDrawObjectSticker) {
      obj.__origDrawObjectSticker = obj.drawObject
    }

    obj.drawObject = function (ctx: CanvasRenderingContext2D, forClipping: boolean, context: any) {
      const drawOutline = () => {
        if (forClipping || !this.__stickerOutlineEnabled || !this.__stickerOutlineCache) return
        if (isHiddenByParent(this)) return
        try {
          const cache = this.__stickerOutlineCache
          const pad = cache.__outlinePad || (Math.ceil(Number(this.__stickerOutlineWidth) || 4) + 2)
          const cacheW = cache.width
          const cacheH = cache.height
          const srcW = cache.__outlineSrcW || (cacheW - pad * 2)
          const srcH = cache.__outlineSrcH || (cacheH - pad * 2)
          const w = this.width
          const h = this.height
          const sx = w / srcW
          const sy = h / srcH
          const drawW = cacheW * sx
          const drawH = cacheH * sy
          ctx.drawImage(cache, -drawW / 2, -drawH / 2, drawW, drawH)
        } catch {
          // Silent: never break image rendering.
        }
      }

      const currentMode: StickerOutlineMode = this.__stickerOutlineMode === 'inside' ? 'inside' : 'outside'
      // O drawObject roda depois do transform() do Fabric, portanto o cache
      // ja esta em coordenadas locais e nao precisa de uma segunda matriz.
      // Para o modo externo, desenhamos primeiro para que a silhueta fique
      // atras da imagem; no modo interno, desenhamos depois para realcar a
      // borda por dentro.
      if (currentMode === 'outside') drawOutline()
      const result = this.__origDrawObjectSticker.call(this, ctx, forClipping, context)
      if (currentMode === 'inside') drawOutline()
      return result
    }

    // Versoes anteriores tambem sobrescreviam render() e reaplicavam a matriz
    // mundial do objeto. Se um objeto antigo ainda estiver vivo (por HMR),
    // restaura o metodo original antes de usar apenas o patch local acima.
    if (obj.__origRenderSticker) {
      obj.render = obj.__origRenderSticker
      delete obj.__origRenderSticker
    }

    obj.dirty = true

    const generation = Number(obj.__stickerOutlineGeneration) || 0
    const tryGenerate = (attempt: number) => {
      if (!obj.__stickerOutlineEnabled || obj.__stickerCacheKey !== cacheKey || Number(obj.__stickerOutlineGeneration) !== generation) return
      const element = obj._element || obj.getElement?.()
      const maxAttempts = 6
      const delays = [80, 180, 350, 700, 1500, 3000]
      const isImageElement = element && element.tagName === 'IMG'
      const ready = !!element && (
        !isImageElement || (
          element.complete &&
          (element.naturalWidth || 0) > 0 &&
          (element.naturalHeight || 0) > 0
        )
      )

      if (!ready) {
        if (attempt < maxAttempts) {
          setTimeout(() => {
            if (obj.__stickerOutlineEnabled) tryGenerate(attempt + 1)
          }, delays[attempt] ?? 1000)
        }
        return
      }

      try {
        const naturalWidth = Number((element as any)?.naturalWidth || (element as any)?.width || 0)
        const naturalHeight = Number((element as any)?.naturalHeight || (element as any)?.height || 0)
        const objectWidth = Number(obj.width || 0)
        const objectHeight = Number(obj.height || 0)
        const cropX = Math.max(0, Number(obj.cropX || 0) || 0)
        const cropY = Math.max(0, Number(obj.cropY || 0) || 0)
        const sourceRect: StickerOutlineSourceRect | undefined = (
          cropX > 0 ||
          cropY > 0 ||
          (objectWidth > 0 && naturalWidth > 0 && objectWidth !== naturalWidth) ||
          (objectHeight > 0 && naturalHeight > 0 && objectHeight !== naturalHeight)
        ) ? {
          left: cropX,
          top: cropY,
          width: objectWidth > 0 ? objectWidth : undefined,
          height: objectHeight > 0 ? objectHeight : undefined
        } : undefined
        const outCanvas = generateStickerOutlineCanvas(element, width, color, opacity, mode, sourceRect)
        if (
          outCanvas &&
          obj.__stickerOutlineEnabled &&
          Number(obj.__stickerOutlineGeneration) === generation &&
          obj.__stickerCacheKey === cacheKey
        ) {
          obj.__stickerOutlineCache = outCanvas
          obj.dirty = true
          let parent = obj.group
          while (parent) {
            parent.dirty = true
            parent = parent.group
          }
          deps.renderNow()
          return
        }
      } catch (error) {
        console.warn('[StickerOutline] Erro ao gerar outline:', error)
      }

      if (attempt < maxAttempts) {
        setTimeout(() => {
          if (obj.__stickerOutlineEnabled) tryGenerate(attempt + 1)
        }, delays[attempt] ?? 1000)
      }
    }

    if (!obj.__stickerOutlineCache) {
      // loadFromJSON ja entrega imagens prontas; gere antes do primeiro render/export.
      tryGenerate(0)
    }
  }

  const invalidateStickerOutlineCache = (obj: any) => {
    if (!obj) return
    obj.__stickerOutlineCache = null
    obj.__stickerCacheKey = null
    obj.dirty = true

    if (obj.__stickerOutlineEnabled) {
      const element = obj._element || obj.getElement?.()
      setTimeout(() => {
        try {
          applyStickerOutlinePatch(obj)
        } catch {
          // ignore
        }
      }, element ? 50 : 120)
    }
  }

  return {
    applyStickerOutlinePatch,
    invalidateStickerOutlineCache
  }
}

/** Recria efeitos nao serializaveis em cada superficie, sem alterar a geometria. */
export const restoreCanvasStickerOutlines = (canvas: any) => {
  const runtime = createStickerOutlineRuntime({
    getCanvas: () => canvas,
    renderNow: () => {}
  })
  const visit = (object: any) => {
    if (object?.__stickerOutlineEnabled) runtime.applyStickerOutlinePatch(object)
    object?.getObjects?.().forEach(visit)
  }
  canvas?.getObjects?.().forEach(visit)
}
