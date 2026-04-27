export type SaveSource = 'user' | 'system'

export type SaveStatePolicyInput = {
  forceEmptyOverwrite?: boolean
  allowEmptyOverwrite?: boolean
  source?: SaveSource
}

export const getAdaptiveCoalesceDelayMs = (reason: string, objectCount: number): number => {
  if (!String(reason || '').startsWith('object:')) return 0
  if (objectCount >= 1200) return 600
  if (objectCount >= 700) return 450
  if (objectCount >= 300) return 280
  if (objectCount >= 100) return 150
  return 80
}

export const shouldSkipLifecycleSave = (
  saveReason: string,
  lastTransformMutationAt: number,
  now = Date.now()
): boolean => {
  return saveReason.startsWith('lifecycle:') && (now - lastTransformMutationAt) < 350
}

export const shouldRunHeavySanitizeForReason = (saveReason: string): boolean => {
  return saveReason.includes('post-load')
    || saveReason.startsWith('lifecycle:')
    || saveReason.includes('frame-fix')
    || saveReason.includes('history')
    || saveReason.includes('load')
}

export const canAllowEmptyOverwrite = (opts: SaveStatePolicyInput): boolean => {
  const source = (opts.source || 'user') as SaveSource
  return !!opts.forceEmptyOverwrite || (!!opts.allowEmptyOverwrite && source !== 'system')
}

export const shouldSkipAutoSave = (source: SaveSource, reason: string): boolean => {
  return source === 'system'
    || reason === 'initial-history-capture'
    || reason === 'post-load-cleanup'
    || reason.startsWith('lifecycle:')
    || reason.startsWith('viewport:')
    || reason.startsWith('object:')  // canvas events: only undo history, upload via periodic timer
}

export const shouldSkipThumbnailForReason = (source: SaveSource, reason: string): boolean => {
  return source === 'system'
    || reason === 'initial-history-capture'
    || reason === 'post-load-cleanup'
    || reason.startsWith('lifecycle:')
    || reason.startsWith('viewport:')
}

export const getThumbnailMinIntervalMs = (reason: string): number => {
  const isModifiedReason = reason === 'object:modified' || reason === 'object:modified(zone)'
  return isModifiedReason ? 8000 : 3000
}

export const canGenerateThumbnailNow = (opts: {
  source: SaveSource
  reason: string
  lastThumbnailAt: number
  now?: number
}): boolean => {
  if (shouldSkipThumbnailForReason(opts.source, opts.reason)) return false
  const now = Number.isFinite(opts.now as number) ? Number(opts.now) : Date.now()
  const minInterval = getThumbnailMinIntervalMs(opts.reason)
  return (now - opts.lastThumbnailAt) >= minInterval
}

export const shouldSkipByFingerprint = (opts: {
  skipIfUnchanged?: boolean
  lastSavedFingerprint?: string | null
  currentFingerprint: string
}): boolean => {
  return !!(opts.skipIfUnchanged ?? true) && String(opts.lastSavedFingerprint || '') === opts.currentFingerprint
}

export const isDuplicateHistoryEntry = (lastEntry: string | undefined, currentEntry: string): boolean => {
  return lastEntry === currentEntry
}
