import { compactBusinessFooter } from '../../utils/compactBusinessFooter'
import { repairDynamicTextLayoutBounds } from '../../utils/dynamicTextLayoutBounds'

/** Fabric capability needed when manual validity repair must add a missing band. */
export type ManualValidityBackdropFactory = (
  props: Record<string, any>,
  index: number
) => any

export type ManualFlyerCompositionResult = {
  changed: boolean
  unresolved: string[]
}

/**
 * Runs the same shared footer/validity composition used by the Quick Editor.
 * Call after business fields and fonts have been hydrated and before export.
 *
 * The injected factory must create a Fabric object, insert it into `objects`
 * at the requested index, and apply the renderer's frame clipping rules.
 */
export const layoutManualFlyerComposition = (
  objects: any[],
  createValidityBackdrop: ManualValidityBackdropFactory
): ManualFlyerCompositionResult => {
  // Match the editor's manual order: settle contacts, repair validity/text
  // bounds, then settle contacts again after the repair changed its geometry.
  let changed = compactBusinessFooter(objects)
  const repair = repairDynamicTextLayoutBounds(objects, createValidityBackdrop)
  changed = compactBusinessFooter(objects) || changed

  return {
    changed: changed || repair.changed,
    unresolved: repair.unresolved
  }
}
