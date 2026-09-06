import {
  captureDynamicBusinessTextBaseline,
  fitDynamicBusinessTextObject,
  isDynamicBusinessFieldObject,
  syncDynamicBusinessTextHeight
} from './dynamicBusinessFields'

type HistoryMode = 'undo' | 'redo'

type ApplyHistoryStateToCanvasOptions = {
  mode: HistoryMode
  state: any
  canvas: any
  fabric?: any
  getSavedViewportTransform: (state: any) => number[] | null
  loadFromJsonSafe: (state: any) => Promise<void>
  sanitizeAllClipPaths: () => void
  rehydrateCanvasZones: (opts: {
    relayout: boolean
    applyZoneStyles: boolean
    applyGlobalLibraries: boolean
    recoverZoneSnapshots: boolean
  }) => void
  repairZoneCardsAfterHistoryRestore: () => void
  getFallbackPageState: () => any | null
  updateZoomState: () => void
  updateScrollbars: () => void
  zoomToFit: () => void
  safeRequestRenderAll: () => void
  refreshCanvasObjects: (opts: { source: any[]; immediate: boolean }) => void
  updateSelection: () => void
  removeAllClipPaths: () => void
}

const normalizeUsableViewportTransform = (raw: unknown): number[] | null => {
  if (!Array.isArray(raw) || raw.length < 6) return null

  const viewport = raw.slice(0, 6).map(Number)
  if (viewport.some(value => !Number.isFinite(value))) return null

  // Fabric's viewport is an affine transform. Undo/redo must never apply a
  // zero, negative or absurd scale that can make the whole workspace appear
  // empty or massively enlarged after loading an otherwise valid snapshot.
  const scaleX = Math.hypot(viewport[0] ?? 0, viewport[1] ?? 0)
  const scaleY = Math.hypot(viewport[2] ?? 0, viewport[3] ?? 0)
  if (scaleX < 0.0001 || scaleY < 0.0001 || scaleX > 20 || scaleY > 20) return null

  return viewport
}

export const chooseHistoryViewportTransform = (
  currentViewport: unknown,
  savedViewport: unknown
): number[] | null => {
  // Camera navigation is not document history. Prefer the live camera so
  // Ctrl+Z changes content without jumping the user to another zoom/pan.
  return normalizeUsableViewportTransform(currentViewport)
    || normalizeUsableViewportTransform(savedViewport)
}

const recalcTextDimensionsDeep = (obj: any): void => {
  if (!obj) return
  const tt = String(obj.type || '').toLowerCase()
  if (tt === 'i-text' || tt === 'textbox' || tt === 'text') {
    if (isDynamicBusinessFieldObject(obj)) captureDynamicBusinessTextBaseline(obj)
    if (typeof obj.initDimensions === 'function') obj.initDimensions()
    // Undo/redo also rebuilds text metrics. Keep the manual height configured
    // for dynamic store fields after Fabric recalculates the natural height.
    if (isDynamicBusinessFieldObject(obj)) {
      fitDynamicBusinessTextObject(obj)
      syncDynamicBusinessTextHeight(obj)
    }
    obj.set('dirty', true)
    if (typeof obj.setCoords === 'function') obj.setCoords()
  }
  if (typeof obj.getObjects === 'function') {
    obj.getObjects().forEach(recalcTextDimensionsDeep)
    obj.set('dirty', true)
  }
}

export const applyHistoryStateToCanvas = async (
  opts: ApplyHistoryStateToCanvasOptions
): Promise<boolean> => {
  const savedViewport = opts.getSavedViewportTransform(opts.state)
  const currentViewport = normalizeUsableViewportTransform(opts.canvas?.viewportTransform)
  const prevRenderOnAddRemove = opts.canvas.renderOnAddRemove
  opts.canvas.renderOnAddRemove = false

  try {
    await opts.loadFromJsonSafe(opts.state)
    opts.sanitizeAllClipPaths()
    opts.rehydrateCanvasZones({
      relayout: false,
      applyZoneStyles: false,
      applyGlobalLibraries: false,
      recoverZoneSnapshots: false
    })
    opts.repairZoneCardsAfterHistoryRestore()
    opts.sanitizeAllClipPaths()

    const loadedObjectCount = opts.canvas.getObjects().length
    const expectedObjectCount = opts.state?.objects?.length || 0
    if (loadedObjectCount === 0 && expectedObjectCount > 0) {
      const failPrefix = opts.mode === 'redo'
        ? '❌ loadFromJSON falhou no redo'
        : '❌ loadFromJSON falhou'
      console.error(`${failPrefix}: esperado ${expectedObjectCount} objetos, carregados ${loadedObjectCount}`)
      const fallbackPageState = opts.getFallbackPageState()
      if (fallbackPageState) {
        console.log('🔄 Recarregando canvasData da página...')
        try {
          await opts.loadFromJsonSafe(fallbackPageState)
          opts.sanitizeAllClipPaths()
          opts.rehydrateCanvasZones({
            relayout: false,
            applyZoneStyles: false,
            applyGlobalLibraries: false,
            recoverZoneSnapshots: false
          })
          opts.repairZoneCardsAfterHistoryRestore()
        } catch (fallbackErr) {
          console.error('❌ Fallback page state also failed:', fallbackErr)
        }
      }
    }

    // Camera navigation is independent from content history. Preserve the live
    // viewport during undo/redo; only use the snapshot viewport for old entries
    // loaded into a canvas that has no usable camera yet.
    const viewportToRestore = chooseHistoryViewportTransform(currentViewport, savedViewport)
    if (viewportToRestore) {
      opts.canvas.setViewportTransform(viewportToRestore)
      opts.updateZoomState()
      opts.updateScrollbars()
    } else {
      opts.zoomToFit()
      opts.updateScrollbars()
    }

    // FIX: only apply the dark fallback when backgroundColor is truly absent
    // (null or undefined).  Previously the falsy check `!backgroundColor` also
    // matched empty string '' (a valid transparent background) and would
    // silently overwrite it with #1e1e1e after every undo/redo.
    if (opts.canvas.backgroundColor == null) {
      opts.canvas.backgroundColor = '#1e1e1e'
    }

    try {
      const fc = opts.fabric?.cache
      if (fc && typeof fc.clearFontCache === 'function') fc.clearFontCache()
    } catch {
      // ignore
    }
    // FIX #16: previously iterated ALL canvas objects including groups and non-text
    // objects, making every undo/redo O(N) on the UI thread. Now only processes
    // objects that actually need text dimension recalculation.
    opts.canvas.getObjects()
      .filter((o: any) => {
        const t = String(o?.type || '').toLowerCase()
        return t === 'i-text' || t === 'textbox' || t === 'text' || t === 'group'
      })
      .forEach(recalcTextDimensionsDeep)

    opts.canvas.discardActiveObject()
    opts.safeRequestRenderAll()
    const objs = opts.canvas.getObjects()
    opts.refreshCanvasObjects({ source: objs, immediate: true })
    opts.updateSelection()
    return true
  } catch (err) {
    const label = opts.mode === 'undo' ? 'Undo' : 'Redo'
    console.error(`❌ ${label} failed:`, err)
    try {
      opts.removeAllClipPaths()
      opts.safeRequestRenderAll()
    } catch {
      // ignore
    }
    return false
  } finally {
    // FIX: guard against canvas being disposed during the async loadFromJsonSafe
    // call.  If the user navigates away while undo/redo is in progress, the
    // canvas may already be null/disposed by the time this finally block runs.
    try {
      if (opts.canvas) {
        opts.canvas.renderOnAddRemove = prevRenderOnAddRemove
      }
    } catch {
      // canvas already disposed — nothing to restore
    }
  }
}
