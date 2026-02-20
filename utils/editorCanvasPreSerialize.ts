type PrepareCanvasForSerializationOptions = {
  canvasInstance: any
  isValidFabricCanvasObject: (obj: any) => boolean
  ensurePersistentContentFlags: (obj: any) => void
  ensureObjectPersistentId: (obj: any) => void
}

type PrepareCanvasForSerializationResult = {
  allCanvasObjects: any[]
  canvasFrames: any[]
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
  const allObjs = opts.canvasInstance
    .getObjects()
    .filter((o: any) => opts.isValidFabricCanvasObject(o))

  allObjs.forEach((obj: any) => {
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

  const allCanvasObjects = opts.canvasInstance
    .getObjects()
    .filter((o: any) => opts.isValidFabricCanvasObject(o))
  const canvasFrames = allCanvasObjects.filter((o: any) => o?.isFrame)

  canvasFrames.forEach((frame: any) => {
    if (frame.selectable === false) frame.selectable = true
    if (frame.evented === false) frame.evented = true
    frame.set('isFrame', true)
    frame.set('layerName', frame.layerName || 'FRAMER')
    if (!frame._customId) {
      frame._customId = Math.random().toString(36).substr(2, 9)
    }
    if (typeof frame.setCoords === 'function') frame.setCoords()
    if (typeof frame.set === 'function') {
      frame.set('dirty', true)
    }
  })

  allObjs.forEach((obj: any) => {
    if (isZoneLikeObject(obj)) {
      obj.clipPath = null
    }
  })

  return {
    allCanvasObjects,
    canvasFrames
  }
}
