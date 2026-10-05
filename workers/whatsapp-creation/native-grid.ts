import { createEditorProductGridController } from '../../utils/editorProductGridController'
import { calculateGridLayout, getAspectRatioValue } from '../../utils/product-zone-helpers'
import { getZoneHighlightPredicate } from '../../utils/zoneHighlightHelpers'
import { createDefaultProductZoneStructureMap, DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT,
  normalizeProductZoneStructureMapByPreviewFormat, normalizeProductZoneStructureVariantMapByPreviewFormat,
  resolveProductZoneStructure } from '../../utils/product-zone-structure'

/** Obtém os slots pelo controlador manual; os proxies dispensam render de cards para medir a grade. */
export function calculateManualProductSlots(sourceZone: any, count: number, previewFormat: string, bounds: any) {
  const noop = () => undefined
  const set = function(this: any, key: any, value?: any) {
    if (typeof key === 'string') this[key] = value
    else Object.assign(this, key)
    return this
  }
  const zone: any = { ...sourceZone, _customId: sourceZone._customId || 'native-zone',
    _zoneWidth: bounds.width, _zoneHeight: bounds.height, width: bounds.width, height: bounds.height,
    scaleX: 1, scaleY: 1, set, setCoords: noop, getObjects: () => [],
    getBoundingRect: () => bounds }
  const cards: any[] = Array.from({ length: count }, (_, i) => ({
    _customId: `slot-${i}`, parentZoneId: zone._customId, _zoneOrder: i,
    width: 1, height: 1, set, setCoords: noop
  }))
  const styles = { ...(zone._zoneGlobalStyles || {}) }
  const controller = createEditorProductGridController({
    canvas: { value: { getObjects: () => cards } },
    makeId: () => zone._customId, isMobile: { value: false }, isTablet: { value: false },
    DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT,
    productZoneStructuresState: { isLoaded: { value: false }, structureMapsByPreviewFormat: { value: null } },
    productCardConfigurationState: { isLoaded: { value: false } },
    isTemplateCompositionManagedZone: () => true, hasPersistedProductZoneStructure: () => true,
    hasPersistedCardLayout: () => true,
    createDefaultProductZoneStructureMap, normalizeProductZoneStructureMapByPreviewFormat,
    normalizeProductZoneStructureVariantMapByPreviewFormat, resolveProductZoneStructure,
    // resolveProductZoneStructure already falls back when a persisted variant is invalid.
    preserveValidZoneStructureVariantSelection: noop, preserveValidZoneStructureVariantSelectionsByPreviewFormat: noop,
    getZoneRect: () => null, getZoneMetrics: () => bounds, getZoneChildren: () => cards,
    getCurrentProductZonePreviewFormat: () => previewFormat,
    getZoneGlobalStyles: () => styles, getResolvedZoneFrameId: () => sourceZone.parentFrameId,
    applyCardFrameBinding: noop, calculateGridLayout, getAspectRatioValue, getZoneHighlightPredicate,
    clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    harmonizeProductCardTypography: noop, safeRequestRenderAll: noop, saveCurrentState: noop
  })
  controller.recalculateZoneLayout(zone, cards, { save: false, requestRender: false, skipResize: true, trustCachedChildren: true })
  return cards.map(card => {
    const slot = card._zoneSlot
    if (!slot || ![slot.left, slot.top, slot.width, slot.height].every(Number.isFinite) || slot.width <= 0 || slot.height <= 0) {
      throw new Error('O controlador manual não encontrou um encaixe válido para todos os produtos.')
    }
    return { ...slot, highlighted: !!card._cardHighlighted, refCellWidth: styles.__refCellW, refCellHeight: styles.__refCellH }
  })
}
