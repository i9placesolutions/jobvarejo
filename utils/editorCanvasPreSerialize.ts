type PrepareCanvasForSerializationOptions = {
  canvasInstance: any
  isValidFabricCanvasObject: (obj: any) => boolean
  ensurePersistentContentFlags: (obj: any) => void
  ensureObjectPersistentId: (obj: any) => void
}

type PrepareCanvasForSerializationResult = {
  allCanvasObjects: any[]
  canvasFrames: any[]
  restoreZoneClipPaths: () => void
}

const isZoneLikeObject = (obj: any): boolean => {
  return !!(
    obj?.clipPath
    && (obj?.isGridZone || obj?.isProductZone || obj?.name === 'gridZone' || obj?.name === 'productZoneContainer')
  )
}

export const prepareCanvasForSerialization = (
  opts: PrepareCanvasForSerializationOptions
): PrepareCanvasForSerializationResult => {
  // FIX: single snapshot — avoid double getObjects() race where a listener
  // fires between the two calls and shifts index-based sync in serializer.
  const topLevelCanvasObjects = opts.canvasInstance
    .getObjects()
    .filter((o: any) => opts.isValidFabricCanvasObject(o))

  const allCanvasObjects: any[] = []
  const visited = new Set<any>()
  const visit = (obj: any) => {
    if (!obj || visited.has(obj) || !opts.isValidFabricCanvasObject(obj)) return
    visited.add(obj)
    allCanvasObjects.push(obj)

    if (typeof obj.getObjects === 'function') {
      const children = obj.getObjects() || []
      children.forEach((child: any) => visit(child))
    }
  }

  topLevelCanvasObjects.forEach((obj: any) => visit(obj))

  allCanvasObjects.forEach((obj: any) => {
    opts.ensurePersistentContentFlags(obj)
    opts.ensureObjectPersistentId(obj)

    if (!obj?.isFrame) return

    obj.isFrame = true
    if (!obj.layerName) {
      obj.layerName = 'FRAMER'
      console.log('💾 Frame sem layerName antes de salvar, definido como "FRAMER":', obj.name)
    }
    if (!obj.stroke || String(obj.stroke).toLowerCase() !== '#0d99ff') {
      obj.stroke = '#0d99ff'
    }
  })

  const canvasFrames = allCanvasObjects.filter((o: any) => o?.isFrame)

  canvasFrames.forEach((frame: any) => {
    if (frame.selectable === false) frame.selectable = true
    if (frame.evented === false) frame.evented = true
    frame.set('isFrame', true)
    frame.set('layerName', frame.layerName || 'FRAMER')
    if (!frame._customId) {
      // FIX: use crypto.randomUUID for guaranteed uniqueness; fall back to
      // Date.now + random for environments that don't support it yet.
      frame._customId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    }
    if (typeof frame.setCoords === 'function') frame.setCoords()
    if (typeof frame.set === 'function') {
      frame.set('dirty', true)
    }
  })

  // FIX: save zone clipPaths before nulling them and restore after serialization
  // via the returned cleanup function called by the caller.
  // We null them here so toObject() won't capture runtime-only clip paths,
  // but we MUST restore them so live canvas objects are not permanently mutated.
  const savedClipPaths = new Map<any, any>()
  topLevelCanvasObjects.forEach((obj: any) => {
    if (isZoneLikeObject(obj)) {
      savedClipPaths.set(obj, obj.clipPath)
      obj.clipPath = null
    }
  })

  return {
    allCanvasObjects,
    canvasFrames,
    // Expose restore function so the caller can reinstate clip paths
    // in a try/finally around canvas.toObject().
    restoreZoneClipPaths: () => {
      savedClipPaths.forEach((clipPath, obj) => {
        obj.clipPath = clipPath
      })
      savedClipPaths.clear()
    },
  }
}
