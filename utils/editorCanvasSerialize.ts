type FinalizeSerializedCanvasJsonOptions = {
  json: any
  canvasInstance: any
  canvasCustomProps: string[]
  isValidFabricCanvasObject: (obj: any) => boolean
  transientControlNames: Set<string>
  convertPresignedToPermanentUrl: (url: string) => string
  canvasFramesForDebug?: any[]
}

const SERIALIZED_IMAGE_PLACEHOLDER_PATTERN = /^data:image\//i

const isZoneLikeObject = (obj: any): boolean => {
  return !!(
    obj &&
    obj.clipPath &&
    (obj.isGridZone || obj.isProductZone || obj.name === 'gridZone' || obj.name === 'productZoneContainer')
  )
}

// FIX: syncNestedProps now matches by _customId instead of array index.
// Index-based sync is unreliable because canvas.toObject() and getObjects()
// may not return objects in the same order (e.g. after async renders or
// custom toObject() overrides). Matching by _customId prevents custom props
// such as isFrame, layerName, _customId from being written to the wrong object.
const syncNestedProps = (canvasObj: any, jsonObj: any, canvasCustomProps: string[]) => {
  if (!canvasObj || !jsonObj) return

  for (const prop of canvasCustomProps) {
    const val = canvasObj?.[prop]
    // FIX: use ?? instead of checking only === undefined so that null values
    // from Fabric serialization (e.g. isFrame serialized as null) are still
    // overwritten by the live canvas value.
    if (val !== undefined && val !== null && (jsonObj[prop] === undefined || jsonObj[prop] === null)) {
      jsonObj[prop] = val
    }
  }

  if (canvasObj.type === 'group' && typeof canvasObj.getObjects === 'function' && Array.isArray(jsonObj.objects)) {
    const canvasChildren: any[] = canvasObj.getObjects() || []
    const jsonChildren: any[] = jsonObj.objects || []

    // FIX: build lookup map by _customId for O(1) matching instead of O(N²)
    // index-based sync that silently corrupts data when orders diverge.
    const jsonChildById = new Map<string, any>()
    jsonChildren.forEach((jc: any) => {
      const id = jc?._customId
      if (id) jsonChildById.set(id, jc)
    })

    canvasChildren.forEach((cc: any) => {
      const id = cc?._customId
      const matchedJson = id ? jsonChildById.get(id) : undefined
      if (matchedJson) {
        syncNestedProps(cc, matchedJson, canvasCustomProps)
      }
      // Fallback: if no _customId on either side, skip — better to miss than
      // to corrupt by guessing index alignment.
    })
  }
}

const syncCustomPropsTopLevel = (
  json: any,
  canvasObjs: any[],
  canvasCustomProps: string[]
) => {
  if (!json?.objects || !Array.isArray(json.objects)) return

  // FIX: build lookup map by _customId for safe matching.
  const jsonObjById = new Map<string, any>()
  json.objects.forEach((jo: any) => {
    const id = jo?._customId
    if (id) jsonObjById.set(id, jo)
  })

  canvasObjs.forEach((co: any) => {
    const id = co?._customId
    const matched = id ? jsonObjById.get(id) : undefined
    if (matched) {
      syncNestedProps(co, matched, canvasCustomProps)
    }
    // Objects without _customId: skip to avoid index-based corruption.
    // Their props will still be written by restoreFramePropsAndFilterInvalid
    // for the specific frame/artboard-bg objects that have stable ids.
  })
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

  // FIX: build lookup map by _customId — the previous code used index-based
  // lookup via canvasObjs[index] which silently assigned frame props to the
  // wrong JSON object when orders diverged.
  const canvasObjById = new Map<string, any>()
  canvasObjs.forEach((co: any) => {
    const id = co?._customId
    if (id) canvasObjById.set(id, co)
  })

  // Build list of canvas frames for fallback matching when _customId is missing
  // from the serialized JSON (happens after loadFromJSON with AI-generated data).
  const canvasFramesList = canvasObjs.filter((co: any) => co?.isFrame)

  json.objects.forEach((jsonObj: any) => {
    let canvasObj = canvasObjById.get(jsonObj?._customId) ?? null

    // Fallback 1: match by _customId stored in a non-standard location
    if (!canvasObj && jsonObj?.id) {
      canvasObj = canvasObjById.get(jsonObj.id) ?? null
    }

    // Fallback 2: for each unmatched JSON Rect, try to find the corresponding
    // canvas frame by checking if the live canvas object IS a frame.
    // This handles the case where _customId was not serialized by toObject().
    if (!canvasObj && canvasFramesList.length > 0) {
      const jsonType = String(jsonObj?.type || '').toLowerCase()

      // Check if this JSON object looks like it could be a frame:
      // - explicitly marked as frame (isFrame, layerName)
      // - OR is a Rect with frame-like name
      // - OR is the first Rect in the JSON (frames are always first)
      const isLikelyFrame =
        jsonObj?.isFrame ||
        jsonObj?.layerName === 'FRAMER' ||
        (jsonType === 'rect' && String(jsonObj?.name || '').toLowerCase().includes('frame')) ||
        (jsonType === 'rect' && String(jsonObj?.stroke || '').toLowerCase() === '#0d99ff')

      if (isLikelyFrame) {
        // Find the matching canvas frame by index order
        const idx = json.objects.filter((o: any) => {
          const t = String(o?.type || '').toLowerCase()
          return t === 'rect' && (o?.isFrame || o?.layerName === 'FRAMER' || String(o?.name || '').toLowerCase().includes('frame') || String(o?.stroke || '').toLowerCase() === '#0d99ff')
        }).indexOf(jsonObj)
        if (idx >= 0 && idx < canvasFramesList.length) {
          canvasObj = canvasFramesList[idx]
        }
      }
    }

    // Restore props from canvas object when matched
    if (canvasObj) {
      if (canvasObj._customId) jsonObj._customId = canvasObj._customId
      if (canvasObj.layerName) jsonObj.layerName = canvasObj.layerName
      if (canvasObj.isFrame) jsonObj.isFrame = true
      if (canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent !== false
      if (canvasObj.clipContent && !canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent
      if (canvasObj.parentFrameId) jsonObj.parentFrameId = canvasObj.parentFrameId
      if (!jsonObj.name && canvasObj.name) jsonObj.name = canvasObj.name
    }
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

  // Strip objects with invalid/missing type before saving — prevents
  // "No class registered for undefined" on reload
  const INVALID_SERIALIZE_TYPES = new Set(['', 'undefined', 'null', 'unknown'])
  const stripInvalidTypes = (objects: any[]): any[] => {
    return objects.filter((obj: any) => {
      if (!obj || typeof obj !== 'object') return false
      const rawType = obj.type
      const t = (rawType == null ? '' : String(rawType)).trim().toLowerCase()
      if (INVALID_SERIALIZE_TYPES.has(t)) return false
      // Recursively clean children
      if (Array.isArray(obj.objects)) {
        obj.objects = stripInvalidTypes(obj.objects)
      }
      return true
    })
  }
  json.objects = stripInvalidTypes(json.objects)

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
    if (import.meta.dev) {
      console.log(`Saving ${framesInJson.length} frame(s)`)
    }
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

const walkSerializedCanvasObjects = (node: any, visitor: (obj: any) => void) => {
  if (!node || typeof node !== 'object') return

  const walk = (current: any) => {
    if (!current || typeof current !== 'object') return
    visitor(current)

    if (Array.isArray(current.objects)) {
      current.objects.forEach(walk)
    }

    const clipPath = current.clipPath
    if (clipPath && typeof clipPath === 'object') {
      walk(clipPath)
    }
  }

  if (Array.isArray(node?.objects)) {
    node.objects.forEach(walk)
  } else {
    walk(node)
  }
}

// Inline base64 data URLs larger than this threshold will be aggressively stripped
// to prevent canvas JSON from ballooning to 6-10MB.
// 1x1 transparent PNG placeholder (~100 bytes)
const TINY_IMAGE_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const MAX_INLINE_DATA_URL_CHARS = 2048

const normalizePersistedImageUrls = (json: any, convertPresignedToPermanentUrl: (url: string) => string) => {
  let strippedCount = 0
  let strippedBytes = 0

  walkSerializedCanvasObjects(json, (obj) => {
    const objType = String(obj?.type || '').toLowerCase()
    if (objType !== 'image') return

    const currentSrc = String(obj?.src || '').trim()
    const originalSrc = String(obj?.__originalSrc || '').trim()

    // Case 1: Has __originalSrc → always prefer it over inline data
    if (currentSrc && originalSrc && SERIALIZED_IMAGE_PLACEHOLDER_PATTERN.test(currentSrc)) {
      obj.src = originalSrc
    }

    // Case 2: blob: URLs should never be persisted (they expire with the page session)
    if (currentSrc.startsWith('blob:')) {
      obj.src = originalSrc || TINY_IMAGE_PLACEHOLDER
      if (!originalSrc) {
        strippedCount++
        strippedBytes += currentSrc.length
      }
    }

    // Case 3: Large data: URLs without __originalSrc → strip to placeholder
    // These images are already uploaded to Wasabi/storage and will be resolved
    // via the proxy on next load. Keeping 200-400KB base64 per image inline
    // causes the canvas JSON to balloon to 6-10MB and fail Wasabi upload.
    const afterSrc = String(obj?.src || '').trim()
    if (
      afterSrc.length > MAX_INLINE_DATA_URL_CHARS &&
      SERIALIZED_IMAGE_PLACEHOLDER_PATTERN.test(afterSrc) &&
      !originalSrc
    ) {
      strippedCount++
      strippedBytes += afterSrc.length
      obj.src = TINY_IMAGE_PLACEHOLDER
      // Mark as stripped so the load pipeline knows to look up the image elsewhere
      obj.__srcStripped = true
    }

    // Normalize remaining URLs: presigned → permanent
    const nextSrc = String(obj?.src || '').trim()
    if (!nextSrc) return
    const permanentUrl = convertPresignedToPermanentUrl(nextSrc)
    if (permanentUrl !== nextSrc) obj.src = permanentUrl
  })

  if (strippedCount > 0) {
    console.warn(`🗜️ [serialize] Stripped ${strippedCount} inline data URL(s) (${(strippedBytes / 1024).toFixed(0)}KB saved)`)
  }
}

/**
 * Strip large inline data URLs from _zoneTemplateSnapshot objects.
 * These snapshots store a full template clone; images inside them
 * can be 50-200KB each, adding significant weight to the JSON.
 */
const stripSnapshotInlineImages = (json: any) => {
  if (!json?.objects || !Array.isArray(json.objects)) return
  json.objects.forEach((obj: any) => {
    const snapshot = obj?._zoneTemplateSnapshot
    if (!snapshot || typeof snapshot !== 'object') return
    // Walk the snapshot tree and strip large data URLs
    walkSerializedCanvasObjects(snapshot, (node: any) => {
      const t = String(node?.type || '').toLowerCase()
      if (t !== 'image') return
      const src = String(node?.src || '')
      if (src.length > MAX_INLINE_DATA_URL_CHARS && SERIALIZED_IMAGE_PLACEHOLDER_PATTERN.test(src)) {
        node.src = node.__originalSrc || TINY_IMAGE_PLACEHOLDER
      }
      if (src.startsWith('blob:')) {
        node.src = node.__originalSrc || TINY_IMAGE_PLACEHOLDER
      }
    })
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
  stripSnapshotInlineImages(opts.json)
}
