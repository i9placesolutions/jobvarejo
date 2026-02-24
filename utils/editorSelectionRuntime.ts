type RefreshSelectedRefWithRecoveryOptions = {
  canvas: any
  selectedObjectRef: { value: any }
  snapshotForPropertiesPanel: (obj: any, extra?: Record<string, any>) => any
  triggerSelectedObjectRef: () => void
  extra?: Record<string, any>
}

export const refreshSelectedRefWithRecovery = (
  opts: RefreshSelectedRefWithRecoveryOptions
) => {
  const active = opts.canvas?.getActiveObject?.()
  if (active) {
    opts.selectedObjectRef.value = opts.snapshotForPropertiesPanel(active, opts.extra)
    return
  }

  const lastSnap = opts.selectedObjectRef.value
  if (lastSnap && lastSnap._customId && opts.canvas) {
    const realObj = opts.canvas.getObjects().find((o: any) => o._customId === lastSnap._customId)
    if (realObj) {
      try {
        opts.canvas.setActiveObject(realObj)
      } catch {
        // ignore
      }
      opts.selectedObjectRef.value = opts.snapshotForPropertiesPanel(realObj, opts.extra)
      return
    }
  }

  opts.triggerSelectedObjectRef()
}

export const syncSelectionCoords = (active: any) => {
  try {
    active?.setCoords?.()
    active?.group?.setCoords?.()
  } catch {
    // ignore
  }
}

export const ensureActiveZoneFlagsForSelection = (active: any) => {
  if (!active) return
  if (!active.isGridZone && !active.isProductZone) {
    if (active.name === 'gridZone') {
      active.isGridZone = true
    } else if (active.name === 'productZoneContainer') {
      active.isProductZone = true
    } else {
      active.isGridZone = true
    }
  }
}

export const shouldShowPenContextualToolbar = (
  active: any,
  isNodeEditing: boolean,
  currentEditingPath: any
): boolean => {
  return !!(
    (active && active.isVectorPath) ||
    (isNodeEditing && currentEditingPath?.isVectorPath)
  )
}

type DeriveSelectionUiStateOptions = {
  active: any
  isNodeEditing: boolean
  currentEditingPath: any
  snapshotForPropertiesPanel: (obj: any) => any
}

export const deriveSelectionUiState = (opts: DeriveSelectionUiStateOptions): {
  selectedObjectId: string | null
  selectedObjectIds: string[]
  selectedObjectSnapshot: any
  showPenContextualToolbar: boolean
} => {
  const active = opts.active
  let selectedObjectIds: string[] = []

  if (active) {
    const activeType = String(active?.type || '').toLowerCase()
    if (activeType === 'activeselection' && typeof active.getObjects === 'function') {
      selectedObjectIds = (active.getObjects() || [])
        .map((o: any) => String(o?._customId || '').trim())
        .filter((id: string) => !!id)
    } else {
      const id = String(active?._customId || '').trim()
      if (id) selectedObjectIds = [id]
    }
  }

  return {
    selectedObjectId: selectedObjectIds[0] ?? null,
    selectedObjectIds,
    selectedObjectSnapshot: active ? opts.snapshotForPropertiesPanel(active) : null,
    showPenContextualToolbar: shouldShowPenContextualToolbar(
      active,
      opts.isNodeEditing,
      opts.currentEditingPath
    )
  }
}

export const getSelectedObjectFloatingPos = (
  active: any,
  isLikelyProductZone: (obj: any) => boolean
): { top: number; left: number; width: number; visible: boolean } => {
  if (active && isLikelyProductZone(active)) {
    const boundingRect = active.getBoundingRect()
    return {
      top: Number(boundingRect?.top || 0),
      left: Number(boundingRect?.left || 0),
      width: Number(boundingRect?.width || 0),
      visible: true
    }
  }
  return {
    top: 0,
    left: 0,
    width: 0,
    visible: false
  }
}

export const buildZoneSelectionConfig = (active: any) => {
  const pad = typeof active?._zonePadding === 'number'
    ? active._zonePadding
    : (active?.padding || 20)
  return {
    columns: active?.columns || 0,
    rows: active?.rows || 0,
    padding: pad,
    gapHorizontal: typeof active?.gapHorizontal === 'number' ? active.gapHorizontal : pad,
    gapVertical: typeof active?.gapVertical === 'number' ? active.gapVertical : pad,
    layoutDirection: active?.layoutDirection || 'horizontal',
    cardAspectRatio: active?.cardAspectRatio || 'auto',
    lastRowBehavior: active?.lastRowBehavior || 'fill',
    verticalAlign: active?.verticalAlign || 'stretch',
    highlightCount: active?.highlightCount || 0,
    highlightPos: active?.highlightPos || 'first',
    highlightHeight: active?.highlightHeight || 1.5,
    isLocked: !!(
      active?.lockMovementX ||
      active?.lockMovementY ||
      active?.lockScalingX ||
      active?.lockScalingY
    )
  }
}

type BuildSelectionSyncPayloadOptions = {
  canvas: any
  isLikelyProductZone: (obj: any) => boolean
  ensureZoneSanity: (obj: any) => void
  isNodeEditing: boolean
  currentEditingPath: any
  snapshotForPropertiesPanel: (obj: any) => any
}

export const buildSelectionSyncPayload = (opts: BuildSelectionSyncPayloadOptions): {
  active: any
  selectionUiState: {
    selectedObjectId: string | null
    selectedObjectIds: string[]
    selectedObjectSnapshot: any
    showPenContextualToolbar: boolean
  }
  floatingPos: { top: number; left: number; width: number; visible: boolean }
} | null => {
  const canvas = opts.canvas
  if (!canvas) return null

  const active = canvas.getActiveObject()
  syncSelectionCoords(active)

  if (active && opts.isLikelyProductZone(active)) {
    ensureActiveZoneFlagsForSelection(active)
    opts.ensureZoneSanity(active)
  }

  const selectionUiState = deriveSelectionUiState({
    active,
    isNodeEditing: opts.isNodeEditing,
    currentEditingPath: opts.currentEditingPath,
    snapshotForPropertiesPanel: opts.snapshotForPropertiesPanel
  })

  const floatingPos = getSelectedObjectFloatingPos(active, opts.isLikelyProductZone)
  return {
    active,
    selectionUiState,
    floatingPos
  }
}

type ProductZoneStateLike = {
  updateZone: (config: any) => void
  updateGlobalStyles: (styles: any) => void
}

type SyncSelectionDomainStateOptions = {
  active: any
  canvas: any
  productZoneState: ProductZoneStateLike
  isLikelyProductZone: (obj: any) => boolean
  isLikelyProductCard: (obj: any) => boolean
  getZoneGlobalStyles: (obj: any) => any
  getPreferredProductImageFromGroup: (group: any) => any
  getImageSourceFromObject: (img: any) => string
  isLikelyPlaceholderImageSrc: (src: string) => boolean
  scheduleMissingProductImageRecovery: (delayMs: number, maxRetries: number) => void
}

export const syncSelectionDomainState = (opts: SyncSelectionDomainStateOptions) => {
  const active = opts.active
  if (!active) return

  if (opts.isLikelyProductZone(active)) {
    const zoneConfig = buildZoneSelectionConfig(active)
    opts.productZoneState.updateZone(zoneConfig)
    opts.productZoneState.updateGlobalStyles(opts.getZoneGlobalStyles(active))
    return
  }

  if (!opts.isLikelyProductCard(active)) return

  const parentZoneId = active.parentZoneId
  if (parentZoneId && opts.canvas) {
    const parentZone = opts.canvas.getObjects().find((o: any) => (
      opts.isLikelyProductZone(o) && o._customId === parentZoneId
    ))
    if (parentZone) {
      opts.productZoneState.updateGlobalStyles(opts.getZoneGlobalStyles(parentZone))
    }
  }

  const selectedImage = opts.getPreferredProductImageFromGroup(active)
  const selectedSrc = selectedImage ? opts.getImageSourceFromObject(selectedImage) : ''
  const missingImageOnSelectedCard = !selectedImage || opts.isLikelyPlaceholderImageSrc(selectedSrc)
  // Do not trigger auto-recovery on mere selection.
  // Running recovery here causes "card changed by itself" behavior a few ms after click.
  // Recovery is still triggered by load/rehydration flows where it's expected.
  if (missingImageOnSelectedCard) return
}
