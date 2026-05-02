import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import {
  EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS,
  EDITOR_PERF_STORAGE_KEY,
  getEditorPerfNow,
  parseEditorPerfPreference,
  roundEditorPerf,
  serializeEditorPerfPreference
} from '~/utils/perfHelpers'

export type EditorPerfMetricsSnapshot = {
  enabled: boolean
  cullRuns: number
  cullReason: string
  objectCount: number
  visibleObjects: number
  culledObjects: number
  changedObjects: number
  restoredObjects: number
  cullDurationMs: number
  cullAvgMs: number
  cullMaxMs: number
  fps: number
  fpsAvg: number
  fpsMin: number
  fpsMax: number
  renderFrames: number
  updatedAt: number
}

const createInitialSnapshot = (): EditorPerfMetricsSnapshot => ({
  enabled: true,
  cullRuns: 0,
  cullReason: 'idle',
  objectCount: 0,
  visibleObjects: 0,
  culledObjects: 0,
  changedObjects: 0,
  restoredObjects: 0,
  cullDurationMs: 0,
  cullAvgMs: 0,
  cullMaxMs: 0,
  fps: 0,
  fpsAvg: 0,
  fpsMin: 0,
  fpsMax: 0,
  renderFrames: 0,
  updatedAt: 0
})

export const useEditorPerfMetrics = () => {
  const enabled = ref(true)
  const metrics = shallowRef<EditorPerfMetricsSnapshot>(createInitialSnapshot())

  let lastRenderAt = 0
  let lastRenderCommitAt = 0
  let renderFrames = 0
  let fpsAvg = 0
  let fpsMin = Number.POSITIVE_INFINITY
  let fpsMax = 0

  const persistPreference = (nextEnabled: boolean) => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(EDITOR_PERF_STORAGE_KEY, serializeEditorPerfPreference(nextEnabled))
    } catch {
      // ignore storage failures
    }
  }

  const resetRenderCounters = () => {
    lastRenderAt = 0
    lastRenderCommitAt = 0
    renderFrames = 0
    fpsAvg = 0
    fpsMin = Number.POSITIVE_INFINITY
    fpsMax = 0
  }

  const setEnabled = (nextEnabled: boolean) => {
    const normalized = !!nextEnabled
    enabled.value = normalized
    persistPreference(normalized)
    resetRenderCounters()
    metrics.value = {
      ...metrics.value,
      enabled: normalized,
      updatedAt: Date.now()
    }
  }

  const loadPreference = () => {
    if (!import.meta.client) return
    try {
      setEnabled(parseEditorPerfPreference(localStorage.getItem(EDITOR_PERF_STORAGE_KEY)))
    } catch {
      setEnabled(true)
    }
  }

  const publishBridge = () => {
    if (typeof window === 'undefined') return
    ;(window as any).__editorPerf = {
      __owner: 'EditorCanvas',
      get snapshot() {
        return metrics.value
      },
      enable: () => setEnabled(true),
      disable: () => setEnabled(false),
      toggle: () => setEnabled(!enabled.value),
      print: () => console.table(metrics.value)
    }
  }

  const clearBridge = () => {
    if (typeof window === 'undefined') return
    const bridge = (window as any).__editorPerf
    if (bridge && bridge.__owner === 'EditorCanvas') {
      delete (window as any).__editorPerf
    }
  }

  const updateViewportCullPerf = (
    reason: string,
    objects: any[],
    changedObjects: number,
    restoredObjects: number,
    durationMs: number
  ) => {
    if (!enabled.value) return

    let visibleObjects = 0
    let culledObjects = 0
    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue
      if (obj.visible !== false) visibleObjects++
      if ((obj as any).__viewportCulled) culledObjects++
    }

    const prev = metrics.value
    const cullRuns = Number(prev.cullRuns || 0) + 1
    const cullAvgMs = cullRuns <= 1
      ? durationMs
      : (((Number(prev.cullAvgMs || 0) * (cullRuns - 1)) + durationMs) / cullRuns)
    const cullMaxMs = Math.max(Number(prev.cullMaxMs || 0), durationMs)

    metrics.value = {
      ...prev,
      enabled: true,
      cullReason: reason,
      cullRuns,
      objectCount: objects.length,
      visibleObjects,
      culledObjects,
      changedObjects,
      restoredObjects,
      cullDurationMs: roundEditorPerf(durationMs),
      cullAvgMs: roundEditorPerf(cullAvgMs),
      cullMaxMs: roundEditorPerf(cullMaxMs),
      updatedAt: Date.now()
    }
  }

  const handleAfterRenderPerf = () => {
    if (!enabled.value) return
    const now = getEditorPerfNow()
    if (lastRenderAt <= 0) {
      lastRenderAt = now
      return
    }

    const delta = now - lastRenderAt
    lastRenderAt = now
    if (delta <= 0 || delta > 2200) return

    const fps = 1000 / delta
    renderFrames += 1
    fpsAvg = renderFrames <= 1
      ? fps
      : (((fpsAvg * (renderFrames - 1)) + fps) / renderFrames)
    fpsMin = Math.min(fpsMin, fps)
    fpsMax = Math.max(fpsMax, fps)

    if ((now - lastRenderCommitAt) < EDITOR_PERF_RENDER_COMMIT_INTERVAL_MS) return

    lastRenderCommitAt = now
    const prev = metrics.value
    metrics.value = {
      ...prev,
      enabled: true,
      fps: roundEditorPerf(fps),
      fpsAvg: roundEditorPerf(fpsAvg),
      fpsMin: roundEditorPerf(fpsMin === Number.POSITIVE_INFINITY ? fps : fpsMin),
      fpsMax: roundEditorPerf(fpsMax),
      renderFrames,
      updatedAt: Date.now()
    }
  }

  onMounted(() => {
    loadPreference()
    publishBridge()
  })

  onUnmounted(() => {
    clearBridge()
    resetRenderCounters()
  })

  return {
    enabled,
    metrics,
    handleAfterRenderPerf,
    updateViewportCullPerf
  }
}
