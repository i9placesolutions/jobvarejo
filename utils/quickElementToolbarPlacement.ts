export type QuickElementToolbarPlacement = {
  left: number
  top: number
  side: 'above' | 'below' | 'right' | 'left' | 'edge'
}

export type QuickElementToolbarPlacementInput = {
  targetLeft: number
  targetTop: number
  targetWidth: number
  targetHeight: number
  viewportWidth: number
  viewportHeight: number
  toolbarWidth: number
  toolbarHeight: number
  gap?: number
  padding?: number
  rotationClearance?: number
}

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback

/** Places compact element actions outside the selected object when space allows. */
export const getQuickElementToolbarPlacement = (
  input: QuickElementToolbarPlacementInput
): QuickElementToolbarPlacement => {
  const viewportWidth = Math.max(1, finite(input.viewportWidth, 1))
  const viewportHeight = Math.max(1, finite(input.viewportHeight, 1))
  const padding = Math.max(0, finite(input.padding ?? 8))
  const gap = Math.max(0, finite(input.gap ?? 8))
  const rotationClearance = Math.max(0, finite(input.rotationClearance ?? 50))
  const toolbarWidth = Math.max(1, finite(input.toolbarWidth, 32))
  const toolbarHeight = Math.max(1, finite(input.toolbarHeight, 30))
  const targetLeft = finite(input.targetLeft)
  const targetTop = finite(input.targetTop)
  const targetWidth = Math.max(0, finite(input.targetWidth))
  const targetHeight = Math.max(0, finite(input.targetHeight))
  const targetRight = targetLeft + targetWidth
  const targetBottom = targetTop + targetHeight
  const centeredLeft = targetLeft + (targetWidth - toolbarWidth) / 2
  const centeredTop = targetTop + (targetHeight - toolbarHeight) / 2

  const candidates: Array<{ left: number; top: number; side: QuickElementToolbarPlacement['side'] }> = [
    { left: centeredLeft, top: targetTop - toolbarHeight - rotationClearance, side: 'above' },
    { left: centeredLeft, top: targetBottom + gap, side: 'below' },
    { left: targetRight + gap, top: centeredTop, side: 'right' },
    { left: targetLeft - toolbarWidth - gap, top: centeredTop, side: 'left' }
  ]

  const fitsViewport = (candidate: typeof candidates[number]) => (
    candidate.left >= padding
    && candidate.top >= padding
    && candidate.left + toolbarWidth <= viewportWidth - padding
    && candidate.top + toolbarHeight <= viewportHeight - padding
  )
  const outsideTarget = (candidate: typeof candidates[number]) => (
    candidate.left + toolbarWidth <= targetLeft
    || candidate.left >= targetRight
    || candidate.top + toolbarHeight <= targetTop
    || candidate.top >= targetBottom
  )
  const chosen = candidates.find(candidate => fitsViewport(candidate) && outsideTarget(candidate))

  if (chosen) return { left: chosen.left, top: chosen.top, side: chosen.side }

  const maxLeft = Math.max(padding, viewportWidth - toolbarWidth - padding)
  const maxTop = Math.max(padding, viewportHeight - toolbarHeight - padding)
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  // When no complete side fits, keep the control near the selection and inside the viewport.
  const fallback = candidates
    .map(candidate => {
      const left = clamp(candidate.left, padding, maxLeft)
      const top = clamp(candidate.top, padding, maxTop)
      const overlapWidth = Math.max(0, Math.min(left + toolbarWidth, targetRight) - Math.max(left, targetLeft))
      const overlapHeight = Math.max(0, Math.min(top + toolbarHeight, targetBottom) - Math.max(top, targetTop))
      return { left, top, side: candidate.side, overlap: overlapWidth * overlapHeight }
    })
    .sort((a, b) => a.overlap - b.overlap)[0]!

  return { left: fallback.left, top: fallback.top, side: 'edge' }
}
