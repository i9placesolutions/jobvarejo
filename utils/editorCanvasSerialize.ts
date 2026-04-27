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

const normalizeFabricType = (value: any): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const PRICE_TEMPLATE_TEXT_NAME_HINTS = new Set([
  'price_currency_text',
  'price_integer_text',
  'price_decimal_text',
  'price_unit_text',
  'price_value_text',
  'smart_price',
  'price_header_text',
  'price_header_unit_text',
  'priceinteger',
  'pricedecimal',
  'priceunit',
  'price_integer',
  'price_decimal',
  'price_unit'
])

const looksLikeSerializedPriceTemplateGroup = (node: any): boolean => {
  if (!node || typeof node !== 'object' || !Array.isArray(node.objects)) return false

  const groupName = String(node?.name || '').trim()
  if (groupName === 'priceGroup') return true
  if (node?.__isCustomTemplate === true || node?.__preserveManualLayout === true) return true

  let hasBackgroundLike = false
  let score = 0

  node.objects.forEach((child: any) => {
    if (!child || typeof child !== 'object') return

    const type = normalizeFabricType(child?.type)
    const name = String(child?.name || '').trim()
    const text = String(child?.text || '').trim()

    if (type === 'image' || type === 'rect') {
      hasBackgroundLike = true
      if (name === 'price_bg' || name === 'price_bg_image' || name === 'splash_image') score += 2
    }

    if (PRICE_TEMPLATE_TEXT_NAME_HINTS.has(name)) score += 2
    if (/^,\d{1,2}$/.test(text)) score += 2
    if (/^\d{1,4}$/.test(text)) score += 2
    if (/^R?\$$/i.test(text)) score += 1
  })

  return hasBackgroundLike && score >= 4
}

const shouldAllowNestedStructuralFallback = (canvasObj: any, jsonObj: any): boolean => {
  const name = String(canvasObj?.name || jsonObj?.name || '').trim()
  return (
    name === 'priceGroup' ||
    name === 'product-card' ||
    canvasObj?.isProductCard === true ||
    canvasObj?.isSmartObject === true ||
    canvasObj?.__isCustomTemplate === true ||
    jsonObj?.__isCustomTemplate === true ||
    canvasObj?.__preserveManualLayout === true ||
    jsonObj?.__preserveManualLayout === true
  )
}

const buildUniqueJsonChildNameMap = (jsonChildren: any[]): Map<string, any> => {
  const counts = new Map<string, number>()
  jsonChildren.forEach((jc: any) => {
    const name = String(jc?.name || '').trim()
    if (!name) return
    counts.set(name, (counts.get(name) || 0) + 1)
  })

  const result = new Map<string, any>()
  jsonChildren.forEach((jc: any) => {
    const name = String(jc?.name || '').trim()
    if (!name) return
    if ((counts.get(name) || 0) !== 1) return
    result.set(name, jc)
  })

  return result
}

const canSafelyFallbackGroupChildrenByIndex = (canvasChildren: any[], jsonChildren: any[]): boolean => {
  if (canvasChildren.length === 0 || canvasChildren.length !== jsonChildren.length) return false

  return canvasChildren.every((cc: any, idx: number) => {
    const jc = jsonChildren[idx]
    if (!cc || !jc) return false
    const canvasType = normalizeFabricType(cc?.type)
    const jsonType = normalizeFabricType(jc?.type)
    return !!canvasType && canvasType === jsonType
  })
}

const isMissingSerializedProp = (jsonVal: any, liveVal: any): boolean => {
  if (jsonVal === undefined || jsonVal === null) return true
  if (typeof liveVal === 'string' && liveVal.trim().length > 0) {
    return typeof jsonVal !== 'string' || jsonVal.trim().length === 0
  }
  return false
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
    // Treat undefined/null as missing, and also recover empty-string serialized
    // props such as nested `name` / `__originalSrc` when the live object has a
    // real value.
    if (val !== undefined && val !== null && isMissingSerializedProp(jsonObj[prop], val)) {
      jsonObj[prop] = val
    }
  }

  if (normalizeFabricType(canvasObj?.type) === 'group' && typeof canvasObj.getObjects === 'function' && Array.isArray(jsonObj.objects)) {
    const canvasChildren: any[] = canvasObj.getObjects() || []
    const jsonChildren: any[] = jsonObj.objects || []

    // FIX: build lookup map by _customId for O(1) matching instead of O(N²)
    // index-based sync that silently corrupts data when orders diverge.
    const jsonChildById = new Map<string, any>()
    jsonChildren.forEach((jc: any) => {
      const id = jc?._customId
      if (id) jsonChildById.set(id, jc)
    })

    const allowStructuralFallback = shouldAllowNestedStructuralFallback(canvasObj, jsonObj)
    const jsonChildByName = allowStructuralFallback ? buildUniqueJsonChildNameMap(jsonChildren) : new Map<string, any>()
    const canFallbackByIndex =
      allowStructuralFallback &&
      jsonChildById.size !== jsonChildren.length &&
      canSafelyFallbackGroupChildrenByIndex(canvasChildren, jsonChildren)

    canvasChildren.forEach((cc: any, idx: number) => {
      const id = cc?._customId
      let fallbackMode: 'name' | 'index' | null = null
      let matchedJson = id ? jsonChildById.get(id) : undefined
      if (!matchedJson && allowStructuralFallback) {
        const name = String(cc?.name || '').trim()
        if (name) {
          matchedJson = jsonChildByName.get(name)
          if (matchedJson) fallbackMode = 'name'
        }
      }
      if (!matchedJson && canFallbackByIndex) {
        matchedJson = jsonChildren[idx]
        if (matchedJson) fallbackMode = 'index'
      }
      if (matchedJson) {
        if (
          import.meta.dev &&
          fallbackMode &&
          ((matchedJson?._customId == null && cc?._customId) || (!matchedJson?.name && cc?.name))
        ) {
          console.debug('[serialize] Structural nested sync fallback', {
            parentName: String(canvasObj?.name || jsonObj?.name || '').trim() || '(sem nome)',
            childName: String(cc?.name || '').trim() || '(sem nome)',
            childType: normalizeFabricType(cc?.type),
            mode: fallbackMode
          })
        }
        syncNestedProps(cc, matchedJson, canvasCustomProps)
      }
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

const walkSerializedCanvasObjects = (
  node: any,
  visitor: (obj: any, ancestors?: any[]) => void
) => {
  if (!node || typeof node !== 'object') return

  const walk = (current: any, ancestors: any[]) => {
    if (!current || typeof current !== 'object') return
    visitor(current, ancestors)
    const nextAncestors = [...ancestors, current]

    if (Array.isArray(current.objects)) {
      current.objects.forEach((child: any) => walk(child, nextAncestors))
    }

    const clipPath = current.clipPath
    if (clipPath && typeof clipPath === 'object') {
      walk(clipPath, nextAncestors)
    }
  }

  if (Array.isArray(node?.objects)) {
    node.objects.forEach((child: any) => walk(child, []))
  } else {
    walk(node, [])
  }
}

// Inline base64 data URLs larger than this threshold will be aggressively stripped
// to prevent canvas JSON from ballooning to 6-10MB.
// 1x1 transparent PNG placeholder (~100 bytes)
const TINY_IMAGE_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const MAX_INLINE_DATA_URL_CHARS = 2048

/**
 * Returns true if `url` is a large inline payload that should NOT be persisted.
 * Covers data:image/*, blob:, and any data: URI above the size threshold.
 */
const isLargeInlineUrl = (url: string): boolean => {
  if (!url) return false
  if (url.startsWith('blob:')) return true
  if (url.length > MAX_INLINE_DATA_URL_CHARS && /^data:/i.test(url)) return true
  return false
}

const isSerializedPriceTemplateAsset = (obj: any, ancestors: any[] = []): boolean => {
  if (String(obj?.type || '').toLowerCase() !== 'image') return false

  const objName = String(obj?.name || '').trim()
  if (objName === 'splash_image' || objName === 'price_bg_image') return true

  return ancestors.some((ancestor: any) => {
    if (!ancestor || typeof ancestor !== 'object') return false
    return (
      String(ancestor?.name || '').trim() === 'priceGroup' ||
      ancestor?.__isCustomTemplate === true ||
      ancestor?.__preserveManualLayout === true ||
      looksLikeSerializedPriceTemplateGroup(ancestor)
    )
  })
}

/**
 * Resolve the best permanent URL for an image object.
 * Priority: __originalSrc (if it's a real URL) → src → placeholder.
 */
const resolveBestPermanentSrc = (obj: any): string => {
  const originalSrc = String(obj?.__originalSrc || '').trim()
  // __originalSrc itself must NOT be a blob/data URL
  if (originalSrc && !isLargeInlineUrl(originalSrc) && !originalSrc.startsWith('blob:')) {
    return originalSrc
  }
  return TINY_IMAGE_PLACEHOLDER
}

const normalizePersistedImageUrls = (json: any, convertPresignedToPermanentUrl: (url: string) => string) => {
  let strippedCount = 0
  let strippedBytes = 0

  walkSerializedCanvasObjects(json, (obj, ancestors = []) => {
    const objType = String(obj?.type || '').toLowerCase()
    if (objType !== 'image') return

    const currentSrc = String(obj?.src || '').trim()
    const rawOriginal = String(obj?.__originalSrc || '').trim()
    const isPriceTemplateAsset = isSerializedPriceTemplateAsset(obj, ancestors)

    // Price-group template images may legitimately live as inline data URLs.
    // Preserve those payloads, but still normalize remote URLs when possible.
    if (isPriceTemplateAsset) {
      if (currentSrc && !isLargeInlineUrl(currentSrc) && currentSrc !== TINY_IMAGE_PLACEHOLDER) {
        const permanentUrl = convertPresignedToPermanentUrl(currentSrc)
        if (permanentUrl !== currentSrc) obj.src = permanentUrl
      }
      if (rawOriginal && !isLargeInlineUrl(rawOriginal) && rawOriginal !== TINY_IMAGE_PLACEHOLDER) {
        const permanentOriginal = convertPresignedToPermanentUrl(rawOriginal)
        if (permanentOriginal !== rawOriginal) obj.__originalSrc = permanentOriginal
      }
      return
    }

    // Step 1: Clean __originalSrc itself if it's a blob/large data URL
    if (rawOriginal && isLargeInlineUrl(rawOriginal)) {
      obj.__originalSrc = ''
    }

    const originalSrc = String(obj?.__originalSrc || '').trim()

    // Step 2: Replace any inline/transient src with the best permanent URL
    if (currentSrc.startsWith('blob:') || (currentSrc.length > MAX_INLINE_DATA_URL_CHARS && /^data:/i.test(currentSrc))) {
      const replacement = resolveBestPermanentSrc(obj)
      if (replacement !== currentSrc) {
        if (import.meta.dev) {
          const ancestorTrail = ancestors
            .map((ancestor: any) => String(ancestor?.name || ancestor?.type || '').trim())
            .filter(Boolean)
          console.warn('[serialize] Stripping inline image payload', {
            name: String(obj?.name || '').trim() || '(sem nome)',
            type: objType,
            currentSrcLength: currentSrc.length,
            hasOriginalSrc: !!originalSrc,
            ancestors: ancestorTrail,
            ancestorTrail: ancestorTrail.join(' > ')
          })
        }
        strippedBytes += currentSrc.length
        strippedCount++
        obj.src = replacement
        if (replacement === TINY_IMAGE_PLACEHOLDER) obj.__srcStripped = true
      }
    }
    // Step 3: If src is a small data:image but __originalSrc has the real URL, prefer it
    else if (currentSrc && originalSrc && SERIALIZED_IMAGE_PLACEHOLDER_PATTERN.test(currentSrc) && originalSrc !== currentSrc) {
      obj.src = originalSrc
    }

    // Step 4: Normalize remaining URLs: presigned/wasabi → permanent proxy
    const nextSrc = String(obj?.src || '').trim()
    if (!nextSrc || nextSrc === TINY_IMAGE_PLACEHOLDER) return
    const permanentUrl = convertPresignedToPermanentUrl(nextSrc)
    if (permanentUrl !== nextSrc) obj.src = permanentUrl

    // Step 5: Also normalize __originalSrc to permanent
    if (originalSrc && originalSrc !== TINY_IMAGE_PLACEHOLDER) {
      const permanentOriginal = convertPresignedToPermanentUrl(originalSrc)
      if (permanentOriginal !== originalSrc) obj.__originalSrc = permanentOriginal
    }
  })

  // Step 6: Strip large inline data from _productData.imageUrl across ALL object types
  walkSerializedCanvasObjects(json, (obj) => {
    const pd = obj?._productData
    if (!pd || typeof pd !== 'object') return
    const imgUrl = String(pd.imageUrl || '').trim()
    if (imgUrl && isLargeInlineUrl(imgUrl)) {
      if (import.meta.dev) {
        console.warn('[serialize] Stripping inline _productData.imageUrl payload', {
          ownerName: String(obj?.name || '').trim() || '(sem nome)',
          ownerType: String(obj?.type || '').toLowerCase(),
          imageUrlLength: imgUrl.length
        })
      }
      strippedBytes += imgUrl.length
      strippedCount++
      pd.imageUrl = ''
    }
  })

  if (strippedCount > 0) {
    console.warn(`🗜️ [serialize] Stripped ${strippedCount} inline payload(s) totaling ${(strippedBytes / 1024).toFixed(0)}KB`)
  }
}

/**
 * Strip large inline payloads from nested metadata objects that are serialized
 * on canvas objects: _zoneTemplateSnapshot, _zoneGlobalStyles, _templateGroup, etc.
 */
const stripNestedInlinePayloads = (json: any) => {
  if (!json?.objects || !Array.isArray(json.objects)) return

  const stripFromArbitraryMetadata = (root: any) => {
    const seen = new WeakSet<object>()
    const walk = (value: any) => {
      if (!value || typeof value !== 'object') return
      if (seen.has(value)) return
      seen.add(value)

      if (!Array.isArray(value)) {
        for (const key of ['_raw', '_imported', '_parsedVariants', '_originalRow']) {
          if (key in value) delete value[key]
        }
      }

      Object.entries(value).forEach(([key, entry]: [string, any]) => {
        if (typeof entry === 'string' && isLargeInlineUrl(entry)) {
          if (key === 'src') {
            value[key] = TINY_IMAGE_PLACEHOLDER
          } else if (key === '__originalSrc') {
            value[key] = ''
          } else if (/image|url/i.test(key)) {
            value[key] = ''
          }
          return
        }
        walk(entry)
      })
    }

    walk(root)
  }

  const stripFromTree = (root: any) => {
    if (!root || typeof root !== 'object') return
    walkSerializedCanvasObjects(root, (node: any, ancestors = []) => {
      // Images
      const t = String(node?.type || '').toLowerCase()
      if (t === 'image') {
        if (isSerializedPriceTemplateAsset(node, ancestors)) return

        const src = String(node?.src || '')
        if (isLargeInlineUrl(src)) {
          const original = String(node?.__originalSrc || '').trim()
          node.src = (original && !isLargeInlineUrl(original)) ? original : TINY_IMAGE_PLACEHOLDER
        }
      }
      // _productData.imageUrl
      const pd = node?._productData
      if (pd && typeof pd === 'object' && isLargeInlineUrl(String(pd.imageUrl || ''))) {
        pd.imageUrl = ''
      }
    })
  }

  walkSerializedCanvasObjects(json, (obj: any) => {
    // _zoneTemplateSnapshot
    if (obj?._zoneTemplateSnapshot && typeof obj._zoneTemplateSnapshot === 'object') {
      stripFromTree(obj._zoneTemplateSnapshot)
    }
    // _zoneStateSnapshot stores canonical zone/card state. Keep it, but strip
    // inline/blob image payloads and raw import metadata so autosave does not
    // balloon when product images or AI imports include embedded data.
    if (obj?._zoneStateSnapshot && typeof obj._zoneStateSnapshot === 'object') {
      stripFromTree(obj._zoneStateSnapshot)
      stripFromArbitraryMetadata(obj._zoneStateSnapshot)
    }
    // _templateGroup (used by some template systems)
    if (obj?._templateGroup && typeof obj._templateGroup === 'object') {
      stripFromTree(obj._templateGroup)
    }
  })
}

/**
 * Deep-strip heavyweight metadata that bloats canvas JSON.
 * Keep `_zoneTemplateSnapshot`: it is the last exact fallback for a zone-level
 * template when the template registry changes or local overrides are missing.
 * Heavy nested inline image payloads are already normalized earlier.
 */
const stripHeavyweightMetadata = (json: any) => {
  if (!json?.objects || !Array.isArray(json.objects)) return
  let strippedBytes = 0

  walkSerializedCanvasObjects(json, (obj: any) => {
    // _templateGroup: duplicate of the template group data
    if (obj?._templateGroup && typeof obj._templateGroup === 'object') {
      const est = JSON.stringify(obj._templateGroup).length
      if (est > 1024) {
        strippedBytes += est
        obj._templateGroup = null
      }
    }
    // _productData: strip non-essential fields that can be re-fetched
    if (obj?._productData && typeof obj._productData === 'object') {
      const pd = obj._productData
      // Keep only essential fields for display; raw/imported data is in the DB
      delete pd._raw
      delete pd._imported
      delete pd._parsedVariants
      delete pd._originalRow
    }
  })

  if (strippedBytes > 0) {
    console.log(`🗜️ [serialize] Stripped ${(strippedBytes / 1024).toFixed(0)}KB of heavyweight metadata`)
  }
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
  stripNestedInlinePayloads(opts.json)
  stripHeavyweightMetadata(opts.json)
}
