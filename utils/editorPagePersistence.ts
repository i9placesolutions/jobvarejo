import type { SaveSource } from './editorSavePolicy'

type PersistSerializedPageStateOptions = {
  targetPageId: string
  json: any
  serializedJson?: string | null
  serializedBytes?: number | null
  source: SaveSource
  reason: string
  currentFingerprint: string
  markUnsaved: boolean
  pages: any[]
  resolvePageIndexById: (pageId: string) => number
  updatePageData: (
    index: number,
    json: any,
    opts: { source: SaveSource; markUnsaved: boolean; skipIfSameFingerprint: boolean; reason?: string }
  ) => boolean
  shouldSkipAutoSave: (source: SaveSource, reason: string) => boolean
  triggerAutoSave: () => void
}

type PersistSerializedPageStateResult = {
  didUpdate: boolean
  targetPageIndex: number
  targetPage: any | null
}

export const persistSerializedPageState = (
  opts: PersistSerializedPageStateOptions
): PersistSerializedPageStateResult => {
  const targetPageIndex = opts.resolvePageIndexById(opts.targetPageId)
  if (targetPageIndex < 0 || opts.pages.length <= targetPageIndex || !opts.pages[targetPageIndex]) {
    return { didUpdate: false, targetPageIndex, targetPage: null }
  }

  const objectCount = opts.json?.objects?.length || 0
  const didUpdate = opts.updatePageData(targetPageIndex, opts.json, {
    source: opts.source,
    markUnsaved: opts.markUnsaved,
    skipIfSameFingerprint: true,
    reason: opts.reason
  })
  if (!didUpdate) {
    return { didUpdate: false, targetPageIndex, targetPage: opts.pages[targetPageIndex] || null }
  }

  // FIX: only trigger auto-save first; update the cached metadata (fingerprint,
  // serialized JSON) AFTER. Previously the fingerprint was stamped before
  // triggerAutoSave() ran — if triggerAutoSave threw, the page was permanently
  // marked as "saved" without data ever reaching the server, causing silent data loss.
  if (!opts.shouldSkipAutoSave(opts.source, opts.reason)) {
    opts.triggerAutoSave()
  }

  // Stamp the cache metadata only after the save has been successfully initiated.
  const activePageRef = opts.pages[targetPageIndex]
  if (activePageRef) {
    activePageRef.lastSavedFingerprint = opts.currentFingerprint
    activePageRef.lastSerializedCanvasJson = typeof opts.serializedJson === 'string'
      ? opts.serializedJson
      : undefined
    activePageRef.lastSerializedCanvasBytes = Number.isFinite(Number(opts.serializedBytes))
      ? Number(opts.serializedBytes)
      : undefined
  }

  const savedPage = opts.pages[targetPageIndex]
  if (savedPage?.canvasData) {
    const savedObjectCount = savedPage.canvasData?.objects?.length || 0
    if (savedObjectCount !== objectCount) {
      console.warn(`⚠️ Discrepância: salvamos ${objectCount} objetos mas página tem ${savedObjectCount}`)
    }
  } else {
    console.error(`❌ PROBLEMA: Estado não foi salvo! Página ${targetPageIndex} (${opts.targetPageId}) não tem canvasData`)
  }

  return {
    didUpdate: true,
    targetPageIndex,
    targetPage: savedPage || null
  }
}
