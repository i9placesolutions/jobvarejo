import type { SaveSource } from './editorSavePolicy'

type PersistSerializedPageStateOptions = {
  targetPageId: string
  json: any
  source: SaveSource
  reason: string
  currentFingerprint: string
  pages: any[]
  resolvePageIndexById: (pageId: string) => number
  updatePageData: (
    index: number,
    json: any,
    opts: { source: SaveSource; markUnsaved: boolean; skipIfSameFingerprint: boolean }
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
    markUnsaved: opts.source === 'user',
    skipIfSameFingerprint: true
  })
  if (!didUpdate) {
    return { didUpdate: false, targetPageIndex, targetPage: opts.pages[targetPageIndex] || null }
  }

  const activePageRef = opts.pages[targetPageIndex]
  if (activePageRef) {
    activePageRef.lastSavedFingerprint = opts.currentFingerprint
  }

  if (!opts.shouldSkipAutoSave(opts.source, opts.reason)) {
    opts.triggerAutoSave()
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
