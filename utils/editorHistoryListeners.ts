type SaveStateLikeOptions = {
  allowEmptyOverwrite?: boolean
  reason?: string
}

type RegisterHistorySaveListenersOptions = {
  canvas: any
  getCanvas: () => any
  invalidateScrollbarBounds: () => void
  invalidateContainmentZoneCache: () => void
  updateScrollbars: () => void
  isBulkProductMutation: () => boolean
  isHistoryProcessing: () => boolean
  isApplyingZoneUpdate: () => boolean
  getIsZoneCascadeDelete: () => boolean
  setIsZoneCascadeDelete: (value: boolean) => void
  invokeSaveStateSafely: (opts?: SaveStateLikeOptions) => void
  handleObjectModified: (e: any) => void
  isLikelyProductZone: (obj: any) => boolean
  isLikelyProductCard: (obj: any) => boolean
}

export const registerHistorySaveListeners = (
  opts: RegisterHistorySaveListenersOptions
): (() => void) => {
  const onHistoryObjectAdded = (_e: any) => {
    opts.invalidateScrollbarBounds()
    opts.invalidateContainmentZoneCache()
    if (opts.isBulkProductMutation()) {
      opts.updateScrollbars()
      return
    }
    if (!opts.isHistoryProcessing()) {
      opts.invokeSaveStateSafely({ allowEmptyOverwrite: true, reason: 'object:added' })
    }
    opts.updateScrollbars()
  }

  const onHistoryObjectModified = (e: any) => {
    opts.invalidateScrollbarBounds()
    opts.invalidateContainmentZoneCache()
    if (opts.isBulkProductMutation()) return
    if (opts.isHistoryProcessing()) return
    if (opts.isApplyingZoneUpdate()) return

    const obj = e?.target
    if (obj && opts.isLikelyProductZone(obj)) {
      opts.handleObjectModified(e)
      opts.invokeSaveStateSafely({ allowEmptyOverwrite: true, reason: 'object:modified(zone)' })
      return
    }

    opts.handleObjectModified(e)
    opts.invokeSaveStateSafely({ allowEmptyOverwrite: true, reason: 'object:modified' })
  }

  const onHistoryObjectRemoved = (e: any) => {
    opts.invalidateScrollbarBounds()
    opts.invalidateContainmentZoneCache()
    if (opts.isBulkProductMutation()) {
      opts.updateScrollbars()
      return
    }
    if (opts.isHistoryProcessing()) {
      opts.updateScrollbars()
      return
    }

    const obj = e?.target
    if (obj && opts.isLikelyProductZone(obj) && !opts.getIsZoneCascadeDelete()) {
      const zoneId = obj._customId
      if (zoneId) {
        opts.setIsZoneCascadeDelete(true)
        try {
          const canvas = opts.getCanvas()
          if (canvas) {
            const toRemove = canvas.getObjects().filter((o: any) => {
              if (!o || o.excludeFromExport) return false
              const isCard = !!(
                o.isSmartObject
                || o.isProductCard
                || String(o.name || '').startsWith('product-card')
                || opts.isLikelyProductCard(o)
              )
              return isCard && o.parentZoneId === zoneId
            })
            toRemove.forEach((child: any) => {
              try {
                canvas.remove(child)
              } catch {
                // ignore
              }
            })
          }
        } finally {
          opts.setIsZoneCascadeDelete(false)
        }
      }

      opts.invokeSaveStateSafely({ allowEmptyOverwrite: true, reason: 'object:removed(zone+cascade)' })
      opts.updateScrollbars()
      return
    }

    if (!opts.getIsZoneCascadeDelete()) {
      opts.invokeSaveStateSafely({ allowEmptyOverwrite: true, reason: 'object:removed' })
    }
    opts.updateScrollbars()
  }

  opts.canvas.on('object:added', onHistoryObjectAdded)
  opts.canvas.on('object:modified', onHistoryObjectModified)
  opts.canvas.on('object:removed', onHistoryObjectRemoved)

  return () => {
    try { opts.canvas.off('object:added', onHistoryObjectAdded) } catch {}
    try { opts.canvas.off('object:modified', onHistoryObjectModified) } catch {}
    try { opts.canvas.off('object:removed', onHistoryObjectRemoved) } catch {}
  }
}
