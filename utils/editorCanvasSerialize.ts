type FinalizeSerializedCanvasJsonOptions = {
  json: any
  canvasInstance: any
  canvasCustomProps: string[]
  isValidFabricCanvasObject: (obj: any) => boolean
  transientControlNames: Set<string>
  convertPresignedToPermanentUrl: (url: string) => string
  canvasFramesForDebug?: any[]
}

const isZoneLikeObject = (obj: any): boolean => {
  return !!(
    obj &&
    obj.clipPath &&
    (obj.isGridZone || obj.isProductZone || obj.name === 'gridZone' || obj.name === 'productZoneContainer')
  )
}

const syncNestedProps = (canvasObj: any, jsonObj: any, canvasCustomProps: string[]) => {
  if (!canvasObj || !jsonObj) return

  for (const prop of canvasCustomProps) {
    const val = canvasObj?.[prop]
    if (val !== undefined && val !== null && jsonObj[prop] === undefined) {
      jsonObj[prop] = val
    }
  }

  if (canvasObj.type === 'group' && typeof canvasObj.getObjects === 'function' && Array.isArray(jsonObj.objects)) {
    const canvasChildren = canvasObj.getObjects() || []
    const jsonChildren = jsonObj.objects || []
    const minLen = Math.min(canvasChildren.length, jsonChildren.length)
    for (let i = 0; i < minLen; i++) {
      syncNestedProps(canvasChildren[i], jsonChildren[i], canvasCustomProps)
    }
  }
}

const syncCustomPropsTopLevel = (
  json: any,
  canvasObjs: any[],
  canvasCustomProps: string[]
) => {
  if (!json?.objects || !Array.isArray(json.objects)) return

  const minLen = Math.min(canvasObjs.length, json.objects.length)
  for (let i = 0; i < minLen; i++) {
    syncNestedProps(canvasObjs[i], json.objects[i], canvasCustomProps)
  }
}

const stripZoneClipPaths = (json: any) => {
  if (!json?.objects || !Array.isArray(json.objects)) return
  json.objects.forEach((obj: any) => {
    if (isZoneLikeObject(obj)) obj.clipPath = undefined
  })
}

const restoreFramePropsAndFilterInvalid = (
  json: any,
  canvasObjs: any[],
  transientControlNames: Set<string>,
  canvasFramesForDebug: any[]
): number => {
  if (!json?.objects || !Array.isArray(json.objects)) return 0

  json.objects.forEach((jsonObj: any, index: number) => {
    const canvasObj = canvasObjs[index]
    if (!canvasObj) return

    if (canvasObj._customId) jsonObj._customId = canvasObj._customId
    if (canvasObj.layerName) jsonObj.layerName = canvasObj.layerName
    if (canvasObj.isFrame) jsonObj.isFrame = true
    if (canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent !== false
    if (canvasObj.clipContent && !canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent
    if (canvasObj.parentFrameId) jsonObj.parentFrameId = canvasObj.parentFrameId
    if (!jsonObj.name && canvasObj.name) jsonObj.name = canvasObj.name
  })

  json.objects.forEach((obj: any) => {
    if (!obj?.isFrame) return
    obj.isFrame = true
    if (!obj.layerName) obj.layerName = 'FRAMER'
    if (!obj.stroke || String(obj.stroke).toLowerCase() !== '#0d99ff') {
      obj.stroke = '#0d99ff'
    }
    if (obj.clipContent === undefined || obj.clipContent === null) {
      obj.clipContent = true
    }
  })

  const beforeCount = json.objects.length
  const validObjects = json.objects.filter((obj: any) => {
    const id = String(obj?.id || '')
    if (id === 'artboard-bg') return true
    if (id.startsWith('guide-user-')) return true
    if (obj?._customId) return true
    if ((obj?.type || '').toLowerCase() === 'image' && obj?.src) return true
    if (obj?.isFrame) return true
    const name = String(obj?.name || '')
    if (transientControlNames.has(name)) return false
    if (obj?.data && (obj.data.parentPath || obj.data.parentObj)) return false
    return true
  })

  if (validObjects.length !== beforeCount) {
    console.log(`Filtered ${beforeCount - validObjects.length} invalid object(s) from JSON`)
    json.objects = validObjects
  }

  const framesInJson = json.objects.filter((o: any) => o?.isFrame)
  if (framesInJson.length > 0) {
    console.log(`Saving ${framesInJson.length} frame(s)`)
  } else if (Array.isArray(canvasFramesForDebug) && canvasFramesForDebug.length > 0) {
    console.error(`Critical: ${canvasFramesForDebug.length} frame(s) in canvas but 0 in JSON after fixes`)
    console.error('Frames in canvas:', canvasFramesForDebug.map((f: any) => ({
      name: f?.name,
      _customId: f?._customId,
      isFrame: f?.isFrame,
      layerName: f?.layerName
    })))
  }

  return framesInJson.length
}

const normalizePersistedImageUrls = (json: any, convertPresignedToPermanentUrl: (url: string) => string) => {
  if (!json?.objects || !Array.isArray(json.objects)) return
  json.objects.forEach((obj: any) => {
    const objType = String(obj?.type || '').toLowerCase()
    if (objType !== 'image' || !obj?.src) return
    const permanentUrl = convertPresignedToPermanentUrl(obj.src)
    if (permanentUrl !== obj.src) obj.src = permanentUrl
  })
}

export const finalizeSerializedCanvasJson = (opts: FinalizeSerializedCanvasJsonOptions): void => {
  const canvasObjs = opts.canvasInstance
    .getObjects()
    .filter((o: any) => opts.isValidFabricCanvasObject(o))

  syncCustomPropsTopLevel(opts.json, canvasObjs, opts.canvasCustomProps)
  stripZoneClipPaths(opts.json)
  restoreFramePropsAndFilterInvalid(
    opts.json,
    canvasObjs,
    opts.transientControlNames,
    opts.canvasFramesForDebug || []
  )
  normalizePersistedImageUrls(opts.json, opts.convertPresignedToPermanentUrl)
}
