type HistoryMode = 'undo' | 'redo'

type ApplyHistoryStateToCanvasOptions = {
  mode: HistoryMode
  state: any
  canvas: any
  fabric?: any
  getSavedViewportTransform: (state: any) => number[] | null
  loadFromJsonSafe: (state: any) => Promise<void>
  sanitizeAllClipPaths: () => void
  rehydrateCanvasZones: (opts: { relayout: boolean; applyZoneStyles: boolean }) => void
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

const recalcTextDimensionsDeep = (obj: any): void => {
  if (!obj) return
  const tt = String(obj.type || '').toLowerCase()
  if (tt === 'i-text' || tt === 'textbox' || tt === 'text') {
    if (typeof obj.initDimensions === 'function') obj.initDimensions()
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
  const currentViewport = Array.isArray(opts.canvas?.viewportTransform)
    ? [...opts.canvas.viewportTransform]
    : null
  const prevRenderOnAddRemove = opts.canvas.renderOnAddRemove
  opts.canvas.renderOnAddRemove = false

  try {
    await opts.loadFromJsonSafe(opts.state)
    opts.sanitizeAllClipPaths()
    opts.rehydrateCanvasZones({ relayout: false, applyZoneStyles: false })
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
        await opts.loadFromJsonSafe(fallbackPageState)
        opts.sanitizeAllClipPaths()
        opts.rehydrateCanvasZones({ relayout: false, applyZoneStyles: false })
        opts.repairZoneCardsAfterHistoryRestore()
      }
    }

    if (savedViewport) {
      opts.canvas.setViewportTransform(savedViewport)
      opts.updateZoomState()
      opts.updateScrollbars()
    } else if (currentViewport) {
      // Keep current viewport when old history entries don't contain viewport metadata.
      // This avoids visible "jump/flash" to zoom-to-fit on Ctrl+Z.
      opts.canvas.setViewportTransform(currentViewport as any)
      opts.updateZoomState()
      opts.updateScrollbars()
    } else {
      opts.zoomToFit()
      opts.updateScrollbars()
    }

    // FIX: do NOT override the canvas background after undo/redo. The background
    // colour is part of the serialised state and was already restored by
    // loadFromJsonSafe. Previously this block silently replaced a user-chosen
    // transparent/clear background with #1e1e1e on every undo/redo.
    // We only apply the fallback when the background is truly absent (null/undefined),
    // never when it is explicitly 'transparent' or a zero-alpha colour.
    if (!opts.canvas.backgroundColor) {
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
    opts.canvas.renderOnAddRemove = prevRenderOnAddRemove
  }
}
