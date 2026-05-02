import { onUnmounted, type Ref, type ShallowRef } from 'vue'
import { getEditorPerfNow } from '~/utils/perfHelpers'
import {
  computeViewportCullRect,
  isObjectIntersectingCullRect,
  restoreViewportCulledObjects,
  shouldSkipViewportCullObject,
  VIEWPORT_CULL_INTERVAL_MS,
  VIEWPORT_CULL_MIN_OBJECTS
} from '~/utils/viewportCulling'

type UpdateViewportCullPerf = (
  reason: string,
  objects: any[],
  changedObjects: number,
  restoredObjects: number,
  durationMs: number
) => void

type UseEditorViewportCullingOptions = {
  canvas: ShallowRef<any>
  isCanvasDestroyed: Ref<boolean>
  metricsEnabled: Ref<boolean>
  updateViewportCullPerf: UpdateViewportCullPerf
  safeRequestRenderAll: (canvasInstance?: any) => void
  refreshCanvasObjects: () => void
}

export const useEditorViewportCulling = (opts: UseEditorViewportCullingOptions) => {
  let viewportCullRafId: number | null = null
  let viewportCullTimer: ReturnType<typeof setTimeout> | null = null
  let lastViewportCullAt = 0
  let lastViewportCullSignature = ''

  const getViewportCullRect = () => {
    const c = opts.canvas.value
    if (!c) return null
    return computeViewportCullRect({
      viewportTransform: c.viewportTransform || [1, 0, 0, 1, 0, 0],
      zoom: Number(c.getZoom?.() || 1) || 1,
      width: Number(c.getWidth?.() || 0),
      height: Number(c.getHeight?.() || 0)
    })
  }

  const resetViewportCullSignature = () => {
    lastViewportCullSignature = ''
  }

  const applyViewportCulling = (reason: string = 'unknown') => {
    const c = opts.canvas.value
    if (!c || opts.isCanvasDestroyed.value) return
    const objects = c.getObjects?.() || []
    const startedAt = opts.metricsEnabled.value ? getEditorPerfNow() : 0

    if (objects.length < VIEWPORT_CULL_MIN_OBJECTS) {
      const restored = restoreViewportCulledObjects(objects)
      if (restored > 0) {
        opts.safeRequestRenderAll(c)
        opts.refreshCanvasObjects()
      }
      if (startedAt > 0) {
        opts.updateViewportCullPerf(reason, objects, restored, restored, getEditorPerfNow() - startedAt)
      }
      return
    }

    const rect = getViewportCullRect()
    if (!rect) return

    const vpt = c.viewportTransform || [1, 0, 0, 1, 0, 0]
    const zoom = Number(c.getZoom?.() || 1) || 1
    const signature = [
      Number(vpt[4] || 0).toFixed(1),
      Number(vpt[5] || 0).toFixed(1),
      zoom.toFixed(4),
      String(objects.length)
    ].join('|')

    const allowSignatureShortCircuit = reason === 'scrollbars'
    if (allowSignatureShortCircuit && signature === lastViewportCullSignature) return
    lastViewportCullSignature = signature

    const activeObjects = c.getActiveObjects?.() || []
    const activeSet = new Set<any>(activeObjects)
    const singleActive = c.getActiveObject?.()
    if (singleActive) activeSet.add(singleActive)

    let changed = 0
    let restored = 0
    objects.forEach((obj: any) => {
      if (shouldSkipViewportCullObject(obj, activeSet)) return
      const inView = isObjectIntersectingCullRect(obj, rect)
      const wasCulled = !!(obj as any).__viewportCulled

      if (!inView) {
        if (!wasCulled) {
          ;(obj as any).__viewportCulled = true
          ;(obj as any).__viewportCullPrevVisible = obj.visible
          ;(obj as any).__viewportCullPrevEvented = obj.evented
          ;(obj as any).__viewportCullPrevSelectable = obj.selectable
        }
        if (obj.visible !== false) {
          obj.set?.('visible', false)
          obj.visible = false
          changed++
        }
        if (obj.evented !== false) {
          obj.set?.('evented', false)
          obj.evented = false
        }
        if (obj.selectable !== false) {
          obj.set?.('selectable', false)
          obj.selectable = false
        }
        obj.dirty = true
        return
      }

      if (!wasCulled) return
      const prevVisible = (obj as any).__viewportCullPrevVisible
      const prevEvented = (obj as any).__viewportCullPrevEvented
      const prevSelectable = (obj as any).__viewportCullPrevSelectable
      obj.set?.('visible', prevVisible === undefined ? true : prevVisible)
      obj.set?.('evented', prevEvented === undefined ? true : prevEvented)
      obj.set?.('selectable', prevSelectable === undefined ? true : prevSelectable)
      obj.visible = prevVisible === undefined ? true : prevVisible
      obj.evented = prevEvented === undefined ? true : prevEvented
      obj.selectable = prevSelectable === undefined ? true : prevSelectable
      obj.dirty = true
      delete (obj as any).__viewportCullPrevVisible
      delete (obj as any).__viewportCullPrevEvented
      delete (obj as any).__viewportCullPrevSelectable
      delete (obj as any).__viewportCulled
      changed++
      restored++
    })

    if (changed > 0) {
      opts.safeRequestRenderAll(c)
      opts.refreshCanvasObjects()
    }

    if (startedAt > 0) {
      opts.updateViewportCullPerf(reason, objects, changed, restored, getEditorPerfNow() - startedAt)
    }
  }

  const scheduleViewportCulling = (reason: string = 'unknown') => {
    if (!opts.canvas.value || opts.isCanvasDestroyed.value) return
    if (typeof window === 'undefined') {
      applyViewportCulling(reason)
      return
    }

    const run = () => {
      if (viewportCullRafId !== null) return
      viewportCullRafId = requestAnimationFrame(() => {
        viewportCullRafId = null
        lastViewportCullAt = performance.now()
        applyViewportCulling(reason)
      })
    }

    const now = performance.now()
    const elapsed = now - lastViewportCullAt
    if (elapsed >= VIEWPORT_CULL_INTERVAL_MS) {
      run()
      return
    }

    if (viewportCullTimer) return
    viewportCullTimer = setTimeout(() => {
      viewportCullTimer = null
      run()
    }, Math.max(0, VIEWPORT_CULL_INTERVAL_MS - elapsed))
  }

  const cancelViewportCulling = () => {
    if (viewportCullTimer) {
      clearTimeout(viewportCullTimer)
      viewportCullTimer = null
    }
    if (viewportCullRafId !== null && typeof window !== 'undefined') {
      cancelAnimationFrame(viewportCullRafId)
      viewportCullRafId = null
    }
  }

  onUnmounted(cancelViewportCulling)

  return {
    applyViewportCulling,
    scheduleViewportCulling,
    resetViewportCullSignature,
    cancelViewportCulling
  }
}
