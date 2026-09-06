const ORIGINAL_LAYOUT_METHOD = '__jobvarejoOriginalPerformLayout'

export const disableFabricGroupAutoLayout = (group: any): void => {
  const layoutManager = group?.layoutManager
  if (layoutManager && typeof layoutManager.performLayout === 'function') {
    if (typeof layoutManager[ORIGINAL_LAYOUT_METHOD] !== 'function') {
      layoutManager[ORIGINAL_LAYOUT_METHOD] = layoutManager.performLayout
    }
    layoutManager.performLayout = () => {}
  }

  group?.set?.({ objectCaching: false, statefullCache: false })
}

export const refreshFabricGroupBounds = (group: any): boolean => {
  if (!group) return false

  const layoutManager = group.layoutManager
  const originalPerformLayout = layoutManager?.[ORIGINAL_LAYOUT_METHOD]
  let refreshed = false

  try {
    if (typeof originalPerformLayout === 'function') {
      originalPerformLayout.call(layoutManager, {
        type: 'imperative',
        target: group,
        bubbles: false
      })
      refreshed = true
    } else if (typeof group.triggerLayout === 'function') {
      group.triggerLayout()
      refreshed = true
    }
  } catch {
    refreshed = false
  }

  group.setCoords?.()
  group.set?.({ dirty: true })
  group.dirty = true
  return refreshed
}
